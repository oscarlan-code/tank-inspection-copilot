package ai.laiq.tankinspection.presentation.screens

import ai.laiq.tankinspection.data.export.CanonicalPackageExporter
import ai.laiq.tankinspection.data.export.ExportBundleSharer
import ai.laiq.tankinspection.data.export.ReportPlatformUploader
import ai.laiq.tankinspection.data.local.AppSessionStore
import ai.laiq.tankinspection.data.local.db.ExportBundleEntity
import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqLabeledValue
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.toCanonicalPackage
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import java.io.File

@Composable
fun ExportScreen(
    draftState: FieldDraftState,
    appSessionStore: AppSessionStore,
    onBack: () -> Unit,
    contentPadding: PaddingValues,
) {
    val context = LocalContext.current.applicationContext
    val exporter = remember(context) { CanonicalPackageExporter(context.filesDir) }
    val uploader = remember { ReportPlatformUploader() }
    val coroutineScope = rememberCoroutineScope()
    val packagePreview = draftState.toCanonicalPackage()
    var exportMessage by remember { mutableStateOf<String?>(null) }
    var recentExports by remember { mutableStateOf<List<ExportBundleEntity>>(emptyList()) }
    var uploadEndpoint by remember { mutableStateOf("") }
    var uploadMessage by remember { mutableStateOf<String?>(null) }
    var activeUploadExportId by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(appSessionStore) {
        recentExports = appSessionStore.recentExports()
        uploadEndpoint = appSessionStore.loadReportPlatformUploadEndpoint()
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = 16.dp,
            end = 16.dp,
            top = contentPadding.calculateTopPadding() + 12.dp,
            bottom = 24.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            LaiqSectionCard(
                title = "Canonical Package",
                subtitle = "Build the local handoff bundle, then share or upload it for report generation.",
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    LaiqLabeledValue("Package ID", packagePreview.packageId, modifier = Modifier.weight(1f))
                    LaiqLabeledValue("Schema", packagePreview.schemaVersion, modifier = Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    LaiqLabeledValue("Review", packagePreview.reviewStatus.status.name.lowercase(), modifier = Modifier.weight(1f))
                    LaiqLabeledValue("Attachments", draftState.attachments.size.toString(), modifier = Modifier.weight(1f))
                }
                if (!exportMessage.isNullOrBlank()) {
                    Text("Last export: $exportMessage", style = MaterialTheme.typography.bodySmall)
                }
                if (!uploadMessage.isNullOrBlank()) {
                    Text("Upload: $uploadMessage", style = MaterialTheme.typography.bodySmall)
                }
                LaiqPrimaryButton(
                    text = "Export Canonical Package",
                    onClick = {
                        coroutineScope.launch {
                            val exported = exporter.export(packagePreview)
                            val exportRecord = appSessionStore.recordExport(packagePreview, exported)
                            recentExports = appSessionStore.recentExports()
                            exportMessage = if (exportRecord.missingAttachmentCount > 0) {
                                "${exported.zipFile.absolutePath} (${exportRecord.missingAttachmentCount} missing attachment files)"
                            } else {
                                exported.zipFile.absolutePath
                            }
                        }
                    },
                )
            }
        }

        item {
            LaiqSectionCard(
                title = "Report Platform",
                subtitle = "Save the connected upload endpoint used after the local field capture step.",
            ) {
                OutlinedTextField(
                    value = uploadEndpoint,
                    onValueChange = { uploadEndpoint = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Report Platform Upload Endpoint") },
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                    singleLine = true,
                )
                LaiqSecondaryButton(
                    text = "Save Upload Endpoint",
                    onClick = {
                        coroutineScope.launch {
                            appSessionStore.saveReportPlatformUploadEndpoint(uploadEndpoint.trim())
                            uploadMessage = "Endpoint saved."
                        }
                    },
                )
            }
        }

        if (recentExports.isNotEmpty()) {
            item {
                LaiqSectionCard(
                    title = "Recent Bundles",
                    subtitle = "Share or upload bundles already created on this device.",
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        recentExports.forEach { export ->
                            ExportBundleCard(
                                export = export,
                                activeUploadExportId = activeUploadExportId,
                                onShare = {
                                    ExportBundleSharer.shareZip(context, export.zipFilePath)
                                    coroutineScope.launch {
                                        appSessionStore.markExportShared(export.exportId)
                                        recentExports = appSessionStore.recentExports()
                                    }
                                },
                                onUpload = {
                                    coroutineScope.launch {
                                        val endpoint = uploadEndpoint.trim()
                                        if (endpoint.isBlank()) {
                                            uploadMessage = "Save an upload endpoint first."
                                            return@launch
                                        }
                                        activeUploadExportId = export.exportId
                                        val result = uploader.uploadZip(
                                            endpointUrl = endpoint,
                                            zipFile = File(export.zipFilePath),
                                            packageId = export.packageId,
                                            schemaVersion = export.schemaVersion,
                                        )
                                        if (result.success) {
                                            appSessionStore.markExportUploaded(export.exportId)
                                            recentExports = appSessionStore.recentExports()
                                            uploadMessage = "Uploaded ${export.packageId} (${result.responseCode ?: 200})."
                                        } else {
                                            uploadMessage = "Upload failed: ${result.responseBody}"
                                        }
                                        activeUploadExportId = null
                                    }
                                },
                            )
                        }
                    }
                }
            }
        }

        item {
            LaiqSecondaryButton(
                text = "Back",
                onClick = onBack,
            )
        }
    }
}

@Composable
private fun ExportBundleCard(
    export: ExportBundleEntity,
    activeUploadExportId: String?,
    onShare: () -> Unit,
    onUpload: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color.White,
        shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(export.packageId, style = MaterialTheme.typography.titleSmall)
                ai.laiq.tankinspection.presentation.components.LaiqStatusBadge(
                    export.status.replaceFirstChar { it.uppercase() },
                    exportTone(export.status),
                )
            }
            Text(export.exportedAtIso, style = MaterialTheme.typography.bodySmall, color = LaiqColors.MutedText)
            Text("ZIP: ${export.zipFilePath}", style = MaterialTheme.typography.bodySmall)
            Text(
                "Attachments ${export.attachmentCount} · Missing ${export.missingAttachmentCount}",
                style = MaterialTheme.typography.bodySmall,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                LaiqSecondaryButton(
                    text = if (export.status == "shared") "Share Again" else "Share",
                    onClick = onShare,
                    modifier = Modifier.weight(1f),
                )
                LaiqPrimaryButton(
                    text = when {
                        activeUploadExportId == export.exportId -> "Uploading..."
                        export.status == "uploaded" -> "Upload Again"
                        else -> "Upload"
                    },
                    onClick = onUpload,
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

package ai.laiq.tankinspection.presentation.screens

import ai.laiq.tankinspection.data.local.AttachmentFileStore
import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.MflImportDraftInput
import ai.laiq.tankinspection.presentation.localInspectionStorageKey
import ai.laiq.tankinspection.presentation.saveMflImportDraft
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val mflSeverities = listOf("low", "medium", "high")

@Composable
fun MflImportScreen(
    draftState: FieldDraftState,
    onDraftStateChange: (FieldDraftState) -> Unit,
    onBack: () -> Unit,
    contentPadding: PaddingValues,
) {
    val context = LocalContext.current
    val attachmentStore = remember(context) { AttachmentFileStore(context.filesDir) }
    val scope = rememberCoroutineScope()
    val inspectionStorageKey = remember(draftState.startedAtIso, draftState.setup.tankNumber, draftState.savedSetupBaseline?.tankNumber) {
        draftState.localInspectionStorageKey()
    }
    val pdfLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument(),
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val imported = withContext(Dispatchers.IO) {
                attachmentStore.importMflPdf(context, inspectionStorageKey, uri)
            }
            onDraftStateChange(
                draftState.copy(
                    mflImportDraft = draftState.mflImportDraft.copy(
                        pdfRelativePath = imported.relativePath,
                        pdfCaption = draftState.mflImportDraft.pdfCaption.ifBlank { imported.displayName },
                        attachmentId = null,
                    ),
                ),
            )
        }
    }
    val mflAttachments = draftState.attachments.filter { it.kind == "mfl_report" }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = 16.dp,
            end = 16.dp,
            top = contentPadding.calculateTopPadding() + 16.dp,
            bottom = 24.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Card {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text("Bottom MFL handoff", style = MaterialTheme.typography.titleMedium)
                    Text("Attach only the third-party PDF and capture enough metadata for the report lane.")

                    MflImportInputs(
                        draft = draftState.mflImportDraft,
                        onDraftChange = { updated ->
                            onDraftStateChange(draftState.copy(mflImportDraft = updated))
                        },
                    )

                    Button(
                        onClick = { pdfLauncher.launch(arrayOf("application/pdf")) },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            if (draftState.mflImportDraft.pdfRelativePath.isBlank()) {
                                "Select MFL PDF"
                            } else {
                                "Replace MFL PDF"
                            },
                        )
                    }
                    if (draftState.mflImportDraft.pdfRelativePath.isNotBlank()) {
                        Text("PDF: ${draftState.mflImportDraft.pdfRelativePath}")
                    }

                    Button(
                        onClick = { onDraftStateChange(draftState.saveMflImportDraft()) },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Save MFL Handoff")
                    }
                }
            }
        }

        item {
            Text("Saved MFL metadata", style = MaterialTheme.typography.titleMedium)
        }

        item {
            Card {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(
                        draftState.mflImportDraft.reportReference.ifBlank { "No MFL report reference saved" },
                        style = MaterialTheme.typography.titleSmall,
                    )
                    if (draftState.mflImportDraft.contractor.isNotBlank()) {
                        Text("Contractor: ${draftState.mflImportDraft.contractor}")
                    }
                    if (draftState.mflImportDraft.reportDate.isNotBlank()) {
                        Text("Report date: ${draftState.mflImportDraft.reportDate}")
                    }
                    Text("Severity: ${draftState.mflImportDraft.severity}")
                    Text(
                        draftState.mflImportDraft.attachmentId?.let { "Attachment: $it" }
                            ?: "Attachment: not saved yet",
                    )
                }
            }
        }

        item {
            Text("MFL attachments", style = MaterialTheme.typography.titleMedium)
        }

        items(mflAttachments) { attachment ->
            Card {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(attachment.attachmentId, style = MaterialTheme.typography.titleSmall)
                    Text(attachment.relativePath)
                    if (!attachment.caption.isNullOrBlank()) {
                        Text(attachment.caption)
                    }
                }
            }
        }

        item {
            Button(
                onClick = onBack,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Back to Task Board")
            }
        }
    }
}

@Composable
private fun MflImportInputs(
    draft: MflImportDraftInput,
    onDraftChange: (MflImportDraftInput) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = draft.contractor,
            onValueChange = { onDraftChange(draft.copy(contractor = it)) },
            label = { Text("Contractor") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = draft.reportReference,
            onValueChange = { onDraftChange(draft.copy(reportReference = it)) },
            label = { Text("Report reference") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = draft.reportDate,
            onValueChange = { onDraftChange(draft.copy(reportDate = it)) },
            label = { Text("Report date") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Text("Severity", style = MaterialTheme.typography.titleSmall)
        mflSeverities.forEach { severity ->
            androidx.compose.foundation.layout.Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                RadioButton(
                    selected = draft.severity == severity,
                    onClick = { onDraftChange(draft.copy(severity = severity)) },
                )
                Text(severity)
            }
        }
        OutlinedTextField(
            value = draft.pdfRelativePath,
            onValueChange = { onDraftChange(draft.copy(pdfRelativePath = it)) },
            label = { Text("PDF relative path") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = draft.pdfCaption,
            onValueChange = { onDraftChange(draft.copy(pdfCaption = it)) },
            label = { Text("PDF caption") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

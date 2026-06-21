package ai.laiq.tankinspection.presentation.v3product.taskhome

import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqDeleteConfirmDialog
import ai.laiq.tankinspection.presentation.components.LaiqDeleteDialogState
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.components.LaiqStatusBadge
import ai.laiq.tankinspection.presentation.components.LaiqTextField
import ai.laiq.tankinspection.v3product.storage.ProductExportPackageSummary
import ai.laiq.tankinspection.v3product.storage.ProductExportValidationCheck
import ai.laiq.tankinspection.v3product.storage.ProductLocalProfile
import ai.laiq.tankinspection.v3product.storage.ProductTaskLifecycle
import ai.laiq.tankinspection.v3product.storage.ProductTaskSummary
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

data class ProductTaskHomeUiState(
    val isLoading: Boolean = true,
    val profile: ProductLocalProfile? = null,
    val tasks: List<ProductTaskSummary> = emptyList(),
)

data class ProductExportReviewUiState(
    val task: ProductTaskSummary,
    val isLoading: Boolean = true,
    val isExporting: Boolean = false,
    val validationChecks: List<ProductExportValidationCheck> = emptyList(),
    val latestExportPackage: ProductExportPackageSummary? = null,
    val errorMessage: String? = null,
) {
    val canExport: Boolean
        get() = validationChecks.isNotEmpty() && validationChecks.none { check ->
            check.blocksExport && !check.passed
        }
}

@Composable
fun ProductTaskHomeScreen(
    state: ProductTaskHomeUiState,
    exportReviewState: ProductExportReviewUiState?,
    onStartNewInspection: () -> Unit,
    onContinueInspection: (ProductTaskSummary) -> Unit,
    onReviewExport: (ProductTaskSummary) -> Unit,
    onDismissExportReview: () -> Unit,
    onExportInspection: (ProductTaskSummary) -> Unit,
    onArchiveInspection: (ProductTaskSummary) -> Unit,
    onDeleteInspection: (ProductTaskSummary) -> Unit,
    onSaveProfile: (tenantName: String, workspaceName: String, displayName: String) -> Unit,
    contentPadding: PaddingValues = PaddingValues(0.dp),
) {
    var archiveTarget by remember { mutableStateOf<ProductTaskSummary?>(null) }
    var deleteTarget by remember { mutableStateOf<ProductTaskSummary?>(null) }
    var showProfileDialog by remember { mutableStateOf(false) }
    val profile = state.profile
    val ongoingTasks = state.tasks.filter { task -> task.lifecycle == ProductTaskLifecycle.ONGOING }
    val archivedTasks = state.tasks.filter { task -> task.lifecycle == ProductTaskLifecycle.ARCHIVED }

    if (archiveTarget != null) {
        LaiqDeleteConfirmDialog(
            state = LaiqDeleteDialogState(
                title = "Archive Inspection",
                message = "Move ${archiveTarget?.inspectionReference.orEmpty()} out of the ongoing list?",
                confirmText = "Archive",
                onConfirm = { archiveTarget?.let(onArchiveInspection) },
            ),
            onDismiss = { archiveTarget = null },
        )
    }
    if (deleteTarget != null) {
        LaiqDeleteConfirmDialog(
            state = LaiqDeleteDialogState(
                title = "Delete Inspection",
                message = "Permanently delete ${deleteTarget?.inspectionReference.orEmpty()} and its local files?",
                confirmText = "Delete",
                onConfirm = { deleteTarget?.let(onDeleteInspection) },
            ),
            onDismiss = { deleteTarget = null },
        )
    }
    if (showProfileDialog && profile != null) {
        ProfileEditorDialog(
            profile = profile,
            onDismiss = { showProfileDialog = false },
            onSave = { tenantName, workspaceName, displayName ->
                onSaveProfile(tenantName, workspaceName, displayName)
                showProfileDialog = false
            },
        )
    }
    if (exportReviewState != null) {
        ExportReviewDialog(
            state = exportReviewState,
            onDismiss = onDismissExportReview,
            onExport = { onExportInspection(exportReviewState.task) },
        )
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = 16.dp,
            end = 16.dp,
            top = contentPadding.calculateTopPadding() + 12.dp,
            bottom = 28.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Text(
                "Task Home",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.SemiBold,
                color = LaiqColors.BrandTeal,
                modifier = Modifier.padding(horizontal = 4.dp),
            )
        }

        item {
            LaiqSectionCard(
                title = "Local Profile",
                subtitle = "Tenant, workspace, and inspector scaffolding for product-backed tasks.",
            ) {
                if (profile == null) {
                    Text(
                        text = if (state.isLoading) "Loading local profile..." else "Profile unavailable.",
                        color = LaiqColors.MutedText,
                    )
                } else {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        LaiqStatChip(
                            label = "Tenant",
                            value = profile.tenantName,
                            modifier = Modifier.weight(1f),
                        )
                        LaiqStatChip(
                            label = "Workspace",
                            value = profile.workspaceName,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        LaiqStatChip(
                            label = "Inspector",
                            value = profile.displayName,
                            modifier = Modifier.weight(1f),
                        )
                        LaiqStatChip(
                            label = "Role",
                            value = profile.roleLabel,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    LaiqSecondaryButton(
                        text = "Edit Local Profile",
                        onClick = { showProfileDialog = true },
                    )
                }
            }
        }

        item {
            LaiqSectionCard(
                title = "Start",
                subtitle = "Create a new inspection task. Durable task IDs are created once the required setup is valid.",
            ) {
                LaiqPrimaryButton(
                    text = "Start New Inspection",
                    onClick = onStartNewInspection,
                )
            }
        }

        item {
            LaiqSectionCard(
                title = "Ongoing Inspections",
                subtitle = "Continue, archive, or delete active product tasks.",
            ) {
                if (state.isLoading) {
                    Text("Loading tasks...", color = LaiqColors.MutedText)
                } else if (ongoingTasks.isEmpty()) {
                    Text("No ongoing inspections yet.", color = LaiqColors.MutedText)
                } else {
                    ongoingTasks.forEach { task ->
                        TaskCard(
                            task = task,
                            onContinue = { onContinueInspection(task) },
                            onReviewExport = { onReviewExport(task) },
                            onArchive = { archiveTarget = task },
                            onDelete = { deleteTarget = task },
                        )
                    }
                }
            }
        }

        if (archivedTasks.isNotEmpty()) {
            item {
                LaiqSectionCard(
                    title = "Archived",
                    subtitle = "Archived inspections stay read-only in Task Home until they are deleted.",
                ) {
                    archivedTasks.forEach { task ->
                        TaskCard(
                            task = task,
                            onContinue = {},
                            onReviewExport = {},
                            onArchive = {},
                            onDelete = { deleteTarget = task },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TaskCard(
    task: ProductTaskSummary,
    onContinue: () -> Unit,
    onReviewExport: () -> Unit,
    onArchive: () -> Unit,
    onDelete: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color.White,
        shape = MaterialTheme.shapes.large,
        tonalElevation = 0.dp,
        shadowElevation = 0.dp,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = task.inspectionReference,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = LaiqColors.BodyText,
            )
            Text(
                text = listOf(task.client, task.tankNumber, task.location)
                    .filter { value -> value.isNotBlank() }
                    .joinToString(" • "),
                style = MaterialTheme.typography.bodyMedium,
                color = LaiqColors.MutedText,
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                LaiqStatChip(
                    label = "Workflow",
                    value = task.currentScreen.label,
                    tone = LaiqColors.BrandTeal,
                    modifier = Modifier.weight(1f),
                )
                LaiqStatChip(
                    label = "Readiness",
                    value = task.readinessStatusLabel,
                    tone = readinessTone(task.readinessStatusCode),
                    modifier = Modifier.weight(1f),
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                LaiqStatChip(
                    label = "Export",
                    value = task.exportStatusLabel,
                    tone = exportTone(task.exportStatusCode),
                    modifier = Modifier.weight(1f),
                )
                LaiqStatChip(
                    label = "Updated",
                    value = formatUpdatedAt(task.updatedAtIso),
                    tone = LaiqColors.MutedText,
                    modifier = Modifier.weight(1f),
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                if (task.lifecycle == ProductTaskLifecycle.ONGOING) {
                    LaiqPrimaryButton(
                        text = "Continue",
                        onClick = onContinue,
                        modifier = Modifier.weight(1f),
                    )
                    LaiqSecondaryButton(
                        text = if (task.exportStatusCode == "exported") "View Export" else "Review / Export",
                        onClick = onReviewExport,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
            if (task.lifecycle == ProductTaskLifecycle.ONGOING) {
                LaiqSecondaryButton(
                    text = "Archive",
                    onClick = onArchive,
                )
            }
            TextButton(
                onClick = onDelete,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Delete Inspection", color = LaiqColors.BrandRed, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun ExportReviewDialog(
    state: ProductExportReviewUiState,
    onDismiss: () -> Unit,
    onExport: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = {
            if (!state.isExporting) onDismiss()
        },
        title = {
            Text(
                text = "Review Export",
                color = LaiqColors.BrandTeal,
                fontWeight = FontWeight.SemiBold,
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    text = state.task.inspectionReference,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = LaiqColors.BodyText,
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    LaiqStatChip(
                        label = "Readiness",
                        value = state.task.readinessStatusLabel,
                        tone = readinessTone(state.task.readinessStatusCode),
                        modifier = Modifier.weight(1f),
                    )
                    LaiqStatChip(
                        label = "Export",
                        value = state.task.exportStatusLabel,
                        tone = exportTone(state.task.exportStatusCode),
                        modifier = Modifier.weight(1f),
                    )
                }
                state.latestExportPackage?.let { latest ->
                    LatestExportCard(latest)
                }
                if (!state.errorMessage.isNullOrBlank()) {
                    Text(
                        text = state.errorMessage,
                        color = LaiqColors.BrandRed,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
                if (state.isLoading) {
                    Text(
                        text = "Loading export validation...",
                        color = LaiqColors.MutedText,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                } else if (state.validationChecks.isEmpty()) {
                    Text(
                        text = "No validation checks were found for this inspection yet.",
                        color = LaiqColors.MutedText,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                } else {
                    state.validationChecks.forEach { check ->
                        ValidationCheckCard(check)
                    }
                }
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !state.isExporting,
            ) {
                Text("Close", color = LaiqColors.BrandTeal)
            }
        },
        confirmButton = {
            TextButton(
                onClick = onExport,
                enabled = !state.isLoading && !state.isExporting && state.canExport,
            ) {
                Text(
                    text = when {
                        state.isExporting -> "Exporting..."
                        state.latestExportPackage != null -> "Export Again"
                        else -> "Export"
                    },
                    color = LaiqColors.BrandRed,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        },
    )
}

@Composable
private fun LatestExportCard(summary: ProductExportPackageSummary) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color.White,
        shape = MaterialTheme.shapes.large,
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = "Latest Export",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = LaiqColors.BrandTeal,
            )
            Text(
                text = "Exported ${formatUpdatedAt(summary.exportedAtIso)}",
                style = MaterialTheme.typography.bodyMedium,
                color = LaiqColors.BodyText,
            )
            Text(
                text = "Schema v${summary.schemaVersion} • ${summary.validationStatusLabel}",
                style = MaterialTheme.typography.bodySmall,
                color = LaiqColors.MutedText,
            )
            Text(
                text = summary.fileRelativePath,
                style = MaterialTheme.typography.bodySmall,
                color = LaiqColors.BodyText,
            )
            summary.fileByteSize?.let { byteSize ->
                Text(
                    text = "Package size: ${formatByteSize(byteSize)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.MutedText,
                )
            }
        }
    }
}

@Composable
private fun ValidationCheckCard(check: ProductExportValidationCheck) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color.White,
        shape = MaterialTheme.shapes.large,
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = check.ruleLabel,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = LaiqColors.BodyText,
                    modifier = Modifier.weight(1f),
                )
                LaiqStatusBadge(
                    text = when {
                        check.passed -> "Pass"
                        check.blocksExport -> "Blocked"
                        else -> "Review"
                    },
                    tone = when {
                        check.passed -> LaiqColors.StatusReady
                        check.blocksExport -> LaiqColors.BrandRed
                        else -> LaiqColors.AccentOrange
                    },
                )
            }
            Text(
                text = check.message,
                style = MaterialTheme.typography.bodySmall,
                color = LaiqColors.MutedText,
            )
        }
    }
}

@Composable
private fun ProfileEditorDialog(
    profile: ProductLocalProfile,
    onDismiss: () -> Unit,
    onSave: (tenantName: String, workspaceName: String, displayName: String) -> Unit,
) {
    var tenantName by remember(profile.tenantName) { mutableStateOf(profile.tenantName) }
    var workspaceName by remember(profile.workspaceName) { mutableStateOf(profile.workspaceName) }
    var displayName by remember(profile.displayName) { mutableStateOf(profile.displayName) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Edit Local Profile",
                color = LaiqColors.BrandTeal,
                fontWeight = FontWeight.SemiBold,
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                LaiqTextField(
                    value = tenantName,
                    onValueChange = { tenantName = it },
                    label = { Text("Tenant") },
                    modifier = Modifier.fillMaxWidth(),
                )
                LaiqTextField(
                    value = workspaceName,
                    onValueChange = { workspaceName = it },
                    label = { Text("Workspace") },
                    modifier = Modifier.fillMaxWidth(),
                )
                LaiqTextField(
                    value = displayName,
                    onValueChange = { displayName = it },
                    label = { Text("Inspector Name") },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = LaiqColors.BrandTeal)
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSave(tenantName, workspaceName, displayName)
                },
            ) {
                Text("Save", color = LaiqColors.BrandRed, fontWeight = FontWeight.SemiBold)
            }
        },
    )
}

private fun readinessTone(code: String): Color =
    when {
        code == "ready" -> LaiqColors.StatusReady
        code.startsWith("blocked") -> LaiqColors.StatusWarning
        else -> LaiqColors.StatusInfo
    }

private fun exportTone(code: String): Color =
    when (code) {
        "exported" -> LaiqColors.StatusReady
        "ready_to_export" -> LaiqColors.StatusInfo
        "stale_export" -> LaiqColors.StatusWarning
        else -> LaiqColors.StatusDraft
    }

private fun formatUpdatedAt(value: String): String =
    runCatching {
        Instant.parse(value)
            .atZone(ZoneId.systemDefault())
            .format(UPDATED_AT_FORMATTER)
    }.getOrDefault(value.ifBlank { "Unknown" })

private val UPDATED_AT_FORMATTER: DateTimeFormatter =
    DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm")

private fun formatByteSize(value: Long): String =
    when {
        value >= 1_048_576L -> String.format(Locale.US, "%.1f MB", value / 1_048_576.0)
        value >= 1_024L -> String.format(Locale.US, "%.1f KB", value / 1_024.0)
        else -> "$value B"
    }

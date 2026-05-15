package ai.laiq.tankinspection.presentation.screens

import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.FieldTask
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.components.LaiqStatusBadge
import ai.laiq.tankinspection.presentation.reviewWarnings
import ai.laiq.tankinspection.presentation.toCanonicalPackage
import ai.laiq.tankinspection.presentation.visibleSelectedTasks
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
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

@Composable
fun ReviewScreen(
    draftState: FieldDraftState,
    onContinueToExport: () -> Unit,
    onBack: () -> Unit,
    contentPadding: PaddingValues,
) {
    val packagePreview = draftState.toCanonicalPackage()
    val warnings = draftState.reviewWarnings()

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
                title = "Readiness",
                subtitle = "Check completeness before building the handoff package.",
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LaiqStatChip("Warnings", warnings.size.toString(), tone = if (warnings.isEmpty()) LaiqColors.StatusReady else LaiqColors.StatusWarning, modifier = Modifier.weight(1f))
                    LaiqStatChip("Findings", draftState.findings.size.toString(), tone = LaiqColors.AccentOrange, modifier = Modifier.weight(1f))
                    LaiqStatChip("Attachments", draftState.attachments.size.toString(), modifier = Modifier.weight(1f))
                }
                LaiqStatusBadge(
                    text = if (warnings.isEmpty()) "Ready for export" else "Review required",
                    tone = if (warnings.isEmpty()) LaiqColors.StatusReady else LaiqColors.StatusWarning,
                )
                Text(
                    "Package ${packagePreview.packageId} · Schema ${packagePreview.schemaVersion}",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }

        item {
            LaiqSectionCard(
                title = "Task Status",
                subtitle = "Each selected task should have enough captured data before export.",
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    visibleSelectedTasks(draftState.scope.selectedTasks).forEach { task ->
                        ReviewTaskRow(task = task, status = reviewTaskStatus(task, draftState))
                    }
                }
            }
        }

        item {
            LaiqSectionCard(
                title = "Warnings",
                subtitle = "These are the current export blockers or review notes.",
            ) {
                if (warnings.isEmpty()) {
                    Text("No warnings. The canonical package is ready to hand off.", style = MaterialTheme.typography.bodySmall)
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        warnings.forEach { warning ->
                            Text("• $warning", style = MaterialTheme.typography.bodySmall, color = LaiqColors.StatusWarning)
                        }
                    }
                }
            }
        }

        item {
            LaiqPrimaryButton(
                text = "Continue to Export",
                onClick = onContinueToExport,
            )
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
private fun ReviewTaskRow(
    task: FieldTask,
    status: TaskStatus,
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
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(task.title, style = MaterialTheme.typography.titleSmall)
                LaiqStatusBadge(status.label, status.tone)
            }
            Text(task.subtitle, style = MaterialTheme.typography.bodySmall, color = LaiqColors.MutedText)
        }
    }
}

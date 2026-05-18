package ai.laiq.tankinspection.presentation.screens

import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.FieldTask
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqLabeledValue
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.components.LaiqStatusBadge
import ai.laiq.tankinspection.presentation.roofSystemLabel
import ai.laiq.tankinspection.presentation.visibleSelectedTasks
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
fun TaskBoardScreen(
    draftState: FieldDraftState,
    onOpenRoofElements: () -> Unit,
    onOpenShellUt: () -> Unit,
    onOpenShellSettlement: () -> Unit,
    onOpenRoundnessSurvey: () -> Unit,
    onOpenPlumbnessSurvey: () -> Unit,
    onOpenRoofUt: () -> Unit,
    onOpenShellNozzleUt: () -> Unit,
    onOpenRoofNozzleUt: () -> Unit,
    onOpenReview: () -> Unit,
    onOpenMflImport: () -> Unit,
    onBack: () -> Unit,
    contentPadding: PaddingValues,
) {
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
                title = "Inspection Summary",
                subtitle = "Current local draft and progress across the active field tasks.",
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LaiqStatChip("Shell Rows", draftState.shellUtRows.size.toString(), modifier = Modifier.weight(1f))
                    LaiqStatChip("Roof Rows", draftState.roofUtRows.size.toString(), modifier = Modifier.weight(1f))
                    LaiqStatChip("Findings", draftState.findings.size.toString(), tone = LaiqColors.AccentOrange, modifier = Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    LaiqLabeledValue("Client", draftState.setup.client.ifBlank { "Not set" }, modifier = Modifier.weight(1f))
                    LaiqLabeledValue("Tank", draftState.setup.tankNumber.ifBlank { "Not set" }, modifier = Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    LaiqLabeledValue("Roof", draftState.setup.roofSystemLabel(), modifier = Modifier.weight(1f))
                    LaiqLabeledValue("Review", reviewTaskStatus(FieldTask.REVIEW_EXPORT, draftState).label, modifier = Modifier.weight(1f))
                }
            }
        }

        item {
            LaiqSectionCard(
                title = "Active Tasks",
                subtitle = "Open each measurement or reporting task and populate the canonical package before export.",
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    visibleSelectedTasks(draftState.scope.selectedTasks).forEach { task: FieldTask ->
                        TaskBoardRow(
                            task = task,
                            status = reviewTaskStatus(task, draftState),
                            onOpen = when (task) {
                                FieldTask.ROOF_ELEMENTS -> onOpenRoofElements
                                FieldTask.SHELL_UT -> onOpenShellUt
                                FieldTask.SHELL_SETTLEMENT -> onOpenShellSettlement
                                FieldTask.ROUNDNESS_SURVEY -> onOpenRoundnessSurvey
                                FieldTask.PLUMBNESS_SURVEY -> onOpenPlumbnessSurvey
                                FieldTask.ROOF_UT -> onOpenRoofUt
                                FieldTask.SHELL_NOZZLE_UT -> onOpenShellNozzleUt
                                FieldTask.ROOF_NOZZLE_UT -> onOpenRoofNozzleUt
                                FieldTask.MFL_IMPORT -> onOpenMflImport
                                FieldTask.REVIEW_EXPORT -> onOpenReview
                                FieldTask.FINDINGS -> null
                            },
                        )
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
private fun TaskBoardRow(
    task: FieldTask,
    status: TaskStatus,
    onOpen: (() -> Unit)?,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color.White,
        shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(task.title, style = MaterialTheme.typography.titleSmall)
                    Text(task.subtitle, style = MaterialTheme.typography.bodySmall, color = LaiqColors.MutedText)
                }
                LaiqStatusBadge(status.label, status.tone)
            }
            if (onOpen != null) {
                LaiqPrimaryButton("Open ${task.title}", onOpen)
            }
        }
    }
}

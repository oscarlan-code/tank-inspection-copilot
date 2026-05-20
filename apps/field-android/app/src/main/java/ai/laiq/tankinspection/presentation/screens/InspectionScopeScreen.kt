package ai.laiq.tankinspection.presentation.screens

import ai.laiq.tankinspection.presentation.FieldTask
import ai.laiq.tankinspection.presentation.ScopeFormState
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.selectableFieldTasks
import ai.laiq.tankinspection.testing.AppReviewTags
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp

@Composable
fun InspectionScopeScreen(
    state: ScopeFormState,
    onStateChange: (ScopeFormState) -> Unit,
    onBack: () -> Unit,
    onContinue: () -> Unit,
    contentPadding: PaddingValues,
) {
    val hasActiveCaptureTask = state.selectedTasks.any { task ->
        task != FieldTask.FINDINGS && task != FieldTask.REVIEW_EXPORT && task != FieldTask.MFL_IMPORT
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .testTag(AppReviewTags.Scope.Root),
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
                title = "Task Scope",
                subtitle = "Geometry, reference model, and shell crawler lane planning are already set. Choose the capture modules needed for this inspection.",
            ) {
                Text(
                    "If the geometry or 0° reference baseline needs to change, go back to setup. Saving those edits will clear downstream capture so the inspection restarts from the new foundation.",
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.MutedText,
                )
            }
        }

        item {
            LaiqSectionCard(
                title = "Active Tasks",
                subtitle = "Select the measurement and reporting lanes needed for this inspection package. Findings are added from inside each measurement flow.",
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    selectableFieldTasks().forEach { task: FieldTask ->
                        val checked = state.selectedTasks.contains(task)
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    val updated: Set<FieldTask> = if (checked) {
                                        state.selectedTasks - task
                                    } else {
                                        state.selectedTasks + task
                                    }
                                    onStateChange(state.copy(selectedTasks = updated))
                                },
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                            color = if (checked) LaiqColors.BrandTeal.copy(alpha = 0.08f) else androidx.compose.ui.graphics.Color.White,
                            border = BorderStroke(1.dp, if (checked) LaiqColors.BrandTeal.copy(alpha = 0.35f) else LaiqColors.PanelBorder),
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp),
                            ) {
                                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Checkbox(
                                        checked = checked,
                                        onCheckedChange = null,
                                    )
                                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                        Text(task.title, style = MaterialTheme.typography.titleSmall)
                                        Text(task.subtitle, style = MaterialTheme.typography.bodySmall, color = LaiqColors.MutedText)
                                    }
                                }
                            }
                        }
                    }
                    if (!hasActiveCaptureTask) {
                        Text(
                            "Select at least one active task before continuing.",
                            style = MaterialTheme.typography.bodySmall,
                            color = LaiqColors.StatusWarning,
                        )
                    }
                }
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                LaiqSecondaryButton("Back", onBack, modifier = Modifier.weight(1f))
                LaiqPrimaryButton(
                    "Continue",
                    onContinue,
                    enabled = hasActiveCaptureTask,
                    modifier = Modifier
                        .weight(1f)
                        .testTag(AppReviewTags.Scope.Continue),
                )
            }
        }
    }
}

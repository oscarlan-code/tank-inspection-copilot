package ai.laiq.tankinspection.presentation.screens

import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.FieldTask
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.reviewWarnings
import androidx.compose.ui.graphics.Color

data class TaskStatus(
    val label: String,
    val tone: Color,
    val isComplete: Boolean = false,
    val blocksExport: Boolean = true,
)

fun reviewTaskStatus(task: FieldTask, draftState: FieldDraftState): TaskStatus = when (task) {
    FieldTask.ROOF_ELEMENTS -> statusFromCount(draftState.roofFeatures.size)
    FieldTask.SHELL_UT -> statusFromCount(draftState.shellUtRows.size)
    FieldTask.SHELL_SETTLEMENT -> statusFromCount(draftState.savedShellSettlementSurvey?.stations?.size ?: 0)
    FieldTask.ROUNDNESS_SURVEY -> statusFromCount(draftState.savedRoundnessSurvey?.surveys?.size ?: 0)
    FieldTask.PLUMBNESS_SURVEY -> statusFromCount(draftState.savedPlumbnessSurvey?.stations?.size ?: 0)
    FieldTask.ROOF_UT -> statusFromCount(draftState.roofUtRows.size)
    FieldTask.SHELL_NOZZLE_UT -> nozzleWorkflowStatus(
        registrationCount = draftState.shellNozzles.size,
        measurementCount = draftState.shellNozzleUtRows.size,
    )
    FieldTask.ROOF_NOZZLE_UT -> nozzleWorkflowStatus(
        registrationCount = draftState.roofNozzles.size,
        measurementCount = draftState.roofNozzleUtRows.size,
    )
    FieldTask.FINDINGS -> if (draftState.findings.isEmpty()) {
        TaskStatus("None recorded", LaiqColors.StatusDraft, isComplete = true, blocksExport = false)
    } else {
        TaskStatus("Recorded", LaiqColors.StatusReady, isComplete = true, blocksExport = false)
    }
    FieldTask.MFL_IMPORT -> TaskStatus(
        label = "Deferred",
        tone = LaiqColors.StatusDraft,
        isComplete = true,
        blocksExport = false,
    )
    FieldTask.REVIEW_EXPORT -> exportReviewStatus(draftState)
}

fun exportTone(status: String): Color = when (status) {
    "uploaded" -> LaiqColors.StatusReady
    "shared" -> LaiqColors.StatusInfo
    "uploading" -> LaiqColors.StatusInfo
    "upload_failed" -> LaiqColors.StatusWarning
    else -> LaiqColors.StatusDraft
}

private fun statusFromCount(count: Int): TaskStatus = when {
    count == 0 -> TaskStatus("Not started", LaiqColors.StatusDraft)
    else -> TaskStatus("Ready", LaiqColors.StatusReady, isComplete = true)
}

private fun nozzleWorkflowStatus(
    registrationCount: Int,
    measurementCount: Int,
): TaskStatus = when {
    registrationCount == 0 && measurementCount == 0 -> TaskStatus("Not started", LaiqColors.StatusDraft)
    registrationCount == 0 -> TaskStatus("Missing registry", LaiqColors.StatusWarning)
    measurementCount >= registrationCount -> TaskStatus("Ready", LaiqColors.StatusReady, isComplete = true)
    else -> TaskStatus("In progress", LaiqColors.StatusInfo)
}

private fun exportReviewStatus(draftState: FieldDraftState): TaskStatus {
    val incompleteBlockingTasks = draftState.scope.selectedTasks
        .filterNot { task -> task == FieldTask.REVIEW_EXPORT }
        .map { task -> reviewTaskStatus(task, draftState) }
        .filter { status -> status.blocksExport && !status.isComplete }
    return if (draftState.reviewWarnings().isEmpty() && incompleteBlockingTasks.isEmpty()) {
        TaskStatus("Ready", LaiqColors.StatusReady, isComplete = true)
    } else {
        TaskStatus("Warnings", LaiqColors.StatusWarning)
    }
}

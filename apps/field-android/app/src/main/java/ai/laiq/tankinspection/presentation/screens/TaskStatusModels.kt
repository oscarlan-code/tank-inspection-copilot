package ai.laiq.tankinspection.presentation.screens

import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.FieldTask
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.reviewWarnings
import androidx.compose.ui.graphics.Color

data class TaskStatus(val label: String, val tone: Color)

fun reviewTaskStatus(task: FieldTask, draftState: FieldDraftState): TaskStatus = when (task) {
    FieldTask.ROOF_ELEMENTS -> statusFromCount(draftState.roofFeatures.size)
    FieldTask.SHELL_UT -> statusFromCount(draftState.shellUtRows.size)
    FieldTask.SHELL_SETTLEMENT -> statusFromCount(draftState.savedShellSettlementSurvey?.stations?.size ?: 0)
    FieldTask.ROOF_UT -> statusFromCount(draftState.roofUtRows.size)
    FieldTask.SHELL_NOZZLE_UT -> statusFromCount(draftState.shellNozzles.size + draftState.shellNozzleUtRows.size)
    FieldTask.ROOF_NOZZLE_UT -> statusFromCount(draftState.roofNozzles.size + draftState.roofNozzleUtRows.size)
    FieldTask.FINDINGS -> statusFromCount(draftState.findings.size)
    FieldTask.MFL_IMPORT -> if (!draftState.mflImportDraft.attachmentId.isNullOrBlank()) {
        TaskStatus("Attached", LaiqColors.StatusReady)
    } else {
        TaskStatus("Required", LaiqColors.StatusWarning)
    }
    FieldTask.REVIEW_EXPORT -> if (draftState.reviewWarnings().isEmpty()) {
        TaskStatus("Ready", LaiqColors.StatusReady)
    } else {
        TaskStatus("Warnings", LaiqColors.StatusWarning)
    }
}

fun exportTone(status: String): Color = when (status) {
    "uploaded" -> LaiqColors.StatusReady
    "shared" -> LaiqColors.StatusInfo
    else -> LaiqColors.StatusDraft
}

private fun statusFromCount(count: Int): TaskStatus = when {
    count == 0 -> TaskStatus("Not started", LaiqColors.StatusDraft)
    else -> TaskStatus("In progress", LaiqColors.StatusInfo)
}

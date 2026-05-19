package ai.laiq.tankinspection.data.local

import ai.laiq.tankinspection.data.local.db.InspectionAttachmentEntity
import ai.laiq.tankinspection.data.local.db.InspectionRecordEntity
import ai.laiq.tankinspection.data.local.db.InspectionTaskSnapshotEntity
import ai.laiq.tankinspection.domain.model.CanonicalInspectionPackage
import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.FieldTask
import ai.laiq.tankinspection.presentation.reviewWarnings
import ai.laiq.tankinspection.presentation.roofSystemLabel
import java.io.File

internal fun FieldDraftState.toInspectionRecord(
    packagePreview: CanonicalInspectionPackage,
    updatedAtIso: String,
): InspectionRecordEntity {
    val diameterM = setup.diameterM.toDoubleOrNull() ?: 0.0
    val heightM = setup.heightM.toDoubleOrNull() ?: 0.0
    val shellCourseCount = setup.shellCourseCount.toIntOrNull() ?: 0

    return InspectionRecordEntity(
        inspectionId = packagePreview.inspection.inspectionId,
        packageId = packagePreview.packageId,
        startedAtIso = startedAtIso,
        client = setup.client,
        site = setup.site,
        tankNumber = setup.tankNumber,
        inspector = setup.inspector,
        roofType = setup.roofSystemLabel(),
        referenceMode = scope.referenceMode.name,
        startReference = scope.startReference.name,
        rotationDirection = scope.rotationDirection.name,
        diameterM = diameterM,
        heightM = heightM,
        shellCourseCount = shellCourseCount,
        shellLineCountOverride = shellLineCountOverride.toIntOrNull(),
        reviewStatus = if (reviewWarnings().isEmpty()) "ready_for_upload" else "draft",
        updatedAtIso = updatedAtIso,
    )
}

internal fun FieldDraftState.toInspectionTaskSnapshots(
    packagePreview: CanonicalInspectionPackage,
    updatedAtIso: String,
): List<InspectionTaskSnapshotEntity> {
    val inspectionId = packagePreview.inspection.inspectionId

    return FieldTask.values().mapIndexed { index, task ->
        val inScope = scope.selectedTasks.contains(task)
        val status = taskSnapshotStatus(task)
        val persistedStatus = if (inScope) {
            status
        } else {
            status.copy(
                statusCode = "out_of_scope",
                statusLabel = "Out of scope",
                isComplete = false,
                blocksExport = false,
            )
        }

        InspectionTaskSnapshotEntity(
            inspectionId = inspectionId,
            taskKey = task.name,
            taskTitle = task.title,
            taskOrder = index,
            inScope = inScope,
            statusCode = persistedStatus.statusCode,
            statusLabel = persistedStatus.statusLabel,
            isComplete = persistedStatus.isComplete,
            blocksExport = persistedStatus.blocksExport,
            entryCount = persistedStatus.entryCount,
            referenceCount = persistedStatus.referenceCount,
            updatedAtIso = updatedAtIso,
        )
    }
}

internal fun FieldDraftState.toInspectionAttachmentEntities(
    packagePreview: CanonicalInspectionPackage,
    filesDir: File,
    updatedAtIso: String,
): List<InspectionAttachmentEntity> {
    val inspectionId = packagePreview.inspection.inspectionId
    val findingByAttachmentId = findings.flatMap { finding ->
        finding.attachmentIds.map { attachmentId -> attachmentId to finding.findingId }
    }.toMap()
    val mflAttachmentId = mflImportDraft.attachmentId

    return attachments.map { attachment ->
        val linkedFindingId = findingByAttachmentId[attachment.attachmentId]
        val linkedRecordType = when {
            linkedFindingId != null -> "finding"
            mflAttachmentId == attachment.attachmentId -> "mfl_import"
            else -> null
        }
        val linkedRecordId = linkedFindingId ?: if (mflAttachmentId == attachment.attachmentId) "mfl-report" else null
        val sourceFile = File(filesDir, attachment.relativePath)

        InspectionAttachmentEntity(
            inspectionId = inspectionId,
            attachmentId = attachment.attachmentId,
            kind = attachment.kind,
            relativePath = attachment.relativePath,
            caption = attachment.caption,
            mediaType = attachmentMediaType(attachment.kind, attachment.relativePath),
            fileByteSize = sourceFile.length().takeIf { sourceFile.exists() },
            fileExists = sourceFile.exists(),
            linkedRecordType = linkedRecordType,
            linkedRecordId = linkedRecordId,
            updatedAtIso = updatedAtIso,
        )
    }
}

private data class PersistedTaskStatus(
    val statusCode: String,
    val statusLabel: String,
    val isComplete: Boolean,
    val blocksExport: Boolean,
    val entryCount: Int = 0,
    val referenceCount: Int = 0,
)

private fun FieldDraftState.taskSnapshotStatus(task: FieldTask): PersistedTaskStatus = when (task) {
    FieldTask.ROOF_ELEMENTS -> statusFromCount(roofFeatures.size)
    FieldTask.SHELL_UT -> statusFromCount(shellUtRows.size)
    FieldTask.SHELL_SETTLEMENT -> statusFromCount(savedShellSettlementSurvey?.stations?.size ?: 0)
    FieldTask.ROUNDNESS_SURVEY -> statusFromCount(savedRoundnessSurvey?.surveys?.size ?: 0)
    FieldTask.PLUMBNESS_SURVEY -> statusFromCount(savedPlumbnessSurvey?.stations?.size ?: 0)
    FieldTask.ROOF_UT -> statusFromCount(roofUtRows.size)
    FieldTask.SHELL_NOZZLE_UT -> nozzleWorkflowStatus(
        registrationCount = shellNozzles.size,
        measurementCount = shellNozzleUtRows.size,
    )
    FieldTask.ROOF_NOZZLE_UT -> nozzleWorkflowStatus(
        registrationCount = roofNozzles.size,
        measurementCount = roofNozzleUtRows.size,
    )
    FieldTask.FINDINGS -> if (findings.isEmpty()) {
        PersistedTaskStatus(
            statusCode = "none_recorded",
            statusLabel = "None recorded",
            isComplete = true,
            blocksExport = false,
            entryCount = 0,
        )
    } else {
        PersistedTaskStatus(
            statusCode = "recorded",
            statusLabel = "Recorded",
            isComplete = true,
            blocksExport = false,
            entryCount = findings.size,
            referenceCount = attachments.size,
        )
    }
    FieldTask.MFL_IMPORT -> if (!mflImportDraft.attachmentId.isNullOrBlank()) {
        PersistedTaskStatus(
            statusCode = "attached",
            statusLabel = "Attached",
            isComplete = true,
            blocksExport = true,
            entryCount = 1,
        )
    } else {
        PersistedTaskStatus(
            statusCode = "required",
            statusLabel = "Required",
            isComplete = false,
            blocksExport = true,
            entryCount = 0,
        )
    }
    FieldTask.REVIEW_EXPORT -> reviewExportStatus()
}

private fun FieldDraftState.reviewExportStatus(): PersistedTaskStatus {
    val incompleteBlockingTasks = scope.selectedTasks
        .filterNot { task -> task == FieldTask.REVIEW_EXPORT }
        .map { task -> taskSnapshotStatus(task) }
        .filter { status -> status.blocksExport && !status.isComplete }
    val warningCount = reviewWarnings().size

    return if (warningCount == 0 && incompleteBlockingTasks.isEmpty()) {
        PersistedTaskStatus(
            statusCode = "ready",
            statusLabel = "Ready",
            isComplete = true,
            blocksExport = true,
        )
    } else {
        PersistedTaskStatus(
            statusCode = "warnings",
            statusLabel = "Warnings",
            isComplete = false,
            blocksExport = true,
            entryCount = warningCount,
            referenceCount = incompleteBlockingTasks.size,
        )
    }
}

private fun statusFromCount(count: Int): PersistedTaskStatus = when {
    count == 0 -> PersistedTaskStatus(
        statusCode = "not_started",
        statusLabel = "Not started",
        isComplete = false,
        blocksExport = true,
        entryCount = 0,
    )
    else -> PersistedTaskStatus(
        statusCode = "ready",
        statusLabel = "Ready",
        isComplete = true,
        blocksExport = true,
        entryCount = count,
    )
}

private fun nozzleWorkflowStatus(
    registrationCount: Int,
    measurementCount: Int,
): PersistedTaskStatus = when {
    registrationCount == 0 && measurementCount == 0 -> PersistedTaskStatus(
        statusCode = "not_started",
        statusLabel = "Not started",
        isComplete = false,
        blocksExport = true,
        entryCount = 0,
        referenceCount = 0,
    )
    registrationCount == 0 -> PersistedTaskStatus(
        statusCode = "missing_registry",
        statusLabel = "Missing registry",
        isComplete = false,
        blocksExport = true,
        entryCount = measurementCount,
        referenceCount = 0,
    )
    measurementCount >= registrationCount -> PersistedTaskStatus(
        statusCode = "ready",
        statusLabel = "Ready",
        isComplete = true,
        blocksExport = true,
        entryCount = measurementCount,
        referenceCount = registrationCount,
    )
    else -> PersistedTaskStatus(
        statusCode = "in_progress",
        statusLabel = "In progress",
        isComplete = false,
        blocksExport = true,
        entryCount = measurementCount,
        referenceCount = registrationCount,
    )
}

private fun attachmentMediaType(kind: String, relativePath: String): String = when {
    kind == "mfl_report" || relativePath.endsWith(".pdf", ignoreCase = true) -> "application/pdf"
    relativePath.endsWith(".png", ignoreCase = true) -> "image/png"
    relativePath.endsWith(".jpg", ignoreCase = true) || relativePath.endsWith(".jpeg", ignoreCase = true) -> "image/jpeg"
    else -> "application/octet-stream"
}

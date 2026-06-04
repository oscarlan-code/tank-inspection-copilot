package ai.laiq.tankinspection.v2.storage

import ai.laiq.tankinspection.v2.model.V2DraftState
import ai.laiq.tankinspection.v2.model.V2ElementType
import ai.laiq.tankinspection.v2.model.V2FindingRecord
import ai.laiq.tankinspection.v2.model.V2LayoutSurface
import ai.laiq.tankinspection.v2.model.V2LayoutTarget
import ai.laiq.tankinspection.v2.model.V2UtItemKind
import ai.laiq.tankinspection.v2.model.V2UtMeasurementEntry
import ai.laiq.tankinspection.v2.model.placementsFor
import ai.laiq.tankinspection.v2.model.requiredValidationErrors
import ai.laiq.tankinspection.v2.model.selectedTargets
import ai.laiq.tankinspection.v2.storage.db.V2AttachmentEntity
import ai.laiq.tankinspection.v2.storage.db.V2ElementEntity
import ai.laiq.tankinspection.v2.storage.db.V2FieldDatabase
import ai.laiq.tankinspection.v2.storage.db.V2FindingEntity
import ai.laiq.tankinspection.v2.storage.db.V2InspectionRecordEntity
import ai.laiq.tankinspection.v2.storage.db.V2LayoutConfigEntity
import ai.laiq.tankinspection.v2.storage.db.V2LayoutTargetEntity
import ai.laiq.tankinspection.v2.storage.db.V2TaskSnapshotEntity
import ai.laiq.tankinspection.v2.storage.db.V2UtMeasurementEntity
import android.content.Context
import androidx.room.Room
import androidx.room.withTransaction
import java.io.File
import java.time.Instant
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class V2ProductStore(
    context: Context,
) {
    private val filesDir = context.filesDir
    private val database = Room.databaseBuilder(
        context.applicationContext,
        V2FieldDatabase::class.java,
        "laiq-field-v2-db",
    ).build()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val saveMutex = Mutex()

    @Volatile
    var lastSaveError: Throwable? = null
        private set

    fun saveAsync(state: V2DraftState) {
        val snapshot = state
        scope.launch {
            saveMutex.withLock {
                runCatching { save(snapshot) }
                    .onSuccess { lastSaveError = null }
                    .onFailure { error -> lastSaveError = error }
            }
        }
    }

    private suspend fun save(state: V2DraftState) {
        val nowIso = Instant.now().toString()
        val inspectionId = V2_ACTIVE_INSPECTION_ID
        val targets = V2LayoutTarget.entries
        val attachments = state.toAttachmentEntities(inspectionId, nowIso)
        database.withTransaction {
            database.inspectionRecordDao().upsert(state.toInspectionRecord(inspectionId, nowIso))
            database.layoutTargetDao().replaceAll(inspectionId, state.toLayoutTargetEntities(inspectionId, nowIso, targets))
            database.layoutConfigDao().replaceAll(inspectionId, state.toLayoutConfigEntities(inspectionId, nowIso, targets))
            database.elementDao().replaceAll(inspectionId, state.toElementEntities(inspectionId, nowIso))
            database.utMeasurementDao().replaceAll(inspectionId, state.toUtMeasurementEntities(inspectionId, nowIso))
            database.findingDao().replaceAll(inspectionId, state.toFindingEntities(inspectionId, nowIso, attachments))
            database.attachmentDao().replaceAll(inspectionId, attachments)
            database.taskSnapshotDao().replaceAll(inspectionId, state.toTaskSnapshots(inspectionId, nowIso, attachments))
        }
    }

    private fun V2DraftState.toInspectionRecord(
        inspectionId: String,
        nowIso: String,
    ): V2InspectionRecordEntity =
        V2InspectionRecordEntity(
            inspectionId = inspectionId,
            schemaVersion = 1,
            client = generalTankInfo.client,
            tankNumber = generalTankInfo.tankNumber,
            location = generalTankInfo.location,
            fieldLeaseName = generalTankInfo.fieldLeaseName,
            inspector = generalTankInfo.inspector,
            externalRoofType = generalTankInfo.externalRoofType,
            internalRoofType = generalTankInfo.internalRoofType,
            referenceMode = layoutMapSetup.referenceMode.key,
            referenceNote = layoutMapSetup.referenceNote,
            diameterM = generalTankInfo.diameter.toPositiveDoubleOrNull(),
            heightM = generalTankInfo.height.toPositiveDoubleOrNull(),
            shellCourseCount = layoutMapSetup.shellCourseCount.toPositiveIntOrNull(),
            shellLaneCount = layoutMapSetup.shellLaneCount.toPositiveIntOrNull(),
            reviewStatus = if (generalTankInfo.requiredValidationErrors().isEmpty()) {
                "draft_ready"
            } else {
                "draft_incomplete"
            },
            createdAtIso = nowIso,
            updatedAtIso = nowIso,
        )

    private fun V2DraftState.toLayoutTargetEntities(
        inspectionId: String,
        nowIso: String,
        targets: List<V2LayoutTarget>,
    ): List<V2LayoutTargetEntity> {
        val layoutTargets = layoutScope.selectedTargets().toSet()
        val elementTargets = elementSetup.selectedTargets().toSet()
        val utTargets = utSetup.selectedTargets().toSet()
        return targets.map { target ->
            V2LayoutTargetEntity(
                inspectionId = inspectionId,
                targetKey = target.key,
                targetLabel = target.label,
                surfaceKey = target.surface.key,
                inLayoutScope = target in layoutTargets,
                layoutApproved = target in layoutMapSetup.approvedTargets,
                elementInScope = target in elementTargets,
                elementApproved = target in elementPlacement.approvedTargets,
                utInScope = target in utTargets,
                utApproved = target in utMeasurements.approvedTargets,
                updatedAtIso = nowIso,
            )
        }
    }

    private fun V2DraftState.toLayoutConfigEntities(
        inspectionId: String,
        nowIso: String,
        targets: List<V2LayoutTarget>,
    ): List<V2LayoutConfigEntity> =
        targets.map { target ->
            V2LayoutConfigEntity(
                inspectionId = inspectionId,
                targetKey = target.key,
                surfaceKey = target.surface.key,
                referenceMode = layoutMapSetup.referenceMode.key,
                referenceNote = layoutMapSetup.referenceNote,
                roofPattern = layoutMapSetup.roofPattern.name.takeIf { target.surface == V2LayoutSurface.ROOF },
                roofRingCount = layoutMapSetup.roofRingCount.toPositiveIntOrNull().takeIf { target.surface == V2LayoutSurface.ROOF },
                roofSectorCount = layoutMapSetup.roofSectorCount.toPositiveIntOrNull().takeIf { target.surface == V2LayoutSurface.ROOF },
                roofRowCount = layoutMapSetup.roofRowCount.toPositiveIntOrNull().takeIf { target.surface == V2LayoutSurface.ROOF },
                roofWidestRowPlateCount = layoutMapSetup.roofWidestRowPlateCount.toPositiveIntOrNull()
                    .takeIf { target.surface == V2LayoutSurface.ROOF },
                roofHasCenterOpening = layoutMapSetup.roofHasCenterOpening.takeIf { target.surface == V2LayoutSurface.ROOF },
                roofHasAnnularRing = layoutMapSetup.roofHasAnnularRing.takeIf { target.surface == V2LayoutSurface.ROOF },
                roofAnnularSectionCount = layoutMapSetup.roofAnnularSectionCount.toPositiveIntOrNull()
                    .takeIf { target.surface == V2LayoutSurface.ROOF },
                shellCourseCount = layoutMapSetup.shellCourseCount.toPositiveIntOrNull().takeIf { target.surface == V2LayoutSurface.SHELL },
                shellPlatesPerCourse = layoutMapSetup.shellPlatesPerCourse.toPositiveIntOrNull()
                    .takeIf { target.surface == V2LayoutSurface.SHELL },
                shellLaneCount = layoutMapSetup.shellLaneCount.toPositiveIntOrNull().takeIf { target.surface == V2LayoutSurface.SHELL },
                shellPlateOffset = layoutMapSetup.shellPlateOffset.takeIf { target.surface == V2LayoutSurface.SHELL },
                shellOffsetStartRow = layoutMapSetup.shellOffsetStartRow.key.takeIf { target.surface == V2LayoutSurface.SHELL },
                shellThirdOffsetStart = layoutMapSetup.shellThirdOffsetStart.key.takeIf { target.surface == V2LayoutSurface.SHELL },
                floorTemplate = layoutMapSetup.floorTemplate.key.takeIf { target.surface == V2LayoutSurface.FLOOR },
                floorPlateCount = layoutMapSetup.floorPlateCount.toPositiveIntOrNull().takeIf { target.surface == V2LayoutSurface.FLOOR },
                floorAnnularSectionCount = layoutMapSetup.floorAnnularSectionCount.toPositiveIntOrNull()
                    .takeIf { target.surface == V2LayoutSurface.FLOOR },
                floorPatternCountX = layoutMapSetup.floorPatternCountX.toPositiveIntOrNull().takeIf { target.surface == V2LayoutSurface.FLOOR },
                floorPatternCountY = layoutMapSetup.floorPatternCountY.toPositiveIntOrNull().takeIf { target.surface == V2LayoutSurface.FLOOR },
                updatedAtIso = nowIso,
            )
        }

    private fun V2DraftState.toElementEntities(
        inspectionId: String,
        nowIso: String,
    ): List<V2ElementEntity> =
        V2LayoutTarget.entries.flatMap { target ->
            elementPlacement.placementsFor(target).map { element ->
                V2ElementEntity(
                    inspectionId = inspectionId,
                    targetKey = target.key,
                    elementId = element.id,
                    elementLabel = element.label,
                    elementTypeKey = element.type.key,
                    normalizedX = element.normalizedX,
                    normalizedY = element.normalizedY,
                    updatedAtIso = nowIso,
                )
            }
        }

    private fun V2DraftState.toUtMeasurementEntities(
        inspectionId: String,
        nowIso: String,
    ): List<V2UtMeasurementEntity> =
        utMeasurements.entriesByItemKey.values
            .sortedWith(compareBy<V2UtMeasurementEntry> { it.target.key }.thenBy { it.itemKey })
            .map { entry ->
                val readings = entry.readings.map { reading -> reading.trim().toDoubleOrNull() }
                val laneCourse = entry.itemLabel.toLaneCourse()
                V2UtMeasurementEntity(
                    inspectionId = inspectionId,
                    itemKey = entry.itemKey,
                    targetKey = entry.target.key,
                    itemLabel = entry.itemLabel,
                    itemKind = entry.kind.name,
                    elementTypeKey = entry.elementType?.key,
                    nozzleSize = entry.nozzleSize.takeIf { entry.elementType == V2ElementType.NOZZLE },
                    laneId = laneCourse?.laneId,
                    course = laneCourse?.course,
                    plateId = entry.itemLabel.takeIf { entry.kind == V2UtItemKind.LAYOUT_REGION && laneCourse == null },
                    elementId = entry.elementId(),
                    confirmed = entry.confirmed,
                    measured = entry.hasPositiveReading(),
                    value1 = readings.getOrNull(0),
                    value2 = readings.getOrNull(1),
                    value3 = readings.getOrNull(2),
                    value4 = readings.getOrNull(3),
                    value5 = readings.getOrNull(4),
                    updatedAtIso = nowIso,
                )
            }

    private fun V2DraftState.toFindingEntities(
        inspectionId: String,
        nowIso: String,
        attachments: List<V2AttachmentEntity>,
    ): List<V2FindingEntity> {
        val missingByFinding = attachments
            .groupBy { attachment -> attachment.findingId }
            .mapValues { (_, items) -> items.any { attachment -> !attachment.fileExists } }
        return findingState.findingsByItemKey.values
            .filter { finding -> finding.hasFieldEvidence() }
            .sortedBy { finding -> finding.itemKey }
            .map { finding ->
                V2FindingEntity(
                    inspectionId = inspectionId,
                    findingId = finding.itemKey,
                    targetKey = finding.target.key,
                    itemLabel = finding.itemLabel,
                    itemKind = finding.itemKind.name,
                    elementTypeKey = finding.elementType?.key,
                    linkedUtItemKey = finding.itemKey,
                    note = finding.note.ifBlank { null },
                    attachmentCount = finding.photos.size,
                    hasMissingAttachment = missingByFinding[finding.itemKey] == true,
                    updatedAtIso = nowIso,
                )
            }
    }

    private fun V2DraftState.toAttachmentEntities(
        inspectionId: String,
        nowIso: String,
    ): List<V2AttachmentEntity> =
        findingState.findingsByItemKey.values
            .filter { finding -> finding.hasFieldEvidence() }
            .flatMap { finding ->
                finding.photos.map { photo ->
                    val file = File(filesDir, photo.relativePath)
                    V2AttachmentEntity(
                        inspectionId = inspectionId,
                        attachmentId = "${finding.itemKey}:${photo.id}",
                        findingId = finding.itemKey,
                        kind = "finding_photo",
                        relativePath = photo.relativePath,
                        displayName = photo.displayName,
                        mediaType = photo.relativePath.inferredImageMediaType(),
                        fileByteSize = file.takeIf { it.exists() }?.length(),
                        fileExists = file.exists() && file.length() > 0L,
                        annotationStrokeCount = photo.annotationStrokes.size,
                        annotationPointCount = photo.annotationStrokes.sumOf { stroke -> stroke.points.size },
                        updatedAtIso = nowIso,
                    )
                }
            }

    private fun V2DraftState.toTaskSnapshots(
        inspectionId: String,
        nowIso: String,
        attachments: List<V2AttachmentEntity>,
    ): List<V2TaskSnapshotEntity> {
        val selectedLayoutTargets = layoutScope.selectedTargets()
        val approvedLayouts = selectedLayoutTargets.count { target -> target in layoutMapSetup.approvedTargets }
        val selectedUtTargets = utSetup.selectedTargets().filter { target -> target in layoutMapSetup.approvedTargets }
        val measuredCount = utMeasurements.entriesByItemKey.values.count { entry -> entry.hasPositiveReading() }
        val findingCount = findingState.findingsByItemKey.values.count { finding -> finding.hasFieldEvidence() }
        val missingAttachmentCount = attachments.count { attachment -> !attachment.fileExists }
        return listOf(
            V2TaskSnapshotEntity(
                inspectionId = inspectionId,
                taskKey = "general_info",
                taskTitle = "General Tank Information",
                taskOrder = 10,
                inScope = true,
                statusCode = if (generalTankInfo.requiredValidationErrors().isEmpty()) "complete" else "incomplete",
                statusLabel = if (generalTankInfo.requiredValidationErrors().isEmpty()) "Complete" else "Incomplete",
                isComplete = generalTankInfo.requiredValidationErrors().isEmpty(),
                blocksExport = generalTankInfo.requiredValidationErrors().isNotEmpty(),
                entryCount = 1,
                referenceCount = 0,
                updatedAtIso = nowIso,
            ),
            V2TaskSnapshotEntity(
                inspectionId = inspectionId,
                taskKey = "layout_maps",
                taskTitle = "Layout Maps",
                taskOrder = 20,
                inScope = selectedLayoutTargets.isNotEmpty(),
                statusCode = if (approvedLayouts == selectedLayoutTargets.size && selectedLayoutTargets.isNotEmpty()) {
                    "complete"
                } else {
                    "in_progress"
                },
                statusLabel = "$approvedLayouts/${selectedLayoutTargets.size} approved",
                isComplete = approvedLayouts == selectedLayoutTargets.size && selectedLayoutTargets.isNotEmpty(),
                blocksExport = approvedLayouts == 0,
                entryCount = approvedLayouts,
                referenceCount = selectedLayoutTargets.size,
                updatedAtIso = nowIso,
            ),
            V2TaskSnapshotEntity(
                inspectionId = inspectionId,
                taskKey = "ut_measurements",
                taskTitle = "UT Measurements",
                taskOrder = 30,
                inScope = selectedUtTargets.isNotEmpty(),
                statusCode = if (utMeasurements.approvedTargets.containsAll(selectedUtTargets)) "complete" else "in_progress",
                statusLabel = "$measuredCount measured points",
                isComplete = utMeasurements.approvedTargets.containsAll(selectedUtTargets),
                blocksExport = false,
                entryCount = measuredCount,
                referenceCount = utMeasurements.entriesByItemKey.size,
                updatedAtIso = nowIso,
            ),
            V2TaskSnapshotEntity(
                inspectionId = inspectionId,
                taskKey = "findings",
                taskTitle = "Findings",
                taskOrder = 40,
                inScope = findingCount > 0,
                statusCode = if (missingAttachmentCount == 0) "complete" else "blocked_missing_attachment",
                statusLabel = if (missingAttachmentCount == 0) {
                    "$findingCount findings"
                } else {
                    "$missingAttachmentCount missing photos"
                },
                isComplete = missingAttachmentCount == 0,
                blocksExport = missingAttachmentCount > 0,
                entryCount = findingCount,
                referenceCount = attachments.size,
                updatedAtIso = nowIso,
            ),
        )
    }

    companion object {
        const val V2_ACTIVE_INSPECTION_ID = "v2-active-inspection"
    }
}

private suspend fun ai.laiq.tankinspection.v2.storage.db.V2LayoutTargetDao.replaceAll(
    inspectionId: String,
    entities: List<V2LayoutTargetEntity>,
) {
    deleteAllByInspection(inspectionId)
    if (entities.isNotEmpty()) upsertAll(entities)
}

private suspend fun ai.laiq.tankinspection.v2.storage.db.V2LayoutConfigDao.replaceAll(
    inspectionId: String,
    entities: List<V2LayoutConfigEntity>,
) {
    deleteAllByInspection(inspectionId)
    if (entities.isNotEmpty()) upsertAll(entities)
}

private suspend fun ai.laiq.tankinspection.v2.storage.db.V2ElementDao.replaceAll(
    inspectionId: String,
    entities: List<V2ElementEntity>,
) {
    deleteAllByInspection(inspectionId)
    if (entities.isNotEmpty()) upsertAll(entities)
}

private suspend fun ai.laiq.tankinspection.v2.storage.db.V2UtMeasurementDao.replaceAll(
    inspectionId: String,
    entities: List<V2UtMeasurementEntity>,
) {
    deleteAllByInspection(inspectionId)
    if (entities.isNotEmpty()) upsertAll(entities)
}

private suspend fun ai.laiq.tankinspection.v2.storage.db.V2FindingDao.replaceAll(
    inspectionId: String,
    entities: List<V2FindingEntity>,
) {
    deleteAllByInspection(inspectionId)
    if (entities.isNotEmpty()) upsertAll(entities)
}

private suspend fun ai.laiq.tankinspection.v2.storage.db.V2AttachmentDao.replaceAll(
    inspectionId: String,
    entities: List<V2AttachmentEntity>,
) {
    deleteAllByInspection(inspectionId)
    if (entities.isNotEmpty()) upsertAll(entities)
}

private suspend fun ai.laiq.tankinspection.v2.storage.db.V2TaskSnapshotDao.replaceAll(
    inspectionId: String,
    entities: List<V2TaskSnapshotEntity>,
) {
    deleteAllByInspection(inspectionId)
    if (entities.isNotEmpty()) upsertAll(entities)
}

private data class V2LaneCourse(
    val laneId: String,
    val course: Int,
)

private fun V2FindingRecord.hasFieldEvidence(): Boolean =
    note.isNotBlank() || photos.isNotEmpty()

private fun V2UtMeasurementEntry.hasPositiveReading(): Boolean =
    readings.any { reading -> reading.trim().toDoubleOrNull()?.let { value -> value > 0.0 } == true }

private fun V2UtMeasurementEntry.elementId(): String? =
    itemKey.substringAfter(":element:", missingDelimiterValue = "").ifBlank { null }

private fun String.toLaneCourse(): V2LaneCourse? {
    val match = Regex("""L(\d+)-C(\d+)""").find(this) ?: return null
    val lane = match.groupValues.getOrNull(1)?.toIntOrNull() ?: return null
    val course = match.groupValues.getOrNull(2)?.toIntOrNull() ?: return null
    return V2LaneCourse(laneId = "L$lane", course = course)
}

private fun String.toPositiveIntOrNull(): Int? =
    trim().toIntOrNull()?.takeIf { value -> value > 0 }

private fun String.toPositiveDoubleOrNull(): Double? =
    trim().toDoubleOrNull()?.takeIf { value -> value > 0.0 }

private fun String.inferredImageMediaType(): String =
    when (substringAfterLast('.', missingDelimiterValue = "").lowercase()) {
        "png" -> "image/png"
        "webp" -> "image/webp"
        "gif" -> "image/gif"
        else -> "image/jpeg"
    }

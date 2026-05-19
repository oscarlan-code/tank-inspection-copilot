package ai.laiq.tankinspection.data.local

import ai.laiq.tankinspection.data.local.db.AppSessionEntity
import ai.laiq.tankinspection.data.local.db.InspectionAttachmentEntity
import ai.laiq.tankinspection.data.local.db.InspectionBaselineEntity
import ai.laiq.tankinspection.data.local.db.InspectionComponentEntity
import ai.laiq.tankinspection.data.local.db.InspectionFindingEntity
import ai.laiq.tankinspection.data.local.db.InspectionMeasurementEntity
import ai.laiq.tankinspection.data.local.db.InspectionRecordEntity
import ai.laiq.tankinspection.domain.model.AttachmentRecord
import ai.laiq.tankinspection.domain.model.FindingRecord
import ai.laiq.tankinspection.domain.model.MeasurementCaptureState
import ai.laiq.tankinspection.domain.model.MeasurementUnit
import ai.laiq.tankinspection.domain.model.NozzleDefinition
import ai.laiq.tankinspection.domain.model.NozzleSizeUnit
import ai.laiq.tankinspection.domain.model.NozzleUtRow
import ai.laiq.tankinspection.domain.model.PlumbnessSurvey
import ai.laiq.tankinspection.domain.model.PlumbnessSurveyStation
import ai.laiq.tankinspection.domain.model.ReferenceMode
import ai.laiq.tankinspection.domain.model.RoundnessSurvey
import ai.laiq.tankinspection.domain.model.RoundnessSurveyBand
import ai.laiq.tankinspection.domain.model.RoundnessSurveyStation
import ai.laiq.tankinspection.domain.model.RoofFeature
import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.domain.model.RoofUtRow
import ai.laiq.tankinspection.domain.model.RotationDirection
import ai.laiq.tankinspection.domain.model.ShellSettlementStation
import ai.laiq.tankinspection.domain.model.ShellSettlementSurvey
import ai.laiq.tankinspection.domain.model.ShellUtRow
import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.FieldTask
import ai.laiq.tankinspection.presentation.MflImportDraftInput
import ai.laiq.tankinspection.presentation.ProductScreen
import ai.laiq.tankinspection.presentation.ROOF_SURFACE_FIXED
import ai.laiq.tankinspection.presentation.ROOF_SURFACE_FLOATING
import ai.laiq.tankinspection.presentation.RoofLayoutDraftInput
import ai.laiq.tankinspection.presentation.ScopeFormState
import ai.laiq.tankinspection.presentation.SetupFormState
import ai.laiq.tankinspection.presentation.StartReference
import ai.laiq.tankinspection.presentation.availableRoofSurfaces

internal fun restoreSavedSessionFromStructuredInspection(
    currentSession: AppSessionEntity?,
    baseline: InspectionBaselineEntity,
    components: List<InspectionComponentEntity>,
    measurements: List<InspectionMeasurementEntity>,
    findings: List<InspectionFindingEntity>,
    attachments: List<InspectionAttachmentEntity>,
): SavedAppSession {
    val attachmentRecords = attachments
        .sortedWith(compareBy<InspectionAttachmentEntity> { it.updatedAtIso }.thenBy { it.attachmentId })
        .map { attachment ->
            AttachmentRecord(
                attachmentId = attachment.attachmentId,
                kind = attachment.kind,
                relativePath = attachment.relativePath,
                caption = attachment.caption,
            )
        }
    val attachmentIdsByFindingId = attachments
        .filter { attachment -> attachment.linkedRecordType == "finding" && !attachment.linkedRecordId.isNullOrBlank() }
        .groupBy { attachment -> attachment.linkedRecordId.orEmpty() }
        .mapValues { (_, linkedAttachments) -> linkedAttachments.map { attachment -> attachment.attachmentId }.sorted() }
    val findingRecords = findings
        .sortedWith(compareBy<InspectionFindingEntity> { it.sortOrder }.thenBy { it.findingId })
        .map { finding ->
            FindingRecord(
                findingId = finding.findingId,
                surface = finding.surface,
                type = finding.type,
                severity = finding.severity,
                note = finding.note,
                linkedMeasurementId = finding.linkedMeasurementId,
                locationSummary = finding.locationSummary,
                preciseLineId = finding.preciseLineId,
                preciseCourse = finding.preciseCourse,
                attachmentIds = attachmentIdsByFindingId[finding.findingId].orEmpty(),
            )
        }

    val setup = SetupFormState(
        client = baseline.client,
        site = baseline.site,
        tankNumber = baseline.tankNumber,
        diameterM = baseline.diameterM.toDisplayString(),
        heightM = baseline.heightM.toDisplayString(),
        shellCourseCount = baseline.shellCourseCount.toString(),
        fixedRoofType = baseline.fixedRoofType ?: "none",
        floatingRoofType = baseline.floatingRoofType ?: "none",
        inspector = baseline.inspector,
        thicknessUnit = parseMeasurementUnit(baseline.thicknessUnit),
        settlementUnit = parseMeasurementUnit(baseline.settlementUnit),
        nozzleSizeUnit = parseNozzleSizeUnit(baseline.nozzleSizeUnit),
    )
    val scope = ScopeFormState(
        referenceMode = parseReferenceMode(baseline.referenceMode),
        startReference = parseStartReference(baseline.startReferenceCode),
        referenceRemark = baseline.referenceRemark,
        rotationDirection = parseRotationDirection(baseline.rotationDirection),
        selectedTasks = parseSelectedTasks(baseline.selectedTaskKeys),
    )
    val shellUtRows = measurements.filter { it.moduleKey == "shell_ut" }
        .sortedBy { it.sortOrder }
        .map { row ->
            ShellUtRow(
                rowId = row.sourceRecordId ?: row.measurementId.substringAfter(':', row.measurementId),
                lineId = row.lineId.orEmpty(),
                course = row.course ?: 0,
                readings = listOfNotNull(row.value1, row.value2, row.value3, row.value4, row.value5),
                captureState = parseCaptureState(row.captureState),
                note = row.note,
            )
        }
    val roofUtRows = measurements.filter { it.moduleKey == "roof_ut" }
        .sortedBy { it.sortOrder }
        .map { row ->
            RoofUtRow(
                rowId = row.sourceRecordId ?: row.measurementId.substringAfter(':', row.measurementId),
                roofSurfaceId = row.roofSurfaceId,
                plateId = row.plateId.orEmpty(),
                readings = listOfNotNull(row.value1, row.value2, row.value3, row.value4, row.value5),
                captureState = parseCaptureState(row.captureState),
                note = row.note,
            )
        }
    val shellNozzleUtRows = measurements.filter { it.moduleKey == "shell_nozzle_ut" }
        .sortedBy { it.sortOrder }
        .map { row ->
            NozzleUtRow(
                rowId = row.sourceRecordId ?: row.measurementId.substringAfter(':', row.measurementId),
                nozzleId = row.nozzleId.orEmpty(),
                roofSurfaceId = row.roofSurfaceId,
                bodyReadings = listOfNotNull(row.value1, row.value2, row.value3),
                reinforcementPadReading = row.value4,
                captureState = parseCaptureState(row.captureState),
                note = row.note,
            )
        }
    val roofNozzleUtRows = measurements.filter { it.moduleKey == "roof_nozzle_ut" }
        .sortedBy { it.sortOrder }
        .map { row ->
            NozzleUtRow(
                rowId = row.sourceRecordId ?: row.measurementId.substringAfter(':', row.measurementId),
                nozzleId = row.nozzleId.orEmpty(),
                roofSurfaceId = row.roofSurfaceId,
                bodyReadings = listOfNotNull(row.value1, row.value2, row.value3),
                reinforcementPadReading = row.value4,
                captureState = parseCaptureState(row.captureState),
                note = row.note,
            )
        }
    val shellSettlementSurvey = measurements.filter { it.moduleKey == "shell_settlement" }
        .sortedBy { it.sortOrder }
        .map { row ->
            ShellSettlementStation(
                stationId = row.stationId.orEmpty(),
                angleDeg = row.angleDeg ?: 0.0,
                elevation = row.value1,
                captureState = parseCaptureState(row.captureState),
                note = row.note,
            )
        }
        .takeIf { it.isNotEmpty() }
        ?.let { stations ->
            ShellSettlementSurvey(
                stationCount = stations.size,
                stations = stations,
            )
        }
    val roundnessSurvey = restoreRoundnessSurvey(measurements)
    val plumbnessSurvey = measurements.filter { it.moduleKey == "plumbness" }
        .sortedBy { it.sortOrder }
        .map { row ->
            PlumbnessSurveyStation(
                stationId = row.stationId.orEmpty(),
                angleDeg = row.angleDeg ?: 0.0,
                plumbness = row.value1,
                captureState = parseCaptureState(row.captureState),
                note = row.note,
            )
        }
        .takeIf { it.isNotEmpty() }
        ?.let { stations ->
            PlumbnessSurvey(
                stationCount = stations.size,
                stations = stations,
            )
        }

    val roofFeatures = components.filter { it.componentKind == "roof_feature" }
        .sortedWith(compareBy<InspectionComponentEntity> { it.sortOrder }.thenBy { it.componentId })
        .map { component ->
            RoofFeature(
                featureId = component.componentId,
                roofSurfaceId = component.roofSurfaceId,
                type = component.componentType,
                label = component.label,
                placementMode = component.placementMode,
                plateId = component.plateId,
                azimuthDeg = component.azimuthDeg,
                radiusRatio = component.radiusRatio,
            )
        }
    val shellNozzles = components.filter { it.componentKind == "shell_nozzle" }
        .sortedWith(compareBy<InspectionComponentEntity> { it.sortOrder }.thenBy { it.componentId })
        .map(::restoreNozzleDefinition)
    val roofNozzles = components.filter { it.componentKind == "roof_nozzle" }
        .sortedWith(compareBy<InspectionComponentEntity> { it.sortOrder }.thenBy { it.componentId })
        .map(::restoreNozzleDefinition)

    val activeRoofSurfaceId = normalizeActiveRoofSurfaceId(baseline.activeRoofSurfaceId, setup)
    val fixedRoofLayoutDraft = restoreRoofLayoutDraft(
        templateName = baseline.fixedRoofLayoutTemplate,
        rowCount = baseline.fixedRoofRowCount,
        widestRowPlateCount = baseline.fixedRoofWidestRowPlateCount,
        ringCount = baseline.fixedRoofRingCount,
        sectorCount = baseline.fixedRoofSectorCount,
        centerOpeningRatio = baseline.fixedRoofCenterOpeningRatio,
        hasAnnularRing = baseline.fixedRoofHasAnnularRing,
        annularSectionCount = baseline.fixedRoofAnnularSectionCount,
        hasPontoonDeck = baseline.fixedRoofHasPontoonDeck,
    )
    val floatingRoofLayoutDraft = restoreRoofLayoutDraft(
        templateName = baseline.floatingRoofLayoutTemplate,
        rowCount = baseline.floatingRoofRowCount,
        widestRowPlateCount = baseline.floatingRoofWidestRowPlateCount,
        ringCount = baseline.floatingRoofRingCount,
        sectorCount = baseline.floatingRoofSectorCount,
        centerOpeningRatio = baseline.floatingRoofCenterOpeningRatio,
        hasAnnularRing = baseline.floatingRoofHasAnnularRing,
        annularSectionCount = baseline.floatingRoofAnnularSectionCount,
        hasPontoonDeck = baseline.floatingRoofHasPontoonDeck,
    )
    val mflAttachment = attachmentRecords.firstOrNull { attachment -> attachment.attachmentId == baseline.mflAttachmentId }

    val restoredDraft = FieldDraftState(
        startedAtIso = baseline.startedAtIso,
        persistedInspectionId = baseline.inspectionId,
        persistedPackageId = baseline.packageId,
        setup = setup,
        scope = scope,
        savedReferenceBaselineKey = baseline.savedReferenceBaselineKey,
        savedSetupBaseline = setup,
        savedScopeBaseline = scope,
        shellLineCountOverride = baseline.shellLineCountOverride?.toString().orEmpty(),
        savedShellLineCountOverride = baseline.shellLineCountOverride?.toString().orEmpty(),
        shellCaptureStartLaneId = baseline.captureStartLaneId.orEmpty(),
        savedShellCaptureStartLaneId = baseline.captureStartLaneId.orEmpty(),
        savedShellPlanKey = baseline.savedShellPlanKey,
        shellUtRows = shellUtRows,
        savedShellSettlementSurvey = shellSettlementSurvey,
        savedRoundnessSurvey = roundnessSurvey,
        savedPlumbnessSurvey = plumbnessSurvey,
        fixedRoofLayoutDraft = fixedRoofLayoutDraft,
        savedFixedRoofLayoutDraft = fixedRoofLayoutDraft.takeIf { baseline.fixedRoofLayoutReady },
        floatingRoofLayoutDraft = floatingRoofLayoutDraft,
        savedFloatingRoofLayoutDraft = floatingRoofLayoutDraft.takeIf { baseline.floatingRoofLayoutReady },
        activeRoofSurfaceId = activeRoofSurfaceId,
        roofFeatures = roofFeatures,
        roofUtDraft = ai.laiq.tankinspection.presentation.RoofUtDraftInput(roofSurfaceId = activeRoofSurfaceId),
        roofUtRows = roofUtRows,
        shellNozzles = shellNozzles,
        shellNozzleUtRows = shellNozzleUtRows,
        roofNozzleDraft = ai.laiq.tankinspection.presentation.RoofNozzleDraftInput(roofSurfaceId = activeRoofSurfaceId),
        roofNozzles = roofNozzles,
        roofNozzleUtDraft = ai.laiq.tankinspection.presentation.NozzleUtDraftInput(roofSurfaceId = activeRoofSurfaceId),
        roofNozzleUtRows = roofNozzleUtRows,
        findings = findingRecords,
        attachments = attachmentRecords,
        mflImportDraft = MflImportDraftInput(
            contractor = baseline.mflContractor.orEmpty(),
            reportReference = baseline.mflReportReference.orEmpty(),
            reportDate = baseline.mflReportDate.orEmpty(),
            severity = baseline.mflSeverity ?: "medium",
            pdfRelativePath = mflAttachment?.relativePath.orEmpty(),
            pdfCaption = mflAttachment?.caption.orEmpty(),
            attachmentId = baseline.mflAttachmentId,
        ),
    )

    return SavedAppSession(
        currentScreen = restoreScreen(currentSession?.currentScreen, restoredDraft),
        draftState = restoredDraft,
    )
}

internal fun InspectionBaselineEntity.isStructuredRestoreReady(): Boolean =
    fixedRoofLayoutIsRestorable() && floatingRoofLayoutIsRestorable()

internal fun filterRestorableInspectionRecords(
    records: List<InspectionRecordEntity>,
    baselines: List<InspectionBaselineEntity>,
): List<InspectionRecordEntity> {
    val restorableInspectionIds = baselines
        .asSequence()
        .filter { baseline -> baseline.isStructuredRestoreReady() }
        .map { baseline -> baseline.inspectionId }
        .toSet()
    return records.filter { record -> record.inspectionId in restorableInspectionIds }
}

private fun restoreRoundnessSurvey(
    measurements: List<InspectionMeasurementEntity>,
): RoundnessSurvey? {
    val roundnessRows = measurements.filter { it.moduleKey == "roundness" }
        .sortedWith(compareBy<InspectionMeasurementEntity> { it.sortOrder }.thenBy { it.measurementId })
    if (roundnessRows.isEmpty()) return null

    val bands = linkedMapOf<String, MutableList<InspectionMeasurementEntity>>()
    roundnessRows.forEach { row ->
        val groupId = row.groupId ?: row.measurementId
        bands.getOrPut(groupId) { mutableListOf() }.add(row)
    }

    return RoundnessSurvey(
        surveys = bands.map { (groupId, rows) ->
            val firstRow = rows.first()
            RoundnessSurveyBand(
                surveyId = groupId,
                label = firstRow.groupLabel ?: groupId,
                heightReference = firstRow.heightReference,
                stationCount = rows.size,
                stations = rows.sortedBy { it.sortOrder }.map { row ->
                    RoundnessSurveyStation(
                        stationId = row.stationId.orEmpty(),
                        angleDeg = row.angleDeg ?: 0.0,
                        easting = row.value1,
                        northing = row.value2,
                        captureState = parseCaptureState(row.captureState),
                        note = row.note,
                    )
                },
            )
        },
    )
}

private fun restoreNozzleDefinition(component: InspectionComponentEntity): NozzleDefinition =
    NozzleDefinition(
        nozzleId = component.componentId,
        surface = component.surface,
        roofSurfaceId = component.roofSurfaceId,
        size = component.size.orEmpty(),
        hasReinforcementPad = component.hasReinforcementPad ?: true,
        placementMode = component.placementMode,
        course = component.course,
        azimuthDeg = component.azimuthDeg,
        radiusRatio = component.radiusRatio,
        courseOffsetRatio = component.courseOffsetRatio,
        plateId = component.plateId,
    )

private fun restoreRoofLayoutDraft(
    templateName: String?,
    rowCount: Int?,
    widestRowPlateCount: Int?,
    ringCount: Int?,
    sectorCount: Int?,
    centerOpeningRatio: Double?,
    hasAnnularRing: Boolean,
    annularSectionCount: Int?,
    hasPontoonDeck: Boolean,
): RoofLayoutDraftInput {
    val template = parseRoofTemplate(templateName)
    return RoofLayoutDraftInput(
        template = template,
        rowCount = rowCount?.toString().orEmpty(),
        widestRowPlateCount = widestRowPlateCount?.toString().orEmpty(),
        ringCount = ringCount?.toString().orEmpty(),
        sectorCount = sectorCount?.toString().orEmpty(),
        centerOpeningRatio = centerOpeningRatio?.toDisplayString().orEmpty(),
        hasAnnularRing = hasAnnularRing,
        annularSectionCount = annularSectionCount?.toString().orEmpty(),
        hasPontoonDeck = hasPontoonDeck,
    )
}

private fun InspectionBaselineEntity.fixedRoofLayoutIsRestorable(): Boolean =
    roofLayoutIsRestorable(
        isReady = fixedRoofLayoutReady,
        templateName = fixedRoofLayoutTemplate,
        rowCount = fixedRoofRowCount,
        widestRowPlateCount = fixedRoofWidestRowPlateCount,
        ringCount = fixedRoofRingCount,
        sectorCount = fixedRoofSectorCount,
    )

private fun InspectionBaselineEntity.floatingRoofLayoutIsRestorable(): Boolean =
    roofLayoutIsRestorable(
        isReady = floatingRoofLayoutReady,
        templateName = floatingRoofLayoutTemplate,
        rowCount = floatingRoofRowCount,
        widestRowPlateCount = floatingRoofWidestRowPlateCount,
        ringCount = floatingRoofRingCount,
        sectorCount = floatingRoofSectorCount,
    )

private fun roofLayoutIsRestorable(
    isReady: Boolean,
    templateName: String?,
    rowCount: Int?,
    widestRowPlateCount: Int?,
    ringCount: Int?,
    sectorCount: Int?,
): Boolean {
    if (!isReady) return true
    return when (parseRoofTemplate(templateName)) {
        RoofTemplate.CONE_RADIAL,
        RoofTemplate.UMBRELLA_RADIAL -> ringCount != null && sectorCount != null
        RoofTemplate.CIRCULAR_PLATE,
        RoofTemplate.CIRCULAR_CENTER_OPENING -> rowCount != null && widestRowPlateCount != null
    }
}

private fun normalizeActiveRoofSurfaceId(
    raw: String,
    setup: SetupFormState,
): String {
    val available = setup.availableRoofSurfaces().map { surface -> surface.roofSurfaceId }
    return when {
        raw in available -> raw
        available.isNotEmpty() -> available.first()
        else -> ROOF_SURFACE_FIXED
    }
}

private fun restoreScreen(
    rawScreen: String?,
    draftState: FieldDraftState,
): ProductScreen = rawScreen
    ?.let { screenName ->
        runCatching { enumValueOf<ProductScreen>(screenName) }.getOrNull()
    }
    ?: if (
    draftState.setup.client.isBlank() &&
    draftState.setup.site.isBlank() &&
    draftState.setup.tankNumber.isBlank()
) {
    ProductScreen.Setup
} else {
    ProductScreen.TaskBoard
}

private fun parseSelectedTasks(raw: String): Set<FieldTask> {
    val parsed = raw.split(',')
        .mapNotNull { token ->
            val normalized = token.trim()
            if (normalized.isBlank()) null else runCatching { enumValueOf<FieldTask>(normalized) }.getOrNull()
        }
        .toCollection(linkedSetOf())
    return parsed.ifEmpty { ai.laiq.tankinspection.presentation.defaultFieldTasks() }
}

private fun parseReferenceMode(raw: String): ReferenceMode =
    runCatching { enumValueOf<ReferenceMode>(raw) }.getOrDefault(ReferenceMode.TANK_NORTH)

private fun parseStartReference(raw: String): StartReference =
    runCatching { enumValueOf<StartReference>(raw) }.getOrDefault(StartReference.N)

private fun parseRotationDirection(raw: String): RotationDirection =
    runCatching { enumValueOf<RotationDirection>(raw) }.getOrDefault(RotationDirection.CLOCKWISE)

private fun parseMeasurementUnit(raw: String): MeasurementUnit =
    runCatching { enumValueOf<MeasurementUnit>(raw) }.getOrDefault(MeasurementUnit.MM)

private fun parseNozzleSizeUnit(raw: String): NozzleSizeUnit =
    runCatching { enumValueOf<NozzleSizeUnit>(raw) }.getOrDefault(NozzleSizeUnit.INCH)

private fun parseCaptureState(raw: String): MeasurementCaptureState =
    runCatching { enumValueOf<MeasurementCaptureState>(raw) }.getOrDefault(MeasurementCaptureState.CAPTURED)

private fun parseRoofTemplate(raw: String?): RoofTemplate = runCatching {
    raw?.let { enumValueOf<RoofTemplate>(it) }
}.getOrNull() ?: RoofTemplate.CIRCULAR_PLATE

private fun Double.toDisplayString(): String =
    if (this % 1.0 == 0.0) toInt().toString() else toString()

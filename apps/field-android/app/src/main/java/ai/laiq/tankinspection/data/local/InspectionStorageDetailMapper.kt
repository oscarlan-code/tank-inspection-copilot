package ai.laiq.tankinspection.data.local

import ai.laiq.tankinspection.data.local.db.InspectionBaselineEntity
import ai.laiq.tankinspection.data.local.db.InspectionComponentEntity
import ai.laiq.tankinspection.data.local.db.InspectionFindingEntity
import ai.laiq.tankinspection.data.local.db.InspectionMeasurementEntity
import ai.laiq.tankinspection.domain.model.CanonicalInspectionPackage
import ai.laiq.tankinspection.domain.model.RoofFeature
import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.ROOF_SURFACE_FIXED
import ai.laiq.tankinspection.presentation.ROOF_SURFACE_FLOATING
import ai.laiq.tankinspection.presentation.buildMflImportOrNull
import ai.laiq.tankinspection.presentation.buildRoofLayoutOrNull
import ai.laiq.tankinspection.presentation.committedRecommendedLineCount
import ai.laiq.tankinspection.presentation.committedResolvedLineCount
import ai.laiq.tankinspection.presentation.committedShellLineCountOverride
import ai.laiq.tankinspection.presentation.committedScopeBaseline
import ai.laiq.tankinspection.presentation.committedSetupState
import ai.laiq.tankinspection.presentation.hasFixedRoof
import ai.laiq.tankinspection.presentation.hasFloatingRoof
import ai.laiq.tankinspection.presentation.normalizedActiveRoofSurfaceId
import ai.laiq.tankinspection.presentation.roofSystemLabel
import ai.laiq.tankinspection.presentation.startReferenceLabel

internal fun FieldDraftState.toInspectionBaseline(
    packagePreview: CanonicalInspectionPackage,
    updatedAtIso: String,
): InspectionBaselineEntity {
    val committedSetup = committedSetupState()
    val committedScope = committedScopeBaseline()
    val mflImport = buildMflImportOrNull()
    val fixedRoofLayout = buildRoofLayoutOrNull(ROOF_SURFACE_FIXED)
    val floatingRoofLayout = buildRoofLayoutOrNull(ROOF_SURFACE_FLOATING)

    return InspectionBaselineEntity(
        inspectionId = packagePreview.inspection.inspectionId,
        packageId = packagePreview.packageId,
        startedAtIso = startedAtIso,
        inspectionType = packagePreview.inspection.inspectionType,
        client = committedSetup.client,
        site = committedSetup.site,
        tankNumber = committedSetup.tankNumber,
        inspector = committedSetup.inspector,
        diameterM = packagePreview.tankMaster.diameterM,
        heightM = packagePreview.tankMaster.heightM,
        shellCourseCount = packagePreview.tankMaster.shellCourseCount,
        roofType = committedSetup.roofSystemLabel(),
        fixedRoofType = committedSetup.fixedRoofType.takeIf { committedSetup.hasFixedRoof() },
        floatingRoofType = committedSetup.floatingRoofType.takeIf { committedSetup.hasFloatingRoof() },
        thicknessUnit = committedSetup.thicknessUnit.name,
        settlementUnit = committedSetup.settlementUnit.name,
        nozzleSizeUnit = committedSetup.nozzleSizeUnit.name,
        referenceMode = committedScope.referenceMode.name,
        startReferenceCode = committedScope.startReference.name,
        startReferenceLabel = committedScope.startReferenceLabel(),
        referenceRemark = committedScope.referenceRemark,
        rotationDirection = committedScope.rotationDirection.name,
        selectedTaskKeys = committedScope.selectedTasks.joinToString(",") { task -> task.name },
        savedReferenceBaselineKey = savedReferenceBaselineKey,
        savedShellPlanKey = savedShellPlanKey,
        shellLineCountOverride = committedShellLineCountOverride().toIntOrNull(),
        recommendedShellLineCount = committedRecommendedLineCount(),
        resolvedShellLineCount = committedResolvedLineCount(),
        captureStartLaneId = packagePreview.shellLinePlan.captureStartLaneId,
        activeRoofSurfaceId = normalizedActiveRoofSurfaceId(),
        fixedRoofLayoutTemplate = fixedRoofLayout?.template?.name,
        fixedRoofLayoutReady = fixedRoofLayout != null,
        fixedRoofRowCount = fixedRoofLayout?.rowCount,
        fixedRoofWidestRowPlateCount = fixedRoofLayout?.widestRowPlateCount,
        fixedRoofRingCount = fixedRoofLayout?.ringCount,
        fixedRoofSectorCount = fixedRoofLayout?.sectorCount,
        fixedRoofCenterOpeningRatio = fixedRoofLayout?.centerOpeningRatio,
        fixedRoofHasAnnularRing = fixedRoofLayout?.hasAnnularRing ?: false,
        fixedRoofAnnularSectionCount = fixedRoofLayout?.annularSectionCount,
        fixedRoofHasPontoonDeck = fixedRoofLayout?.hasPontoonDeck ?: false,
        fixedRoofFeatureCount = roofFeatures.count { feature -> resolvedRoofSurfaceId(feature) == ROOF_SURFACE_FIXED },
        floatingRoofLayoutTemplate = floatingRoofLayout?.template?.name,
        floatingRoofLayoutReady = floatingRoofLayout != null,
        floatingRoofRowCount = floatingRoofLayout?.rowCount,
        floatingRoofWidestRowPlateCount = floatingRoofLayout?.widestRowPlateCount,
        floatingRoofRingCount = floatingRoofLayout?.ringCount,
        floatingRoofSectorCount = floatingRoofLayout?.sectorCount,
        floatingRoofCenterOpeningRatio = floatingRoofLayout?.centerOpeningRatio,
        floatingRoofHasAnnularRing = floatingRoofLayout?.hasAnnularRing ?: false,
        floatingRoofAnnularSectionCount = floatingRoofLayout?.annularSectionCount,
        floatingRoofHasPontoonDeck = floatingRoofLayout?.hasPontoonDeck ?: false,
        floatingRoofFeatureCount = roofFeatures.count { feature -> resolvedRoofSurfaceId(feature) == ROOF_SURFACE_FLOATING },
        mflContractor = mflImport?.contractor,
        mflReportReference = mflImport?.reportReference,
        mflReportDate = mflImport?.reportDate,
        mflSeverity = mflImport?.severity,
        mflAttachmentId = mflImport?.attachmentId,
        reviewStatus = packagePreview.reviewStatus.status.name,
        reviewWarningCount = packagePreview.reviewStatus.warnings.size,
        updatedAtIso = updatedAtIso,
    )
}

internal fun FieldDraftState.toInspectionComponentEntities(
    packagePreview: CanonicalInspectionPackage,
    updatedAtIso: String,
): List<InspectionComponentEntity> {
    val inspectionId = packagePreview.inspection.inspectionId
    val roofFeaturesBySurface = roofFeatures.sortedBy { feature -> feature.featureId }
        .mapIndexed { index, feature ->
            InspectionComponentEntity(
                inspectionId = inspectionId,
                componentId = feature.featureId,
                componentKind = "roof_feature",
                componentType = feature.type,
                sortOrder = index,
                surface = "roof",
                roofSurfaceId = resolvedRoofSurfaceId(feature),
                label = feature.label,
                size = null,
                hasReinforcementPad = null,
                placementMode = feature.placementMode,
                course = null,
                azimuthDeg = feature.azimuthDeg,
                radiusRatio = feature.radiusRatio,
                courseOffsetRatio = null,
                plateId = feature.plateId,
                updatedAtIso = updatedAtIso,
            )
        }
    val shellNozzles = packagePreview.nozzleRegistries?.shell.orEmpty().mapIndexed { index, nozzle ->
        InspectionComponentEntity(
            inspectionId = inspectionId,
            componentId = nozzle.nozzleId,
            componentKind = "shell_nozzle",
            componentType = "nozzle",
            sortOrder = roofFeaturesBySurface.size + index,
            surface = nozzle.surface,
            roofSurfaceId = nozzle.roofSurfaceId,
            label = nozzle.nozzleId,
            size = nozzle.size,
            hasReinforcementPad = nozzle.hasReinforcementPad,
            placementMode = nozzle.placementMode,
            course = nozzle.course,
            azimuthDeg = nozzle.azimuthDeg,
            radiusRatio = nozzle.radiusRatio,
            courseOffsetRatio = nozzle.courseOffsetRatio,
            plateId = nozzle.plateId,
            updatedAtIso = updatedAtIso,
        )
    }
    val roofNozzles = packagePreview.nozzleRegistries?.roof.orEmpty().mapIndexed { index, nozzle ->
        InspectionComponentEntity(
            inspectionId = inspectionId,
            componentId = nozzle.nozzleId,
            componentKind = "roof_nozzle",
            componentType = "nozzle",
            sortOrder = roofFeaturesBySurface.size + shellNozzles.size + index,
            surface = nozzle.surface,
            roofSurfaceId = nozzle.roofSurfaceId,
            label = nozzle.nozzleId,
            size = nozzle.size,
            hasReinforcementPad = nozzle.hasReinforcementPad,
            placementMode = nozzle.placementMode,
            course = nozzle.course,
            azimuthDeg = nozzle.azimuthDeg,
            radiusRatio = nozzle.radiusRatio,
            courseOffsetRatio = nozzle.courseOffsetRatio,
            plateId = nozzle.plateId,
            updatedAtIso = updatedAtIso,
        )
    }

    return roofFeaturesBySurface + shellNozzles + roofNozzles
}

internal fun FieldDraftState.toInspectionMeasurementEntities(
    packagePreview: CanonicalInspectionPackage,
    updatedAtIso: String,
): List<InspectionMeasurementEntity> {
    val inspectionId = packagePreview.inspection.inspectionId
    val measurements = mutableListOf<InspectionMeasurementEntity>()

    packagePreview.measurements.shellUtRows.forEachIndexed { index, row ->
        measurements += InspectionMeasurementEntity(
            inspectionId = inspectionId,
            measurementId = "shell_ut:${row.rowId}",
            moduleKey = "shell_ut",
            sortOrder = index,
            sourceRecordId = row.rowId,
            groupId = null,
            groupLabel = null,
            lineId = row.lineId,
            course = row.course,
            roofSurfaceId = null,
            plateId = null,
            nozzleId = null,
            stationId = null,
            angleDeg = null,
            heightReference = null,
            captureState = row.captureState.name,
            value1 = valueAt(row.readings, 0),
            value2 = valueAt(row.readings, 1),
            value3 = valueAt(row.readings, 2),
            value4 = valueAt(row.readings, 3),
            value5 = valueAt(row.readings, 4),
            note = row.note,
            updatedAtIso = updatedAtIso,
        )
    }
    packagePreview.measurements.roofUtRows.forEachIndexed { index, row ->
        measurements += InspectionMeasurementEntity(
            inspectionId = inspectionId,
            measurementId = "roof_ut:${row.rowId}",
            moduleKey = "roof_ut",
            sortOrder = index,
            sourceRecordId = row.rowId,
            groupId = row.roofSurfaceId,
            groupLabel = row.roofSurfaceId,
            lineId = null,
            course = null,
            roofSurfaceId = row.roofSurfaceId,
            plateId = row.plateId,
            nozzleId = null,
            stationId = null,
            angleDeg = null,
            heightReference = null,
            captureState = row.captureState.name,
            value1 = valueAt(row.readings, 0),
            value2 = valueAt(row.readings, 1),
            value3 = valueAt(row.readings, 2),
            value4 = valueAt(row.readings, 3),
            value5 = valueAt(row.readings, 4),
            note = row.note,
            updatedAtIso = updatedAtIso,
        )
    }
    packagePreview.measurements.shellNozzleUtRows.forEachIndexed { index, row ->
        measurements += InspectionMeasurementEntity(
            inspectionId = inspectionId,
            measurementId = "shell_nozzle_ut:${row.rowId}",
            moduleKey = "shell_nozzle_ut",
            sortOrder = index,
            sourceRecordId = row.rowId,
            groupId = null,
            groupLabel = null,
            lineId = null,
            course = null,
            roofSurfaceId = row.roofSurfaceId,
            plateId = null,
            nozzleId = row.nozzleId,
            stationId = null,
            angleDeg = null,
            heightReference = null,
            captureState = row.captureState.name,
            value1 = valueAt(row.bodyReadings, 0),
            value2 = valueAt(row.bodyReadings, 1),
            value3 = valueAt(row.bodyReadings, 2),
            value4 = row.reinforcementPadReading,
            value5 = null,
            note = row.note,
            updatedAtIso = updatedAtIso,
        )
    }
    packagePreview.measurements.roofNozzleUtRows.forEachIndexed { index, row ->
        measurements += InspectionMeasurementEntity(
            inspectionId = inspectionId,
            measurementId = "roof_nozzle_ut:${row.rowId}",
            moduleKey = "roof_nozzle_ut",
            sortOrder = index,
            sourceRecordId = row.rowId,
            groupId = row.roofSurfaceId,
            groupLabel = row.roofSurfaceId,
            lineId = null,
            course = null,
            roofSurfaceId = row.roofSurfaceId,
            plateId = null,
            nozzleId = row.nozzleId,
            stationId = null,
            angleDeg = null,
            heightReference = null,
            captureState = row.captureState.name,
            value1 = valueAt(row.bodyReadings, 0),
            value2 = valueAt(row.bodyReadings, 1),
            value3 = valueAt(row.bodyReadings, 2),
            value4 = row.reinforcementPadReading,
            value5 = null,
            note = row.note,
            updatedAtIso = updatedAtIso,
        )
    }
    packagePreview.shellSettlementSurvey?.stations?.forEachIndexed { index, station ->
        measurements += InspectionMeasurementEntity(
            inspectionId = inspectionId,
            measurementId = "shell_settlement:${station.stationId}",
            moduleKey = "shell_settlement",
            sortOrder = index,
            sourceRecordId = station.stationId,
            groupId = null,
            groupLabel = null,
            lineId = null,
            course = null,
            roofSurfaceId = null,
            plateId = null,
            nozzleId = null,
            stationId = station.stationId,
            angleDeg = station.angleDeg,
            heightReference = null,
            captureState = station.captureState.name,
            value1 = station.elevation,
            value2 = null,
            value3 = null,
            value4 = null,
            value5 = null,
            note = station.note,
            updatedAtIso = updatedAtIso,
        )
    }
    packagePreview.roundnessSurvey?.surveys?.forEachIndexed { bandIndex, band ->
        band.stations.forEachIndexed { index, station ->
            measurements += InspectionMeasurementEntity(
                inspectionId = inspectionId,
                measurementId = "roundness:${band.surveyId}:${station.stationId}",
                moduleKey = "roundness",
                sortOrder = (bandIndex * 1000) + index,
                sourceRecordId = "${band.surveyId}:${station.stationId}",
                groupId = band.surveyId,
                groupLabel = band.label,
                lineId = null,
                course = null,
                roofSurfaceId = null,
                plateId = null,
                nozzleId = null,
                stationId = station.stationId,
                angleDeg = station.angleDeg,
                heightReference = band.heightReference,
                captureState = station.captureState.name,
                value1 = station.easting,
                value2 = station.northing,
                value3 = null,
                value4 = null,
                value5 = null,
                note = station.note,
                updatedAtIso = updatedAtIso,
            )
        }
    }
    packagePreview.plumbnessSurvey?.stations?.forEachIndexed { index, station ->
        measurements += InspectionMeasurementEntity(
            inspectionId = inspectionId,
            measurementId = "plumbness:${station.stationId}",
            moduleKey = "plumbness",
            sortOrder = index,
            sourceRecordId = station.stationId,
            groupId = null,
            groupLabel = null,
            lineId = null,
            course = null,
            roofSurfaceId = null,
            plateId = null,
            nozzleId = null,
            stationId = station.stationId,
            angleDeg = station.angleDeg,
            heightReference = null,
            captureState = station.captureState.name,
            value1 = station.plumbness,
            value2 = null,
            value3 = null,
            value4 = null,
            value5 = null,
            note = station.note,
            updatedAtIso = updatedAtIso,
        )
    }

    return measurements
}

internal fun FieldDraftState.toInspectionFindingEntities(
    packagePreview: CanonicalInspectionPackage,
    updatedAtIso: String,
): List<InspectionFindingEntity> {
    val inspectionId = packagePreview.inspection.inspectionId
    return packagePreview.findings.mapIndexed { index, finding ->
        InspectionFindingEntity(
            inspectionId = inspectionId,
            findingId = finding.findingId,
            sortOrder = index,
            surface = finding.surface,
            type = finding.type,
            severity = finding.severity,
            note = finding.note,
            linkedMeasurementId = finding.linkedMeasurementId,
            locationSummary = finding.locationSummary,
            preciseLineId = finding.preciseLineId,
            preciseCourse = finding.preciseCourse,
            attachmentCount = finding.attachmentIds.size,
            updatedAtIso = updatedAtIso,
        )
    }
}

private fun resolvedRoofSurfaceId(feature: RoofFeature): String =
    feature.roofSurfaceId ?: ROOF_SURFACE_FIXED

private fun valueAt(values: List<Double>, index: Int): Double? = values.getOrNull(index)

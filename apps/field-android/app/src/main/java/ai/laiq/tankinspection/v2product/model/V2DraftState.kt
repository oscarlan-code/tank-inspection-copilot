package ai.laiq.tankinspection.v2product.model

import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.domain.model.RotationDirection
import ai.laiq.tankinspection.presentation.GeneralTankInfoFormState

enum class V2LayoutSurface(val key: String, val label: String) {
    ROOF("roof", "Roof"),
    SHELL("shell", "Shell"),
    FLOOR("floor", "Floor"),
}

enum class V2LayoutTarget(
    val key: String,
    val label: String,
    val surface: V2LayoutSurface,
    val roofScope: V2RoofScope? = null,
) {
    EXTERNAL_ROOF("external_roof", "External Roof", V2LayoutSurface.ROOF, V2RoofScope.EXTERNAL),
    INTERNAL_ROOF("internal_roof", "Internal Roof", V2LayoutSurface.ROOF, V2RoofScope.INTERNAL),
    SHELL("shell", "Shell", V2LayoutSurface.SHELL),
    FLOOR("floor", "Floor", V2LayoutSurface.FLOOR),
}

enum class V2RoofScope(val key: String, val label: String) {
    EXTERNAL("external", "External Roof"),
    INTERNAL("internal", "Internal Roof"),
}

enum class V2ReferenceMode(val key: String, val label: String) {
    TANK_NORTH("tank_north", "Tank North"),
    TRUE_NORTH("true_north", "True North"),
}

enum class V2FloorTemplate(val key: String, val label: String) {
    CIRCULAR_PLATE("circular_plate", "Circular Plate"),
    CIRCULAR_PLATE_WITH_AR("circular_plate_ar", "Circular Plate + AR"),
}

enum class V2ShellOffsetStartRow(val key: String, val label: String) {
    ODD("odd", "Odd Courses"),
    EVEN("even", "Even Courses"),
}

enum class V2ShellThirdOffsetStart(val key: String, val label: String) {
    FULL("full", "Full"),
    ONE_THIRD("one_third", "1/3"),
    TWO_THIRDS("two_thirds", "2/3"),
}

data class V2GeneralTankInfo(
    val client: String = "",
    val clientRepresentative: String = "",
    val jobNo: String = "",
    val tankNumber: String = "",
    val dateCompleted: String = "",
    val inspector: String = "",
    val location: String = "",
    val fieldLeaseName: String = "",
    val yearBuilt: String = "",
    val originalManufacturer: String = "",
    val originalConstructionStd: String = "",
    val materialSpec: String = "",
    val drawingRef: String = "",
    val shellConstruction: String = "butt",
    val roofType: String = "",
    val externalRoofType: String = "yes",
    val internalRoofType: String = "no",
    val height: String = "",
    val serviceHeight: String = "",
    val diameter: String = "",
    val productStored: String = "",
    val specificGravity: String = "",
    val designTemp: String = "",
    val internalPressure: String = "",
    val courseNumber: String = "",
    val floorPlateNumber: String = "",
    val roofPlateNumber: String = "",
    val floorPlateThickness: String = "",
    val windGirder: String = "",
    val annularPlateNumber: String = "",
    val insulated: String = "no",
    val insulationDistance: String = "",
    val annularPlateThickness: String = "",
    val stiffener: String = "",
    val previousExternal: String = "",
    val previousInternal: String = "",
    val previousBottom: String = "",
)

fun V2GeneralTankInfo.hasExternalRoof(): Boolean =
    externalRoofType.toRoofPresence()

fun V2GeneralTankInfo.hasInternalRoof(): Boolean =
    internalRoofType.toRoofPresence()

fun V2GeneralTankInfo.normalizedRoofPresence(): V2GeneralTankInfo =
    copy(
        roofType = "",
        externalRoofType = if (hasExternalRoof()) "yes" else "no",
        internalRoofType = if (hasInternalRoof()) "yes" else "no",
    )

private fun String.toRoofPresence(): Boolean =
    when (trim().lowercase()) {
        "yes",
        "present",
        "cone",
        "dome",
        "umbrella",
        "geodesic",
        "other_fixed",
        "external_floating",
        "internal_floating" -> true
        else -> false
    }

data class V2LayoutScope(
    val externalRoof: Boolean = true,
    val internalRoof: Boolean = false,
    val shell: Boolean = true,
    val floor: Boolean = false,
)

data class V2ElementSetup(
    val externalRoof: Boolean = true,
    val internalRoof: Boolean = true,
    val shell: Boolean = true,
    val floor: Boolean = true,
)

data class V2UtSetup(
    val externalRoof: Boolean = true,
    val internalRoof: Boolean = true,
    val shell: Boolean = true,
    val floor: Boolean = true,
)

enum class V2UtItemKind {
    LAYOUT_REGION,
    ELEMENT,
}

data class V2UtMeasurementEntry(
    val itemKey: String,
    val target: V2LayoutTarget,
    val itemLabel: String,
    val kind: V2UtItemKind,
    val elementType: V2ElementType? = null,
    val nozzleSize: String = "6 in",
    val reinforcementPadReading: String = "",
    val readings: List<String> = emptyList(),
    val confirmed: Boolean = false,
)

data class V2UtMeasurementState(
    val selectedTarget: V2LayoutTarget = V2LayoutTarget.EXTERNAL_ROOF,
    val activeItemKey: String? = null,
    val entriesByItemKey: Map<String, V2UtMeasurementEntry> = emptyMap(),
    val approvedTargets: Set<V2LayoutTarget> = emptySet(),
)

data class V2FindingState(
    val activeItemKey: String? = null,
    val findingsByItemKey: Map<String, V2FindingRecord> = emptyMap(),
)

data class V2FindingRecord(
    val itemKey: String,
    val target: V2LayoutTarget,
    val itemLabel: String,
    val itemKind: V2UtItemKind,
    val elementType: V2ElementType? = null,
    val note: String = "",
    val photos: List<V2FindingPhoto> = emptyList(),
    val selectedPhotoId: String? = null,
)

data class V2FindingPhoto(
    val id: String,
    val relativePath: String,
    val displayName: String,
    val annotationStrokes: List<V2AnnotationStroke> = emptyList(),
)

data class V2AnnotationStroke(
    val points: List<V2AnnotationPoint>,
)

data class V2AnnotationPoint(
    val x: Float,
    val y: Float,
)

enum class V2ElementType(
    val key: String,
    val label: String,
    val shortLabel: String,
    val surfaces: Set<V2LayoutSurface>,
) {
    NOZZLE("nozzle", "Nozzle", "NZ", setOf(V2LayoutSurface.ROOF, V2LayoutSurface.SHELL)),
    MANHOLE("manhole", "Manhole", "MH", setOf(V2LayoutSurface.ROOF, V2LayoutSurface.SHELL, V2LayoutSurface.FLOOR)),
    STAIR("stair", "Stair / Staircase", "ST", setOf(V2LayoutSurface.SHELL)),
    PLATFORM("platform", "Platform", "PF", setOf(V2LayoutSurface.ROOF, V2LayoutSurface.SHELL)),
    VENT("vent", "Vent", "VT", setOf(V2LayoutSurface.ROOF)),
    GAUGE_HATCH("gauge_hatch", "Gauge Hatch", "GH", setOf(V2LayoutSurface.ROOF, V2LayoutSurface.SHELL)),
    ROOF_DRAIN("roof_drain", "Roof Drain", "RD", setOf(V2LayoutSurface.ROOF)),
    SUPPORT("support", "Support", "SP", setOf(V2LayoutSurface.ROOF)),
    SUMP("sump", "Sump", "SU", setOf(V2LayoutSurface.FLOOR)),
    DATUM("datum", "Reference / Datum", "RF", setOf(V2LayoutSurface.SHELL, V2LayoutSurface.FLOOR)),
}

fun V2ElementType.requiresUtMeasurement(): Boolean =
    this == V2ElementType.NOZZLE || this == V2ElementType.MANHOLE

fun V2UtMeasurementEntry.requiresElementUt(): Boolean =
    kind == V2UtItemKind.ELEMENT && elementType?.requiresUtMeasurement() == true

data class V2PlacedElement(
    val id: String,
    val label: String,
    val type: V2ElementType,
    val normalizedX: Float,
    val normalizedY: Float,
)

data class V2ElementPlacementState(
    val selectedTarget: V2LayoutTarget = V2LayoutTarget.EXTERNAL_ROOF,
    val selectedElementType: V2ElementType = V2ElementType.NOZZLE,
    val selectedElementId: String? = null,
    val placementsByTarget: Map<V2LayoutTarget, List<V2PlacedElement>> = emptyMap(),
    val approvedTargets: Set<V2LayoutTarget> = emptySet(),
    val nextElementIndexByTargetAndType: Map<String, Int> = emptyMap(),
)

data class V2LayoutMapSetup(
    val selectedTarget: V2LayoutTarget = V2LayoutTarget.EXTERNAL_ROOF,
    val selectedSurface: V2LayoutSurface = V2LayoutSurface.ROOF,
    val roofScope: V2RoofScope = V2RoofScope.EXTERNAL,
    val referenceMode: V2ReferenceMode = V2ReferenceMode.TANK_NORTH,
    val referenceNote: String = "",
    val rotationDirection: RotationDirection = RotationDirection.CLOCKWISE,
    val roofPattern: RoofTemplate = RoofTemplate.CONE_RADIAL,
    val roofRingCount: String = "3",
    val roofSectorCount: String = "20",
    val roofRowCount: String = "4",
    val roofWidestRowPlateCount: String = "10",
    val roofHasCenterOpening: Boolean = true,
    val roofCenterOpeningPlateCount: String = "1",
    val roofHasAnnularRing: Boolean = true,
    val roofAnnularSectionCount: String = "12",
    val shellCourseCount: String = "6",
    val shellPlatesPerCourse: String = "12",
    val shellLaneCount: String = "4",
    val shellPlateOffset: String = "half_plate",
    val shellOffsetStartRow: V2ShellOffsetStartRow = V2ShellOffsetStartRow.EVEN,
    val shellThirdOffsetStart: V2ShellThirdOffsetStart = V2ShellThirdOffsetStart.FULL,
    val selectedShellLaneIndex: Int? = null,
    val selectedShellPlateId: String? = null,
    val floorTemplate: V2FloorTemplate = V2FloorTemplate.CIRCULAR_PLATE_WITH_AR,
    val floorPlateCount: String = "18",
    val floorAnnularSectionCount: String = "12",
    val floorPatternCountX: String = "4",
    val floorPatternCountY: String = "12",
    val approvedTargets: Set<V2LayoutTarget> = emptySet(),
)

data class V2RoofLayoutMap(
    val roofScope: V2RoofScope = V2RoofScope.EXTERNAL,
    val referenceMode: V2ReferenceMode = V2ReferenceMode.TANK_NORTH,
    val rotationDirection: RotationDirection = RotationDirection.CLOCKWISE,
    val template: RoofTemplate = RoofTemplate.CONE_RADIAL,
    val rowCount: String = "5",
    val widestRowPlateCount: String = "14",
    val ringCount: String = "6",
    val sectorCount: String = "18",
    val hasCenterOpening: Boolean = true,
    val centerOpeningPlateCount: String = "1",
    val hasAnnularRing: Boolean = true,
    val annularSectionCount: String = "18",
)

data class V2DraftState(
    val generalTankInfo: V2GeneralTankInfo = V2GeneralTankInfo(),
    val layoutScope: V2LayoutScope = V2LayoutScope(),
    val layoutMapSetup: V2LayoutMapSetup = defaultV2LayoutMapSetup(),
    val elementSetup: V2ElementSetup = V2ElementSetup(),
    val elementPlacement: V2ElementPlacementState = defaultV2ElementPlacementState(),
    val utSetup: V2UtSetup = V2UtSetup(),
    val utMeasurements: V2UtMeasurementState = V2UtMeasurementState(),
    val inspectionChecklist: V2InspectionChecklistState = V2InspectionChecklistState(),
    val findingState: V2FindingState = V2FindingState(),
    val roofLayoutMap: V2RoofLayoutMap = defaultV2RoofLayoutMap(),
)

fun V2GeneralTankInfo.requiredValidationErrors(): List<String> {
    val errors = mutableListOf<String>()
    if (client.isBlank()) errors += "Enter the client."
    if (tankNumber.isBlank()) errors += "Enter the tank number."
    if (location.isBlank()) errors += "Enter the location."
    if (diameter.extractFirstDecimalToken()?.toDoubleOrNull()?.let { it > 0 } != true) {
        errors += "Enter a positive tank diameter."
    }
    if (height.extractFirstDecimalToken()?.toDoubleOrNull()?.let { it > 0 } != true) {
        errors += "Enter a positive tank height."
    }
    if (courseNumber.extractFirstIntegerToken()?.toIntOrNull()?.let { it > 0 } != true) {
        errors += "Enter a positive shell course number."
    }
    return errors
}

fun V2GeneralTankInfo.toLegacyFormState(): GeneralTankInfoFormState =
    GeneralTankInfoFormState(
        client = client,
        clientRepresentative = clientRepresentative,
        jobNo = jobNo,
        tankNumber = tankNumber,
        dateCompleted = dateCompleted,
        inspector = inspector,
        location = location,
        fieldLeaseName = fieldLeaseName,
        yearBuilt = yearBuilt,
        originalManufacturer = originalManufacturer,
        originalConstructionStd = originalConstructionStd,
        materialSpec = materialSpec,
        drawingRef = drawingRef,
        shellConstruction = shellConstruction,
        roofType = roofType,
        externalRoofType = externalRoofType,
        internalRoofType = internalRoofType,
        height = height,
        serviceHeight = serviceHeight,
        diameter = diameter,
        productStored = productStored,
        specificGravity = specificGravity,
        designTemp = designTemp,
        internalPressure = internalPressure,
        courseNumber = courseNumber,
        floorPlateNumber = floorPlateNumber,
        roofPlateNumber = roofPlateNumber,
        floorPlateThickness = floorPlateThickness,
        windGirder = windGirder,
        annularPlateNumber = annularPlateNumber,
        insulated = insulated,
        insulationDistance = insulationDistance,
        annularPlateThickness = annularPlateThickness,
        stiffener = stiffener,
        previousExternal = previousExternal,
        previousInternal = previousInternal,
        previousBottom = previousBottom,
    )

fun GeneralTankInfoFormState.toV2GeneralTankInfo(): V2GeneralTankInfo =
    V2GeneralTankInfo(
        client = client,
        clientRepresentative = clientRepresentative,
        jobNo = jobNo,
        tankNumber = tankNumber,
        dateCompleted = dateCompleted,
        inspector = inspector,
        location = location,
        fieldLeaseName = fieldLeaseName,
        yearBuilt = yearBuilt,
        originalManufacturer = originalManufacturer,
        originalConstructionStd = originalConstructionStd,
        materialSpec = materialSpec,
        drawingRef = drawingRef,
        shellConstruction = shellConstruction,
        roofType = roofType,
        externalRoofType = externalRoofType,
        internalRoofType = internalRoofType,
        height = height,
        serviceHeight = serviceHeight,
        diameter = diameter,
        productStored = productStored,
        specificGravity = specificGravity,
        designTemp = designTemp,
        internalPressure = internalPressure,
        courseNumber = courseNumber,
        floorPlateNumber = floorPlateNumber,
        roofPlateNumber = roofPlateNumber,
        floorPlateThickness = floorPlateThickness,
        windGirder = windGirder,
        annularPlateNumber = annularPlateNumber,
        insulated = insulated,
        insulationDistance = insulationDistance,
        annularPlateThickness = annularPlateThickness,
        stiffener = stiffener,
        previousExternal = previousExternal,
        previousInternal = previousInternal,
        previousBottom = previousBottom,
    ).normalizedRoofPresence()

fun V2FindingRecord.withPhoto(photo: V2FindingPhoto): V2FindingRecord =
    copy(
        photos = photos + photo,
        selectedPhotoId = photo.id,
    )

fun V2FindingRecord.withSelectedPhoto(photoId: String?): V2FindingRecord =
    copy(selectedPhotoId = photoId)

fun V2FindingRecord.withPhotoAnnotations(
    photoId: String,
    strokes: List<V2AnnotationStroke>,
): V2FindingRecord =
    copy(
        photos = photos.map { photo ->
            if (photo.id == photoId) photo.copy(annotationStrokes = strokes) else photo
        },
        selectedPhotoId = photoId,
    )

fun V2FindingRecord.withRemovedPhoto(photoId: String): V2FindingRecord {
    val nextPhotos = photos.filterNot { photo -> photo.id == photoId }
    return copy(
        photos = nextPhotos,
        selectedPhotoId = selectedPhotoId
            .takeIf { selected -> selected != photoId && nextPhotos.any { photo -> photo.id == selected } }
            ?: nextPhotos.lastOrNull()?.id,
    )
}

fun V2FindingRecord.withReplacedPhoto(
    photoId: String,
    replacement: V2FindingPhoto,
): V2FindingRecord =
    copy(
        photos = photos.map { photo ->
            if (photo.id == photoId) replacement else photo
        },
        selectedPhotoId = replacement.id,
    )

fun V2FindingState.withActiveFinding(record: V2FindingRecord): V2FindingState =
    copy(
        activeItemKey = record.itemKey,
        findingsByItemKey = findingsByItemKey + (record.itemKey to record),
    )

fun V2FindingRecord.hasCapturedEvidence(): Boolean =
    note.isNotBlank() || photos.isNotEmpty()

fun V2FindingState.withSavedFinding(record: V2FindingRecord): V2FindingState =
    if (record.hasCapturedEvidence()) {
        withActiveFinding(record)
    } else {
        withRemovedFinding(record.itemKey)
    }

fun V2FindingState.withRemovedFinding(itemKey: String): V2FindingState =
    copy(
        activeItemKey = activeItemKey.takeIf { activeKey -> activeKey != itemKey },
        findingsByItemKey = findingsByItemKey - itemKey,
    )

fun V2LayoutMapSetup.withSelectedSurface(surface: V2LayoutSurface): V2LayoutMapSetup =
    copy(selectedSurface = surface)

fun V2LayoutMapSetup.withSelectedTarget(target: V2LayoutTarget): V2LayoutMapSetup =
    copy(
        selectedTarget = target,
        selectedSurface = target.surface,
        roofScope = target.roofScope ?: roofScope,
    )

fun V2LayoutMapSetup.withTargetApproval(target: V2LayoutTarget, approved: Boolean): V2LayoutMapSetup =
    copy(
        approvedTargets = if (approved) approvedTargets + target else approvedTargets - target,
    )

fun V2LayoutMapSetup.withoutTargetApproval(target: V2LayoutTarget): V2LayoutMapSetup =
    withTargetApproval(target, approved = false)

fun V2LayoutMapSetup.withoutAllTargetApprovals(): V2LayoutMapSetup =
    copy(approvedTargets = emptySet())

fun V2LayoutScope.selectedTargets(): List<V2LayoutTarget> =
    buildList {
        if (externalRoof) add(V2LayoutTarget.EXTERNAL_ROOF)
        if (internalRoof) add(V2LayoutTarget.INTERNAL_ROOF)
        if (shell) add(V2LayoutTarget.SHELL)
        if (floor) add(V2LayoutTarget.FLOOR)
    }

fun V2ElementSetup.selectedTargets(): List<V2LayoutTarget> =
    buildList {
        if (externalRoof) add(V2LayoutTarget.EXTERNAL_ROOF)
        if (internalRoof) add(V2LayoutTarget.INTERNAL_ROOF)
        if (shell) add(V2LayoutTarget.SHELL)
        if (floor) add(V2LayoutTarget.FLOOR)
    }

fun V2UtSetup.selectedTargets(): List<V2LayoutTarget> =
    buildList {
        if (externalRoof) add(V2LayoutTarget.EXTERNAL_ROOF)
        if (internalRoof) add(V2LayoutTarget.INTERNAL_ROOF)
        if (shell) add(V2LayoutTarget.SHELL)
        if (floor) add(V2LayoutTarget.FLOOR)
    }

fun V2ElementType.supports(target: V2LayoutTarget): Boolean =
    target.surface in surfaces

fun V2ElementPlacementState.placementsFor(target: V2LayoutTarget): List<V2PlacedElement> =
    placementsByTarget[target].orEmpty()

fun V2ElementPlacementState.withFirstAvailableTarget(targets: List<V2LayoutTarget>): V2ElementPlacementState {
    if (targets.isEmpty() || selectedTarget in targets) return this
    return copy(selectedTarget = targets.first(), selectedElementId = null)
}

fun V2UtMeasurementState.withFirstAvailableTarget(targets: List<V2LayoutTarget>): V2UtMeasurementState {
    if (targets.isEmpty() || selectedTarget in targets) return this
    return copy(selectedTarget = targets.first(), activeItemKey = null)
}

fun V2UtMeasurementState.withSelectedTarget(target: V2LayoutTarget): V2UtMeasurementState =
    copy(selectedTarget = target, activeItemKey = null)

fun V2UtMeasurementState.withSelectedEntry(entry: V2UtMeasurementEntry): V2UtMeasurementState =
    copy(
        activeItemKey = entry.itemKey,
        entriesByItemKey = if (entry.itemKey in entriesByItemKey) {
            entriesByItemKey
        } else {
            entriesByItemKey + (entry.itemKey to entry)
        },
    )

fun V2UtMeasurementState.withUpdatedEntry(entry: V2UtMeasurementEntry): V2UtMeasurementState =
    copy(
        activeItemKey = null,
        entriesByItemKey = entriesByItemKey + (entry.itemKey to entry),
    ).withoutTargetApproval(entry.target)

fun V2UtMeasurementState.withClearedActiveItem(): V2UtMeasurementState =
    copy(activeItemKey = null)

fun V2UtMeasurementState.withTargetApproval(
    target: V2LayoutTarget,
    approved: Boolean,
): V2UtMeasurementState =
    copy(
        approvedTargets = if (approved) approvedTargets + target else approvedTargets - target,
    )

fun V2UtMeasurementState.withoutTargetApproval(target: V2LayoutTarget): V2UtMeasurementState =
    withTargetApproval(target, approved = false)

fun V2ElementPlacementState.withSelectedTarget(target: V2LayoutTarget): V2ElementPlacementState =
    copy(selectedTarget = target, selectedElementId = null)

fun V2ElementPlacementState.withSelectedElementType(type: V2ElementType): V2ElementPlacementState =
    copy(selectedElementType = type)

fun V2ElementPlacementState.withSelectedElement(id: String?): V2ElementPlacementState =
    copy(selectedElementId = id)

fun V2ElementPlacementState.withRenamedElement(
    target: V2LayoutTarget,
    elementId: String,
    label: String,
): V2ElementPlacementState {
    val trimmedLabel = label.trim()
    if (trimmedLabel.isBlank()) return this
    val updated = placementsFor(target).map { element ->
        if (element.id == elementId) {
            element.copy(label = trimmedLabel)
        } else {
            element
        }
    }
    return copy(
        placementsByTarget = placementsByTarget + (target to updated),
        selectedElementId = elementId,
    )
}

fun V2ElementPlacementState.withTargetApproval(
    target: V2LayoutTarget,
    approved: Boolean,
): V2ElementPlacementState =
    copy(
        approvedTargets = if (approved) approvedTargets + target else approvedTargets - target,
    )

fun V2ElementPlacementState.withoutTargetApproval(target: V2LayoutTarget): V2ElementPlacementState =
    withTargetApproval(target, approved = false)

fun V2ElementPlacementState.withPlacedElement(
    target: V2LayoutTarget,
    type: V2ElementType,
    normalizedX: Float,
    normalizedY: Float,
): V2ElementPlacementState {
    val existing = placementsFor(target)
    val labelPrefix = "${type.shortLabel}-"
    val sequenceKey = "${target.key}:${type.key}"
    val highestExistingIndex = existing
        .filter { it.type == type }
        .mapNotNull { element -> element.label.removePrefix(labelPrefix).toIntOrNull() }
        .maxOrNull()
        ?: 0
    val nextIndex = maxOf(
        nextElementIndexByTargetAndType[sequenceKey] ?: 1,
        highestExistingIndex + 1,
    )
    val nextElement = V2PlacedElement(
        id = "${target.key}_${type.key}_$nextIndex",
        label = "${type.shortLabel}-$nextIndex",
        type = type,
        normalizedX = normalizedX,
        normalizedY = normalizedY,
    )
    return copy(
        placementsByTarget = placementsByTarget + (target to (existing + nextElement)),
        selectedElementId = nextElement.id,
        nextElementIndexByTargetAndType = nextElementIndexByTargetAndType + (sequenceKey to (nextIndex + 1)),
    ).withoutTargetApproval(target)
}

fun V2ElementPlacementState.withMovedElement(
    target: V2LayoutTarget,
    elementId: String,
    normalizedX: Float,
    normalizedY: Float,
): V2ElementPlacementState {
    val updated = placementsFor(target).map { element ->
        if (element.id == elementId) {
            element.copy(normalizedX = normalizedX, normalizedY = normalizedY)
        } else {
            element
        }
    }
    return copy(
        placementsByTarget = placementsByTarget + (target to updated),
        selectedElementId = elementId,
    ).withoutTargetApproval(target)
}

fun V2ElementPlacementState.withRemovedElement(
    target: V2LayoutTarget,
    elementId: String,
): V2ElementPlacementState =
    copy(
        placementsByTarget = placementsByTarget + (target to placementsFor(target).filterNot { it.id == elementId }),
        selectedElementId = if (selectedElementId == elementId) null else selectedElementId,
    ).withoutTargetApproval(target)

fun V2DraftState.withReconciledGeneralTankInfo(updatedInfo: V2GeneralTankInfo): V2DraftState {
    val normalizedInfo = updatedInfo.normalizedRoofPresence()
    val roofAwareScope = layoutScope.copy(
        externalRoof = layoutScope.externalRoof && normalizedInfo.hasExternalRoof(),
        internalRoof = layoutScope.internalRoof && normalizedInfo.hasInternalRoof(),
    )
    return copy(generalTankInfo = normalizedInfo).withReconciledLayoutScope(roofAwareScope)
}

fun V2DraftState.withReconciledLayoutScope(updatedScope: V2LayoutScope): V2DraftState {
    val visibleTargets = updatedScope.selectedTargets()
    val visibleTargetSet = visibleTargets.toSet()
    val removedTargets = V2LayoutTarget.entries.toSet() - visibleTargetSet
    return copy(
        layoutScope = updatedScope,
        layoutMapSetup = layoutMapSetup
            .copy(approvedTargets = layoutMapSetup.approvedTargets.intersect(visibleTargetSet))
            .withFirstAvailableTarget(visibleTargets),
        elementSetup = elementSetup.constrainedTo(visibleTargetSet),
        utSetup = utSetup.constrainedTo(visibleTargetSet),
    )
        .withoutElementPlacementFor(removedTargets)
        .withoutUtDataFor(removedTargets)
        .withoutFindingDataFor(removedTargets)
}

fun V2DraftState.withReconciledLayoutMapSetup(updatedSetup: V2LayoutMapSetup): V2DraftState {
    val visibleTargets = layoutScope.selectedTargets()
    val visibleTargetSet = visibleTargets.toSet()
    val constrainedSetup = updatedSetup
        .copy(approvedTargets = updatedSetup.approvedTargets.intersect(visibleTargetSet))
        .withFirstAvailableTarget(visibleTargets)
    val invalidatedTargets = layoutMapSetup.approvedTargets - constrainedSetup.approvedTargets
    return copy(layoutMapSetup = constrainedSetup)
        .withoutElementPlacementFor(invalidatedTargets)
        .withoutUtDataFor(invalidatedTargets)
        .withoutFindingDataFor(invalidatedTargets)
        .withoutElementApprovalFor(invalidatedTargets)
}

fun V2DraftState.withReconciledElementSetup(updatedSetup: V2ElementSetup): V2DraftState {
    val approvedLayoutTargets = layoutScope.selectedTargets()
        .filter { target -> target in layoutMapSetup.approvedTargets }
        .toSet()
    val selectedElementTargets = updatedSetup.selectedTargets()
        .filter { target -> target in approvedLayoutTargets }
        .toSet()
    val removedElementTargets = V2LayoutTarget.entries.toSet() - selectedElementTargets
    return copy(elementSetup = updatedSetup.constrainedTo(approvedLayoutTargets))
        .withoutElementPlacementFor(removedElementTargets)
        .withoutElementUtEntriesForRemovedPlacements()
        .withoutElementFindingsForRemovedPlacements()
}

fun V2DraftState.withReconciledElementPlacement(updatedPlacement: V2ElementPlacementState): V2DraftState {
    val typeChangedElementKeys = elementPlacement.typeChangedElementKeysComparedTo(updatedPlacement)
    val approvalChangedTargets = V2LayoutTarget.entries.filter { target ->
        elementPlacement.hasUtRelevantPlacementChange(target, updatedPlacement)
    }.toSet()
    return copy(elementPlacement = updatedPlacement)
        .withSynchronizedElementLabels()
        .withoutUtApprovalFor(approvalChangedTargets)
        .withoutElementUtDataForKeys(typeChangedElementKeys)
        .withoutElementUtEntriesForRemovedPlacements()
        .withoutElementFindingsForRemovedPlacements()
}

fun V2DraftState.withReconciledUtSetup(updatedSetup: V2UtSetup): V2DraftState {
    val approvedLayoutTargets = layoutScope.selectedTargets()
        .filter { target -> target in layoutMapSetup.approvedTargets }
        .toSet()
    val selectedUtTargets = updatedSetup.selectedTargets()
        .filter { target -> target in approvedLayoutTargets }
        .toSet()
    val removedUtTargets = V2LayoutTarget.entries.toSet() - selectedUtTargets
    return copy(utSetup = updatedSetup.constrainedTo(approvedLayoutTargets))
        .withoutUtDataFor(removedUtTargets)
        .withoutFindingDataFor(removedUtTargets)
}

private fun V2DraftState.withoutElementApprovalFor(targets: Set<V2LayoutTarget>): V2DraftState {
    if (targets.isEmpty()) return this
    return copy(
        elementPlacement = elementPlacement.copy(
            approvedTargets = elementPlacement.approvedTargets - targets,
        ),
    )
}

private fun V2DraftState.withoutElementPlacementFor(targets: Set<V2LayoutTarget>): V2DraftState {
    if (targets.isEmpty()) return this
    val nextPlacements = elementPlacement.placementsByTarget.filterKeys { target -> target !in targets }
    val selectedElementStillExists = nextPlacements.values.flatten().any { element ->
        element.id == elementPlacement.selectedElementId
    }
    return copy(
        elementPlacement = elementPlacement.copy(
            selectedTarget = if (elementPlacement.selectedTarget in targets) {
                nextPlacements.keys.firstOrNull() ?: V2LayoutTarget.EXTERNAL_ROOF
            } else {
                elementPlacement.selectedTarget
            },
            selectedElementId = elementPlacement.selectedElementId.takeIf { selectedElementStillExists },
            placementsByTarget = nextPlacements,
            approvedTargets = elementPlacement.approvedTargets - targets,
        ),
    )
}

private fun V2DraftState.withoutUtApprovalFor(targets: Set<V2LayoutTarget>): V2DraftState {
    if (targets.isEmpty()) return this
    return copy(
        utMeasurements = utMeasurements.copy(
            approvedTargets = utMeasurements.approvedTargets - targets,
        ),
    )
}

private fun V2DraftState.withoutUtDataFor(targets: Set<V2LayoutTarget>): V2DraftState {
    if (targets.isEmpty()) return this
    val nextEntries = utMeasurements.entriesByItemKey.filterValues { entry -> entry.target !in targets }
    val activeItemKey = utMeasurements.activeItemKey.takeIf { key -> key in nextEntries }
    return copy(
        utMeasurements = utMeasurements.copy(
            selectedTarget = if (utMeasurements.selectedTarget in targets) {
                nextEntries.values.firstOrNull()?.target ?: V2LayoutTarget.EXTERNAL_ROOF
            } else {
                utMeasurements.selectedTarget
            },
            activeItemKey = activeItemKey,
            entriesByItemKey = nextEntries,
            approvedTargets = utMeasurements.approvedTargets - targets,
        ),
    )
}

private fun V2DraftState.withSynchronizedElementLabels(): V2DraftState {
    val labelByItemKey = elementPlacement.placementsByTarget.flatMap { (target, placements) ->
        placements.map { element -> elementUtItemKey(target, element.id) to element.label }
    }.toMap()
    if (labelByItemKey.isEmpty()) return this
    return copy(
        utMeasurements = utMeasurements.copy(
            entriesByItemKey = utMeasurements.entriesByItemKey.mapValues { (key, entry) ->
                labelByItemKey[key]?.let { label -> entry.copy(itemLabel = label) } ?: entry
            },
        ),
        findingState = findingState.copy(
            findingsByItemKey = findingState.findingsByItemKey.mapValues { (key, finding) ->
                labelByItemKey[key]?.let { label -> finding.copy(itemLabel = label) } ?: finding
            },
        ),
    )
}

private fun V2DraftState.withoutElementUtDataForKeys(elementKeys: Set<String>): V2DraftState {
    if (elementKeys.isEmpty()) return this
    val nextEntries = utMeasurements.entriesByItemKey.filterValues { entry ->
        entry.itemKey !in elementKeys
    }
    val nextFindings = findingState.findingsByItemKey.filterValues { finding ->
        finding.itemKey !in elementKeys
    }
    return copy(
        utMeasurements = utMeasurements.copy(
            activeItemKey = utMeasurements.activeItemKey.takeIf { key -> key in nextEntries },
            entriesByItemKey = nextEntries,
        ),
        findingState = findingState.copy(
            activeItemKey = findingState.activeItemKey.takeIf { key -> key in nextFindings },
            findingsByItemKey = nextFindings,
        ),
    )
}

private fun V2DraftState.withoutFindingDataFor(targets: Set<V2LayoutTarget>): V2DraftState {
    if (targets.isEmpty()) return this
    val nextFindings = findingState.findingsByItemKey.filterValues { finding -> finding.target !in targets }
    return copy(
        findingState = findingState.copy(
            activeItemKey = findingState.activeItemKey.takeIf { key -> key in nextFindings },
            findingsByItemKey = nextFindings,
        ),
    )
}

private fun V2DraftState.withoutElementUtEntriesForRemovedPlacements(): V2DraftState {
    val validElementKeys = elementPlacement.placementsByTarget.flatMap { (target, placements) ->
        placements.map { element -> elementUtItemKey(target, element.id) }
    }.toSet()
    val removedEntryTargets = mutableSetOf<V2LayoutTarget>()
    val nextEntries = utMeasurements.entriesByItemKey.filterValues { entry ->
        val keep = entry.kind != V2UtItemKind.ELEMENT || entry.itemKey in validElementKeys
        if (!keep) removedEntryTargets += entry.target
        keep
    }
    if (nextEntries.size == utMeasurements.entriesByItemKey.size && removedEntryTargets.isEmpty()) return this
    return copy(
        utMeasurements = utMeasurements.copy(
            activeItemKey = utMeasurements.activeItemKey.takeIf { key -> key in nextEntries },
            entriesByItemKey = nextEntries,
            approvedTargets = utMeasurements.approvedTargets - removedEntryTargets,
        ),
    )
}

private fun V2DraftState.withoutElementFindingsForRemovedPlacements(): V2DraftState {
    val validElementKeys = elementPlacement.placementsByTarget.flatMap { (target, placements) ->
        placements.map { element -> elementUtItemKey(target, element.id) }
    }.toSet()
    val nextFindings = findingState.findingsByItemKey.filterValues { finding ->
        finding.itemKind != V2UtItemKind.ELEMENT || finding.itemKey in validElementKeys
    }
    if (nextFindings.size == findingState.findingsByItemKey.size) return this
    return copy(
        findingState = findingState.copy(
            activeItemKey = findingState.activeItemKey.takeIf { key -> key in nextFindings },
            findingsByItemKey = nextFindings,
        ),
    )
}

private fun V2ElementSetup.constrainedTo(targets: Set<V2LayoutTarget>): V2ElementSetup =
    copy(
        externalRoof = externalRoof && V2LayoutTarget.EXTERNAL_ROOF in targets,
        internalRoof = internalRoof && V2LayoutTarget.INTERNAL_ROOF in targets,
        shell = shell && V2LayoutTarget.SHELL in targets,
        floor = floor && V2LayoutTarget.FLOOR in targets,
    )

private fun V2UtSetup.constrainedTo(targets: Set<V2LayoutTarget>): V2UtSetup =
    copy(
        externalRoof = externalRoof && V2LayoutTarget.EXTERNAL_ROOF in targets,
        internalRoof = internalRoof && V2LayoutTarget.INTERNAL_ROOF in targets,
        shell = shell && V2LayoutTarget.SHELL in targets,
        floor = floor && V2LayoutTarget.FLOOR in targets,
    )

private fun elementUtItemKey(target: V2LayoutTarget, elementId: String): String =
    "${target.key}:element:$elementId"

private fun V2ElementPlacementState.typeChangedElementKeysComparedTo(
    next: V2ElementPlacementState,
): Set<String> =
    V2LayoutTarget.entries.flatMap { target ->
        val oldById = placementsFor(target).associateBy { element -> element.id }
        val nextById = next.placementsFor(target).associateBy { element -> element.id }
        oldById.mapNotNull { (elementId, oldElement) ->
            val nextElement = nextById[elementId] ?: return@mapNotNull null
            elementUtItemKey(target, elementId).takeIf { oldElement.type != nextElement.type }
        }
    }.toSet()

private fun V2ElementPlacementState.hasUtRelevantPlacementChange(
    target: V2LayoutTarget,
    next: V2ElementPlacementState,
): Boolean {
    val oldById = placementsFor(target).associateBy { element -> element.id }
    val nextById = next.placementsFor(target).associateBy { element -> element.id }
    if (oldById.keys != nextById.keys) return true
    return oldById.any { (elementId, oldElement) ->
        val nextElement = nextById[elementId] ?: return@any true
        oldElement.type != nextElement.type
    }
}

fun V2LayoutMapSetup.withFirstAvailableTarget(targets: List<V2LayoutTarget>): V2LayoutMapSetup {
    if (targets.isEmpty() || selectedTarget in targets) return this
    return withSelectedTarget(targets.first())
}

fun V2LayoutMapSetup.withRoofPatternDefaults(pattern: RoofTemplate): V2LayoutMapSetup =
    when (pattern) {
        RoofTemplate.CONE_RADIAL -> copy(
            roofPattern = pattern,
            roofRingCount = "1",
            roofSectorCount = "20",
            roofHasCenterOpening = true,
            roofCenterOpeningPlateCount = "1",
        ).withoutTargetApproval(selectedTarget)
        RoofTemplate.UMBRELLA_RADIAL -> copy(
            roofPattern = pattern,
            roofRingCount = "4",
            roofSectorCount = "24",
            roofHasCenterOpening = false,
        ).withoutTargetApproval(selectedTarget)
        RoofTemplate.CIRCULAR_PLATE -> copy(
            roofPattern = pattern,
            roofRowCount = "4",
            roofWidestRowPlateCount = "10",
            roofHasAnnularRing = true,
            roofAnnularSectionCount = "12",
            roofHasCenterOpening = false,
        ).withoutTargetApproval(selectedTarget)
        RoofTemplate.CIRCULAR_CENTER_OPENING -> copy(
            roofPattern = RoofTemplate.CIRCULAR_PLATE,
            roofRowCount = "4",
            roofWidestRowPlateCount = "10",
            roofHasCenterOpening = true,
            roofCenterOpeningPlateCount = "1",
            roofHasAnnularRing = true,
            roofAnnularSectionCount = "12",
        ).withoutTargetApproval(selectedTarget)
    }

fun V2LayoutMapSetup.toRoofLayoutMap(): V2RoofLayoutMap =
    V2RoofLayoutMap(
        roofScope = roofScope,
        referenceMode = referenceMode,
        rotationDirection = rotationDirection,
        template = roofPattern,
        rowCount = roofRowCount,
        widestRowPlateCount = roofWidestRowPlateCount,
        ringCount = roofRingCount,
        sectorCount = roofSectorCount,
        hasCenterOpening = roofHasCenterOpening,
        centerOpeningPlateCount = roofCenterOpeningPlateCount,
        hasAnnularRing = roofHasAnnularRing,
        annularSectionCount = roofAnnularSectionCount,
    )

fun V2RoofLayoutMap.withRoofScopeDefaults(scope: V2RoofScope): V2RoofLayoutMap {
    val nextTemplate = if (scope == V2RoofScope.INTERNAL) {
        RoofTemplate.CIRCULAR_PLATE
    } else {
        RoofTemplate.CONE_RADIAL
    }
    return copy(roofScope = scope).withTemplateDefaults(nextTemplate)
}

fun V2RoofLayoutMap.withTemplateDefaults(template: RoofTemplate): V2RoofLayoutMap =
    when (template) {
        RoofTemplate.CIRCULAR_PLATE -> copy(
            template = template,
            rowCount = "5",
            widestRowPlateCount = "14",
            hasCenterOpening = false,
            hasAnnularRing = true,
            annularSectionCount = "18",
        )
        RoofTemplate.CIRCULAR_CENTER_OPENING -> copy(
            template = RoofTemplate.CIRCULAR_PLATE,
            rowCount = "5",
            widestRowPlateCount = "14",
            hasCenterOpening = true,
            centerOpeningPlateCount = "1",
            hasAnnularRing = true,
            annularSectionCount = "18",
        )
        RoofTemplate.CONE_RADIAL -> copy(
            template = template,
            ringCount = "6",
            sectorCount = "18",
            hasCenterOpening = true,
            centerOpeningPlateCount = "1",
        )
        RoofTemplate.UMBRELLA_RADIAL -> copy(
            template = template,
            ringCount = "8",
            sectorCount = "20",
            hasCenterOpening = false,
        )
    }

fun V2DraftState.tankBadgeLabel(): String =
    generalTankInfo.tankNumber.ifBlank { "Tank" }

fun V2DraftState.roofSummaryLabel(): String =
    when (layoutMapSetup.roofPattern) {
        RoofTemplate.CIRCULAR_PLATE,
        RoofTemplate.CIRCULAR_CENTER_OPENING -> "Circular Plate"
        RoofTemplate.UMBRELLA_RADIAL -> "Umbrella Radial"
        RoofTemplate.CONE_RADIAL -> "Cone Radial"
    }

fun defaultV2PreviewDraftState(): V2DraftState =
    V2DraftState(
        generalTankInfo = V2GeneralTankInfo(),
        layoutScope = V2LayoutScope(
            externalRoof = true,
            internalRoof = false,
            shell = true,
            floor = false,
        ),
        layoutMapSetup = defaultV2LayoutMapSetup(),
        elementSetup = V2ElementSetup(
            externalRoof = true,
            internalRoof = false,
            shell = true,
            floor = false,
        ),
        elementPlacement = defaultV2ElementPlacementState(),
        utSetup = V2UtSetup(
            externalRoof = true,
            internalRoof = false,
            shell = true,
            floor = false,
        ),
        utMeasurements = V2UtMeasurementState(),
        inspectionChecklist = V2InspectionChecklistState(),
        findingState = V2FindingState(),
        roofLayoutMap = defaultV2RoofLayoutMap(),
    )

private fun defaultV2LayoutMapSetup(): V2LayoutMapSetup =
    V2LayoutMapSetup(
        referenceNote = "Refer to the plant north marker near the stair landing.",
    ).withRoofPatternDefaults(RoofTemplate.CONE_RADIAL)

private fun defaultV2ElementPlacementState(): V2ElementPlacementState =
    V2ElementPlacementState()

private fun defaultV2RoofLayoutMap(): V2RoofLayoutMap =
    V2RoofLayoutMap().withTemplateDefaults(RoofTemplate.CONE_RADIAL)

private fun String.extractFirstDecimalToken(): String? =
    Regex("""\d+(?:\.\d+)?""")
        .find(this)
        ?.value

private fun String.extractFirstIntegerToken(): String? =
    Regex("""\d+""")
        .find(this)
        ?.value

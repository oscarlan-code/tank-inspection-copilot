package ai.laiq.tankinspection.v3product.model

import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.domain.model.RotationDirection
import ai.laiq.tankinspection.presentation.GeneralTankInfoFormState

enum class ProductLayoutSurface(val key: String, val label: String) {
    ROOF("roof", "Roof"),
    SHELL("shell", "Shell"),
    FLOOR("floor", "Floor"),
}

enum class ProductLayoutTarget(
    val key: String,
    val label: String,
    val surface: ProductLayoutSurface,
    val roofScope: ProductRoofScope? = null,
) {
    EXTERNAL_ROOF("external_roof", "External Roof", ProductLayoutSurface.ROOF, ProductRoofScope.EXTERNAL),
    INTERNAL_ROOF("internal_roof", "Internal Roof", ProductLayoutSurface.ROOF, ProductRoofScope.INTERNAL),
    SHELL("shell", "Shell", ProductLayoutSurface.SHELL),
    FLOOR("floor", "Floor", ProductLayoutSurface.FLOOR),
}

enum class ProductRoofScope(val key: String, val label: String) {
    EXTERNAL("external", "External Roof"),
    INTERNAL("internal", "Internal Roof"),
}

enum class ProductReferenceMode(val key: String, val label: String) {
    TANK_NORTH("tank_north", "Tank North"),
    TRUE_NORTH("true_north", "True North"),
}

enum class ProductFloorTemplate(val key: String, val label: String) {
    CIRCULAR_PLATE("circular_plate", "Circular Plate"),
    CIRCULAR_PLATE_WITH_AR("circular_plate_ar", "Circular Plate + AR"),
}

enum class ProductShellOffsetStartRow(val key: String, val label: String) {
    ODD("odd", "Odd Courses"),
    EVEN("even", "Even Courses"),
}

enum class ProductShellThirdOffsetStart(val key: String, val label: String) {
    FULL("full", "Full"),
    ONE_THIRD("one_third", "1/3"),
    TWO_THIRDS("two_thirds", "2/3"),
}

data class ProductGeneralTankInfo(
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

fun ProductGeneralTankInfo.hasExternalRoof(): Boolean =
    externalRoofType.toRoofPresence()

fun ProductGeneralTankInfo.hasInternalRoof(): Boolean =
    internalRoofType.toRoofPresence()

fun ProductGeneralTankInfo.normalizedRoofPresence(): ProductGeneralTankInfo =
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

data class ProductLayoutScope(
    val externalRoof: Boolean = true,
    val internalRoof: Boolean = false,
    val shell: Boolean = true,
    val floor: Boolean = false,
)

data class ProductElementSetup(
    val externalRoof: Boolean = true,
    val internalRoof: Boolean = true,
    val shell: Boolean = true,
    val floor: Boolean = true,
)

data class ProductUtSetup(
    val externalRoof: Boolean = true,
    val internalRoof: Boolean = true,
    val shell: Boolean = true,
    val floor: Boolean = true,
)

enum class ProductUtItemKind {
    LAYOUT_REGION,
    ELEMENT,
}

data class ProductUtMeasurementEntry(
    val itemKey: String,
    val target: ProductLayoutTarget,
    val itemLabel: String,
    val kind: ProductUtItemKind,
    val elementType: ProductElementType? = null,
    val nozzleSize: String = "6 in",
    val reinforcementPadReading: String = "",
    val readings: List<String> = emptyList(),
    val confirmed: Boolean = false,
)

data class ProductUtMeasurementState(
    val selectedTarget: ProductLayoutTarget = ProductLayoutTarget.EXTERNAL_ROOF,
    val activeItemKey: String? = null,
    val entriesByItemKey: Map<String, ProductUtMeasurementEntry> = emptyMap(),
    val approvedTargets: Set<ProductLayoutTarget> = emptySet(),
)

data class ProductFindingState(
    val activeItemKey: String? = null,
    val findingsByItemKey: Map<String, ProductFindingRecord> = emptyMap(),
)

data class ProductFindingRecord(
    val itemKey: String,
    val target: ProductLayoutTarget,
    val itemLabel: String,
    val itemKind: ProductUtItemKind,
    val elementType: ProductElementType? = null,
    val note: String = "",
    val photos: List<ProductFindingPhoto> = emptyList(),
    val selectedPhotoId: String? = null,
)

data class ProductFindingPhoto(
    val id: String,
    val relativePath: String,
    val displayName: String,
    val annotationStrokes: List<ProductAnnotationStroke> = emptyList(),
)

data class ProductAnnotationStroke(
    val points: List<ProductAnnotationPoint>,
)

data class ProductAnnotationPoint(
    val x: Float,
    val y: Float,
)

data class ProductVoiceNote(
    val id: String,
    val relativePath: String,
    val displayName: String,
    val screenKey: String,
    val screenLabel: String,
    val cardKey: String,
    val fieldKey: String,
    val targetKey: String? = null,
    val targetLabel: String? = null,
    val itemKey: String? = null,
    val itemLabel: String? = null,
    val transcriptStatus: String = "pending_server",
    val transcriptText: String = "",
    val durationMs: Long? = null,
    val capturedAtIso: String,
)

enum class ProductElementType(
    val key: String,
    val label: String,
    val shortLabel: String,
    val surfaces: Set<ProductLayoutSurface>,
) {
    NOZZLE("nozzle", "Nozzle", "NZ", setOf(ProductLayoutSurface.ROOF, ProductLayoutSurface.SHELL)),
    MANHOLE("manhole", "Manhole", "MH", setOf(ProductLayoutSurface.ROOF, ProductLayoutSurface.SHELL, ProductLayoutSurface.FLOOR)),
    STAIR("stair", "Stair / Staircase", "ST", setOf(ProductLayoutSurface.SHELL)),
    PLATFORM("platform", "Platform", "PF", setOf(ProductLayoutSurface.ROOF, ProductLayoutSurface.SHELL)),
    VENT("vent", "Vent", "VT", setOf(ProductLayoutSurface.ROOF)),
    GAUGE_HATCH("gauge_hatch", "Gauge Hatch", "GH", setOf(ProductLayoutSurface.ROOF, ProductLayoutSurface.SHELL)),
    ROOF_DRAIN("roof_drain", "Roof Drain", "RD", setOf(ProductLayoutSurface.ROOF)),
    SUPPORT("support", "Support", "SP", setOf(ProductLayoutSurface.ROOF)),
    SUMP("sump", "Sump", "SU", setOf(ProductLayoutSurface.FLOOR)),
    DATUM("datum", "Reference / Datum", "RF", setOf(ProductLayoutSurface.SHELL, ProductLayoutSurface.FLOOR)),
}

fun ProductElementType.requiresUtMeasurement(): Boolean =
    this == ProductElementType.NOZZLE || this == ProductElementType.MANHOLE

fun ProductUtMeasurementEntry.requiresElementUt(): Boolean =
    kind == ProductUtItemKind.ELEMENT && elementType?.requiresUtMeasurement() == true

data class ProductPlacedElement(
    val id: String,
    val label: String,
    val type: ProductElementType,
    val normalizedX: Float,
    val normalizedY: Float,
)

data class ProductElementPlacementState(
    val selectedTarget: ProductLayoutTarget = ProductLayoutTarget.EXTERNAL_ROOF,
    val selectedElementType: ProductElementType = ProductElementType.NOZZLE,
    val selectedElementId: String? = null,
    val placementsByTarget: Map<ProductLayoutTarget, List<ProductPlacedElement>> = emptyMap(),
    val approvedTargets: Set<ProductLayoutTarget> = emptySet(),
    val nextElementIndexByTargetAndType: Map<String, Int> = emptyMap(),
)

data class ProductLayoutMapSetup(
    val selectedTarget: ProductLayoutTarget = ProductLayoutTarget.EXTERNAL_ROOF,
    val selectedSurface: ProductLayoutSurface = ProductLayoutSurface.ROOF,
    val roofScope: ProductRoofScope = ProductRoofScope.EXTERNAL,
    val referenceMode: ProductReferenceMode = ProductReferenceMode.TANK_NORTH,
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
    val shellOffsetStartRow: ProductShellOffsetStartRow = ProductShellOffsetStartRow.EVEN,
    val shellThirdOffsetStart: ProductShellThirdOffsetStart = ProductShellThirdOffsetStart.FULL,
    val selectedShellLaneIndex: Int? = null,
    val selectedShellPlateId: String? = null,
    val floorTemplate: ProductFloorTemplate = ProductFloorTemplate.CIRCULAR_PLATE_WITH_AR,
    val floorPlateCount: String = "18",
    val floorAnnularSectionCount: String = "12",
    val floorPatternCountX: String = "4",
    val floorPatternCountY: String = "12",
    val approvedTargets: Set<ProductLayoutTarget> = emptySet(),
)

data class ProductRoofLayoutMap(
    val roofScope: ProductRoofScope = ProductRoofScope.EXTERNAL,
    val referenceMode: ProductReferenceMode = ProductReferenceMode.TANK_NORTH,
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

data class ProductDraftState(
    val generalTankInfo: ProductGeneralTankInfo = ProductGeneralTankInfo(),
    val layoutScope: ProductLayoutScope = ProductLayoutScope(),
    val layoutMapSetup: ProductLayoutMapSetup = defaultProductLayoutMapSetup(),
    val elementSetup: ProductElementSetup = ProductElementSetup(),
    val elementPlacement: ProductElementPlacementState = defaultProductElementPlacementState(),
    val utSetup: ProductUtSetup = ProductUtSetup(),
    val utMeasurements: ProductUtMeasurementState = ProductUtMeasurementState(),
    val inspectionChecklist: ProductInspectionChecklistState = ProductInspectionChecklistState(),
    val findingState: ProductFindingState = ProductFindingState(),
    val roofLayoutMap: ProductRoofLayoutMap = defaultProductRoofLayoutMap(),
    val voiceNotes: List<ProductVoiceNote> = emptyList(),
)

fun ProductGeneralTankInfo.requiredValidationErrors(): List<String> {
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

fun ProductGeneralTankInfo.toLegacyFormState(): GeneralTankInfoFormState =
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

fun GeneralTankInfoFormState.toProductGeneralTankInfo(): ProductGeneralTankInfo =
    ProductGeneralTankInfo(
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

fun ProductFindingRecord.withPhoto(photo: ProductFindingPhoto): ProductFindingRecord =
    copy(
        photos = photos + photo,
        selectedPhotoId = photo.id,
    )

fun ProductFindingRecord.withSelectedPhoto(photoId: String?): ProductFindingRecord =
    copy(selectedPhotoId = photoId)

fun ProductFindingRecord.withPhotoAnnotations(
    photoId: String,
    strokes: List<ProductAnnotationStroke>,
): ProductFindingRecord =
    copy(
        photos = photos.map { photo ->
            if (photo.id == photoId) photo.copy(annotationStrokes = strokes) else photo
        },
        selectedPhotoId = photoId,
    )

fun ProductFindingRecord.withRemovedPhoto(photoId: String): ProductFindingRecord {
    val nextPhotos = photos.filterNot { photo -> photo.id == photoId }
    return copy(
        photos = nextPhotos,
        selectedPhotoId = selectedPhotoId
            .takeIf { selected -> selected != photoId && nextPhotos.any { photo -> photo.id == selected } }
            ?: nextPhotos.lastOrNull()?.id,
    )
}

fun ProductFindingRecord.withReplacedPhoto(
    photoId: String,
    replacement: ProductFindingPhoto,
): ProductFindingRecord =
    copy(
        photos = photos.map { photo ->
            if (photo.id == photoId) replacement else photo
        },
        selectedPhotoId = replacement.id,
    )

fun ProductFindingState.withActiveFinding(record: ProductFindingRecord): ProductFindingState =
    copy(
        activeItemKey = record.itemKey,
        findingsByItemKey = findingsByItemKey + (record.itemKey to record),
    )

fun ProductFindingRecord.hasCapturedEvidence(): Boolean =
    note.isNotBlank() || photos.isNotEmpty()

fun ProductFindingState.withSavedFinding(record: ProductFindingRecord): ProductFindingState =
    if (record.hasCapturedEvidence()) {
        withActiveFinding(record)
    } else {
        withRemovedFinding(record.itemKey)
    }

fun ProductFindingState.withRemovedFinding(itemKey: String): ProductFindingState =
    copy(
        activeItemKey = activeItemKey.takeIf { activeKey -> activeKey != itemKey },
        findingsByItemKey = findingsByItemKey - itemKey,
    )

fun ProductLayoutMapSetup.withSelectedSurface(surface: ProductLayoutSurface): ProductLayoutMapSetup =
    copy(selectedSurface = surface)

fun ProductLayoutMapSetup.withSelectedTarget(target: ProductLayoutTarget): ProductLayoutMapSetup =
    copy(
        selectedTarget = target,
        selectedSurface = target.surface,
        roofScope = target.roofScope ?: roofScope,
    )

fun ProductLayoutMapSetup.withTargetApproval(target: ProductLayoutTarget, approved: Boolean): ProductLayoutMapSetup =
    copy(
        approvedTargets = if (approved) approvedTargets + target else approvedTargets - target,
    )

fun ProductLayoutMapSetup.withoutTargetApproval(target: ProductLayoutTarget): ProductLayoutMapSetup =
    withTargetApproval(target, approved = false)

fun ProductLayoutMapSetup.withoutAllTargetApprovals(): ProductLayoutMapSetup =
    copy(approvedTargets = emptySet())

fun ProductLayoutScope.selectedTargets(): List<ProductLayoutTarget> =
    buildList {
        if (externalRoof) add(ProductLayoutTarget.EXTERNAL_ROOF)
        if (internalRoof) add(ProductLayoutTarget.INTERNAL_ROOF)
        if (shell) add(ProductLayoutTarget.SHELL)
        if (floor) add(ProductLayoutTarget.FLOOR)
    }

fun ProductElementSetup.selectedTargets(): List<ProductLayoutTarget> =
    buildList {
        if (externalRoof) add(ProductLayoutTarget.EXTERNAL_ROOF)
        if (internalRoof) add(ProductLayoutTarget.INTERNAL_ROOF)
        if (shell) add(ProductLayoutTarget.SHELL)
        if (floor) add(ProductLayoutTarget.FLOOR)
    }

fun ProductUtSetup.selectedTargets(): List<ProductLayoutTarget> =
    buildList {
        if (externalRoof) add(ProductLayoutTarget.EXTERNAL_ROOF)
        if (internalRoof) add(ProductLayoutTarget.INTERNAL_ROOF)
        if (shell) add(ProductLayoutTarget.SHELL)
        if (floor) add(ProductLayoutTarget.FLOOR)
    }

fun ProductElementType.supports(target: ProductLayoutTarget): Boolean =
    target.surface in surfaces

fun ProductElementPlacementState.placementsFor(target: ProductLayoutTarget): List<ProductPlacedElement> =
    placementsByTarget[target].orEmpty()

fun ProductElementPlacementState.withFirstAvailableTarget(targets: List<ProductLayoutTarget>): ProductElementPlacementState {
    if (targets.isEmpty() || selectedTarget in targets) return this
    return copy(selectedTarget = targets.first(), selectedElementId = null)
}

fun ProductUtMeasurementState.withFirstAvailableTarget(targets: List<ProductLayoutTarget>): ProductUtMeasurementState {
    if (targets.isEmpty() || selectedTarget in targets) return this
    return copy(selectedTarget = targets.first(), activeItemKey = null)
}

fun ProductUtMeasurementState.withSelectedTarget(target: ProductLayoutTarget): ProductUtMeasurementState =
    copy(selectedTarget = target, activeItemKey = null)

fun ProductUtMeasurementState.withSelectedEntry(entry: ProductUtMeasurementEntry): ProductUtMeasurementState =
    copy(
        activeItemKey = entry.itemKey,
        entriesByItemKey = if (entry.itemKey in entriesByItemKey) {
            entriesByItemKey
        } else {
            entriesByItemKey + (entry.itemKey to entry)
        },
    )

fun ProductUtMeasurementState.withUpdatedEntry(entry: ProductUtMeasurementEntry): ProductUtMeasurementState =
    copy(
        activeItemKey = null,
        entriesByItemKey = entriesByItemKey + (entry.itemKey to entry),
    ).withoutTargetApproval(entry.target)

fun ProductUtMeasurementState.withClearedActiveItem(): ProductUtMeasurementState =
    copy(activeItemKey = null)

fun ProductUtMeasurementState.withTargetApproval(
    target: ProductLayoutTarget,
    approved: Boolean,
): ProductUtMeasurementState =
    copy(
        approvedTargets = if (approved) approvedTargets + target else approvedTargets - target,
    )

fun ProductUtMeasurementState.withoutTargetApproval(target: ProductLayoutTarget): ProductUtMeasurementState =
    withTargetApproval(target, approved = false)

fun ProductElementPlacementState.withSelectedTarget(target: ProductLayoutTarget): ProductElementPlacementState =
    copy(selectedTarget = target, selectedElementId = null)

fun ProductElementPlacementState.withSelectedElementType(type: ProductElementType): ProductElementPlacementState =
    copy(selectedElementType = type)

fun ProductElementPlacementState.withSelectedElement(id: String?): ProductElementPlacementState =
    copy(selectedElementId = id)

fun ProductElementPlacementState.withRenamedElement(
    target: ProductLayoutTarget,
    elementId: String,
    label: String,
): ProductElementPlacementState {
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

fun ProductElementPlacementState.withTargetApproval(
    target: ProductLayoutTarget,
    approved: Boolean,
): ProductElementPlacementState =
    copy(
        approvedTargets = if (approved) approvedTargets + target else approvedTargets - target,
    )

fun ProductElementPlacementState.withoutTargetApproval(target: ProductLayoutTarget): ProductElementPlacementState =
    withTargetApproval(target, approved = false)

fun ProductElementPlacementState.withPlacedElement(
    target: ProductLayoutTarget,
    type: ProductElementType,
    normalizedX: Float,
    normalizedY: Float,
): ProductElementPlacementState {
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
    val nextElement = ProductPlacedElement(
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

fun ProductElementPlacementState.withMovedElement(
    target: ProductLayoutTarget,
    elementId: String,
    normalizedX: Float,
    normalizedY: Float,
): ProductElementPlacementState {
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

fun ProductElementPlacementState.withRemovedElement(
    target: ProductLayoutTarget,
    elementId: String,
): ProductElementPlacementState =
    copy(
        placementsByTarget = placementsByTarget + (target to placementsFor(target).filterNot { it.id == elementId }),
        selectedElementId = if (selectedElementId == elementId) null else selectedElementId,
    ).withoutTargetApproval(target)

fun ProductDraftState.withReconciledGeneralTankInfo(updatedInfo: ProductGeneralTankInfo): ProductDraftState {
    val normalizedInfo = updatedInfo.normalizedRoofPresence()
    val roofAwareScope = layoutScope.copy(
        externalRoof = layoutScope.externalRoof && normalizedInfo.hasExternalRoof(),
        internalRoof = layoutScope.internalRoof && normalizedInfo.hasInternalRoof(),
    )
    return copy(generalTankInfo = normalizedInfo).withReconciledLayoutScope(roofAwareScope)
}

fun ProductDraftState.withReconciledLayoutScope(updatedScope: ProductLayoutScope): ProductDraftState {
    val visibleTargets = updatedScope.selectedTargets()
    val visibleTargetSet = visibleTargets.toSet()
    val removedTargets = ProductLayoutTarget.entries.toSet() - visibleTargetSet
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

fun ProductDraftState.withReconciledLayoutMapSetup(updatedSetup: ProductLayoutMapSetup): ProductDraftState {
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

fun ProductDraftState.withReconciledElementSetup(updatedSetup: ProductElementSetup): ProductDraftState {
    val approvedLayoutTargets = layoutScope.selectedTargets()
        .filter { target -> target in layoutMapSetup.approvedTargets }
        .toSet()
    val selectedElementTargets = updatedSetup.selectedTargets()
        .filter { target -> target in approvedLayoutTargets }
        .toSet()
    val removedElementTargets = ProductLayoutTarget.entries.toSet() - selectedElementTargets
    return copy(elementSetup = updatedSetup.constrainedTo(approvedLayoutTargets))
        .withoutElementPlacementFor(removedElementTargets)
        .withoutElementUtEntriesForRemovedPlacements()
        .withoutElementFindingsForRemovedPlacements()
}

fun ProductDraftState.withReconciledElementPlacement(updatedPlacement: ProductElementPlacementState): ProductDraftState {
    val typeChangedElementKeys = elementPlacement.typeChangedElementKeysComparedTo(updatedPlacement)
    val approvalChangedTargets = ProductLayoutTarget.entries.filter { target ->
        elementPlacement.hasUtRelevantPlacementChange(target, updatedPlacement)
    }.toSet()
    return copy(elementPlacement = updatedPlacement)
        .withSynchronizedElementLabels()
        .withoutUtApprovalFor(approvalChangedTargets)
        .withoutElementUtDataForKeys(typeChangedElementKeys)
        .withoutElementUtEntriesForRemovedPlacements()
        .withoutElementFindingsForRemovedPlacements()
}

fun ProductDraftState.withReconciledUtSetup(updatedSetup: ProductUtSetup): ProductDraftState {
    val approvedLayoutTargets = layoutScope.selectedTargets()
        .filter { target -> target in layoutMapSetup.approvedTargets }
        .toSet()
    val selectedUtTargets = updatedSetup.selectedTargets()
        .filter { target -> target in approvedLayoutTargets }
        .toSet()
    val removedUtTargets = ProductLayoutTarget.entries.toSet() - selectedUtTargets
    return copy(utSetup = updatedSetup.constrainedTo(approvedLayoutTargets))
        .withoutUtDataFor(removedUtTargets)
        .withoutFindingDataFor(removedUtTargets)
}

private fun ProductDraftState.withoutElementApprovalFor(targets: Set<ProductLayoutTarget>): ProductDraftState {
    if (targets.isEmpty()) return this
    return copy(
        elementPlacement = elementPlacement.copy(
            approvedTargets = elementPlacement.approvedTargets - targets,
        ),
    )
}

private fun ProductDraftState.withoutElementPlacementFor(targets: Set<ProductLayoutTarget>): ProductDraftState {
    if (targets.isEmpty()) return this
    val nextPlacements = elementPlacement.placementsByTarget.filterKeys { target -> target !in targets }
    val selectedElementStillExists = nextPlacements.values.flatten().any { element ->
        element.id == elementPlacement.selectedElementId
    }
    return copy(
        elementPlacement = elementPlacement.copy(
            selectedTarget = if (elementPlacement.selectedTarget in targets) {
                nextPlacements.keys.firstOrNull() ?: ProductLayoutTarget.EXTERNAL_ROOF
            } else {
                elementPlacement.selectedTarget
            },
            selectedElementId = elementPlacement.selectedElementId.takeIf { selectedElementStillExists },
            placementsByTarget = nextPlacements,
            approvedTargets = elementPlacement.approvedTargets - targets,
        ),
    )
}

private fun ProductDraftState.withoutUtApprovalFor(targets: Set<ProductLayoutTarget>): ProductDraftState {
    if (targets.isEmpty()) return this
    return copy(
        utMeasurements = utMeasurements.copy(
            approvedTargets = utMeasurements.approvedTargets - targets,
        ),
    )
}

private fun ProductDraftState.withoutUtDataFor(targets: Set<ProductLayoutTarget>): ProductDraftState {
    if (targets.isEmpty()) return this
    val nextEntries = utMeasurements.entriesByItemKey.filterValues { entry -> entry.target !in targets }
    val activeItemKey = utMeasurements.activeItemKey.takeIf { key -> key in nextEntries }
    return copy(
        utMeasurements = utMeasurements.copy(
            selectedTarget = if (utMeasurements.selectedTarget in targets) {
                nextEntries.values.firstOrNull()?.target ?: ProductLayoutTarget.EXTERNAL_ROOF
            } else {
                utMeasurements.selectedTarget
            },
            activeItemKey = activeItemKey,
            entriesByItemKey = nextEntries,
            approvedTargets = utMeasurements.approvedTargets - targets,
        ),
    )
}

private fun ProductDraftState.withSynchronizedElementLabels(): ProductDraftState {
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

private fun ProductDraftState.withoutElementUtDataForKeys(elementKeys: Set<String>): ProductDraftState {
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

private fun ProductDraftState.withoutFindingDataFor(targets: Set<ProductLayoutTarget>): ProductDraftState {
    if (targets.isEmpty()) return this
    val nextFindings = findingState.findingsByItemKey.filterValues { finding -> finding.target !in targets }
    return copy(
        findingState = findingState.copy(
            activeItemKey = findingState.activeItemKey.takeIf { key -> key in nextFindings },
            findingsByItemKey = nextFindings,
        ),
    )
}

private fun ProductDraftState.withoutElementUtEntriesForRemovedPlacements(): ProductDraftState {
    val validElementKeys = elementPlacement.placementsByTarget.flatMap { (target, placements) ->
        placements.map { element -> elementUtItemKey(target, element.id) }
    }.toSet()
    val removedEntryTargets = mutableSetOf<ProductLayoutTarget>()
    val nextEntries = utMeasurements.entriesByItemKey.filterValues { entry ->
        val keep = entry.kind != ProductUtItemKind.ELEMENT || entry.itemKey in validElementKeys
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

private fun ProductDraftState.withoutElementFindingsForRemovedPlacements(): ProductDraftState {
    val validElementKeys = elementPlacement.placementsByTarget.flatMap { (target, placements) ->
        placements.map { element -> elementUtItemKey(target, element.id) }
    }.toSet()
    val nextFindings = findingState.findingsByItemKey.filterValues { finding ->
        finding.itemKind != ProductUtItemKind.ELEMENT || finding.itemKey in validElementKeys
    }
    if (nextFindings.size == findingState.findingsByItemKey.size) return this
    return copy(
        findingState = findingState.copy(
            activeItemKey = findingState.activeItemKey.takeIf { key -> key in nextFindings },
            findingsByItemKey = nextFindings,
        ),
    )
}

private fun ProductElementSetup.constrainedTo(targets: Set<ProductLayoutTarget>): ProductElementSetup =
    copy(
        externalRoof = externalRoof && ProductLayoutTarget.EXTERNAL_ROOF in targets,
        internalRoof = internalRoof && ProductLayoutTarget.INTERNAL_ROOF in targets,
        shell = shell && ProductLayoutTarget.SHELL in targets,
        floor = floor && ProductLayoutTarget.FLOOR in targets,
    )

private fun ProductUtSetup.constrainedTo(targets: Set<ProductLayoutTarget>): ProductUtSetup =
    copy(
        externalRoof = externalRoof && ProductLayoutTarget.EXTERNAL_ROOF in targets,
        internalRoof = internalRoof && ProductLayoutTarget.INTERNAL_ROOF in targets,
        shell = shell && ProductLayoutTarget.SHELL in targets,
        floor = floor && ProductLayoutTarget.FLOOR in targets,
    )

private fun elementUtItemKey(target: ProductLayoutTarget, elementId: String): String =
    "${target.key}:element:$elementId"

private fun ProductElementPlacementState.typeChangedElementKeysComparedTo(
    next: ProductElementPlacementState,
): Set<String> =
    ProductLayoutTarget.entries.flatMap { target ->
        val oldById = placementsFor(target).associateBy { element -> element.id }
        val nextById = next.placementsFor(target).associateBy { element -> element.id }
        oldById.mapNotNull { (elementId, oldElement) ->
            val nextElement = nextById[elementId] ?: return@mapNotNull null
            elementUtItemKey(target, elementId).takeIf { oldElement.type != nextElement.type }
        }
    }.toSet()

private fun ProductElementPlacementState.hasUtRelevantPlacementChange(
    target: ProductLayoutTarget,
    next: ProductElementPlacementState,
): Boolean {
    val oldById = placementsFor(target).associateBy { element -> element.id }
    val nextById = next.placementsFor(target).associateBy { element -> element.id }
    if (oldById.keys != nextById.keys) return true
    return oldById.any { (elementId, oldElement) ->
        val nextElement = nextById[elementId] ?: return@any true
        oldElement.type != nextElement.type
    }
}

fun ProductLayoutMapSetup.withFirstAvailableTarget(targets: List<ProductLayoutTarget>): ProductLayoutMapSetup {
    if (targets.isEmpty() || selectedTarget in targets) return this
    return withSelectedTarget(targets.first())
}

fun ProductLayoutMapSetup.withRoofPatternDefaults(pattern: RoofTemplate): ProductLayoutMapSetup =
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

fun ProductLayoutMapSetup.toRoofLayoutMap(): ProductRoofLayoutMap =
    ProductRoofLayoutMap(
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

fun ProductRoofLayoutMap.withRoofScopeDefaults(scope: ProductRoofScope): ProductRoofLayoutMap {
    val nextTemplate = if (scope == ProductRoofScope.INTERNAL) {
        RoofTemplate.CIRCULAR_PLATE
    } else {
        RoofTemplate.CONE_RADIAL
    }
    return copy(roofScope = scope).withTemplateDefaults(nextTemplate)
}

fun ProductRoofLayoutMap.withTemplateDefaults(template: RoofTemplate): ProductRoofLayoutMap =
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

fun ProductDraftState.tankBadgeLabel(): String =
    generalTankInfo.tankNumber.ifBlank { "Tank" }

fun ProductDraftState.roofSummaryLabel(): String =
    when (layoutMapSetup.roofPattern) {
        RoofTemplate.CIRCULAR_PLATE,
        RoofTemplate.CIRCULAR_CENTER_OPENING -> "Circular Plate"
        RoofTemplate.UMBRELLA_RADIAL -> "Umbrella Radial"
        RoofTemplate.CONE_RADIAL -> "Cone Radial"
    }

fun defaultProductPreviewDraftState(): ProductDraftState =
    ProductDraftState(
        generalTankInfo = ProductGeneralTankInfo(),
        layoutScope = ProductLayoutScope(
            externalRoof = true,
            internalRoof = false,
            shell = true,
            floor = false,
        ),
        layoutMapSetup = defaultProductLayoutMapSetup(),
        elementSetup = ProductElementSetup(
            externalRoof = true,
            internalRoof = false,
            shell = true,
            floor = false,
        ),
        elementPlacement = defaultProductElementPlacementState(),
        utSetup = ProductUtSetup(
            externalRoof = true,
            internalRoof = false,
            shell = true,
            floor = false,
        ),
        utMeasurements = ProductUtMeasurementState(),
        inspectionChecklist = ProductInspectionChecklistState(),
        findingState = ProductFindingState(),
        roofLayoutMap = defaultProductRoofLayoutMap(),
    )

private fun defaultProductLayoutMapSetup(): ProductLayoutMapSetup =
    ProductLayoutMapSetup(
        referenceNote = "Refer to the plant north marker near the stair landing.",
    ).withRoofPatternDefaults(RoofTemplate.CONE_RADIAL)

private fun defaultProductElementPlacementState(): ProductElementPlacementState =
    ProductElementPlacementState()

private fun defaultProductRoofLayoutMap(): ProductRoofLayoutMap =
    ProductRoofLayoutMap().withTemplateDefaults(RoofTemplate.CONE_RADIAL)

private fun String.extractFirstDecimalToken(): String? =
    Regex("""\d+(?:\.\d+)?""")
        .find(this)
        ?.value

private fun String.extractFirstIntegerToken(): String? =
    Regex("""\d+""")
        .find(this)
        ?.value

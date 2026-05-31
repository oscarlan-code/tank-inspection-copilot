package ai.laiq.tankinspection.v2.model

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
    val externalRoofType: String = "na",
    val internalRoofType: String = "na",
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

data class V2LayoutScope(
    val externalRoof: Boolean = true,
    val internalRoof: Boolean = false,
    val shell: Boolean = true,
    val floor: Boolean = false,
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
    val roofLayoutMap: V2RoofLayoutMap = defaultV2RoofLayoutMap(),
)

fun V2GeneralTankInfo.requiredValidationErrors(): List<String> {
    val errors = mutableListOf<String>()
    if (client.isBlank()) errors += "Enter the client."
    if (tankNumber.isBlank()) errors += "Enter the tank number."
    if (location.isBlank()) errors += "Enter the location."
    if (externalRoofType == "na" && internalRoofType == "na" && roofType.isBlank()) {
        errors += "Select the roof type."
    }
    if (externalRoofType == "external_floating" && internalRoofType != "na") {
        errors += "Internal roof type must be N.A. when external roof type is external floating."
    }
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

fun V2LayoutScope.selectedTargets(): List<V2LayoutTarget> =
    buildList {
        if (externalRoof) add(V2LayoutTarget.EXTERNAL_ROOF)
        if (internalRoof) add(V2LayoutTarget.INTERNAL_ROOF)
        if (shell) add(V2LayoutTarget.SHELL)
        if (floor) add(V2LayoutTarget.FLOOR)
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
    when (generalTankInfo.externalRoofType) {
        "dome" -> "Dome"
        "umbrella" -> "Umbrella"
        "geodesic" -> "Geodesic"
        "external_floating" -> "External Floating"
        "other_fixed" -> "Other Fixed"
        else -> "Cone"
    }

fun defaultV2PreviewDraftState(): V2DraftState =
    V2DraftState(
        generalTankInfo = V2GeneralTankInfo(
            client = "Pacific Energy",
            tankNumber = "TK-13",
            location = "Utulei, American Samoa",
            fieldLeaseName = "Pacific Terminal",
            shellConstruction = "butt",
            externalRoofType = "cone",
            internalRoofType = "na",
            productStored = "Diesel",
            diameter = "16.0",
            height = "12.0",
            serviceHeight = "10.8",
            courseNumber = "6",
        ),
        layoutScope = V2LayoutScope(
            externalRoof = true,
            internalRoof = false,
            shell = true,
            floor = true,
        ),
        layoutMapSetup = defaultV2LayoutMapSetup(),
        roofLayoutMap = defaultV2RoofLayoutMap(),
    )

private fun defaultV2LayoutMapSetup(): V2LayoutMapSetup =
    V2LayoutMapSetup(
        referenceNote = "Refer to the plant north marker near the stair landing.",
    ).withRoofPatternDefaults(RoofTemplate.CONE_RADIAL)

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

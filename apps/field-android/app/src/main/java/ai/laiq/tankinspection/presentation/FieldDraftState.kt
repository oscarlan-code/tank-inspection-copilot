package ai.laiq.tankinspection.presentation

import ai.laiq.tankinspection.domain.model.AttachmentRecord
import ai.laiq.tankinspection.domain.model.CanonicalInspectionPackage
import ai.laiq.tankinspection.domain.model.FindingRecord
import ai.laiq.tankinspection.domain.model.InspectionMeta
import ai.laiq.tankinspection.domain.model.Measurements
import ai.laiq.tankinspection.domain.model.MeasurementCaptureState
import ai.laiq.tankinspection.domain.model.MeasurementUnit
import ai.laiq.tankinspection.domain.model.MflImport
import ai.laiq.tankinspection.domain.model.NozzleDefinition
import ai.laiq.tankinspection.domain.model.NozzleSizeUnit
import ai.laiq.tankinspection.domain.model.NozzleRegistries
import ai.laiq.tankinspection.domain.model.NozzleUtRow
import ai.laiq.tankinspection.domain.model.PlumbnessSurvey
import ai.laiq.tankinspection.domain.model.PlumbnessSurveyStation
import ai.laiq.tankinspection.domain.model.ReferenceMode
import ai.laiq.tankinspection.domain.model.RoundnessSurvey
import ai.laiq.tankinspection.domain.model.RoundnessSurveyBand
import ai.laiq.tankinspection.domain.model.RoundnessSurveyStation
import ai.laiq.tankinspection.domain.model.RoofFeature
import ai.laiq.tankinspection.domain.model.ReviewState
import ai.laiq.tankinspection.domain.model.ReviewStatus
import ai.laiq.tankinspection.domain.model.RoofLayout
import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.domain.model.RoofUtRow
import ai.laiq.tankinspection.domain.model.RotationDirection
import ai.laiq.tankinspection.domain.model.ShellLinePlan
import ai.laiq.tankinspection.domain.model.ShellSettlementStation
import ai.laiq.tankinspection.domain.model.ShellSettlementSurvey
import ai.laiq.tankinspection.domain.model.ShellUtRow
import ai.laiq.tankinspection.domain.model.TankMaster
import ai.laiq.tankinspection.domain.model.UnitProfile
import ai.laiq.tankinspection.domain.usecase.ShellLinePlanner
import java.time.Instant

enum class ProductScreen {
    Setup,
    Scope,
    TaskBoard,
    RoofLayout,
    ShellUt,
    ShellSettlement,
    RoundnessSurvey,
    PlumbnessSurvey,
    RoofUt,
    ShellNozzleUt,
    RoofNozzleUt,
    Findings,
    Review,
    Export,
    MflImport,
}

enum class StartReference(val label: String, val azimuthDeg: Double) {
    N("N", 0.0),
    E("E", 90.0),
    S("S", 180.0),
    W("W", 270.0),
}

enum class FieldTask(val title: String, val subtitle: String) {
    ROOF_ELEMENTS("Roof Elements", "Roof appurtenance and floating-roof element placement"),
    SHELL_UT("Shell UT", "Crawler-lane shell thickness capture"),
    SHELL_SETTLEMENT("Shell Settlement", "Perimeter elevation survey capture"),
    ROUNDNESS_SURVEY("Roundness Survey", "Shell circularity survey capture"),
    PLUMBNESS_SURVEY("Plumbness Survey", "Shell vertical plumbness survey capture"),
    ROOF_UT("Roof UT", "Plate-based roof thickness capture"),
    SHELL_NOZZLE_UT("Shell Nozzles", "Shell nozzle registry and measurement"),
    ROOF_NOZZLE_UT("Roof Nozzles", "Roof nozzle registry and measurement"),
    FINDINGS("Findings", "Photo-linked observations and defects"),
    MFL_IMPORT("Bottom MFL", "Reference attachment and metadata"),
    REVIEW_EXPORT("Review & Export", "Package validation and export"),
}

data class SetupFormState(
    val client: String = "",
    val site: String = "",
    val tankNumber: String = "",
    val diameterM: String = "",
    val heightM: String = "",
    val shellCourseCount: String = "",
    val fixedRoofType: String = "cone",
    val floatingRoofType: String = "none",
    val inspector: String = "Field Engineer",
    val thicknessUnit: MeasurementUnit = MeasurementUnit.MM,
    val settlementUnit: MeasurementUnit = MeasurementUnit.MM,
    val nozzleSizeUnit: NozzleSizeUnit = NozzleSizeUnit.INCH,
)

data class ScopeFormState(
    val referenceMode: ReferenceMode = ReferenceMode.TANK_NORTH,
    val startReference: StartReference = StartReference.N,
    val referenceRemark: String = "",
    val rotationDirection: RotationDirection = RotationDirection.CLOCKWISE,
    val selectedTasks: Set<FieldTask> = defaultFieldTasks(),
)

data class FieldDraftState(
    val startedAtIso: String = Instant.now().toString(),
    val setup: SetupFormState = SetupFormState(),
    val scope: ScopeFormState = ScopeFormState(),
    val savedReferenceBaselineKey: String? = null,
    val savedSetupBaseline: SetupFormState? = null,
    val savedScopeBaseline: ScopeFormState? = null,
    val shellLineCountOverride: String = "",
    val savedShellLineCountOverride: String = "",
    val shellCaptureStartLaneId: String = "",
    val savedShellCaptureStartLaneId: String = "",
    val savedShellPlanKey: String? = null,
    val shellUtDraft: ShellUtDraftInput = ShellUtDraftInput(),
    val shellUtRows: List<ShellUtRow> = emptyList(),
    val shellSettlementDraft: ShellSettlementDraftInput = ShellSettlementDraftInput(),
    val savedShellSettlementSurvey: ShellSettlementSurvey? = null,
    val roundnessSurveyDraft: RoundnessSurveyDraftInput = RoundnessSurveyDraftInput(),
    val savedRoundnessSurvey: RoundnessSurvey? = null,
    val plumbnessSurveyDraft: PlumbnessSurveyDraftInput = PlumbnessSurveyDraftInput(),
    val savedPlumbnessSurvey: PlumbnessSurvey? = null,
    val fixedRoofLayoutDraft: RoofLayoutDraftInput = RoofLayoutDraftInput(),
    val savedFixedRoofLayoutDraft: RoofLayoutDraftInput? = null,
    val floatingRoofLayoutDraft: RoofLayoutDraftInput = RoofLayoutDraftInput(hasPontoonDeck = true),
    val savedFloatingRoofLayoutDraft: RoofLayoutDraftInput? = null,
    val activeRoofSurfaceId: String = ROOF_SURFACE_FIXED,
    val roofFeatureDraft: RoofFeatureDraftInput = RoofFeatureDraftInput(),
    val roofFeatures: List<RoofFeature> = emptyList(),
    val roofUtDraft: RoofUtDraftInput = RoofUtDraftInput(),
    val roofUtRows: List<RoofUtRow> = emptyList(),
    val shellNozzleDraft: ShellNozzleDraftInput = ShellNozzleDraftInput(),
    val shellNozzles: List<NozzleDefinition> = emptyList(),
    val shellNozzleUtDraft: NozzleUtDraftInput = NozzleUtDraftInput(),
    val shellNozzleUtRows: List<NozzleUtRow> = emptyList(),
    val roofNozzleDraft: RoofNozzleDraftInput = RoofNozzleDraftInput(),
    val roofNozzles: List<NozzleDefinition> = emptyList(),
    val roofNozzleUtDraft: NozzleUtDraftInput = NozzleUtDraftInput(),
    val roofNozzleUtRows: List<NozzleUtRow> = emptyList(),
    val findingDraft: FindingDraftInput = FindingDraftInput(),
    val findings: List<FindingRecord> = emptyList(),
    val attachments: List<AttachmentRecord> = emptyList(),
    val mflImportDraft: MflImportDraftInput = MflImportDraftInput(),
)

data class ShellUtDraftInput(
    val editingRowId: String? = null,
    val selectedLineId: String = "",
    val course: String = "",
    val captureState: MeasurementCaptureState = MeasurementCaptureState.CAPTURED,
    val readings: List<String> = listOf("", "", "", "", ""),
    val note: String = "",
)

data class ShellSettlementDraftInput(
    val stationCount: String = "8",
    val stations: List<ShellSettlementStationDraftInput> = defaultShellSettlementStationDrafts(8),
)

data class ShellSettlementStationDraftInput(
    val stationId: String,
    val angleDeg: Double,
    val elevation: String = "",
    val captureState: MeasurementCaptureState = MeasurementCaptureState.CAPTURED,
    val note: String = "",
)

data class RoundnessSurveyDraftInput(
    val editingSurveyId: String? = null,
    val surveyLabel: String = "Ring 1",
    val heightReference: String = "1 ft above bottom projection plate",
    val stationCount: String = "26",
    val stations: List<RoundnessSurveyStationDraftInput> = defaultRoundnessSurveyStationDrafts(26),
)

data class RoundnessSurveyStationDraftInput(
    val stationId: String,
    val angleDeg: Double,
    val easting: String = "",
    val northing: String = "",
    val captureState: MeasurementCaptureState = MeasurementCaptureState.CAPTURED,
    val note: String = "",
)

data class PlumbnessSurveyDraftInput(
    val stationCount: String = "26",
    val stations: List<PlumbnessSurveyStationDraftInput> = defaultPlumbnessSurveyStationDrafts(26),
)

data class PlumbnessSurveyStationDraftInput(
    val stationId: String,
    val angleDeg: Double,
    val plumbness: String = "",
    val captureState: MeasurementCaptureState = MeasurementCaptureState.CAPTURED,
    val note: String = "",
)

data class RoofLayoutDraftInput(
    val template: RoofTemplate = RoofTemplate.CIRCULAR_PLATE,
    val rowCount: String = "",
    val widestRowPlateCount: String = "",
    val ringCount: String = "",
    val sectorCount: String = "",
    val centerOpeningRatio: String = "",
    val hasAnnularRing: Boolean = false,
    val annularSectionCount: String = "",
    val hasPontoonDeck: Boolean = false,
)

data class RoofUtDraftInput(
    val roofSurfaceId: String = ROOF_SURFACE_FIXED,
    val editingRowId: String? = null,
    val plateId: String = "",
    val captureState: MeasurementCaptureState = MeasurementCaptureState.CAPTURED,
    val readings: List<String> = listOf("", "", "", "", ""),
    val note: String = "",
)

data class RoofFeatureDraftInput(
    val roofSurfaceId: String = ROOF_SURFACE_FIXED,
    val editingFeatureId: String? = null,
    val type: String = "manhole",
    val quantity: String = "1",
    val linkedPlateIds: List<String> = listOf(""),
    val azimuthDegrees: List<String> = listOf(""),
    val radiusRatios: List<String> = listOf(""),
    val label: String = "",
    val placementMode: String = "plate_linked",
    val plateId: String = "",
    val azimuthDeg: String = "",
    val radiusRatio: String = "",
)

data class ShellNozzleDraftInput(
    val nozzleId: String = "",
    val size: String = "",
    val course: String = "",
    val azimuthDeg: String = "",
    val placementMode: String = "line_linked",
)

data class RoofNozzleDraftInput(
    val roofSurfaceId: String = ROOF_SURFACE_FIXED,
    val nozzleId: String = "",
    val size: String = "",
    val plateId: String = "",
    val azimuthDeg: String = "",
    val placementMode: String = "plate_linked",
)

data class NozzleUtDraftInput(
    val roofSurfaceId: String = "",
    val editingRowId: String? = null,
    val nozzleId: String = "",
    val captureState: MeasurementCaptureState = MeasurementCaptureState.CAPTURED,
    val readings: List<String> = listOf("", "", "", "", ""),
    val note: String = "",
)

data class FindingDraftInput(
    val editingFindingId: String? = null,
    val surface: String = "shell",
    val type: String = "corrosion",
    val severity: String = "medium",
    val note: String = "",
    val linkedMeasurementId: String = "",
    val locationSummary: String = "",
    val preciseLineId: String = "",
    val preciseCourse: String = "",
    val preciseOffsetPercent: String = "",
    val photoCaption: String = "",
    val photoRelativePath: String = "",
)

data class MflImportDraftInput(
    val contractor: String = "",
    val reportReference: String = "",
    val reportDate: String = "",
    val severity: String = "medium",
    val pdfRelativePath: String = "",
    val pdfCaption: String = "",
    val attachmentId: String? = null,
)

const val ROOF_SURFACE_FIXED = "fixed"
const val ROOF_SURFACE_FLOATING = "floating"

data class RoofSurfaceConfig(
    val roofSurfaceId: String,
    val surfaceKind: String,
    val label: String,
)

fun roofFindingSurface(roofSurfaceId: String): String = "roof_$roofSurfaceId"

fun roofNozzleFindingSurface(roofSurfaceId: String): String = "roof_nozzle_$roofSurfaceId"

fun defaultFieldTasks(): Set<FieldTask> = linkedSetOf(
    FieldTask.ROOF_ELEMENTS,
    FieldTask.SHELL_UT,
    FieldTask.SHELL_SETTLEMENT,
    FieldTask.ROUNDNESS_SURVEY,
    FieldTask.PLUMBNESS_SURVEY,
    FieldTask.ROOF_UT,
    FieldTask.SHELL_NOZZLE_UT,
    FieldTask.ROOF_NOZZLE_UT,
    FieldTask.REVIEW_EXPORT,
)

fun selectableFieldTasks(): List<FieldTask> =
    FieldTask.entries.filterNot { task -> task == FieldTask.FINDINGS }

fun visibleSelectedTasks(selectedTasks: Set<FieldTask>): List<FieldTask> =
    selectedTasks.filterNot { task -> task == FieldTask.FINDINGS }

fun defaultShellSettlementStationDrafts(
    stationCount: Int,
    startAngleDeg: Double = StartReference.N.azimuthDeg,
    rotationDirection: RotationDirection = RotationDirection.CLOCKWISE,
): List<ShellSettlementStationDraftInput> {
    val stations = defaultSurveyStationAngles(stationCount, startAngleDeg, rotationDirection)
    return stations.map { (stationId, angleDeg) ->
        ShellSettlementStationDraftInput(
            stationId = stationId,
            angleDeg = angleDeg,
        )
    }
}

fun defaultRoundnessSurveyStationDrafts(
    stationCount: Int,
    startAngleDeg: Double = StartReference.N.azimuthDeg,
    rotationDirection: RotationDirection = RotationDirection.CLOCKWISE,
): List<RoundnessSurveyStationDraftInput> =
    defaultSurveyStationAngles(stationCount, startAngleDeg, rotationDirection).map { (stationId, angleDeg) ->
        RoundnessSurveyStationDraftInput(
            stationId = stationId,
            angleDeg = angleDeg,
        )
    }

fun defaultPlumbnessSurveyStationDrafts(
    stationCount: Int,
    startAngleDeg: Double = StartReference.N.azimuthDeg,
    rotationDirection: RotationDirection = RotationDirection.CLOCKWISE,
): List<PlumbnessSurveyStationDraftInput> =
    defaultSurveyStationAngles(stationCount, startAngleDeg, rotationDirection).map { (stationId, angleDeg) ->
        PlumbnessSurveyStationDraftInput(
            stationId = stationId,
            angleDeg = angleDeg,
        )
    }

private fun defaultSurveyStationAngles(
    stationCount: Int,
    startAngleDeg: Double,
    rotationDirection: RotationDirection,
): List<Pair<String, Double>> {
    val normalizedCount = stationCount.coerceAtLeast(1)
    val step = 360.0 / normalizedCount.toDouble()
    return List(normalizedCount) { index ->
        val directionFactor = if (rotationDirection == RotationDirection.CLOCKWISE) 1 else -1
        val angle = (startAngleDeg + (index * step * directionFactor) + 360.0) % 360.0
        "${index + 1}" to angle
    }
}

fun MeasurementUnit.label(): String = when (this) {
    MeasurementUnit.MM -> "mm"
    MeasurementUnit.INCH -> "inch"
}

fun NozzleSizeUnit.label(): String = when (this) {
    NozzleSizeUnit.INCH -> "inch"
    NozzleSizeUnit.MM -> "mm"
    NozzleSizeUnit.MIXED_TEXT -> "mixed / free text"
}

fun MeasurementCaptureState.label(): String = when (this) {
    MeasurementCaptureState.CAPTURED -> "Captured"
    MeasurementCaptureState.NOT_APPLICABLE -> "N/A"
    MeasurementCaptureState.NOT_ACCESSIBLE -> "Not Accessible"
    MeasurementCaptureState.COATED_NOT_EXPOSED -> "Coated / Not Exposed"
    MeasurementCaptureState.SKIPPED -> "Skipped"
}

fun MeasurementCaptureState.requiresNumericReadings(): Boolean =
    this == MeasurementCaptureState.CAPTURED

fun measurementCaptureStateOptions(
    includeNotApplicable: Boolean = true,
): List<Pair<String, String>> =
    MeasurementCaptureState.entries
        .filterNot { state -> !includeNotApplicable && state == MeasurementCaptureState.NOT_APPLICABLE }
        .map { state -> state.name to state.label() }

fun FieldDraftState.validationErrors(): List<String> {
    val errors = mutableListOf<String>()
    if (setup.client.isBlank()) errors += "Client is required."
    if (setup.site.isBlank()) errors += "Site is required."
    if (setup.tankNumber.isBlank()) errors += "Tank number is required."
    if (setup.diameterM.toDoubleOrNull()?.let { it > 0 } != true) errors += "Diameter must be a positive number."
    if (setup.heightM.toDoubleOrNull()?.let { it > 0 } != true) errors += "Height must be a positive number."
    if (setup.shellCourseCount.toIntOrNull()?.let { it > 0 } != true) errors += "Shell course count must be a positive integer."
    if (scope.usesMarkerReference() && scope.referenceRemark.isBlank()) {
        errors += "Enter the tank north / site marker remark."
    }
    if (scope.selectedTasks.isEmpty()) errors += "Select at least one active task."
    return errors
}

fun ScopeFormState.normalizedReferenceMode(): ReferenceMode =
    if (referenceMode == ReferenceMode.SITE_MARKER) ReferenceMode.TANK_NORTH else referenceMode

fun ScopeFormState.usesMarkerReference(): Boolean =
    normalizedReferenceMode() != ReferenceMode.TRUE_NORTH

fun ScopeFormState.resolvedStartReference(): StartReference =
    StartReference.N

fun ScopeFormState.startReferenceLabel(): String =
    if (normalizedReferenceMode() == ReferenceMode.TRUE_NORTH) {
        "True North"
    } else {
        referenceRemark.trim()
            .takeIf { remark -> remark.isNotBlank() }
            ?.let { remark -> "Tank North / Site Marker: $remark" }
            ?: "Tank North / Site Marker"
    }

fun ScopeFormState.roofReferenceLabel(): String =
    if (normalizedReferenceMode() == ReferenceMode.TRUE_NORTH) {
        "True North"
    } else {
        referenceRemark.trim()
            .takeIf { remark -> remark.isNotBlank() }
            ?.let { remark -> "Tank North: $remark" }
            ?: "Tank North"
    }

fun ScopeFormState.referenceAzimuthDeg(): Double =
    0.0

fun SetupFormState.hasFixedRoof(): Boolean =
    fixedRoofType != "none"

fun SetupFormState.hasFloatingRoof(): Boolean =
    floatingRoofType != "none"

fun SetupFormState.roofSystemLabel(): String = buildList {
    if (hasFixedRoof()) {
        add(
            when (fixedRoofType) {
                "cone" -> "Fixed Cone"
                "dome" -> "Fixed Dome"
                "umbrella" -> "Umbrella"
                "geodesic" -> "Geodesic"
                "other" -> "Fixed Other"
                else -> "Fixed"
            },
        )
    }
    if (hasFloatingRoof()) {
        add(
            when (floatingRoofType) {
                "external" -> "External Floating"
                "internal" -> "Internal Floating"
                else -> "Floating"
            },
        )
    }
}.joinToString(" + ").ifBlank { "No Roof Selected" }

fun SetupFormState.availableRoofSurfaces(): List<RoofSurfaceConfig> = buildList {
    if (hasFixedRoof()) {
        add(RoofSurfaceConfig(ROOF_SURFACE_FIXED, "fixed", "Fixed Roof"))
    }
    if (hasFloatingRoof()) {
        add(RoofSurfaceConfig(ROOF_SURFACE_FLOATING, "floating", "Floating Roof"))
    }
}

fun roofTemplateForFixedRoofType(fixedRoofType: String): RoofTemplate = when (fixedRoofType.trim()) {
    "umbrella" -> RoofTemplate.UMBRELLA_RADIAL
    else -> RoofTemplate.CIRCULAR_PLATE
}

fun roofTemplateForSurface(
    setup: SetupFormState,
    roofSurfaceId: String,
): RoofTemplate = when (roofSurfaceId) {
    ROOF_SURFACE_FLOATING -> RoofTemplate.CIRCULAR_PLATE
    else -> roofTemplateForFixedRoofType(setup.fixedRoofType)
}

fun RoofLayoutDraftInput.syncTemplateToSurface(
    setup: SetupFormState,
    roofSurfaceId: String,
): RoofLayoutDraftInput {
    val targetTemplate = roofTemplateForSurface(setup, roofSurfaceId)
    if (template == targetTemplate) return this
    return when (targetTemplate) {
        RoofTemplate.UMBRELLA_RADIAL -> copy(
            template = targetTemplate,
            rowCount = "",
            widestRowPlateCount = "",
            centerOpeningRatio = "",
            hasPontoonDeck = false,
        )

        RoofTemplate.CIRCULAR_PLATE,
        RoofTemplate.CIRCULAR_CENTER_OPENING -> copy(
            template = RoofTemplate.CIRCULAR_PLATE,
            ringCount = "",
            sectorCount = "",
            centerOpeningRatio = "",
            hasPontoonDeck = roofSurfaceId == ROOF_SURFACE_FLOATING,
        )
    }
}

fun FieldDraftState.committedSetupState(): SetupFormState =
    savedSetupBaseline ?: setup

fun FieldDraftState.committedScopeBaseline(): ScopeFormState =
    savedScopeBaseline ?: scope

fun FieldDraftState.normalizedActiveRoofSurfaceId(): String =
    committedSetupState().availableRoofSurfaces().firstOrNull { surface ->
        surface.roofSurfaceId == activeRoofSurfaceId
    }?.roofSurfaceId ?: committedSetupState().availableRoofSurfaces().firstOrNull()?.roofSurfaceId ?: ROOF_SURFACE_FIXED

fun FieldDraftState.activeRoofSurfaceConfig(): RoofSurfaceConfig? =
    committedSetupState().availableRoofSurfaces().firstOrNull { surface ->
        surface.roofSurfaceId == normalizedActiveRoofSurfaceId()
    }

fun FieldDraftState.roofLayoutDraftForSurface(roofSurfaceId: String): RoofLayoutDraftInput =
    when (roofSurfaceId) {
        ROOF_SURFACE_FLOATING -> floatingRoofLayoutDraft
        else -> fixedRoofLayoutDraft
    }

fun FieldDraftState.savedRoofLayoutDraftForSurface(roofSurfaceId: String): RoofLayoutDraftInput? =
    when (roofSurfaceId) {
        ROOF_SURFACE_FLOATING -> savedFloatingRoofLayoutDraft
        else -> savedFixedRoofLayoutDraft
    }

fun FieldDraftState.committedShellLineCountOverride(): String =
    if (savedReferenceBaselineKey.isNullOrBlank() && savedShellPlanKey.isNullOrBlank()) {
        shellLineCountOverride
    } else {
        savedShellLineCountOverride
    }

fun FieldDraftState.currentFundamentalBaselineKey(): String =
    buildString {
        append(setup.diameterM.trim())
        append("|")
        append(setup.heightM.trim())
        append("|")
        append(setup.shellCourseCount.trim())
        append("|")
        append(setup.fixedRoofType.trim())
        append("|")
        append(setup.floatingRoofType.trim())
        append("|")
        append(scope.normalizedReferenceMode().name)
        append("|")
        append(scope.startReferenceLabel())
        append("|")
        append(scope.rotationDirection.name)
        append("|")
        append(setup.thicknessUnit.name)
        append("|")
        append(setup.settlementUnit.name)
        append("|")
        append(setup.nozzleSizeUnit.name)
    }

fun FieldDraftState.hasPendingFundamentalChanges(): Boolean =
    !savedReferenceBaselineKey.isNullOrBlank() && savedReferenceBaselineKey != currentFundamentalBaselineKey()

fun FieldDraftState.hasPendingShellPlanningChanges(): Boolean {
    val nextShellPlanKey = currentShellPlanKey() ?: return false
    return !savedShellPlanKey.isNullOrBlank() && savedShellPlanKey != nextShellPlanKey
}

fun FieldDraftState.reviewWarnings(): List<String> {
    val warnings = validationErrors().toMutableList()

    if (
        scope.selectedTasks.any { it == FieldTask.ROOF_ELEMENTS || it == FieldTask.ROOF_UT || it == FieldTask.ROOF_NOZZLE_UT } &&
        !hasSavedRoofLayout()
    ) {
        warnings += "Save the roof layout before using roof elements, roof measurements, or roof nozzle data."
    }
    if (hasSavedRoofLayout() && hasPendingRoofLayoutChanges()) {
        warnings += "Roof layout draft has unsaved changes."
    }

    if (scope.selectedTasks.contains(FieldTask.SHELL_UT) && shellUtRows.isEmpty()) {
        warnings += "Add at least one shell UT row."
    }
    if (scope.selectedTasks.contains(FieldTask.SHELL_SETTLEMENT) && savedShellSettlementSurvey == null) {
        warnings += "Save the shell settlement survey before export."
    }
    if (scope.selectedTasks.contains(FieldTask.ROUNDNESS_SURVEY) && savedRoundnessSurvey?.surveys.isNullOrEmpty()) {
        warnings += "Save at least one roundness survey band before export."
    }
    if (scope.selectedTasks.contains(FieldTask.PLUMBNESS_SURVEY) && savedPlumbnessSurvey?.stations.isNullOrEmpty()) {
        warnings += "Save the plumbness survey before export."
    }
    if (scope.selectedTasks.contains(FieldTask.ROOF_UT) && roofUtRows.isEmpty()) {
        warnings += "Add at least one roof UT row."
    }
    if (scope.selectedTasks.contains(FieldTask.SHELL_NOZZLE_UT) && shellNozzles.isEmpty()) {
        warnings += "Register at least one shell nozzle."
    }
    if (scope.selectedTasks.contains(FieldTask.ROOF_NOZZLE_UT) && roofNozzles.isEmpty()) {
        warnings += "Register at least one roof nozzle."
    }
    if (scope.selectedTasks.contains(FieldTask.MFL_IMPORT) && mflImportDraft.attachmentId.isNullOrBlank()) {
        warnings += "Attach the third-party MFL PDF before export."
    }

    return warnings.distinct()
}

fun FieldDraftState.recommendedLineCount(): Int? =
    setup.diameterM.toDoubleOrNull()?.takeIf { it > 0 }?.let { ShellLinePlanner.recommendedLineCount(it) }

fun FieldDraftState.committedRecommendedLineCount(): Int? =
    committedSetupState().diameterM.toDoubleOrNull()?.takeIf { it > 0 }?.let { ShellLinePlanner.recommendedLineCount(it) }

fun FieldDraftState.explicitLineCount(): Int? =
    ShellLinePlanner.normalizedLineCount(shellLineCountOverride.toIntOrNull()?.takeIf { it > 0 })

fun FieldDraftState.committedExplicitLineCount(): Int? =
    ShellLinePlanner.normalizedLineCount(committedShellLineCountOverride().toIntOrNull()?.takeIf { it > 0 })

fun FieldDraftState.resolvedLineCount(): Int? =
    explicitLineCount() ?: recommendedLineCount()

fun FieldDraftState.committedResolvedLineCount(): Int? =
    committedExplicitLineCount() ?: committedRecommendedLineCount()

fun FieldDraftState.createShellLinePlanOrNull(): ShellLinePlan? {
    val diameterM = setup.diameterM.toDoubleOrNull()?.takeIf { it > 0 } ?: return null
    return ShellLinePlanner.createPlan(
        diameterM = diameterM,
        explicitLineCount = explicitLineCount(),
        referenceMode = scope.normalizedReferenceMode(),
        startReference = scope.resolvedStartReference(),
        startReferenceLabel = scope.startReferenceLabel(),
        rotationDirection = scope.rotationDirection,
        captureStartLaneId = shellCaptureStartLaneId,
    )
}

fun FieldDraftState.createCommittedShellLinePlanOrNull(): ShellLinePlan? {
    val committedSetup = committedSetupState()
    val committedScope = committedScopeBaseline()
    val diameterM = committedSetup.diameterM.toDoubleOrNull()?.takeIf { it > 0 } ?: return null
    return ShellLinePlanner.createPlan(
        diameterM = diameterM,
        explicitLineCount = committedExplicitLineCount(),
        referenceMode = committedScope.normalizedReferenceMode(),
        startReference = committedScope.resolvedStartReference(),
        startReferenceLabel = committedScope.startReferenceLabel(),
        rotationDirection = committedScope.rotationDirection,
        captureStartLaneId = committedShellCaptureStartLaneId(),
    )
}

fun FieldDraftState.currentShellCaptureStartLaneId(): String {
    val candidateLaneId = shellCaptureStartLaneId.ifBlank { savedShellCaptureStartLaneId }
    val resolvedLineCount = resolvedLineCount() ?: return candidateLaneId
    return ShellLinePlanner.normalizeCaptureStartLaneId(candidateLaneId, resolvedLineCount).orEmpty()
}

fun FieldDraftState.committedShellCaptureStartLaneId(): String {
    val resolvedLineCount = committedResolvedLineCount() ?: return savedShellCaptureStartLaneId
    return ShellLinePlanner.normalizeCaptureStartLaneId(savedShellCaptureStartLaneId, resolvedLineCount).orEmpty()
}

fun ShellLinePlan.displayLinesForMap(): List<ai.laiq.tankinspection.domain.model.ShellLine> {
    if (lines.isEmpty()) return emptyList()

    val captureStartIndex = lines.indexOfFirst { line -> line.lineId == captureStartLaneId }
        .takeIf { index -> index >= 0 }
        ?: 0
    val rotatedLines = lines.drop(captureStartIndex) + lines.take(captureStartIndex)
    return if (rotationDirection == RotationDirection.CLOCKWISE) {
        rotatedLines
    } else {
        rotatedLines.asReversed()
    }
}

fun FieldDraftState.currentShellPlanKey(): String? {
    val shellLinePlan = createShellLinePlanOrNull() ?: return null
    val courseCount = setup.shellCourseCount.toIntOrNull()?.takeIf { it > 0 } ?: return null
    return buildString {
        append(scope.normalizedReferenceMode().name)
        append("|")
        append(shellLinePlan.startReference)
        append("|")
        append(scope.rotationDirection.name)
        append("|")
        append(shellLinePlan.lineCount)
        append("|")
        append(courseCount)
    }
}

fun FieldDraftState.commitFundamentalInputs(): FieldDraftState {
    val nextReferenceKey = currentFundamentalBaselineKey()
    val nextShellPlanKey = currentShellPlanKey()
    val nextFixedRoofLayoutDraft = fixedRoofLayoutDraft.syncTemplateToSurface(setup, ROOF_SURFACE_FIXED)
    val nextFloatingRoofLayoutDraft = floatingRoofLayoutDraft.syncTemplateToSurface(setup, ROOF_SURFACE_FLOATING)
    val nextSetupBaseline = setup
    val nextScopeBaseline = scope.copy(startReference = StartReference.N)
    val nextShellLineOverride = shellLineCountOverride
    val nextShellCaptureStartLaneId = currentShellCaptureStartLaneId()
    val nextActiveRoofSurfaceId = setup.availableRoofSurfaces().firstOrNull { surface ->
        surface.roofSurfaceId == activeRoofSurfaceId
    }?.roofSurfaceId ?: setup.availableRoofSurfaces().firstOrNull()?.roofSurfaceId ?: ROOF_SURFACE_FIXED

    if (!savedReferenceBaselineKey.isNullOrBlank() && savedReferenceBaselineKey != nextReferenceKey) {
        return clearShellInspectionData()
            .clearShellSettlementData()
            .clearRoundnessSurveyData()
            .clearPlumbnessSurveyData()
            .invalidateRoofLayoutForReferenceChange()
            .copy(
                fixedRoofLayoutDraft = nextFixedRoofLayoutDraft,
                floatingRoofLayoutDraft = nextFloatingRoofLayoutDraft,
                activeRoofSurfaceId = nextActiveRoofSurfaceId,
                savedReferenceBaselineKey = nextReferenceKey,
                savedSetupBaseline = nextSetupBaseline,
                savedScopeBaseline = nextScopeBaseline,
                savedShellLineCountOverride = nextShellLineOverride,
                savedShellCaptureStartLaneId = nextShellCaptureStartLaneId,
                savedShellPlanKey = nextShellPlanKey,
            )
    }

    val nextState = if (
        nextShellPlanKey != null &&
            !savedShellPlanKey.isNullOrBlank() &&
            savedShellPlanKey != nextShellPlanKey
    ) {
        clearShellInspectionData()
    } else {
        this
    }

    return nextState.copy(
        fixedRoofLayoutDraft = nextFixedRoofLayoutDraft,
        floatingRoofLayoutDraft = nextFloatingRoofLayoutDraft,
        activeRoofSurfaceId = nextActiveRoofSurfaceId,
        savedReferenceBaselineKey = nextReferenceKey,
        savedSetupBaseline = nextSetupBaseline,
        savedScopeBaseline = nextScopeBaseline,
        savedShellLineCountOverride = nextShellLineOverride,
        savedShellCaptureStartLaneId = nextShellCaptureStartLaneId,
        savedShellPlanKey = nextShellPlanKey ?: nextState.savedShellPlanKey,
    )
}

fun FieldDraftState.commitScopeInputs(): FieldDraftState =
    commitFundamentalInputs()

fun FieldDraftState.commitShellPlanningInputs(): FieldDraftState {
    val nextKey = currentShellPlanKey() ?: return this
    if (savedShellPlanKey == nextKey) {
        return copy(savedShellPlanKey = nextKey)
    }
    return clearShellInspectionData().copy(savedShellPlanKey = nextKey)
}

fun buildRoofLayoutFromDraftOrNull(
    draft: RoofLayoutDraftInput?,
    features: List<RoofFeature> = emptyList(),
): RoofLayout? {
    draft ?: return null
    return RoofLayout(
        template = draft.template,
        rowCount = parsePositiveWholeNumber(draft.rowCount),
        widestRowPlateCount = parsePositiveWholeNumber(draft.widestRowPlateCount),
        ringCount = parsePositiveWholeNumber(draft.ringCount),
        sectorCount = parsePositiveWholeNumber(draft.sectorCount),
        centerOpeningRatio = parseNormalizedDecimal(draft.centerOpeningRatio)?.takeIf { it in 0.0..1.0 },
        hasAnnularRing = draft.hasAnnularRing,
        annularSectionCount = parsePositiveWholeNumber(draft.annularSectionCount),
        hasPontoonDeck = draft.hasPontoonDeck,
        features = features,
    )
}

fun RoofLayout?.isReadyForInspection(): Boolean = when (this?.template) {
    RoofTemplate.CIRCULAR_PLATE,
    RoofTemplate.CIRCULAR_CENTER_OPENING -> rowCount != null && widestRowPlateCount != null
    RoofTemplate.UMBRELLA_RADIAL -> ringCount != null && sectorCount != null
    null -> false
}

fun FieldDraftState.buildEditingRoofLayoutOrNull(
    roofSurfaceId: String = normalizedActiveRoofSurfaceId(),
): RoofLayout? =
    buildRoofLayoutFromDraftOrNull(roofLayoutDraftForSurface(roofSurfaceId))

fun FieldDraftState.buildRoofLayoutOrNull(
    roofSurfaceId: String = normalizedActiveRoofSurfaceId(),
): RoofLayout? =
    buildRoofLayoutFromDraftOrNull(
        savedRoofLayoutDraftForSurface(roofSurfaceId),
        roofFeatures.filter { feature -> feature.roofSurfaceId == roofSurfaceId },
    )

fun FieldDraftState.hasSavedRoofLayout(roofSurfaceId: String = normalizedActiveRoofSurfaceId()): Boolean =
    buildRoofLayoutOrNull(roofSurfaceId).isReadyForInspection()

fun FieldDraftState.hasPendingRoofLayoutChanges(roofSurfaceId: String = normalizedActiveRoofSurfaceId()): Boolean {
    val draft = roofLayoutDraftForSurface(roofSurfaceId)
    val savedDraft = savedRoofLayoutDraftForSurface(roofSurfaceId) ?: return roofLayoutDraftRevision(draft).isNotBlank()
    return roofLayoutDraftRevision(draft) != roofLayoutDraftRevision(savedDraft)
}

fun FieldDraftState.saveRoofLayoutDraft(
    roofSurfaceId: String = normalizedActiveRoofSurfaceId(),
): FieldDraftState {
    val normalizedDraft = roofLayoutDraftForSurface(roofSurfaceId).syncTemplateToSurface(committedSetupState(), roofSurfaceId)
    val nextLayout = buildRoofLayoutFromDraftOrNull(normalizedDraft) ?: return this
    if (!nextLayout.isReadyForInspection()) return this

    val currentLayoutKey = roofLayoutMaterialKey(normalizedDraft)
    val savedLayoutKey = roofLayoutMaterialKey(savedRoofLayoutDraftForSurface(roofSurfaceId))

    val nextState = if (savedLayoutKey == currentLayoutKey) {
        this
    } else {
        clearRoofInspectionData()
    }

    return when (roofSurfaceId) {
        ROOF_SURFACE_FLOATING -> nextState.copy(
            floatingRoofLayoutDraft = normalizedDraft,
            savedFloatingRoofLayoutDraft = normalizedDraft,
        )

        else -> nextState.copy(
            fixedRoofLayoutDraft = normalizedDraft,
            savedFixedRoofLayoutDraft = normalizedDraft,
        )
    }
}

fun FieldDraftState.saveShellUtDraft(): FieldDraftState {
    val shellLinePlan = createShellLinePlanOrNull() ?: return this
    val selectedLineId = shellUtDraft.selectedLineId.ifBlank {
        shellLinePlan.captureStartLaneId ?: shellLinePlan.lines.firstOrNull()?.lineId.orEmpty()
    }
    val course = shellUtDraft.course.toIntOrNull()?.takeIf { it > 0 } ?: return this
    val readings = shellUtDraft.readings.mapNotNull { it.toDoubleOrNull() }
    if (selectedLineId.isBlank()) return this
    if (shellUtDraft.captureState.requiresNumericReadings() && readings.isEmpty()) return this

    val rowId = shellUtDraft.editingRowId ?: "shell-ut-${(shellUtRows.size + 1).toString().padStart(3, '0')}"
    val nextRow = ShellUtRow(
        rowId = rowId,
        lineId = selectedLineId,
        course = course,
        readings = readings,
        captureState = shellUtDraft.captureState,
        note = shellUtDraft.note.ifBlank { null },
    )

    val nextRows = if (shellUtDraft.editingRowId == null) {
        shellUtRows + nextRow
    } else {
        shellUtRows.map { row -> if (row.rowId == shellUtDraft.editingRowId) nextRow else row }
    }

    return copy(
        shellUtRows = nextRows,
        shellUtDraft = shellUtDraft.copy(
            editingRowId = null,
            captureState = MeasurementCaptureState.CAPTURED,
            readings = List(5) { "" },
            note = "",
        ),
    )
}

fun FieldDraftState.editShellUtRow(rowId: String): FieldDraftState {
    val row = shellUtRows.firstOrNull { it.rowId == rowId } ?: return this
    return copy(
        shellUtDraft = ShellUtDraftInput(
            editingRowId = row.rowId,
            selectedLineId = row.lineId,
            course = row.course.toString(),
            captureState = row.captureState,
            readings = row.readings.map { reading -> reading.toString() }.let { values ->
                values + List(maxOf(0, 5 - values.size)) { "" }
            }.take(5),
            note = row.note.orEmpty(),
        ),
    )
}

fun FieldDraftState.removeShellUtRow(rowId: String): FieldDraftState =
    copy(
        shellUtRows = shellUtRows.filterNot { it.rowId == rowId },
        shellUtDraft = if (shellUtDraft.editingRowId == rowId) ShellUtDraftInput() else shellUtDraft,
    )

fun FieldDraftState.updateShellSettlementStationCount(countText: String): FieldDraftState {
    val normalized = countText.filter { char -> char.isDigit() }
    val parsedCount = normalized.toIntOrNull()?.coerceAtLeast(1)
    val committedScope = committedScopeBaseline()
    val templateStations = defaultShellSettlementStationDrafts(
        stationCount = parsedCount ?: shellSettlementDraft.stations.size.coerceAtLeast(1),
        startAngleDeg = committedScope.referenceAzimuthDeg(),
        rotationDirection = committedScope.rotationDirection,
    )
    val nextStations = templateStations.mapIndexed { index, template ->
        val existing = shellSettlementDraft.stations.getOrNull(index)
        template.copy(
            elevation = existing?.elevation.orEmpty(),
            captureState = existing?.captureState ?: MeasurementCaptureState.CAPTURED,
            note = existing?.note.orEmpty(),
        )
    }
    return copy(
        shellSettlementDraft = shellSettlementDraft.copy(
            stationCount = normalized,
            stations = nextStations,
        ),
    )
}

fun FieldDraftState.updateShellSettlementStation(
    stationId: String,
    elevation: String? = null,
    captureState: MeasurementCaptureState? = null,
    note: String? = null,
): FieldDraftState =
    copy(
        shellSettlementDraft = shellSettlementDraft.copy(
            stations = shellSettlementDraft.stations.map { station ->
                if (station.stationId == stationId) {
                    station.copy(
                        elevation = elevation ?: station.elevation,
                        captureState = captureState ?: station.captureState,
                        note = note ?: station.note,
                    )
                } else {
                    station
                }
            },
        ),
    )

fun FieldDraftState.saveShellSettlementSurveyDraft(): FieldDraftState {
    val parsedCount = shellSettlementDraft.stationCount.toIntOrNull()?.takeIf { it > 0 } ?: return this
    val stations = shellSettlementDraft.stations.take(parsedCount).map { station ->
        ShellSettlementStation(
            stationId = station.stationId,
            angleDeg = station.angleDeg,
            elevation = station.elevation.trim().toDoubleOrNull(),
            captureState = station.captureState,
            note = station.note.ifBlank { null },
        )
    }
    if (stations.isEmpty()) return this
    val hasInvalidCapturedStation = stations.any { station ->
        station.captureState.requiresNumericReadings() && station.elevation == null
    }
    if (hasInvalidCapturedStation) return this
    return copy(
        savedShellSettlementSurvey = ShellSettlementSurvey(
            stationCount = parsedCount,
            stations = stations,
        ),
    )
}

fun FieldDraftState.updateRoundnessSurveyHeader(
    surveyLabel: String? = null,
    heightReference: String? = null,
): FieldDraftState =
    copy(
        roundnessSurveyDraft = roundnessSurveyDraft.copy(
            surveyLabel = surveyLabel ?: roundnessSurveyDraft.surveyLabel,
            heightReference = heightReference ?: roundnessSurveyDraft.heightReference,
        ),
    )

fun FieldDraftState.updateRoundnessSurveyStationCount(countText: String): FieldDraftState {
    val normalized = countText.filter { char -> char.isDigit() }
    val parsedCount = normalized.toIntOrNull()?.coerceAtLeast(1)
    val committedScope = committedScopeBaseline()
    val templateStations = defaultRoundnessSurveyStationDrafts(
        stationCount = parsedCount ?: roundnessSurveyDraft.stations.size.coerceAtLeast(1),
        startAngleDeg = committedScope.referenceAzimuthDeg(),
        rotationDirection = committedScope.rotationDirection,
    )
    val nextStations = templateStations.mapIndexed { index, template ->
        val existing = roundnessSurveyDraft.stations.getOrNull(index)
        template.copy(
            easting = existing?.easting.orEmpty(),
            northing = existing?.northing.orEmpty(),
            captureState = existing?.captureState ?: MeasurementCaptureState.CAPTURED,
            note = existing?.note.orEmpty(),
        )
    }
    return copy(
        roundnessSurveyDraft = roundnessSurveyDraft.copy(
            stationCount = normalized,
            stations = nextStations,
        ),
    )
}

fun FieldDraftState.updateRoundnessSurveyStation(
    stationId: String,
    easting: String? = null,
    northing: String? = null,
    captureState: MeasurementCaptureState? = null,
    note: String? = null,
): FieldDraftState =
    copy(
        roundnessSurveyDraft = roundnessSurveyDraft.copy(
            stations = roundnessSurveyDraft.stations.map { station ->
                if (station.stationId == stationId) {
                    station.copy(
                        easting = easting ?: station.easting,
                        northing = northing ?: station.northing,
                        captureState = captureState ?: station.captureState,
                        note = note ?: station.note,
                    )
                } else {
                    station
                }
            },
        ),
    )

fun FieldDraftState.saveRoundnessSurveyDraft(): FieldDraftState {
    val parsedCount = roundnessSurveyDraft.stationCount.toIntOrNull()?.takeIf { it > 0 } ?: return this
    val stations = roundnessSurveyDraft.stations.take(parsedCount).map { station ->
        RoundnessSurveyStation(
            stationId = station.stationId,
            angleDeg = station.angleDeg,
            easting = station.easting.trim().toDoubleOrNull(),
            northing = station.northing.trim().toDoubleOrNull(),
            captureState = station.captureState,
            note = station.note.ifBlank { null },
        )
    }
    if (stations.isEmpty()) return this
    val hasInvalidCapturedStation = stations.any { station ->
        station.captureState.requiresNumericReadings() && (station.easting == null || station.northing == null)
    }
    if (hasInvalidCapturedStation) return this

    val surveyId = roundnessSurveyDraft.editingSurveyId ?: "roundness-${((savedRoundnessSurvey?.surveys?.size ?: 0) + 1).toString().padStart(2, '0')}"
    val nextBand = RoundnessSurveyBand(
        surveyId = surveyId,
        label = roundnessSurveyDraft.surveyLabel.ifBlank { "Ring ${((savedRoundnessSurvey?.surveys?.size ?: 0) + 1)}" },
        heightReference = roundnessSurveyDraft.heightReference.ifBlank { null },
        stationCount = parsedCount,
        stations = stations,
    )
    val currentBands = savedRoundnessSurvey?.surveys.orEmpty()
    val nextBands = if (roundnessSurveyDraft.editingSurveyId == null) {
        currentBands + nextBand
    } else {
        currentBands.map { band -> if (band.surveyId == roundnessSurveyDraft.editingSurveyId) nextBand else band }
    }

    val committedScope = committedScopeBaseline()
    return copy(
        savedRoundnessSurvey = RoundnessSurvey(nextBands),
        roundnessSurveyDraft = RoundnessSurveyDraftInput(
            surveyLabel = "Ring ${nextBands.size + 1}",
            heightReference = roundnessSurveyDraft.heightReference,
            stationCount = roundnessSurveyDraft.stationCount,
            stations = defaultRoundnessSurveyStationDrafts(
                stationCount = parsedCount,
                startAngleDeg = committedScope.referenceAzimuthDeg(),
                rotationDirection = committedScope.rotationDirection,
            ),
        ),
    )
}

fun FieldDraftState.editRoundnessSurveyBand(surveyId: String): FieldDraftState {
    val band = savedRoundnessSurvey?.surveys?.firstOrNull { it.surveyId == surveyId } ?: return this
    return copy(
        roundnessSurveyDraft = RoundnessSurveyDraftInput(
            editingSurveyId = band.surveyId,
            surveyLabel = band.label,
            heightReference = band.heightReference.orEmpty(),
            stationCount = band.stationCount.toString(),
            stations = band.stations.map { station ->
                RoundnessSurveyStationDraftInput(
                    stationId = station.stationId,
                    angleDeg = station.angleDeg,
                    easting = station.easting?.toString().orEmpty(),
                    northing = station.northing?.toString().orEmpty(),
                    captureState = station.captureState,
                    note = station.note.orEmpty(),
                )
            },
        ),
    )
}

fun FieldDraftState.removeRoundnessSurveyBand(surveyId: String): FieldDraftState {
    val remaining = savedRoundnessSurvey?.surveys.orEmpty().filterNot { it.surveyId == surveyId }
    val nextSaved = remaining.takeIf { it.isNotEmpty() }?.let(::RoundnessSurvey)
    val nextDraft = if (roundnessSurveyDraft.editingSurveyId == surveyId) {
        val committedScope = committedScopeBaseline()
        RoundnessSurveyDraftInput(
            surveyLabel = "Ring ${(remaining.size + 1)}",
            stations = defaultRoundnessSurveyStationDrafts(
                stationCount = roundnessSurveyDraft.stationCount.toIntOrNull()?.coerceAtLeast(1) ?: 26,
                startAngleDeg = committedScope.referenceAzimuthDeg(),
                rotationDirection = committedScope.rotationDirection,
            ),
        )
    } else {
        roundnessSurveyDraft
    }
    return copy(
        savedRoundnessSurvey = nextSaved,
        roundnessSurveyDraft = nextDraft,
    )
}

fun FieldDraftState.updatePlumbnessSurveyStationCount(countText: String): FieldDraftState {
    val normalized = countText.filter { char -> char.isDigit() }
    val parsedCount = normalized.toIntOrNull()?.coerceAtLeast(1)
    val committedScope = committedScopeBaseline()
    val templateStations = defaultPlumbnessSurveyStationDrafts(
        stationCount = parsedCount ?: plumbnessSurveyDraft.stations.size.coerceAtLeast(1),
        startAngleDeg = committedScope.referenceAzimuthDeg(),
        rotationDirection = committedScope.rotationDirection,
    )
    val nextStations = templateStations.mapIndexed { index, template ->
        val existing = plumbnessSurveyDraft.stations.getOrNull(index)
        template.copy(
            plumbness = existing?.plumbness.orEmpty(),
            captureState = existing?.captureState ?: MeasurementCaptureState.CAPTURED,
            note = existing?.note.orEmpty(),
        )
    }
    return copy(
        plumbnessSurveyDraft = plumbnessSurveyDraft.copy(
            stationCount = normalized,
            stations = nextStations,
        ),
    )
}

fun FieldDraftState.updatePlumbnessSurveyStation(
    stationId: String,
    plumbness: String? = null,
    captureState: MeasurementCaptureState? = null,
    note: String? = null,
): FieldDraftState =
    copy(
        plumbnessSurveyDraft = plumbnessSurveyDraft.copy(
            stations = plumbnessSurveyDraft.stations.map { station ->
                if (station.stationId == stationId) {
                    station.copy(
                        plumbness = plumbness ?: station.plumbness,
                        captureState = captureState ?: station.captureState,
                        note = note ?: station.note,
                    )
                } else {
                    station
                }
            },
        ),
    )

fun FieldDraftState.savePlumbnessSurveyDraft(): FieldDraftState {
    val parsedCount = plumbnessSurveyDraft.stationCount.toIntOrNull()?.takeIf { it > 0 } ?: return this
    val stations = plumbnessSurveyDraft.stations.take(parsedCount).map { station ->
        PlumbnessSurveyStation(
            stationId = station.stationId,
            angleDeg = station.angleDeg,
            plumbness = station.plumbness.trim().toDoubleOrNull(),
            captureState = station.captureState,
            note = station.note.ifBlank { null },
        )
    }
    if (stations.isEmpty()) return this
    val hasInvalidCapturedStation = stations.any { station ->
        station.captureState.requiresNumericReadings() && station.plumbness == null
    }
    if (hasInvalidCapturedStation) return this
    return copy(
        savedPlumbnessSurvey = PlumbnessSurvey(
            stationCount = parsedCount,
            stations = stations,
        ),
    )
}

fun FieldDraftState.saveRoofFeatureDraft(): FieldDraftState {
    val roofSurfaceId = roofFeatureDraft.roofSurfaceId.ifBlank { normalizedActiveRoofSurfaceId() }
    if (!hasSavedRoofLayout(roofSurfaceId) || hasPendingRoofLayoutChanges(roofSurfaceId)) return this
    val type = roofFeatureDraft.type.trim()
    if (type.isBlank()) return this

    val requestedCount = if (roofFeatureUsesCenterPlacement(type)) {
        1
    } else {
        roofFeatureDraft.quantity.toIntOrNull()?.takeIf { it > 0 } ?: return this
    }
    val existingOfType = roofFeatures.filter { it.type == type && it.roofSurfaceId == roofSurfaceId }
    val remainingFeatures = roofFeatures.filterNot { it.type == type && it.roofSurfaceId == roofSurfaceId }
    val existingByLabel = existingOfType.associateBy { it.label.orEmpty() }
    val linkedPlateIds = resizedRoofFeatureLinks(
        links = roofFeatureDraft.linkedPlateIds,
        count = requestedCount,
    )
    val azimuthDegrees = resizedRoofFeatureValues(roofFeatureDraft.azimuthDegrees, requestedCount)
    val radiusRatios = resizedRoofFeatureValues(roofFeatureDraft.radiusRatios, requestedCount)
    var nextSequence = nextRoofFeatureSequenceStart()

    val nextFeatures = (1..requestedCount).map { index ->
        val generatedLabel = generatedRoofFeatureLabel(type, index)
        val existingFeature = existingByLabel[generatedLabel] ?: existingOfType.getOrNull(index - 1)
        val isCenterPlacement = roofFeatureUsesCenterPlacement(type)
        val azimuthDeg = normalizeDegrees(azimuthDegrees[index - 1])
        val radiusRatio = parseNormalizedDecimal(radiusRatios[index - 1])?.takeIf { ratio ->
            ratio in 0.0..1.0
        }
        val linkedPlateId = linkedPlateIds[index - 1].ifBlank { null }
        RoofFeature(
            featureId = existingFeature?.featureId ?: "roof-feature-${nextSequence++.toString().padStart(3, '0')}",
            roofSurfaceId = roofSurfaceId,
            type = type,
            label = generatedLabel,
            placementMode = when {
                isCenterPlacement -> "center"
                azimuthDeg != null && radiusRatio != null && linkedPlateId != null -> "plate_linked_positioned"
                azimuthDeg != null && radiusRatio != null -> "positioned"
                linkedPlateId != null -> "plate_linked"
                else -> "unlinked"
            },
            plateId = if (isCenterPlacement) null else linkedPlateId,
            azimuthDeg = if (isCenterPlacement) null else azimuthDeg,
            radiusRatio = if (isCenterPlacement) null else radiusRatio,
        )
    }

    return copy(
        roofFeatures = remainingFeatures + nextFeatures,
        roofFeatureDraft = roofFeatureDraft.copy(
            roofSurfaceId = roofSurfaceId,
            editingFeatureId = null,
            quantity = requestedCount.toString(),
            linkedPlateIds = if (roofFeatureUsesCenterPlacement(type)) listOf("") else linkedPlateIds,
            azimuthDegrees = if (roofFeatureUsesCenterPlacement(type)) listOf("") else azimuthDegrees,
            radiusRatios = if (roofFeatureUsesCenterPlacement(type)) listOf("") else radiusRatios,
            label = "",
            plateId = "",
            azimuthDeg = "",
            radiusRatio = "",
            placementMode = if (roofFeatureUsesCenterPlacement(type)) "center" else "plate_linked",
        ),
    )
}

fun FieldDraftState.editRoofFeature(featureId: String): FieldDraftState {
    val feature = roofFeatures.firstOrNull { it.featureId == featureId } ?: return this
    return editRoofFeatureType(feature.type, feature.roofSurfaceId ?: normalizedActiveRoofSurfaceId())
}

fun FieldDraftState.removeRoofFeature(featureId: String): FieldDraftState =
    copy(roofFeatures = roofFeatures.filterNot { it.featureId == featureId })

fun FieldDraftState.selectRoofFeatureType(
    type: String,
    roofSurfaceId: String = normalizedActiveRoofSurfaceId(),
): FieldDraftState {
    val existingOfType = savedRoofFeaturesOfType(type, roofSurfaceId)
    val requestedCount = when {
        roofFeatureUsesCenterPlacement(type) -> 1
        existingOfType.isNotEmpty() -> existingOfType.size
        else -> roofFeatureDraft.quantity.toIntOrNull()?.takeIf { it > 0 } ?: 1
    }
    val linkedPlateIds = if (roofFeatureUsesCenterPlacement(type)) {
        listOf("")
    } else {
        resizedRoofFeatureLinks(existingOfType.map { it.plateId.orEmpty() }, requestedCount)
    }
    val azimuthDegrees = if (roofFeatureUsesCenterPlacement(type)) {
        listOf("")
    } else {
        resizedRoofFeatureValues(existingOfType.map { it.azimuthDeg?.toInt()?.toString().orEmpty() }, requestedCount)
    }
    val radiusRatios = if (roofFeatureUsesCenterPlacement(type)) {
        listOf("")
    } else {
        resizedRoofFeatureValues(existingOfType.map { it.radiusRatio?.let { value -> "%.2f".format(value) }.orEmpty() }, requestedCount)
    }
    return copy(
        roofFeatureDraft = RoofFeatureDraftInput(
            roofSurfaceId = roofSurfaceId,
            type = type,
            quantity = requestedCount.toString(),
            linkedPlateIds = linkedPlateIds,
            azimuthDegrees = azimuthDegrees,
            radiusRatios = radiusRatios,
            placementMode = if (roofFeatureUsesCenterPlacement(type)) "center" else "plate_linked",
        ),
    )
}

fun FieldDraftState.updateRoofFeatureDraftCount(quantity: String): FieldDraftState {
    if (roofFeatureUsesCenterPlacement(roofFeatureDraft.type)) {
        return copy(
            roofFeatureDraft = roofFeatureDraft.copy(
                quantity = "1",
                linkedPlateIds = listOf(""),
                placementMode = "center",
            ),
        )
    }
    val parsedCount = quantity.toIntOrNull()?.takeIf { it > 0 }
    return copy(
        roofFeatureDraft = roofFeatureDraft.copy(
            quantity = quantity,
            linkedPlateIds = parsedCount?.let { count ->
                resizedRoofFeatureLinks(roofFeatureDraft.linkedPlateIds, count)
            } ?: roofFeatureDraft.linkedPlateIds,
            azimuthDegrees = parsedCount?.let { count ->
                resizedRoofFeatureValues(roofFeatureDraft.azimuthDegrees, count)
            } ?: roofFeatureDraft.azimuthDegrees,
            radiusRatios = parsedCount?.let { count ->
                resizedRoofFeatureValues(roofFeatureDraft.radiusRatios, count)
            } ?: roofFeatureDraft.radiusRatios,
            placementMode = "plate_linked",
        ),
    )
}

fun FieldDraftState.assignRoofFeatureDraftPlate(index: Int, plateId: String): FieldDraftState {
    val count = if (roofFeatureUsesCenterPlacement(roofFeatureDraft.type)) {
        1
    } else {
        roofFeatureDraft.quantity.toIntOrNull()?.takeIf { it > 0 } ?: roofFeatureDraft.linkedPlateIds.size.coerceAtLeast(1)
    }
    val nextLinks = resizedRoofFeatureLinks(roofFeatureDraft.linkedPlateIds, count).toMutableList()
    if (index in nextLinks.indices) {
        nextLinks[index] = plateId
    }
    return copy(roofFeatureDraft = roofFeatureDraft.copy(linkedPlateIds = nextLinks))
}

fun FieldDraftState.assignRoofFeatureDraftPosition(
    index: Int,
    azimuthDeg: Double,
    radiusRatio: Double,
    plateId: String? = null,
): FieldDraftState {
    val count = if (roofFeatureUsesCenterPlacement(roofFeatureDraft.type)) {
        1
    } else {
        roofFeatureDraft.quantity.toIntOrNull()?.takeIf { it > 0 } ?: roofFeatureDraft.linkedPlateIds.size.coerceAtLeast(1)
    }
    val nextAzimuths = resizedRoofFeatureValues(roofFeatureDraft.azimuthDegrees, count).toMutableList()
    val nextRatios = resizedRoofFeatureValues(roofFeatureDraft.radiusRatios, count).toMutableList()
    val nextLinks = resizedRoofFeatureLinks(roofFeatureDraft.linkedPlateIds, count).toMutableList()
    if (index in nextAzimuths.indices) {
        nextAzimuths[index] = azimuthDeg.toInt().toString()
        nextRatios[index] = "%.2f".format(radiusRatio)
        plateId?.let { nextLinks[index] = it }
    }
    return copy(
        roofFeatureDraft = roofFeatureDraft.copy(
            azimuthDegrees = nextAzimuths,
            radiusRatios = nextRatios,
            linkedPlateIds = nextLinks,
        ),
    )
}

fun FieldDraftState.clearRoofFeatureDraftPosition(index: Int): FieldDraftState {
    val count = if (roofFeatureUsesCenterPlacement(roofFeatureDraft.type)) {
        1
    } else {
        roofFeatureDraft.quantity.toIntOrNull()?.takeIf { it > 0 } ?: roofFeatureDraft.linkedPlateIds.size.coerceAtLeast(1)
    }
    val nextAzimuths = resizedRoofFeatureValues(roofFeatureDraft.azimuthDegrees, count).toMutableList()
    val nextRatios = resizedRoofFeatureValues(roofFeatureDraft.radiusRatios, count).toMutableList()
    if (index in nextAzimuths.indices) {
        nextAzimuths[index] = ""
        nextRatios[index] = ""
    }
    return copy(
        roofFeatureDraft = roofFeatureDraft.copy(
            azimuthDegrees = nextAzimuths,
            radiusRatios = nextRatios,
        ),
    )
}

fun FieldDraftState.editRoofFeatureType(
    type: String,
    roofSurfaceId: String = normalizedActiveRoofSurfaceId(),
): FieldDraftState {
    val existingOfType = savedRoofFeaturesOfType(type, roofSurfaceId)
    val requestedCount = if (roofFeatureUsesCenterPlacement(type)) 1 else existingOfType.size.coerceAtLeast(1)
    val linkedPlateIds = if (roofFeatureUsesCenterPlacement(type)) {
        listOf("")
    } else {
        resizedRoofFeatureLinks(existingOfType.map { it.plateId.orEmpty() }, requestedCount)
    }
    val azimuthDegrees = if (roofFeatureUsesCenterPlacement(type)) {
        listOf("")
    } else {
        resizedRoofFeatureValues(existingOfType.map { it.azimuthDeg?.toInt()?.toString().orEmpty() }, requestedCount)
    }
    val radiusRatios = if (roofFeatureUsesCenterPlacement(type)) {
        listOf("")
    } else {
        resizedRoofFeatureValues(existingOfType.map { it.radiusRatio?.let { value -> "%.2f".format(value) }.orEmpty() }, requestedCount)
    }
    return copy(
        roofFeatureDraft = RoofFeatureDraftInput(
            roofSurfaceId = roofSurfaceId,
            type = type,
            quantity = requestedCount.toString(),
            linkedPlateIds = linkedPlateIds,
            azimuthDegrees = azimuthDegrees,
            radiusRatios = radiusRatios,
            placementMode = if (roofFeatureUsesCenterPlacement(type)) "center" else "plate_linked",
        ),
    )
}

fun FieldDraftState.removeRoofFeatureType(
    type: String,
    roofSurfaceId: String = normalizedActiveRoofSurfaceId(),
): FieldDraftState =
    copy(
        roofFeatures = roofFeatures.filterNot { it.type == type && it.roofSurfaceId == roofSurfaceId },
        roofFeatureDraft = if (roofFeatureDraft.type == type && roofFeatureDraft.roofSurfaceId == roofSurfaceId) {
            RoofFeatureDraftInput(
                roofSurfaceId = roofSurfaceId,
                type = type,
                quantity = if (roofFeatureUsesCenterPlacement(type)) "1" else "1",
                linkedPlateIds = listOf(""),
                azimuthDegrees = listOf(""),
                radiusRatios = listOf(""),
                placementMode = if (roofFeatureUsesCenterPlacement(type)) "center" else "plate_linked",
            )
        } else {
            roofFeatureDraft
        },
    )

fun FieldDraftState.assignRoofFeaturePlate(featureId: String, plateId: String): FieldDraftState =
    copy(
        roofFeatures = roofFeatures.map { feature ->
            if (feature.featureId == featureId) {
                feature.copy(
                    placementMode = if (roofFeatureUsesCenterPlacement(feature.type)) "center" else "plate_linked",
                    plateId = plateId.ifBlank { null },
                )
            } else {
                feature
            }
        },
    )

fun FieldDraftState.saveRoofUtDraft(): FieldDraftState {
    val roofSurfaceId = roofUtDraft.roofSurfaceId.ifBlank { normalizedActiveRoofSurfaceId() }
    if (!hasSavedRoofLayout(roofSurfaceId) || hasPendingRoofLayoutChanges(roofSurfaceId)) return this
    val plateId = roofUtDraft.plateId.trim()
    val readings = roofUtDraft.readings.mapNotNull { it.toDoubleOrNull() }
    if (plateId.isBlank()) return this
    if (roofUtDraft.captureState.requiresNumericReadings() && readings.isEmpty()) return this

    val rowId = roofUtDraft.editingRowId ?: "${roofSurfaceId}-roof-ut-${(roofUtRows.count { it.roofSurfaceId == roofSurfaceId } + 1).toString().padStart(3, '0')}"
    val nextRow = RoofUtRow(
        rowId = rowId,
        roofSurfaceId = roofSurfaceId,
        plateId = plateId,
        readings = readings,
        captureState = roofUtDraft.captureState,
        note = roofUtDraft.note.ifBlank { null },
    )

    val nextRows = if (roofUtDraft.editingRowId == null) {
        roofUtRows + nextRow
    } else {
        roofUtRows.map { row -> if (row.rowId == roofUtDraft.editingRowId) nextRow else row }
    }

    return copy(
        roofUtRows = nextRows,
        roofUtDraft = roofUtDraft.copy(
            roofSurfaceId = roofSurfaceId,
            editingRowId = null,
            plateId = "",
            captureState = MeasurementCaptureState.CAPTURED,
            readings = List(5) { "" },
            note = "",
        ),
    )
}

fun FieldDraftState.editRoofUtRow(rowId: String): FieldDraftState {
    val row = roofUtRows.firstOrNull { it.rowId == rowId } ?: return this
    return copy(
        roofUtDraft = RoofUtDraftInput(
            roofSurfaceId = row.roofSurfaceId ?: normalizedActiveRoofSurfaceId(),
            editingRowId = row.rowId,
            plateId = row.plateId,
            captureState = row.captureState,
            readings = row.readings.map { reading -> reading.toString() }.let { values ->
                values + List(maxOf(0, 5 - values.size)) { "" }
            }.take(5),
            note = row.note.orEmpty(),
        ),
    )
}

fun FieldDraftState.removeRoofUtRow(rowId: String): FieldDraftState =
    copy(
        roofUtRows = roofUtRows.filterNot { it.rowId == rowId },
        roofUtDraft = if (roofUtDraft.editingRowId == rowId) RoofUtDraftInput() else roofUtDraft,
    )

fun FieldDraftState.saveShellNozzleDraft(): FieldDraftState {
    val nozzleId = shellNozzleDraft.nozzleId.trim().ifBlank {
        "SN-${(shellNozzles.size + 1).toString().padStart(3, '0')}"
    }
    val size = shellNozzleDraft.size.trim()
    val course = shellNozzleDraft.course.toIntOrNull()?.takeIf { it > 0 }
    val azimuthDeg = normalizeDegrees(shellNozzleDraft.azimuthDeg)
    if (size.isBlank() || course == null || azimuthDeg == null) return this

    val nextNozzle = NozzleDefinition(
        nozzleId = nozzleId,
        surface = "shell",
        size = size,
        placementMode = "line_linked",
        course = course,
        azimuthDeg = azimuthDeg,
    )

    return copy(
        shellNozzles = shellNozzles.filterNot { it.nozzleId == nozzleId } + nextNozzle,
        shellNozzleDraft = ShellNozzleDraftInput(),
        shellNozzleUtDraft = shellNozzleUtDraft.copy(nozzleId = nozzleId),
    )
}

fun FieldDraftState.replaceShellNozzleRegistry(nextNozzles: List<NozzleDefinition>): FieldDraftState {
    val normalizedNext = nextNozzles.sortedBy { nozzle -> nozzle.nozzleId }
    val currentById = shellNozzles.associateBy { nozzle -> nozzle.nozzleId }
    val nextById = normalizedNext.associateBy { nozzle -> nozzle.nozzleId }
    val changedNozzleIds = (currentById.keys + nextById.keys)
        .filter { nozzleId -> currentById[nozzleId] != nextById[nozzleId] }
        .toSet()
    val editingChanged = shellNozzleUtDraft.nozzleId in changedNozzleIds ||
        shellNozzleUtRows.any { row -> row.rowId == shellNozzleUtDraft.editingRowId && row.nozzleId in changedNozzleIds }
    val baseState = if (changedNozzleIds.isNotEmpty()) {
        withoutFindingsForMeasurementIds(
            surfaces = setOf("shell_nozzle"),
            linkedMeasurementIds = changedNozzleIds,
        ).copy(
            shellNozzleUtRows = shellNozzleUtRows.filterNot { row -> row.nozzleId in changedNozzleIds },
            shellNozzleUtDraft = if (editingChanged) NozzleUtDraftInput() else shellNozzleUtDraft,
        )
    } else {
        this
    }
    val nextSelectedNozzleId = baseState.shellNozzleUtDraft.nozzleId
        .takeIf { selectedId -> normalizedNext.any { nozzle -> nozzle.nozzleId == selectedId } }
        ?: normalizedNext.firstOrNull()?.nozzleId.orEmpty()

    return baseState.copy(
        shellNozzles = normalizedNext,
        shellNozzleDraft = ShellNozzleDraftInput(),
        shellNozzleUtDraft = if (normalizedNext.isEmpty()) {
            NozzleUtDraftInput()
        } else {
            baseState.shellNozzleUtDraft.copy(nozzleId = nextSelectedNozzleId)
        },
    )
}

fun FieldDraftState.saveRoofNozzleDraft(): FieldDraftState {
    val roofSurfaceId = roofNozzleDraft.roofSurfaceId.ifBlank { normalizedActiveRoofSurfaceId() }
    if (!hasSavedRoofLayout(roofSurfaceId) || hasPendingRoofLayoutChanges(roofSurfaceId)) return this
    val nozzleId = roofNozzleDraft.nozzleId.trim().ifBlank {
        "${roofSurfaceId.uppercase()}-RN-${(roofNozzles.count { it.roofSurfaceId == roofSurfaceId } + 1).toString().padStart(3, '0')}"
    }
    val size = roofNozzleDraft.size.trim()
    val plateId = roofNozzleDraft.plateId.trim().ifBlank { null }
    if (size.isBlank() || plateId == null) return this

    val nextNozzle = NozzleDefinition(
        nozzleId = nozzleId,
        surface = "roof",
        roofSurfaceId = roofSurfaceId,
        size = size,
        placementMode = "plate_linked",
        azimuthDeg = null,
        plateId = plateId,
    )

    return copy(
        roofNozzles = roofNozzles.filterNot { it.nozzleId == nozzleId } + nextNozzle,
        roofNozzleDraft = RoofNozzleDraftInput(roofSurfaceId = roofSurfaceId),
        roofNozzleUtDraft = roofNozzleUtDraft.copy(nozzleId = nozzleId, roofSurfaceId = roofSurfaceId),
    )
}

fun FieldDraftState.replaceRoofNozzleRegistry(
    nextNozzles: List<NozzleDefinition>,
    roofSurfaceId: String = normalizedActiveRoofSurfaceId(),
): FieldDraftState {
    val normalizedNext = nextNozzles.sortedBy { nozzle -> nozzle.nozzleId }
    val currentSurfaceNozzles = roofNozzles.filter { it.roofSurfaceId == roofSurfaceId }.sortedBy { it.nozzleId }
    val currentById = currentSurfaceNozzles.associateBy { nozzle -> nozzle.nozzleId }
    val nextById = normalizedNext.associateBy { nozzle -> nozzle.nozzleId }
    val changedNozzleIds = (currentById.keys + nextById.keys)
        .filter { nozzleId -> currentById[nozzleId] != nextById[nozzleId] }
        .toSet()
    val editingChanged = roofNozzleUtDraft.roofSurfaceId == roofSurfaceId &&
        (roofNozzleUtDraft.nozzleId in changedNozzleIds ||
            roofNozzleUtRows.any { row ->
                row.rowId == roofNozzleUtDraft.editingRowId &&
                    row.roofSurfaceId == roofSurfaceId &&
                    row.nozzleId in changedNozzleIds
            })
    val baseState = if (changedNozzleIds.isNotEmpty()) {
        withoutFindingsForMeasurementIds(
            surfaces = setOf(roofNozzleFindingSurface(roofSurfaceId)),
            linkedMeasurementIds = changedNozzleIds,
        ).copy(
            roofNozzleUtRows = roofNozzleUtRows.filterNot { row ->
                row.roofSurfaceId == roofSurfaceId && row.nozzleId in changedNozzleIds
            },
            roofNozzleUtDraft = if (editingChanged) NozzleUtDraftInput(roofSurfaceId = roofSurfaceId) else roofNozzleUtDraft,
        )
    } else {
        this
    }
    val nextSelectedNozzleId = baseState.roofNozzleUtDraft.nozzleId
        .takeIf { selectedId -> normalizedNext.any { nozzle -> nozzle.nozzleId == selectedId } }
        ?: normalizedNext.firstOrNull()?.nozzleId.orEmpty()

    return baseState.copy(
        roofNozzles = baseState.roofNozzles.filterNot { it.roofSurfaceId == roofSurfaceId } + normalizedNext,
        roofNozzleDraft = RoofNozzleDraftInput(roofSurfaceId = roofSurfaceId),
        roofNozzleUtDraft = if (normalizedNext.isEmpty()) {
            NozzleUtDraftInput(roofSurfaceId = roofSurfaceId)
        } else {
            baseState.roofNozzleUtDraft.copy(nozzleId = nextSelectedNozzleId, roofSurfaceId = roofSurfaceId)
        },
    )
}

fun FieldDraftState.saveShellNozzleUtDraft(): FieldDraftState {
    val nozzleId = shellNozzleUtDraft.nozzleId.ifBlank { shellNozzles.firstOrNull()?.nozzleId.orEmpty() }
    val nozzleDefinition = shellNozzles.firstOrNull { nozzle -> nozzle.nozzleId == nozzleId }
    val includesPad = nozzleDefinition?.hasReinforcementPad != false
    val expectedReadingCount = if (includesPad) 5 else 4
    val parsedReadings = shellNozzleUtDraft.readings.take(expectedReadingCount).map { reading -> reading.trim().toDoubleOrNull() }
    if (nozzleId.isBlank()) return this
    if (shellNozzleUtDraft.captureState.requiresNumericReadings() && (parsedReadings.any { it == null } || parsedReadings.size < expectedReadingCount)) {
        return this
    }
    val bodyReadings = if (shellNozzleUtDraft.captureState.requiresNumericReadings()) {
        parsedReadings.take(4).filterNotNull()
    } else {
        emptyList()
    }
    val reinforcementPadReading = if (includesPad && shellNozzleUtDraft.captureState.requiresNumericReadings()) {
        parsedReadings.getOrNull(4)
    } else {
        null
    }

    val existingRowForNozzle = shellNozzleUtRows.firstOrNull { row -> row.nozzleId == nozzleId }
    val targetRowId = shellNozzleUtDraft.editingRowId
        ?: existingRowForNozzle?.rowId
        ?: "shell-nozzle-ut-${(shellNozzleUtRows.size + 1).toString().padStart(3, '0')}"

    val nextRow = NozzleUtRow(
        rowId = targetRowId,
        nozzleId = nozzleId,
        bodyReadings = bodyReadings,
        reinforcementPadReading = reinforcementPadReading,
        captureState = shellNozzleUtDraft.captureState,
        note = shellNozzleUtDraft.note.ifBlank { null },
    )

    val nextRows = when {
        shellNozzleUtDraft.editingRowId != null ->
            shellNozzleUtRows.map { row -> if (row.rowId == shellNozzleUtDraft.editingRowId) nextRow else row }
        existingRowForNozzle != null ->
            shellNozzleUtRows.map { row -> if (row.rowId == existingRowForNozzle.rowId) nextRow else row }
        else ->
            shellNozzleUtRows + nextRow
    }

    return copy(
        shellNozzleUtRows = nextRows,
        shellNozzleUtDraft = shellNozzleUtDraft.copy(
            editingRowId = null,
            captureState = MeasurementCaptureState.CAPTURED,
            readings = List(5) { "" },
            note = "",
        ),
    )
}

fun FieldDraftState.saveRoofNozzleUtDraft(): FieldDraftState {
    val roofSurfaceId = roofNozzleUtDraft.roofSurfaceId.ifBlank { normalizedActiveRoofSurfaceId() }
    if (!hasSavedRoofLayout(roofSurfaceId) || hasPendingRoofLayoutChanges(roofSurfaceId)) return this
    val surfaceNozzles = roofNozzles.filter { nozzle -> nozzle.roofSurfaceId == roofSurfaceId }
    val nozzleId = roofNozzleUtDraft.nozzleId.ifBlank { surfaceNozzles.firstOrNull()?.nozzleId.orEmpty() }
    val nozzleDefinition = surfaceNozzles.firstOrNull { nozzle -> nozzle.nozzleId == nozzleId }
    val includesPad = nozzleDefinition?.hasReinforcementPad != false
    val expectedReadingCount = if (includesPad) 5 else 4
    val parsedReadings = roofNozzleUtDraft.readings.take(expectedReadingCount).map { reading -> reading.trim().toDoubleOrNull() }
    if (nozzleId.isBlank()) return this
    if (roofNozzleUtDraft.captureState.requiresNumericReadings() && (parsedReadings.any { it == null } || parsedReadings.size < expectedReadingCount)) {
        return this
    }
    val bodyReadings = if (roofNozzleUtDraft.captureState.requiresNumericReadings()) {
        parsedReadings.take(4).filterNotNull()
    } else {
        emptyList()
    }
    val reinforcementPadReading = if (includesPad && roofNozzleUtDraft.captureState.requiresNumericReadings()) {
        parsedReadings.getOrNull(4)
    } else {
        null
    }

    val existingRowForNozzle = roofNozzleUtRows.firstOrNull { row ->
        row.nozzleId == nozzleId && row.roofSurfaceId == roofSurfaceId
    }
    val targetRowId = roofNozzleUtDraft.editingRowId
        ?: existingRowForNozzle?.rowId
        ?: "roof-nozzle-ut-${roofSurfaceId}-${(roofNozzleUtRows.count { it.roofSurfaceId == roofSurfaceId } + 1).toString().padStart(3, '0')}"

    val nextRow = NozzleUtRow(
        rowId = targetRowId,
        nozzleId = nozzleId,
        roofSurfaceId = roofSurfaceId,
        bodyReadings = bodyReadings,
        reinforcementPadReading = reinforcementPadReading,
        captureState = roofNozzleUtDraft.captureState,
        note = roofNozzleUtDraft.note.ifBlank { null },
    )

    val nextRows = when {
        roofNozzleUtDraft.editingRowId != null ->
            roofNozzleUtRows.map { row -> if (row.rowId == roofNozzleUtDraft.editingRowId) nextRow else row }
        existingRowForNozzle != null ->
            roofNozzleUtRows.map { row -> if (row.rowId == existingRowForNozzle.rowId) nextRow else row }
        else ->
            roofNozzleUtRows + nextRow
    }

    return copy(
        roofNozzleUtRows = nextRows,
        roofNozzleUtDraft = roofNozzleUtDraft.copy(
            roofSurfaceId = roofSurfaceId,
            editingRowId = null,
            captureState = MeasurementCaptureState.CAPTURED,
            readings = List(5) { "" },
            note = "",
        ),
    )
}

fun FieldDraftState.editShellNozzleUtRow(rowId: String): FieldDraftState {
    val row = shellNozzleUtRows.firstOrNull { savedRow -> savedRow.rowId == rowId } ?: return this
    val readings = buildList {
        addAll(row.bodyReadings.map { reading -> reading.toString() })
        row.reinforcementPadReading?.let { pad -> add(pad.toString()) }
    }
    return copy(
        shellNozzleUtDraft = NozzleUtDraftInput(
            editingRowId = row.rowId,
            nozzleId = row.nozzleId,
            captureState = row.captureState,
            readings = (readings + List(maxOf(0, 5 - readings.size)) { "" }).take(5),
            note = row.note.orEmpty(),
        ),
    )
}

fun FieldDraftState.removeShellNozzleUtRow(rowId: String): FieldDraftState =
    copy(
        shellNozzleUtRows = shellNozzleUtRows.filterNot { row -> row.rowId == rowId },
        shellNozzleUtDraft = if (shellNozzleUtDraft.editingRowId == rowId) NozzleUtDraftInput() else shellNozzleUtDraft,
    )

fun FieldDraftState.beginShellNozzleUtForNozzle(nozzleId: String): FieldDraftState {
    val existingRow = shellNozzleUtRows.firstOrNull { row -> row.nozzleId == nozzleId }
    return if (existingRow != null) {
        editShellNozzleUtRow(existingRow.rowId)
    } else {
        copy(
            shellNozzleUtDraft = NozzleUtDraftInput(
                nozzleId = nozzleId,
                captureState = MeasurementCaptureState.CAPTURED,
                readings = List(5) { "" },
                note = "",
            ),
        )
    }
}

fun FieldDraftState.removeShellNozzleUtForNozzle(nozzleId: String): FieldDraftState {
    val remainingRows = shellNozzleUtRows.filterNot { row -> row.nozzleId == nozzleId }
    val isEditingRemovedNozzle = shellNozzleUtDraft.nozzleId == nozzleId ||
        shellNozzleUtRows.any { row -> row.nozzleId == nozzleId && row.rowId == shellNozzleUtDraft.editingRowId }
    return copy(
        shellNozzleUtRows = remainingRows,
        shellNozzleUtDraft = if (isEditingRemovedNozzle) NozzleUtDraftInput() else shellNozzleUtDraft,
    )
}

fun FieldDraftState.editRoofNozzleUtRow(rowId: String): FieldDraftState {
    val row = roofNozzleUtRows.firstOrNull { savedRow -> savedRow.rowId == rowId } ?: return this
    val readings = buildList {
        addAll(row.bodyReadings.map { reading -> reading.toString() })
        row.reinforcementPadReading?.let { pad -> add(pad.toString()) }
    }
    return copy(
        roofNozzleUtDraft = NozzleUtDraftInput(
            roofSurfaceId = row.roofSurfaceId.orEmpty(),
            editingRowId = row.rowId,
            nozzleId = row.nozzleId,
            captureState = row.captureState,
            readings = (readings + List(maxOf(0, 5 - readings.size)) { "" }).take(5),
            note = row.note.orEmpty(),
        ),
    )
}

fun FieldDraftState.removeRoofNozzleUtRow(rowId: String): FieldDraftState =
    copy(
        roofNozzleUtRows = roofNozzleUtRows.filterNot { row -> row.rowId == rowId },
        roofNozzleUtDraft = if (roofNozzleUtDraft.editingRowId == rowId) NozzleUtDraftInput() else roofNozzleUtDraft,
    )

fun FieldDraftState.beginRoofNozzleUtForNozzle(
    nozzleId: String,
    roofSurfaceId: String = normalizedActiveRoofSurfaceId(),
): FieldDraftState {
    val existingRow = roofNozzleUtRows.firstOrNull { row ->
        row.nozzleId == nozzleId && row.roofSurfaceId == roofSurfaceId
    }
    return if (existingRow != null) {
        editRoofNozzleUtRow(existingRow.rowId)
    } else {
        copy(
            roofNozzleUtDraft = NozzleUtDraftInput(
                roofSurfaceId = roofSurfaceId,
                nozzleId = nozzleId,
                captureState = MeasurementCaptureState.CAPTURED,
                readings = List(5) { "" },
                note = "",
            ),
        )
    }
}

fun FieldDraftState.removeRoofNozzleUtForNozzle(
    nozzleId: String,
    roofSurfaceId: String = normalizedActiveRoofSurfaceId(),
): FieldDraftState {
    val remainingRows = roofNozzleUtRows.filterNot { row ->
        row.nozzleId == nozzleId && row.roofSurfaceId == roofSurfaceId
    }
    val isEditingRemovedNozzle = roofNozzleUtDraft.nozzleId == nozzleId &&
        roofNozzleUtDraft.roofSurfaceId == roofSurfaceId
    return copy(
        roofNozzleUtRows = remainingRows,
        roofNozzleUtDraft = if (isEditingRemovedNozzle) NozzleUtDraftInput() else roofNozzleUtDraft,
    )
}

fun FieldDraftState.saveFindingDraft(): FieldDraftState {
    val note = findingDraft.note.trim()
    val editingFinding = findingDraft.editingFindingId?.let { editingId ->
        findings.firstOrNull { finding -> finding.findingId == editingId }
    }
    val existingAttachment = editingFinding
        ?.attachmentIds
        ?.firstOrNull()
        ?.let { attachmentId -> attachments.firstOrNull { attachment -> attachment.attachmentId == attachmentId } }
    val resolvedPhotoPath = findingDraft.photoRelativePath.ifBlank { existingAttachment?.relativePath.orEmpty() }
    val hasPhoto = resolvedPhotoPath.isNotBlank()
    if (note.isBlank() && !hasPhoto) return this

    val nextAttachmentId = when {
        !hasPhoto -> null
        existingAttachment != null && existingAttachment.relativePath == resolvedPhotoPath -> existingAttachment.attachmentId
        else -> "photo-${(attachments.size + 1).toString().padStart(3, '0')}"
    }
    val nextFindingId = editingFinding?.findingId ?: "finding-${(findings.size + 1).toString().padStart(3, '0')}"

    val nextFinding = FindingRecord(
        findingId = nextFindingId,
        surface = findingDraft.surface,
        type = findingDraft.type,
        severity = findingDraft.severity,
        note = note,
        linkedMeasurementId = findingDraft.linkedMeasurementId.ifBlank { null },
        locationSummary = resolvedFindingLocationSummary(),
        preciseLineId = findingDraft.preciseLineId.ifBlank { null },
        preciseCourse = findingDraft.preciseCourse.toIntOrNull()?.takeIf { it > 0 },
        attachmentIds = listOfNotNull(nextAttachmentId),
    )

    val nextFindings = if (editingFinding == null) {
        findings + nextFinding
    } else {
        findings.map { finding -> if (finding.findingId == editingFinding.findingId) nextFinding else finding }
    }

    val generatedCaption = generatedFindingAttachmentCaption(nextFinding)
    val attachmentCandidates = when {
        nextAttachmentId == null -> attachments
        existingAttachment != null && existingAttachment.attachmentId == nextAttachmentId -> attachments.map { attachment ->
            if (attachment.attachmentId == nextAttachmentId) {
                attachment.copy(
                    relativePath = resolvedPhotoPath,
                    caption = generatedCaption,
                )
            } else {
                attachment
            }
        }
        else -> attachments + AttachmentRecord(
            attachmentId = nextAttachmentId,
            kind = "photo",
            relativePath = resolvedPhotoPath,
            caption = generatedCaption,
        )
    }
    val retainedAttachmentIds = nextFindings.flatMap { finding -> finding.attachmentIds }.toSet() +
        listOfNotNull(mflImportDraft.attachmentId)
    val nextAttachments = attachmentCandidates.filter { attachment -> attachment.attachmentId in retainedAttachmentIds }

    return copy(
        findings = nextFindings,
        attachments = nextAttachments,
        findingDraft = findingDraft.copy(
            editingFindingId = null,
            note = "",
            photoCaption = "",
            photoRelativePath = "",
        ),
    )
}

fun FieldDraftState.editFinding(findingId: String): FieldDraftState {
    val finding = findings.firstOrNull { savedFinding -> savedFinding.findingId == findingId } ?: return this
    val attachment = finding.attachmentIds.firstOrNull()?.let { attachmentId ->
        attachments.firstOrNull { savedAttachment -> savedAttachment.attachmentId == attachmentId }
    }
    return copy(
        findingDraft = findingDraft.copy(
            editingFindingId = finding.findingId,
            surface = finding.surface,
            type = finding.type,
            severity = finding.severity,
            note = finding.note.orEmpty(),
            linkedMeasurementId = finding.linkedMeasurementId.orEmpty(),
            locationSummary = finding.locationSummary.orEmpty(),
            preciseLineId = finding.preciseLineId.orEmpty(),
            preciseCourse = finding.preciseCourse?.toString().orEmpty(),
            preciseOffsetPercent = "",
            photoCaption = "",
            photoRelativePath = attachment?.relativePath.orEmpty(),
        ),
    )
}

fun FieldDraftState.removeFinding(findingId: String): FieldDraftState {
    val nextFindings = findings.filterNot { finding -> finding.findingId == findingId }
    val retainedAttachmentIds = nextFindings.flatMap { finding -> finding.attachmentIds }.toSet() +
        listOfNotNull(mflImportDraft.attachmentId)
    return copy(
        findings = nextFindings,
        attachments = attachments.filter { attachment -> attachment.attachmentId in retainedAttachmentIds },
        findingDraft = if (findingDraft.editingFindingId == findingId) {
            findingDraft.copy(
                editingFindingId = null,
                note = "",
                photoCaption = "",
                photoRelativePath = "",
            )
        } else {
            findingDraft
        },
    )
}

fun FieldDraftState.beginFindingForMeasurement(
    surface: String,
    linkedMeasurementId: String = "",
    locationSummary: String = "",
    preciseLineId: String = "",
    preciseCourse: String = "",
    preciseOffsetPercent: String = "",
): FieldDraftState =
    copy(
        findingDraft = findingDraft.copy(
            editingFindingId = null,
            surface = surface,
            linkedMeasurementId = linkedMeasurementId,
            locationSummary = locationSummary,
            preciseLineId = if (surface == "shell") preciseLineId else "",
            preciseCourse = if (surface == "shell") preciseCourse else "",
            preciseOffsetPercent = if (surface == "shell") preciseOffsetPercent else "",
            note = "",
            photoCaption = "",
            photoRelativePath = "",
        ),
    )

fun FieldDraftState.findingsForMeasurement(
    surface: String,
    linkedMeasurementId: String = "",
    locationSummary: String = "",
): List<FindingRecord> =
    findings.filter { finding ->
        finding.surface == surface &&
            when {
                linkedMeasurementId.isNotBlank() -> finding.linkedMeasurementId == linkedMeasurementId
                locationSummary.isNotBlank() -> finding.locationSummary?.startsWith(locationSummary) == true
                else -> false
            }
    }

private fun FieldDraftState.resolvedFindingLocationSummary(): String? {
    val parts = buildList {
        findingDraft.locationSummary.ifBlank { "" }.takeIf { it.isNotBlank() }?.let { add(it) }
        if (findingDraft.surface == "shell") {
            val preciseLineId = findingDraft.preciseLineId.ifBlank { null }
            val preciseCourse = findingDraft.preciseCourse.ifBlank { null }
            if (preciseLineId != null || preciseCourse != null) {
                add(
                    listOfNotNull(
                        preciseLineId,
                        preciseCourse?.let { "Strake $it" },
                    ).joinToString(" · "),
                )
            }
        }
    }
    return parts.joinToString(" | ").ifBlank { null }
}

private fun generatedFindingAttachmentCaption(finding: FindingRecord): String =
    listOfNotNull(
        finding.locationSummary?.takeIf { it.isNotBlank() },
        finding.type.replace('_', ' ').replaceFirstChar { char -> char.uppercase() },
    ).joinToString(" - ").ifBlank { "Finding Photo" }

fun FieldDraftState.saveMflImportDraft(): FieldDraftState {
    val nextAttachmentId = mflImportDraft.attachmentId ?: if (mflImportDraft.pdfRelativePath.isNotBlank()) {
        "mfl-report"
    } else {
        null
    }

    val nextAttachments = if (nextAttachmentId != null) {
        attachments.filterNot { it.attachmentId == nextAttachmentId } + AttachmentRecord(
            attachmentId = nextAttachmentId,
            kind = "mfl_report",
            relativePath = mflImportDraft.pdfRelativePath.ifBlank { "attachments/mfl-report.pdf" },
            caption = mflImportDraft.pdfCaption.ifBlank {
                mflImportDraft.reportReference.ifBlank { "Third-party MFL report" }
            },
        )
    } else {
        attachments
    }

    return copy(
        attachments = nextAttachments,
        mflImportDraft = mflImportDraft.copy(attachmentId = nextAttachmentId),
    )
}

fun FieldDraftState.buildMflImportOrNull(): MflImport? {
    val draft = mflImportDraft
    if (
        draft.contractor.isBlank() &&
        draft.reportReference.isBlank() &&
        draft.reportDate.isBlank() &&
        draft.attachmentId.isNullOrBlank()
    ) {
        return null
    }

    return MflImport(
        contractor = draft.contractor.ifBlank { null },
        reportReference = draft.reportReference.ifBlank { null },
        reportDate = draft.reportDate.ifBlank { null },
        severity = draft.severity.ifBlank { null },
        attachmentId = draft.attachmentId,
    )
}

fun FieldDraftState.buildShellSettlementSurveyOrNull(): ShellSettlementSurvey? =
    savedShellSettlementSurvey?.takeIf { survey -> survey.stations.isNotEmpty() }

fun FieldDraftState.buildRoundnessSurveyOrNull(): RoundnessSurvey? =
    savedRoundnessSurvey?.takeIf { survey -> survey.surveys.isNotEmpty() }

fun FieldDraftState.buildPlumbnessSurveyOrNull(): PlumbnessSurvey? =
    savedPlumbnessSurvey?.takeIf { survey -> survey.stations.isNotEmpty() }

fun FieldDraftState.buildSavedRoofSurfaceLayouts(): List<ai.laiq.tankinspection.domain.model.RoofSurfaceLayout> =
    committedSetupState().availableRoofSurfaces().mapNotNull { surface ->
        buildRoofLayoutOrNull(surface.roofSurfaceId)?.takeIf { layout -> layout.isReadyForInspection() }?.let { layout ->
            ai.laiq.tankinspection.domain.model.RoofSurfaceLayout(
                roofSurfaceId = surface.roofSurfaceId,
                surfaceKind = surface.surfaceKind,
                layout = layout,
            )
        }
    }

fun FieldDraftState.toCanonicalPackage(): CanonicalInspectionPackage {
    val committedSetup = committedSetupState()
    val committedScope = committedScopeBaseline()
    val diameterM = committedSetup.diameterM.toDoubleOrNull() ?: 0.0
    val heightM = committedSetup.heightM.toDoubleOrNull() ?: 0.0
    val shellCourseCount = committedSetup.shellCourseCount.toIntOrNull() ?: 0
    val nowIso = Instant.now().toString()
    val shellLinePlan = createCommittedShellLinePlanOrNull() ?: ShellLinePlanner.createPlan(
        diameterM = diameterM.coerceAtLeast(1.0),
        explicitLineCount = committedExplicitLineCount(),
        referenceMode = committedScope.normalizedReferenceMode(),
        startReference = committedScope.resolvedStartReference(),
        startReferenceLabel = committedScope.startReferenceLabel(),
        rotationDirection = committedScope.rotationDirection,
        captureStartLaneId = committedShellCaptureStartLaneId(),
    )
    val warnings = reviewWarnings()

    return CanonicalInspectionPackage(
        schemaVersion = "0.1.0",
        packageId = "pkg-${committedSetup.tankNumber.ifBlank { "draft" }}-${startedAtIso.take(10)}",
        inspection = InspectionMeta(
            inspectionId = "insp-${committedSetup.tankNumber.ifBlank { "draft" }}-${startedAtIso.take(10)}",
            client = committedSetup.client,
            site = committedSetup.site,
            tankNumber = committedSetup.tankNumber,
            inspectionType = "internal_external",
            startedAt = startedAtIso,
            completedAt = if (warnings.isEmpty()) nowIso else null,
            inspector = committedSetup.inspector,
            deviceId = "android-field-prototype",
        ),
        tankMaster = TankMaster(
            diameterM = diameterM,
            heightM = heightM,
            roofType = committedSetup.roofSystemLabel(),
            fixedRoofType = committedSetup.fixedRoofType.takeIf { committedSetup.hasFixedRoof() },
            floatingRoofType = committedSetup.floatingRoofType.takeIf { committedSetup.hasFloatingRoof() },
            shellCourseCount = shellCourseCount,
            referenceMode = committedScope.normalizedReferenceMode(),
            startReference = committedScope.startReferenceLabel(),
        ),
        unitProfile = UnitProfile(
            thicknessUnit = committedSetup.thicknessUnit,
            settlementUnit = committedSetup.settlementUnit,
            nozzleSizeUnit = committedSetup.nozzleSizeUnit,
        ),
        shellLinePlan = shellLinePlan,
        roofLayout = buildRoofLayoutOrNull(),
        roofSurfaceLayouts = buildSavedRoofSurfaceLayouts(),
        nozzleRegistries = NozzleRegistries(
            shell = shellNozzles,
            roof = roofNozzles,
        ),
        measurements = Measurements(
            shellUtRows = shellUtRows,
            roofUtRows = roofUtRows,
            shellNozzleUtRows = shellNozzleUtRows,
            roofNozzleUtRows = roofNozzleUtRows,
        ),
        shellSettlementSurvey = buildShellSettlementSurveyOrNull(),
        roundnessSurvey = buildRoundnessSurveyOrNull(),
        plumbnessSurvey = buildPlumbnessSurveyOrNull(),
        findings = findings,
        attachments = attachments,
        mflImport = buildMflImportOrNull(),
        reviewStatus = ReviewStatus(
            status = if (warnings.isEmpty()) ReviewState.READY_FOR_UPLOAD else ReviewState.DRAFT,
            warnings = warnings,
        ),
    )
}

private fun normalizeDegrees(raw: String): Double? {
    val parsed = raw.toDoubleOrNull() ?: return null
    return when {
        parsed < 0.0 -> null
        parsed > 360.0 -> parsed % 360.0
        else -> parsed
    }
}

private fun FieldDraftState.savedRoofFeaturesOfType(
    type: String,
    roofSurfaceId: String,
): List<RoofFeature> =
    roofFeatures
        .filter { feature -> feature.type == type && feature.roofSurfaceId == roofSurfaceId }
        .sortedBy { feature -> feature.label.orEmpty() }

private fun resizedRoofFeatureLinks(
    links: List<String>,
    count: Int,
): List<String> = (links + List(maxOf(0, count - links.size)) { "" }).take(count)

private fun resizedRoofFeatureValues(
    values: List<String>,
    count: Int,
): List<String> = (values + List(maxOf(0, count - values.size)) { "" }).take(count)

private fun FieldDraftState.nextRoofFeatureSequenceStart(): Int =
    roofFeatures
        .mapNotNull { feature ->
            Regex("""roof-feature-(\d+)""")
                .matchEntire(feature.featureId)
                ?.groupValues
                ?.getOrNull(1)
                ?.toIntOrNull()
        }
        .maxOrNull()
        ?.plus(1)
        ?: 1

private fun FieldDraftState.clearShellInspectionData(): FieldDraftState =
    withoutFindingsFor(
        surfaces = setOf("shell", "shell_nozzle"),
        measurementPrefixes = setOf("shell-ut-", "shell-nozzle-ut-"),
    ).copy(
        shellUtDraft = ShellUtDraftInput(),
        shellUtRows = emptyList(),
        shellNozzleDraft = ShellNozzleDraftInput(),
        shellNozzles = emptyList(),
        shellNozzleUtDraft = NozzleUtDraftInput(),
        shellNozzleUtRows = emptyList(),
    )

private fun FieldDraftState.clearShellSettlementData(): FieldDraftState =
    copy(
        shellSettlementDraft = ShellSettlementDraftInput(
            stationCount = shellSettlementDraft.stationCount.ifBlank { "8" },
            stations = defaultShellSettlementStationDrafts(
                stationCount = shellSettlementDraft.stationCount.toIntOrNull()?.coerceAtLeast(1) ?: 8,
                startAngleDeg = committedScopeBaseline().referenceAzimuthDeg(),
                rotationDirection = committedScopeBaseline().rotationDirection,
            ),
        ),
        savedShellSettlementSurvey = null,
    )

private fun FieldDraftState.clearRoundnessSurveyData(): FieldDraftState =
    copy(
        roundnessSurveyDraft = RoundnessSurveyDraftInput(
            stations = defaultRoundnessSurveyStationDrafts(
                stationCount = roundnessSurveyDraft.stationCount.toIntOrNull()?.coerceAtLeast(1) ?: 26,
                startAngleDeg = committedScopeBaseline().referenceAzimuthDeg(),
                rotationDirection = committedScopeBaseline().rotationDirection,
            ),
        ),
        savedRoundnessSurvey = null,
    )

private fun FieldDraftState.clearPlumbnessSurveyData(): FieldDraftState =
    copy(
        plumbnessSurveyDraft = PlumbnessSurveyDraftInput(
            stationCount = plumbnessSurveyDraft.stationCount.ifBlank { "26" },
            stations = defaultPlumbnessSurveyStationDrafts(
                stationCount = plumbnessSurveyDraft.stationCount.toIntOrNull()?.coerceAtLeast(1) ?: 26,
                startAngleDeg = committedScopeBaseline().referenceAzimuthDeg(),
                rotationDirection = committedScopeBaseline().rotationDirection,
            ),
        ),
        savedPlumbnessSurvey = null,
    )

private fun FieldDraftState.clearRoofInspectionData(): FieldDraftState =
    withoutFindingsFor(
        surfaces = setOf("roof", "roof_nozzle", roofFindingSurface(ROOF_SURFACE_FIXED), roofFindingSurface(ROOF_SURFACE_FLOATING), roofNozzleFindingSurface(ROOF_SURFACE_FIXED), roofNozzleFindingSurface(ROOF_SURFACE_FLOATING)),
        measurementPrefixes = setOf("roof-ut-", "roof-nozzle-ut-"),
    ).copy(
        roofFeatureDraft = RoofFeatureDraftInput(roofSurfaceId = normalizedActiveRoofSurfaceId()),
        roofFeatures = emptyList(),
        roofUtDraft = RoofUtDraftInput(roofSurfaceId = normalizedActiveRoofSurfaceId()),
        roofUtRows = emptyList(),
        roofNozzleDraft = RoofNozzleDraftInput(roofSurfaceId = normalizedActiveRoofSurfaceId()),
        roofNozzles = emptyList(),
        roofNozzleUtDraft = NozzleUtDraftInput(roofSurfaceId = normalizedActiveRoofSurfaceId()),
        roofNozzleUtRows = emptyList(),
    )

private fun FieldDraftState.invalidateRoofLayoutForReferenceChange(): FieldDraftState =
    clearRoofInspectionData().copy(
        savedFixedRoofLayoutDraft = null,
        savedFloatingRoofLayoutDraft = null,
    )

private fun FieldDraftState.withoutFindingsFor(
    surfaces: Set<String>,
    measurementPrefixes: Set<String>,
): FieldDraftState {
    val remainingFindings = findings.filterNot { finding ->
        finding.surface in surfaces || measurementPrefixes.any { prefix ->
            finding.linkedMeasurementId?.startsWith(prefix) == true
        }
    }
    val retainedAttachmentIds = remainingFindings.flatMap { finding -> finding.attachmentIds }.toSet() +
        listOfNotNull(mflImportDraft.attachmentId)
    val retainedDraft = if (findingDraft.surface in surfaces) FindingDraftInput() else findingDraft

    return copy(
        findingDraft = retainedDraft,
        findings = remainingFindings,
        attachments = attachments.filter { attachment -> attachment.attachmentId in retainedAttachmentIds },
    )
}

private fun FieldDraftState.withoutFindingsForMeasurementIds(
    surfaces: Set<String>,
    linkedMeasurementIds: Set<String>,
): FieldDraftState {
    val remainingFindings = findings.filterNot { finding ->
        finding.surface in surfaces && finding.linkedMeasurementId in linkedMeasurementIds
    }
    val retainedAttachmentIds = remainingFindings.flatMap { finding -> finding.attachmentIds }.toSet() +
        listOfNotNull(mflImportDraft.attachmentId)
    val retainedDraft = if (
        findingDraft.surface in surfaces &&
        findingDraft.linkedMeasurementId in linkedMeasurementIds
    ) {
        FindingDraftInput()
    } else {
        findingDraft
    }

    return copy(
        findingDraft = retainedDraft,
        findings = remainingFindings,
        attachments = attachments.filter { attachment -> attachment.attachmentId in retainedAttachmentIds },
    )
}

private fun roofLayoutDraftRevision(draft: RoofLayoutDraftInput): String =
    listOf(
        draft.template.name,
        draft.rowCount.trim(),
        draft.widestRowPlateCount.trim(),
        draft.ringCount.trim(),
        draft.sectorCount.trim(),
        draft.centerOpeningRatio.trim(),
        draft.hasAnnularRing,
        draft.annularSectionCount.trim(),
        draft.hasPontoonDeck,
    ).joinToString("|")

private fun roofLayoutMaterialKey(draft: RoofLayoutDraftInput?): String? {
    val layout = buildRoofLayoutFromDraftOrNull(draft) ?: return null
    if (!layout.isReadyForInspection()) return null
    return when (layout.template) {
        RoofTemplate.CIRCULAR_PLATE,
        RoofTemplate.CIRCULAR_CENTER_OPENING -> listOf(
            layout.template.name,
            layout.rowCount,
            layout.widestRowPlateCount,
            layout.centerOpeningRatio,
            layout.hasAnnularRing,
            layout.annularSectionCount,
            layout.hasPontoonDeck,
        ).joinToString("|")
        RoofTemplate.UMBRELLA_RADIAL -> listOf(
            layout.template.name,
            layout.ringCount,
            layout.sectorCount,
            layout.hasAnnularRing,
            layout.annularSectionCount,
            layout.hasPontoonDeck,
        ).joinToString("|")
    }
}

fun parsePositiveWholeNumber(raw: String): Int? =
    normalizeWholeNumber(raw).toIntOrNull()?.takeIf { it > 0 }

fun parseNormalizedDecimal(raw: String): Double? =
    normalizeDecimalNumber(raw).toDoubleOrNull()

private fun normalizeWholeNumber(raw: String): String =
    buildString {
        raw.forEach { char ->
            char.digitToIntOrNull()?.let { append(it) }
        }
    }

private fun normalizeDecimalNumber(raw: String): String {
    var seenSeparator = false
    return buildString {
        raw.forEach { char ->
            when {
                char.digitToIntOrNull() != null -> append(char.digitToInt())
                (char == '.' || char == ',') && !seenSeparator -> {
                    append('.')
                    seenSeparator = true
                }
            }
        }
    }
}

package ai.laiq.tankinspection.domain.model

enum class ReferenceMode {
    TRUE_NORTH,
    TANK_NORTH,
    SITE_MARKER,
}

enum class RotationDirection {
    CLOCKWISE,
    COUNTERCLOCKWISE,
}

enum class RoofTemplate {
    CIRCULAR_PLATE,
    CIRCULAR_CENTER_OPENING,
    UMBRELLA_RADIAL,
}

enum class MeasurementUnit {
    MM,
    INCH,
}

enum class NozzleSizeUnit {
    INCH,
    MM,
    MIXED_TEXT,
}

enum class MeasurementCaptureState {
    CAPTURED,
    NOT_APPLICABLE,
    NOT_ACCESSIBLE,
    COATED_NOT_EXPOSED,
    SKIPPED,
}

enum class ReviewState {
    DRAFT,
    READY_FOR_UPLOAD,
    UPLOADED,
    REVIEWED,
}

data class CanonicalInspectionPackage(
    val schemaVersion: String,
    val packageId: String,
    val inspection: InspectionMeta,
    val tankMaster: TankMaster,
    val unitProfile: UnitProfile,
    val shellLinePlan: ShellLinePlan,
    val roofLayout: RoofLayout?,
    val roofSurfaceLayouts: List<RoofSurfaceLayout> = emptyList(),
    val nozzleRegistries: NozzleRegistries? = null,
    val measurements: Measurements,
    val shellSettlementSurvey: ShellSettlementSurvey? = null,
    val roundnessSurvey: RoundnessSurvey? = null,
    val plumbnessSurvey: PlumbnessSurvey? = null,
    val findings: List<FindingRecord>,
    val attachments: List<AttachmentRecord>,
    val mflImport: MflImport? = null,
    val reviewStatus: ReviewStatus,
)

data class InspectionMeta(
    val inspectionId: String,
    val client: String,
    val site: String,
    val tankNumber: String,
    val inspectionType: String,
    val startedAt: String,
    val completedAt: String? = null,
    val inspector: String,
    val deviceId: String? = null,
)

data class TankMaster(
    val diameterM: Double,
    val heightM: Double,
    val roofType: String,
    val fixedRoofType: String? = null,
    val floatingRoofType: String? = null,
    val shellCourseCount: Int,
    val referenceMode: ReferenceMode,
    val startReference: String?,
)

data class UnitProfile(
    val thicknessUnit: MeasurementUnit,
    val settlementUnit: MeasurementUnit,
    val nozzleSizeUnit: NozzleSizeUnit,
)

data class ShellLinePlan(
    val lineCount: Int,
    val recommendedLineCount: Int,
    val startReference: String,
    val captureStartLaneId: String? = null,
    val rotationDirection: RotationDirection,
    val lines: List<ShellLine>,
)

data class ShellLine(
    val lineId: String,
    val label: String,
    val azimuthDeg: Double,
)

data class RoofLayout(
    val template: RoofTemplate,
    val rowCount: Int? = null,
    val widestRowPlateCount: Int? = null,
    val ringCount: Int? = null,
    val sectorCount: Int? = null,
    val centerOpeningRatio: Double? = null,
    val hasAnnularRing: Boolean = false,
    val annularSectionCount: Int? = null,
    val hasPontoonDeck: Boolean = false,
    val features: List<RoofFeature> = emptyList(),
)

data class RoofSurfaceLayout(
    val roofSurfaceId: String,
    val surfaceKind: String,
    val layout: RoofLayout,
)

data class RoofFeature(
    val featureId: String,
    val roofSurfaceId: String? = null,
    val type: String,
    val label: String? = null,
    val placementMode: String? = null,
    val plateId: String? = null,
    val azimuthDeg: Double? = null,
    val radiusRatio: Double? = null,
)

data class NozzleRegistries(
    val shell: List<NozzleDefinition> = emptyList(),
    val roof: List<NozzleDefinition> = emptyList(),
)

data class NozzleDefinition(
    val nozzleId: String,
    val surface: String,
    val roofSurfaceId: String? = null,
    val size: String,
    val hasReinforcementPad: Boolean = true,
    val placementMode: String? = null,
    val course: Int? = null,
    val azimuthDeg: Double? = null,
    val radiusRatio: Double? = null,
    val courseOffsetRatio: Double? = null,
    val plateId: String? = null,
)

data class Measurements(
    val shellUtRows: List<ShellUtRow> = emptyList(),
    val roofUtRows: List<RoofUtRow> = emptyList(),
    val shellNozzleUtRows: List<NozzleUtRow> = emptyList(),
    val roofNozzleUtRows: List<NozzleUtRow> = emptyList(),
)

data class ShellUtRow(
    val rowId: String,
    val lineId: String,
    val course: Int,
    val readings: List<Double>,
    val captureState: MeasurementCaptureState = MeasurementCaptureState.CAPTURED,
    val note: String? = null,
)

data class RoofUtRow(
    val rowId: String,
    val roofSurfaceId: String? = null,
    val plateId: String,
    val readings: List<Double>,
    val captureState: MeasurementCaptureState = MeasurementCaptureState.CAPTURED,
    val note: String? = null,
)

data class NozzleUtRow(
    val rowId: String,
    val nozzleId: String,
    val roofSurfaceId: String? = null,
    val bodyReadings: List<Double>,
    val reinforcementPadReading: Double? = null,
    val captureState: MeasurementCaptureState = MeasurementCaptureState.CAPTURED,
    val note: String? = null,
)

data class ShellSettlementSurvey(
    val stationCount: Int,
    val stations: List<ShellSettlementStation>,
)

data class ShellSettlementStation(
    val stationId: String,
    val angleDeg: Double,
    val elevation: Double? = null,
    val captureState: MeasurementCaptureState = MeasurementCaptureState.CAPTURED,
    val note: String? = null,
)

data class RoundnessSurvey(
    val surveys: List<RoundnessSurveyBand>,
)

data class RoundnessSurveyBand(
    val surveyId: String,
    val label: String,
    val heightReference: String? = null,
    val stationCount: Int,
    val stations: List<RoundnessSurveyStation>,
)

data class RoundnessSurveyStation(
    val stationId: String,
    val angleDeg: Double,
    val easting: Double? = null,
    val northing: Double? = null,
    val captureState: MeasurementCaptureState = MeasurementCaptureState.CAPTURED,
    val note: String? = null,
)

data class PlumbnessSurvey(
    val stationCount: Int,
    val stations: List<PlumbnessSurveyStation>,
)

data class PlumbnessSurveyStation(
    val stationId: String,
    val angleDeg: Double,
    val plumbness: Double? = null,
    val captureState: MeasurementCaptureState = MeasurementCaptureState.CAPTURED,
    val note: String? = null,
)

data class FindingRecord(
    val findingId: String,
    val surface: String,
    val type: String,
    val severity: String,
    val note: String? = null,
    val linkedMeasurementId: String? = null,
    val locationSummary: String? = null,
    val preciseLineId: String? = null,
    val preciseCourse: Int? = null,
    val attachmentIds: List<String> = emptyList(),
)

data class AttachmentRecord(
    val attachmentId: String,
    val kind: String,
    val relativePath: String,
    val caption: String? = null,
)

data class MflImport(
    val contractor: String? = null,
    val reportReference: String? = null,
    val reportDate: String? = null,
    val severity: String? = null,
    val attachmentId: String? = null,
)

data class ReviewStatus(
    val status: ReviewState,
    val warnings: List<String>,
)

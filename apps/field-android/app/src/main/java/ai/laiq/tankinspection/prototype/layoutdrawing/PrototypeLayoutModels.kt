package ai.laiq.tankinspection.prototype.layoutdrawing

import java.time.Instant
import java.util.UUID

enum class PrototypeLayoutSurface(val key: String, val label: String) {
    EXTERNAL_ROOF("external_roof", "External Roof"),
    INTERNAL_ROOF("internal_roof", "Internal Roof"),
    FLOOR("floor", "Floor"),
    SHELL("shell", "Shell"),
}

enum class PrototypeLayoutSourceType(val key: String, val label: String) {
    V3_BASE("v3_base", "V3 Base"),
    SKETCH("sketch", "Sketch"),
    IMAGE_IMPORT("image_import", "Image Import"),
}

enum class PrototypeReferenceMode(val key: String, val label: String) {
    TANK_NORTH("tank_north", "Tank North"),
    TRUE_NORTH("true_north", "True North"),
}

enum class PrototypeZeroDegreePosition(val key: String, val label: String) {
    TOP("top", "Top / 12 o'clock"),
    RIGHT("right", "Right / 3 o'clock"),
    BOTTOM("bottom", "Bottom / 6 o'clock"),
    LEFT("left", "Left / 9 o'clock"),
}

enum class PrototypeElementType(val key: String, val label: String) {
    NOZZLE("nozzle", "Nozzle"),
    MANHOLE("manhole", "Manhole"),
    PATCH("patch", "Patch"),
    STAIR("stair", "Stair"),
    DRAIN("drain", "Drain"),
    UNKNOWN("unknown", "Unknown"),
}

enum class PrototypeMarkerShape(val key: String, val label: String) {
    CIRCLE("circle", "Circle"),
    SQUARE("square", "Square"),
}

enum class PrototypeValidationStatus(val key: String, val label: String) {
    DRAFT("draft", "Draft"),
    READY("ready", "Ready"),
    BLOCKED("blocked", "Blocked"),
}

enum class PrototypeSketchStrokeKind(val key: String, val label: String) {
    BOUNDARY("boundary", "Boundary"),
    ELEMENT("element", "Element"),
}

data class PrototypeNormalizedPoint(
    val x: Float,
    val y: Float,
) {
    fun clamped(): PrototypeNormalizedPoint =
        copy(x = x.coerceIn(0f, 1f), y = y.coerceIn(0f, 1f))
}

data class PrototypeSketchStroke(
    val id: String = UUID.randomUUID().toString(),
    val kind: PrototypeSketchStrokeKind,
    val points: List<PrototypeNormalizedPoint>,
)

data class PrototypeSketchLabel(
    val id: String = UUID.randomUUID().toString(),
    val text: String,
    val position: PrototypeNormalizedPoint,
)

data class PrototypeGridSettings(
    val unitLabel: String = "m",
    val gridSpacing: Float = 0.1f,
    val snapEnabled: Boolean = true,
    val snapTolerance: Float = 0.035f,
    val tankDiameter: String = "",
    val shellHeight: String = "",
)

data class PrototypeRecognitionInput(
    val surface: PrototypeLayoutSurface,
    val sourceType: PrototypeLayoutSourceType,
    val sourceImageUri: String? = null,
    val strokes: List<PrototypeSketchStroke> = emptyList(),
    val labels: List<PrototypeSketchLabel> = emptyList(),
    val grid: PrototypeGridSettings = PrototypeGridSettings(),
)

data class PrototypeLayoutOrientation(
    val referenceMode: PrototypeReferenceMode = PrototypeReferenceMode.TANK_NORTH,
    val northAngleDeg: Float = 0f,
    val zeroDegreePosition: PrototypeZeroDegreePosition = PrototypeZeroDegreePosition.TOP,
)

data class PrototypeLayoutPlate(
    val id: String,
    val displayLabel: String,
    val surface: PrototypeLayoutSurface,
    val rowNumber: Int? = null,
    val courseNumber: Int? = null,
    val columnNumber: Int? = null,
    val polygon: List<PrototypeNormalizedPoint>,
    val center: PrototypeNormalizedPoint,
    val adjacentPlateIds: List<String> = emptyList(),
    val sourceConfidence: Float? = null,
)

data class PrototypeLayoutElement(
    val id: String,
    val type: PrototypeElementType,
    val name: String,
    val markerShape: PrototypeMarkerShape,
    val position: PrototypeNormalizedPoint,
    val attachedPlateId: String? = null,
    val sizeLabel: String? = null,
    val sourceConfidence: Float? = null,
)

data class PrototypeLayoutValidation(
    val status: PrototypeValidationStatus = PrototypeValidationStatus.DRAFT,
    val errors: List<String> = emptyList(),
    val warnings: List<String> = emptyList(),
)

data class PrototypeLayoutApproval(
    val approvedAt: String? = null,
    val approvedBy: String? = null,
)

data class PrototypeLayoutDraft(
    val id: String = "layout-draft-${UUID.randomUUID()}",
    val surface: PrototypeLayoutSurface,
    val sourceType: PrototypeLayoutSourceType,
    val sourceImageUri: String? = null,
    val grid: PrototypeGridSettings = PrototypeGridSettings(),
    val orientation: PrototypeLayoutOrientation = PrototypeLayoutOrientation(),
    val plates: List<PrototypeLayoutPlate> = emptyList(),
    val elements: List<PrototypeLayoutElement> = emptyList(),
    val validation: PrototypeLayoutValidation = PrototypeLayoutValidation(),
    val approved: PrototypeLayoutApproval = PrototypeLayoutApproval(),
) {
    fun withValidation(validator: PrototypeLayoutValidator = PrototypeLayoutValidator()): PrototypeLayoutDraft =
        copy(validation = validator.validate(this))

    fun approvedByInspector(inspectorName: String): PrototypeLayoutDraft =
        copy(
            approved = PrototypeLayoutApproval(
                approvedAt = Instant.now().toString(),
                approvedBy = inspectorName.ifBlank { "Prototype Inspector" },
            ),
        )
}

interface LayoutRecognitionEngine {
    fun recognize(input: PrototypeRecognitionInput): PrototypeLayoutDraft
}

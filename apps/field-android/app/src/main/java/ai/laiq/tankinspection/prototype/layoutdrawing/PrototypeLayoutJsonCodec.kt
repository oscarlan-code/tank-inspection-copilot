package ai.laiq.tankinspection.prototype.layoutdrawing

import org.json.JSONArray
import org.json.JSONObject

object PrototypeLayoutJsonCodec {
    fun encode(draft: PrototypeLayoutDraft): String =
        JSONObject()
            .put("version", 1)
            .put("id", draft.id)
            .put("surface", draft.surface.key)
            .put("sourceType", draft.sourceType.key)
            .putNullable("sourceImageUri", draft.sourceImageUri)
            .put("grid", draft.grid.toJson())
            .put("orientation", draft.orientation.toJson())
            .put("plates", JSONArray().apply { draft.plates.forEach { plate -> put(plate.toJson()) } })
            .put("elements", JSONArray().apply { draft.elements.forEach { element -> put(element.toJson()) } })
            .put("validation", draft.validation.toJson())
            .put("approved", draft.approved.toJson())
            .toString(2)

    private fun PrototypeGridSettings.toJson(): JSONObject =
        JSONObject()
            .put("unitLabel", unitLabel)
            .put("gridSpacing", gridSpacing)
            .put("snapEnabled", snapEnabled)
            .put("snapTolerance", snapTolerance)
            .put("tankDiameter", tankDiameter)
            .put("shellHeight", shellHeight)

    private fun PrototypeLayoutOrientation.toJson(): JSONObject =
        JSONObject()
            .put("referenceMode", referenceMode.key)
            .put("northAngleDeg", northAngleDeg)
            .put("zeroDegreePosition", zeroDegreePosition.key)

    private fun PrototypeLayoutPlate.toJson(): JSONObject =
        JSONObject()
            .put("id", id)
            .put("displayLabel", displayLabel)
            .put("surface", surface.key)
            .putNullable("rowNumber", rowNumber)
            .putNullable("courseNumber", courseNumber)
            .putNullable("columnNumber", columnNumber)
            .put("polygon", polygon.toJsonArray())
            .put("center", center.toJson())
            .put("adjacentPlateIds", JSONArray().apply { adjacentPlateIds.forEach(::put) })
            .putNullable("sourceConfidence", sourceConfidence)

    private fun PrototypeLayoutElement.toJson(): JSONObject =
        JSONObject()
            .put("id", id)
            .put("type", type.key)
            .put("name", name)
            .put("markerShape", markerShape.key)
            .put("position", position.toJson())
            .putNullable("attachedPlateId", attachedPlateId)
            .putNullable("sizeLabel", sizeLabel)
            .putNullable("sourceConfidence", sourceConfidence)

    private fun PrototypeLayoutValidation.toJson(): JSONObject =
        JSONObject()
            .put("status", status.key)
            .put("errors", JSONArray().apply { errors.forEach(::put) })
            .put("warnings", JSONArray().apply { warnings.forEach(::put) })

    private fun PrototypeLayoutApproval.toJson(): JSONObject =
        JSONObject()
            .putNullable("approvedAt", approvedAt)
            .putNullable("approvedBy", approvedBy)

    private fun List<PrototypeNormalizedPoint>.toJsonArray(): JSONArray =
        JSONArray().apply { forEach { point -> put(point.toJson()) } }

    private fun PrototypeNormalizedPoint.toJson(): JSONObject =
        JSONObject()
            .put("x", x)
            .put("y", y)

    private fun JSONObject.putNullable(key: String, value: Any?): JSONObject =
        put(key, value ?: JSONObject.NULL)
}

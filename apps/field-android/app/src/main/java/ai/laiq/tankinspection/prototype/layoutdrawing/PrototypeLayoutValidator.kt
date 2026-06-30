package ai.laiq.tankinspection.prototype.layoutdrawing

class PrototypeLayoutValidator {
    fun validate(draft: PrototypeLayoutDraft): PrototypeLayoutValidation {
        val errors = mutableListOf<String>()
        val warnings = mutableListOf<String>()

        if (draft.orientation.northAngleDeg.isNaN() || draft.orientation.northAngleDeg !in 0f..360f) {
            errors += "Missing orientation: north angle must be between 0 and 360 degrees."
        }

        if (draft.plates.isEmpty()) {
            errors += "No structured plates were generated."
        }

        val duplicatePlateIds = draft.plates
            .groupBy { plate -> plate.id.trim().lowercase() }
            .filterKeys { id -> id.isNotBlank() }
            .filterValues { matches -> matches.size > 1 }
            .keys
        duplicatePlateIds.forEach { plateId ->
            errors += "Duplicated plate ID: $plateId."
        }

        draft.plates.forEach { plate ->
            if (plate.id.isBlank()) {
                errors += "Plate ${plate.displayLabel.ifBlank { "(blank)" }} is missing an ID."
            }
            if (plate.polygon.size < 3) {
                errors += "Unclosed plate boundary: ${plate.displayLabel} has fewer than 3 polygon points."
            }
            if (plate.polygon.any { point -> !point.isInsideUnitMap() }) {
                errors += "Plate ${plate.displayLabel} has polygon points outside the normalized map."
            }
            if (!plate.center.isInsideUnitMap()) {
                errors += "Plate ${plate.displayLabel} center is outside the normalized map."
            }
            val confidence = plate.sourceConfidence
            if (confidence != null && confidence < LOW_CONFIDENCE_THRESHOLD) {
                warnings += "Plate ${plate.displayLabel} has low recognition confidence."
            }
            val unknownAdjacent = plate.adjacentPlateIds.filter { adjacentId ->
                draft.plates.none { candidate -> candidate.id == adjacentId }
            }
            if (unknownAdjacent.isNotEmpty()) {
                warnings += "Plate ${plate.displayLabel} references unknown adjacent plates: ${unknownAdjacent.joinToString()}."
            }
        }

        draft.elements.forEach { element ->
            if (element.name.isBlank()) {
                warnings += "Element ${element.id} is missing a label/name."
            }
            if (!element.position.isInsideUnitMap()) {
                errors += "Element ${element.name.ifBlank { element.id }} is outside the normalized map."
            }
            val attachedPlateId = element.attachedPlateId
            if (attachedPlateId != null && draft.plates.none { plate -> plate.id == attachedPlateId }) {
                warnings += "Element ${element.name.ifBlank { element.id }} is attached to an unknown plate."
            }
            val confidence = element.sourceConfidence
            if (confidence != null && confidence < LOW_CONFIDENCE_THRESHOLD) {
                warnings += "Element ${element.name.ifBlank { element.id }} has low recognition confidence."
            }
        }

        if (draft.sourceType == PrototypeLayoutSourceType.IMAGE_IMPORT && draft.sourceImageUri.isNullOrBlank()) {
            warnings += "Imported-image draft has no retained source image URI."
        }

        if (draft.surface == PrototypeLayoutSurface.SHELL && draft.plates.isNotEmpty()) {
            val courses = draft.plates.groupBy { plate -> plate.courseNumber ?: plate.rowNumber ?: -1 }
            courses.forEach { (course, plates) ->
                val touchesZero = plates.any { plate -> plate.polygon.any { point -> point.x <= EDGE_TOLERANCE } }
                val touchesWrap = plates.any { plate -> plate.polygon.any { point -> point.x >= 1f - EDGE_TOLERANCE } }
                if (!touchesZero || !touchesWrap) {
                    errors += "Shell 0/360 edge mismatch on course $course."
                }
            }
        }

        if (draft.grid.gridSpacing <= 0f || draft.grid.gridSpacing > 0.5f) {
            warnings += "Grid spacing is outside the recommended normalized range."
        }

        return PrototypeLayoutValidation(
            status = if (errors.isEmpty()) PrototypeValidationStatus.READY else PrototypeValidationStatus.BLOCKED,
            errors = errors.distinct(),
            warnings = warnings.distinct(),
        )
    }

    private fun PrototypeNormalizedPoint.isInsideUnitMap(): Boolean =
        x in 0f..1f && y in 0f..1f

    private companion object {
        const val LOW_CONFIDENCE_THRESHOLD = 0.70f
        const val EDGE_TOLERANCE = 0.025f
    }
}

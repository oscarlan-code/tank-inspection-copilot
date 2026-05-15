package ai.laiq.tankinspection.domain.usecase

import ai.laiq.tankinspection.domain.model.ReferenceMode
import ai.laiq.tankinspection.domain.model.RotationDirection
import ai.laiq.tankinspection.domain.model.ShellLine
import ai.laiq.tankinspection.domain.model.ShellLinePlan
import ai.laiq.tankinspection.presentation.StartReference
import kotlin.math.PI
import kotlin.math.ceil

object ShellLinePlanner {
    const val DefaultMaxSpacingM = 9.75
    const val MinimumLaneCount = 4

    fun laneIdForNumber(number: Int): String =
        "line-${number.toString().padStart(2, '0')}"

    fun laneLabelForNumber(number: Int): String =
        "Lane $number"

    fun laneOptions(lineCount: Int): List<Pair<String, String>> =
        (1..lineCount.coerceAtLeast(MinimumLaneCount)).map { laneNumber ->
            laneIdForNumber(laneNumber) to laneLabelForNumber(laneNumber)
        }

    fun normalizedLineCount(explicitLineCount: Int?): Int? =
        explicitLineCount?.coerceAtLeast(MinimumLaneCount)

    fun spacingM(
        diameterM: Double,
        lineCount: Int,
    ): Double {
        require(diameterM > 0) { "diameterM must be positive" }
        require(lineCount > 0) { "lineCount must be positive" }

        val circumference = diameterM * PI
        return circumference / lineCount.toDouble()
    }

    fun normalizeCaptureStartLaneId(
        candidateLaneId: String?,
        lineCount: Int,
    ): String? {
        val allowedLaneIds = laneOptions(lineCount).map { option -> option.first }
        return allowedLaneIds.firstOrNull { laneId -> laneId == candidateLaneId } ?: allowedLaneIds.firstOrNull()
    }

    fun recommendedLineCount(
        diameterM: Double,
        maxSpacingM: Double = DefaultMaxSpacingM,
    ): Int {
        require(diameterM > 0) { "diameterM must be positive" }
        require(maxSpacingM > 0) { "maxSpacingM must be positive" }

        val circumference = diameterM * PI
        return maxOf(MinimumLaneCount, ceil(circumference / maxSpacingM).toInt())
    }

    @Suppress("UNUSED_PARAMETER")
    fun createPlan(
        diameterM: Double,
        explicitLineCount: Int?,
        referenceMode: ReferenceMode,
        startReference: StartReference,
        startReferenceLabel: String,
        rotationDirection: RotationDirection,
        captureStartLaneId: String? = null,
    ): ShellLinePlan {
        val recommended = recommendedLineCount(diameterM)
        val resolvedLineCount = normalizedLineCount(explicitLineCount) ?: recommended
        val step = 360.0 / resolvedLineCount.toDouble()
        val directionFactor = if (rotationDirection == RotationDirection.CLOCKWISE) 1 else -1
        val baseAzimuth = 0.0
        val lines = (0 until resolvedLineCount).map { index ->
            val azimuth = normalizeAngle(baseAzimuth + directionFactor * step * index)
            ShellLine(
                lineId = laneIdForNumber(index + 1),
                label = laneLabelForNumber(index + 1),
                azimuthDeg = azimuth,
            )
        }
        val resolvedCaptureStartLaneId = normalizeCaptureStartLaneId(captureStartLaneId, resolvedLineCount)

        return ShellLinePlan(
            lineCount = resolvedLineCount,
            recommendedLineCount = recommended,
            startReference = startReferenceLabel.ifBlank { "0° Reference" },
            captureStartLaneId = resolvedCaptureStartLaneId,
            rotationDirection = rotationDirection,
            lines = lines,
        )
    }

    private fun normalizeAngle(value: Double): Double {
        var result = value % 360.0
        if (result < 0) result += 360.0
        return result
    }

}

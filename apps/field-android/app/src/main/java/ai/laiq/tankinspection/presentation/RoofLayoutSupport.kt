package ai.laiq.tankinspection.presentation

import ai.laiq.tankinspection.domain.model.RoofLayout
import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.domain.model.RotationDirection
import kotlin.math.floor
import kotlin.math.atan2
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin
import kotlin.math.sqrt

data class RoofPlateCell(
    val plateId: String,
    val mapLabel: String,
    val selectionLabel: String,
    val rowNumber: Int,
    val xNorm: Float,
    val yNorm: Float,
    val labelXNorm: Float,
    val labelYNorm: Float,
    val leftNorm: Float,
    val rightNorm: Float,
    val topNorm: Float,
    val bottomNorm: Float,
)

private const val mainRoofRadiusRatio = 0.42f
private const val annularOuterRadiusRatio = 0.48f
private const val maxRoofPlacementRadiusRatio = annularOuterRadiusRatio / mainRoofRadiusRatio
private const val coneRadialTransitionRadiusRatio = 0.14f
private const val coneRadialCenterRadiusRatio = 0.07f

private val sharedRoofFeatureTypeOptions = listOf(
    "manhole" to "Manhole",
    "vent" to "Vent",
    "gauge_hatch" to "Gauge Hatch",
    "platform" to "Platform",
    "gauge_well" to "Gauge Well",
    "vacuum_breaker" to "Vacuum Breaker",
)

private val fixedRoofFeatureTypeOptions = listOf(
    "stairway_termination" to "Stairway Termination",
    "support_column" to "Support Column",
    "roof_ladder" to "Roof Ladder",
)

private val floatingRoofFeatureTypeOptions = listOf(
    "sump" to "Sump",
    "roof_leg" to "Roof Leg",
    "pontoon_fitting" to "Pontoon Fitting",
    "seal_detail" to "Seal Detail",
    "rolling_ladder" to "Rolling Ladder",
    "drain_hose" to "Drain Hose",
    "guide_pole" to "Guide Pole / Well",
    "anti_rotation_cable" to "Anti-Rotation Cable",
    "pontoon_manhole" to "Pontoon Manhole",
    "seal_shoe" to "Seal Shoe",
)

val roofFeatureTypeOptions = sharedRoofFeatureTypeOptions + fixedRoofFeatureTypeOptions + floatingRoofFeatureTypeOptions

fun roofFeatureTypeOptionsForSurface(surfaceKind: String): List<Pair<String, String>> = when (surfaceKind) {
    "floating" -> sharedRoofFeatureTypeOptions + floatingRoofFeatureTypeOptions
    else -> sharedRoofFeatureTypeOptions + fixedRoofFeatureTypeOptions
}

fun buildRoofPlateCells(layout: RoofLayout): List<RoofPlateCell> =
    buildRoofPlateCells(
        template = layout.template,
        rowCount = layout.rowCount ?: 0,
        widestRowPlateCount = layout.widestRowPlateCount ?: 0,
        ringCount = layout.ringCount ?: 0,
        sectorCount = layout.sectorCount ?: 0,
        referenceAzimuthDeg = 0.0,
        rotationDirection = RotationDirection.CLOCKWISE,
    )

fun buildRoofLinkTargets(layout: RoofLayout): List<RoofPlateCell> =
    buildRoofLinkTargetsForConfig(
        template = layout.template,
        rowCount = layout.rowCount ?: 0,
        widestRowPlateCount = layout.widestRowPlateCount ?: 0,
        ringCount = layout.ringCount ?: 0,
        sectorCount = layout.sectorCount ?: 0,
        referenceAzimuthDeg = 0.0,
        rotationDirection = RotationDirection.CLOCKWISE,
        hasAnnularRing = layout.hasAnnularRing,
        annularSectionCount = layout.annularSectionCount ?: 0,
    )

fun buildRoofPlateCells(
    template: RoofTemplate,
    rowCount: Int,
    widestRowPlateCount: Int,
    ringCount: Int,
    sectorCount: Int,
    referenceAzimuthDeg: Double = 0.0,
    rotationDirection: RotationDirection = RotationDirection.CLOCKWISE,
): List<RoofPlateCell> = when (template) {
    RoofTemplate.CIRCULAR_PLATE,
    RoofTemplate.CIRCULAR_CENTER_OPENING -> circularRoofPlateCells(rowCount, widestRowPlateCount)
    RoofTemplate.CONE_RADIAL -> coneRadialRoofPlateCells(
        centerPlateCount = ringCount,
        sectorCount = sectorCount,
        referenceAzimuthDeg = referenceAzimuthDeg,
        rotationDirection = rotationDirection,
    )
    RoofTemplate.UMBRELLA_RADIAL -> umbrellaRoofPlateCells(
        ringCount = ringCount,
        sectorCount = sectorCount,
        referenceAzimuthDeg = referenceAzimuthDeg,
        rotationDirection = rotationDirection,
    )
}

private fun coneRadialRoofPlateCells(
    centerPlateCount: Int,
    sectorCount: Int,
    referenceAzimuthDeg: Double,
    rotationDirection: RotationDirection,
): List<RoofPlateCell> {
    val sectors = sectorCount.coerceAtLeast(1)
    val centerPlates = centerPlateCount.coerceIn(1, 3)
    val cells = mutableListOf<RoofPlateCell>()
    val sectorStep = 360.0 / sectors.toDouble()
    val directionFactor = if (rotationDirection == RotationDirection.CLOCKWISE) 1.0 else -1.0
    val outerLabelRadius = mainRoofRadiusRatio * ((1.0f + coneRadialTransitionRadiusRatio) / 2f)
    for (sectorIndex in 0 until sectors) {
        val plateNumber = sectorIndex + 1
        val azimuthDeg = normalizeAzimuth(referenceAzimuthDeg + directionFactor * sectorStep * (sectorIndex + 0.5))
        val angle = azimuthToCanvasRadians(azimuthDeg)
        val xNorm = 0.5f + (cos(angle).toFloat() * outerLabelRadius)
        val yNorm = 0.5f + (sin(angle).toFloat() * outerLabelRadius)
        cells += RoofPlateCell(
            plateId = plateNumber.toString(),
            mapLabel = plateNumber.toString(),
            selectionLabel = "Plate $plateNumber",
            rowNumber = 1,
            xNorm = xNorm,
            yNorm = yNorm,
            labelXNorm = xNorm,
            labelYNorm = yNorm,
            leftNorm = xNorm - 0.03f,
            rightNorm = xNorm + 0.03f,
            topNorm = yNorm - 0.02f,
            bottomNorm = yNorm + 0.02f,
        )
    }
    val ringLabelRadius = mainRoofRadiusRatio * ((coneRadialTransitionRadiusRatio + coneRadialCenterRadiusRatio) / 2f)
    if (centerPlates == 1) {
        val centerPlateId = (sectors + 1).toString()
        cells += RoofPlateCell(
            plateId = centerPlateId,
            mapLabel = centerPlateId,
            selectionLabel = "Plate $centerPlateId",
            rowNumber = 2,
            xNorm = 0.5f,
            yNorm = 0.5f,
            labelXNorm = 0.5f,
            labelYNorm = 0.5f,
            leftNorm = 0.47f,
            rightNorm = 0.53f,
            topNorm = 0.47f,
            bottomNorm = 0.53f,
        )
    } else {
        val upperRingPlateId = (sectors + 1).toString()
        val lowerRingPlateId = (sectors + 2).toString()
        cells += RoofPlateCell(
            plateId = upperRingPlateId,
            mapLabel = upperRingPlateId,
            selectionLabel = "Plate $upperRingPlateId",
            rowNumber = 2,
            xNorm = 0.5f,
            yNorm = 0.5f - ringLabelRadius,
            labelXNorm = 0.5f,
            labelYNorm = 0.5f - ringLabelRadius,
            leftNorm = 0.45f,
            rightNorm = 0.55f,
            topNorm = 0.34f,
            bottomNorm = 0.50f,
        )
        cells += RoofPlateCell(
            plateId = lowerRingPlateId,
            mapLabel = lowerRingPlateId,
            selectionLabel = "Plate $lowerRingPlateId",
            rowNumber = 2,
            xNorm = 0.5f,
            yNorm = 0.5f + ringLabelRadius,
            labelXNorm = 0.5f,
            labelYNorm = 0.5f + ringLabelRadius,
            leftNorm = 0.45f,
            rightNorm = 0.55f,
            topNorm = 0.50f,
            bottomNorm = 0.66f,
        )
        if (centerPlates == 3) {
            val centerPlateId = (sectors + 3).toString()
            cells += RoofPlateCell(
                plateId = centerPlateId,
                mapLabel = centerPlateId,
                selectionLabel = "Plate $centerPlateId",
                rowNumber = 3,
                xNorm = 0.5f,
                yNorm = 0.5f,
                labelXNorm = 0.5f,
                labelYNorm = 0.5f,
                leftNorm = 0.47f,
                rightNorm = 0.53f,
                topNorm = 0.47f,
                bottomNorm = 0.53f,
            )
        }
    }
    return cells
}

fun circularPlateRowCounts(rowCount: Int, widestRowPlateCount: Int): List<Int> {
    return circularRoofPlateCells(rowCount, widestRowPlateCount)
        .groupBy { it.rowNumber }
        .toSortedMap()
        .values
        .map { rowCells -> rowCells.size }
}

fun roofFeatureTypeLabel(type: String): String =
    roofFeatureTypeOptions.firstOrNull { it.first == type }?.second ?: titleCaseType(type)

fun roofFeatureUsesCenterPlacement(type: String): Boolean = type == "center_opening"

fun generatedRoofFeatureLabel(type: String, index: Int): String = when {
    roofFeatureUsesCenterPlacement(type) -> "Center Opening"
    else -> "${roofFeatureTypePrefix(type)}$index"
}

private fun roofFeatureTypePrefix(type: String): String = when (type) {
    "manhole" -> "MH"
    "vent" -> "V"
    "gauge_hatch" -> "GH"
    "platform" -> "PF"
    "gauge_well" -> "GW"
    "vacuum_breaker" -> "VB"
    "stairway_termination" -> "ST"
    "support_column" -> "SC"
    "roof_ladder" -> "LD"
    "center_opening" -> "CO"
    "sump" -> "SU"
    "roof_leg" -> "RL"
    "pontoon_fitting" -> "PT"
    "seal_detail" -> "SD"
    "rolling_ladder" -> "RD"
    "drain_hose" -> "DH"
    "guide_pole" -> "GP"
    "anti_rotation_cable" -> "AC"
    "pontoon_manhole" -> "PMH"
    "seal_shoe" -> "SS"
    else -> type
        .split('_')
        .filter { it.isNotBlank() }
        .joinToString("") { token -> token.take(1).uppercase() }
        .ifBlank { "RF" }
}

private fun circularRoofPlateCells(rowCount: Int, widestRowPlateCount: Int): List<RoofPlateCell> {
    val rows = rowCount.coerceAtLeast(1)
    val widest = widestRowPlateCount.coerceAtLeast(1)
    val radius = 0.42f
    val center = 0.5f
    val rowHeight = (2f * radius) / rows.toFloat()
    val nominalPlateWidth = (2f * radius) / widest.toFloat()
    val cells = mutableListOf<RoofPlateCell>()
    var nextPlateNumber = 1

    repeat(rows) { rowIndex ->
        val rowNumber = rowIndex + 1
        val topNorm = center - radius + rowIndex * rowHeight
        val bottomNorm = topNorm + rowHeight
        val rowCenter = (topNorm + bottomNorm) / 2f
        val dy = rowCenter - center
        val xSpan = sqrt(max(0f, radius * radius - dy * dy))
        val rowLeft = center - xSpan
        val rowRight = center + xSpan
        val staggerOffset = if (rowIndex % 2 == 0) 0f else nominalPlateWidth / 2f
        val nominalStart = center - radius - staggerOffset
        val nominalEnd = center + radius + nominalPlateWidth
        val rowCells = mutableListOf<Pair<Float, Float>>()
        var segmentStart = nominalStart

        while (segmentStart < nominalEnd) {
            val segmentEnd = segmentStart + nominalPlateWidth
            val visibleLeft = max(segmentStart, rowLeft)
            val visibleRight = minOf(segmentEnd, rowRight)
            if (visibleRight - visibleLeft > nominalPlateWidth * 0.04f) {
                rowCells += segmentStart to segmentEnd
            }
            segmentStart = segmentEnd
        }

        rowCells.forEachIndexed { position, (segmentLeft, segmentRight) ->
            val plateNumber = if (rowNumber % 2 == 1) {
                nextPlateNumber + position
            } else {
                nextPlateNumber + (rowCells.size - 1 - position)
            }
            val xNorm = (segmentLeft + segmentRight) / 2f
            val dx = xNorm - center
            val dyLabel = rowCenter - center
            val distanceFromCenter = sqrt(dx * dx + dyLabel * dyLabel)
            val labelLimitRadius = (radius - minOf(rowHeight, nominalPlateWidth) * 0.28f).coerceAtLeast(radius * 0.72f)
            val labelScale = if (distanceFromCenter > labelLimitRadius && distanceFromCenter > 0f) {
                labelLimitRadius / distanceFromCenter
            } else {
                1f
            }
            cells += RoofPlateCell(
                plateId = plateNumber.toString(),
                mapLabel = plateNumber.toString(),
                selectionLabel = "Plate $plateNumber · Row $rowNumber",
                rowNumber = rowNumber,
                xNorm = xNorm,
                yNorm = rowCenter,
                labelXNorm = center + dx * labelScale,
                labelYNorm = center + dyLabel * labelScale,
                leftNorm = segmentLeft,
                rightNorm = segmentRight,
                topNorm = topNorm,
                bottomNorm = bottomNorm,
            )
        }

        nextPlateNumber += rowCells.size
    }

    return cells
}

private fun umbrellaRoofPlateCells(
    ringCount: Int,
    sectorCount: Int,
    referenceAzimuthDeg: Double,
    rotationDirection: RotationDirection,
): List<RoofPlateCell> {
    val rings = ringCount.coerceAtLeast(1)
    val sectors = sectorCount.coerceAtLeast(1)
    val cells = mutableListOf<RoofPlateCell>()
    val outer = 0.42f
    val ringThickness = outer / rings.toFloat()
    var nextPlateNumber = 1
    val stepDeg = 360.0 / sectors.toDouble()
    val directionFactor = if (rotationDirection == RotationDirection.CLOCKWISE) 1.0 else -1.0

    for (ring in 1..rings) {
        val radius = ringThickness * (ring - 0.5f)
        for (sectorIndex in 0 until sectors) {
            val azimuthDeg = normalizeAzimuth(referenceAzimuthDeg + directionFactor * stepDeg * (sectorIndex + 0.5))
            val angle = azimuthToCanvasRadians(azimuthDeg)
            val plateNumber = nextPlateNumber++
            cells += RoofPlateCell(
                plateId = plateNumber.toString(),
                mapLabel = plateNumber.toString(),
                selectionLabel = "Plate $plateNumber",
                rowNumber = ring,
                xNorm = 0.5f + (cos(angle).toFloat() * radius),
                yNorm = 0.5f + (sin(angle).toFloat() * radius),
                labelXNorm = 0.5f + (cos(angle).toFloat() * radius),
                labelYNorm = 0.5f + (sin(angle).toFloat() * radius),
                leftNorm = 0.5f,
                rightNorm = 0.5f,
                topNorm = 0.5f,
                bottomNorm = 0.5f,
            )
        }
    }
    return cells
}

fun buildRoofLinkTargetsForConfig(
    template: RoofTemplate,
    rowCount: Int,
    widestRowPlateCount: Int,
    ringCount: Int,
    sectorCount: Int,
    referenceAzimuthDeg: Double = 0.0,
    rotationDirection: RotationDirection = RotationDirection.CLOCKWISE,
    hasAnnularRing: Boolean = false,
    annularSectionCount: Int = 0,
): List<RoofPlateCell> {
    val baseCells = buildRoofPlateCells(
        template = template,
        rowCount = rowCount,
        widestRowPlateCount = widestRowPlateCount,
        ringCount = ringCount,
        sectorCount = sectorCount,
        referenceAzimuthDeg = referenceAzimuthDeg,
        rotationDirection = rotationDirection,
    )
    if (!hasAnnularRing || annularSectionCount <= 0) return baseCells
    return baseCells + annularRingSectionCells(
        referenceAzimuthDeg = referenceAzimuthDeg,
        rotationDirection = rotationDirection,
        annularSectionCount = annularSectionCount,
    )
}

fun azimuthToCanvasRadians(azimuthDeg: Double): Double =
    Math.toRadians(azimuthDeg - 90.0)

fun canvasPointToRoofPolar(
    xNorm: Float,
    yNorm: Float,
): Pair<Double, Double> {
    val dx = xNorm - 0.5f
    val dy = yNorm - 0.5f
    val radius = sqrt(dx * dx + dy * dy).toDouble() / mainRoofRadiusRatio
    val azimuth = normalizeAzimuth(Math.toDegrees(atan2(dy.toDouble(), dx.toDouble())) + 90.0)
    return azimuth to radius.coerceIn(0.0, maxRoofPlacementRadiusRatio.toDouble())
}

fun roofPolarToCanvasPoint(
    azimuthDeg: Double,
    radiusRatio: Double,
): Pair<Float, Float> {
    val angle = azimuthToCanvasRadians(azimuthDeg)
    val scaledRadius = (mainRoofRadiusRatio * radiusRatio.coerceIn(0.0, maxRoofPlacementRadiusRatio.toDouble())).toFloat()
    return (
        0.5f + (cos(angle).toFloat() * scaledRadius)
        ) to (
        0.5f + (sin(angle).toFloat() * scaledRadius)
        )
}

fun nearestRoofPlateId(
    template: RoofTemplate,
    rowCount: Int,
    widestRowPlateCount: Int,
    ringCount: Int,
    sectorCount: Int,
    referenceAzimuthDeg: Double,
    rotationDirection: RotationDirection,
    hasAnnularRing: Boolean = false,
    annularSectionCount: Int = 0,
    azimuthDeg: Double,
    radiusRatio: Double,
): String? {
    roofPlateIdAtPolar(
        template = template,
        rowCount = rowCount,
        widestRowPlateCount = widestRowPlateCount,
        ringCount = ringCount,
        sectorCount = sectorCount,
        referenceAzimuthDeg = referenceAzimuthDeg,
        rotationDirection = rotationDirection,
        hasAnnularRing = hasAnnularRing,
        annularSectionCount = annularSectionCount,
        azimuthDeg = azimuthDeg,
        radiusRatio = radiusRatio,
    )?.let { return it }
    val linkTargets = buildRoofLinkTargetsForConfig(
        template = template,
        rowCount = rowCount,
        widestRowPlateCount = widestRowPlateCount,
        ringCount = ringCount,
        sectorCount = sectorCount,
        referenceAzimuthDeg = referenceAzimuthDeg,
        rotationDirection = rotationDirection,
        hasAnnularRing = hasAnnularRing,
        annularSectionCount = annularSectionCount,
    )
    if (linkTargets.isEmpty()) return null
    val (xNorm, yNorm) = roofPolarToCanvasPoint(azimuthDeg, radiusRatio)
    return linkTargets.minByOrNull { cell ->
        val dx = cell.xNorm - xNorm
        val dy = cell.yNorm - yNorm
        sqrt(dx * dx + dy * dy)
    }?.plateId
}

fun roofPlateIdAtPolar(
    template: RoofTemplate,
    rowCount: Int,
    widestRowPlateCount: Int,
    ringCount: Int,
    sectorCount: Int,
    referenceAzimuthDeg: Double,
    rotationDirection: RotationDirection,
    hasAnnularRing: Boolean = false,
    annularSectionCount: Int = 0,
    azimuthDeg: Double,
    radiusRatio: Double,
): String? {
    if (hasAnnularRing && annularSectionCount > 0 && radiusRatio > 1.0) {
        val sectionStep = 360.0 / annularSectionCount.toDouble()
        val directionFactor = if (rotationDirection == RotationDirection.CLOCKWISE) 1.0 else -1.0
        val relativeAzimuth = normalizeAzimuth((azimuthDeg - referenceAzimuthDeg) * directionFactor)
        val sectionIndex = floor(relativeAzimuth / sectionStep).toInt().coerceIn(0, annularSectionCount - 1)
        return "AR${sectionIndex + 1}"
    }
    if (template == RoofTemplate.UMBRELLA_RADIAL) {
        val rings = ringCount.coerceAtLeast(1)
        val sectors = sectorCount.coerceAtLeast(1)
        val sectionStep = 360.0 / sectors.toDouble()
        val directionFactor = if (rotationDirection == RotationDirection.CLOCKWISE) 1.0 else -1.0
        val normalizedRadius = radiusRatio.coerceIn(0.0, 1.0)
        val ringIndex = (floor(normalizedRadius * rings).toInt()).coerceIn(0, rings - 1)
        val relativeAzimuth = normalizeAzimuth((azimuthDeg - referenceAzimuthDeg) * directionFactor)
        val sectorIndex = floor(relativeAzimuth / sectionStep).toInt().coerceIn(0, sectors - 1)
        return ((ringIndex * sectors) + sectorIndex + 1).toString()
    }
    if (template == RoofTemplate.CONE_RADIAL) {
        val sectors = sectorCount.coerceAtLeast(1)
        val centerPlates = ringCount.coerceIn(1, 3)
        val normalizedRadius = radiusRatio.coerceIn(0.0, 1.0)
        if (centerPlates == 1) {
            if (normalizedRadius < coneRadialTransitionRadiusRatio.toDouble()) {
                return (sectors + 1).toString()
            }
        } else {
            if (centerPlates == 3 && normalizedRadius <= coneRadialCenterRadiusRatio.toDouble()) {
                return (sectors + 3).toString()
            }
            if (normalizedRadius < coneRadialTransitionRadiusRatio.toDouble()) {
            val angle = azimuthToCanvasRadians(azimuthDeg)
            return if (sin(angle) < 0.0) {
                (sectors + 1).toString()
            } else {
                (sectors + 2).toString()
            }
        }
        }
        val sectionStep = 360.0 / sectors.toDouble()
        val directionFactor = if (rotationDirection == RotationDirection.CLOCKWISE) 1.0 else -1.0
        val relativeAzimuth = normalizeAzimuth((azimuthDeg - referenceAzimuthDeg) * directionFactor)
        val sectorIndex = floor(relativeAzimuth / sectionStep).toInt().coerceIn(0, sectors - 1)
        return (sectorIndex + 1).toString()
    }
    val plateCells = buildRoofLinkTargetsForConfig(
        template = template,
        rowCount = rowCount,
        widestRowPlateCount = widestRowPlateCount,
        ringCount = ringCount,
        sectorCount = sectorCount,
        referenceAzimuthDeg = referenceAzimuthDeg,
        rotationDirection = rotationDirection,
        hasAnnularRing = false,
        annularSectionCount = 0,
    )
    if (plateCells.isEmpty()) return null
    val (xNorm, yNorm) = roofPolarToCanvasPoint(azimuthDeg, radiusRatio)
    return plateCells.firstOrNull { cell ->
        xNorm in cell.leftNorm..cell.rightNorm && yNorm in cell.topNorm..cell.bottomNorm
    }?.plateId
}

private fun annularRingSectionCells(
    referenceAzimuthDeg: Double,
    rotationDirection: RotationDirection,
    annularSectionCount: Int,
): List<RoofPlateCell> {
    val stepDeg = 360.0 / annularSectionCount.toDouble()
    val directionFactor = if (rotationDirection == RotationDirection.CLOCKWISE) 1.0 else -1.0
    val labelRadius = (mainRoofRadiusRatio + annularOuterRadiusRatio) / 2f
    return List(annularSectionCount) { sectionIndex ->
        val sectionNumber = sectionIndex + 1
        val sectionAzimuth = normalizeAzimuth(referenceAzimuthDeg + directionFactor * stepDeg * (sectionIndex + 0.5))
        val angle = azimuthToCanvasRadians(sectionAzimuth)
        val xNorm = 0.5f + (cos(angle).toFloat() * labelRadius)
        val yNorm = 0.5f + (sin(angle).toFloat() * labelRadius)
        RoofPlateCell(
            plateId = "AR$sectionNumber",
            mapLabel = "AR$sectionNumber",
            selectionLabel = "Annular Ring Section $sectionNumber",
            rowNumber = 0,
            xNorm = xNorm,
            yNorm = yNorm,
            labelXNorm = xNorm,
            labelYNorm = yNorm,
            leftNorm = xNorm - 0.035f,
            rightNorm = xNorm + 0.035f,
            topNorm = yNorm - 0.022f,
            bottomNorm = yNorm + 0.022f,
        )
    }
}

private fun normalizeAzimuth(value: Double): Double {
    var result = value % 360.0
    if (result < 0.0) result += 360.0
    return result
}

private fun titleCaseType(type: String): String =
    type
        .split('_')
        .filter { it.isNotBlank() }
        .joinToString(" ") { token ->
            token.lowercase().replaceFirstChar { first ->
                if (first.isLowerCase()) first.titlecase() else first.toString()
            }
        }

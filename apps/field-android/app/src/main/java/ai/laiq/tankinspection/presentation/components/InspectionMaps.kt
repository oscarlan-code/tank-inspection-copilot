package ai.laiq.tankinspection.presentation.components

import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.domain.model.RotationDirection
import ai.laiq.tankinspection.presentation.RoofPlateCell
import ai.laiq.tankinspection.presentation.azimuthToCanvasRadians
import ai.laiq.tankinspection.presentation.buildRoofLinkTargetsForConfig
import ai.laiq.tankinspection.presentation.buildRoofPlateCells
import ai.laiq.tankinspection.presentation.canvasPointToRoofPolar
import ai.laiq.tankinspection.presentation.nearestRoofPlateId
import ai.laiq.tankinspection.presentation.roofPlateIdAtPolar
import ai.laiq.tankinspection.presentation.roofPolarToCanvasPoint
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.Canvas
import kotlinx.coroutines.flow.collect
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

data class ShellMapLineVisual(
    val lineId: String,
    val label: String,
    val azimuthDeg: Int? = null,
)

data class ShellCellMarker(
    val markerId: String,
    val lineId: String,
    val course: Int,
    val label: String,
    val xRatio: Float = 0.5f,
    val yRatio: Float = 0.5f,
    val active: Boolean = false,
)

data class RoofMapMarker(
    val markerId: String,
    val label: String,
    val plateId: String? = null,
    val azimuthDeg: Double? = null,
    val radiusRatio: Double? = null,
    val active: Boolean = false,
)

private val shellDegreeScaleMarks = listOf(0, 90, 180, 270)

@Composable
fun ShellSurfaceMap(
    lines: List<ShellMapLineVisual>,
    courseCount: Int,
    activeCell: Pair<String, Int>?,
    savedCells: Set<Pair<String, Int>> = emptySet(),
    overlayCells: Set<Pair<String, Int>> = emptySet(),
    markers: List<ShellCellMarker> = emptyList(),
    scaleOriginLabel: String? = null,
    anchorLaneId: String? = null,
    anchorLabel: String = "Ref",
    captureStartLaneId: String? = null,
    enableViewportControls: Boolean = true,
    repeatCycles: Boolean = true,
    fitToViewport: Boolean = false,
    viewportControlsAtBottom: Boolean = false,
    showViewportGuidance: Boolean = true,
    showFooterGuidance: Boolean = true,
    fillActiveCell: Boolean = true,
    showOverlayBadges: Boolean = true,
    showTitle: Boolean = true,
    showScaleOriginText: Boolean = true,
    onSelectCell: (String, Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (courseCount <= 0 || lines.isEmpty()) return

    BoxWithConstraints(modifier = modifier.fillMaxWidth()) {
        val scrollState = rememberScrollState()
        val density = LocalDensity.current
        var zoomFactor by rememberSaveable { mutableFloatStateOf(1.15f) }
        val sideLabelWidth = 50.dp
        val availableGridWidth = (maxWidth - sideLabelWidth).coerceAtLeast(160.dp)
        val baseCellWidth = 72.dp
        val cellWidth = if (fitToViewport) {
            availableGridWidth / lines.size.coerceAtLeast(1)
        } else {
            (baseCellWidth * zoomFactor).coerceAtLeast(52.dp)
        }
        val cycleWidth = if (fitToViewport) {
            availableGridWidth
        } else if (cellWidth * lines.size > availableGridWidth) {
            cellWidth * lines.size
        } else {
            availableGridWidth
        }
        val repeatedCycleCount = if (repeatCycles) {
            if (lines.size > 1) 5 else 3
        } else {
            1
        }
        val middleCycleIndex = repeatedCycleCount / 2
        val scaleMarks = shellScaleMarksFor(lines)
        val repeatedGridWidth = cycleWidth * repeatedCycleCount
        val cycleLineStripWidth = cellWidth * lines.size
        val trailingCycleSpacerWidth = (cycleWidth - cycleLineStripWidth).coerceAtLeast(0.dp)
        val cellHeight = 34.dp
        val cycleWidthPx = with(density) { cycleWidth.toPx() }
        val viewportWidthPx = with(density) { availableGridWidth.toPx() }
        val allowHorizontalScroll = repeatCycles

        if (allowHorizontalScroll) {
            LaunchedEffect(lines.map { line -> line.lineId }, captureStartLaneId, zoomFactor, cycleWidthPx, viewportWidthPx) {
                val shouldStartAtTrailingEdge = captureStartLaneId != null && lines.lastOrNull()?.lineId == captureStartLaneId
                val trailingOffsetPx = if (shouldStartAtTrailingEdge) {
                    (cycleWidthPx - viewportWidthPx).coerceAtLeast(0f)
                } else {
                    0f
                }
                val targetScroll = cycleWidthPx * middleCycleIndex.toFloat() + trailingOffsetPx
                scrollState.scrollTo(targetScroll.roundToInt())
            }
        }

        if (allowHorizontalScroll) {
            LaunchedEffect(cycleWidthPx, repeatedCycleCount) {
                if (cycleWidthPx <= 0f || repeatedCycleCount < 3) return@LaunchedEffect
                snapshotFlow { scrollState.value }.collect { currentValue ->
                    val cycleIndex = (currentValue / cycleWidthPx).toInt()
                    when {
                        cycleIndex <= 0 -> scrollState.scrollTo((currentValue + cycleWidthPx).roundToInt())
                        cycleIndex >= repeatedCycleCount - 2 -> scrollState.scrollTo((currentValue - cycleWidthPx).roundToInt())
                    }
                }
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (showTitle) {
                Text("Shell Surface Map", style = MaterialTheme.typography.titleSmall, color = LaiqColors.BodyText)
            }
            if (showScaleOriginText) {
                scaleOriginLabel?.takeIf { it.isNotBlank() }?.let { originLabel ->
                    Text(
                        "Crawler lane anchor: Lane 1 = $originLabel",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                }
            }
            if (enableViewportControls && !viewportControlsAtBottom) {
                if (showViewportGuidance) {
                    Text(
                        "Drag horizontally through repeating 0°-360° shell cycles. Use zoom to widen or compress the crawler lane spacing.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                    Text(
                        "Zoom",
                        style = MaterialTheme.typography.labelMedium,
                        color = LaiqColors.MutedText,
                    )
                }
                Slider(
                    value = zoomFactor,
                    onValueChange = { zoomFactor = it },
                    valueRange = 0.85f..2.0f,
                )
            }
            Row {
                Spacer(modifier = Modifier.width(sideLabelWidth))
                Box(
                    modifier = Modifier
                        .width(availableGridWidth)
                        .height(24.dp)
                        .then(if (allowHorizontalScroll) Modifier.horizontalScroll(scrollState) else Modifier),
                ) {
                    Row(modifier = Modifier.width(repeatedGridWidth)) {
                        repeat(repeatedCycleCount) { cycleIndex ->
                            Box(
                                modifier = Modifier
                                    .width(cycleWidth)
                                    .height(24.dp),
                            ) {
                                if (!repeatCycles || cycleIndex == middleCycleIndex) {
                                    scaleMarks.forEach { (degree, offsetFraction) ->
                                        val markerWidth = 36.dp
                                        val markerOffset = (cycleWidth - markerWidth) * offsetFraction
                                        Text(
                                            "${degree}°",
                                            modifier = Modifier
                                                .width(markerWidth)
                                                .offset(x = markerOffset),
                                            style = MaterialTheme.typography.labelSmall,
                                            color = LaiqColors.MutedText,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Row {
                Spacer(modifier = Modifier.width(sideLabelWidth))
                Box(
                    modifier = Modifier
                        .width(availableGridWidth)
                        .then(if (allowHorizontalScroll) Modifier.horizontalScroll(scrollState) else Modifier),
                ) {
                    Row(modifier = Modifier.width(repeatedGridWidth)) {
                        repeat(repeatedCycleCount) { cycleIndex ->
                            Box(modifier = Modifier.width(cycleWidth)) {
                                Row {
                                    lines.forEach { line ->
                                        Box(
                                            modifier = Modifier
                                                .width(cellWidth)
                                                .height(28.dp),
                                            contentAlignment = Alignment.Center,
                                        ) {
                                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                if ((!repeatCycles || cycleIndex == middleCycleIndex) && line.lineId == anchorLaneId) {
                                                    Text(
                                                        text = anchorLabel,
                                                        style = MaterialTheme.typography.labelSmall,
                                                        color = LaiqColors.AccentOrange,
                                                    )
                                                }
                                                if ((!repeatCycles || cycleIndex == middleCycleIndex) && line.lineId == captureStartLaneId) {
                                                    Text(
                                                        "Start",
                                                        style = MaterialTheme.typography.labelSmall,
                                                        color = LaiqColors.BrandTeal,
                                                    )
                                                }
                                            }
                                        }
                                    }
                                    if (trailingCycleSpacerWidth > 0.dp) {
                                        Spacer(modifier = Modifier.width(trailingCycleSpacerWidth))
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Row {
                Spacer(modifier = Modifier.width(sideLabelWidth))
                Box(
                    modifier = Modifier
                        .width(availableGridWidth)
                        .then(if (allowHorizontalScroll) Modifier.horizontalScroll(scrollState) else Modifier),
                ) {
                    Row(modifier = Modifier.width(repeatedGridWidth)) {
                        repeat(repeatedCycleCount) {
                            Box(modifier = Modifier.width(cycleWidth)) {
                                Row {
                                    lines.forEach { line ->
                                        Box(
                                            modifier = Modifier.width(cellWidth),
                                            contentAlignment = Alignment.Center,
                                        ) {
                                            Text(line.label, style = MaterialTheme.typography.labelMedium, color = LaiqColors.BodyText)
                                        }
                                    }
                                    if (trailingCycleSpacerWidth > 0.dp) {
                                        Spacer(modifier = Modifier.width(trailingCycleSpacerWidth))
                                    }
                                }
                            }
                        }
                    }
                }
            }
            for (course in courseCount downTo 1) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .width(sideLabelWidth)
                        .height(cellHeight),
                        contentAlignment = Alignment.CenterStart,
                    ) {
                        Text("S$course", style = MaterialTheme.typography.labelMedium, color = LaiqColors.MutedText)
                    }
                    Box(
                        modifier = Modifier
                            .width(availableGridWidth)
                            .then(if (allowHorizontalScroll) Modifier.horizontalScroll(scrollState) else Modifier),
                    ) {
                        Row(modifier = Modifier.width(repeatedGridWidth)) {
                            repeat(repeatedCycleCount) {
                                Box(modifier = Modifier.width(cycleWidth)) {
                                    Row {
                                        lines.forEach { line ->
                                            val cellKey = line.lineId to course
                                            val isActive = activeCell == cellKey
                                            val isSaved = savedCells.contains(cellKey)
                                            val hasOverlay = overlayCells.contains(cellKey)
                                            val cellMarkers = markers.filter { marker ->
                                                marker.lineId == line.lineId && marker.course == course
                                            }
                                            Surface(
                                                onClick = { onSelectCell(line.lineId, course) },
                                                modifier = Modifier
                                                    .width(cellWidth)
                                                    .height(cellHeight)
                                                    .padding(horizontal = 2.dp, vertical = 1.dp),
                                                color = when {
                                                    fillActiveCell && isActive && cellMarkers.isEmpty() -> LaiqColors.BrandRed
                                                    isSaved -> LaiqColors.BrandTeal.copy(alpha = 0.12f)
                                                    else -> Color.White
                                                },
                                                shape = RoundedCornerShape(10.dp),
                                                border = BorderStroke(
                                                    1.dp,
                                                    when {
                                                        isActive -> LaiqColors.BrandRed
                                                        hasOverlay -> LaiqColors.AccentOrange
                                                        isSaved -> LaiqColors.BrandTeal.copy(alpha = 0.45f)
                                                        else -> LaiqColors.PanelBorder
                                                    },
                                                ),
                                            ) {
                                                Box(
                                                    modifier = Modifier
                                                        .fillMaxWidth()
                                                        .height(cellHeight),
                                                ) {
                                                    if (hasOverlay && showOverlayBadges) {
                                                        Box(
                                                            modifier = Modifier
                                                                .size(8.dp)
                                                                .align(Alignment.TopEnd)
                                                                .offset(x = (-4).dp, y = 4.dp)
                                                                .background(LaiqColors.AccentOrange, CircleShape),
                                                        )
                                                    }
                                                    Text(
                                                        text = "",
                                                        modifier = Modifier.align(Alignment.Center),
                                                        color = if (isActive) Color.White else LaiqColors.BodyText,
                                                        style = MaterialTheme.typography.labelSmall,
                                                    )
                                                    cellMarkers.forEach { marker ->
                                                        Box(
                                                            modifier = Modifier
                                                                .align(Alignment.TopStart)
                                                                .offset(
                                                                    x = (cellWidth - 20.dp) * marker.xRatio.coerceIn(0.05f, 0.95f),
                                                                    y = (cellHeight - 20.dp) * marker.yRatio.coerceIn(0.05f, 0.95f),
                                                                ),
                                                        ) {
                                                            Box(
                                                                modifier = Modifier
                                                                    .size(if (marker.active) 12.dp else 10.dp)
                                                                    .background(
                                                                        if (marker.active) LaiqColors.BrandRed else LaiqColors.AccentOrange,
                                                                        CircleShape,
                                                                    ),
                                                            )
                                                            Text(
                                                                marker.label,
                                                                modifier = Modifier
                                                                    .offset(x = 10.dp, y = (-2).dp),
                                                                style = MaterialTheme.typography.labelSmall,
                                                                color = LaiqColors.BrandTeal,
                                                            )
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        if (trailingCycleSpacerWidth > 0.dp) {
                                            Spacer(modifier = Modifier.width(trailingCycleSpacerWidth))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if (enableViewportControls && viewportControlsAtBottom) {
                if (showViewportGuidance) {
                    Text(
                        "Zoom",
                        style = MaterialTheme.typography.labelMedium,
                        color = LaiqColors.MutedText,
                    )
                }
                Slider(
                    value = zoomFactor,
                    onValueChange = { zoomFactor = it },
                    valueRange = 0.85f..2.0f,
                )
            }
            if (showFooterGuidance) {
                Text(
                    if (allowHorizontalScroll) {
                        "Top courses are shown above lower courses. Tap a crawler lane and strake cell to select it. Display order follows the saved start lane without changing the underlying lane IDs, and the shell strip repeats continuously across each 0°-360° cycle."
                    } else {
                        "Top courses are shown above lower courses. This preview is zoomed out to show the full shell layout at once before capture begins."
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.MutedText,
                )
            }
        }
    }
}

private fun shellScaleMarksFor(lines: List<ShellMapLineVisual>): List<Pair<Int, Float>> {
    val resolvedAzimuths = lines.mapNotNull { line -> line.azimuthDeg?.toFloat() }
    if (resolvedAzimuths.size != lines.size || lines.isEmpty()) {
        return shellDegreeScaleMarks.map { degree -> degree to (degree / 360f) }
    }

    val step = 360f / lines.size.toFloat()
    val startBoundaryDeg = normalizeShellScaleDegrees(resolvedAzimuths.first() - (step / 2f))
    return shellDegreeScaleMarks.map { degree ->
        degree to positiveShellScaleDelta(degree.toFloat() - startBoundaryDeg) / 360f
    }
}

private fun normalizeShellScaleDegrees(value: Float): Float {
    var result = value % 360f
    if (result < 0f) result += 360f
    return result
}

private fun positiveShellScaleDelta(value: Float): Float {
    var result = value % 360f
    if (result < 0f) result += 360f
    return result
}

@Composable
fun RoofSurfaceMap(
    template: RoofTemplate,
    rowCount: Int,
    widestRowPlateCount: Int,
    ringCount: Int,
    sectorCount: Int,
    activePlateId: String?,
    savedPlateIds: Set<String> = emptySet(),
    overlayPlateIds: Set<String> = emptySet(),
    centerFeatureCount: Int = 0,
    hasAnnularRing: Boolean = false,
    annularSectionCount: Int = 0,
    hasPontoonDeck: Boolean = false,
    markers: List<RoofMapMarker> = emptyList(),
    referenceLabel: String? = null,
    referenceAzimuthDeg: Double = 0.0,
    rotationDirection: RotationDirection = RotationDirection.CLOCKWISE,
    onSelectPosition: ((Double, Double) -> Unit)? = null,
    onSelectPlate: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val plateCells = buildRoofPlateCells(
        template = template,
        rowCount = rowCount,
        widestRowPlateCount = widestRowPlateCount,
        ringCount = ringCount,
        sectorCount = sectorCount,
        referenceAzimuthDeg = referenceAzimuthDeg,
        rotationDirection = rotationDirection,
    )
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
    val isCircularTemplate = template == RoofTemplate.CIRCULAR_PLATE || template == RoofTemplate.CIRCULAR_CENTER_OPENING
    val isConeRadialTemplate = template == RoofTemplate.CONE_RADIAL
    val showCenterOpening = template == RoofTemplate.CIRCULAR_CENTER_OPENING || centerFeatureCount > 0
    val displayPlateCells = plateCells
    val annularLinkTargets = linkTargets.filter { target -> target.plateId.startsWith("AR") }
    val markerPoints = markers.mapNotNull { marker ->
        val point = when {
            marker.azimuthDeg != null && marker.radiusRatio != null -> {
                val resolvedPlateId = roofPlateIdAtPolar(
                    template = template,
                    rowCount = rowCount,
                    widestRowPlateCount = widestRowPlateCount,
                    ringCount = ringCount,
                    sectorCount = sectorCount,
                    referenceAzimuthDeg = referenceAzimuthDeg,
                    rotationDirection = rotationDirection,
                    hasAnnularRing = hasAnnularRing,
                    annularSectionCount = annularSectionCount,
                    azimuthDeg = marker.azimuthDeg,
                    radiusRatio = marker.radiusRatio,
                )
                if (!marker.plateId.isNullOrBlank() && resolvedPlateId != marker.plateId) {
                    linkTargets.firstOrNull { it.plateId == marker.plateId }?.let { cell ->
                        cell.xNorm to cell.yNorm
                    }
                } else {
                    val (xNorm, yNorm) = roofPolarToCanvasPoint(marker.azimuthDeg, marker.radiusRatio)
                    xNorm to yNorm
                }
            }

            !marker.plateId.isNullOrBlank() -> linkTargets.firstOrNull { it.plateId == marker.plateId }?.let { cell ->
                cell.xNorm to cell.yNorm
            }

            else -> null
        } ?: return@mapNotNull null
        marker to point
    }

    BoxWithConstraints(modifier = modifier.fillMaxWidth()) {
        val mapSize = if (maxWidth < 320.dp) maxWidth else 320.dp
        val umbrellaLabelWidth = 34.dp
        val umbrellaLabelHeight = 20.dp
        val circularLabelWidth = 28.dp
        val circularLabelHeight = 20.dp

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Roof Layout Map", style = MaterialTheme.typography.titleSmall, color = LaiqColors.BodyText)
            referenceLabel?.takeIf { it.isNotBlank() }?.let { label ->
                Text(
                    "Reference: 0° = $label",
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.MutedText,
                )
            }
            Box(
                modifier = Modifier
                    .size(mapSize)
                    .align(Alignment.CenterHorizontally),
            ) {
                Canvas(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(1f),
                ) {
                    val strokeColor = LaiqColors.PanelBorder
                    val radius = size.minDimension * 0.42f
                    val annularOuterRadius = if (hasAnnularRing) size.minDimension * 0.48f else radius
                    val center = Offset(size.width / 2f, size.height / 2f)
                    val referenceAngle = azimuthToCanvasRadians(referenceAzimuthDeg)
                    drawCircle(color = LaiqColors.BrandTeal.copy(alpha = 0.08f), radius = radius, center = center)
                    if (hasPontoonDeck) {
                        drawCircle(
                            color = LaiqColors.BrandTeal.copy(alpha = 0.10f),
                            radius = radius * 0.90f,
                            center = center,
                            style = Stroke(width = radius * 0.16f),
                        )
                    }
                    if (hasAnnularRing) {
                        val ringOuterRadius = annularOuterRadius
                        val ringInnerRadius = radius
                        drawCircle(
                            color = LaiqColors.AccentOrange.copy(alpha = 0.12f),
                            radius = (ringOuterRadius + ringInnerRadius) / 2f,
                            center = center,
                            style = Stroke(width = ringOuterRadius - ringInnerRadius),
                        )
                        val sectionCount = annularSectionCount.coerceAtLeast(0)
                        if (sectionCount > 0) {
                            val sectionStep = 360.0 / sectionCount.toDouble()
                            repeat(sectionCount) { sectionIndex ->
                                val angle = azimuthToCanvasRadians(referenceAzimuthDeg + sectionStep * sectionIndex)
                                val cosValue = cos(angle).toFloat()
                                val sinValue = sin(angle).toFloat()
                                drawLine(
                                    color = LaiqColors.AccentOrange.copy(alpha = 0.75f),
                                    start = Offset(
                                        x = center.x + (cosValue * ringInnerRadius),
                                        y = center.y + (sinValue * ringInnerRadius),
                                    ),
                                    end = Offset(
                                        x = center.x + (cosValue * ringOuterRadius),
                                        y = center.y + (sinValue * ringOuterRadius),
                                    ),
                                    strokeWidth = 2f,
                                )
                            }
                        }
                        drawCircle(
                            color = LaiqColors.AccentOrange.copy(alpha = 0.85f),
                            radius = ringOuterRadius,
                            center = center,
                            style = Stroke(width = 2f),
                        )
                    }
                    drawCircle(color = LaiqColors.BrandTeal.copy(alpha = 0.45f), radius = radius, center = center, style = Stroke(width = 3f))
                    drawLine(
                        color = LaiqColors.AccentOrange,
                        start = center,
                        end = Offset(
                            x = center.x + (cos(referenceAngle) * annularOuterRadius).toFloat(),
                            y = center.y + (sin(referenceAngle) * annularOuterRadius).toFloat(),
                        ),
                        strokeWidth = 3f,
                    )

                    if (!isCircularTemplate) {
                        when (template) {
                            RoofTemplate.CIRCULAR_PLATE,
                            RoofTemplate.CIRCULAR_CENTER_OPENING -> Unit
                            RoofTemplate.CONE_RADIAL -> {
                                val sectors = sectorCount.coerceAtLeast(1)
                                val centerPlates = ringCount.coerceIn(1, 3)
                                val sectorStep = 360.0 / sectors.toDouble()
                                val directionFactor = if (rotationDirection == RotationDirection.CLOCKWISE) 1.0 else -1.0
                                val transitionOuterRadius = radius * 0.33f
                                val centerPlateRadius = if (centerPlates == 1) {
                                    transitionOuterRadius
                                } else {
                                    radius * 0.17f
                                }
                                drawCircle(
                                    color = strokeColor,
                                    radius = transitionOuterRadius,
                                    center = center,
                                    style = Stroke(width = 2f),
                                )
                                if (centerPlates == 3) {
                                    drawCircle(
                                        color = strokeColor,
                                        radius = centerPlateRadius,
                                        center = center,
                                        style = Stroke(width = 2f),
                                    )
                                }
                                for (sector in 0 until sectors) {
                                    val angle = azimuthToCanvasRadians(referenceAzimuthDeg + directionFactor * sector * sectorStep)
                                    val cosValue = cos(angle).toFloat()
                                    val sinValue = sin(angle).toFloat()
                                    drawLine(
                                        color = strokeColor,
                                        start = Offset(
                                            x = center.x + (cosValue * transitionOuterRadius),
                                            y = center.y + (sinValue * transitionOuterRadius),
                                        ),
                                        end = Offset(
                                            x = center.x + (cosValue * radius),
                                            y = center.y + (sinValue * radius),
                                        ),
                                        strokeWidth = 2f,
                                    )
                                }
                                when (activePlateId?.toIntOrNull()) {
                                    null -> Unit
                                    sectors + 1 -> if (centerPlates == 1) {
                                        drawCircle(
                                            color = LaiqColors.BrandRed,
                                            radius = transitionOuterRadius,
                                            center = center,
                                            style = Stroke(width = 4f),
                                        )
                                    } else {
                                        drawRoofRingSectorOutline(
                                            center = center,
                                            innerRadius = if (centerPlates == 3) centerPlateRadius else 0f,
                                            outerRadius = transitionOuterRadius,
                                            centerAngleDeg = -90f,
                                            sweepDeg = 180f,
                                            color = LaiqColors.BrandRed,
                                        )
                                    }
                                    sectors + 2 -> if (centerPlates == 2 || centerPlates == 3) {
                                        drawRoofRingSectorOutline(
                                            center = center,
                                            innerRadius = if (centerPlates == 3) centerPlateRadius else 0f,
                                            outerRadius = transitionOuterRadius,
                                            centerAngleDeg = 90f,
                                            sweepDeg = 180f,
                                            color = LaiqColors.BrandRed,
                                        )
                                    } else {
                                        Unit
                                    }
                                    sectors + 3 -> if (centerPlates == 3) {
                                        drawCircle(
                                            color = LaiqColors.BrandRed,
                                            radius = centerPlateRadius,
                                            center = center,
                                            style = Stroke(width = 4f),
                                        )
                                    } else {
                                        Unit
                                    }
                                    else -> {
                                        val activeNumber = activePlateId.toIntOrNull()?.takeIf { it in 1..sectors } ?: return@Canvas
                                        val centerAzimuth = normalizeDegreesForMap(
                                            referenceAzimuthDeg + directionFactor * sectorStep * (activeNumber - 0.5),
                                        )
                                        val centerAngleDeg = Math.toDegrees(azimuthToCanvasRadians(centerAzimuth)).toFloat()
                                        drawRoofRingSectorOutline(
                                            center = center,
                                            innerRadius = transitionOuterRadius,
                                            outerRadius = radius,
                                            centerAngleDeg = centerAngleDeg,
                                            sweepDeg = sectorStep.toFloat(),
                                            color = LaiqColors.BrandRed,
                                        )
                                    }
                                }
                            }
                            RoofTemplate.UMBRELLA_RADIAL -> {
                            val rings = ringCount.coerceAtLeast(1)
                            val sectors = sectorCount.coerceAtLeast(1)
                            val sectorStep = 360.0 / sectors.toDouble()
                            val directionFactor = if (rotationDirection == RotationDirection.CLOCKWISE) 1.0 else -1.0
                            for (ring in 1 until rings) {
                                drawCircle(
                                    color = strokeColor,
                                    radius = radius * ring / rings.toFloat(),
                                    center = center,
                                    style = Stroke(width = 2f),
                                )
                            }
                            for (sector in 0 until sectors) {
                                val angle = azimuthToCanvasRadians(referenceAzimuthDeg + directionFactor * sector * sectorStep)
                                drawLine(
                                    color = strokeColor,
                                    start = center,
                                    end = Offset(
                                        x = center.x + (cos(angle) * radius).toFloat(),
                                        y = center.y + (sin(angle) * radius).toFloat(),
                                    ),
                                    strokeWidth = 2f,
                                )
                            }
                            displayPlateCells.firstOrNull { cell -> cell.plateId == activePlateId }?.let { activeCell ->
                                val centerAngleDeg = Math.toDegrees(
                                    atan2(
                                        (activeCell.yNorm - 0.5f).toDouble(),
                                        (activeCell.xNorm - 0.5f).toDouble(),
                                    ),
                                ).toFloat()
                                val innerRadius = radius * (activeCell.rowNumber - 1) / rings.toFloat()
                                val outerRadius = radius * activeCell.rowNumber / rings.toFloat()
                                drawRoofRingSectorOutline(
                                    center = center,
                                    innerRadius = innerRadius,
                                    outerRadius = outerRadius,
                                    centerAngleDeg = centerAngleDeg,
                                    sweepDeg = sectorStep.toFloat(),
                                    color = LaiqColors.BrandRed,
                                )
                            }
                        }
                    }
                    }
                    annularLinkTargets.firstOrNull { cell -> cell.plateId == activePlateId }?.let { activeSection ->
                        val sectionCount = annularSectionCount.coerceAtLeast(0)
                        if (hasAnnularRing && sectionCount > 0) {
                            val centerAngleDeg = Math.toDegrees(
                                atan2(
                                    (activeSection.yNorm - 0.5f).toDouble(),
                                    (activeSection.xNorm - 0.5f).toDouble(),
                                ),
                            ).toFloat()
                            drawRoofRingSectorOutline(
                                center = center,
                                innerRadius = radius,
                                outerRadius = annularOuterRadius,
                                centerAngleDeg = centerAngleDeg,
                                sweepDeg = (360f / sectionCount.toFloat()),
                                color = LaiqColors.BrandRed,
                            )
                        }
                    }
                }
                val zeroLabelRadiusFactor = if (hasAnnularRing) 0.48f else 0.42f
                val zeroLabelX = (0.5f + (cos(azimuthToCanvasRadians(referenceAzimuthDeg)).toFloat() * zeroLabelRadiusFactor)).coerceIn(0.08f, 0.88f)
                val zeroLabelY = (0.5f + (sin(azimuthToCanvasRadians(referenceAzimuthDeg)).toFloat() * zeroLabelRadiusFactor)).coerceIn(0.08f, 0.90f)
                Text(
                    "0°",
                    modifier = Modifier
                        .offset(
                            x = mapSize * zeroLabelX - 14.dp,
                            y = mapSize * zeroLabelY - 18.dp,
                        ),
                    style = MaterialTheme.typography.labelSmall,
                    color = LaiqColors.AccentOrange,
                )
                if (hasAnnularRing) {
                    Text(
                        "Annular Ring",
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .offset(y = (-6).dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = LaiqColors.AccentOrange,
                    )
                }
                if (hasPontoonDeck) {
                    Text(
                        "Pontoon Deck",
                        modifier = Modifier
                            .align(Alignment.TopCenter)
                            .offset(y = 6.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = LaiqColors.BrandTeal,
                    )
                }
                if (isCircularTemplate) {
                    Box(
                        modifier = Modifier
                            .size(mapSize)
                            .clipToRoofCircle(),
                    ) {
                        displayPlateCells.forEach { cell ->
                            val isActive = cell.plateId == activePlateId
                            val isSaved = savedPlateIds.contains(cell.plateId)
                            val hasOverlay = overlayPlateIds.contains(cell.plateId)
                            Surface(
                                onClick = { onSelectPlate(cell.plateId) },
                                modifier = Modifier
                                    .offset(
                                        x = mapSize * cell.leftNorm,
                                        y = mapSize * cell.topNorm,
                                    )
                                    .width(mapSize * (cell.rightNorm - cell.leftNorm))
                                    .height(mapSize * (cell.bottomNorm - cell.topNorm))
                                    .padding(1.dp),
                                color = when {
                                    isSaved -> LaiqColors.BrandTeal.copy(alpha = 0.12f)
                                    else -> Color.White
                                },
                                shape = RoundedCornerShape(4.dp),
                                border = BorderStroke(
                                    if (isActive) 2.dp else 1.dp,
                                    when {
                                        isActive -> LaiqColors.BrandRed
                                        hasOverlay -> LaiqColors.AccentOrange
                                        isSaved -> LaiqColors.BrandTeal.copy(alpha = 0.45f)
                                        else -> LaiqColors.PanelBorder
                                    },
                                ),
                            ) {
                                Box(modifier = Modifier.matchParentSize()) {
                                    if (hasOverlay) {
                                        Box(
                                            modifier = Modifier
                                                .size(6.dp)
                                                .align(Alignment.TopEnd)
                                                .offset(x = (-3).dp, y = 3.dp)
                                                .background(LaiqColors.AccentOrange, CircleShape),
                                        )
                                    }
                                }
                            }
                        }
                    }
                    Canvas(
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(1f),
                    ) {
                        val radius = size.minDimension * 0.42f
                        val center = Offset(size.width / 2f, size.height / 2f)
                        drawCircle(
                            color = LaiqColors.BrandTeal,
                            radius = radius,
                            center = center,
                            style = Stroke(width = 4f),
                        )
                    }
                    displayPlateCells.forEach { cell ->
                        Box(
                            modifier = Modifier
                                .width(circularLabelWidth)
                                .height(circularLabelHeight)
                                .offset(
                                    x = mapSize * cell.labelXNorm - circularLabelWidth / 2,
                                    y = mapSize * cell.labelYNorm - circularLabelHeight / 2,
                                ),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = cell.mapLabel,
                                style = MaterialTheme.typography.labelSmall,
                                color = LaiqColors.BodyText,
                            )
                        }
                    }
                } else {
                    displayPlateCells.forEach { cell ->
                        val isSaved = savedPlateIds.contains(cell.plateId)
                        val hasOverlay = overlayPlateIds.contains(cell.plateId)
                        Surface(
                            onClick = { onSelectPlate(cell.plateId) },
                            modifier = Modifier
                                .width(umbrellaLabelWidth)
                                .height(umbrellaLabelHeight)
                                .offset(
                                    x = mapSize * cell.labelXNorm - umbrellaLabelWidth / 2,
                                    y = mapSize * cell.labelYNorm - umbrellaLabelHeight / 2,
                                ),
                            color = when {
                                isSaved -> LaiqColors.BrandTeal.copy(alpha = 0.12f)
                                else -> Color.White
                            },
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(
                                1.dp,
                                when {
                                    hasOverlay -> LaiqColors.AccentOrange
                                    isSaved -> LaiqColors.BrandTeal.copy(alpha = 0.45f)
                                    else -> LaiqColors.PanelBorder
                                },
                            ),
                        ) {
                            Box(modifier = Modifier.matchParentSize()) {
                                if (hasOverlay) {
                                    Box(
                                        modifier = Modifier
                                            .size(6.dp)
                                            .align(Alignment.TopEnd)
                                            .offset(x = (-3).dp, y = 3.dp)
                                            .background(LaiqColors.AccentOrange, CircleShape),
                                    )
                                }
                                Text(
                                    text = cell.mapLabel,
                                    modifier = Modifier.align(Alignment.Center),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = LaiqColors.BodyText,
                                )
                            }
                        }
                    }
                }
                annularLinkTargets.forEach { cell ->
                    val isSaved = savedPlateIds.contains(cell.plateId)
                    val hasOverlay = overlayPlateIds.contains(cell.plateId)
                    Surface(
                        onClick = { onSelectPlate(cell.plateId) },
                        modifier = Modifier
                            .width(40.dp)
                            .height(22.dp)
                            .offset(
                                x = mapSize * cell.labelXNorm - 20.dp,
                                y = mapSize * cell.labelYNorm - 11.dp,
                            ),
                        color = when {
                            isSaved -> LaiqColors.BrandTeal.copy(alpha = 0.12f)
                            else -> Color.White
                        },
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(
                            1.dp,
                            when {
                                hasOverlay -> LaiqColors.AccentOrange
                                isSaved -> LaiqColors.BrandTeal.copy(alpha = 0.45f)
                                else -> LaiqColors.AccentOrange.copy(alpha = 0.65f)
                            },
                        ),
                    ) {
                        Box(modifier = Modifier.matchParentSize()) {
                            if (hasOverlay) {
                                Box(
                                    modifier = Modifier
                                        .size(6.dp)
                                        .align(Alignment.TopEnd)
                                        .offset(x = (-3).dp, y = 3.dp)
                                        .background(LaiqColors.AccentOrange, CircleShape),
                                )
                            }
                            Text(
                                text = cell.mapLabel,
                                modifier = Modifier.align(Alignment.Center),
                                style = MaterialTheme.typography.labelSmall,
                                color = LaiqColors.AccentOrange,
                            )
                        }
                    }
                }
                if (showCenterOpening) {
                    Surface(
                        modifier = Modifier
                            .size(mapSize * 0.15f)
                            .align(Alignment.Center),
                        color = LaiqColors.AccentOrange.copy(alpha = 0.18f),
                        shape = CircleShape,
                        border = BorderStroke(2.dp, LaiqColors.AccentOrange),
                    ) {}
                }
                markerPoints.forEach { (marker, point) ->
                    val markerSize = if (marker.active) 14.dp else 10.dp
                    Box(
                        modifier = Modifier
                            .size(markerSize)
                            .offset(
                                x = mapSize * point.first - markerSize / 2,
                                y = mapSize * point.second - markerSize / 2,
                            )
                            .background(
                                color = if (marker.active) LaiqColors.BrandRed else LaiqColors.AccentOrange,
                                shape = CircleShape,
                            ),
                    )
                    Text(
                        text = marker.label,
                        modifier = Modifier.offset(
                            x = mapSize * point.first + 6.dp,
                            y = mapSize * point.second - 8.dp,
                        ),
                        style = MaterialTheme.typography.labelSmall,
                        color = LaiqColors.BodyText,
                    )
                }
                if (onSelectPosition != null) {
                    Box(
                        modifier = Modifier
                            .matchParentSize()
                            .pointerInput(onSelectPosition, onSelectPlate) {
                                detectTapGestures(
                                    onTap = { offset ->
                                        val normalizedX = (offset.x / size.width.toFloat()).coerceIn(0f, 1f)
                                        val normalizedY = (offset.y / size.height.toFloat()).coerceIn(0f, 1f)
                                        val (azimuthDeg, radiusRatio) = canvasPointToRoofPolar(
                                            normalizedX,
                                            normalizedY,
                                        )
                                        nearestRoofPlateId(
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
                                        )?.let(onSelectPlate)
                                        publishRoofMapPosition(offset, size, hasAnnularRing, onSelectPosition)
                                    },
                                )
                            },
                    )
                }
            }
            Text(
                if (onSelectPosition != null) {
                    "Placement mode is active. Tap the roof map to preview the active roof element location. Plate link is kept alongside the visual estimate."
                } else {
                    "Tap a plate region on the map to select it."
                },
                style = MaterialTheme.typography.bodySmall,
                color = LaiqColors.MutedText,
            )
        }
    }
}

private fun Modifier.clipToRoofCircle(): Modifier =
    drawWithContent {
        val radius = size.minDimension * 0.42f
        val center = Offset(size.width / 2f, size.height / 2f)
        val roofClipPath = Path().apply {
            addOval(
                Rect(
                    left = center.x - radius,
                    top = center.y - radius,
                    right = center.x + radius,
                    bottom = center.y + radius,
                ),
            )
        }
        clipPath(roofClipPath) {
            this@drawWithContent.drawContent()
        }
    }

private fun publishRoofMapPosition(
    rawPosition: Offset,
    containerSize: IntSize,
    allowAnnularRing: Boolean = false,
    onSelectPosition: (Double, Double) -> Unit,
) {
    val center = Offset(containerSize.width / 2f, containerSize.height / 2f)
    val roofRadius = minOf(containerSize.width, containerSize.height) * if (allowAnnularRing) 0.48f else 0.42f
    val deltaX = rawPosition.x - center.x
    val deltaY = rawPosition.y - center.y
    val distance = sqrt(deltaX * deltaX + deltaY * deltaY)
    val scale = if (distance > roofRadius && distance > 0f) {
        roofRadius / distance
    } else {
        1f
    }
    val clamped = Offset(
        x = center.x + (deltaX * scale),
        y = center.y + (deltaY * scale),
    )
    val (azimuth, radiusRatio) = canvasPointToRoofPolar(
        xNorm = (clamped.x / containerSize.width).coerceIn(0f, 1f),
        yNorm = (clamped.y / containerSize.height).coerceIn(0f, 1f),
    )
    onSelectPosition(azimuth, radiusRatio)
}

private fun normalizeDegreesForMap(value: Double): Double {
    var result = value % 360.0
    if (result < 0.0) result += 360.0
    return result
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawRoofRingSectorOutline(
    center: Offset,
    innerRadius: Float,
    outerRadius: Float,
    centerAngleDeg: Float,
    sweepDeg: Float,
    color: Color,
    strokeWidth: Float = 4f,
) {
    val startAngleDeg = centerAngleDeg - (sweepDeg / 2f)
    val outerRect = Rect(
        left = center.x - outerRadius,
        top = center.y - outerRadius,
        right = center.x + outerRadius,
        bottom = center.y + outerRadius,
    )
    drawArc(
        color = color,
        startAngle = startAngleDeg,
        sweepAngle = sweepDeg,
        useCenter = false,
        topLeft = outerRect.topLeft,
        size = outerRect.size,
        style = Stroke(width = strokeWidth),
    )
    if (innerRadius > 0f) {
        val innerRect = Rect(
            left = center.x - innerRadius,
            top = center.y - innerRadius,
            right = center.x + innerRadius,
            bottom = center.y + innerRadius,
        )
        drawArc(
            color = color,
            startAngle = startAngleDeg,
            sweepAngle = sweepDeg,
            useCenter = false,
            topLeft = innerRect.topLeft,
            size = innerRect.size,
            style = Stroke(width = strokeWidth),
        )
    }
    val startRadians = Math.toRadians(startAngleDeg.toDouble())
    val endRadians = Math.toRadians((startAngleDeg + sweepDeg).toDouble())
    drawLine(
        color = color,
        start = Offset(
            x = center.x + (cos(startRadians).toFloat() * innerRadius),
            y = center.y + (sin(startRadians).toFloat() * innerRadius),
        ),
        end = Offset(
            x = center.x + (cos(startRadians).toFloat() * outerRadius),
            y = center.y + (sin(startRadians).toFloat() * outerRadius),
        ),
        strokeWidth = strokeWidth,
    )
    drawLine(
        color = color,
        start = Offset(
            x = center.x + (cos(endRadians).toFloat() * innerRadius),
            y = center.y + (sin(endRadians).toFloat() * innerRadius),
        ),
        end = Offset(
            x = center.x + (cos(endRadians).toFloat() * outerRadius),
            y = center.y + (sin(endRadians).toFloat() * outerRadius),
        ),
        strokeWidth = strokeWidth,
    )
}

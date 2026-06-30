package ai.laiq.tankinspection.presentation.components

import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.domain.model.RotationDirection
import ai.laiq.tankinspection.presentation.RoofPlateCell
import ai.laiq.tankinspection.presentation.azimuthToCanvasRadians
import ai.laiq.tankinspection.presentation.buildAnnularRingSectionCells
import ai.laiq.tankinspection.presentation.buildRoofLinkTargetsForConfig
import ai.laiq.tankinspection.presentation.buildRoofPlateCells
import ai.laiq.tankinspection.presentation.canvasPointToRoofPolar
import ai.laiq.tankinspection.presentation.nearestRoofPlateId
import ai.laiq.tankinspection.presentation.roofPlateIdAtPolar
import ai.laiq.tankinspection.presentation.roofPolarToCanvasPoint
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.Canvas
import kotlinx.coroutines.flow.collect
import kotlin.math.PI
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

private enum class RoofLeaderLabelSide {
    LEFT,
    RIGHT,
    TOP,
    BOTTOM,
}

private data class RoofLeaderLabel(
    val text: String,
    val sourceXNorm: Float,
    val sourceYNorm: Float,
    val xNorm: Float,
    val yNorm: Float,
)

private fun buildRoofLeaderLabels(cells: List<RoofPlateCell>): List<RoofLeaderLabel> {
    val groups = cells.groupBy { cell ->
        val dx = cell.labelXNorm - 0.5f
        val dy = cell.labelYNorm - 0.5f
        when {
            abs(dx) >= abs(dy) && dx < 0f -> RoofLeaderLabelSide.LEFT
            abs(dx) >= abs(dy) -> RoofLeaderLabelSide.RIGHT
            dy < 0f -> RoofLeaderLabelSide.TOP
            else -> RoofLeaderLabelSide.BOTTOM
        }
    }

    return buildList {
        addAll(verticalLeaderLabels(groups[RoofLeaderLabelSide.LEFT].orEmpty(), xNorm = 0.18f))
        addAll(verticalLeaderLabels(groups[RoofLeaderLabelSide.RIGHT].orEmpty(), xNorm = 0.82f))
        addAll(horizontalLeaderLabels(groups[RoofLeaderLabelSide.TOP].orEmpty(), yNorm = 0.18f))
        addAll(horizontalLeaderLabels(groups[RoofLeaderLabelSide.BOTTOM].orEmpty(), yNorm = 0.82f))
    }
}

private fun verticalLeaderLabels(
    cells: List<RoofPlateCell>,
    xNorm: Float,
): List<RoofLeaderLabel> {
    val sortedCells = cells.sortedBy { cell -> cell.labelYNorm }
    val yPositions = spreadLabelPositions(
        desiredPositions = sortedCells.map { cell -> cell.labelYNorm },
        min = 0.20f,
        max = 0.80f,
        preferredGap = 0.064f,
    )
    return sortedCells.mapIndexed { index, cell ->
        RoofLeaderLabel(
            text = cell.mapLabel,
            sourceXNorm = cell.labelXNorm,
            sourceYNorm = cell.labelYNorm,
            xNorm = xNorm,
            yNorm = yPositions[index],
        )
    }
}

private fun horizontalLeaderLabels(
    cells: List<RoofPlateCell>,
    yNorm: Float,
): List<RoofLeaderLabel> {
    val sortedCells = cells.sortedBy { cell -> cell.labelXNorm }
    val xPositions = spreadLabelPositions(
        desiredPositions = sortedCells.map { cell -> cell.labelXNorm },
        min = 0.22f,
        max = 0.78f,
        preferredGap = 0.112f,
    )
    return sortedCells.mapIndexed { index, cell ->
        RoofLeaderLabel(
            text = cell.mapLabel,
            sourceXNorm = cell.labelXNorm,
            sourceYNorm = cell.labelYNorm,
            xNorm = xPositions[index],
            yNorm = yNorm,
        )
    }
}

private fun spreadLabelPositions(
    desiredPositions: List<Float>,
    min: Float,
    max: Float,
    preferredGap: Float,
): List<Float> {
    if (desiredPositions.isEmpty()) return emptyList()
    if (desiredPositions.size == 1) return listOf(desiredPositions.first().coerceIn(min, max))

    val gap = preferredGap.coerceAtMost((max - min) / (desiredPositions.size - 1))
    val forward = mutableListOf<Float>()
    desiredPositions.forEachIndexed { index, desired ->
        val minAllowed = if (index == 0) min else forward[index - 1] + gap
        forward += desired.coerceAtLeast(minAllowed).coerceAtMost(max)
    }
    for (index in forward.lastIndex - 1 downTo 0) {
        forward[index] = forward[index].coerceAtMost(forward[index + 1] - gap).coerceAtLeast(min)
    }
    return forward
}

@Composable
fun ShellSurfaceMap(
    lines: List<ShellMapLineVisual>,
    courseCount: Int,
    activeCell: Pair<String, Int>?,
    savedCells: Set<Pair<String, Int>> = emptySet(),
    overlayCells: Set<Pair<String, Int>> = emptySet(),
    markers: List<ShellCellMarker> = emptyList(),
    showMarkerLabels: Boolean = true,
    showMarkerCallouts: Boolean = false,
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
                                                    hasOverlay -> LaiqColors.AccentOrange.copy(alpha = 0.18f)
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
                                                        val markerSize = if (marker.active) 10.dp else 8.dp
                                                        val markerOffsetX = (cellWidth - 20.dp) * marker.xRatio.coerceIn(0.05f, 0.95f)
                                                        val markerOffsetY = (cellHeight - 20.dp) * marker.yRatio.coerceIn(0.05f, 0.95f)
                                                        val calloutToRight = marker.xRatio < 0.58f
                                                        val calloutLineWidth = 12.dp
                                                        Box(
                                                            modifier = Modifier
                                                                .align(Alignment.TopStart)
                                                                .offset(
                                                                    x = markerOffsetX,
                                                                    y = markerOffsetY,
                                                                ),
                                                        ) {
                                                            Box(
                                                                modifier = Modifier
                                                                    .size(markerSize)
                                                                    .background(
                                                                        if (marker.active) LaiqColors.BrandRed else LaiqColors.AccentOrange,
                                                                        CircleShape,
                                                                    ),
                                                            )
                                                            if (showMarkerCallouts) {
                                                                Box(
                                                                    modifier = Modifier
                                                                        .offset(
                                                                            x = if (calloutToRight) markerSize else -calloutLineWidth,
                                                                            y = (markerSize - 2.dp) / 2,
                                                                        )
                                                                        .width(calloutLineWidth)
                                                                        .height(2.dp)
                                                                        .background(
                                                                            if (marker.active) LaiqColors.BrandRed else LaiqColors.AccentOrange,
                                                                            RoundedCornerShape(2.dp),
                                                                        ),
                                                                )
                                                                Surface(
                                                                    modifier = Modifier.offset(
                                                                        x = if (calloutToRight) markerSize + calloutLineWidth + 2.dp else -(58.dp),
                                                                        y = (-6).dp,
                                                                    ),
                                                                    color = Color.White,
                                                                    shape = RoundedCornerShape(10.dp),
                                                                    border = BorderStroke(
                                                                        1.dp,
                                                                        if (marker.active) LaiqColors.BrandRed else LaiqColors.PanelBorder,
                                                                    ),
                                                                ) {
                                                                    Text(
                                                                        marker.label,
                                                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                                                        style = MaterialTheme.typography.labelSmall,
                                                                        color = LaiqColors.BodyText,
                                                                    )
                                                                }
                                                            } else if (showMarkerLabels) {
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

private fun fittedPlateLabelFontSize(label: String, availableWidth: Dp = 28.dp) =
    when {
        availableWidth < 12.dp -> 5.sp
        availableWidth < 16.dp -> 6.sp
        availableWidth < 20.dp -> 7.sp
        label.length >= 5 -> 6.sp
        label.length == 4 -> 7.sp
        label.length == 3 -> 8.sp
        else -> 10.sp
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
    emphasizeUtHighlights: Boolean = false,
    overlayPlateIds: Set<String> = emptySet(),
    centerFeatureCount: Int = 0,
    centerFeatureCountControlsLayout: Boolean = false,
    useLeaderPlateLabels: Boolean = false,
    showAnnularSectionLabels: Boolean = true,
    autoHideCrowdedPlateLabels: Boolean = false,
    enablePlateTapSelection: Boolean = false,
    hasAnnularRing: Boolean = false,
    annularSectionCount: Int = 0,
    hasPontoonDeck: Boolean = false,
    markers: List<RoofMapMarker> = emptyList(),
    showMarkerLabels: Boolean = true,
    showMarkerCallouts: Boolean = false,
    showInteractionHint: Boolean = true,
    mapTitle: String = "Roof Layout Map",
    referenceLabel: String? = null,
    referenceAzimuthDeg: Double = 0.0,
    annularReferenceAzimuthDeg: Double = referenceAzimuthDeg,
    rotationDirection: RotationDirection = RotationDirection.CLOCKWISE,
    customPlateCells: List<RoofPlateCell>? = null,
    maxMapSize: Dp = 320.dp,
    onSelectPosition: ((Double, Double) -> Unit)? = null,
    onSelectPlate: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val plateCells = customPlateCells ?: buildRoofPlateCells(
            template = template,
            rowCount = rowCount,
            widestRowPlateCount = widestRowPlateCount,
            ringCount = ringCount,
            sectorCount = sectorCount,
            centerFeatureCount = if (centerFeatureCountControlsLayout) centerFeatureCount else 0,
            referenceAzimuthDeg = referenceAzimuthDeg,
            rotationDirection = rotationDirection,
        )
    val annularCells = if (hasAnnularRing && annularSectionCount > 0) {
        buildAnnularRingSectionCells(
            referenceAzimuthDeg = annularReferenceAzimuthDeg,
            rotationDirection = rotationDirection,
            annularSectionCount = annularSectionCount,
        )
    } else {
        emptyList()
    }
    val linkTargets = if (customPlateCells != null) {
        plateCells + annularCells
    } else {
        buildRoofLinkTargetsForConfig(
            template = template,
            rowCount = rowCount,
            widestRowPlateCount = widestRowPlateCount,
            ringCount = ringCount,
            sectorCount = sectorCount,
            centerFeatureCount = if (centerFeatureCountControlsLayout) centerFeatureCount else 0,
            referenceAzimuthDeg = referenceAzimuthDeg,
            rotationDirection = rotationDirection,
            hasAnnularRing = false,
            annularSectionCount = 0,
        ) + annularCells
    }
    val isCircularTemplate = template == RoofTemplate.CIRCULAR_PLATE || template == RoofTemplate.CIRCULAR_CENTER_OPENING
    val showCenterOpening = template == RoofTemplate.CIRCULAR_CENTER_OPENING || centerFeatureCount > 0
    val displayPlateCells = if (centerFeatureCountControlsLayout && showCenterOpening && template == RoofTemplate.CONE_RADIAL) {
        plateCells.filterNot { cell -> cell.rowNumber >= 2 }
    } else {
        plateCells
    }
    val annularLinkTargets = linkTargets.filter { target -> target.plateId.startsWith("AR") }
    val completedUtColor = Color(0xFF167A4A)
    val leaderPlateLabels = if (useLeaderPlateLabels && !isCircularTemplate) {
        buildRoofLeaderLabels(displayPlateCells)
    } else {
        emptyList()
    }
    val markerPoints = markers.mapNotNull { marker ->
        val point = when {
            marker.azimuthDeg != null && marker.radiusRatio != null -> {
                val resolvedPlateId = if (customPlateCells != null) {
                    val (xNorm, yNorm) = roofPolarToCanvasPoint(marker.azimuthDeg, marker.radiusRatio)
                    customRoofPlateIdAtPoint(linkTargets, xNorm, yNorm)
                } else {
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
                        azimuthDeg = marker.azimuthDeg,
                        radiusRatio = marker.radiusRatio,
                    )
                }
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
        val adjustedPoint = if (marker.active && !showMarkerLabels) {
            val deltaX = point.first - 0.5f
            val deltaY = point.second - 0.5f
            val distance = sqrt((deltaX * deltaX + deltaY * deltaY).toDouble()).toFloat()
            val shift = 0.045f
            if (distance > 0.001f) {
                (
                    (point.first + (deltaX / distance) * shift).coerceIn(0.04f, 0.96f) to
                        (point.second + (deltaY / distance) * shift).coerceIn(0.04f, 0.96f)
                    )
            } else {
                point.first to (point.second - shift).coerceIn(0.04f, 0.96f)
            }
        } else {
            point
        }
        marker to adjustedPoint
    }

    BoxWithConstraints(modifier = modifier.fillMaxWidth()) {
        val mapSize = if (maxWidth < maxMapSize) maxWidth else maxMapSize
        val umbrellaLabelWidth = 34.dp
        val umbrellaLabelHeight = 20.dp
        val circularLabelWidth = 28.dp
        val circularLabelHeight = 20.dp
        val roofMarkerCallouts = if (showMarkerCallouts) {
            buildRoofMarkerCallouts(markerPoints)
        } else {
            emptyList()
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(mapTitle, style = MaterialTheme.typography.titleSmall, color = LaiqColors.BodyText)
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
                    val strokeColor = LaiqColors.AccentOrange.copy(alpha = 0.44f)
                    val boundaryColor = LaiqColors.AccentOrange.copy(alpha = 0.82f)
                    val referenceColor = LaiqColors.BrandTeal.copy(alpha = 0.86f)
                    val radius = size.minDimension * 0.42f
                    val annularOuterRadius = if (hasAnnularRing) size.minDimension * 0.48f else radius
                    val center = Offset(size.width / 2f, size.height / 2f)
                    val referenceAngle = azimuthToCanvasRadians(referenceAzimuthDeg)
                    drawCircle(color = LaiqColors.BrandTeal.copy(alpha = 0.07f), radius = radius, center = center)
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
                                val angle = azimuthToCanvasRadians(annularReferenceAzimuthDeg + sectionStep * sectionIndex)
                                val cosValue = cos(angle).toFloat()
                                val sinValue = sin(angle).toFloat()
                                drawLine(
                                    color = boundaryColor,
                                    start = Offset(
                                        x = center.x + (cosValue * ringInnerRadius),
                                        y = center.y + (sinValue * ringInnerRadius),
                                    ),
                                    end = Offset(
                                        x = center.x + (cosValue * ringOuterRadius),
                                        y = center.y + (sinValue * ringOuterRadius),
                                    ),
                                    strokeWidth = 2.2f,
                                )
                            }
                        }
                        drawCircle(
                            color = boundaryColor,
                            radius = ringOuterRadius,
                            center = center,
                            style = Stroke(width = 2.4f),
                        )
                    }
                    drawCircle(color = boundaryColor, radius = radius, center = center, style = Stroke(width = 3.1f))
                    drawLine(
                        color = referenceColor,
                        start = center,
                        end = Offset(
                            x = center.x + (cos(referenceAngle) * annularOuterRadius).toFloat(),
                            y = center.y + (sin(referenceAngle) * annularOuterRadius).toFloat(),
                        ),
                        strokeWidth = 3.2f,
                    )

                    if (!isCircularTemplate) {
                        when (template) {
                            RoofTemplate.CIRCULAR_PLATE,
                            RoofTemplate.CIRCULAR_CENTER_OPENING -> Unit
                            RoofTemplate.CONE_RADIAL -> {
                                val sectors = sectorCount.coerceAtLeast(1)
                                val centerPlates = if (centerFeatureCount > 0) {
                                    centerFeatureCount.coerceIn(1, 3)
                                } else {
                                    ringCount.coerceIn(1, 3)
                                }
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
                                    style = Stroke(width = 2.2f),
                                )
                                if (centerPlates == 3) {
                                    drawCircle(
                                        color = strokeColor,
                                        radius = centerPlateRadius,
                                        center = center,
                                        style = Stroke(width = 2.2f),
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
                                        strokeWidth = 2.1f,
                                    )
                                }
                                if (emphasizeUtHighlights) {
                                    savedPlateIds.forEach { plateId ->
                                        drawConeRadialPlateHighlight(
                                            plateId = plateId,
                                            sectors = sectors,
                                            centerPlates = centerPlates,
                                            sectorStep = sectorStep,
                                            directionFactor = directionFactor,
                                            referenceAzimuthDeg = referenceAzimuthDeg,
                                            center = center,
                                            centerPlateRadius = centerPlateRadius,
                                            transitionOuterRadius = transitionOuterRadius,
                                            outerRadius = radius,
                                            fillColor = completedUtColor.copy(alpha = 0.28f),
                                            borderColor = completedUtColor,
                                            strokeWidth = 4.5f,
                                        )
                                    }
                                    activePlateId?.let { plateId ->
                                        drawConeRadialPlateHighlight(
                                            plateId = plateId,
                                            sectors = sectors,
                                            centerPlates = centerPlates,
                                            sectorStep = sectorStep,
                                            directionFactor = directionFactor,
                                            referenceAzimuthDeg = referenceAzimuthDeg,
                                            center = center,
                                            centerPlateRadius = centerPlateRadius,
                                            transitionOuterRadius = transitionOuterRadius,
                                            outerRadius = radius,
                                            fillColor = LaiqColors.BrandRed.copy(alpha = 0.24f),
                                            borderColor = LaiqColors.BrandRed,
                                            strokeWidth = 5.5f,
                                        )
                                    }
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
                                    style = Stroke(width = 2.1f),
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
                                    strokeWidth = 2.1f,
                                )
                            }
                            if (emphasizeUtHighlights) {
                                displayPlateCells
                                    .filter { cell -> cell.plateId in savedPlateIds || cell.plateId == activePlateId }
                                    .sortedBy { cell -> if (cell.plateId == activePlateId) 1 else 0 }
                                    .forEach { cell ->
                                        val isActive = cell.plateId == activePlateId
                                        val centerAngleDeg = Math.toDegrees(
                                            atan2(
                                                (cell.yNorm - 0.5f).toDouble(),
                                                (cell.xNorm - 0.5f).toDouble(),
                                            ),
                                        ).toFloat()
                                        val innerRadius = radius * (cell.rowNumber - 1) / rings.toFloat()
                                        val outerRadius = radius * cell.rowNumber / rings.toFloat()
                                        drawRoofRingSectorHighlight(
                                            center = center,
                                            innerRadius = innerRadius,
                                            outerRadius = outerRadius,
                                            centerAngleDeg = centerAngleDeg,
                                            sweepDeg = sectorStep.toFloat(),
                                            fillColor = if (isActive) {
                                                LaiqColors.BrandRed.copy(alpha = 0.24f)
                                            } else {
                                                completedUtColor.copy(alpha = 0.28f)
                                            },
                                            borderColor = if (isActive) LaiqColors.BrandRed else completedUtColor,
                                            borderWidth = if (isActive) 5.5f else 4.5f,
                                        )
                                    }
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
                    val sectionCount = annularSectionCount.coerceAtLeast(0)
                    if (hasAnnularRing && sectionCount > 0) {
                        if (emphasizeUtHighlights) {
                            annularLinkTargets
                                .filter { cell -> cell.plateId in savedPlateIds || cell.plateId == activePlateId }
                                .sortedBy { cell -> if (cell.plateId == activePlateId) 1 else 0 }
                                .forEach { section ->
                                    val isActive = section.plateId == activePlateId
                                    val centerAngleDeg = Math.toDegrees(
                                        atan2(
                                            (section.yNorm - 0.5f).toDouble(),
                                            (section.xNorm - 0.5f).toDouble(),
                                        ),
                                    ).toFloat()
                                    drawRoofRingSectorHighlight(
                                        center = center,
                                        innerRadius = radius,
                                        outerRadius = annularOuterRadius,
                                        centerAngleDeg = centerAngleDeg,
                                        sweepDeg = (360f / sectionCount.toFloat()),
                                        fillColor = if (isActive) {
                                            LaiqColors.BrandRed.copy(alpha = 0.24f)
                                        } else {
                                            completedUtColor.copy(alpha = 0.28f)
                                        },
                                        borderColor = if (isActive) LaiqColors.BrandRed else completedUtColor,
                                        borderWidth = if (isActive) 5.5f else 4.5f,
                                    )
                                }
                        } else {
                            annularLinkTargets.firstOrNull { cell -> cell.plateId == activePlateId }?.let { activeSection ->
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
                if (hasAnnularRing && !useLeaderPlateLabels && !showAnnularSectionLabels) {
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
                                    .padding(0.5.dp),
	                            color = when {
	                                    emphasizeUtHighlights && isActive -> LaiqColors.BrandRed.copy(alpha = 0.22f)
	                                    emphasizeUtHighlights && isSaved -> completedUtColor.copy(alpha = 0.34f)
	                                    hasOverlay -> LaiqColors.AccentOrange.copy(alpha = 0.18f)
	                                    isSaved -> LaiqColors.BrandTeal.copy(alpha = 0.12f)
	                                    else -> Color.White
	                                },
                                shape = RoundedCornerShape(4.dp),
                                border = BorderStroke(
	                                    when {
	                                        emphasizeUtHighlights && isActive -> 3.dp
	                                        emphasizeUtHighlights && isSaved -> 2.dp
	                                        isActive -> 2.dp
	                                        else -> 1.dp
	                                    },
	                                    when {
	                                        isActive -> LaiqColors.BrandRed
	                                        hasOverlay -> LaiqColors.AccentOrange
	                                        emphasizeUtHighlights && isSaved -> completedUtColor
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
                        if (enablePlateTapSelection) {
                            displayPlateCells.forEach { cell ->
                                val cellWidth = mapSize * (cell.rightNorm - cell.leftNorm)
                                val cellHeight = mapSize * (cell.bottomNorm - cell.topNorm)
                                val needsTapAssist = cellWidth < 36.dp || cellHeight < 28.dp
                                if (needsTapAssist) {
                                    val tapSize = 34.dp
                                    Box(
                                        modifier = Modifier
                                            .offset(
                                                x = mapSize * cell.xNorm - tapSize / 2,
                                                y = mapSize * cell.yNorm - tapSize / 2,
                                            )
                                            .size(tapSize)
                                            .clickable { onSelectPlate(cell.plateId) },
                                    )
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
                        val cellLabelWidth = mapSize * (cell.rightNorm - cell.leftNorm)
                        val cellLabelHeight = mapSize * (cell.bottomNorm - cell.topNorm)
                        val minimumLabelWidth = if (cell.mapLabel.length > 2) 14.dp else 10.dp
                        val labelFits = cellLabelWidth >= minimumLabelWidth && cellLabelHeight >= 8.dp
                        val shouldShowLabel = !autoHideCrowdedPlateLabels ||
                            labelFits ||
                            cell.plateId == activePlateId
                        if (!shouldShowLabel) return@forEach
                        val labelBoxWidth = cellLabelWidth
                            .coerceAtLeast(minimumLabelWidth)
                            .coerceAtMost(circularLabelWidth)
                        val labelBoxHeight = cellLabelHeight
                            .coerceAtLeast(8.dp)
                            .coerceAtMost(circularLabelHeight)
                        Box(
                            modifier = Modifier
                                .width(labelBoxWidth)
                                .height(labelBoxHeight)
                                .offset(
                                    x = mapSize * cell.labelXNorm - labelBoxWidth / 2,
                                    y = mapSize * cell.labelYNorm - labelBoxHeight / 2,
                                )
                                .then(
                                    if (enablePlateTapSelection) {
                                        Modifier.clickable { onSelectPlate(cell.plateId) }
                                    } else {
                                        Modifier
                                    },
                                ),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = cell.mapLabel,
                                modifier = Modifier.fillMaxWidth(),
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontSize = fittedPlateLabelFontSize(cell.mapLabel, labelBoxWidth),
                                ),
                                color = LaiqColors.BodyText,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                softWrap = false,
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                } else if (useLeaderPlateLabels && !autoHideCrowdedPlateLabels) {
                    Canvas(
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(1f),
                    ) {
                        leaderPlateLabels.forEach { label ->
                            drawLine(
                                color = LaiqColors.BrandTeal.copy(alpha = 0.24f),
                                start = Offset(size.width * label.sourceXNorm, size.height * label.sourceYNorm),
                                end = Offset(size.width * label.xNorm, size.height * label.yNorm),
                                strokeWidth = 1.1.dp.toPx(),
                            )
                        }
                    }
                    leaderPlateLabels.forEach { label ->
                        val labelWidth = if (label.text.length > 2) 42.dp else 34.dp
                        Surface(
                            onClick = { onSelectPlate(label.text) },
                            modifier = Modifier
                                .width(labelWidth)
                                .height(20.dp)
                                .offset(
                                    x = mapSize * label.xNorm - labelWidth / 2,
                                    y = mapSize * label.yNorm - 10.dp,
                                ),
                            color = Color.White.copy(alpha = 0.96f),
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(1.dp, LaiqColors.PanelBorder),
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(
                                    text = label.text,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = LaiqColors.BodyText,
                                )
                            }
                        }
                    }
                } else {
                    displayPlateCells.forEach { cell ->
                        val shouldShowLabel = !autoHideCrowdedPlateLabels || cell.plateId == activePlateId
                        if (!shouldShowLabel) return@forEach
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
	                                emphasizeUtHighlights && cell.plateId == activePlateId -> LaiqColors.BrandRed.copy(alpha = 0.16f)
	                                emphasizeUtHighlights && isSaved -> completedUtColor.copy(alpha = 0.16f)
	                                hasOverlay -> LaiqColors.AccentOrange.copy(alpha = 0.18f)
	                                isSaved -> LaiqColors.BrandTeal.copy(alpha = 0.12f)
	                                else -> Color.White
	                            },
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(
	                                if (emphasizeUtHighlights && (cell.plateId == activePlateId || isSaved)) 2.dp else 1.dp,
	                                when {
	                                    cell.plateId == activePlateId -> LaiqColors.BrandRed
	                                    hasOverlay -> LaiqColors.AccentOrange
	                                    emphasizeUtHighlights && isSaved -> completedUtColor
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
                                    modifier = Modifier
                                        .align(Alignment.Center)
                                        .fillMaxWidth(),
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontSize = fittedPlateLabelFontSize(cell.mapLabel),
                                    ),
	                                    color = when {
	                                        cell.plateId == activePlateId -> LaiqColors.BrandRed
	                                        emphasizeUtHighlights && isSaved -> completedUtColor
	                                        else -> LaiqColors.BodyText
	                                    },
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    softWrap = false,
                                    textAlign = TextAlign.Center,
	                                )
                            }
                        }
                    }
                }
                if (showAnnularSectionLabels) annularLinkTargets.forEach { cell ->
                    val annularArcLength = if (annularSectionCount > 0) {
                        mapSize * (0.48f * (2f * PI.toFloat() / annularSectionCount.toFloat()))
                    } else {
                        mapSize
                    }
                    val annularLabelFits = annularArcLength >= 44.dp
                    if (autoHideCrowdedPlateLabels && !annularLabelFits && cell.plateId != activePlateId) {
                        return@forEach
                    }
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
	                            emphasizeUtHighlights && cell.plateId == activePlateId -> LaiqColors.BrandRed.copy(alpha = 0.18f)
	                            emphasizeUtHighlights && isSaved -> completedUtColor.copy(alpha = 0.20f)
	                            hasOverlay -> LaiqColors.AccentOrange.copy(alpha = 0.18f)
	                            isSaved -> LaiqColors.BrandTeal.copy(alpha = 0.12f)
	                            else -> Color.White
	                        },
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(
	                            if (emphasizeUtHighlights && (cell.plateId == activePlateId || isSaved)) 2.dp else 1.dp,
	                            when {
	                                cell.plateId == activePlateId -> LaiqColors.BrandRed
	                                hasOverlay -> LaiqColors.AccentOrange
	                                emphasizeUtHighlights && isSaved -> completedUtColor
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
                                modifier = Modifier
                                    .align(Alignment.Center)
                                    .fillMaxWidth(),
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontSize = fittedPlateLabelFontSize(cell.mapLabel),
                                ),
	                            color = when {
	                                cell.plateId == activePlateId -> LaiqColors.BrandRed
	                                emphasizeUtHighlights && isSaved -> completedUtColor
	                                else -> LaiqColors.AccentOrange
	                            },
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                softWrap = false,
                                textAlign = TextAlign.Center,
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
                    ) {
                        if (centerFeatureCountControlsLayout) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(
                                    text = if (centerFeatureCount > 1) "CO x$centerFeatureCount" else "CO",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = LaiqColors.AccentOrange,
                                    textAlign = TextAlign.Center,
                                )
                            }
                        }
                    }
                }
                markerPoints.forEach { (marker, point) ->
                    val markerSize = if (marker.active && !showMarkerLabels) 18.dp else if (marker.active) 14.dp else 10.dp
                    Box(
                        modifier = Modifier
                            .size(markerSize)
                            .offset(
                                x = mapSize * point.first - markerSize / 2,
                                y = mapSize * point.second - markerSize / 2,
                            )
                            .then(
                                if (marker.active && !showMarkerLabels) {
                                    Modifier.border(3.dp, LaiqColors.BrandRed, CircleShape)
                                } else {
                                    Modifier.background(
                                        color = if (marker.active) LaiqColors.BrandRed else LaiqColors.AccentOrange,
                                        shape = CircleShape,
                                    )
                                },
                            ),
                    )
                    if (showMarkerLabels) {
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
                }
                if (roofMarkerCallouts.isNotEmpty()) {
                    Canvas(modifier = Modifier.fillMaxSize()) {
                        roofMarkerCallouts.forEach { callout ->
                            val start = Offset(
                                x = size.width * callout.startXNorm,
                                y = size.height * callout.startYNorm,
                            )
                            val bend = Offset(
                                x = size.width * callout.bendXNorm,
                                y = size.height * callout.bendYNorm,
                            )
                            val end = Offset(
                                x = size.width * callout.endXNorm,
                                y = size.height * callout.endYNorm,
                            )
                            drawLine(
                                color = if (callout.marker.active) LaiqColors.BrandRed else LaiqColors.AccentOrange,
                                start = start,
                                end = bend,
                                strokeWidth = 2f,
                            )
                            drawLine(
                                color = if (callout.marker.active) LaiqColors.BrandRed else LaiqColors.AccentOrange,
                                start = bend,
                                end = end,
                                strokeWidth = 2f,
                            )
                        }
                    }
                    roofMarkerCallouts.forEach { callout ->
                        val labelWidth = 72.dp
                        val labelHeight = 24.dp
                        Surface(
                            modifier = Modifier
                                .width(labelWidth)
                                .height(labelHeight)
                                .offset(
                                    x = if (callout.alignRight) {
                                        mapSize * callout.labelXNorm - labelWidth
                                    } else {
                                        mapSize * callout.labelXNorm
                                    },
                                    y = mapSize * callout.labelYNorm - (labelHeight / 2),
                                ),
                            color = Color.White,
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(
                                1.dp,
                                if (callout.marker.active) LaiqColors.BrandRed else LaiqColors.PanelBorder,
                            ),
                        ) {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    text = callout.marker.label,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = LaiqColors.BodyText,
                                )
                            }
                        }
                    }
                }
                if (onSelectPosition != null || enablePlateTapSelection) {
                    Box(
                        modifier = Modifier
                            .matchParentSize()
                            .pointerInput(
                                onSelectPosition,
                                enablePlateTapSelection,
                                onSelectPlate,
                                linkTargets,
                                template,
                                rowCount,
                                widestRowPlateCount,
                                ringCount,
                                sectorCount,
                                referenceAzimuthDeg,
                                rotationDirection,
                                hasAnnularRing,
                                annularSectionCount,
                            ) {
                                detectTapGestures(
                                    onTap = { offset ->
                                        val normalizedX = (offset.x / size.width.toFloat()).coerceIn(0f, 1f)
                                        val normalizedY = (offset.y / size.height.toFloat()).coerceIn(0f, 1f)
                                        val visibleRadius = if (hasAnnularRing) 0.48f else 0.42f
                                        val deltaXNorm = normalizedX - 0.5f
                                        val deltaYNorm = normalizedY - 0.5f
                                        val isInsideVisibleMap = sqrt(
                                            deltaXNorm * deltaXNorm + deltaYNorm * deltaYNorm,
                                        ) <= visibleRadius
                                        if (!isInsideVisibleMap) return@detectTapGestures
                                        val (azimuthDeg, radiusRatio) = canvasPointToRoofPolar(
                                            normalizedX,
                                            normalizedY,
                                        )
                                        val selectedPlate = if (customPlateCells != null) {
                                            customRoofPlateIdAtPoint(
                                                linkTargets = linkTargets,
                                                xNorm = normalizedX,
                                                yNorm = normalizedY,
                                            )
                                        } else {
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
                                            )
                                        }
                                        selectedPlate?.let(onSelectPlate)
                                        onSelectPosition?.let { publishRoofMapPosition(offset, size, hasAnnularRing, it) }
                                    },
                                )
                            },
                    )
                }
            }
            if (showInteractionHint) {
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
}

private data class RoofMarkerCallout(
    val marker: RoofMapMarker,
    val startXNorm: Float,
    val startYNorm: Float,
    val bendXNorm: Float,
    val bendYNorm: Float,
    val endXNorm: Float,
    val endYNorm: Float,
    val labelXNorm: Float,
    val labelYNorm: Float,
    val alignRight: Boolean,
)

private fun customRoofPlateIdAtPoint(
    linkTargets: List<RoofPlateCell>,
    xNorm: Float,
    yNorm: Float,
): String? {
    val hitTolerance = 0.008f
    linkTargets
        .filter { cell ->
            xNorm in (cell.leftNorm - hitTolerance)..(cell.rightNorm + hitTolerance) &&
                yNorm in (cell.topNorm - hitTolerance)..(cell.bottomNorm + hitTolerance)
        }
        .minWithOrNull(
            compareBy<RoofPlateCell> { cell ->
                (cell.rightNorm - cell.leftNorm) * (cell.bottomNorm - cell.topNorm)
            }.thenBy { cell ->
                val dx = cell.xNorm - xNorm
                val dy = cell.yNorm - yNorm
                dx * dx + dy * dy
            },
        )
        ?.let { return it.plateId }

    return linkTargets.minByOrNull { cell ->
        val dx = cell.xNorm - xNorm
        val dy = cell.yNorm - yNorm
        sqrt(dx * dx + dy * dy)
    }?.plateId
}

private fun buildRoofMarkerCallouts(
    markerPoints: List<Pair<RoofMapMarker, Pair<Float, Float>>>,
): List<RoofMarkerCallout> {
    if (markerPoints.isEmpty()) return emptyList()
    val leftMarkers = markerPoints
        .filter { (_, point) -> point.first < 0.5f }
        .sortedBy { (_, point) -> point.second }
    val rightMarkers = markerPoints
        .filter { (_, point) -> point.first >= 0.5f }
        .sortedBy { (_, point) -> point.second }

    fun spread(points: List<Pair<RoofMapMarker, Pair<Float, Float>>>): List<RoofMarkerCallout> {
        if (points.isEmpty()) return emptyList()
        val alignRight = points.first().second.first < 0.5f
        val labelPositions = mutableListOf<Float>()
        points.forEachIndexed { index, (_, point) ->
            val preferred = point.second.coerceIn(0.16f, 0.84f)
            val previous = labelPositions.getOrNull(index - 1)
            val adjusted = if (previous != null && preferred - previous < 0.08f) {
                (previous + 0.08f).coerceAtMost(0.84f)
            } else {
                preferred
            }
            labelPositions += adjusted
        }
        return points.mapIndexed { index, (marker, point) ->
            val labelY = labelPositions[index]
            val onLeftSide = point.first < 0.5f
            val bendX = if (onLeftSide) 0.18f else 0.82f
            val labelX = if (onLeftSide) 0.12f else 0.88f
            RoofMarkerCallout(
                marker = marker,
                startXNorm = point.first,
                startYNorm = point.second,
                bendXNorm = bendX,
                bendYNorm = labelY,
                endXNorm = if (onLeftSide) labelX + 0.02f else labelX - 0.02f,
                endYNorm = labelY,
                labelXNorm = labelX,
                labelYNorm = labelY,
                alignRight = onLeftSide,
            )
        }
    }

    return spread(leftMarkers) + spread(rightMarkers)
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
    if (distance > roofRadius) return
    val (azimuth, radiusRatio) = canvasPointToRoofPolar(
        xNorm = (rawPosition.x / containerSize.width).coerceIn(0f, 1f),
        yNorm = (rawPosition.y / containerSize.height).coerceIn(0f, 1f),
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

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawConeRadialPlateHighlight(
    plateId: String,
    sectors: Int,
    centerPlates: Int,
    sectorStep: Double,
    directionFactor: Double,
    referenceAzimuthDeg: Double,
    center: Offset,
    centerPlateRadius: Float,
    transitionOuterRadius: Float,
    outerRadius: Float,
    fillColor: Color,
    borderColor: Color,
    strokeWidth: Float,
) {
    when (val plateNumber = plateId.toIntOrNull()) {
        null -> Unit
        in 1..sectors -> {
            val centerAzimuth = normalizeDegreesForMap(
                referenceAzimuthDeg + directionFactor * sectorStep * (plateNumber - 0.5),
            )
            drawRoofRingSectorHighlight(
                center = center,
                innerRadius = transitionOuterRadius,
                outerRadius = outerRadius,
                centerAngleDeg = Math.toDegrees(azimuthToCanvasRadians(centerAzimuth)).toFloat(),
                sweepDeg = sectorStep.toFloat(),
                fillColor = fillColor,
                borderColor = borderColor,
                borderWidth = strokeWidth,
            )
        }
        sectors + 1 -> if (centerPlates == 1) {
            drawCircle(color = fillColor, radius = transitionOuterRadius, center = center)
            drawCircle(
                color = borderColor,
                radius = transitionOuterRadius,
                center = center,
                style = Stroke(width = strokeWidth),
            )
        } else {
            drawRoofRingSectorHighlight(
                center = center,
                innerRadius = if (centerPlates == 3) centerPlateRadius else 0f,
                outerRadius = transitionOuterRadius,
                centerAngleDeg = -90f,
                sweepDeg = 180f,
                fillColor = fillColor,
                borderColor = borderColor,
                borderWidth = strokeWidth,
            )
        }
        sectors + 2 -> if (centerPlates == 2 || centerPlates == 3) {
            drawRoofRingSectorHighlight(
                center = center,
                innerRadius = if (centerPlates == 3) centerPlateRadius else 0f,
                outerRadius = transitionOuterRadius,
                centerAngleDeg = 90f,
                sweepDeg = 180f,
                fillColor = fillColor,
                borderColor = borderColor,
                borderWidth = strokeWidth,
            )
        }
        sectors + 3 -> if (centerPlates == 3) {
            drawCircle(color = fillColor, radius = centerPlateRadius, center = center)
            drawCircle(
                color = borderColor,
                radius = centerPlateRadius,
                center = center,
                style = Stroke(width = strokeWidth),
            )
        }
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawRoofRingSectorHighlight(
    center: Offset,
    innerRadius: Float,
    outerRadius: Float,
    centerAngleDeg: Float,
    sweepDeg: Float,
    fillColor: Color,
    borderColor: Color,
    borderWidth: Float = 4f,
) {
    val startAngleDeg = centerAngleDeg - (sweepDeg / 2f)
    val middleRadius = ((innerRadius + outerRadius) / 2f).coerceAtLeast(outerRadius / 2f)
    val fillThickness = (outerRadius - innerRadius).coerceAtLeast(borderWidth)
    val middleRect = Rect(
        left = center.x - middleRadius,
        top = center.y - middleRadius,
        right = center.x + middleRadius,
        bottom = center.y + middleRadius,
    )
    drawArc(
        color = fillColor,
        startAngle = startAngleDeg,
        sweepAngle = sweepDeg,
        useCenter = false,
        topLeft = middleRect.topLeft,
        size = middleRect.size,
        style = Stroke(width = fillThickness),
    )
    drawRoofRingSectorOutline(
        center = center,
        innerRadius = innerRadius,
        outerRadius = outerRadius,
        centerAngleDeg = centerAngleDeg,
        sweepDeg = sweepDeg,
        color = borderColor,
        strokeWidth = borderWidth,
    )
}

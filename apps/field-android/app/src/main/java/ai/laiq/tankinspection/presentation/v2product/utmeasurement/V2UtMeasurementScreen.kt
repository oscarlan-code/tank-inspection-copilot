package ai.laiq.tankinspection.presentation.v2product.utmeasurement

import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqDropdownField
import ai.laiq.tankinspection.presentation.components.LaiqOptionChips
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.components.RoofSurfaceMap
import ai.laiq.tankinspection.v2product.model.V2ElementType
import ai.laiq.tankinspection.v2product.model.V2FloorTemplate
import ai.laiq.tankinspection.v2product.model.V2GeneralTankInfo
import ai.laiq.tankinspection.v2product.model.V2LayoutMapSetup
import ai.laiq.tankinspection.v2product.model.V2LayoutSurface
import ai.laiq.tankinspection.v2product.model.V2LayoutTarget
import ai.laiq.tankinspection.v2product.model.V2PlacedElement
import ai.laiq.tankinspection.v2product.model.V2ShellOffsetStartRow
import ai.laiq.tankinspection.v2product.model.V2ShellThirdOffsetStart
import ai.laiq.tankinspection.v2product.model.V2UtItemKind
import ai.laiq.tankinspection.v2product.model.V2UtMeasurementEntry
import ai.laiq.tankinspection.v2product.model.V2UtMeasurementState
import ai.laiq.tankinspection.v2product.model.withClearedActiveItem
import ai.laiq.tankinspection.v2product.model.withSelectedEntry
import ai.laiq.tankinspection.v2product.model.withSelectedTarget
import ai.laiq.tankinspection.v2product.model.withTargetApproval
import ai.laiq.tankinspection.v2product.model.withUpdatedEntry
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

private val nozzleSizeOptions = listOf(
    "2 in" to "2 in",
    "3 in" to "3 in",
    "4 in" to "4 in",
    "6 in" to "6 in",
    "8 in" to "8 in",
    "10 in" to "10 in",
    "12 in" to "12 in",
    "N.A." to "N.A.",
)

@Composable
fun V2UtMeasurementScreen(
    generalTankInfo: V2GeneralTankInfo,
    layoutMapSetup: V2LayoutMapSetup,
    visibleTargets: List<V2LayoutTarget>,
    placementsByTarget: Map<V2LayoutTarget, List<V2PlacedElement>>,
    state: V2UtMeasurementState,
    onStateChange: (V2UtMeasurementState) -> Unit,
    onBack: () -> Unit,
    onOpenFinding: (V2UtMeasurementEntry) -> Unit,
    onContinue: (V2UtMeasurementState) -> Unit,
    contentPadding: PaddingValues = PaddingValues(0.dp),
) {
    val latestState by rememberUpdatedState(state)
    val selectedTarget = when {
        visibleTargets.isEmpty() -> V2LayoutTarget.EXTERNAL_ROOF
        state.selectedTarget in visibleTargets -> state.selectedTarget
        else -> visibleTargets.first()
    }
    val selectedEntries = state.entriesByItemKey.values.filter { entry -> entry.target == selectedTarget }
    val selectedTargetApproved = selectedTarget in state.approvedTargets
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .imePadding()
            .padding(
                start = 16.dp,
                end = 16.dp,
                top = contentPadding.calculateTopPadding() + 12.dp,
                bottom = 28.dp,
            ),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            "UT Measurements",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.SemiBold,
            color = LaiqColors.BrandTeal,
            modifier = Modifier.padding(horizontal = 4.dp),
        )

        if (visibleTargets.isEmpty()) {
            LaiqSectionCard(title = "No UT Maps") {
                Text(
                    text = "Choose at least one approved layout map on the UT Scope screen.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = LaiqColors.BrandRed,
                )
            }
        } else {
            LaiqSectionCard(title = "UT Scope") {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    LaiqStatChip(
                        label = "Tank",
                        value = generalTankInfo.tankNumber.ifBlank { "Tank" },
                        modifier = Modifier.weight(1f),
                    )
                    LaiqStatChip(
                        label = "Current",
                        value = selectedTarget.label,
                        modifier = Modifier.weight(1f),
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    LaiqStatChip(
                        label = "Measured",
                        value = selectedEntries.count { entry -> entry.confirmed && entry.hasMeasuredReadings() }.toString(),
                        modifier = Modifier.weight(1f),
                    )
                    LaiqStatChip(
                        label = "Elements",
                        value = placementsByTarget[selectedTarget].orEmpty().size.toString(),
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 4.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text(
                    text = "Layout Surface",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = LaiqColors.BrandTeal,
                )
                LaiqOptionChips(
                    selectedValue = selectedTarget.key,
                    options = visibleTargets.map { target -> target.key to target.label },
                    onSelect = { selected ->
                        onStateChange(
                            latestState.withSelectedTarget(visibleTargets.first { target -> target.key == selected }),
                        )
                    },
                )
            }

            UtMapWorkspace(
                selectedTarget = selectedTarget,
                layoutMapSetup = layoutMapSetup,
                placements = placementsByTarget[selectedTarget].orEmpty(),
                state = state,
                onSelectEntry = { entry ->
                    onStateChange(latestState.withSelectedEntry(entry))
                },
                onConfirm = { updated ->
                    onStateChange(latestState.withUpdatedEntry(updated))
                },
                onOpenFinding = onOpenFinding,
                onClose = {
                    onStateChange(latestState.withClearedActiveItem())
                },
            )

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                LaiqSecondaryButton(
                    text = "Back",
                    onClick = onBack,
                    modifier = Modifier.weight(1f),
                )
                LaiqPrimaryButton(
                    text = when {
                        !selectedTargetApproved -> "Approve UT"
                        visibleTargets.any { target -> target !in state.approvedTargets } -> "Next Layout"
                        else -> "Continue"
                    },
                    onClick = {
	                        val approvedState = if (selectedTargetApproved) {
	                            latestState
	                        } else {
	                            latestState.withTargetApproval(selectedTarget, approved = true)
	                        }
                        val nextUnapprovedTarget = visibleTargets.firstOrNull { target ->
                            target != selectedTarget && target !in approvedState.approvedTargets
                        }
                        if (nextUnapprovedTarget != null) {
                            onStateChange(approvedState.withSelectedTarget(nextUnapprovedTarget))
                        } else {
                            onContinue(approvedState)
                        }
	                    },
	                    modifier = Modifier.weight(1f),
	                )
        }
    }
}
}


@Composable
private fun UtMapWorkspace(
    selectedTarget: V2LayoutTarget,
    layoutMapSetup: V2LayoutMapSetup,
    placements: List<V2PlacedElement>,
    state: V2UtMeasurementState,
    onSelectEntry: (V2UtMeasurementEntry) -> Unit,
    onConfirm: (V2UtMeasurementEntry) -> Unit,
    onOpenFinding: (V2UtMeasurementEntry) -> Unit,
    onClose: () -> Unit,
) {
    val completedEntries = state.entriesByItemKey.values.filter { entry ->
        entry.target == selectedTarget && entry.confirmed && entry.hasMeasuredReadings()
    }
    val activeEntry = state.entriesByItemKey[state.activeItemKey]?.takeIf { entry -> entry.target == selectedTarget }
    LaiqSectionCard(
        title = "${selectedTarget.label} UT Map",
	        subtitle = "Tap only the random points you choose to survey. Leave readings blank if no UT is conducted.",
    ) {
        when (selectedTarget.surface) {
            V2LayoutSurface.ROOF -> RoofOrFloorUtMap(
                selectedTarget = selectedTarget,
                layoutMapSetup = layoutMapSetup,
                placements = placements,
                activeEntry = activeEntry,
                completedPlateIds = completedEntries
                    .filter { entry -> entry.kind == V2UtItemKind.LAYOUT_REGION }
                    .map { entry -> entry.itemLabel }
                    .toSet(),
                activePlateId = activeEntry?.takeIf { entry -> entry.kind == V2UtItemKind.LAYOUT_REGION }?.itemLabel,
                completedElementKeys = completedEntries
                    .filter { entry -> entry.kind == V2UtItemKind.ELEMENT }
                    .map { entry -> entry.itemKey }
                    .toSet(),
                activeElementKey = activeEntry?.takeIf { entry -> entry.kind == V2UtItemKind.ELEMENT }?.itemKey,
                onSelectEntry = onSelectEntry,
                onConfirm = onConfirm,
                onOpenFinding = onOpenFinding,
                onClose = onClose,
            )

            V2LayoutSurface.FLOOR -> RoofOrFloorUtMap(
                selectedTarget = selectedTarget,
                layoutMapSetup = layoutMapSetup,
                placements = placements,
                activeEntry = activeEntry,
                completedPlateIds = completedEntries
                    .filter { entry -> entry.kind == V2UtItemKind.LAYOUT_REGION }
                    .map { entry -> entry.itemLabel }
                    .toSet(),
                activePlateId = activeEntry?.takeIf { entry -> entry.kind == V2UtItemKind.LAYOUT_REGION }?.itemLabel,
                completedElementKeys = completedEntries
                    .filter { entry -> entry.kind == V2UtItemKind.ELEMENT }
                    .map { entry -> entry.itemKey }
                    .toSet(),
                activeElementKey = activeEntry?.takeIf { entry -> entry.kind == V2UtItemKind.ELEMENT }?.itemKey,
                onSelectEntry = onSelectEntry,
                onConfirm = onConfirm,
                onOpenFinding = onOpenFinding,
                onClose = onClose,
            )

            V2LayoutSurface.SHELL -> ShellUtMap(
                selectedTarget = selectedTarget,
                layoutMapSetup = layoutMapSetup,
                placements = placements,
                activeEntry = activeEntry,
                completedRegionLabels = completedEntries
                    .filter { entry -> entry.kind == V2UtItemKind.LAYOUT_REGION }
                    .map { entry -> entry.itemLabel }
                    .toSet(),
                activeRegionLabel = activeEntry?.takeIf { entry -> entry.kind == V2UtItemKind.LAYOUT_REGION }?.itemLabel,
                completedElementKeys = completedEntries
                    .filter { entry -> entry.kind == V2UtItemKind.ELEMENT }
                    .map { entry -> entry.itemKey }
                    .toSet(),
                activeElementKey = activeEntry?.takeIf { entry -> entry.kind == V2UtItemKind.ELEMENT }?.itemKey,
                onSelectEntry = onSelectEntry,
                onConfirm = onConfirm,
                onOpenFinding = onOpenFinding,
                onClose = onClose,
            )
        }
    }
}

@Composable
private fun RoofOrFloorUtMap(
    selectedTarget: V2LayoutTarget,
    layoutMapSetup: V2LayoutMapSetup,
    placements: List<V2PlacedElement>,
    activeEntry: V2UtMeasurementEntry?,
    completedPlateIds: Set<String>,
    activePlateId: String?,
    completedElementKeys: Set<String>,
    activeElementKey: String?,
    onSelectEntry: (V2UtMeasurementEntry) -> Unit,
    onConfirm: (V2UtMeasurementEntry) -> Unit,
    onOpenFinding: (V2UtMeasurementEntry) -> Unit,
    onClose: () -> Unit,
) {
    val mapHeight = if (activeEntry == null) 540.dp else 700.dp
    val density = LocalDensity.current
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxWidth()
            .height(mapHeight),
    ) {
        val mapWidth = maxWidth
        val mapSizePx = Size(
            width = with(density) { mapWidth.toPx() },
            height = with(density) { mapHeight.toPx() },
        )
        val placementRegion = roofOrFloorPlacementRegion(
            target = selectedTarget,
            layoutMapSetup = layoutMapSetup,
            mapSize = mapSizePx,
            roofSurfaceMapSizePx = with(density) { 320.dp.toPx() },
            roofSurfaceTopOffsetPx = with(density) { 58.dp.toPx() },
            markerAnchorInsetPx = with(density) { 8.dp.toPx() },
        )
        val markerAnchorXpx = with(density) { 12.dp.toPx() }
        val markerAnchorYpx = with(density) { 44.dp.toPx() }
        RoofSurfaceMap(
            template = if (selectedTarget.surface == V2LayoutSurface.FLOOR) {
                RoofTemplate.CIRCULAR_PLATE
            } else {
                layoutMapSetup.roofPattern
            },
            rowCount = if (selectedTarget.surface == V2LayoutSurface.FLOOR) {
                layoutMapSetup.floorPatternCountX.toPositiveInt(4)
            } else {
                layoutMapSetup.roofRowCount.toPositiveInt(4)
            },
            widestRowPlateCount = if (selectedTarget.surface == V2LayoutSurface.FLOOR) {
                layoutMapSetup.floorPatternCountY.toPositiveInt(12)
            } else {
                layoutMapSetup.roofWidestRowPlateCount.toPositiveInt(10)
            },
            ringCount = layoutMapSetup.roofRingCount.toPositiveInt(3),
            sectorCount = layoutMapSetup.roofSectorCount.toPositiveInt(20),
            activePlateId = activePlateId,
            savedPlateIds = completedPlateIds,
            emphasizeUtHighlights = true,
            centerFeatureCount = if (selectedTarget.surface == V2LayoutSurface.ROOF && layoutMapSetup.roofHasCenterOpening) 1 else 0,
            centerFeatureCountControlsLayout = true,
            useLeaderPlateLabels = false,
            showAnnularSectionLabels = selectedTarget.surface == V2LayoutSurface.FLOOR,
            autoHideCrowdedPlateLabels = true,
            enablePlateTapSelection = true,
            hasAnnularRing = when (selectedTarget.surface) {
                V2LayoutSurface.ROOF -> layoutMapSetup.roofHasAnnularRing
                V2LayoutSurface.FLOOR -> layoutMapSetup.floorTemplate == V2FloorTemplate.CIRCULAR_PLATE_WITH_AR
                V2LayoutSurface.SHELL -> false
            },
            annularSectionCount = when (selectedTarget.surface) {
                V2LayoutSurface.ROOF -> layoutMapSetup.roofAnnularSectionCount.toPositiveInt(12)
                V2LayoutSurface.FLOOR -> layoutMapSetup.floorAnnularSectionCount.toPositiveInt(12)
                V2LayoutSurface.SHELL -> 0
            },
            referenceLabel = layoutMapSetup.referenceMode.label,
            mapTitle = "",
            onSelectPlate = { plateId ->
                onSelectEntry(regionEntry(selectedTarget, plateId))
            },
            modifier = Modifier.fillMaxWidth(),
        )
        placements.sortedBy { element ->
            if (elementItemKey(selectedTarget, element) == activeElementKey) 1 else 0
        }.forEach { element ->
            val key = elementItemKey(selectedTarget, element)
            val center = markerCenter(element, mapSizePx, placementRegion)
            UtElementCallout(
                element = element,
                selected = key == activeElementKey,
                completed = key in completedElementKeys,
                onClick = {
                    onSelectEntry(elementEntry(selectedTarget, element))
                },
                modifier = Modifier.offset {
                    IntOffset(
                        x = (center.x - markerAnchorXpx).roundToInt(),
                        y = (center.y - markerAnchorYpx).roundToInt(),
                    )
                },
            )
        }
        activeEntry?.let { entry ->
            val anchor = anchorForRoofOrFloorEntry(
                selectedTarget = selectedTarget,
                layoutMapSetup = layoutMapSetup,
                placements = placements,
                entry = entry,
                mapSize = mapSizePx,
                placementRegion = placementRegion,
            )
            FloatingUtMeasurementCard(
                entry = entry,
                onConfirm = onConfirm,
                onOpenFinding = onOpenFinding,
                onClose = onClose,
                modifier = Modifier
                    .width(310.dp)
                    .offset(
                        x = floatingXOffset(anchor.x, mapWidth, 310.dp),
                        y = floatingYOffset(anchor.y, mapHeight, entry),
                    ),
            )
        }
    }
}

@Composable
private fun ShellUtMap(
    selectedTarget: V2LayoutTarget,
    layoutMapSetup: V2LayoutMapSetup,
    placements: List<V2PlacedElement>,
    activeEntry: V2UtMeasurementEntry?,
    completedRegionLabels: Set<String>,
    activeRegionLabel: String?,
    completedElementKeys: Set<String>,
    activeElementKey: String?,
    onSelectEntry: (V2UtMeasurementEntry) -> Unit,
    onConfirm: (V2UtMeasurementEntry) -> Unit,
    onOpenFinding: (V2UtMeasurementEntry) -> Unit,
    onClose: () -> Unit,
) {
    val courseCount = layoutMapSetup.shellCourseCount.toPositiveInt(6).coerceAtLeast(1)
    val laneCount = layoutMapSetup.shellLaneCount.toPositiveInt(4).coerceIn(1, 24)
    val mapHeight = if (activeEntry == null) 430.dp else 700.dp
    val density = LocalDensity.current
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxWidth()
            .height(mapHeight),
    ) {
        val mapWidth = maxWidth
        val mapSizePx = Size(
            width = with(density) { mapWidth.toPx() },
            height = with(density) { mapHeight.toPx() },
        )
        val placementRegion = shellPlacementRegion(
            mapSize = mapSizePx,
            courseCount = courseCount,
            labelWidthPx = with(density) { 46.dp.toPx() },
            topPaddingPx = with(density) { 26.dp.toPx() },
            bottomPaddingPx = with(density) { 14.dp.toPx() },
            rightPaddingPx = with(density) { 8.dp.toPx() },
            cellGapPx = with(density) { 2.dp.toPx() },
            markerAnchorInsetPx = with(density) { 8.dp.toPx() },
        )
        val markerAnchorXpx = with(density) { 12.dp.toPx() }
        val markerAnchorYpx = with(density) { 44.dp.toPx() }
        ShellUtCanvas(
            courseCount = courseCount,
            platesPerCourse = layoutMapSetup.shellPlatesPerCourse.toPositiveInt(12),
            offsetMode = layoutMapSetup.shellPlateOffset,
            offsetStartRow = layoutMapSetup.shellOffsetStartRow,
            thirdOffsetStart = layoutMapSetup.shellThirdOffsetStart,
            laneCount = laneCount,
            completedRegionLabels = completedRegionLabels,
            activeRegionLabel = activeRegionLabel,
            referenceLabel = layoutMapSetup.referenceMode.label,
            onSelectRegion = { laneIndex, course ->
                onSelectEntry(regionEntry(selectedTarget, "L${laneIndex + 1}-C$course"))
            },
            modifier = Modifier.fillMaxSize(),
        )
        placements.sortedBy { element ->
            if (elementItemKey(selectedTarget, element) == activeElementKey) 1 else 0
        }.forEach { element ->
            val key = elementItemKey(selectedTarget, element)
            val center = markerCenter(element, mapSizePx, placementRegion)
            UtElementCallout(
                element = element,
                selected = key == activeElementKey,
                completed = key in completedElementKeys,
                onClick = {
                    onSelectEntry(elementEntry(selectedTarget, element))
                },
                modifier = Modifier.offset {
                    IntOffset(
                        x = (center.x - markerAnchorXpx).roundToInt(),
                        y = (center.y - markerAnchorYpx).roundToInt(),
                    )
                },
            )
        }
        activeEntry?.let { entry ->
            val anchor = anchorForShellEntry(
                placements = placements,
                entry = entry,
                courseCount = courseCount,
                laneCount = laneCount,
                mapSize = mapSizePx,
                placementRegion = placementRegion,
            )
            FloatingUtMeasurementCard(
                entry = entry,
                onConfirm = onConfirm,
                onOpenFinding = onOpenFinding,
                onClose = onClose,
                modifier = Modifier
                    .width(310.dp)
                    .offset(
                        x = floatingXOffset(anchor.x, mapWidth, 310.dp),
                        y = floatingYOffset(anchor.y, mapHeight, entry),
                    ),
            )
        }
    }
}

@Composable
private fun ShellUtCanvas(
    courseCount: Int,
    platesPerCourse: Int,
    offsetMode: String,
    offsetStartRow: V2ShellOffsetStartRow,
    thirdOffsetStart: V2ShellThirdOffsetStart,
    laneCount: Int,
    completedRegionLabels: Set<String>,
    activeRegionLabel: String?,
    referenceLabel: String,
    onSelectRegion: (Int, Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val density = LocalDensity.current
    val labelWidthPx = with(density) { 46.dp.toPx() }
    val topPaddingPx = with(density) { 26.dp.toPx() }
    val bottomPaddingPx = with(density) { 14.dp.toPx() }
    val rightPaddingPx = with(density) { 8.dp.toPx() }
    val cellGapPx = with(density) { 2.dp.toPx() }
    Canvas(
        modifier = modifier.pointerInput(courseCount, laneCount) {
            detectTapGestures { offset ->
                val rows = courseCount.coerceAtLeast(1)
                val left = labelWidthPx
                val right = size.width.toFloat() - rightPaddingPx
                val rowHeight = ((size.height.toFloat() - topPaddingPx - bottomPaddingPx) / rows)
                    .coerceAtLeast(1f)
                val mapTop = topPaddingPx
                val mapBottom = topPaddingPx + rows * rowHeight - cellGapPx
                val laneWidth = (right - left) / laneCount.coerceAtLeast(1)
                if (offset.x in left..right && offset.y in mapTop..mapBottom) {
                    val laneIndex = ((offset.x - left) / laneWidth).toInt().coerceIn(0, laneCount - 1)
                    val rowIndex = ((offset.y - mapTop) / rowHeight).toInt().coerceIn(0, rows - 1)
                    val course = rows - rowIndex
                    onSelectRegion(laneIndex, course)
                }
            }
        },
    ) {
        val borderColor = LaiqColors.BrandTeal.copy(alpha = 0.72f)
        val laneColor = LaiqColors.BrandRed.copy(alpha = 0.78f)
        val selectedColor = LaiqColors.BrandRed
        val completedColor = Color(0xFF167A4A)
        val mutedColor = LaiqColors.MutedText
        val rows = courseCount.coerceAtLeast(1)
        val plateCount = platesPerCourse.coerceAtLeast(1)
        val left = labelWidthPx
        val right = size.width - rightPaddingPx
        val rowHeight = ((size.height - topPaddingPx - bottomPaddingPx) / rows).coerceAtLeast(26.dp.toPx())
        val mapTop = topPaddingPx
        val mapBottom = topPaddingPx + rows * rowHeight - cellGapPx
        val laneWidth = (right - left) / laneCount
        val labelPaint = android.graphics.Paint().apply {
            color = mutedColor.toArgb()
            textSize = 12.dp.toPx()
            isAntiAlias = true
        }
        val lanePaint = android.graphics.Paint().apply {
            color = LaiqColors.BrandRed.toArgb()
            textSize = 11.dp.toPx()
            textAlign = android.graphics.Paint.Align.CENTER
            isFakeBoldText = true
            isAntiAlias = true
        }

        drawContext.canvas.nativeCanvas.drawText("0° = $referenceLabel", left, 18.dp.toPx(), labelPaint)

        repeat(rows) { rowIndex ->
            val course = rows - rowIndex
            val y = mapTop + rowIndex * rowHeight
            drawContext.canvas.nativeCanvas.drawText(
                "C$course",
                0f,
                y + rowHeight * 0.62f,
                labelPaint,
            )
        }

        repeat(laneCount) { laneIndex ->
            drawContext.canvas.nativeCanvas.drawText(
                "L${laneIndex + 1}",
                left + laneIndex * laneWidth + laneWidth / 2f,
                mapTop - 8.dp.toPx(),
                lanePaint,
            )
        }

        val segments = buildShellUtPlateSegments(
            canvasSize = size,
            labelWidth = labelWidthPx,
            topPadding = topPaddingPx,
            bottomPadding = bottomPaddingPx,
            rightPadding = rightPaddingPx,
            cellGap = cellGapPx,
            courseCount = rows,
            platesPerCourse = plateCount,
            offsetMode = offsetMode,
            offsetStartRow = offsetStartRow,
            thirdOffsetStart = thirdOffsetStart,
        )
        segments.forEach { rect ->
            drawRect(
                color = Color.White.copy(alpha = 0.76f),
                topLeft = Offset(rect.left, rect.top),
                size = Size(rect.width, rect.height),
            )
            drawRect(
                color = borderColor,
                topLeft = Offset(rect.left, rect.top),
                size = Size(rect.width, rect.height),
                style = Stroke(width = 1.5.dp.toPx()),
            )
        }

        val statusLabelPaint = android.graphics.Paint().apply {
            textSize = 12.dp.toPx()
            textAlign = android.graphics.Paint.Align.CENTER
            isFakeBoldText = true
            isAntiAlias = true
        }
        repeat(rows) { rowIndex ->
            val course = rows - rowIndex
            val y = mapTop + rowIndex * rowHeight
            repeat(laneCount) { laneIndex ->
                val label = "L${laneIndex + 1}-C$course"
                val isActive = label == activeRegionLabel
                val isCompleted = label in completedRegionLabels
                if (isActive || isCompleted) {
                    val topLeft = Offset(left + laneIndex * laneWidth, y)
                    val regionSize = Size(laneWidth, rowHeight - cellGapPx)
                    val stateColor = if (isActive) selectedColor else completedColor
                    drawRect(
                        color = stateColor.copy(alpha = if (isActive) 0.34f else 0.32f),
                        topLeft = topLeft,
                        size = regionSize,
                    )
                    drawRect(
                        color = stateColor,
                        topLeft = topLeft,
                        size = regionSize,
                        style = Stroke(width = if (isActive) 3.dp.toPx() else 2.4.dp.toPx()),
                    )
                    if (laneWidth >= 42.dp.toPx() && rowHeight >= 34.dp.toPx()) {
                        statusLabelPaint.color = stateColor.toArgb()
                        drawContext.canvas.nativeCanvas.drawText(
                            if (isActive) label else "DONE",
                            topLeft.x + regionSize.width / 2f,
                            topLeft.y + regionSize.height / 2f + 4.dp.toPx(),
                            statusLabelPaint,
                        )
                    }
                }
            }
        }

        drawLine(
            color = borderColor,
            start = Offset(left, mapTop - 18.dp.toPx()),
            end = Offset(left, mapBottom + 12.dp.toPx()),
            strokeWidth = 2.dp.toPx(),
        )
        drawLine(
            color = borderColor.copy(alpha = 0.44f),
            start = Offset(right, mapTop - 18.dp.toPx()),
            end = Offset(right, mapBottom + 12.dp.toPx()),
            strokeWidth = 1.5.dp.toPx(),
        )
        for (laneIndex in 1 until laneCount) {
            drawVerticalDash(
                x = left + laneIndex * laneWidth,
                startY = mapTop - 20.dp.toPx(),
                endY = mapBottom + 20.dp.toPx(),
                color = laneColor,
                dashHeight = 14.dp.toPx(),
                gapHeight = 8.dp.toPx(),
                strokeWidth = 2.dp.toPx(),
            )
        }
    }
}

@Composable
private fun UtElementCallout(
    element: V2PlacedElement,
    selected: Boolean,
    completed: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val markerColor = when {
        selected -> LaiqColors.BrandRed
        completed -> Color(0xFF1D7C5A)
        else -> element.type.swatchColor()
    }
    val calloutFill = when {
        selected -> LaiqColors.BrandRed.copy(alpha = 0.12f)
        completed -> Color(0xFF167A4A).copy(alpha = 0.16f)
        else -> Color.White
    }
    Box(
        modifier = modifier
            .width(108.dp)
            .height(58.dp)
            .clickable(onClick = onClick),
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawLine(
                color = markerColor.copy(alpha = 0.78f),
                start = Offset(12.dp.toPx(), 44.dp.toPx()),
                end = Offset(40.dp.toPx(), 17.dp.toPx()),
                strokeWidth = if (selected || completed) 3.dp.toPx() else 2.2.dp.toPx(),
            )
            drawCircle(color = Color.White, radius = 5.5.dp.toPx(), center = Offset(12.dp.toPx(), 44.dp.toPx()))
            drawCircle(
                color = markerColor,
                radius = 5.5.dp.toPx(),
                center = Offset(12.dp.toPx(), 44.dp.toPx()),
                style = Stroke(width = 2.2.dp.toPx()),
            )
        }
        Surface(
            shape = RoundedCornerShape(14.dp),
            color = calloutFill,
            border = BorderStroke(if (selected || completed) 2.4.dp else 1.6.dp, markerColor.copy(alpha = 0.90f)),
            shadowElevation = if (selected || completed) 8.dp else 3.dp,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .width(78.dp)
                .height(36.dp),
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 7.dp, vertical = 7.dp),
                horizontalArrangement = Arrangement.spacedBy(5.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                ElementGlyph(element.type)
                Text(
                    text = element.label,
                    style = MaterialTheme.typography.labelSmall,
                    color = when {
                        selected -> LaiqColors.BrandRed
                        completed -> Color(0xFF167A4A)
                        else -> LaiqColors.BodyText
                    },
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
private fun ElementGlyph(type: V2ElementType) {
    Box(
        modifier = Modifier
            .size(18.dp)
            .background(type.swatchColor().copy(alpha = 0.16f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = type.shortLabel,
            style = MaterialTheme.typography.labelSmall,
            color = type.swatchColor(),
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun FloatingUtMeasurementCard(
    entry: V2UtMeasurementEntry,
    onConfirm: (V2UtMeasurementEntry) -> Unit,
    onOpenFinding: (V2UtMeasurementEntry) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val labels = entry.readingLabels()
    var nozzleSize by remember(entry.itemKey) { mutableStateOf(entry.nozzleSize) }
    var readings by remember(entry.itemKey) {
        mutableStateOf(entry.readings.withSize(labels.size))
    }
    val validationErrors = utReadingValidationErrors(readings, labels)
    Surface(
        shape = RoundedCornerShape(22.dp),
        color = Color.White,
        border = BorderStroke(1.8.dp, LaiqColors.BrandRed.copy(alpha = 0.68f)),
        shadowElevation = 10.dp,
        modifier = modifier,
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = entry.cardTitle(),
                style = MaterialTheme.typography.titleSmall,
                color = LaiqColors.BrandTeal,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = "Fill only the readings taken. Blank means no UT was conducted for that point.",
                style = MaterialTheme.typography.bodySmall,
                color = LaiqColors.MutedText,
            )

            if (entry.elementType == V2ElementType.NOZZLE) {
                LaiqDropdownField(
                    label = "Nozzle Size",
                    value = nozzleSize,
                    options = nozzleSizeOptions,
                    onSelected = { nozzleSize = it },
                )
            }

            val columnCount = if (labels.size == 4 && labels.all { label -> label.length <= 4 }) {
                4
            } else {
                2
            }
            labels.chunked(columnCount).forEach { rowLabels ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    rowLabels.forEach { label ->
                        val index = labels.indexOf(label)
                        CompactUtTextField(
                            value = readings[index],
                            onValueChange = { updated ->
                                readings = readings.toMutableList().also { next -> next[index] = updated }
                            },
                            label = label,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    repeat(columnCount - rowLabels.size) {
                        Box(modifier = Modifier.weight(1f))
                    }
                }
            }

            if (validationErrors.isNotEmpty()) {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = LaiqColors.BrandRed.copy(alpha = 0.08f),
                    border = BorderStroke(1.dp, LaiqColors.BrandRed.copy(alpha = 0.28f)),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        validationErrors.forEach { error ->
                            Text(
                                text = error,
                                style = MaterialTheme.typography.bodySmall,
                                color = LaiqColors.BrandRed,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                    }
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                LaiqSecondaryButton(
                    text = "Close",
                    onClick = onClose,
                    modifier = Modifier.weight(1f),
                )
                LaiqSecondaryButton(
                    text = "Finding",
                    onClick = {
                        onOpenFinding(
                            entry.copy(
                                nozzleSize = nozzleSize,
                                readings = readings.map { reading -> reading.trim() },
                                confirmed = true,
                            ),
                        )
                    },
                    enabled = validationErrors.isEmpty(),
                    modifier = Modifier.weight(1f),
                )
            }
            LaiqPrimaryButton(
                text = "Confirm",
                onClick = {
                    onConfirm(
                        entry.copy(
                            nozzleSize = nozzleSize,
                            readings = readings.map { reading -> reading.trim() },
                            confirmed = true,
                        ),
                    )
                },
                enabled = validationErrors.isEmpty(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun CompactUtTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(label) },
        singleLine = true,
        shape = RoundedCornerShape(14.dp),
        textStyle = MaterialTheme.typography.bodyMedium,
        keyboardOptions = KeyboardOptions.Default.copy(
            keyboardType = KeyboardType.Decimal,
            imeAction = ImeAction.Next,
        ),
        modifier = modifier.height(58.dp),
    )
}

private fun anchorForRoofOrFloorEntry(
    selectedTarget: V2LayoutTarget,
    layoutMapSetup: V2LayoutMapSetup,
    placements: List<V2PlacedElement>,
    entry: V2UtMeasurementEntry,
    mapSize: Size,
    placementRegion: PlacementRegion?,
): Offset {
    if (entry.kind == V2UtItemKind.ELEMENT) {
        placements.firstOrNull { element -> elementItemKey(selectedTarget, element) == entry.itemKey }?.let { element ->
            return markerCenter(element, mapSize, placementRegion).toNormalized(mapSize)
        }
    }
    val label = entry.itemLabel
    if (label.equals("CO", ignoreCase = true)) return Offset(0.5f, 0.5f)
    val annularNumber = label.removePrefix("AR").toIntOrNull()
    if (annularNumber != null) {
        val count = when (selectedTarget.surface) {
            V2LayoutSurface.ROOF -> layoutMapSetup.roofAnnularSectionCount.toPositiveInt(12)
            V2LayoutSurface.FLOOR -> layoutMapSetup.floorAnnularSectionCount.toPositiveInt(12)
            V2LayoutSurface.SHELL -> 12
        }.coerceAtLeast(1)
        val angle = -PI / 2.0 + (2.0 * PI * (annularNumber - 0.5) / count.toDouble())
        return Offset(
            x = (0.5 + cos(angle) * 0.43).toFloat().coerceIn(0.08f, 0.92f),
            y = (0.5 + sin(angle) * 0.43).toFloat().coerceIn(0.08f, 0.92f),
        )
    }
    val plateNumber = label.toIntOrNull() ?: return Offset(0.5f, 0.38f)
    val sectorCount = layoutMapSetup.roofSectorCount.toPositiveInt(20).coerceAtLeast(1)
    val angle = -PI / 2.0 + (2.0 * PI * ((plateNumber - 1) % sectorCount) / sectorCount.toDouble())
    val radius = if (selectedTarget.surface == V2LayoutSurface.FLOOR) {
        0.24 + ((plateNumber % 4) * 0.055)
    } else {
        0.30
    }
    return Offset(
        x = (0.5 + cos(angle) * radius).toFloat().coerceIn(0.14f, 0.86f),
        y = (0.5 + sin(angle) * radius).toFloat().coerceIn(0.14f, 0.86f),
    )
}

private fun anchorForShellEntry(
    placements: List<V2PlacedElement>,
    entry: V2UtMeasurementEntry,
    courseCount: Int,
    laneCount: Int,
    mapSize: Size,
    placementRegion: PlacementRegion?,
): Offset {
    if (entry.kind == V2UtItemKind.ELEMENT) {
        placements.firstOrNull { element -> entry.itemKey.endsWith(element.id) }?.let { element ->
            return markerCenter(element, mapSize, placementRegion).toNormalized(mapSize)
        }
    }
    val match = Regex("""L(\d+)-C(\d+)""").find(entry.itemLabel)
    val lane = match?.groupValues?.getOrNull(1)?.toIntOrNull()?.coerceIn(1, laneCount) ?: 1
    val course = match?.groupValues?.getOrNull(2)?.toIntOrNull()?.coerceIn(1, courseCount) ?: 1
    return Offset(
        x = (0.08f + ((lane - 0.5f) / laneCount.toFloat()) * 0.88f).coerceIn(0.08f, 0.92f),
        y = (0.10f + ((courseCount - course + 0.5f) / courseCount.toFloat()) * 0.78f).coerceIn(0.10f, 0.88f),
    )
}

private data class PlacementRegion(
    val bounds: Rect,
    val circleCenter: Offset? = null,
    val circleRadius: Float = 0f,
) {
    fun coerce(position: Offset): Offset {
        val bounded = Offset(
            x = position.x.coerceIn(bounds.left, bounds.right),
            y = position.y.coerceIn(bounds.top, bounds.bottom),
        )
        val center = circleCenter ?: return bounded
        val distance = bounded.distanceTo(center)
        if (distance <= circleRadius || distance <= 0.001f) return bounded
        val scale = circleRadius / distance
        return Offset(
            x = center.x + (bounded.x - center.x) * scale,
            y = center.y + (bounded.y - center.y) * scale,
        )
    }
}

private fun roofOrFloorPlacementRegion(
    target: V2LayoutTarget,
    layoutMapSetup: V2LayoutMapSetup,
    mapSize: Size,
    roofSurfaceMapSizePx: Float,
    roofSurfaceTopOffsetPx: Float,
    markerAnchorInsetPx: Float,
): PlacementRegion? {
    if (!mapSize.isUsable()) return null
    val squareSize = min(mapSize.width, roofSurfaceMapSizePx)
    val squareLeft = ((mapSize.width - squareSize) / 2f).coerceAtLeast(0f)
    val squareTop = roofSurfaceTopOffsetPx.coerceIn(0f, (mapSize.height - squareSize).coerceAtLeast(0f))
    val hasAnnularRing = when (target.surface) {
        V2LayoutSurface.ROOF -> layoutMapSetup.roofHasAnnularRing
        V2LayoutSurface.FLOOR -> layoutMapSetup.floorTemplate == V2FloorTemplate.CIRCULAR_PLATE_WITH_AR
        V2LayoutSurface.SHELL -> false
    }
    val outerRadius = squareSize * if (hasAnnularRing) 0.48f else 0.42f
    val controlledRadius = (outerRadius - markerAnchorInsetPx).coerceAtLeast(squareSize * 0.18f)
    val center = Offset(
        x = squareLeft + squareSize / 2f,
        y = squareTop + squareSize / 2f,
    )
    return PlacementRegion(
        bounds = Rect(
            left = center.x - controlledRadius,
            top = center.y - controlledRadius,
            right = center.x + controlledRadius,
            bottom = center.y + controlledRadius,
        ),
        circleCenter = center,
        circleRadius = controlledRadius,
    )
}

private fun shellPlacementRegion(
    mapSize: Size,
    courseCount: Int,
    labelWidthPx: Float,
    topPaddingPx: Float,
    bottomPaddingPx: Float,
    rightPaddingPx: Float,
    cellGapPx: Float,
    markerAnchorInsetPx: Float,
): PlacementRegion? {
    if (!mapSize.isUsable()) return null
    val rows = courseCount.coerceAtLeast(1)
    val rowHeight = ((mapSize.height - topPaddingPx - bottomPaddingPx) / rows).coerceAtLeast(1f)
    val mapBottom = topPaddingPx + rows * rowHeight - cellGapPx
    return PlacementRegion(
        bounds = Rect(
            left = labelWidthPx + markerAnchorInsetPx,
            top = topPaddingPx + markerAnchorInsetPx,
            right = mapSize.width - rightPaddingPx - markerAnchorInsetPx,
            bottom = mapBottom - markerAnchorInsetPx,
        ),
    )
}

private fun markerCenter(
    element: V2PlacedElement,
    mapSize: Size,
    placementRegion: PlacementRegion?,
): Offset {
    val raw = Offset(
        x = mapSize.width * element.normalizedX,
        y = mapSize.height * element.normalizedY,
    )
    return placementRegion?.coerce(raw) ?: raw
}

private fun Offset.toNormalized(mapSize: Size): Offset =
    Offset(
        x = if (mapSize.width > 1f) (x / mapSize.width).coerceIn(0f, 1f) else 0.5f,
        y = if (mapSize.height > 1f) (y / mapSize.height).coerceIn(0f, 1f) else 0.5f,
    )

private fun Size.isUsable(): Boolean =
    width > 1f && height > 1f

private fun Offset.distanceTo(other: Offset): Float =
    hypot(x - other.x, y - other.y)

private fun floatingXOffset(anchorX: Float, mapWidth: Dp, cardWidth: Dp): Dp {
    val maxX = (mapWidth - cardWidth).coerceAtLeast(0.dp)
    return (mapWidth * anchorX - cardWidth / 2f).coerceIn(0.dp, maxX)
}

private fun floatingYOffset(anchorY: Float, mapHeight: Dp, entry: V2UtMeasurementEntry): Dp {
    val estimatedCardHeight = if (entry.readingLabels().size >= 5 || entry.elementType == V2ElementType.NOZZLE) {
        392.dp
    } else {
        326.dp
    }
    val below = mapHeight * anchorY + 12.dp
    val above = mapHeight * anchorY - estimatedCardHeight - 12.dp
    val maxY = (mapHeight - estimatedCardHeight).coerceAtLeast(0.dp)
    return if (anchorY < 0.50f) {
        below.coerceIn(0.dp, maxY)
    } else {
        above.coerceIn(0.dp, maxY)
    }
}

private fun regionEntry(
    target: V2LayoutTarget,
    itemLabel: String,
): V2UtMeasurementEntry =
    V2UtMeasurementEntry(
        itemKey = "${target.key}:region:$itemLabel",
        target = target,
        itemLabel = itemLabel,
        kind = V2UtItemKind.LAYOUT_REGION,
        readings = List(5) { "" },
    )

private fun elementEntry(
    target: V2LayoutTarget,
    element: V2PlacedElement,
): V2UtMeasurementEntry =
    V2UtMeasurementEntry(
        itemKey = elementItemKey(target, element),
        target = target,
        itemLabel = element.label,
        kind = V2UtItemKind.ELEMENT,
        elementType = element.type,
        readings = List(4) { "" },
    )

private fun elementItemKey(
    target: V2LayoutTarget,
    element: V2PlacedElement,
): String = "${target.key}:element:${element.id}"

private fun V2UtMeasurementEntry.cardTitle(): String =
    when (kind) {
        V2UtItemKind.LAYOUT_REGION -> "UT - $itemLabel"
        V2UtItemKind.ELEMENT -> "${elementType?.label ?: "Element"} UT - $itemLabel"
    }

private fun V2UtMeasurementEntry.readingLabels(): List<String> =
    when {
        kind == V2UtItemKind.LAYOUT_REGION -> listOf("UT 1", "UT 2", "UT 3", "UT 4", "UT 5")
        elementType == V2ElementType.NOZZLE && target.surface == V2LayoutSurface.ROOF -> listOf("N", "S", "E", "W")
        elementType == V2ElementType.NOZZLE && target.surface == V2LayoutSurface.SHELL -> listOf("12 o'clock", "3 o'clock", "6 o'clock", "9 o'clock")
        else -> listOf("UT 1", "UT 2", "UT 3", "UT 4")
    }

private fun V2UtMeasurementEntry.hasMeasuredReadings(): Boolean =
    readings.withSize(readingLabels().size).any { reading ->
        reading.trim().toDoubleOrNull()?.let { value -> value > 0.0 } == true
    }

private fun utReadingValidationErrors(
    readings: List<String>,
    labels: List<String>,
): List<String> {
    val normalizedReadings = readings.withSize(labels.size).map { reading -> reading.trim() }
    val errors = mutableListOf<String>()
    val invalidLabels = normalizedReadings.mapIndexedNotNull { index, reading ->
        val valid = reading.isBlank() || reading.toDoubleOrNull()?.let { value -> value > 0.0 } == true
        labels.getOrNull(index).takeIf { !valid }
    }
    if (invalidLabels.isNotEmpty()) {
        errors += "Use positive numbers for ${invalidLabels.joinToString(", ")}."
    }
    return errors
}

private fun List<String>.withSize(size: Int): List<String> =
    (this + List(size) { "" }).take(size)

private fun buildShellUtPlateSegments(
    canvasSize: Size,
    labelWidth: Float,
    topPadding: Float,
    bottomPadding: Float,
    rightPadding: Float,
    cellGap: Float,
    courseCount: Int,
    platesPerCourse: Int,
    offsetMode: String,
    offsetStartRow: V2ShellOffsetStartRow,
    thirdOffsetStart: V2ShellThirdOffsetStart,
): List<Rect> {
    val rows = courseCount.coerceAtLeast(1)
    val plateCount = platesPerCourse.coerceAtLeast(1)
    val left = labelWidth
    val right = canvasSize.width - rightPadding
    val availableWidth = (right - left).coerceAtLeast(1f)
    val rowHeight = ((canvasSize.height - topPadding - bottomPadding) / rows).coerceAtLeast(1f)
    val cellWidth = availableWidth / plateCount
    val height = (rowHeight - cellGap).coerceAtLeast(1f)

    return buildList {
        repeat(rows) { rowIndex ->
            val y = topPadding + rowIndex * rowHeight
            val course = rows - rowIndex
            val offsetFraction = shellOffsetFraction(
                courseNo = course,
                offsetMode = offsetMode,
                offsetStartRow = offsetStartRow,
                thirdOffsetStart = thirdOffsetStart,
            )
            if (offsetFraction > 0f && plateCount > 1) {
                val leadingRight = left + cellWidth * offsetFraction
                val trailingLeft = right - cellWidth * (1f - offsetFraction)
                add(shellVisualRect(left, leadingRight, y, height, cellGap))
                repeat(plateCount - 1) { plateIndex ->
                    val x = left + cellWidth * offsetFraction + plateIndex * cellWidth
                    add(shellVisualRect(x, x + cellWidth, y, height, cellGap))
                }
                add(shellVisualRect(trailingLeft, right, y, height, cellGap))
            } else {
                repeat(plateCount) { plateIndex ->
                    val x = left + plateIndex * cellWidth
                    add(shellVisualRect(x, x + cellWidth, y, height, cellGap))
                }
            }
        }
    }
}

private fun shellOffsetFraction(
    courseNo: Int,
    offsetMode: String,
    offsetStartRow: V2ShellOffsetStartRow,
    thirdOffsetStart: V2ShellThirdOffsetStart,
): Float =
    when (offsetMode) {
        "third_plate" -> {
            val startStep = when (thirdOffsetStart) {
                V2ShellThirdOffsetStart.FULL -> 0
                V2ShellThirdOffsetStart.ONE_THIRD -> 1
                V2ShellThirdOffsetStart.TWO_THIRDS -> 2
            }
            ((startStep + courseNo - 1) % 3) / 3f
        }
        "half_plate" -> {
            val shouldOffset = when (offsetStartRow) {
                V2ShellOffsetStartRow.ODD -> courseNo % 2 == 1
                V2ShellOffsetStartRow.EVEN -> courseNo % 2 == 0
            }
            if (shouldOffset) 0.5f else 0f
        }
        else -> 0f
    }

private fun shellVisualRect(
    rawLeft: Float,
    rawRight: Float,
    top: Float,
    height: Float,
    gap: Float,
): Rect {
    val width = (rawRight - rawLeft).coerceAtLeast(1f)
    val inset = (gap / 2f).coerceAtMost(width / 3f)
    return Rect(rawLeft + inset, top, rawRight - inset, top + height)
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawVerticalDash(
    x: Float,
    startY: Float,
    endY: Float,
    color: Color,
    dashHeight: Float,
    gapHeight: Float,
    strokeWidth: Float,
) {
    var y = startY
    while (y < endY) {
        val dashEnd = (y + dashHeight).coerceAtMost(endY)
        drawLine(
            color = color,
            start = Offset(x, y),
            end = Offset(x, dashEnd),
            strokeWidth = strokeWidth,
        )
        y += dashHeight + gapHeight
    }
}

private fun V2ElementType.swatchColor(): Color =
    when (this) {
        V2ElementType.NOZZLE -> LaiqColors.BrandTeal
        V2ElementType.MANHOLE -> Color(0xFF9B5A16)
        V2ElementType.STAIR -> Color(0xFF5A5EA7)
        V2ElementType.PLATFORM -> Color(0xFF2C7B72)
        V2ElementType.VENT -> Color(0xFF5176C5)
        V2ElementType.GAUGE_HATCH -> Color(0xFF8D4FB2)
        V2ElementType.ROOF_DRAIN -> Color(0xFF3F83B5)
        V2ElementType.SUPPORT -> Color(0xFF7C8A2E)
        V2ElementType.SUMP -> Color(0xFFB35B4D)
        V2ElementType.DATUM -> Color(0xFF6E7E90)
    }

private fun String.toPositiveInt(fallback: Int): Int =
    toIntOrNull()?.takeIf { it > 0 } ?: fallback

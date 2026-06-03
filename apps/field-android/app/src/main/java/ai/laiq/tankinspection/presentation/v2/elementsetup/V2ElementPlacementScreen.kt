package ai.laiq.tankinspection.presentation.v2.elementsetup

import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqDropdownField
import ai.laiq.tankinspection.presentation.components.LaiqOptionChips
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.components.RoofSurfaceMap
import ai.laiq.tankinspection.v2.model.V2ElementPlacementState
import ai.laiq.tankinspection.v2.model.V2ElementType
import ai.laiq.tankinspection.v2.model.V2FloorTemplate
import ai.laiq.tankinspection.v2.model.V2GeneralTankInfo
import ai.laiq.tankinspection.v2.model.V2LayoutMapSetup
import ai.laiq.tankinspection.v2.model.V2LayoutSurface
import ai.laiq.tankinspection.v2.model.V2LayoutTarget
import ai.laiq.tankinspection.v2.model.V2PlacedElement
import ai.laiq.tankinspection.v2.model.placementsFor
import ai.laiq.tankinspection.v2.model.supports
import ai.laiq.tankinspection.v2.model.withMovedElement
import ai.laiq.tankinspection.v2.model.withPlacedElement
import ai.laiq.tankinspection.v2.model.withRemovedElement
import ai.laiq.tankinspection.v2.model.withSelectedElement
import ai.laiq.tankinspection.v2.model.withSelectedElementType
import ai.laiq.tankinspection.v2.model.withSelectedTarget
import ai.laiq.tankinspection.v2.model.withTargetApproval
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.drag
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.roundToInt

private enum class ElementDragSource {
    ADD_HANDLE,
    PLACED_ELEMENT,
}

private data class ElementDragState(
    val source: ElementDragSource,
    val elementType: V2ElementType,
    val label: String,
    val mapPosition: Offset,
    val elementId: String? = null,
    val rootPosition: Offset? = null,
)

@Composable
fun V2ElementPlacementScreen(
    generalTankInfo: V2GeneralTankInfo,
    layoutMapSetup: V2LayoutMapSetup,
    visibleTargets: List<V2LayoutTarget>,
    state: V2ElementPlacementState,
    onStateChange: (V2ElementPlacementState) -> Unit,
    onBack: () -> Unit,
    onContinue: (V2ElementPlacementState) -> Unit,
    contentPadding: PaddingValues = PaddingValues(0.dp),
) {
    val latestState by rememberUpdatedState(state)
    val selectedTarget = when {
        visibleTargets.isEmpty() -> V2LayoutTarget.EXTERNAL_ROOF
        state.selectedTarget in visibleTargets -> state.selectedTarget
        else -> visibleTargets.first()
    }
    val availableElementTypes = V2ElementType.entries.filter { type -> type.supports(selectedTarget) }
    val activeElementType = availableElementTypes.firstOrNull { type -> type == state.selectedElementType }
        ?: availableElementTypes.firstOrNull()
        ?: V2ElementType.NOZZLE
    val selectedPlacements = state.placementsFor(selectedTarget)
    val selectedElement = selectedPlacements.firstOrNull { element -> element.id == state.selectedElementId }
    val selectedTargetApproved = selectedTarget in state.approvedTargets
    val scrollState = rememberScrollState()

    Box(
        modifier = Modifier.fillMaxSize(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(
                    start = 16.dp,
                    end = 16.dp,
                    top = contentPadding.calculateTopPadding() + 12.dp,
                    bottom = 28.dp,
                ),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                "Element Placement",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.SemiBold,
                color = LaiqColors.BrandTeal,
                modifier = Modifier.padding(horizontal = 4.dp),
            )

            if (visibleTargets.isEmpty()) {
                LaiqSectionCard(title = "No Selected Layouts") {
                    Text(
                        text = "Choose at least one approved layout on the previous screen before placing elements.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = LaiqColors.BrandRed,
                    )
                }
            } else {
                LaiqSectionCard(title = "Placement Scope") {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        LaiqStatChip(
                            label = "Tank",
                            value = generalTankInfo.tankNumber.ifBlank { "Tank" },
                            modifier = Modifier.weight(1f),
                        )
                        LaiqStatChip(
                            label = "Layouts",
                            value = visibleTargets.size.toString(),
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        LaiqStatChip(
                            label = "Current",
                            value = selectedTarget.label,
                            modifier = Modifier.weight(1f),
                        )
                        LaiqStatChip(
                            label = "Placed",
                            value = selectedPlacements.size.toString(),
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

                ElementPlacementWorkspace(
                    selectedTarget = selectedTarget,
                    layoutMapSetup = layoutMapSetup,
                    selectedElementType = activeElementType,
                    selectedPlacements = selectedPlacements,
                    selectedElementId = state.selectedElementId,
                    onSelectElementType = { type ->
                        onStateChange(latestState.withSelectedElementType(type))
                    },
                    onSelectElement = { elementId ->
                        onStateChange(latestState.withSelectedElement(elementId))
                    },
                    onAddElement = { target, type, normalizedX, normalizedY ->
                        onStateChange(latestState.withPlacedElement(target, type, normalizedX, normalizedY))
                    },
                    onMoveElement = { target, elementId, normalizedX, normalizedY ->
                        onStateChange(latestState.withMovedElement(target, elementId, normalizedX, normalizedY))
                    },
                    onRemoveElement = { target, elementId ->
                        onStateChange(latestState.withRemovedElement(target, elementId))
                    },
                )

                selectedElement?.let { element ->
                    SelectedElementSummary(element = element, modifier = Modifier.fillMaxWidth())
                }

                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    LaiqSecondaryButton(
                        text = "Back",
                        onClick = onBack,
                        modifier = Modifier.weight(1f),
                    )
                    LaiqPrimaryButton(
                        text = when {
                            !selectedTargetApproved -> "Approve Layout"
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
}

@Composable
private fun ElementPlacementWorkspace(
    selectedTarget: V2LayoutTarget,
    layoutMapSetup: V2LayoutMapSetup,
    selectedElementType: V2ElementType,
    selectedPlacements: List<V2PlacedElement>,
    selectedElementId: String?,
    onSelectElementType: (V2ElementType) -> Unit,
    onSelectElement: (String?) -> Unit,
    onAddElement: (V2LayoutTarget, V2ElementType, Float, Float) -> Unit,
    onMoveElement: (V2LayoutTarget, String, Float, Float) -> Unit,
    onRemoveElement: (V2LayoutTarget, String) -> Unit,
) {
    val supportedElementTypes = V2ElementType.entries.filter { type -> type.supports(selectedTarget) }
    val density = LocalDensity.current
    val markerWidthPx = with(density) { 132.dp.toPx() }
    val markerHeightPx = with(density) { 74.dp.toPx() }
    val markerAnchorXpx = with(density) { 18.dp.toPx() }
    val markerAnchorYpx = with(density) { 56.dp.toPx() }
    val markerAnchorInsetPx = with(density) { 8.dp.toPx() }
    val mapEdgePaddingPx = with(density) { 16.dp.toPx() }
    val roofSurfaceMapSizePx = with(density) { 320.dp.toPx() }
    val roofSurfaceTopOffsetPx = with(density) { 58.dp.toPx() }
    val shellLabelWidthPx = with(density) { 42.dp.toPx() }
    val shellTopPaddingPx = with(density) { 34.dp.toPx() }
    val shellBottomPaddingPx = with(density) { 16.dp.toPx() }
    val shellRightPaddingPx = with(density) { 10.dp.toPx() }
    val shellCellGapPx = with(density) { 2.dp.toPx() }
    val placedDragStartThresholdPx = with(density) { 12.dp.toPx() }
    val tapGestureTolerancePx = with(density) { 20.dp.toPx() }
    val deleteCrossVisualSizePx = with(density) { 34.dp.toPx() }
    val deleteCrossHitSizePx = with(density) { 54.dp.toPx() }
    val editModeLongPressMillis = 1_000L
    var mapSize by remember(selectedTarget) { mutableStateOf(Size.Zero) }
    var mapBoundsInRoot by remember(selectedTarget) { mutableStateOf<Rect?>(null) }
    var dragState by remember(selectedTarget) { mutableStateOf<ElementDragState?>(null) }
    var editMode by remember(selectedTarget) { mutableStateOf(false) }
    val editPulseTransition = rememberInfiniteTransition(label = "element-edit-pulse")
    val editMarkerAlpha by editPulseTransition.animateFloat(
        initialValue = 0.78f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 620),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "element-edit-alpha",
    )

    fun placementRegion(): PlacementRegion? =
        placementRegionForTarget(
            target = selectedTarget,
            layoutMapSetup = layoutMapSetup,
            mapSize = mapSize,
            roofSurfaceMapSizePx = roofSurfaceMapSizePx,
            roofSurfaceTopOffsetPx = roofSurfaceTopOffsetPx,
            shellLabelWidthPx = shellLabelWidthPx,
            shellTopPaddingPx = shellTopPaddingPx,
            shellBottomPaddingPx = shellBottomPaddingPx,
            shellRightPaddingPx = shellRightPaddingPx,
            shellCellGapPx = shellCellGapPx,
            markerAnchorInsetPx = markerAnchorInsetPx,
        )

    fun rootPositionToMapPosition(rootPosition: Offset): Offset? {
        val bounds = mapBoundsInRoot ?: return null
        return Offset(
            x = rootPosition.x - bounds.left,
            y = rootPosition.y - bounds.top,
        )
    }

    fun updateAddDrag(rootPosition: Offset) {
        val mapPosition = rootPositionToMapPosition(rootPosition) ?: Offset.Zero
        dragState = ElementDragState(
            source = ElementDragSource.ADD_HANDLE,
            elementType = selectedElementType,
            label = "New ${selectedElementType.shortLabel}",
            mapPosition = mapPosition.coerceInsideMap(mapSize, mapEdgePaddingPx),
            rootPosition = rootPosition,
        )
    }

    fun finishActiveDrag() {
        val finalDragState = dragState
        dragState = null
        if (finalDragState != null && mapSize.isUsable()) {
            val activePlacementRegion = placementRegion()
            when (finalDragState.source) {
                ElementDragSource.ADD_HANDLE -> {
                    val rawMapPosition = finalDragState.rootPosition?.let { rootPosition ->
                        rootPositionToMapPosition(rootPosition)
                    }
                    val droppedInsideLayout = rawMapPosition?.let { position ->
                        activePlacementRegion?.contains(position) == true
                    } == true
                    if (droppedInsideLayout) {
                        val addPosition = rawMapPosition ?: return
                        val normalized = normalizeMapPosition(
                            activePlacementRegion?.coerce(addPosition) ?: addPosition,
                            mapSize,
                        )
                        onAddElement(
                            selectedTarget,
                            finalDragState.elementType,
                            normalized.x,
                            normalized.y,
                        )
                    }
                }

                ElementDragSource.PLACED_ELEMENT -> {
                    val elementId = finalDragState.elementId
                    if (elementId != null) {
                        val constrainedPosition = activePlacementRegion?.coerce(finalDragState.mapPosition)
                            ?: finalDragState.mapPosition.coerceInsideMap(mapSize, mapEdgePaddingPx)
                        val normalized = normalizeMapPosition(constrainedPosition, mapSize)
                        onMoveElement(
                            selectedTarget,
                            elementId,
                            normalized.x,
                            normalized.y,
                        )
                    }
                }
            }
        }
    }

    LaiqSectionCard(
        title = "${selectedTarget.label} Elements",
        subtitle = "Drag the selected icon onto the layout to add. Long-press a placed callout to edit, then drag it or tap its X to delete.",
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.Bottom,
            ) {
                LaiqDropdownField(
                    label = "Element Type",
                    value = selectedElementType.key,
                    options = supportedElementTypes.map { type -> type.key to type.label },
                    onSelected = { selected ->
                        dragState = null
                        supportedElementTypes.firstOrNull { type -> type.key == selected }?.let(onSelectElementType)
                    },
                    modifier = Modifier.weight(1f),
                )
                SelectedToolChip(
                    elementType = selectedElementType,
                    modifier = Modifier.size(68.dp),
                    onDragStart = { rootPosition ->
                        onSelectElement(null)
                        updateAddDrag(rootPosition)
                    },
                    onDrag = { dragAmount ->
                        val rootPosition = dragState?.rootPosition
                        if (rootPosition != null) {
                            updateAddDrag(rootPosition + dragAmount)
                        }
                    },
                    onDragEnd = { finishActiveDrag() },
                    onDragCancel = { dragState = null },
                )
            }

            Surface(
                shape = RoundedCornerShape(24.dp),
                color = LaiqColors.SurfaceTint,
                border = BorderStroke(1.dp, LaiqColors.PanelBorder),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(560.dp)
                        .padding(16.dp)
                        .onSizeChanged { size ->
                            mapSize = Size(size.width.toFloat(), size.height.toFloat())
                        }
                        .onGloballyPositioned { coordinates ->
                            mapBoundsInRoot = coordinates.boundsInRoot()
                        }
                        .pointerInput(selectedTarget, selectedPlacements, selectedElementId, editMode, mapSize) {
                            awaitEachGesture {
                                val down = awaitFirstDown(requireUnconsumed = false)
                                if (mapSize.isUsable()) {
                                    val orderedPlacements = selectedPlacements.withSelectedElementOnTop(selectedElementId)
                                    val deleteHit = if (editMode) {
                                        findDeleteCrossAtMapPosition(
                                            position = down.position,
                                            placements = orderedPlacements,
                                            mapSize = mapSize,
                                            markerWidthPx = markerWidthPx,
                                            markerAnchorXpx = markerAnchorXpx,
                                            markerAnchorYpx = markerAnchorYpx,
                                            deleteCrossVisualSizePx = deleteCrossVisualSizePx,
                                            deleteCrossHitSizePx = deleteCrossHitSizePx,
                                            placementRegion = placementRegion(),
                                        )
                                    } else {
                                        null
                                    }
                                    if (deleteHit != null) {
                                        var totalDrag = Offset.Zero
                                        while (true) {
                                            val event = awaitPointerEvent()
                                            val change = event.changes.firstOrNull { pointer -> pointer.id == down.id } ?: break
                                            totalDrag += change.positionChange()
                                            if (!change.pressed) break
                                        }
                                        if (totalDrag.getDistance() < tapGestureTolerancePx) {
                                            onRemoveElement(selectedTarget, deleteHit.id)
                                            if (selectedElementId == deleteHit.id) {
                                                onSelectElement(null)
                                            }
                                            if (selectedPlacements.size <= 1) {
                                                editMode = false
                                            }
                                        }
                                        return@awaitEachGesture
                                    }

                                    val hitElement = findElementAtMapPosition(
                                        position = down.position,
                                        placements = orderedPlacements,
                                        mapSize = mapSize,
                                        markerWidthPx = markerWidthPx,
                                        markerHeightPx = markerHeightPx,
                                        markerAnchorXpx = markerAnchorXpx,
                                        markerAnchorYpx = markerAnchorYpx,
                                        placementRegion = placementRegion(),
                                    )
                                    if (hitElement == null) {
                                        var totalDrag = Offset.Zero
                                        while (true) {
                                            val event = awaitPointerEvent()
                                            val change = event.changes.firstOrNull { pointer -> pointer.id == down.id } ?: break
                                            totalDrag += change.positionChange()
                                            if (!change.pressed) break
                                        }
                                        if (totalDrag.getDistance() < tapGestureTolerancePx) {
                                            onSelectElement(null)
                                            editMode = false
                                        }
                                        return@awaitEachGesture
                                    }

                                    onSelectElement(hitElement.id)
                                    val elementCenter = markerCenter(hitElement, mapSize, placementRegion())
                                    val initialDragState = ElementDragState(
                                        source = ElementDragSource.PLACED_ELEMENT,
                                        elementType = hitElement.type,
                                        label = hitElement.label,
                                        mapPosition = elementCenter,
                                        elementId = hitElement.id,
                                        rootPosition = mapBoundsInRoot?.let { bounds ->
                                            Offset(
                                                x = bounds.left + elementCenter.x,
                                                y = bounds.top + elementCenter.y,
                                            )
                                        },
                                    )

                                    if (editMode) {
                                        var totalDrag = Offset.Zero
                                        var dragStarted = false
                                        while (true) {
                                            val event = awaitPointerEvent()
                                            val change = event.changes.firstOrNull { pointer -> pointer.id == down.id } ?: break
                                            if (!change.pressed) break
                                            val delta = change.positionChange()
                                            totalDrag += delta
                                            if (!dragStarted && totalDrag.getDistance() >= placedDragStartThresholdPx) {
                                                dragStarted = true
                                                change.consume()
                                                dragState = initialDragState.copy(
                                                    mapPosition = (initialDragState.mapPosition + totalDrag)
                                                        .coerceInsideMap(mapSize, mapEdgePaddingPx),
                                                    rootPosition = initialDragState.rootPosition?.let { rootPosition ->
                                                        rootPosition + totalDrag
                                                    },
                                                )
                                            } else if (dragStarted) {
                                                change.consume()
                                                val activeDrag = dragState
                                                if (activeDrag != null) {
                                                    dragState = activeDrag.copy(
                                                        mapPosition = (activeDrag.mapPosition + delta)
                                                            .coerceInsideMap(mapSize, mapEdgePaddingPx),
                                                        rootPosition = activeDrag.rootPosition?.let { rootPosition ->
                                                            rootPosition + delta
                                                        },
                                                    )
                                                }
                                            }
                                        }
                                        if (dragStarted) {
                                            finishActiveDrag()
                                        } else {
                                            dragState = null
                                        }
                                        return@awaitEachGesture
                                    }

                                    var totalDragBeforeEdit = Offset.Zero
                                    val longPressReached = withTimeoutOrNull(editModeLongPressMillis) {
                                        while (true) {
                                            val event = awaitPointerEvent()
                                            val change = event.changes.firstOrNull { pointer -> pointer.id == down.id }
                                                ?: return@withTimeoutOrNull false
                                            if (!change.pressed) return@withTimeoutOrNull false
                                            totalDragBeforeEdit += change.positionChange()
                                            if (totalDragBeforeEdit.getDistance() >= placedDragStartThresholdPx) {
                                                return@withTimeoutOrNull false
                                            }
                                        }
                                    } == null
                                    if (longPressReached) {
                                        editMode = true
                                        dragState = initialDragState
                                        val completed = drag(down.id) { change ->
                                            val delta = change.positionChange()
                                            change.consume()
                                            val activeDrag = dragState
                                            if (activeDrag != null) {
                                                dragState = activeDrag.copy(
                                                    mapPosition = (activeDrag.mapPosition + delta)
                                                        .coerceInsideMap(mapSize, mapEdgePaddingPx),
                                                    rootPosition = activeDrag.rootPosition?.let { rootPosition ->
                                                        rootPosition + delta
                                                    },
                                                )
                                            }
                                        }
                                        if (completed) {
                                            finishActiveDrag()
                                        } else {
                                            dragState = null
                                        }
                                    }
                                }
                            }
                        },
                ) {
                    ElementPlacementMapBackground(
                        target = selectedTarget,
                        layoutMapSetup = layoutMapSetup,
                        modifier = Modifier.fillMaxSize(),
                    )

                    selectedPlacements.withSelectedElementOnTop(selectedElementId).forEach { element ->
                        if (dragState?.elementId != element.id && mapSize.isUsable()) {
                            val center = markerCenter(element, mapSize, placementRegion())
                            val flipHorizontal = shouldFlipMarkerCallout(center, mapSize)
                            val anchorXpx = markerAnchorXFor(
                                flipHorizontal = flipHorizontal,
                                markerWidthPx = markerWidthPx,
                                defaultAnchorXpx = markerAnchorXpx,
                            )
                            ElementPlacementMarker(
                                element = element,
                                selected = element.id == selectedElementId,
                                editMode = editMode,
                                flipHorizontal = flipHorizontal,
                                modifier = Modifier.offset {
                                    markerOffset(
                                        center = center,
                                        markerAnchorXpx = anchorXpx,
                                        markerAnchorYpx = markerAnchorYpx,
                                    )
                                }.graphicsLayer {
                                    alpha = if (editMode) editMarkerAlpha else 1f
                                },
                            )
                        }
                    }

                    dragState?.let { activeDrag ->
                        val flipHorizontal = shouldFlipMarkerCallout(activeDrag.mapPosition, mapSize)
                        val anchorXpx = markerAnchorXFor(
                            flipHorizontal = flipHorizontal,
                            markerWidthPx = markerWidthPx,
                            defaultAnchorXpx = markerAnchorXpx,
                        )
                        ElementMarkerCallout(
                            label = activeDrag.label,
                            type = activeDrag.elementType,
                            selected = true,
                            editMode = editMode && activeDrag.source == ElementDragSource.PLACED_ELEMENT,
                            flipHorizontal = flipHorizontal,
                            modifier = Modifier.offset {
                                markerOffset(
                                    center = activeDrag.mapPosition,
                                    markerAnchorXpx = anchorXpx,
                                    markerAnchorYpx = markerAnchorYpx,
                                )
                            },
                        )
                    }
                }
            }

            if (selectedPlacements.isEmpty()) {
                Text(
                    text = "No elements placed yet on ${selectedTarget.label.lowercase()}.",
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.MutedText,
                )
            }
        }
    }
}

@Composable
private fun SelectedToolChip(
    elementType: V2ElementType,
    modifier: Modifier = Modifier,
    onDragStart: (Offset) -> Unit,
    onDrag: (Offset) -> Unit,
    onDragEnd: () -> Unit,
    onDragCancel: () -> Unit,
) {
    var chipBoundsInRoot by remember(elementType.key) { mutableStateOf<Rect?>(null) }
    val currentOnDragStart by rememberUpdatedState(onDragStart)
    val currentOnDrag by rememberUpdatedState(onDrag)
    val currentOnDragEnd by rememberUpdatedState(onDragEnd)
    val currentOnDragCancel by rememberUpdatedState(onDragCancel)
    val dragStartThresholdPx = with(LocalDensity.current) { 8.dp.toPx() }
    Surface(
        shape = CircleShape,
        color = Color.White,
        border = BorderStroke(
            width = 1.5.dp,
            color = elementType.swatchColor().copy(alpha = 0.62f),
        ),
        shadowElevation = 3.dp,
        modifier = modifier
            .onGloballyPositioned { coordinates ->
                chipBoundsInRoot = coordinates.boundsInRoot()
            }
            .pointerInput(elementType.key) {
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    val bounds = chipBoundsInRoot
                    if (bounds == null) {
                        currentOnDragCancel()
                        return@awaitEachGesture
                    }
                    var totalDrag = Offset.Zero
                    var dragStarted = false

                    while (true) {
                        val event = awaitPointerEvent()
                        val change = event.changes.firstOrNull { pointer -> pointer.id == down.id } ?: break
                        if (!change.pressed) break

                        val delta = change.positionChange()
                        if (delta != Offset.Zero) {
                            totalDrag += delta
                            if (!dragStarted && totalDrag.getDistance() >= dragStartThresholdPx) {
                                dragStarted = true
                                change.consume()
                                currentOnDragStart(
                                    Offset(
                                        x = bounds.left + down.position.x + totalDrag.x,
                                        y = bounds.top + down.position.y + totalDrag.y,
                                    ),
                                )
                            } else if (dragStarted) {
                                change.consume()
                                currentOnDrag(delta)
                            }
                        }
                    }

                    if (dragStarted) {
                        currentOnDragEnd()
                    } else {
                        currentOnDragCancel()
                    }
                }
            },
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp),
            contentAlignment = Alignment.Center,
        ) {
            ElementGlyph(type = elementType, compact = false)
            Surface(
                shape = CircleShape,
                color = LaiqColors.SurfaceTint,
                border = BorderStroke(1.dp, elementType.swatchColor().copy(alpha = 0.55f)),
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .size(20.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = "+",
                        style = MaterialTheme.typography.labelSmall,
                        color = elementType.swatchColor(),
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }
}

@Composable
private fun ElementPlacementMarker(
    element: V2PlacedElement,
    selected: Boolean,
    editMode: Boolean,
    flipHorizontal: Boolean,
    modifier: Modifier = Modifier,
) {
    ElementMarkerCallout(
        label = element.label,
        type = element.type,
        selected = selected,
        editMode = editMode,
        flipHorizontal = flipHorizontal,
        modifier = modifier,
    )
}

@Composable
private fun ElementMarkerCallout(
    label: String,
    type: V2ElementType,
    selected: Boolean,
    editMode: Boolean,
    flipHorizontal: Boolean,
    modifier: Modifier = Modifier,
) {
    val markerColor = if (selected) LaiqColors.BrandRed else type.swatchColor()
    val calloutWidth = 132.dp
    val calloutHeight = 74.dp
    val labelWidth = 92.dp
    val labelHeight = 38.dp
    val labelTop = 3.dp
    val labelHorizontalInset = 2.dp
    val anchorX = if (flipHorizontal) 114.dp else 18.dp
    val labelLeft = if (flipHorizontal) {
        labelHorizontalInset
    } else {
        calloutWidth - labelWidth - labelHorizontalInset
    }
    val leaderEndX = if (flipHorizontal) {
        labelLeft + labelWidth
    } else {
        labelLeft
    }
    val leaderEndY = labelTop + labelHeight / 2f
    val labelAlignment = if (flipHorizontal) Alignment.TopStart else Alignment.TopEnd
    Box(
        modifier = modifier.size(width = calloutWidth, height = calloutHeight),
    ) {
        Canvas(modifier = Modifier.matchParentSize()) {
            drawLine(
                color = markerColor.copy(alpha = if (selected) 0.92f else 0.72f),
                start = Offset(anchorX.toPx(), 56.dp.toPx()),
                end = Offset(leaderEndX.toPx(), leaderEndY.toPx()),
                strokeWidth = 2.4.dp.toPx(),
            )
            drawCircle(
                color = Color.White,
                radius = 6.dp.toPx(),
                center = Offset(anchorX.toPx(), 56.dp.toPx()),
            )
            drawCircle(
                color = markerColor,
                radius = 6.dp.toPx(),
                center = Offset(anchorX.toPx(), 56.dp.toPx()),
                style = Stroke(width = 2.2.dp.toPx()),
            )
        }
        Surface(
            shape = RoundedCornerShape(15.dp),
            color = Color.White,
            border = BorderStroke(
                1.6.dp,
                if (selected) LaiqColors.BrandRed else type.swatchColor().copy(alpha = 0.68f),
            ),
            shadowElevation = if (selected) 7.dp else 3.dp,
            modifier = Modifier
                .align(labelAlignment)
                .offset(
                    x = if (flipHorizontal) labelHorizontalInset else -labelHorizontalInset,
                    y = labelTop,
                )
                .width(labelWidth)
                .height(labelHeight),
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 9.dp, vertical = 7.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                ElementGlyph(type = type, compact = true)
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelMedium,
                    color = if (selected) LaiqColors.BrandRed else LaiqColors.BodyText,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
        if (editMode) {
            Surface(
                shape = CircleShape,
                color = LaiqColors.BrandRed,
                border = BorderStroke(1.5.dp, Color.White),
                shadowElevation = 4.dp,
                modifier = Modifier
                    .align(labelAlignment)
                    .offset(
                        x = if (flipHorizontal) (-8).dp else 8.dp,
                        y = (-9).dp,
                    )
                    .size(34.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = "X",
                        style = MaterialTheme.typography.titleSmall,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }
}

@Composable
private fun SelectedElementSummary(
    element: V2PlacedElement,
    modifier: Modifier = Modifier,
) {
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = Color.White,
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
        modifier = modifier,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ElementGlyph(type = element.type)
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = "Selected: ${element.label}",
                    style = MaterialTheme.typography.titleSmall,
                    color = LaiqColors.BodyText,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = element.type.label,
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.MutedText,
                )
            }
        }
    }
}

@Composable
private fun ElementGlyph(
    type: V2ElementType,
    compact: Boolean = false,
) {
    val size = if (compact) 18.dp else 24.dp
    Box(
        modifier = Modifier
            .size(size)
            .background(type.swatchColor().copy(alpha = 0.16f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = type.shortLabel,
            style = if (compact) MaterialTheme.typography.labelSmall else MaterialTheme.typography.labelMedium,
            color = type.swatchColor(),
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun ElementPlacementMapBackground(
    target: V2LayoutTarget,
    layoutMapSetup: V2LayoutMapSetup,
    modifier: Modifier = Modifier,
) {
    when (target.surface) {
        V2LayoutSurface.ROOF -> RoofSurfaceMap(
            template = layoutMapSetup.roofPattern,
            rowCount = layoutMapSetup.roofRowCount.toPositiveInt(4),
            widestRowPlateCount = layoutMapSetup.roofWidestRowPlateCount.toPositiveInt(10),
            ringCount = layoutMapSetup.roofRingCount.toPositiveInt(4),
            sectorCount = layoutMapSetup.roofSectorCount.toPositiveInt(20),
            activePlateId = null,
            centerFeatureCount = if (layoutMapSetup.roofHasCenterOpening) 1 else 0,
            centerFeatureCountControlsLayout = true,
            useLeaderPlateLabels = false,
            showAnnularSectionLabels = false,
            autoHideCrowdedPlateLabels = true,
            enablePlateTapSelection = false,
            showInteractionHint = false,
            onSelectPlate = {},
            hasAnnularRing = layoutMapSetup.roofHasAnnularRing,
            annularSectionCount = if (layoutMapSetup.roofHasAnnularRing) {
                layoutMapSetup.roofAnnularSectionCount.toPositiveInt(12)
            } else {
                0
            },
            referenceLabel = layoutMapSetup.referenceMode.label,
            mapTitle = "",
            modifier = modifier,
        )

        V2LayoutSurface.FLOOR -> RoofSurfaceMap(
            template = RoofTemplate.CIRCULAR_PLATE,
            rowCount = layoutMapSetup.floorPlateCount.toPositiveInt(18).let { plateCount ->
                when {
                    plateCount >= 28 -> 5
                    plateCount >= 18 -> 4
                    plateCount >= 10 -> 3
                    else -> 2
                }
            },
            widestRowPlateCount = layoutMapSetup.floorPlateCount.toPositiveInt(18).coerceIn(8, 24),
            ringCount = 0,
            sectorCount = 0,
            activePlateId = null,
            centerFeatureCount = 0,
            centerFeatureCountControlsLayout = false,
            useLeaderPlateLabels = false,
            showAnnularSectionLabels = false,
            autoHideCrowdedPlateLabels = true,
            enablePlateTapSelection = false,
            showInteractionHint = false,
            onSelectPlate = {},
            hasAnnularRing = layoutMapSetup.floorTemplate == V2FloorTemplate.CIRCULAR_PLATE_WITH_AR,
            annularSectionCount = if (layoutMapSetup.floorTemplate == V2FloorTemplate.CIRCULAR_PLATE_WITH_AR) {
                layoutMapSetup.floorAnnularSectionCount.toPositiveInt(12)
            } else {
                0
            },
            referenceLabel = layoutMapSetup.referenceMode.label,
            mapTitle = "",
            modifier = modifier,
        )

        V2LayoutSurface.SHELL -> ShellElementMapBackground(
            courseCount = layoutMapSetup.shellCourseCount.toPositiveInt(6),
            platesPerCourse = layoutMapSetup.shellPlatesPerCourse.toPositiveInt(12),
            offsetMode = layoutMapSetup.shellPlateOffset,
            laneCount = layoutMapSetup.shellLaneCount.toPositiveInt(4),
            referenceLabel = layoutMapSetup.referenceMode.label,
            modifier = modifier,
        )
    }
}

@Composable
private fun ShellElementMapBackground(
    courseCount: Int,
    platesPerCourse: Int,
    offsetMode: String,
    laneCount: Int,
    referenceLabel: String,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val brandColor = LaiqColors.BrandTeal
            val borderColor = LaiqColors.BrandTeal.copy(alpha = 0.74f)
            val laneColor = LaiqColors.BrandRed.copy(alpha = 0.62f)
            val mutedColor = LaiqColors.MutedText
            val labelWidth = 42.dp.toPx()
            val topPadding = 34.dp.toPx()
            val bottomPadding = 16.dp.toPx()
            val rightPadding = 10.dp.toPx()
            val cellGap = 2.dp.toPx()
            val left = labelWidth
            val right = size.width - rightPadding
            val rows = courseCount.coerceAtLeast(1)
            val rowHeight = ((size.height - topPadding - bottomPadding) / rows).coerceAtLeast(28.dp.toPx())
            val mapTop = topPadding
            val mapBottom = topPadding + rows * rowHeight - cellGap
            val laneTotal = laneCount.coerceIn(1, 24)
            val laneWidth = (right - left) / laneTotal

            val labelPaint = android.graphics.Paint().apply {
                color = mutedColor.toArgb()
                textSize = 12.dp.toPx()
                isAntiAlias = true
            }
            val lanePaint = android.graphics.Paint().apply {
                color = LaiqColors.BrandRed.toArgb()
                textSize = 12.dp.toPx()
                textAlign = android.graphics.Paint.Align.CENTER
                isAntiAlias = true
                isFakeBoldText = true
            }

            drawLine(
                color = borderColor,
                start = Offset(left, topPadding - 14.dp.toPx()),
                end = Offset(left, size.height - bottomPadding + 4.dp.toPx()),
                strokeWidth = 2.dp.toPx(),
            )
            drawLine(
                color = borderColor.copy(alpha = 0.40f),
                start = Offset(right, topPadding - 14.dp.toPx()),
                end = Offset(right, size.height - bottomPadding + 4.dp.toPx()),
                strokeWidth = 1.4.dp.toPx(),
            )

            drawContext.canvas.nativeCanvas.drawText(
                "0°",
                left,
                topPadding - 18.dp.toPx(),
                labelPaint,
            )
            drawContext.canvas.nativeCanvas.drawText(
                "0° = $referenceLabel",
                left + 44.dp.toPx(),
                topPadding - 18.dp.toPx(),
                labelPaint,
            )

            repeat(rows) { rowIndex ->
                val courseNo = rows - rowIndex
                val y = topPadding + rowIndex * rowHeight
                drawContext.canvas.nativeCanvas.drawText(
                    "C$courseNo",
                    0f,
                    y + rowHeight * 0.62f,
                    labelPaint,
                )
            }

            repeat(laneTotal) { laneIndex ->
                if (laneIndex % 2 == 0) {
                    drawRect(
                        color = brandColor.copy(alpha = 0.05f),
                        topLeft = Offset(left + laneIndex * laneWidth, mapTop),
                        size = Size(laneWidth, mapBottom - mapTop),
                    )
                }
                if (laneWidth >= 34.dp.toPx()) {
                    drawContext.canvas.nativeCanvas.drawText(
                        "L${laneIndex + 1}",
                        left + laneIndex * laneWidth + laneWidth / 2f,
                        mapTop - 8.dp.toPx(),
                        lanePaint,
                    )
                }
            }

            val segments = buildShellPlacementSegments(
                canvasSize = size,
                labelWidth = labelWidth,
                topPadding = topPadding,
                bottomPadding = bottomPadding,
                rightPadding = rightPadding,
                cellGap = cellGap,
                courseCount = courseCount,
                platesPerCourse = platesPerCourse,
                offsetMode = offsetMode,
            )
            segments.forEach { segment ->
                drawRect(
                    color = Color.White,
                    topLeft = Offset(segment.rect.left, segment.rect.top),
                    size = Size(segment.rect.width, segment.rect.height),
                )
                drawRect(
                    color = borderColor,
                    topLeft = Offset(segment.rect.left, segment.rect.top),
                    size = Size(segment.rect.width, segment.rect.height),
                    style = Stroke(width = 1.5.dp.toPx()),
                )
            }

            for (laneIndex in 1 until laneTotal) {
                drawVerticalDashedLine(
                    x = left + laneIndex * laneWidth,
                    startY = mapTop - 18.dp.toPx(),
                    endY = mapBottom + 18.dp.toPx(),
                    color = laneColor,
                    dashHeight = 14.dp.toPx(),
                    gapHeight = 8.dp.toPx(),
                    strokeWidth = 2.dp.toPx(),
                )
            }
        }
    }
}

private fun Size.isUsable(): Boolean =
    width > 1f && height > 1f

private data class PlacementRegion(
    val bounds: Rect,
    val circleCenter: Offset? = null,
    val circleRadius: Float = 0f,
) {
    fun contains(position: Offset): Boolean =
        bounds.contains(position) && (
            circleCenter == null ||
                position.distanceTo(circleCenter) <= circleRadius
            )

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

private fun placementRegionForTarget(
    target: V2LayoutTarget,
    layoutMapSetup: V2LayoutMapSetup,
    mapSize: Size,
    roofSurfaceMapSizePx: Float,
    roofSurfaceTopOffsetPx: Float,
    shellLabelWidthPx: Float,
    shellTopPaddingPx: Float,
    shellBottomPaddingPx: Float,
    shellRightPaddingPx: Float,
    shellCellGapPx: Float,
    markerAnchorInsetPx: Float,
): PlacementRegion? {
    if (!mapSize.isUsable()) return null
    return when (target.surface) {
        V2LayoutSurface.ROOF,
        V2LayoutSurface.FLOOR -> {
            val squareSize = min(mapSize.width, roofSurfaceMapSizePx)
            val squareLeft = ((mapSize.width - squareSize) / 2f).coerceAtLeast(0f)
            val squareTop = roofSurfaceTopOffsetPx
                .coerceIn(0f, (mapSize.height - squareSize).coerceAtLeast(0f))
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
            PlacementRegion(
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

        V2LayoutSurface.SHELL -> {
            val rows = layoutMapSetup.shellCourseCount.toPositiveInt(6).coerceAtLeast(1)
            val rowHeight = ((mapSize.height - shellTopPaddingPx - shellBottomPaddingPx) / rows)
                .coerceAtLeast(1f)
            val mapBottom = shellTopPaddingPx + rows * rowHeight - shellCellGapPx
            PlacementRegion(
                bounds = Rect(
                    left = shellLabelWidthPx + markerAnchorInsetPx,
                    top = shellTopPaddingPx + markerAnchorInsetPx,
                    right = mapSize.width - shellRightPaddingPx - markerAnchorInsetPx,
                    bottom = mapBottom - markerAnchorInsetPx,
                ),
            )
        }
    }
}

private fun findElementAtMapPosition(
    position: Offset,
    placements: List<V2PlacedElement>,
    mapSize: Size,
    markerWidthPx: Float,
    markerHeightPx: Float,
    markerAnchorXpx: Float,
    markerAnchorYpx: Float,
    placementRegion: PlacementRegion? = null,
): V2PlacedElement? =
    placements.asReversed().firstOrNull { element ->
        val center = markerCenter(element, mapSize, placementRegion)
        val anchorXpx = markerAnchorXFor(
            flipHorizontal = shouldFlipMarkerCallout(center, mapSize),
            markerWidthPx = markerWidthPx,
            defaultAnchorXpx = markerAnchorXpx,
        )
        val hitRect = Rect(
            left = center.x - anchorXpx,
            top = center.y - markerAnchorYpx,
            right = center.x - anchorXpx + markerWidthPx,
            bottom = center.y - markerAnchorYpx + markerHeightPx,
        )
        hitRect.contains(position) || position.distanceTo(center) <= markerAnchorYpx / 2f
    }

private fun findDeleteCrossAtMapPosition(
    position: Offset,
    placements: List<V2PlacedElement>,
    mapSize: Size,
    markerWidthPx: Float,
    markerAnchorXpx: Float,
    markerAnchorYpx: Float,
    deleteCrossVisualSizePx: Float,
    deleteCrossHitSizePx: Float,
    placementRegion: PlacementRegion? = null,
): V2PlacedElement? =
    placements.asReversed().firstOrNull { element ->
        deleteCrossRectForElement(
            element = element,
            mapSize = mapSize,
            markerWidthPx = markerWidthPx,
            markerAnchorXpx = markerAnchorXpx,
            markerAnchorYpx = markerAnchorYpx,
            deleteCrossVisualSizePx = deleteCrossVisualSizePx,
            deleteCrossHitSizePx = deleteCrossHitSizePx,
            placementRegion = placementRegion,
        ).contains(position)
    }

private fun deleteCrossRectForElement(
    element: V2PlacedElement,
    mapSize: Size,
    markerWidthPx: Float,
    markerAnchorXpx: Float,
    markerAnchorYpx: Float,
    deleteCrossVisualSizePx: Float,
    deleteCrossHitSizePx: Float,
    placementRegion: PlacementRegion? = null,
): Rect {
    val center = markerCenter(element, mapSize, placementRegion)
    val flipHorizontal = shouldFlipMarkerCallout(center, mapSize)
    val anchorXpx = markerAnchorXFor(
        flipHorizontal = flipHorizontal,
        markerWidthPx = markerWidthPx,
        defaultAnchorXpx = markerAnchorXpx,
    )
    val markerLeft = center.x - anchorXpx
    val markerTop = center.y - markerAnchorYpx
    val horizontalNudge = deleteCrossVisualSizePx * 0.24f
    val verticalNudge = deleteCrossVisualSizePx * 0.26f
    val visualLeft = if (flipHorizontal) {
        markerLeft - horizontalNudge
    } else {
        markerLeft + markerWidthPx - deleteCrossVisualSizePx + horizontalNudge
    }
    val visualTop = markerTop - verticalNudge
    val hitCenter = Offset(
        x = visualLeft + deleteCrossVisualSizePx / 2f,
        y = visualTop + deleteCrossVisualSizePx / 2f,
    )
    return Rect(
        left = hitCenter.x - deleteCrossHitSizePx / 2f,
        top = hitCenter.y - deleteCrossHitSizePx / 2f,
        right = hitCenter.x + deleteCrossHitSizePx / 2f,
        bottom = hitCenter.y + deleteCrossHitSizePx / 2f,
    )
}

private fun List<V2PlacedElement>.withSelectedElementOnTop(selectedElementId: String?): List<V2PlacedElement> {
    if (selectedElementId == null) return this
    val selected = firstOrNull { element -> element.id == selectedElementId } ?: return this
    return filterNot { element -> element.id == selectedElementId } + selected
}

private fun shouldFlipMarkerCallout(
    center: Offset,
    mapSize: Size,
): Boolean =
    mapSize.isUsable() && center.x > mapSize.width * 0.62f

private fun markerAnchorXFor(
    flipHorizontal: Boolean,
    markerWidthPx: Float,
    defaultAnchorXpx: Float,
): Float =
    if (flipHorizontal) markerWidthPx - defaultAnchorXpx else defaultAnchorXpx

private fun markerCenter(
    element: V2PlacedElement,
    mapSize: Size,
    placementRegion: PlacementRegion? = null,
): Offset =
    placementRegion?.coerce(
        Offset(
            x = mapSize.width * element.normalizedX,
            y = mapSize.height * element.normalizedY,
        ),
    ) ?: Offset(
        x = mapSize.width * element.normalizedX,
        y = mapSize.height * element.normalizedY,
    )

private fun markerOffset(
    center: Offset,
    markerAnchorXpx: Float,
    markerAnchorYpx: Float,
): IntOffset =
    IntOffset(
        x = (center.x - markerAnchorXpx).roundToInt(),
        y = (center.y - markerAnchorYpx).roundToInt(),
    )

private fun normalizeMapPosition(
    position: Offset,
    mapSize: Size,
): Offset =
    Offset(
        x = (position.x / mapSize.width).coerceIn(0.06f, 0.94f),
        y = (position.y / mapSize.height).coerceIn(0.06f, 0.94f),
    )

private fun Offset.coerceInsideMap(
    mapSize: Size,
    paddingPx: Float,
): Offset {
    if (!mapSize.isUsable()) return this
    val xRangeHasRoom = mapSize.width > paddingPx * 2f
    val yRangeHasRoom = mapSize.height > paddingPx * 2f
    return Offset(
        x = if (xRangeHasRoom) x.coerceIn(paddingPx, mapSize.width - paddingPx) else mapSize.width / 2f,
        y = if (yRangeHasRoom) y.coerceIn(paddingPx, mapSize.height - paddingPx) else mapSize.height / 2f,
    )
}

private fun Offset.distanceTo(other: Offset): Float =
    hypot(x - other.x, y - other.y)

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

private data class ShellPlacementSegment(
    val rect: Rect,
)

private fun buildShellPlacementSegments(
    canvasSize: Size,
    labelWidth: Float,
    topPadding: Float,
    bottomPadding: Float,
    rightPadding: Float,
    cellGap: Float,
    courseCount: Int,
    platesPerCourse: Int,
    offsetMode: String,
): List<ShellPlacementSegment> {
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
            val offsetFraction = when (offsetMode) {
                "half_plate" -> if ((rows - rowIndex) % 2 == 0) 0.5f else 0f
                "third_plate" -> (((rows - rowIndex) - 1) % 3) / 3f
                else -> 0f
            }
            if (offsetFraction > 0f && plateCount > 1) {
                val leadingRight = left + cellWidth * offsetFraction
                val trailingLeft = right - cellWidth * (1f - offsetFraction)
                add(ShellPlacementSegment(shellVisualRect(left, leadingRight, y, height, cellGap)))
                repeat(plateCount - 1) { plateIndex ->
                    val x = left + cellWidth * offsetFraction + plateIndex * cellWidth
                    add(ShellPlacementSegment(shellVisualRect(x, x + cellWidth, y, height, cellGap)))
                }
                add(ShellPlacementSegment(shellVisualRect(trailingLeft, right, y, height, cellGap)))
            } else {
                repeat(plateCount) { plateIndex ->
                    val x = left + plateIndex * cellWidth
                    add(ShellPlacementSegment(shellVisualRect(x, x + cellWidth, y, height, cellGap)))
                }
            }
        }
    }
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

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawVerticalDashedLine(
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

private fun String.toPositiveInt(fallback: Int): Int =
    toIntOrNull()?.takeIf { it > 0 } ?: fallback

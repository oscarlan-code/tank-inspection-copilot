package ai.laiq.tankinspection.presentation.v3product.elementsetup

import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqDropdownField
import ai.laiq.tankinspection.presentation.components.LaiqOptionChips
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.components.LaiqTextField
import ai.laiq.tankinspection.presentation.v3product.common.ProductCollapsibleSectionCard
import ai.laiq.tankinspection.presentation.v3product.common.ProductStickyActionBar
import ai.laiq.tankinspection.presentation.v3product.common.ProductStickyActionBarHeight
import ai.laiq.tankinspection.presentation.v3product.common.normalizedFor
import ai.laiq.tankinspection.presentation.v3product.common.toRoofPlateCells
import ai.laiq.tankinspection.presentation.components.RoofSurfaceMap
import ai.laiq.tankinspection.v3product.model.ProductElementPlacementState
import ai.laiq.tankinspection.v3product.model.ProductElementType
import ai.laiq.tankinspection.v3product.model.ProductFloorTemplate
import ai.laiq.tankinspection.v3product.model.ProductGeneralTankInfo
import ai.laiq.tankinspection.v3product.model.ProductLayoutMapSetup
import ai.laiq.tankinspection.v3product.model.ProductLayoutSurface
import ai.laiq.tankinspection.v3product.model.ProductLayoutTarget
import ai.laiq.tankinspection.v3product.model.ProductPlacedElement
import ai.laiq.tankinspection.v3product.model.ProductShellOffsetStartRow
import ai.laiq.tankinspection.v3product.model.ProductShellThirdOffsetStart
import ai.laiq.tankinspection.v3product.model.customCircularLayoutFor
import ai.laiq.tankinspection.v3product.model.placementsFor
import ai.laiq.tankinspection.v3product.model.supports
import ai.laiq.tankinspection.v3product.model.withMovedElement
import ai.laiq.tankinspection.v3product.model.withPlacedElement
import ai.laiq.tankinspection.v3product.model.withRemovedElement
import ai.laiq.tankinspection.v3product.model.withRenamedElement
import ai.laiq.tankinspection.v3product.model.withSelectedElement
import ai.laiq.tankinspection.v3product.model.withSelectedElementType
import ai.laiq.tankinspection.v3product.model.withSelectedTarget
import ai.laiq.tankinspection.v3product.model.withTargetApproval
import ai.laiq.tankinspection.v3product.storage.ProductWorkflowScreen
import ai.laiq.tankinspection.v3product.voice.ProductVoiceControlLevel
import ai.laiq.tankinspection.v3product.voice.ProductVoiceCaptureHost
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
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.roundToInt

private enum class ElementDragSource {
    ADD_HANDLE,
    PLACED_ELEMENT,
}

private data class ElementDragState(
    val source: ElementDragSource,
    val elementType: ProductElementType,
    val label: String,
    val mapPosition: Offset,
    val rawMapPosition: Offset = mapPosition,
    val validDrop: Boolean = true,
    val elementId: String? = null,
    val rootPosition: Offset? = null,
)

@Composable
fun ProductElementPlacementScreen(
    generalTankInfo: ProductGeneralTankInfo,
    layoutMapSetup: ProductLayoutMapSetup,
    visibleTargets: List<ProductLayoutTarget>,
    state: ProductElementPlacementState,
    onStateChange: (ProductElementPlacementState) -> Unit,
    onBack: () -> Unit,
    onContinue: (ProductElementPlacementState) -> Unit,
    contentPadding: PaddingValues = PaddingValues(0.dp),
) {
    val selectedTarget = when {
        visibleTargets.isEmpty() -> ProductLayoutTarget.EXTERNAL_ROOF
        state.selectedTarget in visibleTargets -> state.selectedTarget
        else -> visibleTargets.first()
    }
    val availableElementTypes = ProductElementType.entries.filter { type -> type.supports(selectedTarget) }
    val activeElementType = availableElementTypes.firstOrNull { type -> type == state.selectedElementType }
        ?: availableElementTypes.firstOrNull()
        ?: ProductElementType.NOZZLE
    val selectedPlacements = state.placementsFor(selectedTarget)
    val selectedTargetApproved = selectedTarget in state.approvedTargets
    val latestState by rememberUpdatedState(state)
    val scrollState = rememberScrollState()
    var placementScopeExpanded by remember { mutableStateOf(false) }

    fun selectedTargetFor(placementState: ProductElementPlacementState): ProductLayoutTarget =
        when {
            visibleTargets.isEmpty() -> ProductLayoutTarget.EXTERNAL_ROOF
            placementState.selectedTarget in visibleTargets -> placementState.selectedTarget
            else -> visibleTargets.first()
        }

    fun nextTargetNeedingApproval(
        placementState: ProductElementPlacementState,
        fromTarget: ProductLayoutTarget,
    ): ProductLayoutTarget? {
        val selectedIndex = visibleTargets.indexOf(fromTarget).coerceAtLeast(0)
        val orderedTargets = visibleTargets.drop(selectedIndex + 1) + visibleTargets.take(selectedIndex)
        return orderedTargets.firstOrNull { target -> target !in placementState.approvedTargets }
    }

    fun approveOrContinue() {
        val actionState = latestState
        val actionSelectedTarget = selectedTargetFor(actionState)
        val actionSelectedTargetApproved = actionSelectedTarget in actionState.approvedTargets
        val approvedState = if (actionSelectedTargetApproved) {
            actionState
        } else {
            actionState
                .withSelectedTarget(actionSelectedTarget)
                .withTargetApproval(actionSelectedTarget, approved = true)
        }
        val nextUnapprovedTarget = nextTargetNeedingApproval(approvedState, actionSelectedTarget)
        if (nextUnapprovedTarget != null) {
            onStateChange(approvedState.withSelectedTarget(nextUnapprovedTarget))
        } else {
            onContinue(approvedState.withSelectedTarget(actionSelectedTarget))
        }
    }

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
                    bottom = ProductStickyActionBarHeight + 28.dp,
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
                ProductCollapsibleSectionCard(
                    title = "Placement Scope",
                    summary = "${selectedTarget.label} | ${selectedPlacements.size} placed | ${visibleTargets.size} layouts",
                    expanded = placementScopeExpanded,
                    onExpandedChange = { placementScopeExpanded = it },
                ) {
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
                    onRenameElement = { target, elementId, label ->
                        onStateChange(latestState.withRenamedElement(target, elementId, label))
                    },
                    onRemoveElement = { target, elementId ->
                        onStateChange(latestState.withRemovedElement(target, elementId))
                    },
                )

            }
        }

        if (visibleTargets.isNotEmpty()) {
            ProductStickyActionBar(
                primaryText = when {
                    !selectedTargetApproved && visibleTargets.any { target ->
                        target != selectedTarget && target !in state.approvedTargets
                    } -> "Approve & Next"
                    !selectedTargetApproved -> "Approve & Continue"
                    visibleTargets.any { target -> target !in state.approvedTargets } -> "Next Placement"
                    else -> "Continue"
                },
                onPrimaryClick = ::approveOrContinue,
                onSecondaryClick = onBack,
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }
    }
}

@Composable
private fun ElementPlacementWorkspace(
    selectedTarget: ProductLayoutTarget,
    layoutMapSetup: ProductLayoutMapSetup,
    selectedElementType: ProductElementType,
    selectedPlacements: List<ProductPlacedElement>,
    selectedElementId: String?,
    onSelectElementType: (ProductElementType) -> Unit,
    onSelectElement: (String?) -> Unit,
    onAddElement: (ProductLayoutTarget, ProductElementType, Float, Float) -> Unit,
    onMoveElement: (ProductLayoutTarget, String, Float, Float) -> Unit,
    onRenameElement: (ProductLayoutTarget, String, String) -> Unit,
    onRemoveElement: (ProductLayoutTarget, String) -> Unit,
) {
    val supportedElementTypes = ProductElementType.entries.filter { type -> type.supports(selectedTarget) }
    val selectedElement = selectedPlacements.firstOrNull { element -> element.id == selectedElementId }
    val density = LocalDensity.current
    val markerWidthPx = with(density) { 132.dp.toPx() }
    val markerHeightPx = with(density) { 74.dp.toPx() }
    val markerAnchorXpx = with(density) { 18.dp.toPx() }
    val markerAnchorYpx = with(density) { 56.dp.toPx() }
    val markerAnchorInsetPx = with(density) { 8.dp.toPx() }
    val mapEdgePaddingPx = with(density) { 16.dp.toPx() }
    val roofSurfaceMapSizePx = with(density) { 320.dp.toPx() }
    val roofSurfaceTopOffsetPx = with(density) { 58.dp.toPx() }
    val shellLabelWidthPx = with(density) { 46.dp.toPx() }
    val shellTopPaddingPx = with(density) { 26.dp.toPx() }
    val shellBottomPaddingPx = with(density) { 14.dp.toPx() }
    val shellRightPaddingPx = with(density) { 8.dp.toPx() }
    val shellCellGapPx = with(density) { 2.dp.toPx() }
    val placedDragStartThresholdPx = with(density) { 12.dp.toPx() }
    val tapGestureTolerancePx = with(density) { 20.dp.toPx() }
    val editModeDoubleTapMillis = 420L
    var mapSize by remember(selectedTarget) { mutableStateOf(Size.Zero) }
    var mapBoundsInRoot by remember(selectedTarget) { mutableStateOf<Rect?>(null) }
    var dragState by remember(selectedTarget) { mutableStateOf<ElementDragState?>(null) }
    var editMode by remember(selectedTarget) { mutableStateOf(false) }
    var lastElementTap by remember(selectedTarget) { mutableStateOf<Pair<String, Long>?>(null) }
    val editPulseTransition = rememberInfiniteTransition(label = "element-edit-pulse")
    val editMarkerAlpha by editPulseTransition.animateFloat(
        initialValue = 0.42f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 420),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "element-edit-alpha",
    )
    val latestSelectedElementId by rememberUpdatedState(selectedElementId)

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

    fun isInsidePlacementRegion(position: Offset, region: PlacementRegion? = placementRegion()): Boolean =
        region?.contains(position) ?: position.isInsideMap(mapSize, mapEdgePaddingPx)

    fun previewPlacementPosition(position: Offset, region: PlacementRegion? = placementRegion()): Offset =
        region?.coerce(position) ?: position.coerceInsideMap(mapSize, mapEdgePaddingPx)

    fun updateAddDrag(rootPosition: Offset) {
        val rawMapPosition = rootPositionToMapPosition(rootPosition)
        val activePlacementRegion = placementRegion()
        val validDrop = rawMapPosition?.let { position ->
            isInsidePlacementRegion(position, activePlacementRegion)
        } == true
        val previewPosition = rawMapPosition?.let { position ->
            if (validDrop) position else previewPlacementPosition(position, activePlacementRegion)
        } ?: Offset.Zero
        dragState = ElementDragState(
            source = ElementDragSource.ADD_HANDLE,
            elementType = selectedElementType,
            label = "New ${selectedElementType.shortLabel}",
            mapPosition = previewPosition,
            rawMapPosition = rawMapPosition ?: Offset.Zero,
            validDrop = validDrop,
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
                    val rawMapPosition = finalDragState.rawMapPosition
                    val droppedInsideLayout = finalDragState.validDrop &&
                        isInsidePlacementRegion(rawMapPosition, activePlacementRegion)
                    if (droppedInsideLayout) {
                        val normalized = normalizeMapPosition(
                            rawMapPosition,
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
                    val droppedInsideLayout = finalDragState.validDrop &&
                        isInsidePlacementRegion(finalDragState.rawMapPosition, activePlacementRegion)
                    if (elementId != null && droppedInsideLayout) {
                        val normalized = normalizeMapPosition(finalDragState.rawMapPosition, mapSize)
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
        subtitle = "Drag the selected icon onto the layout to add. Double-tap a placed callout to edit, rename, or move it.",
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
                        .pointerInput(selectedTarget, selectedPlacements, editMode, mapSize) {
                            awaitEachGesture {
                                val down = awaitFirstDown(requireUnconsumed = false)
                                if (mapSize.isUsable()) {
                                    val orderedPlacements = selectedPlacements.withSelectedElementOnTop(latestSelectedElementId)
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
                                            lastElementTap = null
                                        }
                                        return@awaitEachGesture
                                    }

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
                                        onSelectElement(hitElement.id)
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
                                                val rawPosition = initialDragState.mapPosition + totalDrag
                                                val activePlacementRegion = placementRegion()
                                                val validDrop = isInsidePlacementRegion(rawPosition, activePlacementRegion)
                                                dragState = initialDragState.copy(
                                                    mapPosition = if (validDrop) {
                                                        rawPosition
                                                    } else {
                                                        previewPlacementPosition(rawPosition, activePlacementRegion)
                                                    },
                                                    rawMapPosition = rawPosition,
                                                    validDrop = validDrop,
                                                    rootPosition = initialDragState.rootPosition?.let { rootPosition ->
                                                        rootPosition + totalDrag
                                                    },
                                                )
                                            } else if (dragStarted) {
                                                change.consume()
                                                val activeDrag = dragState
                                                if (activeDrag != null) {
                                                    val rawPosition = activeDrag.rawMapPosition + delta
                                                    val activePlacementRegion = placementRegion()
                                                    val validDrop = isInsidePlacementRegion(rawPosition, activePlacementRegion)
                                                    dragState = activeDrag.copy(
                                                        mapPosition = if (validDrop) {
                                                            rawPosition
                                                        } else {
                                                            previewPlacementPosition(rawPosition, activePlacementRegion)
                                                        },
                                                        rawMapPosition = rawPosition,
                                                        validDrop = validDrop,
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

                                    var totalDrag = Offset.Zero
                                    while (true) {
                                        val event = awaitPointerEvent()
                                        val change = event.changes.firstOrNull { pointer -> pointer.id == down.id } ?: break
                                        totalDrag += change.positionChange()
                                        if (!change.pressed) break
                                    }
                                    if (totalDrag.getDistance() < tapGestureTolerancePx) {
                                        val previousTap = lastElementTap
                                        val isDoubleTap = previousTap?.first == hitElement.id &&
                                            down.uptimeMillis - previousTap.second <= editModeDoubleTapMillis
                                        if (isDoubleTap) {
                                            lastElementTap = null
                                            editMode = true
                                        } else {
                                            lastElementTap = hitElement.id to down.uptimeMillis
                                        }
                                        onSelectElement(hitElement.id)
                                    } else {
                                        lastElementTap = null
                                    }
                                    dragState = null
                                    return@awaitEachGesture
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
                            val isEditSelected = editMode && element.id == selectedElementId
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
                                flipHorizontal = flipHorizontal,
                                modifier = Modifier.offset {
                                    markerOffset(
                                        center = center,
                                        markerAnchorXpx = anchorXpx,
                                        markerAnchorYpx = markerAnchorYpx,
                                    )
                                }.graphicsLayer {
                                    alpha = if (isEditSelected) editMarkerAlpha else 1f
                                    scaleX = if (isEditSelected) 1.08f else 1f
                                    scaleY = if (isEditSelected) 1.08f else 1f
                                },
                            )
                        }
                    }

                    dragState
                        ?.takeIf { activeDrag ->
                            activeDrag.source == ElementDragSource.PLACED_ELEMENT || activeDrag.validDrop
                        }
                        ?.let { activeDrag ->
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
                            flipHorizontal = flipHorizontal,
                            modifier = Modifier.offset {
                                markerOffset(
                                    center = activeDrag.mapPosition,
                                    markerAnchorXpx = anchorXpx,
                                    markerAnchorYpx = markerAnchorYpx,
                                )
                            }.graphicsLayer {
                                alpha = if (activeDrag.validDrop) 1f else 0.42f
                            },
                        )
                    }

                }
            }

            selectedElement
                ?.takeIf { editMode }
                ?.let { element ->
                    SelectedElementSummary(
                        target = selectedTarget,
                        element = element,
                        onRename = { label ->
                            onRenameElement(selectedTarget, element.id, label)
                        },
                        onRemove = {
                            onRemoveElement(selectedTarget, element.id)
                            editMode = false
                        },
                        modifier = Modifier.fillMaxWidth(),
                    )
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
    elementType: ProductElementType,
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
    element: ProductPlacedElement,
    selected: Boolean,
    flipHorizontal: Boolean,
    modifier: Modifier = Modifier,
) {
    ElementMarkerCallout(
        label = element.label,
        type = element.type,
        selected = selected,
        flipHorizontal = flipHorizontal,
        modifier = modifier,
    )
}

@Composable
private fun ElementMarkerCallout(
    label: String,
    type: ProductElementType,
    selected: Boolean,
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
    }
}

@Composable
private fun SelectedElementSummary(
    target: ProductLayoutTarget,
    element: ProductPlacedElement,
    onRename: (String) -> Unit,
    onRemove: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var draftLabel by remember(element.id, element.label) { mutableStateOf(element.label) }
    val trimmedLabel = draftLabel.trim()
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = Color.White,
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
        modifier = modifier,
    ) {
        ProductVoiceCaptureHost(
            screen = ProductWorkflowScreen.ELEMENT_PLACEMENT,
            modifier = Modifier.fillMaxWidth(),
            buttonAlignment = Alignment.TopEnd,
            compactButton = true,
            controlLevel = ProductVoiceControlLevel.LOCAL,
            cardKey = "element_edit",
            fieldKey = "element_note",
            targetKey = target.key,
            targetLabel = target.label,
            itemKey = element.id,
            itemLabel = element.label,
        ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                ElementGlyph(type = element.type)
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = "Edit Element",
                        style = MaterialTheme.typography.titleSmall,
                        color = LaiqColors.BodyText,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = "Type stays ${element.type.label}; name can be customized.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                }
            }
            LaiqTextField(
                value = draftLabel,
                onValueChange = { updated ->
                    draftLabel = updated
                    if (updated.trim().isNotBlank()) {
                        onRename(updated)
                    }
                },
                label = { Text("Element Name") },
                modifier = Modifier.fillMaxWidth(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                LaiqStatChip(
                    label = "Type",
                    value = element.type.label,
                    modifier = Modifier.weight(1f),
                )
                LaiqSecondaryButton(
                    text = "Remove",
                    onClick = onRemove,
                    modifier = Modifier.weight(1f),
                )
            }
            if (trimmedLabel.isBlank()) {
                Text(
                    text = "Element name cannot be blank.",
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.BrandRed,
                    fontWeight = FontWeight.Medium,
                )
            }
        }
        }
    }
}

@Composable
private fun ElementGlyph(
    type: ProductElementType,
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
    target: ProductLayoutTarget,
    layoutMapSetup: ProductLayoutMapSetup,
    modifier: Modifier = Modifier,
) {
    val customLayout = layoutMapSetup.customCircularLayoutFor(target)
    when (target.surface) {
        ProductLayoutSurface.ROOF -> RoofSurfaceMap(
            template = layoutMapSetup.roofPattern,
            rowCount = layoutMapSetup.roofRowCount.toPositiveInt(4),
            widestRowPlateCount = layoutMapSetup.roofWidestRowPlateCount.toPositiveInt(10),
            ringCount = layoutMapSetup.roofRingCount.toPositiveInt(3),
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
            annularReferenceAzimuthDeg = customLayout?.annularRotationDeg?.toDouble() ?: 0.0,
            customPlateCells = customLayout
                ?.normalizedFor(
                    layoutMapSetup.roofRowCount.toPositiveInt(4),
                    layoutMapSetup.roofWidestRowPlateCount.toPositiveInt(10),
                )
                ?.toRoofPlateCells(
                    target,
                    layoutMapSetup.roofRowCount.toPositiveInt(4),
                    layoutMapSetup.roofWidestRowPlateCount.toPositiveInt(10),
                ),
            referenceLabel = layoutMapSetup.referenceMode.label,
            mapTitle = "",
            modifier = modifier,
        )

        ProductLayoutSurface.FLOOR -> RoofSurfaceMap(
            template = RoofTemplate.CIRCULAR_PLATE,
            rowCount = layoutMapSetup.floorPatternCountX.toPositiveInt(4),
            widestRowPlateCount = layoutMapSetup.floorPatternCountY.toPositiveInt(12),
            ringCount = 0,
            sectorCount = 0,
            activePlateId = null,
            centerFeatureCount = 0,
            centerFeatureCountControlsLayout = false,
            useLeaderPlateLabels = false,
            showAnnularSectionLabels = layoutMapSetup.floorTemplate == ProductFloorTemplate.CIRCULAR_PLATE_WITH_AR,
            autoHideCrowdedPlateLabels = true,
            enablePlateTapSelection = false,
            showInteractionHint = false,
            onSelectPlate = {},
            hasAnnularRing = layoutMapSetup.floorTemplate == ProductFloorTemplate.CIRCULAR_PLATE_WITH_AR,
            annularSectionCount = if (layoutMapSetup.floorTemplate == ProductFloorTemplate.CIRCULAR_PLATE_WITH_AR) {
                layoutMapSetup.floorAnnularSectionCount.toPositiveInt(12)
            } else {
                0
            },
            annularReferenceAzimuthDeg = customLayout?.annularRotationDeg?.toDouble() ?: 0.0,
            customPlateCells = customLayout
                ?.normalizedFor(
                    layoutMapSetup.floorPatternCountX.toPositiveInt(4),
                    layoutMapSetup.floorPatternCountY.toPositiveInt(12),
                )
                ?.toRoofPlateCells(
                    target,
                    layoutMapSetup.floorPatternCountX.toPositiveInt(4),
                    layoutMapSetup.floorPatternCountY.toPositiveInt(12),
                ),
            referenceLabel = layoutMapSetup.referenceMode.label,
            mapTitle = "",
            modifier = modifier,
        )

        ProductLayoutSurface.SHELL -> ShellElementMapBackground(
            courseCount = layoutMapSetup.shellCourseCount.toPositiveInt(6),
            platesPerCourse = layoutMapSetup.shellPlatesPerCourse.toPositiveInt(12),
            offsetMode = layoutMapSetup.shellPlateOffset,
            offsetStartRow = layoutMapSetup.shellOffsetStartRow,
            thirdOffsetStart = layoutMapSetup.shellThirdOffsetStart,
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
    offsetStartRow: ProductShellOffsetStartRow,
    thirdOffsetStart: ProductShellThirdOffsetStart,
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
            val labelWidth = 46.dp.toPx()
            val topPadding = 26.dp.toPx()
            val bottomPadding = 14.dp.toPx()
            val rightPadding = 8.dp.toPx()
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
                offsetStartRow = offsetStartRow,
                thirdOffsetStart = thirdOffsetStart,
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
    target: ProductLayoutTarget,
    layoutMapSetup: ProductLayoutMapSetup,
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
        ProductLayoutSurface.ROOF,
        ProductLayoutSurface.FLOOR -> {
            val squareSize = min(mapSize.width, roofSurfaceMapSizePx)
            val squareLeft = ((mapSize.width - squareSize) / 2f).coerceAtLeast(0f)
            val squareTop = roofSurfaceTopOffsetPx
                .coerceIn(0f, (mapSize.height - squareSize).coerceAtLeast(0f))
            val hasAnnularRing = when (target.surface) {
                ProductLayoutSurface.ROOF -> layoutMapSetup.roofHasAnnularRing
                ProductLayoutSurface.FLOOR -> layoutMapSetup.floorTemplate == ProductFloorTemplate.CIRCULAR_PLATE_WITH_AR
                ProductLayoutSurface.SHELL -> false
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

        ProductLayoutSurface.SHELL -> {
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
    placements: List<ProductPlacedElement>,
    mapSize: Size,
    markerWidthPx: Float,
    markerHeightPx: Float,
    markerAnchorXpx: Float,
    markerAnchorYpx: Float,
    placementRegion: PlacementRegion? = null,
): ProductPlacedElement? =
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

private fun List<ProductPlacedElement>.withSelectedElementOnTop(selectedElementId: String?): List<ProductPlacedElement> {
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
    element: ProductPlacedElement,
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

private fun Offset.isInsideMap(
    mapSize: Size,
    paddingPx: Float,
): Boolean =
    mapSize.isUsable() &&
        x in paddingPx..(mapSize.width - paddingPx) &&
        y in paddingPx..(mapSize.height - paddingPx)

private fun Offset.distanceTo(other: Offset): Float =
    hypot(x - other.x, y - other.y)

private fun ProductElementType.swatchColor(): Color =
    when (this) {
        ProductElementType.NOZZLE -> LaiqColors.BrandTeal
        ProductElementType.MANHOLE -> Color(0xFF9B5A16)
        ProductElementType.STAIR -> Color(0xFF5A5EA7)
        ProductElementType.PLATFORM -> Color(0xFF2C7B72)
        ProductElementType.VENT -> Color(0xFF5176C5)
        ProductElementType.GAUGE_HATCH -> Color(0xFF8D4FB2)
        ProductElementType.ROOF_DRAIN -> Color(0xFF3F83B5)
        ProductElementType.SUPPORT -> Color(0xFF7C8A2E)
        ProductElementType.SUMP -> Color(0xFFB35B4D)
        ProductElementType.DATUM -> Color(0xFF6E7E90)
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
    offsetStartRow: ProductShellOffsetStartRow,
    thirdOffsetStart: ProductShellThirdOffsetStart,
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
            val courseNo = rows - rowIndex
            val offsetFraction = shellOffsetFraction(
                courseNo = courseNo,
                offsetMode = offsetMode,
                offsetStartRow = offsetStartRow,
                thirdOffsetStart = thirdOffsetStart,
            )
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

private fun shellOffsetFraction(
    courseNo: Int,
    offsetMode: String,
    offsetStartRow: ProductShellOffsetStartRow,
    thirdOffsetStart: ProductShellThirdOffsetStart,
): Float =
    when (offsetMode) {
        "third_plate" -> {
            val startStep = when (thirdOffsetStart) {
                ProductShellThirdOffsetStart.FULL -> 0
                ProductShellThirdOffsetStart.ONE_THIRD -> 1
                ProductShellThirdOffsetStart.TWO_THIRDS -> 2
            }
            ((startStep + courseNo - 1) % 3) / 3f
        }
        "half_plate" -> {
            val shouldOffset = when (offsetStartRow) {
                ProductShellOffsetStartRow.ODD -> courseNo % 2 == 1
                ProductShellOffsetStartRow.EVEN -> courseNo % 2 == 0
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

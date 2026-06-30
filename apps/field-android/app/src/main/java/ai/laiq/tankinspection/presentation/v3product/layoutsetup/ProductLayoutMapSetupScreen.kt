package ai.laiq.tankinspection.presentation.v3product.layoutsetup

import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqCountField
import ai.laiq.tankinspection.presentation.components.LaiqDropdownField
import ai.laiq.tankinspection.presentation.components.LaiqOptionChips
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.components.LaiqTextField
import ai.laiq.tankinspection.presentation.v3product.common.ProductCollapsibleSectionCard
import ai.laiq.tankinspection.presentation.v3product.common.ProductStickyActionBar
import ai.laiq.tankinspection.presentation.v3product.common.ProductStickyActionBarHeight
import ai.laiq.tankinspection.presentation.components.RoofSurfaceMap
import ai.laiq.tankinspection.presentation.v3product.common.canAdjustAdjacentPlateBoundary
import ai.laiq.tankinspection.presentation.v3product.common.canMergePlateHorizontally
import ai.laiq.tankinspection.presentation.v3product.common.crossRowMergeTarget
import ai.laiq.tankinspection.presentation.v3product.common.displayPlateLabelFor
import ai.laiq.tankinspection.presentation.v3product.common.generatedProductCircularPlateLayout
import ai.laiq.tankinspection.presentation.v3product.common.mergePlate
import ai.laiq.tankinspection.presentation.v3product.common.mergePlateAcrossRows
import ai.laiq.tankinspection.presentation.v3product.common.normalizedFor
import ai.laiq.tankinspection.presentation.v3product.common.plateRefs
import ai.laiq.tankinspection.presentation.v3product.common.rowGroupFor
import ai.laiq.tankinspection.presentation.v3product.common.rowHeightValueRange
import ai.laiq.tankinspection.presentation.v3product.common.splitPlate
import ai.laiq.tankinspection.presentation.v3product.common.toRoofPlateCells
import ai.laiq.tankinspection.presentation.v3product.common.verticalMergeGroupLabels
import ai.laiq.tankinspection.presentation.v3product.common.withAdjacentPlateBoundaryBias
import ai.laiq.tankinspection.presentation.v3product.common.withAnnularRotation
import ai.laiq.tankinspection.presentation.v3product.common.withRowHeight
import ai.laiq.tankinspection.presentation.v3product.common.withRowShift
import ai.laiq.tankinspection.v3product.model.ProductFloorTemplate
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularPlateLayout
import ai.laiq.tankinspection.v3product.model.ProductLayoutMapSetup
import ai.laiq.tankinspection.v3product.model.ProductLayoutSurface
import ai.laiq.tankinspection.v3product.model.ProductLayoutTarget
import ai.laiq.tankinspection.v3product.model.ProductReferenceMode
import ai.laiq.tankinspection.v3product.model.ProductShellOffsetStartRow
import ai.laiq.tankinspection.v3product.model.ProductShellThirdOffsetStart
import ai.laiq.tankinspection.v3product.model.customCircularLayoutFor
import ai.laiq.tankinspection.v3product.model.withTargetApproval
import ai.laiq.tankinspection.v3product.model.withCustomCircularLayout
import ai.laiq.tankinspection.v3product.model.withoutCustomCircularLayout
import ai.laiq.tankinspection.v3product.model.withoutTargetApproval
import ai.laiq.tankinspection.v3product.model.withRoofPatternDefaults
import ai.laiq.tankinspection.v3product.model.withSelectedTarget
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.sin

private val referenceModeOptions = listOf(
    ProductReferenceMode.TANK_NORTH.key to ProductReferenceMode.TANK_NORTH.label,
    ProductReferenceMode.TRUE_NORTH.key to ProductReferenceMode.TRUE_NORTH.label,
)

private val roofPatternOptions = listOf(
    RoofTemplate.CONE_RADIAL.name to "Cone Radial (single ring)",
    RoofTemplate.UMBRELLA_RADIAL.name to "Umbrella Radial (multi-ring)",
    RoofTemplate.CIRCULAR_PLATE.name to "Circular Plate",
)

private val yesNoOptions = listOf(
    "yes" to "Yes",
    "no" to "No",
)

private val floorTemplateOptions = listOf(
    ProductFloorTemplate.CIRCULAR_PLATE.key to ProductFloorTemplate.CIRCULAR_PLATE.label,
    ProductFloorTemplate.CIRCULAR_PLATE_WITH_AR.key to ProductFloorTemplate.CIRCULAR_PLATE_WITH_AR.label,
)

private val shellOffsetOptions = listOf(
    "aligned" to "Aligned",
    "third_plate" to "1/3",
    "half_plate" to "Half",
)

private val shellOffsetStartRowOptions = listOf(
    ProductShellOffsetStartRow.ODD.key to ProductShellOffsetStartRow.ODD.label,
    ProductShellOffsetStartRow.EVEN.key to ProductShellOffsetStartRow.EVEN.label,
)

private val shellThirdOffsetStartOptions = listOf(
    ProductShellThirdOffsetStart.FULL.key to "C1 Full",
    ProductShellThirdOffsetStart.ONE_THIRD.key to "C1 1/3",
    ProductShellThirdOffsetStart.TWO_THIRDS.key to "C1 2/3",
)

private data class ProductCircularLayoutUndo(
    val layout: ProductCustomCircularPlateLayout,
    val changesPlateIdentity: Boolean,
)

private enum class ProductLayoutTargetStatus {
    NOT_STARTED,
    EDITING,
    APPROVED,
}

private const val MAX_LAYOUT_ROWS = 24
private const val MAX_ROOF_RINGS = 24
private const val MAX_RADIAL_SECTORS = 72
private const val MAX_WIDEST_ROW_PLATES = 80
private const val MAX_ANNULAR_PLATES = 80
private const val MAX_SHELL_COURSES = 32
private const val MAX_SHELL_PLATES_PER_COURSE = 96
private const val MAX_SHELL_UT_LANES = 48

@Composable
fun ProductLayoutMapSetupScreen(
    state: ProductLayoutMapSetup,
    layoutTargets: List<ProductLayoutTarget>,
    tankLabel: String,
    roofLabel: String,
    onStateChange: (ProductLayoutMapSetup) -> Unit,
    onApproveLayout: (ProductLayoutMapSetup) -> Unit,
    onBack: () -> Unit,
    onContinue: (ProductLayoutMapSetup) -> Unit,
    contentPadding: PaddingValues = PaddingValues(0.dp),
    onCircularEditModeChange: (Boolean) -> Unit = {},
) {
    val visibleTargets = layoutTargets.ifEmpty { listOf(ProductLayoutTarget.EXTERNAL_ROOF) }
    fun selectedTargetFor(setup: ProductLayoutMapSetup): ProductLayoutTarget =
        if (setup.selectedTarget in visibleTargets) setup.selectedTarget else visibleTargets.first()

    val selectedTarget = selectedTargetFor(state)
    val selectedSurface = selectedTarget.surface
    val selectedValidationErrors = state.validationErrorsFor(selectedTarget)
    val selectedTargetApproved = selectedTarget in state.approvedTargets && selectedValidationErrors.isEmpty()
    val latestActionState by rememberUpdatedState(state)
    fun ProductLayoutTarget.needsApprovalIn(setup: ProductLayoutMapSetup): Boolean =
        this !in setup.approvedTargets || setup.validationErrorsFor(this).isNotEmpty()

    fun nextTargetNeedingApproval(
        setup: ProductLayoutMapSetup,
        fromTarget: ProductLayoutTarget,
    ): ProductLayoutTarget? {
        val selectedIndex = visibleTargets.indexOf(fromTarget).coerceAtLeast(0)
        val orderedTargets = visibleTargets.drop(selectedIndex + 1) + visibleTargets.take(selectedIndex)
        return orderedTargets.firstOrNull { target -> target.needsApprovalIn(setup) }
    }

    val nextTargetToApprove = nextTargetNeedingApproval(state, selectedTarget)
    val usesConeRoofPattern = state.roofPattern == RoofTemplate.CONE_RADIAL
    val usesUmbrellaRoofPattern = state.roofPattern == RoofTemplate.UMBRELLA_RADIAL
    val usesCircularRoofPattern = state.roofPattern == RoofTemplate.CIRCULAR_PLATE ||
        state.roofPattern == RoofTemplate.CIRCULAR_CENTER_OPENING
    fun updateCurrentTarget(updated: ProductLayoutMapSetup) {
        onStateChange(updated.withoutTargetApproval(selectedTarget))
    }

    fun approveOrContinue() {
        val actionState = latestActionState
        val actionSelectedTarget = selectedTargetFor(actionState)
        val actionValidationErrors = actionState.validationErrorsFor(actionSelectedTarget)
        val actionSelectedTargetApproved =
            actionSelectedTarget in actionState.approvedTargets && actionValidationErrors.isEmpty()
        if (!actionSelectedTargetApproved) {
            if (actionValidationErrors.isNotEmpty()) return
            onApproveLayout(
                actionState
                    .withSelectedTarget(actionSelectedTarget)
                    .withTargetApproval(actionSelectedTarget, approved = true),
            )
            return
        }

        val nextTarget = nextTargetNeedingApproval(actionState, actionSelectedTarget)
        if (nextTarget != null) {
            onStateChange(actionState.withSelectedTarget(nextTarget))
        } else {
            onContinue(actionState.withSelectedTarget(actionSelectedTarget))
        }
    }

    var generalInfoExpanded by remember { mutableStateOf(false) }
    var circularEditTarget by remember { mutableStateOf<ProductLayoutTarget?>(null) }
    val circularEditMode = circularEditTarget == selectedTarget &&
        selectedSurface != ProductLayoutSurface.SHELL
    LaunchedEffect(circularEditMode) {
        onCircularEditModeChange(circularEditMode)
    }

    Box(modifier = Modifier.fillMaxSize()) {
        if (circularEditMode) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(
                        start = 12.dp,
                        end = 12.dp,
                        top = contentPadding.calculateTopPadding() + 8.dp,
                        bottom = 12.dp,
                    ),
            ) {
                when (selectedSurface) {
                    ProductLayoutSurface.ROOF -> {
                        RoofLayoutPreviewPanel(
                            state = state,
                            target = selectedTarget,
                            referenceMode = state.referenceMode,
                            onStateChange = onStateChange,
                            editModeOverride = true,
                            onEditModeChange = { editMode ->
                                if (!editMode) circularEditTarget = null
                            },
                            modifier = Modifier.fillMaxSize(),
                        )
                    }

                    ProductLayoutSurface.FLOOR -> {
                        FloorLayoutPreviewPanel(
                            target = selectedTarget,
                            template = state.floorTemplate,
                            rowCount = state.floorPatternCountX.toPositiveInt(6),
                            widestRowPlateCount = state.floorPatternCountY.toPositiveInt(12),
                            annularSectionCount = state.floorAnnularSectionCount.toPositiveInt(12),
                            referenceMode = state.referenceMode,
                            state = state,
                            onStateChange = onStateChange,
                            editModeOverride = true,
                            onEditModeChange = { editMode ->
                                if (!editMode) circularEditTarget = null
                            },
                            modifier = Modifier.fillMaxSize(),
                        )
                    }

                    ProductLayoutSurface.SHELL -> Unit
                }
            }
        } else {
            Column(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(
                        start = 16.dp,
                        end = 16.dp,
                        top = contentPadding.calculateTopPadding() + 12.dp,
                    ),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text(
                    "Layout Map Setup",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = LaiqColors.BrandTeal,
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
                Surface(
                    color = Color.White.copy(alpha = 0.98f),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    ProductCollapsibleSectionCard(
                        title = "Tank Reference",
                        summary = "Tank $tankLabel | Roof $roofLabel | 0° ${state.referenceMode.label}",
                        expanded = generalInfoExpanded,
                        onExpandedChange = { generalInfoExpanded = it },
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            LaiqStatChip("Tank", tankLabel, modifier = Modifier.weight(1f))
                            LaiqStatChip("Roof", roofLabel, modifier = Modifier.weight(1f))
                        }
                        LaiqDropdownField(
                            label = "0° Reference",
                            value = state.referenceMode.key,
                            options = referenceModeOptions,
                            onSelected = { selected ->
                                onStateChange(
                                    state.copy(
                                        referenceMode = ProductReferenceMode.entries.first { option -> option.key == selected },
                                        approvedTargets = emptySet(),
                                    ),
                                )
                            },
                        )
                        if (state.referenceMode == ProductReferenceMode.TANK_NORTH) {
                            LaiqTextField(
                                value = state.referenceNote,
                                onValueChange = {
                                    onStateChange(state.copy(referenceNote = it, approvedTargets = emptySet()))
                                },
                                label = { Text("Tank North Note") },
                                singleLine = false,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(108.dp),
                            )
                        }
                    }
                }
                LayoutTargetStatusTabs(
                    targets = visibleTargets,
                    selectedTarget = selectedTarget,
                    approvedTargets = state.approvedTargets,
                    validationErrorsFor = { target -> state.validationErrorsFor(target) },
                    onSelect = { target -> onStateChange(state.withSelectedTarget(target)) },
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
            }

            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentPadding = PaddingValues(
                    start = 16.dp,
                    end = 16.dp,
                    top = 12.dp,
                    bottom = ProductStickyActionBarHeight + 28.dp,
                ),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
            item {
                LaiqSectionCard(title = "${selectedTarget.label} Layout") {
                when (selectedSurface) {
                    ProductLayoutSurface.ROOF -> {
                        RoofLayoutPreviewPanel(
                            state = state,
                            target = selectedTarget,
                            referenceMode = state.referenceMode,
                            onStateChange = onStateChange,
                            editModeOverride = false,
                            onEditModeChange = { editMode ->
                                if (editMode) circularEditTarget = selectedTarget
                            },
                        )
                        SurfaceSubsection(title = "Roof Setup") {
                            LaiqStatChip(
                                label = "Roof Scope",
                                value = selectedTarget.label,
                                modifier = Modifier.fillMaxWidth(),
                            )
                            LaiqDropdownField(
                                label = "Roof Pattern",
                                value = state.roofPattern.name,
	                                options = roofPatternOptions,
	                                onSelected = { selected ->
	                                    updateCurrentTarget(
	                                        state.withRoofPatternDefaults(RoofTemplate.valueOf(selected)),
	                                    )
	                                },
                            )
                            TwoUpFields(
                                left = {
                                    RoofOptionChips(
                                        label = "Center Opening",
                                        selected = state.roofHasCenterOpening,
                                        onSelect = { selected ->
                                            updateCurrentTarget(
                                                state.copy(
                                                    roofHasCenterOpening = selected,
                                                    roofCenterOpeningPlateCount = "1",
                                                ),
                                            )
                                        },
                                    )
                                },
                                right = {
                                    RoofOptionChips(
                                        label = "Annular Ring",
                                        selected = state.roofHasAnnularRing,
                                        onSelect = { selected ->
                                            updateCurrentTarget(
                                                state.copy(
                                                    roofHasAnnularRing = selected,
                                                    roofAnnularSectionCount = if (selected) {
                                                        state.roofAnnularSectionCount.ifBlank { "12" }
                                                    } else {
                                                        state.roofAnnularSectionCount
                                                    },
                                                ),
                                            )
                                        },
                                    )
                                },
                            )
                        }
                        SurfaceSubsection(title = "Roof Counts") {
                            if (usesConeRoofPattern) {
                                LaiqCountField(
                                    label = "Radial Sector Count",
                                    value = state.roofSectorCount,
                                    onValueChange = {
                                        updateCurrentTarget(state.copy(roofSectorCount = it))
                                    },
                                    min = 4,
                                    max = MAX_RADIAL_SECTORS,
                                )
                            } else if (usesUmbrellaRoofPattern) {
                                TwoUpFields(
                                    left = {
                                        LaiqCountField(
                                            label = "Plate Ring Count",
                                            value = state.roofRingCount,
                                            onValueChange = {
                                                updateCurrentTarget(state.copy(roofRingCount = it))
                                            },
                                            min = 1,
                                            max = MAX_ROOF_RINGS,
                                        )
                                    },
                                    right = {
                                        LaiqCountField(
                                            label = "Radial Sector Count",
                                            value = state.roofSectorCount,
                                            onValueChange = {
                                                updateCurrentTarget(state.copy(roofSectorCount = it))
                                            },
                                            min = 4,
                                            max = MAX_RADIAL_SECTORS,
                                        )
                                    },
                                )
                            } else if (usesCircularRoofPattern) {
                                TwoUpFields(
                                    left = {
                                        LaiqCountField(
                                            label = "Horizontal Rows",
                                            value = state.roofRowCount,
                                            onValueChange = {
                                                updateCurrentTarget(
                                                    state.withoutCustomCircularLayout(selectedTarget).copy(roofRowCount = it),
                                                )
                                            },
                                            min = 1,
                                            max = MAX_LAYOUT_ROWS,
                                        )
                                    },
                                    right = {
                                        LaiqCountField(
                                            label = "Widest Columns",
                                            value = state.roofWidestRowPlateCount,
                                            onValueChange = {
                                                updateCurrentTarget(
                                                    state.withoutCustomCircularLayout(selectedTarget).copy(roofWidestRowPlateCount = it),
                                                )
                                            },
                                            min = 4,
                                            max = MAX_WIDEST_ROW_PLATES,
                                        )
                                    },
                                )
                            }
                            if (state.roofHasCenterOpening) {
                                LaiqStatChip(
                                    label = "Center Opening",
                                    value = "1 default",
                                    modifier = Modifier.fillMaxWidth(),
                                )
                            }
                            if (state.roofHasAnnularRing) {
                                LaiqCountField(
                                    label = "Annular Ring Plates",
                                    value = state.roofAnnularSectionCount,
                                    onValueChange = {
                                        updateCurrentTarget(state.copy(roofAnnularSectionCount = it))
                                    },
                                    min = 4,
                                    max = MAX_ANNULAR_PLATES,
                                )
                            }
                        }
                    }

                    ProductLayoutSurface.SHELL -> {
                        ShellPlateLayoutPreviewPanel(
                            courseCount = state.shellCourseCount.toPositiveInt(6),
                            platesPerCourse = state.shellPlatesPerCourse.toPositiveInt(12),
                            offsetMode = state.shellPlateOffset,
                            offsetStartRow = state.shellOffsetStartRow,
                            thirdOffsetStart = state.shellThirdOffsetStart,
                            laneCount = state.shellLaneCount.toPositiveInt(4),
                            selectedLaneIndex = state.selectedShellLaneIndex,
                            selectedPlateId = state.selectedShellPlateId,
                            onSelectLane = { laneIndex ->
                                onStateChange(state.copy(selectedShellLaneIndex = laneIndex))
                            },
                            onSelectPlate = { plateId ->
                                onStateChange(state.copy(selectedShellPlateId = plateId))
                            },
                            referenceMode = state.referenceMode,
                        )
                        SurfaceSubsection(title = "Shell Setup") {
                            TwoUpFields(
                                left = {
                                    LaiqCountField(
                                        label = "Course Count",
                                        value = state.shellCourseCount,
                                        onValueChange = {
                                            updateCurrentTarget(state.copy(shellCourseCount = it))
                                        },
                                        min = 1,
                                        max = MAX_SHELL_COURSES,
                                    )
                                },
                                right = {
                                    LaiqCountField(
                                        label = "Plates / Course",
                                        value = state.shellPlatesPerCourse,
                                        onValueChange = {
                                            updateCurrentTarget(state.copy(shellPlatesPerCourse = it))
                                        },
                                        min = 1,
                                        max = MAX_SHELL_PLATES_PER_COURSE,
                                    )
                                },
                            )
                            LaiqCountField(
                                label = "UT Lane Count",
                                value = state.shellLaneCount,
                                onValueChange = {
                                    updateCurrentTarget(state.copy(shellLaneCount = it))
                                },
                                min = 1,
                                max = MAX_SHELL_UT_LANES,
                            )
                            Text(
                                text = "Offset Amount",
                                style = MaterialTheme.typography.labelLarge,
                                color = LaiqColors.BodyText,
                                fontWeight = FontWeight.SemiBold,
                            )
                            LaiqOptionChips(
                                selectedValue = state.shellPlateOffset,
                                options = shellOffsetOptions,
                                onSelect = {
                                    updateCurrentTarget(state.copy(shellPlateOffset = it))
                                },
                            )
                            if (state.shellPlateOffset == "third_plate") {
                                Text(
                                    text = "Course 1 Start",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = LaiqColors.BodyText,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                LaiqOptionChips(
                                    selectedValue = state.shellThirdOffsetStart.key,
                                    options = shellThirdOffsetStartOptions,
                                    onSelect = { selected ->
                                        updateCurrentTarget(
                                            state.copy(
                                                shellThirdOffsetStart = ProductShellThirdOffsetStart.entries.first { option ->
                                                    option.key == selected
                                                },
                                            ),
                                        )
                                    },
                                )
                            } else if (state.shellPlateOffset == "half_plate") {
                                Text(
                                    text = "Offset Courses",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = LaiqColors.BodyText,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                LaiqOptionChips(
                                    selectedValue = state.shellOffsetStartRow.key,
                                    options = shellOffsetStartRowOptions,
                                    onSelect = { selected ->
                                        updateCurrentTarget(
                                            state.copy(
                                                shellOffsetStartRow = ProductShellOffsetStartRow.entries.first { option ->
                                                    option.key == selected
                                                },
                                            ),
                                        )
                                    },
                                )
                            }
                        }
                    }

                    ProductLayoutSurface.FLOOR -> {
                        FloorLayoutPreviewPanel(
                            target = selectedTarget,
                            template = state.floorTemplate,
                            rowCount = state.floorPatternCountX.toPositiveInt(6),
                            widestRowPlateCount = state.floorPatternCountY.toPositiveInt(12),
                            annularSectionCount = state.floorAnnularSectionCount.toPositiveInt(12),
                            referenceMode = state.referenceMode,
                            state = state,
                            onStateChange = onStateChange,
                            editModeOverride = false,
                            onEditModeChange = { editMode ->
                                if (editMode) circularEditTarget = selectedTarget
                            },
                        )
                        SurfaceSubsection(title = "Floor Setup") {
                            LaiqDropdownField(
                                label = "Floor Pattern",
                                value = state.floorTemplate.key,
                                options = floorTemplateOptions,
                                onSelected = { selectedKey ->
                                    updateCurrentTarget(
                                        state.withoutCustomCircularLayout(selectedTarget).copy(
                                            floorTemplate = ProductFloorTemplate.entries.first { option ->
                                                option.key == selectedKey
                                            },
                                        ),
                                    )
                                },
                            )
                            TwoUpFields(
                                left = {
                                    LaiqCountField(
                                        label = "Horizontal Rows",
                                        value = state.floorPatternCountX,
                                        onValueChange = {
                                            updateCurrentTarget(
                                                state.withoutCustomCircularLayout(selectedTarget).copy(floorPatternCountX = it),
                                            )
                                        },
                                        min = 1,
                                        max = MAX_LAYOUT_ROWS,
                                    )
                                },
                                right = {
                                    LaiqCountField(
                                        label = "Widest Columns",
                                        value = state.floorPatternCountY,
                                        onValueChange = {
                                            updateCurrentTarget(
                                                state.withoutCustomCircularLayout(selectedTarget).copy(floorPatternCountY = it),
                                            )
                                        },
                                        min = 4,
                                        max = MAX_WIDEST_ROW_PLATES,
                                    )
                                },
                            )
                            if (state.floorTemplate == ProductFloorTemplate.CIRCULAR_PLATE_WITH_AR) {
                                LaiqCountField(
                                    label = "Annular Ring Plates",
                                    value = state.floorAnnularSectionCount,
                                    onValueChange = {
                                        updateCurrentTarget(state.copy(floorAnnularSectionCount = it))
                                    },
                                    min = 4,
                                    max = MAX_ANNULAR_PLATES,
                                )
                            }
                        }
                    }
                }
            }
        }

            if (selectedValidationErrors.isNotEmpty()) {
                item {
                    LayoutValidationPanel(selectedValidationErrors)
                }
            }
        }
        }

        ProductStickyActionBar(
            primaryText = when {
                !selectedTargetApproved -> "Approve Layout"
                nextTargetToApprove != null -> "Next Layout"
                else -> "Continue"
            },
            onPrimaryClick = { approveOrContinue() },
            primaryEnabled = selectedTargetApproved || selectedValidationErrors.isEmpty(),
            onSecondaryClick = onBack,
            modifier = Modifier.align(Alignment.BottomCenter),
        )
        }
    }
}

@Composable
private fun LayoutTargetStatusTabs(
    targets: List<ProductLayoutTarget>,
    selectedTarget: ProductLayoutTarget,
    approvedTargets: Set<ProductLayoutTarget>,
    validationErrorsFor: (ProductLayoutTarget) -> List<String>,
    onSelect: (ProductLayoutTarget) -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        color = Color.White.copy(alpha = 0.98f),
        shadowElevation = 4.dp,
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
        modifier = modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            targets.forEach { target ->
                val status = when {
                    target in approvedTargets && validationErrorsFor(target).isEmpty() -> ProductLayoutTargetStatus.APPROVED
                    target == selectedTarget -> ProductLayoutTargetStatus.EDITING
                    else -> ProductLayoutTargetStatus.NOT_STARTED
                }
                Surface(
                    onClick = { onSelect(target) },
                    shape = RoundedCornerShape(16.dp),
                    color = if (target == selectedTarget) {
                        LaiqColors.SurfaceTint
                    } else {
                        Color.White
                    },
                    border = BorderStroke(
                        1.dp,
                        if (target == selectedTarget) LaiqColors.BrandTeal else LaiqColors.PanelBorder,
                    ),
                    modifier = Modifier.weight(1f),
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 9.dp),
                        horizontalArrangement = Arrangement.spacedBy(7.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = status.dotColor(),
                            modifier = Modifier.size(9.dp),
                        ) {}
                        Text(
                            text = target.label,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = if (target == selectedTarget) FontWeight.SemiBold else FontWeight.Medium,
                            color = LaiqColors.BodyText,
                        )
                    }
                }
            }
        }
    }
}

private fun ProductLayoutTargetStatus.dotColor(): Color =
    when (this) {
        ProductLayoutTargetStatus.NOT_STARTED -> Color.Black
        ProductLayoutTargetStatus.EDITING -> Color(0xFFF2C94C)
        ProductLayoutTargetStatus.APPROVED -> Color(0xFF1FA463)
    }

@Composable
private fun LayoutValidationPanel(errors: List<String>) {
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = LaiqColors.BrandRed.copy(alpha = 0.08f),
        border = BorderStroke(1.dp, LaiqColors.BrandRed.copy(alpha = 0.34f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                text = "Fix before approval",
                style = MaterialTheme.typography.titleSmall,
                color = LaiqColors.BrandRed,
                fontWeight = FontWeight.SemiBold,
            )
            errors.forEach { error ->
                Text(
                    text = "- $error",
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.BodyText,
                )
            }
        }
    }
}

private fun ProductLayoutMapSetup.validationErrorsFor(target: ProductLayoutTarget): List<String> =
    mutableListOf<String>().apply {
        when (target.surface) {
            ProductLayoutSurface.ROOF -> {
                when (roofPattern) {
                    RoofTemplate.CONE_RADIAL -> {
                        requireCount("Radial sector count", roofSectorCount, min = 4, max = MAX_RADIAL_SECTORS)
                    }
                    RoofTemplate.UMBRELLA_RADIAL -> {
                        requireCount("Plate ring count", roofRingCount, min = 1, max = MAX_ROOF_RINGS)
                        requireCount("Radial sector count", roofSectorCount, min = 4, max = MAX_RADIAL_SECTORS)
                    }
                    RoofTemplate.CIRCULAR_PLATE,
                    RoofTemplate.CIRCULAR_CENTER_OPENING -> {
                        requireCount("Horizontal rows", roofRowCount, min = 1, max = MAX_LAYOUT_ROWS)
                        requireCount("Widest columns", roofWidestRowPlateCount, min = 4, max = MAX_WIDEST_ROW_PLATES)
                    }
                }
                if (roofHasAnnularRing) {
                    requireCount("Annular ring plates", roofAnnularSectionCount, min = 4, max = MAX_ANNULAR_PLATES)
                }
            }
            ProductLayoutSurface.SHELL -> {
                requireCount("Course count", shellCourseCount, min = 1, max = MAX_SHELL_COURSES)
                requireCount("Plates per course", shellPlatesPerCourse, min = 1, max = MAX_SHELL_PLATES_PER_COURSE)
                requireCount("UT lane count", shellLaneCount, min = 1, max = MAX_SHELL_UT_LANES)
            }
            ProductLayoutSurface.FLOOR -> {
                requireCount("Horizontal rows", floorPatternCountX, min = 1, max = MAX_LAYOUT_ROWS)
                requireCount("Widest columns", floorPatternCountY, min = 4, max = MAX_WIDEST_ROW_PLATES)
                if (floorTemplate == ProductFloorTemplate.CIRCULAR_PLATE_WITH_AR) {
                    requireCount("Annular ring plates", floorAnnularSectionCount, min = 4, max = MAX_ANNULAR_PLATES)
                }
            }
        }
    }

private fun MutableList<String>.requireCount(
    label: String,
    value: String,
    min: Int,
    max: Int,
) {
    val parsed = value.toIntOrNull()
    if (parsed == null || parsed !in min..max) {
        add("$label must be $min-$max.")
    }
}

@Composable
private fun SurfaceSubsection(
    title: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(22.dp),
        color = LaiqColors.SurfaceTint,
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            content = {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = LaiqColors.BrandTeal,
                )
                content()
            },
        )
    }
}

@Composable
private fun RoofOptionChips(
    label: String,
    selected: Boolean,
    onSelect: (Boolean) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            label,
            style = MaterialTheme.typography.labelLarge,
            color = LaiqColors.BodyText,
            fontWeight = FontWeight.Medium,
        )
        LaiqOptionChips(
            selectedValue = if (selected) "yes" else "no",
            options = yesNoOptions,
            onSelect = { value -> onSelect(value == "yes") },
        )
    }
}

@Composable
private fun RoofLayoutPreviewPanel(
    state: ProductLayoutMapSetup,
    target: ProductLayoutTarget,
    referenceMode: ProductReferenceMode,
    onStateChange: (ProductLayoutMapSetup) -> Unit,
    modifier: Modifier = Modifier,
    editModeOverride: Boolean? = null,
    onEditModeChange: (Boolean) -> Unit = {},
) {
    val rowCount = state.roofRowCount.toPositiveInt(4)
    val widestRowPlateCount = state.roofWidestRowPlateCount.toPositiveInt(10)
    val ringCount = state.roofRingCount.toPositiveInt(3)
    val sectorCount = state.roofSectorCount.toPositiveInt(20)
    val supportsCustomCircular = state.roofPattern == RoofTemplate.CIRCULAR_PLATE ||
        state.roofPattern == RoofTemplate.CIRCULAR_CENTER_OPENING
    val customLayout = if (supportsCustomCircular) {
        state.customCircularLayoutFor(target)?.normalizedFor(rowCount, widestRowPlateCount)
    } else {
        null
    }
    val customPlateCells = customLayout?.toRoofPlateCells(target, rowCount, widestRowPlateCount)
    var internalEditMode by remember(target, rowCount, widestRowPlateCount) { mutableStateOf(false) }
    val editMode = editModeOverride ?: internalEditMode
    fun setEditMode(enabled: Boolean) {
        if (editModeOverride == null) {
            internalEditMode = enabled
        } else {
            onEditModeChange(enabled)
        }
    }
    val editHistory = remember(target, rowCount, widestRowPlateCount) {
        mutableStateListOf<ProductCircularLayoutUndo>()
    }
    var selectedPlateId by remember(
        state.roofPattern,
        ringCount,
        sectorCount,
        rowCount,
        widestRowPlateCount,
    ) {
        mutableStateOf<String?>(null)
    }
    fun currentCircularLayout(): ProductCustomCircularPlateLayout =
        state.customCircularLayoutFor(target)
            ?.normalizedFor(rowCount, widestRowPlateCount)
            ?: generatedProductCircularPlateLayout(rowCount, widestRowPlateCount)

    fun applyCircularLayoutChange(
        layout: ProductCustomCircularPlateLayout,
        changesPlateIdentity: Boolean,
        undoCheckpoint: ProductCustomCircularPlateLayout? = null,
    ) {
        val undoLayout = undoCheckpoint ?: currentCircularLayout()
        if (layout != undoLayout) {
            if (editHistory.lastOrNull()?.layout != undoLayout) {
                if (editHistory.size >= 20) editHistory.removeAt(0)
                editHistory.add(ProductCircularLayoutUndo(undoLayout, changesPlateIdentity))
            }
        }
        if (changesPlateIdentity) {
            onStateChange(state.withCustomCircularLayout(target, layout))
        } else {
            onStateChange(
                state.copy(
                    customCircularLayoutsByTarget = state.customCircularLayoutsByTarget + (target to layout),
                ),
            )
        }
    }

    fun previewCircularLayoutChange(layout: ProductCustomCircularPlateLayout) {
        onStateChange(
            state.copy(
                customCircularLayoutsByTarget = state.customCircularLayoutsByTarget + (target to layout),
            ),
        )
    }

    fun undoCircularLayoutChange() {
        if (editHistory.isEmpty()) return
        val undo = editHistory.removeAt(editHistory.lastIndex)
        selectedPlateId = null
        if (undo.changesPlateIdentity) {
            onStateChange(state.withCustomCircularLayout(target, undo.layout))
        } else {
            onStateChange(
                state.copy(
                    customCircularLayoutsByTarget = state.customCircularLayoutsByTarget + (target to undo.layout),
                ),
            )
        }
    }

    fun enterEditMode() {
        if (!supportsCustomCircular) return
        selectedPlateId = null
        editHistory.clear()
        setEditMode(true)
    }
    Surface(
        shape = RoundedCornerShape(24.dp),
        color = LaiqColors.SurfaceTint,
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
        modifier = modifier.fillMaxWidth(),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(if (editMode) 10.dp else 18.dp)
                .then(if (editMode) Modifier.fillMaxSize() else Modifier.height(560.dp))
                .pointerInput(target, customLayout, supportsCustomCircular) {
                    detectTapGestures(
                        onDoubleTap = {
                            if (supportsCustomCircular) enterEditMode()
                        },
                    )
                },
        ) {
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(if (editMode) 8.dp else 10.dp),
            ) {
                if (editMode) {
                    CustomCircularLayoutEditCard(
                        target = target,
                        layout = state.customCircularLayoutFor(target)
                            ?.normalizedFor(rowCount, widestRowPlateCount)
                            ?: generatedProductCircularPlateLayout(rowCount, widestRowPlateCount),
                        selectedPlateId = selectedPlateId,
                        hasAnnularRing = state.roofHasAnnularRing,
                        rowCount = rowCount,
                        widestRowPlateCount = widestRowPlateCount,
                        onSelectedPlateChange = { selectedPlateId = it },
                        onLayoutPreviewChange = { layout ->
                            previewCircularLayoutChange(layout)
                        },
                        onLayoutChange = { layout, changesPlateIdentity, undoCheckpoint ->
                            applyCircularLayoutChange(layout, changesPlateIdentity, undoCheckpoint)
                        },
                        onRegenerateBase = { rows, widest ->
                            selectedPlateId = null
                            editHistory.clear()
                            onStateChange(
                                state.copy(
                                    roofRowCount = rows.toString(),
                                    roofWidestRowPlateCount = widest.toString(),
                                    customCircularLayoutsByTarget = state.customCircularLayoutsByTarget +
                                        (target to generatedProductCircularPlateLayout(rows, widest)),
                                ).withoutTargetApproval(target),
                            )
                        },
                        canUndo = editHistory.isNotEmpty(),
                        onUndo = { undoCircularLayoutChange() },
                        onDone = { setEditMode(false) },
                    )
                }
                if (!editMode) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = if (customLayout != null) "Custom circular layout" else "Generated circular layout",
                            style = MaterialTheme.typography.labelLarge,
                            color = LaiqColors.MutedText,
                        )
                        if (supportsCustomCircular) {
                            TextButton(onClick = { enterEditMode() }) {
                                Text("Edit")
                            }
                        }
                    }
                }
                ZoomableLayoutMapViewport(
                    resetKey = listOf(
                        target.key,
                        state.roofPattern.name,
                        rowCount,
                        widestRowPlateCount,
                        ringCount,
                        sectorCount,
                        state.roofHasAnnularRing,
                        state.roofAnnularSectionCount,
                        customLayout,
                    ).joinToString("|"),
                    modifier = Modifier
                        .align(Alignment.CenterHorizontally)
                        .fillMaxWidth(if (editMode) 1f else 0.9f)
                        .then(if (editMode) Modifier.weight(1f) else Modifier.height(378.dp)),
                ) { mapZoom, mapPan ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .graphicsLayer {
                                scaleX = mapZoom
                                scaleY = mapZoom
                                translationX = mapPan.x
                                translationY = mapPan.y
                                transformOrigin = TransformOrigin(0f, 0f)
                            },
                    ) {
                        RoofSurfaceMap(
                            template = state.roofPattern,
                            rowCount = rowCount,
                            widestRowPlateCount = widestRowPlateCount,
                            ringCount = ringCount,
                            sectorCount = sectorCount,
                            activePlateId = selectedPlateId,
                            overlayPlateIds = if (editMode) {
                                currentCircularLayout().verticalMergeGroupLabels(target, selectedPlateId)
                            } else {
                                emptySet()
                            },
                            centerFeatureCount = if (state.roofHasCenterOpening) {
                                1
                            } else {
                                0
                            },
                            centerFeatureCountControlsLayout = true,
                            useLeaderPlateLabels = false,
                            showAnnularSectionLabels = false,
                            autoHideCrowdedPlateLabels = true,
                            enablePlateTapSelection = true,
                            hasAnnularRing = state.roofHasAnnularRing,
                            annularSectionCount = if (state.roofHasAnnularRing) {
                                state.roofAnnularSectionCount.toPositiveInt(12)
                            } else {
                                0
                            },
                            annularReferenceAzimuthDeg = customLayout?.annularRotationDeg?.toDouble() ?: 0.0,
                            customPlateCells = customPlateCells,
                            referenceLabel = referenceMode.label,
                            mapTitle = "Roof Layout Map",
                            showInteractionHint = !editMode,
                            maxMapSize = if (editMode) 720.dp else 320.dp,
                            onSelectPlate = { plateId ->
                                selectedPlateId = plateId
                            },
                            modifier = Modifier.fillMaxSize(),
                        )
                    }
                }
            }
            if (!editMode) selectedPlateId?.let { plateId ->
                val displayLabel = currentCircularLayout().displayPlateLabelFor(target, plateId) ?: plateId
                SelectedPlateChip(
                    text = "Selected plate: $displayLabel",
                    modifier = Modifier.align(Alignment.BottomStart),
                )
            }
        }
    }
}

@Composable
private fun FloorLayoutPreviewPanel(
    target: ProductLayoutTarget,
    template: ProductFloorTemplate,
    rowCount: Int,
    widestRowPlateCount: Int,
    annularSectionCount: Int,
    referenceMode: ProductReferenceMode,
    state: ProductLayoutMapSetup,
    onStateChange: (ProductLayoutMapSetup) -> Unit,
    modifier: Modifier = Modifier,
    editModeOverride: Boolean? = null,
    onEditModeChange: (Boolean) -> Unit = {},
) {
    val customLayout = state.customCircularLayoutFor(target)?.normalizedFor(rowCount, widestRowPlateCount)
    val customPlateCells = customLayout?.toRoofPlateCells(target, rowCount, widestRowPlateCount)
    var internalEditMode by remember(target, rowCount, widestRowPlateCount) { mutableStateOf(false) }
    val editMode = editModeOverride ?: internalEditMode
    fun setEditMode(enabled: Boolean) {
        if (editModeOverride == null) {
            internalEditMode = enabled
        } else {
            onEditModeChange(enabled)
        }
    }
    val editHistory = remember(target, rowCount, widestRowPlateCount) {
        mutableStateListOf<ProductCircularLayoutUndo>()
    }
    var selectedPlateId by remember(template, rowCount, widestRowPlateCount, annularSectionCount) {
        mutableStateOf<String?>(null)
    }
    val hasAnnularRing = template == ProductFloorTemplate.CIRCULAR_PLATE_WITH_AR
    fun currentCircularLayout(): ProductCustomCircularPlateLayout =
        state.customCircularLayoutFor(target)
            ?.normalizedFor(rowCount, widestRowPlateCount)
            ?: generatedProductCircularPlateLayout(rowCount, widestRowPlateCount)

    fun applyCircularLayoutChange(
        layout: ProductCustomCircularPlateLayout,
        changesPlateIdentity: Boolean,
        undoCheckpoint: ProductCustomCircularPlateLayout? = null,
    ) {
        val undoLayout = undoCheckpoint ?: currentCircularLayout()
        if (layout != undoLayout) {
            if (editHistory.lastOrNull()?.layout != undoLayout) {
                if (editHistory.size >= 20) editHistory.removeAt(0)
                editHistory.add(ProductCircularLayoutUndo(undoLayout, changesPlateIdentity))
            }
        }
        if (changesPlateIdentity) {
            onStateChange(state.withCustomCircularLayout(target, layout))
        } else {
            onStateChange(
                state.copy(
                    customCircularLayoutsByTarget = state.customCircularLayoutsByTarget + (target to layout),
                ),
            )
        }
    }

    fun previewCircularLayoutChange(layout: ProductCustomCircularPlateLayout) {
        onStateChange(
            state.copy(
                customCircularLayoutsByTarget = state.customCircularLayoutsByTarget + (target to layout),
            ),
        )
    }

    fun undoCircularLayoutChange() {
        if (editHistory.isEmpty()) return
        val undo = editHistory.removeAt(editHistory.lastIndex)
        selectedPlateId = null
        if (undo.changesPlateIdentity) {
            onStateChange(state.withCustomCircularLayout(target, undo.layout))
        } else {
            onStateChange(
                state.copy(
                    customCircularLayoutsByTarget = state.customCircularLayoutsByTarget + (target to undo.layout),
                ),
            )
        }
    }

    fun enterEditMode() {
        selectedPlateId = null
        editHistory.clear()
        setEditMode(true)
    }
    Surface(
        shape = RoundedCornerShape(24.dp),
        color = LaiqColors.SurfaceTint,
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
        modifier = modifier.fillMaxWidth(),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(if (editMode) 10.dp else 18.dp)
                .then(if (editMode) Modifier.fillMaxSize() else Modifier.height(560.dp))
                .pointerInput(target, customLayout) {
                    detectTapGestures(onDoubleTap = { enterEditMode() })
                },
        ) {
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(if (editMode) 8.dp else 10.dp),
            ) {
                if (editMode) {
                    CustomCircularLayoutEditCard(
                        target = target,
                        layout = state.customCircularLayoutFor(target)
                            ?.normalizedFor(rowCount, widestRowPlateCount)
                            ?: generatedProductCircularPlateLayout(rowCount, widestRowPlateCount),
                        selectedPlateId = selectedPlateId,
                        hasAnnularRing = hasAnnularRing,
                        rowCount = rowCount,
                        widestRowPlateCount = widestRowPlateCount,
                        onSelectedPlateChange = { selectedPlateId = it },
                        onLayoutPreviewChange = { layout ->
                            previewCircularLayoutChange(layout)
                        },
                        onLayoutChange = { layout, changesPlateIdentity, undoCheckpoint ->
                            applyCircularLayoutChange(layout, changesPlateIdentity, undoCheckpoint)
                        },
                        onRegenerateBase = { rows, widest ->
                            selectedPlateId = null
                            editHistory.clear()
                            onStateChange(
                                state.copy(
                                    floorPatternCountX = rows.toString(),
                                    floorPatternCountY = widest.toString(),
                                    customCircularLayoutsByTarget = state.customCircularLayoutsByTarget +
                                        (target to generatedProductCircularPlateLayout(rows, widest)),
                                ).withoutTargetApproval(target),
                            )
                        },
                        canUndo = editHistory.isNotEmpty(),
                        onUndo = { undoCircularLayoutChange() },
                        onDone = { setEditMode(false) },
                    )
                }
                if (!editMode) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = if (customLayout != null) "Custom circular layout" else "Generated circular layout",
                            style = MaterialTheme.typography.labelLarge,
                            color = LaiqColors.MutedText,
                        )
                        TextButton(onClick = { enterEditMode() }) {
                            Text("Edit")
                        }
                    }
                }
                ZoomableLayoutMapViewport(
                    resetKey = listOf(
                        target.key,
                        template.key,
                        rowCount,
                        widestRowPlateCount,
                        annularSectionCount,
                        customLayout,
                    ).joinToString("|"),
                    modifier = Modifier
                        .align(Alignment.CenterHorizontally)
                        .fillMaxWidth(if (editMode) 1f else 0.9f)
                        .then(if (editMode) Modifier.weight(1f) else Modifier.height(378.dp)),
                ) { mapZoom, mapPan ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .graphicsLayer {
                                scaleX = mapZoom
                                scaleY = mapZoom
                                translationX = mapPan.x
                                translationY = mapPan.y
                                transformOrigin = TransformOrigin(0f, 0f)
                            },
                    ) {
                        RoofSurfaceMap(
                            template = RoofTemplate.CIRCULAR_PLATE,
                            rowCount = rowCount,
                            widestRowPlateCount = widestRowPlateCount,
                            ringCount = 0,
                            sectorCount = 0,
                            activePlateId = selectedPlateId,
                            overlayPlateIds = if (editMode) {
                                currentCircularLayout().verticalMergeGroupLabels(target, selectedPlateId)
                            } else {
                                emptySet()
                            },
                            hasAnnularRing = hasAnnularRing,
                            annularSectionCount = if (hasAnnularRing) annularSectionCount else 0,
                            annularReferenceAzimuthDeg = customLayout?.annularRotationDeg?.toDouble() ?: 0.0,
                            customPlateCells = customPlateCells,
                            showAnnularSectionLabels = hasAnnularRing,
                            autoHideCrowdedPlateLabels = true,
                            enablePlateTapSelection = true,
                            referenceLabel = referenceMode.label,
                            mapTitle = "Floor Layout Map",
                            showInteractionHint = !editMode,
                            maxMapSize = if (editMode) 720.dp else 320.dp,
                            onSelectPlate = { plateId ->
                                selectedPlateId = plateId
                            },
                            modifier = Modifier.fillMaxSize(),
                        )
                    }
                }
            }
            if (!editMode) selectedPlateId?.let { plateId ->
                val displayLabel = currentCircularLayout().displayPlateLabelFor(target, plateId) ?: plateId
                SelectedPlateChip(
                    text = "Selected plate: $displayLabel",
                    modifier = Modifier.align(Alignment.BottomStart),
                )
            }
        }
    }
}

@Composable
private fun CustomCircularLayoutEditCard(
    target: ProductLayoutTarget,
    layout: ProductCustomCircularPlateLayout,
    selectedPlateId: String?,
    hasAnnularRing: Boolean,
    rowCount: Int,
    widestRowPlateCount: Int,
    onSelectedPlateChange: (String?) -> Unit,
    onLayoutPreviewChange: (ProductCustomCircularPlateLayout) -> Unit,
    onLayoutChange: (ProductCustomCircularPlateLayout, Boolean, ProductCustomCircularPlateLayout?) -> Unit,
    onRegenerateBase: (Int, Int) -> Unit,
    canUndo: Boolean,
    onUndo: () -> Unit,
    onDone: () -> Unit,
) {
    val selectedRef = selectedPlateId?.let { plateId ->
        layout.plateRefs(target).firstOrNull { ref -> ref.label == plateId }
    }
    var rowShiftUndoStart by remember(selectedRef?.rowNumber) {
        mutableStateOf<ProductCustomCircularPlateLayout?>(null)
    }
    var rowShiftLatestLayout by remember(selectedRef?.rowNumber) {
        mutableStateOf<ProductCustomCircularPlateLayout?>(null)
    }
    var rowHeightUndoStart by remember(selectedRef?.rowNumber) {
        mutableStateOf<ProductCustomCircularPlateLayout?>(null)
    }
    var rowHeightLatestLayout by remember(selectedRef?.rowNumber) {
        mutableStateOf<ProductCustomCircularPlateLayout?>(null)
    }
    var seamUndoStart by remember(selectedRef?.label) {
        mutableStateOf<ProductCustomCircularPlateLayout?>(null)
    }
    var seamLatestLayout by remember(selectedRef?.label) {
        mutableStateOf<ProductCustomCircularPlateLayout?>(null)
    }
    var annularSpinUndoStart by remember(hasAnnularRing) {
        mutableStateOf<ProductCustomCircularPlateLayout?>(null)
    }
    var annularSpinLatestLayout by remember(hasAnnularRing) {
        mutableStateOf<ProductCustomCircularPlateLayout?>(null)
    }
    val selectedRow = selectedRef?.let { ref ->
        layout.rows.firstOrNull { row -> row.rowNumber == ref.rowNumber }
    }
    val selectedRowPlateCount = selectedRef?.rowIndex?.let { rowIndex ->
        layout.rows.getOrNull(rowIndex)?.plates?.size
    } ?: 0
    val canMergeLeft = selectedPlateId?.let { plateId ->
        layout.canMergePlateHorizontally(target, plateId, -1)
    } == true
    val canMergeRight = selectedPlateId?.let { plateId ->
        layout.canMergePlateHorizontally(target, plateId, 1)
    } == true
    val canMergeUp = selectedPlateId?.let { plateId -> layout.crossRowMergeTarget(target, plateId, -1) != null } == true
    val canMergeDown = selectedPlateId?.let { plateId -> layout.crossRowMergeTarget(target, plateId, 1) != null } == true
    val selectedTitle = when {
        selectedPlateId != null && selectedRow != null -> buildString {
            val displayLabel = layout.displayPlateLabelFor(target, selectedPlateId) ?: selectedPlateId
            append("Plate $displayLabel | Row ${selectedRow.rowNumber} | $selectedRowPlateCount plates")
        }
        else -> "Select a plate"
    }
    val editPanelHeight = if (hasAnnularRing) 330.dp else 300.dp
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = LaiqColors.SurfaceTint,
        border = BorderStroke(1.dp, LaiqColors.BrandTeal.copy(alpha = 0.28f)),
        modifier = Modifier
            .fillMaxWidth()
            .height(editPanelHeight)
            .clipToBounds(),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = selectedTitle,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = if (selectedPlateId == null) LaiqColors.MutedText else LaiqColors.BrandTeal,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                TextButton(
                    onClick = onUndo,
                    enabled = canUndo,
                    contentPadding = PaddingValues(horizontal = 6.dp, vertical = 0.dp),
                    modifier = Modifier.height(28.dp),
                ) {
                    Text("Undo", style = MaterialTheme.typography.labelSmall)
                }
                TextButton(
                    onClick = onDone,
                    contentPadding = PaddingValues(horizontal = 6.dp, vertical = 0.dp),
                    modifier = Modifier.height(28.dp),
                ) {
                    Text("Confirm", style = MaterialTheme.typography.labelSmall)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                CompactCountDropdown(
                    label = "Rows",
                    value = rowCount,
                    min = 1,
                    max = MAX_LAYOUT_ROWS,
                    onChange = { rows -> onRegenerateBase(rows, widestRowPlateCount) },
                    modifier = Modifier.weight(1f),
                )
                CompactCountDropdown(
                    label = "Widest columns",
                    value = widestRowPlateCount,
                    min = 4,
                    max = MAX_WIDEST_ROW_PLATES,
                    onChange = { widest -> onRegenerateBase(rowCount, widest) },
                    modifier = Modifier.weight(1f),
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(
                    enabled = selectedPlateId != null,
                    onClick = {
                        selectedPlateId?.let { plateId ->
                            val (updatedLayout, updatedSelection) = layout.splitPlateAndSelect(target, plateId, 2)
                            onSelectedPlateChange(updatedSelection)
                            onLayoutChange(updatedLayout, true, null)
                        }
                    },
                    contentPadding = PaddingValues(horizontal = 4.dp, vertical = 0.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(32.dp),
                ) {
                    Text("Split 2", style = MaterialTheme.typography.labelSmall)
                }
                OutlinedButton(
                    enabled = selectedPlateId != null,
                    onClick = {
                        selectedPlateId?.let { plateId ->
                            val (updatedLayout, updatedSelection) = layout.splitPlateAndSelect(target, plateId, 3)
                            onSelectedPlateChange(updatedSelection)
                            onLayoutChange(updatedLayout, true, null)
                        }
                    },
                    contentPadding = PaddingValues(horizontal = 4.dp, vertical = 0.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(32.dp),
                ) {
                    Text("Split 3", style = MaterialTheme.typography.labelSmall)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(
                    enabled = canMergeLeft,
                    onClick = {
                        selectedPlateId?.let { plateId ->
                            val (updatedLayout, updatedSelection) = layout.mergePlateAndSelect(target, plateId, -1)
                            onSelectedPlateChange(updatedSelection)
                            onLayoutChange(updatedLayout, true, null)
                        }
                    },
                    contentPadding = PaddingValues(horizontal = 4.dp, vertical = 0.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(32.dp),
                ) {
                    Text("Merge L", style = MaterialTheme.typography.labelSmall)
                }
                OutlinedButton(
                    enabled = canMergeRight,
                    onClick = {
                        selectedPlateId?.let { plateId ->
                            val (updatedLayout, updatedSelection) = layout.mergePlateAndSelect(target, plateId, 1)
                            onSelectedPlateChange(updatedSelection)
                            onLayoutChange(updatedLayout, true, null)
                        }
                    },
                    contentPadding = PaddingValues(horizontal = 4.dp, vertical = 0.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(32.dp),
                ) {
                    Text("Merge R", style = MaterialTheme.typography.labelSmall)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(
                    enabled = canMergeUp,
                    onClick = {
                        selectedPlateId?.let { plateId ->
                            val existingVerticalKeys = layout.verticalMergeGroupKeys()
                            val sourceRowNumber = selectedRef?.rowNumber
                            val updatedLayout = layout.mergePlateAcrossRows(target, plateId, -1)
                            if (updatedLayout != layout) {
                                onSelectedPlateChange(
                                    sourceRowNumber?.let { rowNumber ->
                                        updatedLayout.firstNewVerticalMergeLabelInRow(
                                            target = target,
                                            rowNumber = rowNumber,
                                            existingKeys = existingVerticalKeys,
                                        )
                                    } ?: plateId,
                                )
                                onLayoutChange(updatedLayout, true, null)
                            }
                        }
                    },
                    contentPadding = PaddingValues(horizontal = 4.dp, vertical = 0.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(32.dp),
                ) {
                    Text("Merge Up", style = MaterialTheme.typography.labelSmall)
                }
                OutlinedButton(
                    enabled = canMergeDown,
                    onClick = {
                        selectedPlateId?.let { plateId ->
                            val existingVerticalKeys = layout.verticalMergeGroupKeys()
                            val sourceRowNumber = selectedRef?.rowNumber
                            val updatedLayout = layout.mergePlateAcrossRows(target, plateId, 1)
                            if (updatedLayout != layout) {
                                onSelectedPlateChange(
                                    sourceRowNumber?.let { rowNumber ->
                                        updatedLayout.firstNewVerticalMergeLabelInRow(
                                            target = target,
                                            rowNumber = rowNumber,
                                            existingKeys = existingVerticalKeys,
                                        )
                                    } ?: plateId,
                                )
                                onLayoutChange(updatedLayout, true, null)
                            }
                        }
                    },
                    contentPadding = PaddingValues(horizontal = 4.dp, vertical = 0.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(32.dp),
                ) {
                    Text("Merge Down", style = MaterialTheme.typography.labelSmall)
                }
            }
            if (selectedRef != null && selectedRow != null) {
                val plateId = selectedPlateId
                val rowHeightRange = layout.rowHeightValueRange(selectedRow.rowNumber)
                val leftSeamValue = layout.adjacentPlateBoundaryBias(target, plateId, -1)
                CompactSliderRow(
                    label = "Left seam",
                    value = leftSeamValue,
                    valueRange = -1f..1f,
                    enabled = layout.canAdjustAdjacentPlateBoundary(target, plateId, -1),
                    onValueChange = { value ->
                        if (seamUndoStart == null) seamUndoStart = layout
                        val updatedLayout = layout.withAdjacentPlateBoundaryBias(target, plateId, -1, value)
                        seamLatestLayout = updatedLayout
                        onLayoutPreviewChange(updatedLayout)
                    },
                    onValueChangeFinished = {
                        val undoStart = seamUndoStart
                        val latestLayout = seamLatestLayout
                        if (undoStart != null && latestLayout != null) {
                            onLayoutChange(latestLayout, false, undoStart)
                        }
                        seamUndoStart = null
                        seamLatestLayout = null
                    },
                )
                val rightSeamValue = layout.adjacentPlateBoundaryBias(target, plateId, 1)
                CompactSliderRow(
                    label = "Right seam",
                    value = rightSeamValue,
                    valueRange = -1f..1f,
                    enabled = layout.canAdjustAdjacentPlateBoundary(target, plateId, 1),
                    onValueChange = { value ->
                        if (seamUndoStart == null) seamUndoStart = layout
                        val updatedLayout = layout.withAdjacentPlateBoundaryBias(target, plateId, 1, value)
                        seamLatestLayout = updatedLayout
                        onLayoutPreviewChange(updatedLayout)
                    },
                    onValueChangeFinished = {
                        val undoStart = seamUndoStart
                        val latestLayout = seamLatestLayout
                        if (undoStart != null && latestLayout != null) {
                            onLayoutChange(latestLayout, false, undoStart)
                        }
                        seamUndoStart = null
                        seamLatestLayout = null
                    },
                )
                CompactSliderRow(
                    label = "Row height",
                    value = selectedRow.heightWeight.coerceIn(rowHeightRange.start, rowHeightRange.endInclusive),
                    valueRange = rowHeightRange,
                    valueText = "${"%.2f".format(selectedRow.heightWeight.coerceIn(rowHeightRange.start, rowHeightRange.endInclusive))}x",
                    enabled = true,
                    onValueChange = { value ->
                        if (rowHeightUndoStart == null) rowHeightUndoStart = layout
                        val updatedLayout = layout.withRowHeight(selectedRow.rowNumber, value)
                        rowHeightLatestLayout = updatedLayout
                        onLayoutPreviewChange(updatedLayout)
                    },
                    onValueChangeFinished = {
                        val undoStart = rowHeightUndoStart
                        val latestLayout = rowHeightLatestLayout
                        if (undoStart != null && latestLayout != null) {
                            onLayoutChange(latestLayout, false, undoStart)
                        }
                        rowHeightUndoStart = null
                        rowHeightLatestLayout = null
                    },
                )
                CompactSliderRow(
                    label = "Row shift",
                    value = selectedRow.shiftRatio.coerceIn(-1f, 1f),
                    valueRange = -1f..1f,
                    enabled = true,
                    onValueChange = { value ->
                        if (rowShiftUndoStart == null) rowShiftUndoStart = layout
                        val updatedLayout = layout.withRowShift(selectedRow.rowNumber, value)
                        rowShiftLatestLayout = updatedLayout
                        onLayoutPreviewChange(updatedLayout)
                    },
                    onValueChangeFinished = {
                        val undoStart = rowShiftUndoStart
                        val latestLayout = rowShiftLatestLayout
                        if (undoStart != null && latestLayout != null) {
                            onLayoutChange(latestLayout, false, undoStart)
                        }
                        rowShiftUndoStart = null
                        rowShiftLatestLayout = null
                    },
                )
            }
            if (hasAnnularRing) {
                CompactSliderRow(
                    label = "AR spin",
                    value = layout.annularRotationDeg.coerceIn(-180f, 180f),
                    valueRange = -180f..180f,
                    valueText = "${layout.annularRotationDeg.toInt()} deg",
                    enabled = true,
                    onValueChange = { value ->
                        if (annularSpinUndoStart == null) annularSpinUndoStart = layout
                        val updatedLayout = layout.withAnnularRotation(value)
                        annularSpinLatestLayout = updatedLayout
                        onLayoutPreviewChange(updatedLayout)
                    },
                    onValueChangeFinished = {
                        val undoStart = annularSpinUndoStart
                        val latestLayout = annularSpinLatestLayout
                        if (undoStart != null && latestLayout != null) {
                            onLayoutChange(latestLayout, false, undoStart)
                        }
                        annularSpinUndoStart = null
                        annularSpinLatestLayout = null
                    },
                )
            }
        }
    }
}

@Composable
private fun CompactCountDropdown(
    label: String,
    value: Int,
    min: Int,
    max: Int,
    onChange: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }
    Box(modifier = modifier) {
        Surface(
            shape = RoundedCornerShape(14.dp),
            color = Color.White,
            border = BorderStroke(1.dp, LaiqColors.PanelBorder),
            modifier = Modifier
                .fillMaxWidth()
                .height(34.dp)
                .clickable { expanded = true },
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelSmall,
                    color = LaiqColors.MutedText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = value.coerceIn(min, max).toString(),
                    style = MaterialTheme.typography.labelMedium,
                    color = LaiqColors.BodyText,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                )
                Text(
                    text = "v",
                    style = MaterialTheme.typography.labelSmall,
                    color = LaiqColors.MutedText,
                    maxLines = 1,
                )
            }
        }
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
        ) {
            (min..max).forEach { option ->
                DropdownMenuItem(
                    text = { Text(option.toString()) },
                    onClick = {
                        onChange(option)
                        expanded = false
                    },
                )
            }
        }
    }
}

@Composable
private fun CompactSliderRow(
    label: String,
    value: Float,
    valueRange: ClosedFloatingPointRange<Float>,
    enabled: Boolean,
    onValueChange: (Float) -> Unit,
    onValueChangeFinished: () -> Unit,
    valueText: String = "%.2f".format(value),
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(28.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = if (enabled) LaiqColors.BodyText else LaiqColors.MutedText,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            modifier = Modifier.weight(0.24f),
        )
        Slider(
            value = value.coerceIn(valueRange.start, valueRange.endInclusive),
            onValueChange = onValueChange,
            onValueChangeFinished = onValueChangeFinished,
            valueRange = valueRange,
            enabled = enabled,
            modifier = Modifier
                .weight(0.58f)
                .height(28.dp),
        )
        Text(
            text = valueText,
            style = MaterialTheme.typography.labelSmall,
            color = LaiqColors.MutedText,
            maxLines = 1,
            modifier = Modifier.weight(0.18f),
        )
    }
}

private fun ProductCustomCircularPlateLayout.splitPlateAndSelect(
    target: ProductLayoutTarget,
    plateLabel: String,
    parts: Int,
): Pair<ProductCustomCircularPlateLayout, String?> {
    val ref = plateRefs(target).firstOrNull { it.label == plateLabel }
        ?: return this to plateLabel
    val updatedLayout = splitPlate(target, plateLabel, parts)
    val updatedSelection = updatedLayout.plateRefs(target)
        .firstOrNull { it.rowIndex == ref.rowIndex && it.plateIndex == ref.plateIndex }
        ?.label
    return updatedLayout to updatedSelection
}

private fun ProductCustomCircularPlateLayout.mergePlateAndSelect(
    target: ProductLayoutTarget,
    plateLabel: String,
    direction: Int,
): Pair<ProductCustomCircularPlateLayout, String?> {
    val ref = plateRefs(target).firstOrNull { it.label == plateLabel }
        ?: return this to plateLabel
    val row = rows.getOrNull(ref.rowIndex) ?: return this to plateLabel
    val adjacentIndex = ref.plateIndex + direction.coerceIn(-1, 1)
    if (adjacentIndex !in row.plates.indices || adjacentIndex == ref.plateIndex) return this to plateLabel

    val mergedPlateIndex = minOf(ref.plateIndex, adjacentIndex)
    val updatedLayout = mergePlate(target, plateLabel, direction)
    val updatedSelection = updatedLayout.plateRefs(target)
        .firstOrNull { it.rowIndex == ref.rowIndex && it.plateIndex == mergedPlateIndex }
        ?.label
    return updatedLayout to updatedSelection
}

private fun ProductCustomCircularPlateLayout.adjacentPlateBoundaryBias(
    target: ProductLayoutTarget,
    plateLabel: String,
    direction: Int,
): Float {
    val ref = plateRefs(target).firstOrNull { it.label == plateLabel } ?: return 0f
    val row = rows.getOrNull(ref.rowIndex) ?: return 0f
    val leftIndex = if (direction < 0) ref.plateIndex - 1 else ref.plateIndex
    val rightIndex = leftIndex + 1
    if (leftIndex !in row.plates.indices || rightIndex !in row.plates.indices) return 0f
    val left = row.plates[leftIndex]
    val right = row.plates[rightIndex]
    val pairWeight = (left.widthWeight + right.widthWeight).coerceAtLeast(0.001f)
    val leftShare = (left.widthWeight / pairWeight).coerceIn(0.18f, 0.82f)
    return ((leftShare - 0.5f) / 0.38f).coerceIn(-1f, 1f)
}

private fun ProductCustomCircularPlateLayout.verticalMergeGroupKeys(): Set<String> =
    rows.flatMap { row -> row.plates.mapNotNull { plate -> plate.verticalMergeGroupKey } }.toSet()

private fun ProductCustomCircularPlateLayout.firstNewVerticalMergeLabelInRow(
    target: ProductLayoutTarget,
    rowNumber: Int,
    existingKeys: Set<String>,
): String? =
    plateRefs(target).firstOrNull { ref ->
        ref.rowNumber == rowNumber &&
            rows.getOrNull(ref.rowIndex)
                ?.plates
                ?.getOrNull(ref.plateIndex)
                ?.verticalMergeGroupKey
                ?.let { key -> key !in existingKeys } == true
    }?.label

@Composable
private fun ZoomableLayoutMapViewport(
    resetKey: String,
    modifier: Modifier = Modifier,
    maxZoom: Float = 10f,
    content: @Composable BoxScope.(mapZoom: Float, mapPan: Offset) -> Unit,
) {
    Box(
        modifier = modifier
            .clipToBounds(),
    ) {
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .clipToBounds(),
        ) {
            val density = LocalDensity.current
            val viewportSizePx = Size(
                width = with(density) { maxWidth.toPx() },
                height = with(density) { maxHeight.toPx() },
            )
            var mapZoom by remember(resetKey) { mutableStateOf(1f) }
            var mapPan by remember(resetKey) { mutableStateOf(Offset.Zero) }
            val resolvedZoom = mapZoom.coerceIn(1f, maxZoom)

            fun updateZoom(nextZoom: Float, centroid: Offset? = null) {
                val currentZoom = resolvedZoom.coerceAtLeast(0.001f)
                val coercedZoom = nextZoom.coerceIn(1f, maxZoom)
                val anchor = centroid ?: Offset(viewportSizePx.width / 2f, viewportSizePx.height / 2f)
                val logicalAnchor = Offset(
                    x = (anchor.x - mapPan.x) / currentZoom,
                    y = (anchor.y - mapPan.y) / currentZoom,
                )
                mapZoom = coercedZoom
                mapPan = coerceLayoutMapPan(
                    pan = Offset(
                        x = anchor.x - logicalAnchor.x * coercedZoom,
                        y = anchor.y - logicalAnchor.y * coercedZoom,
                    ),
                    viewportSize = viewportSizePx,
                    scale = coercedZoom,
                )
            }

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .layoutMapGestures(
                        mapZoom = resolvedZoom,
                        onPan = { delta ->
                            mapPan = coerceLayoutMapPan(
                                pan = mapPan + delta,
                                viewportSize = viewportSizePx,
                                scale = resolvedZoom,
                            )
                        },
                        onZoom = { delta, centroid ->
                            updateZoom(resolvedZoom * delta, centroid)
                        },
                    ),
            ) {
                content(resolvedZoom, mapPan)
            }

            if (resolvedZoom > 1.01f) {
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = Color.White.copy(alpha = 0.94f),
                    border = BorderStroke(1.dp, LaiqColors.PanelBorder),
                    shadowElevation = 3.dp,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                        .clickable {
                            mapZoom = 1f
                            mapPan = Offset.Zero
                        },
                ) {
                    Text(
                        text = "Zoom ${"%.1f".format(resolvedZoom)}x · Reset",
                        style = MaterialTheme.typography.labelSmall,
                        color = LaiqColors.BodyText,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun Modifier.layoutMapGestures(
    mapZoom: Float,
    onPan: (Offset) -> Unit,
    onZoom: (delta: Float, centroid: Offset) -> Unit,
): Modifier {
    val latestMapZoom by rememberUpdatedState(mapZoom)
    val latestOnPan by rememberUpdatedState(onPan)
    val latestOnZoom by rememberUpdatedState(onZoom)
    return pointerInput(Unit) {
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false)
            var previousSpan: Float? = null
            var totalDrag = Offset.Zero
            while (true) {
                val event = awaitPointerEvent()
                val pressedPointers = event.changes.filter { change -> change.pressed }
                if (pressedPointers.isEmpty()) break
                if (pressedPointers.size < 2) {
                    previousSpan = null
                    val change = event.changes.firstOrNull { pointer -> pointer.id == down.id } ?: continue
                    val delta = change.positionChange()
                    totalDrag += delta
                    if (latestMapZoom > 1.01f && totalDrag.distanceTo(Offset.Zero) > 6f) {
                        latestOnPan(delta)
                        change.consume()
                    }
                    continue
                }
                val centroid = pressedPointers
                    .map { change -> change.position }
                    .fold(Offset.Zero) { total, position -> total + position } / pressedPointers.size.toFloat()
                val span = pressedPointers
                    .map { change -> change.position.distanceTo(centroid) }
                    .average()
                    .toFloat()
                    .coerceAtLeast(1f)
                previousSpan?.let { lastSpan ->
                    val delta = (span / lastSpan.coerceAtLeast(1f)).coerceIn(0.72f, 1.38f)
                    latestOnZoom(delta, centroid)
                }
                previousSpan = span
                event.changes.forEach { change -> change.consume() }
            }
        }
    }
}

private fun coerceLayoutMapPan(
    pan: Offset,
    viewportSize: Size,
    scale: Float,
): Offset {
    if (!viewportSize.isUsableForLayoutMap() || scale <= 1f) return Offset.Zero
    val minX = viewportSize.width * (1f - scale)
    val minY = viewportSize.height * (1f - scale)
    return Offset(
        x = pan.x.coerceIn(minX, 0f),
        y = pan.y.coerceIn(minY, 0f),
    )
}

private fun Size.isUsableForLayoutMap(): Boolean =
    width > 1f && height > 1f

private fun Offset.distanceTo(other: Offset): Float =
    hypot(x - other.x, y - other.y)

@Composable
private fun SelectedPlateChip(
    text: String,
    modifier: Modifier = Modifier,
) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = Color.White,
        border = BorderStroke(1.dp, LaiqColors.BrandTeal.copy(alpha = 0.40f)),
        modifier = modifier,
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelMedium,
            color = LaiqColors.BrandTeal,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
        )
    }
}

@Composable
private fun FloorLayoutCanvas(
    template: ProductFloorTemplate,
    plateColumns: Int,
    plateRows: Int,
    annularSectionCount: Int,
    modifier: Modifier = Modifier,
) {
    val gridColumns = plateColumns.coerceAtLeast(1)
    val gridRows = plateRows.coerceAtLeast(1)
    val annularSections = annularSectionCount.coerceAtLeast(4)
    val hasAnnularRing = template == ProductFloorTemplate.CIRCULAR_PLATE_WITH_AR
    val brandColor = LaiqColors.BrandTeal
    val gridBorder = LaiqColors.BrandTeal.copy(alpha = 0.40f)
    val annularColor = LaiqColors.AccentOrange
    val mutedColor = LaiqColors.MutedText

    Canvas(modifier = modifier) {
        val center = Offset(size.width / 2f, size.height / 2f)
        val outerRadius = size.minDimension * 0.45f
        val annularInnerRadius = outerRadius * 0.83f
        val plateZoneRadius = if (hasAnnularRing) {
            annularInnerRadius * 0.94f
        } else {
            outerRadius * 0.88f
        }
        val labelPaint = android.graphics.Paint().apply {
            color = brandColor.toArgb()
            textSize = 10.dp.toPx()
            textAlign = android.graphics.Paint.Align.CENTER
            isAntiAlias = true
        }
        val annularPaint = android.graphics.Paint().apply {
            color = annularColor.toArgb()
            textSize = 10.dp.toPx()
            textAlign = android.graphics.Paint.Align.CENTER
            isAntiAlias = true
        }
        val zeroPaint = android.graphics.Paint().apply {
            color = mutedColor.toArgb()
            textSize = 11.dp.toPx()
            textAlign = android.graphics.Paint.Align.CENTER
            isAntiAlias = true
        }

        drawCircle(
            color = brandColor.copy(alpha = 0.06f),
            radius = annularInnerRadius,
            center = center,
        )

        val gridWidth = plateZoneRadius * 1.58f
        val gridHeight = plateZoneRadius * 1.58f
        val cellWidth = gridWidth / gridColumns
        val cellHeight = gridHeight / gridRows
        val gridLeft = center.x - gridWidth / 2f
        val gridTop = center.y - gridHeight / 2f
        val gridClip = Path().apply {
            addOval(
                Rect(
                    left = center.x - plateZoneRadius,
                    top = center.y - plateZoneRadius,
                    right = center.x + plateZoneRadius,
                    bottom = center.y + plateZoneRadius,
                ),
            )
        }

        clipPath(gridClip) {
            repeat(gridRows) { row ->
                repeat(gridColumns) { column ->
                    val x = gridLeft + column * cellWidth
                    val y = gridTop + row * cellHeight
                    val plateNo = row * gridColumns + column + 1
                    drawRect(
                        color = Color.White,
                        topLeft = Offset(x, y),
                        size = Size(cellWidth, cellHeight),
                    )
                    drawRect(
                        color = gridBorder,
                        topLeft = Offset(x, y),
                        size = Size(cellWidth, cellHeight),
                        style = Stroke(width = 1.1.dp.toPx()),
                    )
                    if (cellWidth >= 24.dp.toPx() && cellHeight >= 22.dp.toPx() && plateNo <= 99) {
                        drawContext.canvas.nativeCanvas.drawText(
                            plateNo.toString(),
                            x + cellWidth / 2f,
                            y + cellHeight * 0.62f,
                            labelPaint,
                        )
                    }
                }
            }
        }

        drawCircle(
            color = brandColor.copy(alpha = 0.52f),
            radius = if (hasAnnularRing) annularInnerRadius else outerRadius,
            center = center,
            style = Stroke(width = 2.dp.toPx()),
        )
        if (hasAnnularRing) {
            drawCircle(
                color = annularColor.copy(alpha = 0.10f),
                radius = (outerRadius + annularInnerRadius) / 2f,
                center = center,
                style = Stroke(width = outerRadius - annularInnerRadius),
            )
        }

        val sectionStep = 360.0 / annularSections.toDouble()
        if (hasAnnularRing) repeat(annularSections) { sectionIndex ->
            val angle = Math.toRadians(-90.0 + sectionStep * sectionIndex)
            val cosValue = cos(angle).toFloat()
            val sinValue = sin(angle).toFloat()
            drawLine(
                color = annularColor.copy(alpha = 0.62f),
                start = Offset(
                    x = center.x + cosValue * annularInnerRadius,
                    y = center.y + sinValue * annularInnerRadius,
                ),
                end = Offset(
                    x = center.x + cosValue * outerRadius,
                    y = center.y + sinValue * outerRadius,
                ),
                strokeWidth = 1.2.dp.toPx(),
            )
        }
        if (hasAnnularRing) {
            drawCircle(
                color = annularColor.copy(alpha = 0.82f),
                radius = outerRadius,
                center = center,
                style = Stroke(width = 1.6.dp.toPx()),
            )
        }

        val labelEvery = max(1, annularSections / 12)
        if (hasAnnularRing) repeat(annularSections) { sectionIndex ->
            if (sectionIndex % labelEvery == 0) {
                val labelAngle = Math.toRadians(-90.0 + sectionStep * (sectionIndex + 0.5))
                val labelRadius = (outerRadius + annularInnerRadius) / 2f
                drawContext.canvas.nativeCanvas.drawText(
                    "AR${sectionIndex + 1}",
                    center.x + cos(labelAngle).toFloat() * labelRadius,
                    center.y + sin(labelAngle).toFloat() * labelRadius + 3.dp.toPx(),
                    annularPaint,
                )
            }
        }

        drawLine(
            color = annularColor,
            start = center,
            end = Offset(center.x, center.y - outerRadius),
            strokeWidth = 2.dp.toPx(),
        )
        drawContext.canvas.nativeCanvas.drawText(
            "0°",
            center.x,
            center.y - outerRadius - 8.dp.toPx(),
            zeroPaint,
        )
    }
}

@Composable
private fun ShellPlateLayoutPreviewPanel(
    courseCount: Int,
    platesPerCourse: Int,
    offsetMode: String,
    offsetStartRow: ProductShellOffsetStartRow,
    thirdOffsetStart: ProductShellThirdOffsetStart,
    laneCount: Int,
    selectedLaneIndex: Int?,
    selectedPlateId: String?,
    onSelectLane: (Int) -> Unit,
    onSelectPlate: (String) -> Unit,
    referenceMode: ProductReferenceMode,
) {
    val resolvedLaneCount = laneCount.coerceIn(1, 24)
    val resolvedSelectedLaneIndex = selectedLaneIndex?.takeIf { laneIndex -> laneIndex in 0 until resolvedLaneCount }
    Surface(
        shape = RoundedCornerShape(24.dp),
        color = LaiqColors.SurfaceTint,
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("Shell Layout Map", style = MaterialTheme.typography.titleSmall, color = LaiqColors.BodyText)
            Text(
                "Reference: 0° = ${referenceMode.label}",
                style = MaterialTheme.typography.bodySmall,
                color = LaiqColors.MutedText,
            )
            resolvedSelectedLaneIndex?.let { laneIndex ->
                SelectedPlateChip(text = "Selected lane: L${laneIndex + 1}")
            }
            selectedPlateId?.let { plateId ->
                SelectedPlateChip(text = "Selected plate: $plateId")
            }
            ZoomableLayoutMapViewport(
                resetKey = listOf(
                    courseCount,
                    platesPerCourse,
                    offsetMode,
                    offsetStartRow.key,
                    thirdOffsetStart.key,
                    resolvedLaneCount,
                ).joinToString("|"),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(380.dp),
            ) { mapZoom, mapPan ->
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .graphicsLayer {
                            scaleX = mapZoom
                            scaleY = mapZoom
                            translationX = mapPan.x
                            translationY = mapPan.y
                            transformOrigin = TransformOrigin(0f, 0f)
                        },
                ) {
                    ShellPlateCanvas(
                        courseCount = courseCount,
                        platesPerCourse = platesPerCourse,
                        offsetMode = offsetMode,
                        offsetStartRow = offsetStartRow,
                        thirdOffsetStart = thirdOffsetStart,
                        laneCount = resolvedLaneCount,
                        selectedPlateId = selectedPlateId,
                        selectedLaneIndex = resolvedSelectedLaneIndex,
                        onSelectLane = onSelectLane,
                        onSelectPlate = onSelectPlate,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
            }
        }
    }
}

@Composable
private fun ShellPlateCanvas(
    courseCount: Int,
    platesPerCourse: Int,
    offsetMode: String,
    offsetStartRow: ProductShellOffsetStartRow,
    thirdOffsetStart: ProductShellThirdOffsetStart,
    laneCount: Int,
    selectedPlateId: String?,
    selectedLaneIndex: Int?,
    onSelectLane: (Int) -> Unit,
    onSelectPlate: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val brandColor = LaiqColors.BrandTeal
    val borderColor = LaiqColors.BrandTeal.copy(alpha = 0.70f)
    val seamColor = LaiqColors.AccentOrange.copy(alpha = 0.84f)
    val mutedColor = LaiqColors.MutedText
    val density = LocalDensity.current
    val labelWidthPx = with(density) { 46.dp.toPx() }
    val topPaddingPx = with(density) { 26.dp.toPx() }
    val bottomPaddingPx = with(density) { 14.dp.toPx() }
    val rightPaddingPx = with(density) { 8.dp.toPx() }
    val cellGapPx = with(density) { 2.dp.toPx() }
    val laneExtensionPx = with(density) { 18.dp.toPx() }
    Canvas(
        modifier = modifier.pointerInput(
            courseCount,
            platesPerCourse,
            offsetMode,
            offsetStartRow,
            thirdOffsetStart,
            laneCount,
        ) {
            detectTapGestures { offset ->
                val rows = courseCount.coerceAtLeast(1)
                val left = labelWidthPx
                val right = size.width.toFloat() - rightPaddingPx
                val rowHeight = ((size.height.toFloat() - topPaddingPx - bottomPaddingPx) / rows)
                    .coerceAtLeast(1f)
                val mapTop = topPaddingPx
                val mapBottom = topPaddingPx + rows * rowHeight - cellGapPx
                val laneTotal = laneCount.coerceIn(1, 24)
                val laneWidth = (right - left) / laneTotal
                if (
                    offset.x in left..right &&
                    offset.y >= mapTop - laneExtensionPx &&
                    offset.y <= mapBottom + laneExtensionPx
                ) {
                    val laneIndex = ((offset.x - left) / laneWidth)
                        .toInt()
                        .coerceIn(0, laneTotal - 1)
                    onSelectLane(laneIndex)
                }
                val hit = buildShellPlateSegments(
                    canvasSize = Size(size.width.toFloat(), size.height.toFloat()),
                    labelWidth = labelWidthPx,
                    topPadding = topPaddingPx,
                    bottomPadding = bottomPaddingPx,
                    rightPadding = rightPaddingPx,
                    cellGap = cellGapPx,
                    courseCount = courseCount,
                    platesPerCourse = platesPerCourse,
                    offsetMode = offsetMode,
                    offsetStartRow = offsetStartRow,
                    thirdOffsetStart = thirdOffsetStart,
                ).lastOrNull { segment -> segment.rect.contains(offset) }
                hit?.let { segment -> onSelectPlate(segment.plateId) }
            }
        },
    ) {
        val rows = courseCount.coerceAtLeast(1)
        val plateCount = platesPerCourse.coerceAtLeast(1)
        val left = labelWidthPx
        val right = size.width - rightPaddingPx
        val rowHeight = ((size.height - topPaddingPx - bottomPaddingPx) / rows)
            .coerceAtLeast(28.dp.toPx())
        val laneTotal = laneCount.coerceIn(1, 24)
        val mapTop = topPaddingPx
        val mapBottom = topPaddingPx + rows * rowHeight - cellGapPx
        val laneWidth = (right - left) / laneTotal
        val labelPaint = android.graphics.Paint().apply {
            color = mutedColor.toArgb()
            textSize = 12.dp.toPx()
            isAntiAlias = true
        }
        val lanePaint = android.graphics.Paint().apply {
            color = brandColor.toArgb()
            textSize = 11.dp.toPx()
            textAlign = android.graphics.Paint.Align.CENTER
            isFakeBoldText = true
            isAntiAlias = true
        }
        val platePaint = android.graphics.Paint().apply {
            color = brandColor.toArgb()
            textSize = 10.dp.toPx()
            textAlign = android.graphics.Paint.Align.CENTER
            isAntiAlias = true
        }
        val selectedPaint = android.graphics.Paint().apply {
            color = LaiqColors.BrandRed.toArgb()
            textSize = 11.dp.toPx()
            textAlign = android.graphics.Paint.Align.CENTER
            isFakeBoldText = true
            isAntiAlias = true
        }
        val selectedLaneLabelPaint = android.graphics.Paint().apply {
            color = LaiqColors.BrandRed.toArgb()
            textSize = 12.dp.toPx()
            textAlign = android.graphics.Paint.Align.CENTER
            isFakeBoldText = true
            isAntiAlias = true
        }
        val segments = buildShellPlateSegments(
            canvasSize = size,
            labelWidth = labelWidthPx,
            topPadding = topPaddingPx,
            bottomPadding = bottomPaddingPx,
            rightPadding = rightPaddingPx,
            cellGap = cellGapPx,
            courseCount = courseCount,
            platesPerCourse = platesPerCourse,
            offsetMode = offsetMode,
            offsetStartRow = offsetStartRow,
            thirdOffsetStart = thirdOffsetStart,
        )

        drawLine(
            color = seamColor,
            start = Offset(left, topPaddingPx - 14.dp.toPx()),
            end = Offset(left, size.height - bottomPaddingPx + 2.dp.toPx()),
            strokeWidth = 2.dp.toPx(),
        )
        drawLine(
            color = seamColor.copy(alpha = 0.58f),
            start = Offset(right, topPaddingPx - 14.dp.toPx()),
            end = Offset(right, size.height - bottomPaddingPx + 2.dp.toPx()),
            strokeWidth = 1.4.dp.toPx(),
        )
        drawContext.canvas.nativeCanvas.drawText(
            "0°",
            left,
            topPaddingPx - 18.dp.toPx(),
            labelPaint,
        )

        repeat(rows) { rowIndex ->
            val courseNo = rows - rowIndex
            val y = topPaddingPx + rowIndex * rowHeight
            drawContext.canvas.nativeCanvas.drawText(
                "C$courseNo",
                0f,
                y + rowHeight * 0.62f,
                labelPaint,
            )
        }

        repeat(laneTotal) { laneIndex ->
            val isSelectedLane = laneIndex == selectedLaneIndex
            if (laneIndex % 2 == 0 || isSelectedLane) {
                drawRect(
                    color = if (isSelectedLane) {
                        LaiqColors.BrandRed.copy(alpha = 0.14f)
                    } else {
                        brandColor.copy(alpha = 0.055f)
                    },
                    topLeft = Offset(left + laneIndex * laneWidth, mapTop),
                    size = Size(laneWidth, mapBottom - mapTop),
                )
            }
            if (laneWidth >= 34.dp.toPx()) {
                drawContext.canvas.nativeCanvas.drawText(
                    "L${laneIndex + 1}",
                    left + laneIndex * laneWidth + laneWidth / 2f,
                    mapTop - 7.dp.toPx(),
                    if (isSelectedLane) selectedLaneLabelPaint else lanePaint,
                )
            }
        }

        segments.forEach { segment ->
            val isSelected = segment.plateId == selectedPlateId
            drawRect(
                color = if (isSelected) LaiqColors.BrandRed.copy(alpha = 0.10f) else Color.White,
                topLeft = Offset(segment.rect.left, segment.rect.top),
                size = Size(segment.rect.width, segment.rect.height),
            )
            drawRect(
                color = if (isSelected) LaiqColors.BrandRed else borderColor,
                topLeft = Offset(segment.rect.left, segment.rect.top),
                size = Size(segment.rect.width, segment.rect.height),
                style = Stroke(width = if (isSelected) 2.3.dp.toPx() else 1.65.dp.toPx()),
            )
            val canShowLabel = plateCount <= 16 &&
                !segment.isWrapSegment &&
                segment.rect.width >= 22.dp.toPx() &&
                segment.rect.height >= 24.dp.toPx()
            if (canShowLabel || isSelected) {
                drawContext.canvas.nativeCanvas.drawText(
                    segment.plateNo.toString(),
                    segment.rect.left + segment.rect.width / 2f,
                    segment.rect.top + segment.rect.height * 0.62f,
                    if (isSelected) selectedPaint else platePaint,
                )
            }
            if (segment.isWrapSegment && isSelected) {
                drawLine(
                    color = LaiqColors.BrandRed.copy(alpha = 0.74f),
                    start = Offset(segment.rect.left, segment.rect.bottom + 2.dp.toPx()),
                    end = Offset(segment.rect.right, segment.rect.bottom + 2.dp.toPx()),
                    strokeWidth = 2.dp.toPx(),
                )
            }
        }

        repeat(laneTotal) { laneIndex ->
            val isSelectedLane = laneIndex == selectedLaneIndex
            if (laneIndex % 2 == 0 || isSelectedLane) {
                drawRect(
                    color = if (isSelectedLane) {
                        LaiqColors.BrandRed.copy(alpha = 0.08f)
                    } else {
                        brandColor.copy(alpha = 0.035f)
                    },
                    topLeft = Offset(left + laneIndex * laneWidth, mapTop),
                    size = Size(laneWidth, mapBottom - mapTop),
                )
            }
        }

        for (boundaryIndex in 1 until laneTotal) {
            val x = left + boundaryIndex * laneWidth
            drawVerticalDashedLine(
                x = x,
                startY = mapTop - laneExtensionPx,
                endY = mapBottom + laneExtensionPx,
                color = LaiqColors.BrandRed.copy(alpha = 0.78f),
                dashHeight = 14.dp.toPx(),
                gapHeight = 7.dp.toPx(),
                strokeWidth = 2.dp.toPx(),
            )
        }
    }
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

private data class ShellPlateSegment(
    val courseNo: Int,
    val plateNo: Int,
    val rect: Rect,
    val isWrapSegment: Boolean = false,
) {
    val plateId: String = "C$courseNo-P$plateNo"
}

private fun buildShellPlateSegments(
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
): List<ShellPlateSegment> {
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
            val courseNo = rows - rowIndex
            val y = topPadding + rowIndex * rowHeight
            val offsetFraction = shellOffsetFraction(
                courseNo = courseNo,
                offsetMode = offsetMode,
                offsetStartRow = offsetStartRow,
                thirdOffsetStart = thirdOffsetStart,
            )
            if (offsetFraction > 0f && plateCount > 1) {
                val leadingRight = left + cellWidth * offsetFraction
                val trailingLeft = right - cellWidth * (1f - offsetFraction)
                add(
                    ShellPlateSegment(
                        courseNo = courseNo,
                        plateNo = plateCount,
                        rect = shellVisualRect(left, leadingRight, y, height, cellGap),
                        isWrapSegment = true,
                    ),
                )
                repeat(plateCount - 1) { plateIndex ->
                    val x = left + cellWidth * offsetFraction + plateIndex * cellWidth
                    add(
                        ShellPlateSegment(
                            courseNo = courseNo,
                            plateNo = plateIndex + 1,
                            rect = shellVisualRect(x, x + cellWidth, y, height, cellGap),
                        ),
                    )
                }
                add(
                    ShellPlateSegment(
                        courseNo = courseNo,
                        plateNo = plateCount,
                        rect = shellVisualRect(trailingLeft, right, y, height, cellGap),
                        isWrapSegment = true,
                    ),
                )
            } else {
                repeat(plateCount) { plateIndex ->
                    val x = left + plateIndex * cellWidth
                    add(
                        ShellPlateSegment(
                            courseNo = courseNo,
                            plateNo = plateIndex + 1,
                            rect = shellVisualRect(x, x + cellWidth, y, height, cellGap),
                        ),
                    )
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
            if (shouldOffset) 0.50f else 0f
        }
        else -> 0f
    }

private fun String.toPositiveInt(fallback: Int): Int =
    toIntOrNull()?.takeIf { it > 0 } ?: fallback

@Composable
private fun TwoUpFields(
    left: @Composable () -> Unit,
    right: @Composable () -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(modifier = Modifier.weight(1f)) { left() }
        Column(modifier = Modifier.weight(1f)) { right() }
    }
}

@Composable
private fun ThreeUpFields(
    first: @Composable () -> Unit,
    second: @Composable () -> Unit,
    third: @Composable () -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(modifier = Modifier.weight(1f)) { first() }
        Column(modifier = Modifier.weight(1f)) { second() }
        Column(modifier = Modifier.weight(1f)) { third() }
    }
}

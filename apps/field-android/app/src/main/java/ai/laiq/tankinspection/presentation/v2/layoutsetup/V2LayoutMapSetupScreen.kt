package ai.laiq.tankinspection.presentation.v2.layoutsetup

import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqCountField
import ai.laiq.tankinspection.presentation.components.LaiqDropdownField
import ai.laiq.tankinspection.presentation.components.LaiqOptionChips
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.components.LaiqTextField
import ai.laiq.tankinspection.presentation.components.RoofSurfaceMap
import ai.laiq.tankinspection.v2.model.V2FloorTemplate
import ai.laiq.tankinspection.v2.model.V2LayoutMapSetup
import ai.laiq.tankinspection.v2.model.V2LayoutSurface
import ai.laiq.tankinspection.v2.model.V2LayoutTarget
import ai.laiq.tankinspection.v2.model.V2ReferenceMode
import ai.laiq.tankinspection.v2.model.V2ShellOffsetStartRow
import ai.laiq.tankinspection.v2.model.withTargetApproval
import ai.laiq.tankinspection.v2.model.withoutTargetApproval
import ai.laiq.tankinspection.v2.model.withRoofPatternDefaults
import ai.laiq.tankinspection.v2.model.withSelectedTarget
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin

private val referenceModeOptions = listOf(
    V2ReferenceMode.TANK_NORTH.key to V2ReferenceMode.TANK_NORTH.label,
    V2ReferenceMode.TRUE_NORTH.key to V2ReferenceMode.TRUE_NORTH.label,
)

private val roofPatternOptions = listOf(
    RoofTemplate.CONE_RADIAL.name to "Cone Radial",
    RoofTemplate.UMBRELLA_RADIAL.name to "Umbrella Radial",
    RoofTemplate.CIRCULAR_PLATE.name to "Circular Plate",
)

private val yesNoOptions = listOf(
    "yes" to "Yes",
    "no" to "No",
)

private val floorTemplateOptions = listOf(
    V2FloorTemplate.RADIAL_ANNULAR.key to "Circular Plate + Annular",
    V2FloorTemplate.ANNULAR_ONLY.key to "Annular Only",
)

private val shellOffsetOptions = listOf(
    "aligned" to "Aligned",
    "half_plate" to "Half",
    "one_plate" to "1 Plate",
)

private val shellOffsetStartRowOptions = listOf(
    V2ShellOffsetStartRow.ODD.key to V2ShellOffsetStartRow.ODD.label,
    V2ShellOffsetStartRow.EVEN.key to V2ShellOffsetStartRow.EVEN.label,
)

@Composable
fun V2LayoutMapSetupScreen(
    state: V2LayoutMapSetup,
    layoutTargets: List<V2LayoutTarget>,
    tankLabel: String,
    roofLabel: String,
    onStateChange: (V2LayoutMapSetup) -> Unit,
    onBack: () -> Unit,
    onContinue: (V2LayoutTarget) -> Unit,
    contentPadding: PaddingValues = PaddingValues(0.dp),
) {
    val visibleTargets = layoutTargets.ifEmpty { listOf(V2LayoutTarget.EXTERNAL_ROOF) }
    val selectedTarget = if (state.selectedTarget in visibleTargets) state.selectedTarget else visibleTargets.first()
    val selectedSurface = selectedTarget.surface
    val selectedTargetApproved = selectedTarget in state.approvedTargets
    val allTargetsApproved = visibleTargets.all { target -> target in state.approvedTargets }
    val usesRadialRoofPattern = state.roofPattern == RoofTemplate.CONE_RADIAL ||
        state.roofPattern == RoofTemplate.UMBRELLA_RADIAL
    fun updateCurrentTarget(updated: V2LayoutMapSetup) {
        onStateChange(updated.withoutTargetApproval(selectedTarget))
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = 16.dp,
            end = 16.dp,
            top = contentPadding.calculateTopPadding() + 12.dp,
            bottom = 28.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Text(
                "Layout Map Setup",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.SemiBold,
                color = LaiqColors.BrandTeal,
                modifier = Modifier.padding(horizontal = 4.dp),
            )
        }

        item {
            LaiqSectionCard(title = "General Info") {
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
                                referenceMode = V2ReferenceMode.entries.first { option -> option.key == selected },
                                approvedTargets = emptySet(),
                            ),
                        )
                    },
                )
                if (state.referenceMode == V2ReferenceMode.TANK_NORTH) {
                    LaiqTextField(
                        value = state.referenceNote,
                        onValueChange = { onStateChange(state.copy(referenceNote = it)) },
                        label = { Text("Tank North Note") },
                        singleLine = false,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(108.dp),
                    )
                }
            }
        }

        item {
            LaiqSectionCard(title = "Surface Layout") {
                LaiqOptionChips(
                    selectedValue = selectedTarget.key,
                    options = visibleTargets.map { it.key to it.label },
                    onSelect = { selected ->
                        onStateChange(
                            state.withSelectedTarget(visibleTargets.first { it.key == selected }),
                        )
                    },
                )

                when (selectedSurface) {
                    V2LayoutSurface.ROOF -> {
                        SurfaceSubsection(title = "Roof Setup") {
                            TwoUpFields(
                                left = {
                                    LaiqStatChip(
                                        label = "Roof Scope",
                                        value = selectedTarget.label,
                                        modifier = Modifier.fillMaxWidth(),
                                    )
                                },
                                right = {
                                    LaiqDropdownField(
                                        label = "Roof Pattern",
                                        value = state.roofPattern.name,
                                        options = roofPatternOptions,
                                        onSelected = { selected ->
                                            onStateChange(
                                                state.withRoofPatternDefaults(RoofTemplate.valueOf(selected)),
                                            )
                                        },
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
                                                    roofCenterOpeningPlateCount = if (selected) {
                                                        state.roofCenterOpeningPlateCount.ifBlank { "1" }
                                                    } else {
                                                        state.roofCenterOpeningPlateCount
                                                    },
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
                            if (usesRadialRoofPattern) {
                                TwoUpFields(
                                    left = {
                                        LaiqCountField(
                                            label = "Ring Count",
                                            value = state.roofRingCount,
                                            onValueChange = {
                                                updateCurrentTarget(state.copy(roofRingCount = it))
                                            },
                                            min = 1,
                                            max = 12,
                                        )
                                    },
                                    right = {
                                        LaiqCountField(
                                            label = "Sector Count",
                                            value = state.roofSectorCount,
                                            onValueChange = {
                                                updateCurrentTarget(state.copy(roofSectorCount = it))
                                            },
                                            min = 4,
                                            max = 36,
                                        )
                                    },
                                )
                            } else {
                                TwoUpFields(
                                    left = {
                                        LaiqCountField(
                                            label = "Row Count",
                                            value = state.roofRowCount,
                                            onValueChange = {
                                                updateCurrentTarget(state.copy(roofRowCount = it))
                                            },
                                            min = 1,
                                            max = 12,
                                        )
                                    },
                                    right = {
                                        LaiqCountField(
                                            label = "Widest Row Plates",
                                            value = state.roofWidestRowPlateCount,
                                            onValueChange = {
                                                updateCurrentTarget(state.copy(roofWidestRowPlateCount = it))
                                            },
                                            min = 4,
                                            max = 40,
                                        )
                                    },
                                )
                            }
                            if (state.roofHasCenterOpening && state.roofHasAnnularRing) {
                                TwoUpFields(
                                    left = {
                                        LaiqCountField(
                                            label = "Center Opening Plates",
                                            value = state.roofCenterOpeningPlateCount,
                                            onValueChange = {
                                                updateCurrentTarget(state.copy(roofCenterOpeningPlateCount = it))
                                            },
                                            min = 1,
                                            max = 12,
                                        )
                                    },
                                    right = {
                                        LaiqCountField(
                                            label = "Annular Ring Plates",
                                            value = state.roofAnnularSectionCount,
                                            onValueChange = {
                                                updateCurrentTarget(state.copy(roofAnnularSectionCount = it))
                                            },
                                            min = 4,
                                            max = 40,
                                        )
                                    },
                                )
                            } else if (state.roofHasCenterOpening) {
                                LaiqCountField(
                                    label = "Center Opening Plates",
                                    value = state.roofCenterOpeningPlateCount,
                                    onValueChange = {
                                        updateCurrentTarget(state.copy(roofCenterOpeningPlateCount = it))
                                    },
                                    min = 1,
                                    max = 12,
                                )
                            } else if (state.roofHasAnnularRing) {
                                LaiqCountField(
                                    label = "Annular Ring Plates",
                                    value = state.roofAnnularSectionCount,
                                    onValueChange = {
                                        updateCurrentTarget(state.copy(roofAnnularSectionCount = it))
                                    },
                                    min = 4,
                                    max = 40,
                                )
                            }
                        }
                        RoofLayoutPreviewPanel(
                            state = state,
                            referenceMode = state.referenceMode,
                        )
                    }

                    V2LayoutSurface.SHELL -> {
                        SurfaceSubsection(title = "Shell Setup") {
                            ThreeUpFields(
                                first = {
                                    LaiqCountField(
                                        label = "Course Count",
                                        value = state.shellCourseCount,
                                        onValueChange = {
                                            updateCurrentTarget(state.copy(shellCourseCount = it))
                                        },
                                        min = 1,
                                        max = 12,
                                    )
                                },
                                second = {
                                    LaiqCountField(
                                        label = "Plates / Course",
                                        value = state.shellPlatesPerCourse,
                                        onValueChange = {
                                            updateCurrentTarget(state.copy(shellPlatesPerCourse = it))
                                        },
                                        min = 1,
                                        max = 48,
                                    )
                                },
                                third = {
                                    LaiqDropdownField(
                                        label = "Course Offset",
                                        value = state.shellPlateOffset,
                                        options = shellOffsetOptions,
                                        onSelected = {
                                            updateCurrentTarget(state.copy(shellPlateOffset = it))
                                        },
                                    )
                                },
                            )
                            LaiqOptionChips(
                                selectedValue = state.shellOffsetStartRow.key,
                                options = shellOffsetStartRowOptions,
                                onSelect = { selected ->
                                    updateCurrentTarget(
                                        state.copy(
                                            shellOffsetStartRow = V2ShellOffsetStartRow.entries.first { option ->
                                                option.key == selected
                                            },
                                        ),
                                    )
                                },
                            )
                        }
                        ShellPlateLayoutPreviewPanel(
                            courseCount = state.shellCourseCount.toPositiveInt(6),
                            platesPerCourse = state.shellPlatesPerCourse.toPositiveInt(12),
                            offsetMode = state.shellPlateOffset,
                            offsetStartRow = state.shellOffsetStartRow,
                        )
                    }

                    V2LayoutSurface.FLOOR -> {
                        SurfaceSubsection(title = "Floor Setup") {
                            LaiqDropdownField(
                                label = "Floor Pattern",
                                value = state.floorTemplate.key,
                                options = floorTemplateOptions,
                                onSelected = { selectedKey ->
                                    updateCurrentTarget(
                                        state.copy(
                                            floorTemplate = V2FloorTemplate.entries.first { option ->
                                                option.key == selectedKey
                                            },
                                        ),
                                    )
                                },
                            )
                            if (state.floorTemplate != V2FloorTemplate.ANNULAR_ONLY) {
                                TwoUpFields(
                                    left = {
                                        LaiqCountField(
                                            label = "Row Count",
                                            value = state.floorPatternCountX,
                                            onValueChange = {
                                                updateCurrentTarget(state.copy(floorPatternCountX = it))
                                            },
                                            min = 1,
                                            max = 12,
                                        )
                                    },
                                    right = {
                                        LaiqCountField(
                                            label = "Widest Row Plates",
                                            value = state.floorPatternCountY,
                                            onValueChange = {
                                                updateCurrentTarget(state.copy(floorPatternCountY = it))
                                            },
                                            min = 4,
                                            max = 40,
                                        )
                                    },
                                )
                            }
                            LaiqCountField(
                                label = "Annular Ring Plates",
                                value = state.floorAnnularSectionCount,
                                onValueChange = {
                                    updateCurrentTarget(state.copy(floorAnnularSectionCount = it))
                                },
                                min = 4,
                                max = 40,
                            )
                        }
                        FloorLayoutPreviewPanel(
                            template = state.floorTemplate,
                            rowCount = state.floorPatternCountX.toPositiveInt(6),
                            widestRowPlateCount = state.floorPatternCountY.toPositiveInt(12),
                            annularSectionCount = state.floorAnnularSectionCount.toPositiveInt(12),
                            referenceMode = state.referenceMode,
                        )
                    }
                }
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                LaiqSecondaryButton(
                    text = "Back",
                    onClick = onBack,
                    modifier = Modifier.weight(1f),
                )
                LaiqPrimaryButton(
                    text = when {
                        !selectedTargetApproved -> "Approve Layout"
                        !allTargetsApproved -> "Next Layout"
                        else -> "Continue"
                    },
                    onClick = {
                        when {
                            !selectedTargetApproved -> {
                                onStateChange(state.withTargetApproval(selectedTarget, approved = true))
                            }
                            !allTargetsApproved -> {
                                val nextTarget = visibleTargets.first { target -> target !in state.approvedTargets }
                                onStateChange(state.withSelectedTarget(nextTarget))
                            }
                            else -> onContinue(selectedTarget)
                        }
                    },
                    modifier = Modifier.weight(1f),
                )
            }
        }
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
    state: V2LayoutMapSetup,
    referenceMode: V2ReferenceMode,
) {
    val rowCount = state.roofRowCount.toPositiveInt(4)
    val widestRowPlateCount = state.roofWidestRowPlateCount.toPositiveInt(10)
    val ringCount = state.roofRingCount.toPositiveInt(3)
    val sectorCount = state.roofSectorCount.toPositiveInt(20)
    var selectedPlateId by remember(state.roofPattern, ringCount, sectorCount, rowCount, widestRowPlateCount) {
        mutableStateOf<String?>(null)
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
                .padding(18.dp)
                .height(500.dp),
        ) {
            RoofSurfaceMap(
                template = state.roofPattern,
                rowCount = rowCount,
                widestRowPlateCount = widestRowPlateCount,
                ringCount = ringCount,
                sectorCount = sectorCount,
                activePlateId = selectedPlateId,
                centerFeatureCount = if (state.roofHasCenterOpening) {
                    state.roofCenterOpeningPlateCount.toPositiveInt(1)
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
                referenceLabel = referenceMode.label,
                onSelectPlate = { selectedPlateId = it },
                modifier = Modifier
                    .align(Alignment.Center)
                    .fillMaxWidth(0.9f),
            )
            selectedPlateId?.let { plateId ->
                SelectedPlateChip(
                    text = "Selected plate: $plateId",
                    modifier = Modifier.align(Alignment.BottomStart),
                )
            }
        }
    }
}

@Composable
private fun FloorLayoutPreviewPanel(
    template: V2FloorTemplate,
    rowCount: Int,
    widestRowPlateCount: Int,
    annularSectionCount: Int,
    referenceMode: V2ReferenceMode,
) {
    var selectedPlateId by remember(template, rowCount, widestRowPlateCount, annularSectionCount) {
        mutableStateOf<String?>(null)
    }
    val hasInternalPlates = template != V2FloorTemplate.ANNULAR_ONLY
    Surface(
        shape = RoundedCornerShape(24.dp),
        color = LaiqColors.SurfaceTint,
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp)
                .height(500.dp),
        ) {
            RoofSurfaceMap(
                template = RoofTemplate.CIRCULAR_PLATE,
                rowCount = if (hasInternalPlates) rowCount else 1,
                widestRowPlateCount = if (hasInternalPlates) widestRowPlateCount else 4,
                ringCount = 0,
                sectorCount = 0,
                activePlateId = selectedPlateId,
                hasAnnularRing = true,
                annularSectionCount = annularSectionCount,
                showAnnularSectionLabels = true,
                autoHideCrowdedPlateLabels = true,
                enablePlateTapSelection = true,
                referenceLabel = referenceMode.label,
                onSelectPlate = { selectedPlateId = it },
                modifier = Modifier
                    .align(Alignment.Center)
                    .fillMaxWidth(0.9f),
            )
            selectedPlateId?.let { plateId ->
                SelectedPlateChip(
                    text = "Selected plate: $plateId",
                    modifier = Modifier.align(Alignment.BottomStart),
                )
            }
        }
    }
}

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
    template: V2FloorTemplate,
    plateColumns: Int,
    plateRows: Int,
    annularSectionCount: Int,
    modifier: Modifier = Modifier,
) {
    val gridColumns = plateColumns.coerceAtLeast(1)
    val gridRows = plateRows.coerceAtLeast(1)
    val annularSections = annularSectionCount.coerceAtLeast(4)
    val usesPlateGrid = template != V2FloorTemplate.ANNULAR_ONLY
    val brandColor = LaiqColors.BrandTeal
    val gridBorder = LaiqColors.BrandTeal.copy(alpha = 0.40f)
    val annularColor = LaiqColors.AccentOrange
    val mutedColor = LaiqColors.MutedText

    Canvas(modifier = modifier) {
        val center = Offset(size.width / 2f, size.height / 2f)
        val outerRadius = size.minDimension * 0.45f
        val annularInnerRadius = outerRadius * 0.83f
        val plateZoneRadius = if (template == V2FloorTemplate.ANNULAR_ONLY) {
            annularInnerRadius * 0.70f
        } else {
            annularInnerRadius * 0.94f
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

        if (usesPlateGrid) {
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
        }

        drawCircle(
            color = brandColor.copy(alpha = 0.52f),
            radius = annularInnerRadius,
            center = center,
            style = Stroke(width = 2.dp.toPx()),
        )
        drawCircle(
            color = annularColor.copy(alpha = 0.10f),
            radius = (outerRadius + annularInnerRadius) / 2f,
            center = center,
            style = Stroke(width = outerRadius - annularInnerRadius),
        )

        val sectionStep = 360.0 / annularSections.toDouble()
        repeat(annularSections) { sectionIndex ->
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
        drawCircle(
            color = annularColor.copy(alpha = 0.82f),
            radius = outerRadius,
            center = center,
            style = Stroke(width = 1.6.dp.toPx()),
        )

        val labelEvery = max(1, annularSections / 12)
        repeat(annularSections) { sectionIndex ->
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
    offsetStartRow: V2ShellOffsetStartRow,
) {
    Surface(
        shape = RoundedCornerShape(24.dp),
        color = LaiqColors.SurfaceTint,
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp)
                .height(460.dp),
        ) {
            ShellPlateCanvas(
                courseCount = courseCount,
                platesPerCourse = platesPerCourse,
                offsetMode = offsetMode,
                offsetStartRow = offsetStartRow,
                modifier = Modifier
                    .align(Alignment.Center)
                    .fillMaxWidth()
                    .height(340.dp),
            )
        }
    }
}

@Composable
private fun ShellPlateCanvas(
    courseCount: Int,
    platesPerCourse: Int,
    offsetMode: String,
    offsetStartRow: V2ShellOffsetStartRow,
    modifier: Modifier = Modifier,
) {
    val brandColor = LaiqColors.BrandTeal
    val borderColor = LaiqColors.BrandTeal.copy(alpha = 0.48f)
    val mutedColor = LaiqColors.MutedText
    Canvas(modifier = modifier) {
        val labelWidth = 46.dp.toPx()
        val topPadding = 18.dp.toPx()
        val bottomPadding = 12.dp.toPx()
        val left = labelWidth
        val right = size.width - 4.dp.toPx()
        val availableWidth = (right - left).coerceAtLeast(120.dp.toPx())
        val rowHeight = ((size.height - topPadding - bottomPadding) / courseCount.coerceAtLeast(1))
            .coerceAtLeast(28.dp.toPx())
        val offsetCells = when (offsetMode) {
            "half_plate" -> 0.5f
            "one_plate" -> 1f
            else -> 0f
        }
        val cellWidth = availableWidth / (platesPerCourse.coerceAtLeast(1) + max(offsetCells, 0.35f))
        val cellGap = 2.dp.toPx()
        val labelPaint = android.graphics.Paint().apply {
            color = mutedColor.toArgb()
            textSize = 12.dp.toPx()
            isAntiAlias = true
        }
        val platePaint = android.graphics.Paint().apply {
            color = brandColor.toArgb()
            textSize = 10.dp.toPx()
            textAlign = android.graphics.Paint.Align.CENTER
            isAntiAlias = true
        }

        repeat(courseCount.coerceAtLeast(1)) { rowIndex ->
            val courseNo = courseCount - rowIndex
            val y = topPadding + rowIndex * rowHeight
            val shouldOffset = when (offsetStartRow) {
                V2ShellOffsetStartRow.ODD -> courseNo % 2 == 1
                V2ShellOffsetStartRow.EVEN -> courseNo % 2 == 0
            }
            val rowOffset = if (shouldOffset) offsetCells * cellWidth else 0f

            drawContext.canvas.nativeCanvas.drawText(
                "C$courseNo",
                0f,
                y + rowHeight * 0.62f,
                labelPaint,
            )

            repeat(platesPerCourse.coerceAtLeast(1)) { plateIndex ->
                val x = left + rowOffset + plateIndex * cellWidth
                val width = (cellWidth - cellGap).coerceAtLeast(8.dp.toPx())
                val height = (rowHeight - cellGap).coerceAtLeast(20.dp.toPx())
                drawRect(
                    color = Color.White,
                    topLeft = Offset(x, y),
                    size = Size(width, height),
                )
                drawRect(
                    color = borderColor,
                    topLeft = Offset(x, y),
                    size = Size(width, height),
                    style = Stroke(width = 1.2.dp.toPx()),
                )
                if (platesPerCourse <= 16) {
                    drawContext.canvas.nativeCanvas.drawText(
                        "${plateIndex + 1}",
                        x + width / 2f,
                        y + height * 0.62f,
                        platePaint,
                    )
                }
            }
        }
    }
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

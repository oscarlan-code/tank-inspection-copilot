package ai.laiq.tankinspection.presentation.v2.layoutsetup

import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.domain.model.RotationDirection
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqCountField
import ai.laiq.tankinspection.presentation.components.LaiqDropdownField
import ai.laiq.tankinspection.presentation.components.LaiqOptionChips
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

enum class LayoutSurfaceSelection(val key: String, val label: String) {
    ROOF("roof", "Roof"),
    SHELL("shell", "Shell"),
    FLOOR("floor", "Floor"),
}

private data class LayoutMapSetupPreviewState(
    val selectedSurface: LayoutSurfaceSelection = LayoutSurfaceSelection.ROOF,
    val roofScope: String = "external",
    val referenceMode: String = "tank_north",
    val rotationDirection: RotationDirection = RotationDirection.CLOCKWISE,
    val roofPattern: RoofTemplate = RoofTemplate.CONE_RADIAL,
    val roofRingCount: String = "3",
    val roofSectorCount: String = "20",
    val roofRowCount: String = "4",
    val roofWidestRowPlateCount: String = "10",
    val roofHasAnnularRing: Boolean = true,
    val roofAnnularSectionCount: String = "12",
    val shellCourseCount: String = "6",
    val shellLineCount: String = "4",
    val floorTemplate: String = "radial_annular",
    val floorPlateCount: String = "18",
    val floorAnnularSectionCount: String = "12",
)

private val surfaceOptions = LayoutSurfaceSelection.values().map { it.key to it.label }

private val roofScopeOptions = listOf(
    "external" to "External Roof",
    "internal" to "Internal Roof",
)

private val referenceModeOptions = listOf(
    "tank_north" to "Tank North",
    "true_north" to "True North",
)

private val rotationOptions = listOf(
    RotationDirection.CLOCKWISE.name to "Clockwise",
    RotationDirection.COUNTERCLOCKWISE.name to "Counterclockwise",
)

private val roofPatternOptions = listOf(
    RoofTemplate.CONE_RADIAL.name to "Cone Radial",
    RoofTemplate.UMBRELLA_RADIAL.name to "Umbrella Radial",
    RoofTemplate.CIRCULAR_PLATE.name to "Circular Plate",
    RoofTemplate.CIRCULAR_CENTER_OPENING.name to "Center Opening",
)

private val floorTemplateOptions = listOf(
    "radial_annular" to "Radial + Annular",
    "parallel_annular" to "Parallel + Annular",
    "annular_only" to "Annular Only",
)

@Composable
fun V2LayoutMapSetupScreen(
    onBack: () -> Unit,
    onContinue: (LayoutSurfaceSelection) -> Unit,
    contentPadding: PaddingValues = PaddingValues(0.dp),
) {
    var state by remember { mutableStateOf(LayoutMapSetupPreviewState()) }
    val usesRadialRoofPattern = state.roofPattern == RoofTemplate.CONE_RADIAL ||
        state.roofPattern == RoofTemplate.UMBRELLA_RADIAL

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
            LaiqSectionCard(title = "Layout Surface") {
                LaiqOptionChips(
                    selectedValue = state.selectedSurface.key,
                    options = surfaceOptions,
                    onSelect = { selected ->
                        state = state.copy(
                            selectedSurface = LayoutSurfaceSelection.values().first { it.key == selected },
                        )
                    },
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LaiqStatChip("Tank", "465", modifier = Modifier.weight(1f))
                    LaiqStatChip(
                        "Active",
                        state.selectedSurface.label,
                        modifier = Modifier.weight(1f),
                    )
                    LaiqStatChip("Roof", "Cone", modifier = Modifier.weight(1f))
                }
            }
        }

        item {
            when (state.selectedSurface) {
                LayoutSurfaceSelection.ROOF -> {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        LaiqSectionCard(title = "Roof Setup") {
                            TwoUpFields(
                                left = {
                                    LaiqDropdownField(
                                        label = "Roof Scope",
                                        value = state.roofScope,
                                        options = roofScopeOptions,
                                        onSelected = { state = state.copy(roofScope = it) },
                                    )
                                },
                                right = {
                                    LaiqDropdownField(
                                        label = "0° Reference",
                                        value = state.referenceMode,
                                        options = referenceModeOptions,
                                        onSelected = { state = state.copy(referenceMode = it) },
                                    )
                                },
                            )
                            TwoUpFields(
                                left = {
                                    LaiqDropdownField(
                                        label = "Roof Pattern",
                                        value = state.roofPattern.name,
                                        options = roofPatternOptions,
                                        onSelected = { selected ->
                                            state = state.copy(roofPattern = enumValueOf(selected))
                                        },
                                    )
                                },
                                right = {
                                    LaiqDropdownField(
                                        label = "Rotation",
                                        value = state.rotationDirection.name,
                                        options = rotationOptions,
                                        onSelected = { selected ->
                                            state = state.copy(rotationDirection = enumValueOf(selected))
                                        },
                                    )
                                },
                            )
                        }
                        LaiqSectionCard(title = "Roof Counts") {
                            if (usesRadialRoofPattern) {
                                TwoUpFields(
                                    left = {
                                        LaiqCountField(
                                            label = "Ring Count",
                                            value = state.roofRingCount,
                                            onValueChange = { state = state.copy(roofRingCount = it) },
                                            min = 1,
                                            max = 12,
                                        )
                                    },
                                    right = {
                                        LaiqCountField(
                                            label = "Sector Count",
                                            value = state.roofSectorCount,
                                            onValueChange = { state = state.copy(roofSectorCount = it) },
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
                                            onValueChange = { state = state.copy(roofRowCount = it) },
                                            min = 1,
                                            max = 12,
                                        )
                                    },
                                    right = {
                                        LaiqCountField(
                                            label = "Widest Row Plate Count",
                                            value = state.roofWidestRowPlateCount,
                                            onValueChange = {
                                                state = state.copy(roofWidestRowPlateCount = it)
                                            },
                                            min = 4,
                                            max = 40,
                                        )
                                    },
                                )
                                Text(
                                    "Annular Ring",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = LaiqColors.BodyText,
                                    fontWeight = FontWeight.Medium,
                                )
                                LaiqOptionChips(
                                    selectedValue = if (state.roofHasAnnularRing) "yes" else "no",
                                    options = listOf("yes" to "Yes", "no" to "No"),
                                    onSelect = { selected ->
                                        state = state.copy(roofHasAnnularRing = selected == "yes")
                                    },
                                )
                                if (state.roofHasAnnularRing) {
                                    LaiqCountField(
                                        label = "Annular Section Count",
                                        value = state.roofAnnularSectionCount,
                                        onValueChange = {
                                            state = state.copy(roofAnnularSectionCount = it)
                                        },
                                        min = 4,
                                        max = 40,
                                    )
                                }
                            }
                        }
                    }
                }

                LayoutSurfaceSelection.SHELL -> {
                    LaiqSectionCard(title = "Shell Setup") {
                        TwoUpFields(
                            left = {
                                LaiqDropdownField(
                                    label = "0° Reference",
                                    value = state.referenceMode,
                                    options = referenceModeOptions,
                                    onSelected = { state = state.copy(referenceMode = it) },
                                )
                            },
                            right = {
                                LaiqDropdownField(
                                    label = "Rotation",
                                    value = state.rotationDirection.name,
                                    options = rotationOptions,
                                    onSelected = { selected ->
                                        state = state.copy(rotationDirection = enumValueOf(selected))
                                    },
                                )
                            },
                        )
                        TwoUpFields(
                            left = {
                                LaiqCountField(
                                    label = "Course Count",
                                    value = state.shellCourseCount,
                                    onValueChange = { state = state.copy(shellCourseCount = it) },
                                    min = 1,
                                    max = 12,
                                )
                            },
                            right = {
                                LaiqCountField(
                                    label = "Line Count",
                                    value = state.shellLineCount,
                                    onValueChange = { state = state.copy(shellLineCount = it) },
                                    min = 1,
                                    max = 12,
                                )
                            },
                        )
                    }
                }

                LayoutSurfaceSelection.FLOOR -> {
                    LaiqSectionCard(title = "Floor Setup") {
                        TwoUpFields(
                            left = {
                                LaiqDropdownField(
                                    label = "Floor Template",
                                    value = state.floorTemplate,
                                    options = floorTemplateOptions,
                                    onSelected = { state = state.copy(floorTemplate = it) },
                                )
                            },
                            right = {
                                LaiqDropdownField(
                                    label = "0° Reference",
                                    value = state.referenceMode,
                                    options = referenceModeOptions,
                                    onSelected = { state = state.copy(referenceMode = it) },
                                )
                            },
                        )
                        TwoUpFields(
                            left = {
                                LaiqCountField(
                                    label = "Plate Count",
                                    value = state.floorPlateCount,
                                    onValueChange = { state = state.copy(floorPlateCount = it) },
                                    min = 1,
                                    max = 60,
                                )
                            },
                            right = {
                                LaiqCountField(
                                    label = "Annular Sections",
                                    value = state.floorAnnularSectionCount,
                                    onValueChange = { state = state.copy(floorAnnularSectionCount = it) },
                                    min = 4,
                                    max = 40,
                                )
                            },
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
                    text = "Continue",
                    onClick = { onContinue(state.selectedSurface) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

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

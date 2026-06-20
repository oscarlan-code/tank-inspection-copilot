package ai.laiq.tankinspection.presentation.v3product.rooflayout

import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqCountField
import ai.laiq.tankinspection.presentation.components.LaiqDropdownField
import ai.laiq.tankinspection.presentation.components.LaiqOptionChips
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.components.RoofSurfaceMap
import ai.laiq.tankinspection.v3product.model.ProductReferenceMode
import ai.laiq.tankinspection.v3product.model.ProductRoofLayoutMap
import ai.laiq.tankinspection.v3product.model.ProductRoofScope
import ai.laiq.tankinspection.v3product.model.withRoofScopeDefaults
import ai.laiq.tankinspection.v3product.model.withTemplateDefaults
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private val roofSurfaceOptions = listOf(
    ProductRoofScope.EXTERNAL.key to ProductRoofScope.EXTERNAL.label,
    ProductRoofScope.INTERNAL.key to ProductRoofScope.INTERNAL.label,
)

private val referenceModeOptions = listOf(
    ProductReferenceMode.TANK_NORTH.key to ProductReferenceMode.TANK_NORTH.label,
    ProductReferenceMode.TRUE_NORTH.key to ProductReferenceMode.TRUE_NORTH.label,
)

private val yesNoOptions = listOf(
    "yes" to "Yes",
    "no" to "No",
)

private val roofTemplateOptions = listOf(
    RoofTemplate.CONE_RADIAL to "Cone Radial",
    RoofTemplate.UMBRELLA_RADIAL to "Umbrella Radial",
    RoofTemplate.CIRCULAR_PLATE to "Circular Plate",
)

@Composable
fun ProductRoofLayoutMapScreen(
    state: ProductRoofLayoutMap,
    onStateChange: (ProductRoofLayoutMap) -> Unit,
    onBack: () -> Unit,
    onContinue: () -> Unit,
    contentPadding: PaddingValues = PaddingValues(0.dp),
) {
    val templateOptions = roofTemplateOptions
    val resolvedTemplate = state.template.takeIf { template ->
        templateOptions.any { option -> option.first == template }
    }
        ?: templateOptions.firstOrNull()?.first
        ?: RoofTemplate.CONE_RADIAL
    if (resolvedTemplate != state.template) {
        onStateChange(state.withTemplateDefaults(resolvedTemplate))
    }

    val usesCircularPlateMap = resolvedTemplate == RoofTemplate.CIRCULAR_PLATE ||
        resolvedTemplate == RoofTemplate.CIRCULAR_CENTER_OPENING
    val usesRadialMap = resolvedTemplate == RoofTemplate.CONE_RADIAL ||
        resolvedTemplate == RoofTemplate.UMBRELLA_RADIAL
    val mapReferenceLabel = state.referenceMode.label
    val mapRowCount = state.rowCount.toIntOrNull()?.coerceAtLeast(1) ?: 5
    val mapWidestRowPlateCount = state.widestRowPlateCount.toIntOrNull()?.coerceAtLeast(4) ?: 14
    val mapRingCount = state.ringCount.toIntOrNull()?.coerceAtLeast(1) ?: 6
    val mapSectorCount = state.sectorCount.toIntOrNull()?.coerceAtLeast(4) ?: 18
    val mapAnnularSectionCount = state.annularSectionCount.toIntOrNull()?.coerceAtLeast(4) ?: 18

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
                "Roof Layout Map",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.SemiBold,
                color = LaiqColors.BrandTeal,
                modifier = Modifier.padding(horizontal = 4.dp),
            )
        }

        item {
            LaiqSectionCard(title = "Map Basis") {
                TwoUpFields(
                    left = {
                        LaiqDropdownField(
                            label = "Roof Surface",
                            value = state.roofScope.key,
                            options = roofSurfaceOptions,
                            onSelected = { scopeKey ->
                                onStateChange(
                                    state.withRoofScopeDefaults(
                                        ProductRoofScope.entries.first { option -> option.key == scopeKey },
                                    ),
                                )
                            },
                        )
                    },
                    right = {
                        LaiqDropdownField(
                            label = "0° Reference",
                            value = state.referenceMode.key,
                            options = referenceModeOptions,
                            onSelected = {
                                onStateChange(
                                    state.copy(
                                        referenceMode = ProductReferenceMode.entries.first { option -> option.key == it },
                                    ),
                                )
                            },
                        )
                    },
                )
                LaiqDropdownField(
                    label = "Map Pattern",
                    value = resolvedTemplate.name,
                    options = templateOptions.map { it.first.name to it.second },
                    onSelected = { selected ->
                        onStateChange(state.withTemplateDefaults(enumValueOf(selected)))
                    },
                )
            }
        }

        item {
            LaiqSectionCard(title = "Roof Layout Map") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LaiqStatChip("Surface", state.roofScope.label, modifier = Modifier.weight(1f))
                    LaiqStatChip("Pattern", templateLabel(resolvedTemplate), modifier = Modifier.weight(1f))
                    LaiqStatChip("0° Ref", mapReferenceLabel, modifier = Modifier.weight(1f))
                }
                BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
                    val mapModifier = if (maxWidth >= 760.dp) {
                        Modifier
                            .fillMaxWidth()
                            .aspectRatio(1f)
                    } else {
                        Modifier
                            .fillMaxWidth()
                            .aspectRatio(1f)
                    }
                    RoofSurfaceMap(
                        template = resolvedTemplate,
                        rowCount = mapRowCount,
                        widestRowPlateCount = mapWidestRowPlateCount,
                        ringCount = mapRingCount,
                        sectorCount = mapSectorCount,
                        activePlateId = null,
                        savedPlateIds = emptySet(),
                        overlayPlateIds = emptySet(),
	                        centerFeatureCount = if (state.hasCenterOpening) {
	                            1
	                        } else {
	                            0
	                        },
                        centerFeatureCountControlsLayout = true,
                        hasAnnularRing = state.hasAnnularRing,
                        annularSectionCount = if (state.hasAnnularRing) mapAnnularSectionCount else 0,
                        hasPontoonDeck = false,
                        markers = emptyList(),
                        showMarkerLabels = false,
                        showMarkerCallouts = false,
                        referenceLabel = mapReferenceLabel,
                        referenceAzimuthDeg = 0.0,
                        rotationDirection = state.rotationDirection,
                        onSelectPosition = null,
                        onSelectPlate = {},
                        modifier = mapModifier,
                    )
                }
            }
        }

        item {
            LaiqSectionCard(title = "Pattern Setup") {
                if (usesCircularPlateMap) {
                    TwoUpFields(
                        left = {
                            LaiqCountField(
                                label = "Row Count",
                                value = state.rowCount,
                                onValueChange = { onStateChange(state.copy(rowCount = it)) },
                                min = 1,
                                max = 12,
                            )
                        },
                        right = {
                            LaiqCountField(
                                label = "Widest Row Plate Count",
                                value = state.widestRowPlateCount,
                                onValueChange = { onStateChange(state.copy(widestRowPlateCount = it)) },
                                min = 4,
                                max = 40,
                            )
                        },
                    )
                }

                if (usesRadialMap) {
                    TwoUpFields(
                        left = {
                            LaiqCountField(
                                label = "Ring Count",
                                value = state.ringCount,
                                onValueChange = { onStateChange(state.copy(ringCount = it)) },
                                min = 1,
                                max = 16,
                            )
                        },
                        right = {
                            LaiqCountField(
                                label = "Sector Count",
                                value = state.sectorCount,
                                onValueChange = { onStateChange(state.copy(sectorCount = it)) },
                                min = 4,
                                max = 36,
                            )
                        },
                    )
                }

                TwoUpFields(
                    left = {
                        RoofOptionChips(
                            label = "Center Opening",
	                            selected = state.hasCenterOpening,
	                            onSelect = { selected ->
	                                onStateChange(
	                                    state.copy(
	                                        hasCenterOpening = selected,
	                                        centerOpeningPlateCount = "1",
	                                    ),
	                                )
	                            },
                        )
                    },
                    right = {
                        RoofOptionChips(
                            label = "Annular Ring",
                            selected = state.hasAnnularRing,
                            onSelect = { selected ->
                                onStateChange(
                                    state.copy(
                                        hasAnnularRing = selected,
                                        annularSectionCount = if (selected) {
                                            state.annularSectionCount.ifBlank { "18" }
                                        } else {
                                            state.annularSectionCount
                                        },
                                    ),
                                )
                            },
                        )
                    },
                )
                if (state.hasCenterOpening) {
                    LaiqStatChip(
                        label = "Center Opening",
                        value = "1 default",
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                if (state.hasAnnularRing) {
                    LaiqCountField(
                        label = "Annular Ring Plates",
                        value = state.annularSectionCount,
                        onValueChange = { onStateChange(state.copy(annularSectionCount = it)) },
                        min = 4,
                        max = 40,
                    )
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
                    onClick = onContinue,
                    modifier = Modifier.weight(1f),
                )
            }
        }
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
private fun TwoUpFields(
    left: @Composable () -> Unit,
    right: @Composable () -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(modifier = Modifier.weight(1f)) { left() }
        Column(modifier = Modifier.weight(1f)) { right() }
    }
}

private fun templateLabel(template: RoofTemplate): String = when (template) {
    RoofTemplate.CIRCULAR_PLATE -> "Circular Plate"
    RoofTemplate.CIRCULAR_CENTER_OPENING -> "Circular Plate"
    RoofTemplate.CONE_RADIAL -> "Cone Radial"
    RoofTemplate.UMBRELLA_RADIAL -> "Umbrella Radial"
}

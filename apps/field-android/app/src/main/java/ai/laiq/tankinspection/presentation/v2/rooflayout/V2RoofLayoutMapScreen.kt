package ai.laiq.tankinspection.presentation.v2.rooflayout

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
import ai.laiq.tankinspection.presentation.components.RoofSurfaceMap
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private data class RoofLayoutPreviewState(
    val roofSurface: String,
    val referenceMode: String,
    val rotationDirection: RotationDirection,
    val template: RoofTemplate,
    val rowCount: String,
    val widestRowPlateCount: String,
    val ringCount: String,
    val sectorCount: String,
    val hasAnnularRing: Boolean,
    val annularSectionCount: String,
)

private val roofSurfaceOptions = listOf(
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

@Composable
fun V2RoofLayoutMapScreen(
    onBack: () -> Unit,
    onContinue: () -> Unit,
    contentPadding: PaddingValues = PaddingValues(0.dp),
) {
    var state by remember { mutableStateOf(defaultRoofLayoutPreviewState()) }
    val templateOptions = templateOptionsForSurface(state.roofSurface)
    val resolvedTemplate = state.template.takeIf { template ->
        templateOptions.any { option -> option.first == template }
    }
        ?: templateOptions.firstOrNull()?.first
        ?: RoofTemplate.CONE_RADIAL
    if (resolvedTemplate != state.template) {
        state = state.withTemplateDefaults(resolvedTemplate)
    }

    val usesCircularPlateMap = resolvedTemplate == RoofTemplate.CIRCULAR_PLATE ||
        resolvedTemplate == RoofTemplate.CIRCULAR_CENTER_OPENING
    val usesRadialMap = resolvedTemplate == RoofTemplate.CONE_RADIAL ||
        resolvedTemplate == RoofTemplate.UMBRELLA_RADIAL
    val mapReferenceLabel = if (state.referenceMode == "true_north") "True North" else "Tank North"
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
                            value = state.roofSurface,
                            options = roofSurfaceOptions,
                            onSelected = { surface ->
                                state = state.withSurfaceDefaults(surface)
                            },
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
                            label = "Map Pattern",
                            value = resolvedTemplate.name,
                            options = templateOptions.map { it.first.name to it.second },
                            onSelected = { selected ->
                                state = state.withTemplateDefaults(enumValueOf(selected))
                            },
                        )
                    },
                    right = {
                        LaiqDropdownField(
                            label = "Rotation",
                            value = state.rotationDirection.name,
                            options = rotationOptions,
                            onSelected = { state = state.copy(rotationDirection = enumValueOf(it)) },
                        )
                    },
                )
            }
        }

        item {
            LaiqSectionCard(title = "Roof Layout Map") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LaiqStatChip("Surface", roofSurfaceLabel(state.roofSurface), modifier = Modifier.weight(1f))
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
                        centerFeatureCount = if (resolvedTemplate == RoofTemplate.CIRCULAR_CENTER_OPENING) 1 else 0,
                        hasAnnularRing = usesCircularPlateMap && state.hasAnnularRing,
                        annularSectionCount = if (usesCircularPlateMap && state.hasAnnularRing) mapAnnularSectionCount else 0,
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
                                onValueChange = { state = state.copy(rowCount = it) },
                                min = 1,
                                max = 12,
                            )
                        },
                        right = {
                            LaiqCountField(
                                label = "Widest Row Plate Count",
                                value = state.widestRowPlateCount,
                                onValueChange = { state = state.copy(widestRowPlateCount = it) },
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
                        selectedValue = if (state.hasAnnularRing) "yes" else "no",
                        options = listOf("yes" to "Yes", "no" to "No"),
                        onSelect = { selected ->
                            state = state.copy(hasAnnularRing = selected == "yes")
                        },
                    )
                    if (state.hasAnnularRing) {
                        LaiqCountField(
                            label = "Annular Section Count",
                            value = state.annularSectionCount,
                            onValueChange = { state = state.copy(annularSectionCount = it) },
                            min = 4,
                            max = 40,
                        )
                    }
                }

                if (usesRadialMap) {
                    TwoUpFields(
                        left = {
                            LaiqCountField(
                                label = "Ring Count",
                                value = state.ringCount,
                                onValueChange = { state = state.copy(ringCount = it) },
                                min = 1,
                                max = 16,
                            )
                        },
                        right = {
                            LaiqCountField(
                                label = "Sector Count",
                                value = state.sectorCount,
                                onValueChange = { state = state.copy(sectorCount = it) },
                                min = 4,
                                max = 36,
                            )
                        },
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
private fun TwoUpFields(
    left: @Composable () -> Unit,
    right: @Composable () -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(modifier = Modifier.weight(1f)) { left() }
        Column(modifier = Modifier.weight(1f)) { right() }
    }
}

private fun roofSurfaceLabel(surface: String): String = when (surface) {
    "internal" -> "Internal Roof"
    else -> "External Roof"
}

private fun templateLabel(template: RoofTemplate): String = when (template) {
    RoofTemplate.CIRCULAR_PLATE -> "Circular Plate"
    RoofTemplate.CIRCULAR_CENTER_OPENING -> "Center Opening"
    RoofTemplate.CONE_RADIAL -> "Cone Radial"
    RoofTemplate.UMBRELLA_RADIAL -> "Umbrella Radial"
}

private fun templateOptionsForSurface(surface: String): List<Pair<RoofTemplate, String>> =
    if (surface == "internal") {
        listOf(
            RoofTemplate.CIRCULAR_PLATE to "Circular Plate",
            RoofTemplate.CIRCULAR_CENTER_OPENING to "Circular Plate + Center Opening",
        )
    } else {
        listOf(
            RoofTemplate.CONE_RADIAL to "Cone Radial",
            RoofTemplate.UMBRELLA_RADIAL to "Umbrella Radial",
            RoofTemplate.CIRCULAR_PLATE to "Circular Plate",
        )
    }

private fun defaultRoofLayoutPreviewState(): RoofLayoutPreviewState =
    RoofLayoutPreviewState(
        roofSurface = "external",
        referenceMode = "tank_north",
        rotationDirection = RotationDirection.CLOCKWISE,
        template = RoofTemplate.CONE_RADIAL,
        rowCount = "5",
        widestRowPlateCount = "14",
        ringCount = "6",
        sectorCount = "18",
        hasAnnularRing = true,
        annularSectionCount = "18",
    ).withTemplateDefaults(RoofTemplate.CONE_RADIAL)

private fun RoofLayoutPreviewState.withSurfaceDefaults(surface: String): RoofLayoutPreviewState {
    val nextTemplate = if (surface == "internal") {
        RoofTemplate.CIRCULAR_CENTER_OPENING
    } else {
        RoofTemplate.CONE_RADIAL
    }
    return copy(roofSurface = surface).withTemplateDefaults(nextTemplate)
}

private fun RoofLayoutPreviewState.withTemplateDefaults(template: RoofTemplate): RoofLayoutPreviewState =
    when (template) {
        RoofTemplate.CIRCULAR_PLATE -> copy(
            template = template,
            rowCount = "5",
            widestRowPlateCount = "14",
            hasAnnularRing = true,
            annularSectionCount = "18",
        )
        RoofTemplate.CIRCULAR_CENTER_OPENING -> copy(
            template = template,
            rowCount = "5",
            widestRowPlateCount = "14",
            hasAnnularRing = true,
            annularSectionCount = "18",
        )
        RoofTemplate.CONE_RADIAL -> copy(
            template = template,
            ringCount = "6",
            sectorCount = "18",
        )
        RoofTemplate.UMBRELLA_RADIAL -> copy(
            template = template,
            ringCount = "8",
            sectorCount = "20",
        )
    }

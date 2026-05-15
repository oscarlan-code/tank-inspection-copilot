package ai.laiq.tankinspection.presentation.screens

import ai.laiq.tankinspection.domain.model.MeasurementUnit
import ai.laiq.tankinspection.domain.model.NozzleSizeUnit
import ai.laiq.tankinspection.domain.model.ReferenceMode
import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.domain.model.RotationDirection
import ai.laiq.tankinspection.domain.usecase.ShellLinePlanner
import ai.laiq.tankinspection.presentation.RoofLayoutDraftInput
import ai.laiq.tankinspection.presentation.ScopeFormState
import ai.laiq.tankinspection.presentation.SetupFormState
import ai.laiq.tankinspection.presentation.buildRoofLayoutFromDraftOrNull
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqCountField
import ai.laiq.tankinspection.presentation.components.LaiqDropdownField
import ai.laiq.tankinspection.presentation.components.LaiqOptionChips
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.components.RoofSurfaceMap
import ai.laiq.tankinspection.presentation.components.ShellMapLineVisual
import ai.laiq.tankinspection.presentation.components.ShellSurfaceMap
import ai.laiq.tankinspection.presentation.displayLinesForMap
import ai.laiq.tankinspection.presentation.isReadyForInspection
import ai.laiq.tankinspection.presentation.label
import ai.laiq.tankinspection.presentation.normalizedReferenceMode
import ai.laiq.tankinspection.presentation.referenceAzimuthDeg
import ai.laiq.tankinspection.presentation.resolvedStartReference
import ai.laiq.tankinspection.presentation.roofReferenceLabel
import ai.laiq.tankinspection.presentation.roofTemplateForRoofType
import ai.laiq.tankinspection.presentation.startReferenceLabel
import ai.laiq.tankinspection.presentation.usesMarkerReference
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

private val roofTypeOptions = listOf(
    "fixed_cone" to "Fixed Cone",
    "fixed_dome" to "Fixed Dome",
    "umbrella" to "Umbrella",
    "external_floating" to "External Floating",
    "internal_floating" to "Internal Floating",
    "double_deck_floating" to "Double Deck Floating",
    "other" to "Other",
)

private val referenceModeOptions = listOf(
    ReferenceMode.TRUE_NORTH.name to "True North",
    ReferenceMode.TANK_NORTH.name to "Tank North / Site Marker",
)

private val thicknessUnitOptions = MeasurementUnit.entries.map { unit -> unit.name to unit.label() }
private val nozzleSizeUnitOptions = NozzleSizeUnit.entries.map { unit -> unit.name to unit.label() }

@Composable
fun InspectionSetupScreen(
    state: SetupFormState,
    scopeState: ScopeFormState,
    roofLayoutDraft: RoofLayoutDraftInput,
    lineCountOverride: String,
    shellCaptureStartLaneId: String,
    recommendedLineCount: Int?,
    hasPendingFundamentalChanges: Boolean,
    hasPendingShellPlanningChanges: Boolean,
    onStateChange: (SetupFormState) -> Unit,
    onScopeStateChange: (ScopeFormState) -> Unit,
    onRoofLayoutDraftChange: (RoofLayoutDraftInput) -> Unit,
    onLineCountOverrideChange: (String) -> Unit,
    onShellCaptureStartLaneIdChange: (String) -> Unit,
    onContinue: () -> Unit,
    onLoadDemo: () -> Unit,
    contentPadding: PaddingValues,
) {
    val normalizedReferenceMode = scopeState.normalizedReferenceMode()
    val resolvedLineCount =
        ShellLinePlanner.normalizedLineCount(lineCountOverride.toIntOrNull()?.takeIf { it > 0 }) ?: recommendedLineCount
    val crawlerLaneOptions = resolvedLineCount?.let { ShellLinePlanner.laneOptions(it) }.orEmpty()
    val resolvedCaptureStartLaneId = crawlerLaneOptions.firstOrNull { option -> option.first == shellCaptureStartLaneId }?.first
        ?: crawlerLaneOptions.firstOrNull()?.first.orEmpty()
    val estimatedLaneSpacingM = state.diameterM.toDoubleOrNull()
        ?.takeIf { diameter -> diameter > 0 && resolvedLineCount != null && resolvedLineCount > 0 }
        ?.let { diameter -> ShellLinePlanner.spacingM(diameter, resolvedLineCount!!) }
    val isClientOverrideBelowRecommendation = recommendedLineCount != null &&
        resolvedLineCount != null &&
        lineCountOverride.isNotBlank() &&
        resolvedLineCount < recommendedLineCount
    val shellCourseCount = state.shellCourseCount.toIntOrNull()?.takeIf { it > 0 } ?: 0
    val shellLinePlan = state.diameterM.toDoubleOrNull()
        ?.takeIf { diameter -> diameter > 0 }
        ?.let { diameter ->
            ShellLinePlanner.createPlan(
                diameterM = diameter,
                explicitLineCount = ShellLinePlanner.normalizedLineCount(lineCountOverride.toIntOrNull()?.takeIf { it > 0 }),
                referenceMode = scopeState.normalizedReferenceMode(),
                startReference = scopeState.resolvedStartReference(),
                startReferenceLabel = scopeState.startReferenceLabel(),
                rotationDirection = scopeState.rotationDirection,
                captureStartLaneId = resolvedCaptureStartLaneId.ifBlank { null },
            )
        }
    val displayedShellLines = shellLinePlan?.displayLinesForMap().orEmpty()
    val startLaneLabel = shellLinePlan?.lines?.firstOrNull { line -> line.lineId == shellLinePlan.captureStartLaneId }?.label
        ?: shellLinePlan?.lines?.firstOrNull()?.label
    val allowedRoofTemplates = when (roofTemplateForRoofType(state.roofType)) {
        RoofTemplate.UMBRELLA_RADIAL -> listOf(RoofTemplate.UMBRELLA_RADIAL)
        RoofTemplate.CIRCULAR_PLATE,
        RoofTemplate.CIRCULAR_CENTER_OPENING -> listOf(
            RoofTemplate.CIRCULAR_PLATE,
            RoofTemplate.CIRCULAR_CENTER_OPENING,
        )
    }
    val normalizedRoofLayoutDraft = roofLayoutDraft.copy(
        template = roofLayoutDraft.template.takeIf { template -> allowedRoofTemplates.contains(template) }
            ?: allowedRoofTemplates.first(),
    )
    val roofLayoutPreview = buildRoofLayoutFromDraftOrNull(normalizedRoofLayoutDraft)
    val roofLayoutValidationMessage = setupRoofLayoutValidationMessage(normalizedRoofLayoutDraft)
    val roofReferenceLabel = scopeState.roofReferenceLabel()
    val roofReferenceAzimuth = scopeState.referenceAzimuthDeg()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = 16.dp,
            end = 16.dp,
            top = contentPadding.calculateTopPadding() + 12.dp,
            bottom = 24.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            LaiqSectionCard(
                title = "Tank Setup",
                subtitle = "Minimum tank data for the local-first inspection package.",
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LaiqStatChip("Draft", "Local Only", modifier = Modifier.weight(1f))
                    LaiqStatChip("Target", "Android Tablet", modifier = Modifier.weight(1f))
                }
                Text(
                    "Complete the tank identity and geometry first. Shell crawler lanes and the roof plate map are both derived from this locked baseline.",
                    style = MaterialTheme.typography.bodySmall,
                )
                LaiqSecondaryButton(
                    text = "Load Demo Inspection",
                    onClick = onLoadDemo,
                )
            }
        }

        item {
            LaiqSectionCard(
                title = "Inspection Identity",
                subtitle = "Who, where, and which tank.",
            ) {
                OutlinedTextField(
                    value = state.client,
                    onValueChange = { onStateChange(state.copy(client = it)) },
                    label = { Text("Client") },
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = state.site,
                    onValueChange = { onStateChange(state.copy(site = it)) },
                    label = { Text("Site") },
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = state.tankNumber,
                    onValueChange = { onStateChange(state.copy(tankNumber = it)) },
                    label = { Text("Tank Number") },
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = state.inspector,
                    onValueChange = { onStateChange(state.copy(inspector = it)) },
                    label = { Text("Inspector") },
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        item {
            LaiqSectionCard(
                title = "Shell Layout Baseline",
                subtitle = "Set the shell geometry, 0° reference, crawler lane plan, and confirm the shell map in the same place.",
            ) {
                OutlinedTextField(
                    value = state.diameterM,
                    onValueChange = { onStateChange(state.copy(diameterM = it)) },
                    label = { Text("Diameter (m)") },
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
                OutlinedTextField(
                    value = state.heightM,
                    onValueChange = { onStateChange(state.copy(heightM = it)) },
                    label = { Text("Height (m)") },
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
                LaiqCountField(
                    label = "Shell Course Count",
                    value = state.shellCourseCount,
                    onValueChange = { onStateChange(state.copy(shellCourseCount = it)) },
                    min = 0,
                    max = 20,
                )
                LaiqDropdownField(
                    label = "Thickness Unit",
                    value = state.thicknessUnit.name,
                    options = thicknessUnitOptions,
                    onSelected = { onStateChange(state.copy(thicknessUnit = MeasurementUnit.valueOf(it))) },
                )
                LaiqDropdownField(
                    label = "Nozzle Size Unit",
                    value = state.nozzleSizeUnit.name,
                    options = nozzleSizeUnitOptions,
                    onSelected = { onStateChange(state.copy(nozzleSizeUnit = NozzleSizeUnit.valueOf(it))) },
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LaiqStatChip(
                        "Recommended Lanes",
                        recommendedLineCount?.toString() ?: "—",
                        modifier = Modifier.weight(1f),
                    )
                    LaiqStatChip(
                        "Using",
                        resolvedLineCount?.toString() ?: "—",
                        tone = LaiqColors.AccentOrange,
                        modifier = Modifier.weight(1f),
                    )
                }
                estimatedLaneSpacingM?.let { spacingM ->
                    LaiqStatChip(
                        "Lane Spacing",
                        "${"%.2f".format(spacingM)} m",
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                LaiqCountField(
                    label = "UT Crawler Lane Count",
                    value = lineCountOverride,
                    onValueChange = onLineCountOverrideChange,
                    min = 0,
                    max = 20,
                )
                Text(
                    "Procedure target: spacing between crawler lanes should not exceed 9.75 m, with a minimum of 4 lanes. Leave this blank to use the recommendation.",
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.MutedText,
                )
                if (isClientOverrideBelowRecommendation) {
                    Text(
                        "Client override is using fewer crawler lanes than the procedural recommendation. Estimated spacing is above the preferred maximum.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.AccentOrange,
                    )
                }
                if (crawlerLaneOptions.isNotEmpty()) {
                    LaiqDropdownField(
                        label = "Start Capture Lane",
                        value = resolvedCaptureStartLaneId,
                        options = crawlerLaneOptions,
                        onSelected = onShellCaptureStartLaneIdChange,
                    )
                    Text(
                        "Lane 1 stays fixed at the saved 0° reference. This only shifts the shell map and capture sequence so the selected lane appears first in the workflow.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                }
                Text("0° Reference", style = MaterialTheme.typography.titleSmall)
                LaiqOptionChips(
                    selectedValue = normalizedReferenceMode.name,
                    options = referenceModeOptions,
                    onSelect = { onScopeStateChange(scopeState.copy(referenceMode = ReferenceMode.valueOf(it))) },
                )
                if (scopeState.usesMarkerReference()) {
                    OutlinedTextField(
                        value = scopeState.referenceRemark,
                        onValueChange = { onScopeStateChange(scopeState.copy(referenceRemark = it)) },
                        label = { Text("Tank North / Site Marker Remark") },
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Text(
                        "Describe the physical marker used as the saved 0° reference. Lane 1, roof layout, roof elements, and nozzle locations all align from this baseline.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                } else {
                    Text(
                        "Lane 1 is fixed to the saved 0° reference. Use Start Capture Lane above only to shift the shell workflow order on the map.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                }
                Text("Direction", style = MaterialTheme.typography.titleSmall)
                LaiqOptionChips(
                    selectedValue = scopeState.rotationDirection.name,
                    options = RotationDirection.values().map {
                        it.name to it.name.lowercase().replaceFirstChar { char -> char.uppercase() }
                    },
                    onSelect = { onScopeStateChange(scopeState.copy(rotationDirection = RotationDirection.valueOf(it))) },
                )
                if (shellLinePlan == null || shellCourseCount <= 0) {
                    Text(
                        "Enter a valid diameter and shell course count to preview the crawler lane layout before continuing.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                } else {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        LaiqStatChip(
                            "0° Anchor",
                            shellLinePlan.startReference,
                            modifier = Modifier.weight(1f),
                        )
                        LaiqStatChip(
                            "Lane 1",
                            shellLinePlan.lines.firstOrNull()?.label ?: "—",
                            modifier = Modifier.weight(1f),
                        )
                        LaiqStatChip(
                            "Start",
                            startLaneLabel ?: "—",
                            tone = LaiqColors.AccentOrange,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Text(
                        "Use this preview to confirm where the shell workflow begins. `0°` stays at the saved reference, while `Start` only marks the crawler lane that appears first in Shell UT.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                    ShellSurfaceMap(
                        lines = displayedShellLines.map { line ->
                            ShellMapLineVisual(
                                lineId = line.lineId,
                                label = line.label,
                                azimuthDeg = line.azimuthDeg.toInt(),
                            )
                        },
                        courseCount = shellCourseCount,
                        activeCell = null,
                        savedCells = emptySet(),
                        overlayCells = emptySet(),
                        scaleOriginLabel = shellLinePlan.startReference,
                        anchorLaneId = shellLinePlan.lines.firstOrNull()?.lineId,
                        captureStartLaneId = shellLinePlan.captureStartLaneId,
                        enableViewportControls = false,
                        repeatCycles = false,
                        fitToViewport = true,
                        onSelectCell = { _, _ -> Unit },
                    )
                }
                when {
                    hasPendingFundamentalChanges -> Text(
                        "Saving this changed geometry/reference baseline will clear roof layout, shell and roof measurements, nozzle data, and findings so capture can restart from the new foundation.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.BrandRed,
                    )

                    hasPendingShellPlanningChanges -> Text(
                        "Saving this changed crawler lane count will clear shell-side measurements, shell nozzle data, and related findings.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.AccentOrange,
                    )
                }
            }
        }

        item {
            LaiqSectionCard(
                title = "Roof Layout Baseline",
                subtitle = "Set the roof type and plate-map basis here, then review the roof layout map directly below it.",
            ) {
                LaiqDropdownField(
                    label = "Roof Type",
                    value = state.roofType,
                    options = roofTypeOptions,
                    onSelected = { onStateChange(state.copy(roofType = it)) },
                )
                Text(
                    "Define the roof plate map here with the same locked baseline as shell layout. After setup is committed, later screens can use this map but cannot edit it.",
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.MutedText,
                )
                LaiqOptionChips(
                    selectedValue = normalizedRoofLayoutDraft.template.name,
                    options = allowedRoofTemplates.map { template -> template.name to setupRoofTemplateLabel(template) },
                    onSelect = { selected ->
                        onRoofLayoutDraftChange(
                            normalizedRoofLayoutDraft.copy(template = RoofTemplate.valueOf(selected)),
                        )
                    },
                )
                SetupRoofLayoutInputs(
                    draft = normalizedRoofLayoutDraft,
                    roofType = state.roofType,
                    onDraftChange = onRoofLayoutDraftChange,
                )
                roofLayoutValidationMessage?.let { validationMessage ->
                    Text(
                        validationMessage,
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.AccentOrange,
                    )
                }
                if (roofLayoutPreview == null || !roofLayoutPreview.isReadyForInspection()) {
                    Text(
                        "Complete the roof layout inputs above to preview the saved roof basis before continuing.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                } else {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        when (roofLayoutPreview.template) {
                            RoofTemplate.UMBRELLA_RADIAL -> {
                                LaiqStatChip("Rings", roofLayoutPreview.ringCount?.toString() ?: "—", modifier = Modifier.weight(1f))
                                LaiqStatChip("Sectors", roofLayoutPreview.sectorCount?.toString() ?: "—", modifier = Modifier.weight(1f))
                            }

                            else -> {
                                LaiqStatChip("Rows", roofLayoutPreview.rowCount?.toString() ?: "—", modifier = Modifier.weight(1f))
                                LaiqStatChip("Max Columns", roofLayoutPreview.widestRowPlateCount?.toString() ?: "—", modifier = Modifier.weight(1f))
                            }
                        }
                        LaiqStatChip("0° Ref", roofReferenceLabel, tone = LaiqColors.AccentOrange, modifier = Modifier.weight(1f))
                    }
                    RoofSurfaceMap(
                        template = roofLayoutPreview.template,
                        rowCount = roofLayoutPreview.rowCount ?: 0,
                        widestRowPlateCount = roofLayoutPreview.widestRowPlateCount ?: 0,
                        ringCount = roofLayoutPreview.ringCount ?: 0,
                        sectorCount = roofLayoutPreview.sectorCount ?: 0,
                        activePlateId = null,
                        savedPlateIds = emptySet(),
                        overlayPlateIds = emptySet(),
                        centerFeatureCount = 0,
                        hasAnnularRing = roofLayoutPreview.hasAnnularRing,
                        annularSectionCount = roofLayoutPreview.annularSectionCount ?: 0,
                        hasPontoonDeck = roofLayoutPreview.hasPontoonDeck,
                        referenceLabel = roofReferenceLabel,
                        referenceAzimuthDeg = roofReferenceAzimuth,
                        rotationDirection = scopeState.rotationDirection,
                        onSelectPlate = { _ -> Unit },
                    )
                }
            }
        }

        item {
            LaiqPrimaryButton(
                text = "Continue to Task Scope",
                onClick = onContinue,
            )
        }
    }
}

private fun setupRoofLayoutValidationMessage(draft: RoofLayoutDraftInput): String? = when (draft.template) {
    RoofTemplate.CIRCULAR_PLATE -> when {
        setupParsePositiveWholeNumber(draft.rowCount) == null -> "Enter roof plate rows greater than 0."
        setupParsePositiveWholeNumber(draft.widestRowPlateCount) == null -> "Enter columns in widest row greater than 0."
        draft.hasAnnularRing && setupParsePositiveWholeNumber(draft.annularSectionCount) == null ->
            "Enter annular ring sections greater than 0."
        else -> null
    }

    RoofTemplate.CIRCULAR_CENTER_OPENING -> when {
        setupParsePositiveWholeNumber(draft.rowCount) == null -> "Enter roof plate rows greater than 0."
        setupParsePositiveWholeNumber(draft.widestRowPlateCount) == null -> "Enter columns in widest row greater than 0."
        draft.centerOpeningRatio.isNotBlank() && setupParseNormalizedDecimal(draft.centerOpeningRatio)?.let { it in 0.0..1.0 } != true ->
            "Center opening ratio must be between 0 and 1."
        draft.hasAnnularRing && setupParsePositiveWholeNumber(draft.annularSectionCount) == null ->
            "Enter annular ring sections greater than 0."
        else -> null
    }

    RoofTemplate.UMBRELLA_RADIAL -> when {
        setupParsePositiveWholeNumber(draft.ringCount) == null -> "Enter ring count greater than 0."
        setupParsePositiveWholeNumber(draft.sectorCount) == null -> "Enter sector count greater than 0."
        draft.hasAnnularRing && setupParsePositiveWholeNumber(draft.annularSectionCount) == null ->
            "Enter annular ring sections greater than 0."
        else -> null
    }
}

@Composable
private fun SetupRoofLayoutInputs(
    draft: RoofLayoutDraftInput,
    roofType: String,
    onDraftChange: (RoofLayoutDraftInput) -> Unit,
) {
    val isFloatingRoof = roofType.contains("floating")

    when (draft.template) {
        RoofTemplate.CIRCULAR_PLATE,
        RoofTemplate.CIRCULAR_CENTER_OPENING -> {
            LaiqCountField(
                label = "Roof Plate Rows",
                value = draft.rowCount,
                onValueChange = { onDraftChange(draft.copy(rowCount = setupNormalizedIntegerInput(it))) },
                min = 0,
                max = 20,
            )
            LaiqCountField(
                label = "Columns In Widest Row",
                value = draft.widestRowPlateCount,
                onValueChange = { onDraftChange(draft.copy(widestRowPlateCount = setupNormalizedIntegerInput(it))) },
                min = 0,
                max = 20,
            )
            if (draft.template == RoofTemplate.CIRCULAR_CENTER_OPENING) {
                OutlinedTextField(
                    value = draft.centerOpeningRatio,
                    onValueChange = { onDraftChange(draft.copy(centerOpeningRatio = setupNormalizedDecimalInput(it))) },
                    label = { Text("Center Opening Ratio (0-1)") },
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
            }
        }

        RoofTemplate.UMBRELLA_RADIAL -> {
            LaiqCountField(
                label = "Ring Count",
                value = draft.ringCount,
                onValueChange = { onDraftChange(draft.copy(ringCount = setupNormalizedIntegerInput(it))) },
                min = 0,
                max = 20,
            )
            LaiqCountField(
                label = "Sector Count",
                value = draft.sectorCount,
                onValueChange = { onDraftChange(draft.copy(sectorCount = setupNormalizedIntegerInput(it))) },
                min = 0,
                max = 20,
            )
        }
    }

    LaiqDropdownField(
        label = "Annular Ring",
        value = if (draft.hasAnnularRing) "yes" else "no",
        options = listOf("yes" to "Yes", "no" to "No"),
        onSelected = { selected ->
            onDraftChange(
                draft.copy(
                    hasAnnularRing = selected == "yes",
                    annularSectionCount = if (selected == "yes") draft.annularSectionCount else "",
                ),
            )
        },
    )
    if (draft.hasAnnularRing) {
        LaiqCountField(
            label = "Annular Ring Sections",
            value = draft.annularSectionCount,
            onValueChange = { onDraftChange(draft.copy(annularSectionCount = setupNormalizedIntegerInput(it))) },
            min = 0,
            max = 20,
        )
    }
    if (isFloatingRoof) {
        LaiqDropdownField(
            label = "Pontoon Deck",
            value = if (draft.hasPontoonDeck) "yes" else "no",
            options = listOf("yes" to "Yes", "no" to "No"),
            onSelected = { selected -> onDraftChange(draft.copy(hasPontoonDeck = selected == "yes")) },
        )
    }
}

private fun setupRoofTemplateLabel(template: RoofTemplate): String = when (template) {
    RoofTemplate.CIRCULAR_PLATE -> "Circular Plate"
    RoofTemplate.CIRCULAR_CENTER_OPENING -> "Circular + Center Opening"
    RoofTemplate.UMBRELLA_RADIAL -> "Umbrella / Radial"
}

private fun setupNormalizedIntegerInput(raw: String): String =
    raw.mapNotNull { char -> char.digitToIntOrNull()?.toString() }.joinToString("")

private fun setupNormalizedDecimalInput(raw: String): String {
    var seenSeparator = false
    return buildString {
        raw.forEach { char ->
            when {
                char.digitToIntOrNull() != null -> append(char.digitToInt())
                (char == '.' || char == ',') && !seenSeparator -> {
                    append('.')
                    seenSeparator = true
                }
            }
        }
    }
}

private fun setupParsePositiveWholeNumber(value: String): Int? =
    value.toIntOrNull()?.takeIf { parsed -> parsed > 0 }

private fun setupParseNormalizedDecimal(value: String): Double? =
    value.toDoubleOrNull()

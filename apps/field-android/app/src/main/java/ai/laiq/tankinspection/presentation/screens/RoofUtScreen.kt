package ai.laiq.tankinspection.presentation.screens

import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.RoofUtDraftInput
import ai.laiq.tankinspection.presentation.activeRoofSurfaceConfig
import ai.laiq.tankinspection.presentation.availableRoofSurfaces
import ai.laiq.tankinspection.presentation.beginFindingForMeasurement
import ai.laiq.tankinspection.presentation.buildRoofLayoutOrNull
import ai.laiq.tankinspection.presentation.buildRoofPlateCells
import ai.laiq.tankinspection.presentation.committedSetupState
import ai.laiq.tankinspection.presentation.committedScopeBaseline
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqDeleteConfirmDialog
import ai.laiq.tankinspection.presentation.components.LaiqDeleteDialogState
import ai.laiq.tankinspection.presentation.components.LaiqDropdownField
import ai.laiq.tankinspection.presentation.components.LaiqLabeledValue
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.components.LaiqStatusBadge
import ai.laiq.tankinspection.presentation.components.MeasurementStatsRow
import ai.laiq.tankinspection.presentation.components.RoofMapMarker
import ai.laiq.tankinspection.presentation.components.RoofSurfaceMap
import ai.laiq.tankinspection.presentation.components.measurementStatsFromInput
import ai.laiq.tankinspection.presentation.components.measurementStatsFromValues
import ai.laiq.tankinspection.presentation.editRoofUtRow
import ai.laiq.tankinspection.presentation.findingsForMeasurement
import ai.laiq.tankinspection.presentation.hasPendingRoofLayoutChanges
import ai.laiq.tankinspection.presentation.hasSavedRoofLayout
import ai.laiq.tankinspection.presentation.label
import ai.laiq.tankinspection.presentation.measurementCaptureStateOptions
import ai.laiq.tankinspection.presentation.normalizedActiveRoofSurfaceId
import ai.laiq.tankinspection.presentation.removeRoofUtRow
import ai.laiq.tankinspection.presentation.roofFeatureTypeLabel
import ai.laiq.tankinspection.presentation.roofFindingSurface
import ai.laiq.tankinspection.presentation.roofFeatureUsesCenterPlacement
import ai.laiq.tankinspection.presentation.roofReferenceExplanation
import ai.laiq.tankinspection.presentation.roofReferenceSummaryLabel
import ai.laiq.tankinspection.presentation.referenceAzimuthDeg
import ai.laiq.tankinspection.presentation.requiresNumericReadings
import ai.laiq.tankinspection.presentation.saveRoofUtDraft
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

private enum class SavedRoofRowsDisplayMode {
    RECENT,
    ALL,
    HIDDEN,
}

@Composable
fun RoofUtScreen(
    draftState: FieldDraftState,
    onDraftStateChange: (FieldDraftState) -> Unit,
    onOpenFindings: (FieldDraftState) -> Unit,
    onBack: () -> Unit,
    contentPadding: PaddingValues,
) {
    val committedScope = draftState.committedScopeBaseline()
    val thicknessUnit = draftState.committedSetupState().thicknessUnit.label()
    val roofSurfaceId = draftState.normalizedActiveRoofSurfaceId()
    val roofSurfaceConfig = draftState.activeRoofSurfaceConfig()
    val roofSurfaceOptions = draftState.committedSetupState().availableRoofSurfaces()
    val roofSurfaceLabel = roofSurfaceConfig?.label ?: "Roof"
    var pendingDelete by remember { mutableStateOf<LaiqDeleteDialogState?>(null) }
    val roofLayout = draftState.buildRoofLayoutOrNull(roofSurfaceId)
    val hasSavedLayout = draftState.hasSavedRoofLayout(roofSurfaceId)
    val hasPendingChanges = draftState.hasPendingRoofLayoutChanges(roofSurfaceId)
    val roofReferenceLabel = committedScope.roofReferenceSummaryLabel()
    val roofReferenceAzimuth = committedScope.referenceAzimuthDeg()
    val roofReferenceRemark = committedScope.roofReferenceExplanation()
    val surfaceFeatures = draftState.roofFeatures.filter { feature -> feature.roofSurfaceId == roofSurfaceId }
    val surfaceRoofUtRows = draftState.roofUtRows.filter { row -> row.roofSurfaceId == roofSurfaceId }
    val listState = rememberLazyListState()
    var showCaptureEditor by rememberSaveable { mutableStateOf(false) }
    var savedRowsDisplayModeName by rememberSaveable(roofSurfaceId) {
        mutableStateOf(SavedRoofRowsDisplayMode.RECENT.name)
    }
    val savedRowsDisplayMode = SavedRoofRowsDisplayMode.valueOf(savedRowsDisplayModeName)
    val visibleRoofUtRows = when (savedRowsDisplayMode) {
        SavedRoofRowsDisplayMode.ALL -> surfaceRoofUtRows.reversed()
        SavedRoofRowsDisplayMode.HIDDEN -> emptyList()
        SavedRoofRowsDisplayMode.RECENT -> surfaceRoofUtRows.takeLast(8).reversed()
    }

    LaunchedEffect(draftState.roofUtDraft.editingRowId) {
        if (draftState.roofUtDraft.editingRowId != null) {
            showCaptureEditor = true
            listState.animateScrollToItem(1)
        }
    }

    pendingDelete?.let { dialogState ->
        LaiqDeleteConfirmDialog(
            state = dialogState,
            onDismiss = { pendingDelete = null },
        )
    }

    if (!hasSavedLayout || hasPendingChanges || roofLayout == null) {
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
                    title = "Roof UT Locked",
                    subtitle = if (!hasSavedLayout) {
                        "Complete roof layout in Inspection Setup before adding roof features or roof thickness rows."
                    } else {
                        "Return to Inspection Setup and re-save the roof baseline before continuing."
                    },
                ) {
                    LaiqSecondaryButton("Back", onBack)
                }
            }
        }
        return
    }

    val roofPlateCells = buildRoofPlateCells(
        template = roofLayout.template,
        rowCount = roofLayout.rowCount ?: 0,
        widestRowPlateCount = roofLayout.widestRowPlateCount ?: 0,
        ringCount = roofLayout.ringCount ?: 0,
        sectorCount = roofLayout.sectorCount ?: 0,
        referenceAzimuthDeg = roofReferenceAzimuth,
        rotationDirection = committedScope.rotationDirection,
    )
    val plateOptions = listOf("" to "Select Plate") + roofPlateCells.map { cell -> cell.plateId to cell.selectionLabel }
    val selectedRoofFindingCount = draftState.roofUtDraft.plateId.takeIf { it.isNotBlank() }?.let { plateId ->
        draftState.findingsForMeasurement(
            surface = roofFindingSurface(roofSurfaceId),
            linkedMeasurementId = draftState.roofUtDraft.editingRowId.orEmpty(),
            locationSummary = "$roofSurfaceLabel · $plateId",
        ).size
    } ?: 0

    LazyColumn(
        state = listState,
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
                title = "Saved Roof Layout",
                subtitle = "This committed roof map is the only plate reference used by roof features, roof UT rows, and roof nozzles.",
            ) {
                if (roofSurfaceOptions.size > 1) {
                    LaiqDropdownField(
                        label = "Roof Surface",
                        value = roofSurfaceId,
                        options = roofSurfaceOptions.map { surface -> surface.roofSurfaceId to surface.label },
                        onSelected = { selectedSurfaceId ->
                            onDraftStateChange(
                                draftState.copy(
                                    activeRoofSurfaceId = selectedSurfaceId,
                                    roofFeatureDraft = draftState.roofFeatureDraft.copy(roofSurfaceId = selectedSurfaceId),
                                    roofUtDraft = draftState.roofUtDraft.copy(roofSurfaceId = selectedSurfaceId, plateId = ""),
                                    roofNozzleDraft = draftState.roofNozzleDraft.copy(roofSurfaceId = selectedSurfaceId),
                                    roofNozzleUtDraft = draftState.roofNozzleUtDraft.copy(roofSurfaceId = selectedSurfaceId, nozzleId = ""),
                                ),
                            )
                        },
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    when (roofLayout.template) {
                        ai.laiq.tankinspection.domain.model.RoofTemplate.CONE_RADIAL -> {
                            LaiqStatChip("Sectors", roofLayout.sectorCount?.toString() ?: "—", modifier = Modifier.weight(1f))
                            LaiqStatChip("Center Plates", roofLayout.ringCount?.toString() ?: "—", modifier = Modifier.weight(1f))
                        }

                        ai.laiq.tankinspection.domain.model.RoofTemplate.UMBRELLA_RADIAL -> {
                            LaiqStatChip("Rings", roofLayout.ringCount?.toString() ?: "—", modifier = Modifier.weight(1f))
                            LaiqStatChip("Sectors", roofLayout.sectorCount?.toString() ?: "—", modifier = Modifier.weight(1f))
                        }

                        else -> {
                            LaiqStatChip("Rows", roofLayout.rowCount?.toString() ?: "—", modifier = Modifier.weight(1f))
                            LaiqStatChip("Max Columns", roofLayout.widestRowPlateCount?.toString() ?: "—", modifier = Modifier.weight(1f))
                        }
                    }
                    LaiqStatChip("0° Ref", roofReferenceLabel, tone = LaiqColors.AccentOrange, modifier = Modifier.weight(1f))
                }
                roofReferenceRemark?.let { remark ->
                    Text(
                        remark,
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                }
                RoofSurfaceMap(
                    template = roofLayout.template,
                    rowCount = roofLayout.rowCount ?: 0,
                    widestRowPlateCount = roofLayout.widestRowPlateCount ?: 0,
                    ringCount = roofLayout.ringCount ?: 0,
                    sectorCount = roofLayout.sectorCount ?: 0,
                    activePlateId = draftState.roofUtDraft.plateId,
                    savedPlateIds = surfaceRoofUtRows.map { row -> row.plateId }.toSet(),
                    overlayPlateIds = surfaceFeatures.mapNotNull { feature -> feature.plateId }.toSet(),
                    centerFeatureCount = surfaceFeatures.count { feature ->
                        roofFeatureUsesCenterPlacement(feature.type) || feature.placementMode == "center"
                    },
                    hasAnnularRing = roofLayout.hasAnnularRing,
                    annularSectionCount = roofLayout.annularSectionCount ?: 0,
                    hasPontoonDeck = roofLayout.hasPontoonDeck,
                    markers = surfaceFeatures.map { feature ->
                        RoofMapMarker(
                            markerId = feature.featureId,
                            label = feature.label ?: roofFeatureTypeLabel(feature.type),
                            plateId = feature.plateId,
                            azimuthDeg = feature.azimuthDeg,
                            radiusRatio = feature.radiusRatio,
                        )
                    },
                    referenceLabel = roofReferenceLabel,
                    referenceAzimuthDeg = roofReferenceAzimuth,
                    rotationDirection = committedScope.rotationDirection,
                    onSelectPlate = { plateId ->
                        onDraftStateChange(
                            draftState.copy(
                                roofUtDraft = draftState.roofUtDraft.copy(roofSurfaceId = roofSurfaceId, plateId = plateId),
                            ),
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        item {
            LaiqSectionCard(
                title = "Capture Roof Row",
                subtitle = "Open the capture editor only when you want to add or edit one ${roofSurfaceLabel.lowercase()} measurement row.",
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    LaiqPrimaryButton(
                        text = if (draftState.roofUtDraft.editingRowId != null) "Resume Edit" else "Open Capture",
                        onClick = { showCaptureEditor = true },
                        modifier = Modifier.weight(1f),
                    )
                    if (showCaptureEditor) {
                        LaiqSecondaryButton(
                            text = "Hide Capture",
                            onClick = { showCaptureEditor = false },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                if (!showCaptureEditor) {
                    Text(
                        "Capture editor hidden. Review saved roof rows below, or open the editor when you need to add or edit one.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                } else {
                    if (draftState.roofUtDraft.editingRowId != null) {
                        Text(
                            "Editing saved row ${draftState.roofUtDraft.editingRowId}",
                            style = MaterialTheme.typography.bodySmall,
                            color = LaiqColors.AccentOrange,
                        )
                    }
                    LaiqDropdownField(
                        label = "Plate ID",
                        value = draftState.roofUtDraft.plateId,
                        options = plateOptions,
                        onSelected = { plateId ->
                            onDraftStateChange(draftState.copy(roofUtDraft = draftState.roofUtDraft.copy(roofSurfaceId = roofSurfaceId, plateId = plateId)))
                        },
                    )
                    Text(
                        "Use the saved roof map above or this list to select the plate number.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                    LaiqDropdownField(
                        label = "Capture State",
                        value = draftState.roofUtDraft.captureState.name,
                        options = measurementCaptureStateOptions(includeNotApplicable = true),
                        onSelected = { selected ->
                            onDraftStateChange(
                                draftState.copy(
                                    roofUtDraft = draftState.roofUtDraft.copy(
                                        captureState = ai.laiq.tankinspection.domain.model.MeasurementCaptureState.valueOf(selected),
                                    ),
                                ),
                            )
                        },
                    )
                    if (draftState.roofUtDraft.captureState.requiresNumericReadings()) {
                        Text(
                            "Thickness readings are captured in $thicknessUnit.",
                            style = MaterialTheme.typography.bodySmall,
                            color = LaiqColors.MutedText,
                        )
                        RoofReadingInputs(
                            draft = draftState.roofUtDraft,
                            onDraftChange = { updated ->
                                onDraftStateChange(draftState.copy(roofUtDraft = updated))
                            },
                        )
                    } else {
                        Text(
                            "${draftState.roofUtDraft.captureState.label()} selected. No numeric thickness readings are required for this roof plate.",
                            style = MaterialTheme.typography.bodySmall,
                            color = LaiqColors.MutedText,
                        )
                    }
                    OutlinedTextField(
                        value = draftState.roofUtDraft.note,
                        onValueChange = {
                            onDraftStateChange(draftState.copy(roofUtDraft = draftState.roofUtDraft.copy(note = it)))
                        },
                        label = { Text("Quick Note") },
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    LaiqPrimaryButton(
                        text = if (draftState.roofUtDraft.editingRowId != null) "Update Roof UT Row" else "Save Roof UT Row",
                        onClick = {
                            val updated = draftState.saveRoofUtDraft()
                            onDraftStateChange(updated)
                            if (updated != draftState) {
                                showCaptureEditor = false
                            }
                        },
                    )
                    LaiqSecondaryButton(
                        text = if (selectedRoofFindingCount > 0) "Add Finding ($selectedRoofFindingCount)" else "Add Finding",
                        enabled = draftState.roofUtDraft.plateId.isNotBlank(),
                        onClick = {
                            onOpenFindings(
                                draftState.beginFindingForMeasurement(
                                    surface = roofFindingSurface(roofSurfaceId),
                                    linkedMeasurementId = draftState.roofUtDraft.editingRowId.orEmpty(),
                                    locationSummary = "$roofSurfaceLabel · ${draftState.roofUtDraft.plateId}",
                                ),
                            )
                        },
                    )
                    if (draftState.roofUtDraft.plateId.isBlank()) {
                        Text(
                            "Select a roof plate first, then add findings for that measurement point.",
                            style = MaterialTheme.typography.bodySmall,
                            color = LaiqColors.MutedText,
                        )
                    }
                }
            }
        }

        item {
            LaiqSectionCard(
                title = "Saved Roof Rows",
                subtitle = when {
                    surfaceRoofUtRows.isEmpty() -> "No roof UT rows saved yet."
                    savedRowsDisplayMode == SavedRoofRowsDisplayMode.HIDDEN ->
                        "${surfaceRoofUtRows.size} roof UT entries are saved locally."
                    savedRowsDisplayMode == SavedRoofRowsDisplayMode.ALL ->
                        "Showing all ${surfaceRoofUtRows.size} roof UT entries stored locally."
                    surfaceRoofUtRows.size > 8 ->
                        "Showing the 8 most recent roof UT entries stored locally."
                    else -> "Showing all ${surfaceRoofUtRows.size} roof UT entries stored locally."
                },
            ) {
                if (surfaceRoofUtRows.isEmpty()) {
                    Text("No roof UT rows saved yet.", style = MaterialTheme.typography.bodySmall)
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            when (savedRowsDisplayMode) {
                                SavedRoofRowsDisplayMode.HIDDEN -> {
                                    if (surfaceRoofUtRows.size > 8) {
                                        LaiqSecondaryButton(
                                            text = "Show Recent",
                                            onClick = { savedRowsDisplayModeName = SavedRoofRowsDisplayMode.RECENT.name },
                                            modifier = Modifier.weight(1f),
                                        )
                                        LaiqSecondaryButton(
                                            text = "Show All (${surfaceRoofUtRows.size})",
                                            onClick = { savedRowsDisplayModeName = SavedRoofRowsDisplayMode.ALL.name },
                                            modifier = Modifier.weight(1f),
                                        )
                                    } else {
                                        LaiqSecondaryButton(
                                            text = "Show Rows",
                                            onClick = { savedRowsDisplayModeName = SavedRoofRowsDisplayMode.ALL.name },
                                            modifier = Modifier.weight(1f),
                                        )
                                    }
                                }

                                SavedRoofRowsDisplayMode.ALL -> {
                                    LaiqSecondaryButton(
                                        text = "Show Recent",
                                        onClick = { savedRowsDisplayModeName = SavedRoofRowsDisplayMode.RECENT.name },
                                        modifier = Modifier.weight(1f),
                                    )
                                    LaiqSecondaryButton(
                                        text = "Hide",
                                        onClick = { savedRowsDisplayModeName = SavedRoofRowsDisplayMode.HIDDEN.name },
                                        modifier = Modifier.weight(1f),
                                    )
                                }

                                SavedRoofRowsDisplayMode.RECENT -> {
                                    if (surfaceRoofUtRows.size > 8) {
                                        LaiqSecondaryButton(
                                            text = "Show All (${surfaceRoofUtRows.size})",
                                            onClick = { savedRowsDisplayModeName = SavedRoofRowsDisplayMode.ALL.name },
                                            modifier = Modifier.weight(1f),
                                        )
                                    }
                                    LaiqSecondaryButton(
                                        text = "Hide",
                                        onClick = { savedRowsDisplayModeName = SavedRoofRowsDisplayMode.HIDDEN.name },
                                        modifier = Modifier.weight(1f),
                                    )
                                }
                            }
                        }
                        if (savedRowsDisplayMode == SavedRoofRowsDisplayMode.HIDDEN) {
                            Text(
                                "Saved roof rows are hidden. Use the buttons above to show the recent entries or the full saved set.",
                                style = MaterialTheme.typography.bodySmall,
                                color = LaiqColors.MutedText,
                            )
                        }
                        visibleRoofUtRows.forEach { row ->
                            val rowFindingCount = draftState.findingsForMeasurement(
                                surface = roofFindingSurface(roofSurfaceId),
                                linkedMeasurementId = row.rowId,
                                locationSummary = "$roofSurfaceLabel · ${row.plateId}",
                            ).size
                            Surface(
                                modifier = Modifier.fillMaxWidth(),
                                color = Color.White,
                                shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                                border = BorderStroke(1.dp, LaiqColors.PanelBorder),
                            ) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(14.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp),
                                ) {
                                    Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                        Text(row.plateId, style = MaterialTheme.typography.titleSmall)
                                        LaiqStatusBadge(
                                            row.captureState.label(),
                                            if (row.captureState.requiresNumericReadings()) LaiqColors.StatusReady else LaiqColors.AccentOrange,
                                        )
                                    }
                                    if (row.readings.isNotEmpty()) {
                                        Text("Readings ($thicknessUnit): ${row.readings.joinToString(", ")}", style = MaterialTheme.typography.bodySmall)
                                        measurementStatsFromValues(row.readings)?.let { stats ->
                                            MeasurementStatsRow(stats = stats, modifier = Modifier.fillMaxWidth())
                                        }
                                    } else {
                                        Text("No numeric thickness captured for this roof row.", style = MaterialTheme.typography.bodySmall, color = LaiqColors.MutedText)
                                    }
                                    row.note?.takeIf { it.isNotBlank() }?.let {
                                        Text("Note: $it", style = MaterialTheme.typography.bodySmall)
                                    }
                                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        LaiqSecondaryButton(
                                            text = "Edit",
                                            onClick = {
                                                showCaptureEditor = true
                                                onDraftStateChange(draftState.editRoofUtRow(row.rowId))
                                            },
                                            modifier = Modifier.weight(1f),
                                        )
                                        LaiqSecondaryButton(
                                            text = "Delete",
                                            onClick = {
                                                pendingDelete = LaiqDeleteDialogState(
                                                    title = "Delete Roof UT Row?",
                                                    message = "This will permanently remove $roofSurfaceLabel · ${row.plateId}.",
                                                    onConfirm = { onDraftStateChange(draftState.removeRoofUtRow(row.rowId)) },
                                                )
                                            },
                                            modifier = Modifier.weight(1f),
                                        )
                                    }
                                    LaiqSecondaryButton(
                                        text = if (rowFindingCount > 0) "Findings ($rowFindingCount)" else "Add Finding",
                                        onClick = {
                                            onOpenFindings(
                                                draftState.beginFindingForMeasurement(
                                                    surface = roofFindingSurface(roofSurfaceId),
                                                    linkedMeasurementId = row.rowId,
                                                    locationSummary = "$roofSurfaceLabel · ${row.plateId}",
                                                ),
                                            )
                                        },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        item {
            LaiqSecondaryButton("Back", onBack)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RoofReadingInputs(
    draft: RoofUtDraftInput,
    onDraftChange: (RoofUtDraftInput) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            draft.readings.forEachIndexed { index, reading ->
                OutlinedTextField(
                    value = reading,
                    onValueChange = { updated ->
                        val nextReadings = draft.readings.toMutableList()
                        nextReadings[index] = updated
                        onDraftChange(draft.copy(readings = nextReadings))
                    },
                    label = { Text("R${index + 1}") },
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(0.48f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
            }
        }
        measurementStatsFromInput(draft.readings)?.let { stats ->
            MeasurementStatsRow(stats = stats, modifier = Modifier.fillMaxWidth())
        }
    }
}

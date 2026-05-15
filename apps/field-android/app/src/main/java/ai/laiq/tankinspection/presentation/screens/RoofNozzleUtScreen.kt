package ai.laiq.tankinspection.presentation.screens

import ai.laiq.tankinspection.domain.model.NozzleDefinition
import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.RoofNozzleDraftInput
import ai.laiq.tankinspection.presentation.beginFindingForMeasurement
import ai.laiq.tankinspection.presentation.buildRoofLinkTargetsForConfig
import ai.laiq.tankinspection.presentation.buildRoofLayoutOrNull
import ai.laiq.tankinspection.presentation.buildRoofPlateCells
import ai.laiq.tankinspection.presentation.canvasPointToRoofPolar
import ai.laiq.tankinspection.presentation.committedScopeBaseline
import ai.laiq.tankinspection.presentation.committedSetupState
import ai.laiq.tankinspection.presentation.editRoofNozzleUtRow
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqCountField
import ai.laiq.tankinspection.presentation.components.LaiqDropdownField
import ai.laiq.tankinspection.presentation.components.LaiqLabeledValue
import ai.laiq.tankinspection.presentation.components.LaiqPlacementAdjustPad
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.components.LaiqStatusBadge
import ai.laiq.tankinspection.presentation.components.LaiqTextField
import ai.laiq.tankinspection.presentation.components.RoofMapMarker
import ai.laiq.tankinspection.presentation.components.RoofSurfaceMap
import ai.laiq.tankinspection.presentation.hasPendingRoofLayoutChanges
import ai.laiq.tankinspection.presentation.hasSavedRoofLayout
import ai.laiq.tankinspection.presentation.findingsForMeasurement
import ai.laiq.tankinspection.presentation.label
import ai.laiq.tankinspection.presentation.measurementCaptureStateOptions
import ai.laiq.tankinspection.presentation.nearestRoofPlateId
import ai.laiq.tankinspection.presentation.replaceRoofNozzleRegistry
import ai.laiq.tankinspection.presentation.removeRoofNozzleUtRow
import ai.laiq.tankinspection.presentation.roofFeatureTypeLabel
import ai.laiq.tankinspection.presentation.roofPolarToCanvasPoint
import ai.laiq.tankinspection.presentation.roofReferenceLabel
import ai.laiq.tankinspection.presentation.referenceAzimuthDeg
import ai.laiq.tankinspection.presentation.requiresNumericReadings
import ai.laiq.tankinspection.presentation.saveRoofNozzleUtDraft
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

private data class RoofRegistryDraftRow(
    val nozzleId: String,
    val size: String = "",
    val hasReinforcementPad: Boolean = true,
    val plateId: String = "",
    val azimuthDeg: String = "",
    val radiusRatio: String = "",
    val confirmed: Boolean = false,
)

private fun RoofRegistryDraftRow.hasPlateLink(): Boolean = plateId.isNotBlank()

private fun RoofRegistryDraftRow.isReadyForSave(): Boolean =
    size.isNotBlank() && hasPlateLink()

private fun List<NozzleDefinition>.toRoofRegistryDraftRows(): List<RoofRegistryDraftRow> =
    sortedBy { nozzle -> nozzle.nozzleId }
        .mapIndexed { index, nozzle ->
            RoofRegistryDraftRow(
                nozzleId = roofRegistryNozzleId(index),
                size = nozzle.size,
                hasReinforcementPad = nozzle.hasReinforcementPad,
                plateId = nozzle.plateId.orEmpty(),
                azimuthDeg = nozzle.azimuthDeg?.toInt()?.toString().orEmpty(),
                radiusRatio = nozzle.radiusRatio?.let { "%.2f".format(it) }.orEmpty(),
                confirmed = true,
            )
        }

private fun defaultRoofRegistryDraftRows(count: Int): List<RoofRegistryDraftRow> =
    List(count.coerceAtLeast(1)) { index ->
        RoofRegistryDraftRow(nozzleId = roofRegistryNozzleId(index))
    }

private fun resizeRoofRegistryDraftRows(
    existing: List<RoofRegistryDraftRow>,
    count: Int,
): List<RoofRegistryDraftRow> =
    List(count.coerceAtLeast(1)) { index ->
        existing.getOrNull(index)?.copy(nozzleId = roofRegistryNozzleId(index))
            ?: RoofRegistryDraftRow(nozzleId = roofRegistryNozzleId(index))
    }

private fun List<RoofRegistryDraftRow>.updateRoofRegistryRow(
    index: Int,
    transform: RoofRegistryDraftRow.() -> RoofRegistryDraftRow,
): List<RoofRegistryDraftRow> =
    mapIndexed { rowIndex, row ->
        if (rowIndex == index) row.transform() else row
    }

private fun List<RoofRegistryDraftRow>.toRoofNozzleDefinitions(): List<ai.laiq.tankinspection.domain.model.NozzleDefinition> =
    mapNotNull { row ->
        row.size.takeIf { it.isNotBlank() }?.let { size ->
            row.plateId.takeIf { it.isNotBlank() }?.let { plateId ->
                val azimuthDeg = row.azimuthDeg.toDoubleOrNull()
                val radiusRatio = row.radiusRatio.toDoubleOrNull()
                ai.laiq.tankinspection.domain.model.NozzleDefinition(
                    nozzleId = row.nozzleId,
                    surface = "roof",
                    size = size,
                    hasReinforcementPad = row.hasReinforcementPad,
                    placementMode = if (azimuthDeg != null && radiusRatio != null) {
                        "plate_linked_positioned"
                    } else {
                        "plate_linked"
                    },
                    azimuthDeg = azimuthDeg,
                    radiusRatio = radiusRatio,
                    plateId = plateId,
                )
            }
        }
    }

private fun roofRegistryNozzleId(index: Int): String =
    "RN-${(index + 1).toString().padStart(3, '0')}"

@Composable
fun RoofNozzleUtScreen(
    draftState: FieldDraftState,
    onDraftStateChange: (FieldDraftState) -> Unit,
    onOpenFindings: (FieldDraftState) -> Unit,
    onBack: () -> Unit,
    contentPadding: PaddingValues,
) {
    val committedScope = draftState.committedScopeBaseline()
    val thicknessUnit = draftState.committedSetupState().thicknessUnit.label()
    val nozzleSizeUnit = draftState.committedSetupState().nozzleSizeUnit.label()
    val nozzleSizeUnitType = draftState.committedSetupState().nozzleSizeUnit
    val nozzleSizeOptions = nozzleSizeOptions(nozzleSizeUnitType)
    val roofLayout = draftState.buildRoofLayoutOrNull()
    val hasSavedLayout = draftState.hasSavedRoofLayout()
    val hasPendingChanges = draftState.hasPendingRoofLayoutChanges()

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
                    title = "Roof Nozzles Locked",
                    subtitle = if (!hasSavedLayout) {
                        "Complete roof layout in Inspection Setup before registering roof nozzles or adding roof nozzle UT rows."
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
    val roofLinkTargets = buildRoofLinkTargetsForConfig(
        template = roofLayout.template,
        rowCount = roofLayout.rowCount ?: 0,
        widestRowPlateCount = roofLayout.widestRowPlateCount ?: 0,
        ringCount = roofLayout.ringCount ?: 0,
        sectorCount = roofLayout.sectorCount ?: 0,
        referenceAzimuthDeg = committedScope.referenceAzimuthDeg(),
        rotationDirection = committedScope.rotationDirection,
        hasAnnularRing = roofLayout.hasAnnularRing,
        annularSectionCount = roofLayout.annularSectionCount ?: 0,
    )
    val plateOptions = listOf("" to "Select Plate") + roofLinkTargets.map { cell -> cell.plateId to cell.selectionLabel }
    val roofReferenceLabel = committedScope.roofReferenceLabel()
    val roofReferenceAzimuth = committedScope.referenceAzimuthDeg()
    var showRegistryEditor by rememberSaveable { mutableStateOf(false) }
    var registryCount by remember { mutableStateOf(draftState.roofNozzles.size.takeIf { it > 0 }?.toString() ?: "1") }
    var registryDrafts by remember { mutableStateOf(draftState.roofNozzles.toRoofRegistryDraftRows().ifEmpty { defaultRoofRegistryDraftRows(1) }) }
    var activeRegistryIndex by remember { mutableIntStateOf(0) }
    var placementModeEnabled by rememberSaveable { mutableStateOf(false) }
    var pendingPlacementAzimuth by rememberSaveable { mutableStateOf("") }
    var pendingPlacementRadius by rememberSaveable { mutableStateOf("") }
    var pendingPlacementPlateId by rememberSaveable { mutableStateOf("") }
    val activeRegistryRow = registryDrafts.getOrNull(activeRegistryIndex)
    val registryReady = registryDrafts.isNotEmpty() && registryDrafts.all { row -> row.isReadyForSave() }
    val activeSizeSelection = activeRegistryRow?.let { row -> selectedNozzleSizeOption(row.size, nozzleSizeUnitType) }.orEmpty()
    val showingCustomSizeInput = activeRegistryRow != null && activeSizeSelection == customNozzleSizeOptionValue
    val maxPlacementRadiusRatio = if (roofLayout.hasAnnularRing) 0.48 / 0.42 else 1.0
    val hasPendingPlacement = pendingPlacementAzimuth.toDoubleOrNull() != null && pendingPlacementRadius.toDoubleOrNull() != null
    fun syncPendingPlacementFromRow(row: RoofRegistryDraftRow?) {
        pendingPlacementAzimuth = row?.azimuthDeg.orEmpty()
        pendingPlacementRadius = row?.radiusRatio.orEmpty()
        pendingPlacementPlateId = row?.plateId.orEmpty()
    }

    fun previewNozzlePlacement(azimuthDeg: Double, radiusRatio: Double) {
        val selectedPlateId = nearestRoofPlateId(
            template = roofLayout.template,
            rowCount = roofLayout.rowCount ?: 0,
            widestRowPlateCount = roofLayout.widestRowPlateCount ?: 0,
            ringCount = roofLayout.ringCount ?: 0,
            sectorCount = roofLayout.sectorCount ?: 0,
            referenceAzimuthDeg = roofReferenceAzimuth,
            rotationDirection = committedScope.rotationDirection,
            hasAnnularRing = roofLayout.hasAnnularRing,
            annularSectionCount = roofLayout.annularSectionCount ?: 0,
            azimuthDeg = azimuthDeg,
            radiusRatio = radiusRatio,
        )
        pendingPlacementAzimuth = azimuthDeg.toInt().toString()
        pendingPlacementRadius = "%.2f".format(radiusRatio)
        pendingPlacementPlateId = selectedPlateId.orEmpty()
    }

    fun initializePlacementFromLinkedPlate(): Boolean {
        if (hasPendingPlacement) return true
        val linkedPlateId = pendingPlacementPlateId.ifBlank { activeRegistryRow?.plateId.orEmpty() }.ifBlank { return false }
        val linkedCell = roofLinkTargets.firstOrNull { cell -> cell.plateId == linkedPlateId } ?: return false
        val (derivedAzimuth, derivedRadius) = canvasPointToRoofPolar(linkedCell.labelXNorm, linkedCell.labelYNorm)
        previewNozzlePlacement(derivedAzimuth, derivedRadius)
        return true
    }

    fun nudgeNozzlePlacement(deltaXNorm: Float, deltaYNorm: Float) {
        if (!initializePlacementFromLinkedPlate()) return
        val azimuthDeg = pendingPlacementAzimuth.toDoubleOrNull() ?: return
        val radiusRatio = pendingPlacementRadius.toDoubleOrNull() ?: return
        val (xNorm, yNorm) = roofPolarToCanvasPoint(azimuthDeg, radiusRatio)
        val nextX = (xNorm + deltaXNorm).coerceIn(0.02f, 0.98f)
        val nextY = (yNorm + deltaYNorm).coerceIn(0.02f, 0.98f)
        val (nextAzimuth, nextRadiusRaw) = canvasPointToRoofPolar(nextX, nextY)
        previewNozzlePlacement(nextAzimuth, nextRadiusRaw.coerceIn(0.0, maxPlacementRadiusRatio))
    }

    fun resetRegistryEditorFromSaved() {
        val existingRows = draftState.roofNozzles.toRoofRegistryDraftRows()
        registryDrafts = existingRows.ifEmpty { defaultRoofRegistryDraftRows(1) }
        registryCount = registryDrafts.size.toString()
        activeRegistryIndex = 0
        syncPendingPlacementFromRow(registryDrafts.firstOrNull())
        placementModeEnabled = false
        showRegistryEditor = true
    }

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
                title = "Roof Nozzle Registry",
                subtitle = "Register roof nozzles one by one. Set the count, then confirm each generated nozzle with its size, plate link, and reinforcement pad.",
            ) {
                androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LaiqStatChip("Registered", draftState.roofNozzles.size.toString(), modifier = Modifier.weight(1f))
                    LaiqStatChip("UT Rows", draftState.roofNozzleUtRows.size.toString(), tone = LaiqColors.AccentOrange, modifier = Modifier.weight(1f))
                }
                androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    LaiqPrimaryButton(
                        text = if (draftState.roofNozzles.isEmpty()) "Add Roof Nozzles" else "Edit Roof Registry",
                        onClick = { resetRegistryEditorFromSaved() },
                        modifier = Modifier.weight(1f),
                    )
                    if (showRegistryEditor) {
                        LaiqSecondaryButton(
                            text = "Close Editor",
                            onClick = { showRegistryEditor = false },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                if (!showRegistryEditor) {
                    Text(
                        "Registry editor hidden. Open it to define nozzle count, sizes, and plate links.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                } else {
                    LaiqCountField(
                        label = "Roof Nozzle Count",
                        value = registryCount,
                        onValueChange = { updated ->
                            val normalized = updated.filter(Char::isDigit)
                            registryCount = normalized
                            normalized.toIntOrNull()?.takeIf { it > 0 }?.let { count ->
                                registryDrafts = resizeRoofRegistryDraftRows(registryDrafts, count)
                                activeRegistryIndex = activeRegistryIndex.coerceAtMost(registryDrafts.lastIndex)
                                syncPendingPlacementFromRow(registryDrafts.getOrNull(activeRegistryIndex))
                                placementModeEnabled = false
                            }
                        },
                        min = 0,
                        max = 20,
                    )
                    Text(
                        "Roof nozzle IDs are generated automatically. Define one nozzle at a time so the roof map stays visible while you link its plate.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                    if (registryDrafts.isNotEmpty()) {
                        androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            LaiqSecondaryButton(
                                text = "Previous",
                                onClick = {
                                    activeRegistryIndex = (activeRegistryIndex - 1).coerceAtLeast(0)
                                    syncPendingPlacementFromRow(registryDrafts.getOrNull(activeRegistryIndex))
                                    placementModeEnabled = false
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(72.dp),
                            )
                            androidx.compose.material3.Surface(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(72.dp),
                                color = androidx.compose.ui.graphics.Color.White,
                                shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, LaiqColors.PanelBorder),
                            ) {
                                Column(
                                    modifier = Modifier.fillMaxSize(),
                                    horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center,
                                ) {
                                    Text("Current", style = MaterialTheme.typography.labelMedium, color = LaiqColors.MutedText)
                                    Text(
                                        "${activeRegistryRow?.nozzleId ?: "—"} (${activeRegistryIndex + 1}/${registryDrafts.size})",
                                        style = MaterialTheme.typography.titleSmall,
                                        color = LaiqColors.AccentOrange,
                                    )
                                }
                            }
                            LaiqSecondaryButton(
                                text = "Next",
                                onClick = {
                                    activeRegistryIndex = (activeRegistryIndex + 1).coerceAtMost(registryDrafts.lastIndex)
                                    syncPendingPlacementFromRow(registryDrafts.getOrNull(activeRegistryIndex))
                                    placementModeEnabled = false
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(72.dp),
                            )
                        }
                    }
                    if (activeRegistryRow != null) {
                        androidx.compose.material3.Surface(
                            modifier = Modifier.fillMaxWidth(),
                            color = androidx.compose.ui.graphics.Color.White,
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, LaiqColors.BrandTeal),
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                androidx.compose.foundation.layout.Row(
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    modifier = Modifier.fillMaxWidth(),
                                ) {
                                    Text(activeRegistryRow.nozzleId, style = MaterialTheme.typography.titleSmall)
                                    LaiqStatusBadge(
                                        text = if (activeRegistryRow.isReadyForSave()) "Ready" else "Incomplete",
                                        tone = if (activeRegistryRow.isReadyForSave()) LaiqColors.StatusReady else LaiqColors.AccentOrange,
                                    )
                                }
                                LaiqDropdownField(
                                    label = "Nozzle Size ($nozzleSizeUnit)",
                                    value = activeSizeSelection,
                                    options = nozzleSizeOptions,
                                    onSelected = { selection ->
                                        registryDrafts = registryDrafts.updateRoofRegistryRow(activeRegistryIndex) {
                                            copy(
                                                size = applyNozzleSizeSelection(size, selection, nozzleSizeUnitType),
                                            )
                                        }
                                    },
                                )
                                if (showingCustomSizeInput) {
                                    LaiqTextField(
                                        value = activeRegistryRow.size,
                                        onValueChange = { size ->
                                            registryDrafts = registryDrafts.updateRoofRegistryRow(activeRegistryIndex) {
                                                copy(size = size)
                                            }
                                        },
                                        label = { Text("Custom Nozzle Size") },
                                        modifier = Modifier.fillMaxWidth(),
                                    )
                                }
                                LaiqDropdownField(
                                    label = "Reinforcement Pad",
                                    value = if (activeRegistryRow.hasReinforcementPad) "yes" else "no",
                                    options = listOf("yes" to "Yes", "no" to "No Pad"),
                                    onSelected = { selection ->
                                        registryDrafts = registryDrafts.updateRoofRegistryRow(activeRegistryIndex) {
                                            copy(hasReinforcementPad = selection == "yes")
                                        }
                                    },
                                )
                                LaiqDropdownField(
                                    label = "Plate Link",
                                    value = activeRegistryRow.plateId,
                                    options = plateOptions,
                                    onSelected = { plateId ->
                                        registryDrafts = registryDrafts.updateRoofRegistryRow(activeRegistryIndex) {
                                            copy(plateId = plateId)
                                        }
                                        pendingPlacementPlateId = plateId
                                        pendingPlacementAzimuth = ""
                                        pendingPlacementRadius = ""
                                        initializePlacementFromLinkedPlate()
                                        placementModeEnabled = true
                                    },
                                )
                                androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    LaiqSecondaryButton(
                                        text = "Clear",
                                        onClick = {
                                            pendingPlacementAzimuth = ""
                                            pendingPlacementRadius = ""
                                            registryDrafts = registryDrafts.updateRoofRegistryRow(activeRegistryIndex) {
                                                copy(azimuthDeg = "", radiusRatio = "")
                                            }
                                        },
                                        enabled = activeRegistryRow.hasPlateLink(),
                                        modifier = Modifier.weight(1f),
                                    )
                                    LaiqPrimaryButton(
                                        text = "Confirm Location",
                                        enabled = activeRegistryRow.hasPlateLink(),
                                        onClick = {
                                            if (!initializePlacementFromLinkedPlate()) return@LaiqPrimaryButton
                                            val confirmedAzimuth = pendingPlacementAzimuth.toDoubleOrNull() ?: return@LaiqPrimaryButton
                                            val confirmedRadius = pendingPlacementRadius.toDoubleOrNull() ?: return@LaiqPrimaryButton
                                            registryDrafts = registryDrafts.updateRoofRegistryRow(activeRegistryIndex) {
                                                copy(
                                                    plateId = pendingPlacementPlateId,
                                                    azimuthDeg = confirmedAzimuth.toInt().toString(),
                                                    radiusRatio = "%.2f".format(confirmedRadius),
                                                )
                                            }
                                            placementModeEnabled = true
                                        },
                                        modifier = Modifier.weight(1f),
                                    )
                                }
                            }
                        }
                    }
                    if (activeRegistryRow != null) {
                        Text(
                            "Select a coarse plate from the dropdown or tap the roof map, then use the adjust pad to refine the nozzle position.",
                            style = MaterialTheme.typography.bodySmall,
                            color = LaiqColors.MutedText,
                        )
                    }
                    val draftNozzleMarkers = registryDrafts.mapIndexed { index, row ->
                        val previewAzimuth = if (index == activeRegistryIndex) pendingPlacementAzimuth.toDoubleOrNull() else null
                        val previewRadius = if (index == activeRegistryIndex) pendingPlacementRadius.toDoubleOrNull() else null
                        val previewPlateId = if (index == activeRegistryIndex) pendingPlacementPlateId.ifBlank { null } else null
                        RoofMapMarker(
                            markerId = "draft-roof-nozzle-$index",
                            label = row.nozzleId,
                            plateId = previewPlateId ?: row.plateId.ifBlank { null },
                            azimuthDeg = previewAzimuth ?: row.azimuthDeg.toDoubleOrNull(),
                            radiusRatio = previewRadius ?: row.radiusRatio.toDoubleOrNull(),
                            active = index == activeRegistryIndex,
                        )
                    }
                    androidx.compose.foundation.layout.Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        val editingRoofNozzle = activeRegistryRow
                        RoofSurfaceMap(
                            template = roofLayout.template,
                            rowCount = roofLayout.rowCount ?: 0,
                            widestRowPlateCount = roofLayout.widestRowPlateCount ?: 0,
                            ringCount = roofLayout.ringCount ?: 0,
                            sectorCount = roofLayout.sectorCount ?: 0,
                            activePlateId = editingRoofNozzle?.plateId.orEmpty(),
                            savedPlateIds = emptySet(),
                            overlayPlateIds = registryDrafts.mapNotNull { row -> row.plateId.takeIf { it.isNotBlank() } }.toSet(),
                            centerFeatureCount = 0,
                            hasAnnularRing = roofLayout.hasAnnularRing,
                            annularSectionCount = roofLayout.annularSectionCount ?: 0,
                            hasPontoonDeck = roofLayout.hasPontoonDeck,
                            markers = draftState.roofFeatures.map { feature ->
                                RoofMapMarker(
                                    markerId = feature.featureId,
                                    label = feature.label ?: roofFeatureTypeLabel(feature.type),
                                    plateId = feature.plateId,
                                    azimuthDeg = feature.azimuthDeg,
                                    radiusRatio = feature.radiusRatio,
                                )
                            } + draftNozzleMarkers.filterNot { marker -> marker.active },
                            referenceLabel = roofReferenceLabel,
                            referenceAzimuthDeg = roofReferenceAzimuth,
                            rotationDirection = committedScope.rotationDirection,
                            onSelectPlate = { plateId ->
                                activeRegistryRow ?: return@RoofSurfaceMap
                                registryDrafts = registryDrafts.updateRoofRegistryRow(activeRegistryIndex) {
                                    copy(plateId = plateId)
                                }
                                pendingPlacementPlateId = plateId
                                pendingPlacementAzimuth = ""
                                pendingPlacementRadius = ""
                                initializePlacementFromLinkedPlate()
                                placementModeEnabled = true
                            },
                            onSelectPosition = { azimuthDeg, radiusRatio ->
                                previewNozzlePlacement(azimuthDeg, radiusRatio)
                            },
                            modifier = Modifier.weight(1f),
                        )
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            LaiqLabeledValue(
                                label = "Estimated Position",
                                value = when {
                                    editingRoofNozzle?.hasPlateLink() == true ->
                                        "${pendingPlacementAzimuth.ifBlank { editingRoofNozzle.azimuthDeg.ifBlank { "—" } }}° / ${pendingPlacementRadius.ifBlank { editingRoofNozzle.radiusRatio.ifBlank { "0.50" } }}R"
                                    else -> "Select a plate first"
                                },
                            )
                            LaiqPlacementAdjustPad(
                                enabled = editingRoofNozzle?.hasPlateLink() == true && initializePlacementFromLinkedPlate(),
                                onUp = { nudgeNozzlePlacement(0f, -0.02f) },
                                onDown = { nudgeNozzlePlacement(0f, 0.02f) },
                                onLeft = { nudgeNozzlePlacement(-0.02f, 0f) },
                                onRight = { nudgeNozzlePlacement(0.02f, 0f) },
                            )
                        }
                    }
                    Text(
                        "Saving a changed roof nozzle registry will refresh saved roof nozzle UT rows and related roof nozzle findings. All nozzle rows need size and plate link before Save is enabled.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.StatusWarning,
                    )
                    androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        LaiqPrimaryButton(
                            text = "Save Roof Registry",
                            enabled = registryReady,
                            onClick = {
                                onDraftStateChange(draftState.replaceRoofNozzleRegistry(registryDrafts.toRoofNozzleDefinitions()))
                                placementModeEnabled = false
                                showRegistryEditor = false
                            },
                            modifier = Modifier.weight(1f),
                        )
                        LaiqSecondaryButton(
                            text = "Delete All",
                            onClick = {
                                onDraftStateChange(draftState.replaceRoofNozzleRegistry(emptyList()))
                                registryDrafts = defaultRoofRegistryDraftRows(1)
                                registryCount = "1"
                                activeRegistryIndex = 0
                                syncPendingPlacementFromRow(registryDrafts.firstOrNull())
                                placementModeEnabled = false
                                showRegistryEditor = false
                            },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }

        item {
            LaiqSectionCard(
                title = "Registered Roof Nozzles",
                subtitle = "Recent roof nozzle definitions saved on device.",
            ) {
                if (draftState.roofNozzles.isEmpty()) {
                    Text("No roof nozzles registered yet.", style = MaterialTheme.typography.bodySmall)
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        draftState.roofNozzles.forEach { nozzle ->
                            NozzleDefinitionCard(nozzle = nozzle)
                        }
                    }
                }
            }
        }

        item {
            LaiqSectionCard(
                title = "Roof Nozzle UT",
                subtitle = "Select a registered roof nozzle, then save one UT row at a time.",
            ) {
                if (draftState.roofNozzles.isEmpty()) {
                    Text("Register at least one roof nozzle first.", style = MaterialTheme.typography.bodySmall)
                } else {
                    val selectedNozzleId = draftState.roofNozzleUtDraft.nozzleId
                        .ifBlank { draftState.roofNozzles.firstOrNull()?.nozzleId.orEmpty() }
                    val selectedNozzle = draftState.roofNozzles.firstOrNull { nozzle -> nozzle.nozzleId == selectedNozzleId }
                    val selectedNozzleLocationLabel = selectedNozzle?.let { nozzle ->
                        nozzle.plateId?.takeIf { it.isNotBlank() }?.let { plateId ->
                            "${nozzle.nozzleId} · Plate $plateId"
                        } ?: nozzle.nozzleId
                    }
                    val selectedNozzleFindingCount = selectedNozzle?.let { nozzle ->
                        draftState.findingsForMeasurement(
                            surface = "roof_nozzle",
                            linkedMeasurementId = nozzle.nozzleId,
                            locationSummary = selectedNozzleLocationLabel.orEmpty(),
                        ).size
                    } ?: 0
                    LaiqDropdownField(
                        label = "Selected Roof Nozzle",
                        value = selectedNozzleId,
                        options = draftState.roofNozzles.map { it.nozzleId to "${it.nozzleId} · ${it.size}" },
                        onSelected = { nozzleId ->
                            onDraftStateChange(
                                draftState.copy(roofNozzleUtDraft = draftState.roofNozzleUtDraft.copy(nozzleId = nozzleId)),
                            )
                        },
                    )
                    selectedNozzle?.let { nozzle ->
                        val roofNozzleMarkers = draftState.roofNozzles.map { registeredNozzle ->
                            RoofMapMarker(
                                markerId = registeredNozzle.nozzleId,
                                label = registeredNozzle.nozzleId,
                                plateId = registeredNozzle.plateId,
                                azimuthDeg = registeredNozzle.azimuthDeg,
                                radiusRatio = registeredNozzle.radiusRatio,
                                active = registeredNozzle.nozzleId == nozzle.nozzleId,
                            )
                        }
                        nozzle.plateId?.takeIf { it.isNotBlank() }?.let { plateId ->
                            ai.laiq.tankinspection.presentation.components.LaiqLabeledValue(
                                label = "Selected Nozzle Location",
                                value = "${nozzle.nozzleId} · Plate $plateId",
                            )
                        }
                        RoofSurfaceMap(
                            template = roofLayout.template,
                            rowCount = roofLayout.rowCount ?: 0,
                            widestRowPlateCount = roofLayout.widestRowPlateCount ?: 0,
                            ringCount = roofLayout.ringCount ?: 0,
                            sectorCount = roofLayout.sectorCount ?: 0,
                            activePlateId = nozzle.plateId,
                            savedPlateIds = emptySet(),
                            overlayPlateIds = draftState.roofNozzles.mapNotNull { registryNozzle ->
                                registryNozzle.plateId?.takeIf { it.isNotBlank() }
                            }.toSet(),
                            centerFeatureCount = 0,
                            hasAnnularRing = roofLayout.hasAnnularRing,
                            annularSectionCount = roofLayout.annularSectionCount ?: 0,
                            hasPontoonDeck = roofLayout.hasPontoonDeck,
                            markers = draftState.roofFeatures.map { feature ->
                                RoofMapMarker(
                                    markerId = feature.featureId,
                                    label = feature.label ?: roofFeatureTypeLabel(feature.type),
                                    plateId = feature.plateId,
                                    azimuthDeg = feature.azimuthDeg,
                                    radiusRatio = feature.radiusRatio,
                                )
                            } + roofNozzleMarkers,
                            referenceLabel = roofReferenceLabel,
                            referenceAzimuthDeg = roofReferenceAzimuth,
                            rotationDirection = committedScope.rotationDirection,
                            onSelectPlate = { },
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Text(
                            "Thickness readings are captured in $thicknessUnit. Nozzle size uses $nozzleSizeUnit.",
                            style = MaterialTheme.typography.bodySmall,
                            color = LaiqColors.MutedText,
                        )
                    }
                    LaiqDropdownField(
                        label = "Capture State",
                        value = draftState.roofNozzleUtDraft.captureState.name,
                        options = measurementCaptureStateOptions(includeNotApplicable = true),
                        onSelected = { selected ->
                            onDraftStateChange(
                                draftState.copy(
                                    roofNozzleUtDraft = draftState.roofNozzleUtDraft.copy(
                                        captureState = ai.laiq.tankinspection.domain.model.MeasurementCaptureState.valueOf(selected),
                                    ),
                                ),
                            )
                        },
                    )
                    NozzleReadingInputs(
                        draft = draftState.roofNozzleUtDraft,
                        readingLabels = roofNozzleReadingLabels,
                        includeReinforcementPad = selectedNozzle?.hasReinforcementPad != false,
                        unitLabel = thicknessUnit,
                        onDraftChange = { updated ->
                            onDraftStateChange(draftState.copy(roofNozzleUtDraft = updated))
                        },
                    )
                    LaiqPrimaryButton(
                        text = "Save Roof Nozzle UT",
                        onClick = { onDraftStateChange(draftState.saveRoofNozzleUtDraft()) },
                    )
                    selectedNozzle?.let { nozzle ->
                        LaiqSecondaryButton(
                            text = if (selectedNozzleFindingCount > 0) "Add Finding ($selectedNozzleFindingCount)" else "Add Finding",
                            onClick = {
                                onOpenFindings(
                                    draftState.beginFindingForMeasurement(
                                        surface = "roof_nozzle",
                                        linkedMeasurementId = nozzle.nozzleId,
                                        locationSummary = selectedNozzleLocationLabel.orEmpty(),
                                    ),
                                )
                            },
                        )
                    }
                }
            }
        }

        item {
            LaiqSectionCard(
                title = "Saved Roof Nozzle Rows",
                subtitle = "Recent roof nozzle UT entries captured locally.",
            ) {
                if (draftState.roofNozzleUtRows.isEmpty()) {
                    Text("No roof nozzle UT rows saved yet.", style = MaterialTheme.typography.bodySmall)
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        draftState.roofNozzleUtRows.takeLast(8).reversed().forEach { row ->
                            val nozzle = draftState.roofNozzles.firstOrNull { registered -> registered.nozzleId == row.nozzleId }
                            val rowLocationLabel = nozzle?.plateId?.takeIf { it.isNotBlank() }?.let { plateId ->
                                "${row.nozzleId} · Plate $plateId"
                            } ?: row.nozzleId
                            val rowFindingCount = draftState.findingsForMeasurement(
                                surface = "roof_nozzle",
                                linkedMeasurementId = row.nozzleId,
                                locationSummary = rowLocationLabel,
                            ).size
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                NozzleUtRowCard(
                                    row = row,
                                    readingLabels = roofNozzleReadingLabels,
                                    includeReinforcementPad = nozzle?.hasReinforcementPad != false,
                                    thicknessUnit = thicknessUnit,
                                )
                                androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    LaiqSecondaryButton(
                                        text = "Edit",
                                        onClick = { onDraftStateChange(draftState.editRoofNozzleUtRow(row.rowId)) },
                                        modifier = Modifier.weight(1f),
                                    )
                                    LaiqSecondaryButton(
                                        text = "Delete",
                                        onClick = { onDraftStateChange(draftState.removeRoofNozzleUtRow(row.rowId)) },
                                        modifier = Modifier.weight(1f),
                                    )
                                }
                                LaiqSecondaryButton(
                                    text = if (rowFindingCount > 0) "Findings ($rowFindingCount)" else "Add Finding",
                                    onClick = {
                                        onOpenFindings(
                                            draftState.beginFindingForMeasurement(
                                                surface = "roof_nozzle",
                                                linkedMeasurementId = row.nozzleId,
                                                locationSummary = rowLocationLabel,
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

        item {
            LaiqSecondaryButton("Back", onBack)
        }
    }
}

@Composable
private fun RoofNozzleInputs(
    draft: RoofNozzleDraftInput,
    draftState: FieldDraftState,
    roofLayout: ai.laiq.tankinspection.domain.model.RoofLayout?,
    plateOptions: List<Pair<String, String>>,
    roofReferenceLabel: String,
    roofReferenceAzimuth: Double,
    rotationDirection: ai.laiq.tankinspection.domain.model.RotationDirection,
    onDraftChange: (RoofNozzleDraftInput) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedTextField(
            value = draft.nozzleId,
            onValueChange = { onDraftChange(draft.copy(nozzleId = it)) },
            label = { Text("Nozzle ID") },
            shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        LaiqTextField(
            value = draft.size,
            onValueChange = { onDraftChange(draft.copy(size = it)) },
            label = { Text("Nozzle Size") },
            modifier = Modifier.fillMaxWidth(),
        )
        if (roofLayout != null) {
            Text(
                "Tap the roof guide or use the dropdown to link the nozzle to a roof plate.",
                style = MaterialTheme.typography.bodySmall,
                color = LaiqColors.MutedText,
            )
            LaiqDropdownField(
                label = "Linked Plate",
                value = draft.plateId,
                options = plateOptions,
                onSelected = { plateId ->
                    onDraftChange(draft.copy(plateId = plateId, placementMode = "plate_linked", azimuthDeg = ""))
                },
            )
            RoofSurfaceMap(
                template = roofLayout.template,
                rowCount = roofLayout.rowCount ?: 0,
                widestRowPlateCount = roofLayout.widestRowPlateCount ?: 0,
                ringCount = roofLayout.ringCount ?: 0,
                sectorCount = roofLayout.sectorCount ?: 0,
                activePlateId = draft.plateId,
                savedPlateIds = emptySet(),
                overlayPlateIds = draftState.roofNozzles.mapNotNull { it.plateId }.toSet(),
                centerFeatureCount = 0,
                hasAnnularRing = roofLayout.hasAnnularRing,
                annularSectionCount = roofLayout.annularSectionCount ?: 0,
                hasPontoonDeck = roofLayout.hasPontoonDeck,
                markers = draftState.roofFeatures.map { feature ->
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
                rotationDirection = rotationDirection,
                onSelectPlate = { plateId ->
                    onDraftChange(draft.copy(plateId = plateId, placementMode = "plate_linked", azimuthDeg = ""))
                },
                modifier = Modifier.fillMaxWidth(),
            )
        } else {
            Text(
                "Define the roof layout first so roof nozzles can be linked to the numbered roof plates.",
                style = MaterialTheme.typography.bodySmall,
                color = LaiqColors.MutedText,
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SketchRoofNozzleGuide(
    template: RoofTemplate,
    rowCount: Int,
    widestRowPlateCount: Int,
    ringCount: Int,
    sectorCount: Int,
    activePlateId: String,
    onSelectPlate: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Roof Placement Guide", style = MaterialTheme.typography.titleSmall)
        when (template) {
            RoofTemplate.CIRCULAR_PLATE,
            RoofTemplate.CIRCULAR_CENTER_OPENING -> {
                val rows = rowCount.coerceAtLeast(1)
                val maxPlates = widestRowPlateCount.coerceAtLeast(1)
                for (row in 1..rows) {
                    androidx.compose.foundation.layout.FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        val plateCount = maxOf(1, maxPlates - kotlin.math.abs((rows + 1) / 2 - row))
                        for (plate in 1..plateCount) {
                            val plateId = "R$row-P$plate"
                            RoofNozzlePlateBadge(
                                plateId = plateId,
                                active = plateId == activePlateId,
                                onClick = { onSelectPlate(plateId) },
                            )
                        }
                    }
                }
            }

            RoofTemplate.UMBRELLA_RADIAL -> {
                val plateCells = ai.laiq.tankinspection.presentation.buildRoofPlateCells(
                    template = template,
                    rowCount = rowCount,
                    widestRowPlateCount = widestRowPlateCount,
                    ringCount = ringCount,
                    sectorCount = sectorCount,
                )
                plateCells
                    .groupBy { cell -> cell.rowNumber }
                    .toSortedMap()
                    .values
                    .forEach { ringCells ->
                    androidx.compose.foundation.layout.FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        ringCells.forEach { cell ->
                            RoofNozzlePlateBadge(
                                plateId = cell.plateId,
                                active = cell.plateId == activePlateId,
                                onClick = { onSelectPlate(cell.plateId) },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RoofNozzlePlateBadge(
    plateId: String,
    active: Boolean,
    onClick: () -> Unit,
) {
    androidx.compose.material3.Surface(
        onClick = onClick,
        color = if (active) LaiqColors.BrandTeal else androidx.compose.ui.graphics.Color.White,
        shape = androidx.compose.foundation.shape.RoundedCornerShape(14.dp),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            if (active) LaiqColors.BrandTeal else LaiqColors.PanelBorder,
        ),
    ) {
        Text(
            plateId,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
            style = MaterialTheme.typography.labelMedium,
            color = if (active) androidx.compose.ui.graphics.Color.White else LaiqColors.BodyText,
        )
    }
}

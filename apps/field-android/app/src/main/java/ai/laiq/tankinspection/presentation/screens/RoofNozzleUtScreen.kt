package ai.laiq.tankinspection.presentation.screens

import ai.laiq.tankinspection.domain.model.NozzleDefinition
import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.presentation.beginRoofNozzleUtForNozzle
import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.RoofNozzleDraftInput
import ai.laiq.tankinspection.presentation.activeRoofSurfaceConfig
import ai.laiq.tankinspection.presentation.availableRoofSurfaces
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
import ai.laiq.tankinspection.presentation.components.LaiqDeleteConfirmDialog
import ai.laiq.tankinspection.presentation.components.LaiqDeleteDialogState
import ai.laiq.tankinspection.presentation.components.LaiqDropdownField
import ai.laiq.tankinspection.presentation.components.LaiqLegendEntry
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
import ai.laiq.tankinspection.presentation.normalizedActiveRoofSurfaceId
import ai.laiq.tankinspection.presentation.replaceRoofNozzleRegistry
import ai.laiq.tankinspection.presentation.roofPlateIdAtPolar
import ai.laiq.tankinspection.presentation.removeRoofNozzleUtForNozzle
import ai.laiq.tankinspection.presentation.roofFeatureTypeLabel
import ai.laiq.tankinspection.presentation.roofNozzleFindingSurface
import ai.laiq.tankinspection.presentation.roofPolarToCanvasPoint
import ai.laiq.tankinspection.presentation.roofReferenceSummaryLabel
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
private fun RoofNozzleLegendStatus(
    editingRoofNozzle: RoofRegistryDraftRow?,
    pendingPlacementAzimuth: String,
    pendingPlacementRadius: String,
    onNudgeUp: () -> Unit,
    onNudgeDown: () -> Unit,
    onNudgeLeft: () -> Unit,
    onNudgeRight: () -> Unit,
    placementEnabled: Boolean,
) {
    LaiqLabeledValue(
        label = "Estimated Position",
        value = when {
            editingRoofNozzle?.hasPlateLink() == true -> {
                val displayRadius = pendingPlacementRadius
                    .ifBlank { editingRoofNozzle.radiusRatio.ifBlank { "0.50" } }
                    .toDoubleOrNull()
                    ?.let { value -> "%.2f".format(value) }
                    ?: pendingPlacementRadius.ifBlank { editingRoofNozzle.radiusRatio.ifBlank { "0.50" } }
                "${pendingPlacementAzimuth.ifBlank { editingRoofNozzle.azimuthDeg.ifBlank { "—" } }}° / ${displayRadius}R"
            }

            else -> "Select a plate first"
        },
    )
    LaiqPlacementAdjustPad(
        enabled = placementEnabled,
        onUp = onNudgeUp,
        onDown = onNudgeDown,
        onLeft = onNudgeLeft,
        onRight = onNudgeRight,
    )
}

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
    val roofSurfaceId = draftState.normalizedActiveRoofSurfaceId()
    val roofSurfaceConfig = draftState.activeRoofSurfaceConfig()
    val roofSurfaceOptions = draftState.committedSetupState().availableRoofSurfaces()
    val roofSurfaceLabel = roofSurfaceConfig?.label ?: "Roof"
    val roofLayout = draftState.buildRoofLayoutOrNull(roofSurfaceId)
    val hasSavedLayout = draftState.hasSavedRoofLayout(roofSurfaceId)
    val hasPendingChanges = draftState.hasPendingRoofLayoutChanges(roofSurfaceId)
    val surfaceRoofNozzles = draftState.roofNozzles.filter { nozzle -> nozzle.roofSurfaceId == roofSurfaceId }
    val surfaceRoofNozzleUtRows = draftState.roofNozzleUtRows.filter { row -> row.roofSurfaceId == roofSurfaceId }

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
    val roofReferenceLabel = committedScope.roofReferenceSummaryLabel()
    val roofReferenceAzimuth = committedScope.referenceAzimuthDeg()
    var showRegistryEditor by rememberSaveable { mutableStateOf(false) }
    var registryCount by remember(roofSurfaceId, surfaceRoofNozzles) { mutableStateOf(surfaceRoofNozzles.size.takeIf { it > 0 }?.toString() ?: "1") }
    var registryDrafts by remember(roofSurfaceId, surfaceRoofNozzles) { mutableStateOf(surfaceRoofNozzles.toRoofRegistryDraftRows().ifEmpty { defaultRoofRegistryDraftRows(1) }) }
    var activeRegistryIndex by remember { mutableIntStateOf(0) }
    var placementModeEnabled by rememberSaveable { mutableStateOf(false) }
    var pendingPlacementAzimuth by rememberSaveable { mutableStateOf("") }
    var pendingPlacementRadius by rememberSaveable { mutableStateOf("") }
    var pendingPlacementPlateId by rememberSaveable { mutableStateOf("") }
    var confirmedPlacementPlateIds by remember(roofSurfaceId, registryDrafts.map { it.nozzleId }.joinToString("|"), registryDrafts.size) {
        mutableStateOf(registryDrafts.map { it.plateId })
    }
    var confirmedPlacementAzimuths by remember(roofSurfaceId, registryDrafts.map { it.nozzleId }.joinToString("|"), registryDrafts.size) {
        mutableStateOf(registryDrafts.map { it.azimuthDeg })
    }
    var confirmedPlacementRadii by remember(roofSurfaceId, registryDrafts.map { it.nozzleId }.joinToString("|"), registryDrafts.size) {
        mutableStateOf(registryDrafts.map { it.radiusRatio })
    }
    val listState = rememberLazyListState()
    var showUtEditor by rememberSaveable { mutableStateOf(false) }
    var pendingDelete by remember { mutableStateOf<LaiqDeleteDialogState?>(null) }
    var selectedOverviewNozzleId by rememberSaveable(roofSurfaceId, surfaceRoofNozzles.map { it.nozzleId }.joinToString("|")) {
        mutableStateOf(surfaceRoofNozzles.firstOrNull()?.nozzleId.orEmpty())
    }
    val activeRegistryRow = registryDrafts.getOrNull(activeRegistryIndex)
    val registryReady = registryDrafts.isNotEmpty() && registryDrafts.all { row -> row.isReadyForSave() }
    val activeSizeSelection = activeRegistryRow?.let { row -> selectedNozzleSizeOption(row.size, nozzleSizeUnitType) }.orEmpty()
    val showingCustomSizeInput = activeRegistryRow != null && activeSizeSelection == customNozzleSizeOptionValue
    val maxPlacementRadiusRatio = if (roofLayout.hasAnnularRing) 0.48 / 0.42 else 1.0
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

    fun placementMatchesLinkedPlate(
        linkedPlateId: String,
        azimuthText: String,
        radiusText: String,
    ): Boolean {
        val azimuthDeg = azimuthText.toDoubleOrNull() ?: return false
        val radiusRatio = radiusText.toDoubleOrNull() ?: return false
        val resolvedPlateId = roofPlateIdAtPolar(
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
        return resolvedPlateId == linkedPlateId
    }

    fun derivePlacementFromLinkedPlate(linkedPlateId: String): Boolean {
        val linkedCell = roofLinkTargets.firstOrNull { cell -> cell.plateId == linkedPlateId } ?: return false
        val (derivedAzimuth, derivedRadius) = canvasPointToRoofPolar(linkedCell.xNorm, linkedCell.yNorm)
        previewNozzlePlacement(derivedAzimuth, derivedRadius)
        return true
    }

    fun syncPendingPlacementFromRow(row: RoofRegistryDraftRow?) {
        val linkedPlateId = row?.plateId.orEmpty()
        pendingPlacementPlateId = linkedPlateId
        val savedAzimuth = row?.azimuthDeg.orEmpty()
        val savedRadius = row?.radiusRatio.orEmpty()
        if (linkedPlateId.isNotBlank() && placementMatchesLinkedPlate(linkedPlateId, savedAzimuth, savedRadius)) {
            pendingPlacementAzimuth = savedAzimuth
            pendingPlacementRadius = savedRadius
            return
        }
        pendingPlacementAzimuth = ""
        pendingPlacementRadius = ""
        if (linkedPlateId.isNotBlank()) {
            derivePlacementFromLinkedPlate(linkedPlateId)
        }
    }

    fun undoPendingPlacement() {
        val activeRow = activeRegistryRow ?: return
        val restoredPlateId = confirmedPlacementPlateIds.getOrElse(activeRegistryIndex) { activeRow.plateId }
        val restoredAzimuth = confirmedPlacementAzimuths.getOrElse(activeRegistryIndex) { activeRow.azimuthDeg }
        val restoredRadius = confirmedPlacementRadii.getOrElse(activeRegistryIndex) { activeRow.radiusRatio }
        registryDrafts = registryDrafts.updateRoofRegistryRow(activeRegistryIndex) {
            copy(
                plateId = restoredPlateId,
                azimuthDeg = restoredAzimuth,
                radiusRatio = restoredRadius,
            )
        }
        syncPendingPlacementFromRow(registryDrafts.getOrNull(activeRegistryIndex))
        placementModeEnabled = restoredPlateId.isNotBlank()
    }

    fun initializePlacementFromLinkedPlate(): Boolean {
        val linkedPlateId = pendingPlacementPlateId.ifBlank { activeRegistryRow?.plateId.orEmpty() }.ifBlank { return false }
        if (placementMatchesLinkedPlate(linkedPlateId, pendingPlacementAzimuth, pendingPlacementRadius)) return true
        pendingPlacementAzimuth = ""
        pendingPlacementRadius = ""
        return derivePlacementFromLinkedPlate(linkedPlateId)
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
        val existingRows = surfaceRoofNozzles.toRoofRegistryDraftRows()
        registryDrafts = existingRows.ifEmpty { defaultRoofRegistryDraftRows(1) }
        registryCount = registryDrafts.size.toString()
        activeRegistryIndex = 0
        syncPendingPlacementFromRow(registryDrafts.firstOrNull())
        placementModeEnabled = false
        showRegistryEditor = true
    }

    fun openRegistryEditorForNozzle(nozzleId: String) {
        val existingRows = surfaceRoofNozzles.toRoofRegistryDraftRows()
        registryDrafts = existingRows.ifEmpty { defaultRoofRegistryDraftRows(1) }
        registryCount = registryDrafts.size.toString()
        activeRegistryIndex = existingRows.indexOfFirst { row -> row.nozzleId == nozzleId }.coerceAtLeast(0)
        syncPendingPlacementFromRow(registryDrafts.getOrNull(activeRegistryIndex))
        placementModeEnabled = false
        showRegistryEditor = true
        showUtEditor = false
    }

    LaunchedEffect(draftState.roofNozzleUtDraft.editingRowId) {
        if (draftState.roofNozzleUtDraft.editingRowId != null) {
            showUtEditor = true
        }
    }

    LaunchedEffect(showRegistryEditor) {
        if (showRegistryEditor) {
            listState.animateScrollToItem(0)
        }
    }

    LaunchedEffect(roofSurfaceId, surfaceRoofNozzles.map { nozzle -> nozzle.nozzleId }) {
        if (surfaceRoofNozzles.none { nozzle -> nozzle.nozzleId == selectedOverviewNozzleId }) {
            selectedOverviewNozzleId = surfaceRoofNozzles.firstOrNull()?.nozzleId.orEmpty()
        }
    }

    val selectedOverviewNozzle = surfaceRoofNozzles.firstOrNull { nozzle -> nozzle.nozzleId == selectedOverviewNozzleId }
        ?: surfaceRoofNozzles.firstOrNull()
    val selectedOverviewRoofMarker = selectedOverviewNozzle?.let { nozzle ->
        RoofMapMarker(
            markerId = nozzle.nozzleId,
            label = nozzle.nozzleId,
            plateId = nozzle.plateId,
            azimuthDeg = nozzle.azimuthDeg,
            radiusRatio = nozzle.radiusRatio,
            active = true,
        )
    }
    val selectedOverviewPlateIds = selectedOverviewNozzle?.plateId?.takeIf { it.isNotBlank() }?.let(::setOf) ?: emptySet()
    val selectedOverviewPositionSummary = selectedOverviewNozzle?.let { nozzle ->
        buildString {
            nozzle.plateId?.takeIf { it.isNotBlank() }?.let { plateId ->
                append("Linked plate: $plateId")
            } ?: append("No plate linked yet")
            if (nozzle.azimuthDeg != null && nozzle.radiusRatio != null) {
                append(" · ${nozzle.azimuthDeg.toInt()}° / ${"%.2f".format(nozzle.radiusRatio)}R")
            }
        }
    }

    pendingDelete?.let { dialogState ->
        LaiqDeleteConfirmDialog(
            state = dialogState,
            onDismiss = { pendingDelete = null },
        )
    }

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
                title = "Roof Nozzle Registry",
                subtitle = "Register roof nozzles one by one. Set the count, then confirm each generated nozzle with its size, plate link, and reinforcement pad.",
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
                                    roofUtDraft = draftState.roofUtDraft.copy(roofSurfaceId = selectedSurfaceId),
                                    roofNozzleDraft = draftState.roofNozzleDraft.copy(roofSurfaceId = selectedSurfaceId, plateId = "", azimuthDeg = ""),
                                    roofNozzleUtDraft = draftState.roofNozzleUtDraft.copy(roofSurfaceId = selectedSurfaceId, nozzleId = ""),
                                ),
                            )
                        },
                    )
                }
                androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LaiqStatChip("Registered", surfaceRoofNozzles.size.toString(), modifier = Modifier.weight(1f))
                    LaiqStatChip("UT Rows", surfaceRoofNozzleUtRows.size.toString(), tone = LaiqColors.AccentOrange, modifier = Modifier.weight(1f))
                }
                androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    LaiqPrimaryButton(
                        text = if (surfaceRoofNozzles.isEmpty()) "Add Roof Nozzles" else "Edit Roof Registry",
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
                if (!showRegistryEditor && surfaceRoofNozzles.isNotEmpty()) {
                    LaiqDropdownField(
                        label = "Roof Nozzle",
                        value = selectedOverviewNozzle?.nozzleId.orEmpty(),
                        options = surfaceRoofNozzles.map { nozzle -> nozzle.nozzleId to nozzle.nozzleId },
                        onSelected = { nozzleId -> selectedOverviewNozzleId = nozzleId },
                    )
                    selectedOverviewPositionSummary?.let { summary ->
                        Text(
                            text = summary,
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
                        activePlateId = selectedOverviewNozzle?.plateId.orEmpty(),
                        savedPlateIds = emptySet(),
                        overlayPlateIds = selectedOverviewPlateIds,
                        centerFeatureCount = 0,
                        hasAnnularRing = roofLayout.hasAnnularRing,
                        annularSectionCount = roofLayout.annularSectionCount ?: 0,
                        hasPontoonDeck = roofLayout.hasPontoonDeck,
                        markers = listOfNotNull(selectedOverviewRoofMarker),
                        showMarkerLabels = false,
                        showMarkerCallouts = selectedOverviewRoofMarker != null,
                        referenceLabel = roofReferenceLabel,
                        referenceAzimuthDeg = roofReferenceAzimuth,
                        rotationDirection = committedScope.rotationDirection,
                        onSelectPosition = null,
                        onSelectPlate = {},
                        modifier = Modifier.fillMaxWidth(),
                    )
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
                                        text = "Undo",
                                        onClick = { undoPendingPlacement() },
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
                                            confirmedPlacementPlateIds = confirmedPlacementPlateIds.toMutableList().apply {
                                                while (size <= activeRegistryIndex) add("")
                                                this[activeRegistryIndex] = pendingPlacementPlateId
                                            }
                                            confirmedPlacementAzimuths = confirmedPlacementAzimuths.toMutableList().apply {
                                                while (size <= activeRegistryIndex) add("")
                                                this[activeRegistryIndex] = confirmedAzimuth.toInt().toString()
                                            }
                                            confirmedPlacementRadii = confirmedPlacementRadii.toMutableList().apply {
                                                while (size <= activeRegistryIndex) add("")
                                                this[activeRegistryIndex] = "%.2f".format(confirmedRadius)
                                            }
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
                            markerId = row.nozzleId,
                            label = row.nozzleId,
                            plateId = previewPlateId ?: row.plateId.ifBlank { null },
                            azimuthDeg = previewAzimuth ?: row.azimuthDeg.toDoubleOrNull(),
                            radiusRatio = previewRadius ?: row.radiusRatio.toDoubleOrNull(),
                            active = index == activeRegistryIndex,
                        )
                    }
                    val roofLegendEntries = registryDrafts.map { row ->
                        LaiqLegendEntry(
                            key = row.nozzleId,
                            label = row.nozzleId,
                            detail = row.plateId.takeIf { it.isNotBlank() }?.let { plateId -> "Plate $plateId" }
                                ?: "No plate linked yet",
                        )
                    }
                    val roofLegendOptions = roofLegendEntries.map { entry ->
                        entry.key to entry.label
                    }
                    val selectedNozzleMarkers = activeRegistryRow?.let { activeRow ->
                        draftNozzleMarkers.filter { marker -> marker.markerId == activeRow.nozzleId }
                    }.orEmpty()
                    val editingRoofNozzle = activeRegistryRow
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        if (roofLegendOptions.isNotEmpty()) {
                            LaiqDropdownField(
                                label = "Roof Nozzle",
                                value = editingRoofNozzle?.nozzleId.orEmpty(),
                                options = roofLegendOptions,
                                onSelected = { nozzleId ->
                                    activeRegistryIndex = registryDrafts.indexOfFirst { row -> row.nozzleId == nozzleId }.coerceAtLeast(0)
                                    syncPendingPlacementFromRow(registryDrafts.getOrNull(activeRegistryIndex))
                                    placementModeEnabled = false
                                },
                            )
                        }
                        editingRoofNozzle?.let { row ->
                            Text(
                                text = row.plateId.takeIf { it.isNotBlank() }?.let { plateId -> "Linked plate: $plateId" }
                                    ?: "No plate linked yet",
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
                            activePlateId = editingRoofNozzle?.plateId.orEmpty(),
                            savedPlateIds = emptySet(),
                            overlayPlateIds = editingRoofNozzle?.plateId?.takeIf { it.isNotBlank() }?.let(::setOf) ?: emptySet(),
                            centerFeatureCount = 0,
                            hasAnnularRing = roofLayout.hasAnnularRing,
                            annularSectionCount = roofLayout.annularSectionCount ?: 0,
                            hasPontoonDeck = roofLayout.hasPontoonDeck,
                            markers = selectedNozzleMarkers,
                            showMarkerLabels = false,
                            showMarkerCallouts = selectedNozzleMarkers.isNotEmpty(),
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
                            modifier = Modifier.fillMaxWidth(),
                        )
                        RoofNozzleLegendStatus(
                            editingRoofNozzle = editingRoofNozzle,
                            pendingPlacementAzimuth = pendingPlacementAzimuth,
                            pendingPlacementRadius = pendingPlacementRadius,
                            onNudgeUp = { nudgeNozzlePlacement(0f, -0.02f) },
                            onNudgeDown = { nudgeNozzlePlacement(0f, 0.02f) },
                            onNudgeLeft = { nudgeNozzlePlacement(-0.02f, 0f) },
                            onNudgeRight = { nudgeNozzlePlacement(0.02f, 0f) },
                            placementEnabled = editingRoofNozzle?.hasPlateLink() == true && initializePlacementFromLinkedPlate(),
                        )
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
                                onDraftStateChange(draftState.replaceRoofNozzleRegistry(registryDrafts.toRoofNozzleDefinitions(), roofSurfaceId))
                                placementModeEnabled = false
                                showRegistryEditor = false
                            },
                            modifier = Modifier.weight(1f),
                        )
                        LaiqSecondaryButton(
                            text = "Delete All",
                            onClick = {
                                pendingDelete = LaiqDeleteDialogState(
                                    title = "Delete All Roof Nozzles?",
                                    message = "This will remove all registered roof nozzles for $roofSurfaceLabel, their UT rows, and related findings.",
                                    confirmText = "Delete All",
                                    onConfirm = {
                                        onDraftStateChange(draftState.replaceRoofNozzleRegistry(emptyList(), roofSurfaceId))
                                        registryDrafts = defaultRoofRegistryDraftRows(1)
                                        registryCount = "1"
                                        activeRegistryIndex = 0
                                        syncPendingPlacementFromRow(registryDrafts.firstOrNull())
                                        placementModeEnabled = false
                                        showRegistryEditor = false
                                        showUtEditor = false
                                    },
                                )
                            },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }

        item {
            LaiqSectionCard(
                title = "Roof Nozzles",
                subtitle = "Each registered roof nozzle keeps its registration, UT, and findings together on one card.",
            ) {
                if (surfaceRoofNozzles.isEmpty()) {
                    Text("No roof nozzles registered yet.", style = MaterialTheme.typography.bodySmall)
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        surfaceRoofNozzles.forEach { nozzle ->
                            val nozzleUtRow = surfaceRoofNozzleUtRows.firstOrNull { row -> row.nozzleId == nozzle.nozzleId }
                            val isEditingThisNozzle = showUtEditor &&
                                draftState.roofNozzleUtDraft.nozzleId == nozzle.nozzleId &&
                                draftState.roofNozzleUtDraft.roofSurfaceId == roofSurfaceId
                            val nozzleLocationLabel = nozzle.plateId?.takeIf { it.isNotBlank() }?.let { plateId ->
                                "${roofSurfaceLabel} · ${nozzle.nozzleId} · Plate $plateId"
                            } ?: nozzle.nozzleId
                            val nozzleFindingCount = draftState.findingsForMeasurement(
                                surface = roofNozzleFindingSurface(roofSurfaceId),
                                linkedMeasurementId = nozzle.nozzleId,
                                locationSummary = nozzleLocationLabel,
                            ).size
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                NozzleDefinitionCard(nozzle = nozzle)
                                if (nozzleUtRow == null) {
                                    Text(
                                        "No roof nozzle UT saved yet.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = LaiqColors.MutedText,
                                    )
                                } else {
                                    NozzleUtRowCard(
                                        row = nozzleUtRow,
                                        readingLabels = roofNozzleReadingLabels,
                                        includeReinforcementPad = nozzle.hasReinforcementPad,
                                        thicknessUnit = thicknessUnit,
                                    )
                                }
                                androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    LaiqSecondaryButton(
                                        text = "Edit Registration",
                                        onClick = { openRegistryEditorForNozzle(nozzle.nozzleId) },
                                        modifier = Modifier.weight(1f),
                                    )
                                    LaiqSecondaryButton(
                                        text = "Delete Nozzle",
                                        onClick = {
                                            pendingDelete = LaiqDeleteDialogState(
                                                title = "Delete ${nozzle.nozzleId}?",
                                                message = "This will remove the nozzle registration, its UT row, and related findings from $roofSurfaceLabel.",
                                                onConfirm = {
                                                    onDraftStateChange(
                                                        draftState.replaceRoofNozzleRegistry(
                                                            surfaceRoofNozzles.filterNot { registered -> registered.nozzleId == nozzle.nozzleId },
                                                            roofSurfaceId,
                                                        ),
                                                    )
                                                    if (
                                                        draftState.roofNozzleUtDraft.nozzleId == nozzle.nozzleId &&
                                                        draftState.roofNozzleUtDraft.roofSurfaceId == roofSurfaceId
                                                    ) {
                                                        showUtEditor = false
                                                    }
                                                },
                                            )
                                        },
                                        modifier = Modifier.weight(1f),
                                    )
                                }
                                androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    LaiqPrimaryButton(
                                        text = if (nozzleUtRow == null) "Capture UT" else if (isEditingThisNozzle) "Resume UT" else "Edit UT",
                                        onClick = {
                                            showUtEditor = true
                                            onDraftStateChange(draftState.beginRoofNozzleUtForNozzle(nozzle.nozzleId, roofSurfaceId))
                                        },
                                        modifier = Modifier.weight(1f),
                                    )
                                    LaiqSecondaryButton(
                                        text = "Delete UT",
                                        enabled = nozzleUtRow != null,
                                        onClick = {
                                            pendingDelete = LaiqDeleteDialogState(
                                                title = "Delete ${nozzle.nozzleId} UT?",
                                                message = "This will remove the saved roof nozzle UT for ${nozzle.nozzleId}.",
                                                onConfirm = {
                                                    onDraftStateChange(draftState.removeRoofNozzleUtForNozzle(nozzle.nozzleId, roofSurfaceId))
                                                    if (
                                                        draftState.roofNozzleUtDraft.nozzleId == nozzle.nozzleId &&
                                                        draftState.roofNozzleUtDraft.roofSurfaceId == roofSurfaceId
                                                    ) {
                                                        showUtEditor = false
                                                    }
                                                },
                                            )
                                        },
                                        modifier = Modifier.weight(1f),
                                    )
                                }
                                LaiqSecondaryButton(
                                    text = if (nozzleFindingCount > 0) "Findings ($nozzleFindingCount)" else "Add Finding",
                                    onClick = {
                                        onOpenFindings(
                                            draftState.beginFindingForMeasurement(
                                                surface = roofNozzleFindingSurface(roofSurfaceId),
                                                linkedMeasurementId = nozzle.nozzleId,
                                                locationSummary = nozzleLocationLabel,
                                            ),
                                        )
                                    },
                                )
                                if (isEditingThisNozzle) {
                                    androidx.compose.material3.Surface(
                                        modifier = Modifier.fillMaxWidth(),
                                        color = androidx.compose.ui.graphics.Color.White,
                                        shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                                        border = androidx.compose.foundation.BorderStroke(1.dp, LaiqColors.PanelBorder),
                                    ) {
                                        Column(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(14.dp),
                                            verticalArrangement = Arrangement.spacedBy(10.dp),
                                        ) {
                                            LaiqStatusBadge(
                                                text = if (draftState.roofNozzleUtDraft.editingRowId != null) "Editing UT" else "New UT",
                                                tone = LaiqColors.AccentOrange,
                                            )
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
                                                includeReinforcementPad = nozzle.hasReinforcementPad,
                                                unitLabel = thicknessUnit,
                                                onDraftChange = { updated ->
                                                    onDraftStateChange(draftState.copy(roofNozzleUtDraft = updated))
                                                },
                                            )
                                            androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                                LaiqPrimaryButton(
                                                    text = "Save Roof Nozzle UT",
                                                    onClick = {
                                                        val updated = draftState.saveRoofNozzleUtDraft()
                                                        onDraftStateChange(updated)
                                                        if (updated != draftState) {
                                                            showUtEditor = false
                                                        }
                                                    },
                                                    modifier = Modifier.weight(1f),
                                                )
                                                LaiqSecondaryButton(
                                                    text = "Hide UT",
                                                    onClick = { showUtEditor = false },
                                                    modifier = Modifier.weight(1f),
                                                )
                                            }
                                        }
                                    }
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

            RoofTemplate.CONE_RADIAL,
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

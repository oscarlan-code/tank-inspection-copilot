package ai.laiq.tankinspection.presentation.screens

import ai.laiq.tankinspection.domain.model.NozzleDefinition
import ai.laiq.tankinspection.domain.model.NozzleUtRow
import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.NozzleUtDraftInput
import ai.laiq.tankinspection.presentation.ShellNozzleDraftInput
import ai.laiq.tankinspection.presentation.beginShellNozzleUtForNozzle
import ai.laiq.tankinspection.presentation.beginFindingForMeasurement
import ai.laiq.tankinspection.presentation.committedSetupState
import ai.laiq.tankinspection.presentation.createCommittedShellLinePlanOrNull
import ai.laiq.tankinspection.presentation.displayLinesForMap
import ai.laiq.tankinspection.presentation.findingsForMeasurement
import ai.laiq.tankinspection.presentation.label
import ai.laiq.tankinspection.presentation.measurementCaptureStateOptions
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqCountField
import ai.laiq.tankinspection.presentation.components.LaiqDeleteConfirmDialog
import ai.laiq.tankinspection.presentation.components.LaiqDeleteDialogState
import ai.laiq.tankinspection.presentation.components.LaiqDropdownField
import ai.laiq.tankinspection.presentation.components.LaiqLabeledValue
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.ShellCellMarker
import ai.laiq.tankinspection.presentation.components.ShellMapLineVisual
import ai.laiq.tankinspection.presentation.components.ShellSurfaceMap
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.components.LaiqStatusBadge
import ai.laiq.tankinspection.presentation.components.LaiqTextField
import ai.laiq.tankinspection.presentation.components.MeasurementStatsRow
import ai.laiq.tankinspection.presentation.components.measurementStatsFromInput
import ai.laiq.tankinspection.presentation.components.measurementStatsFromValues
import ai.laiq.tankinspection.presentation.replaceShellNozzleRegistry
import ai.laiq.tankinspection.presentation.removeShellNozzleUtForNozzle
import ai.laiq.tankinspection.presentation.requiresNumericReadings
import ai.laiq.tankinspection.presentation.saveShellNozzleUtDraft
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import kotlin.math.abs

val shellNozzleReadingLabels = listOf(
    "12 o'clock",
    "3 o'clock",
    "6 o'clock",
    "9 o'clock",
    "Reinforcement Pad",
)

val roofNozzleReadingLabels = listOf(
    "North",
    "East",
    "South",
    "West",
    "Reinforcement Pad",
)

private data class ShellRegistryDraftRow(
    val nozzleId: String,
    val size: String = "",
    val hasReinforcementPad: Boolean = true,
    val course: String = "",
    val azimuthDeg: String = "",
    val courseOffsetRatio: String = "",
    val confirmed: Boolean = false,
)

private fun ShellRegistryDraftRow.isReadyForSave(): Boolean =
    size.isNotBlank() && hasLocationLink()

private fun ShellRegistryDraftRow.hasLocationLink(): Boolean =
    course.toIntOrNull()?.let { it > 0 } == true && azimuthDeg.toDoubleOrNull() != null

private fun ShellRegistryDraftRow.linkedLocationLabel(
    shellLinePlan: ai.laiq.tankinspection.domain.model.ShellLinePlan?,
): String? {
    val courseNumber = course.toIntOrNull()?.takeIf { it > 0 } ?: return null
    val lineId = shellLinePlan?.nearestLineIdFor(azimuthDeg.toDoubleOrNull()) ?: return null
    val lineLabel = shellLinePlan.lines.firstOrNull { line -> line.lineId == lineId }?.label ?: return null
    return "$lineLabel · Strake $courseNumber"
}

private fun ShellRegistryDraftRow.locationValue(
    shellLinePlan: ai.laiq.tankinspection.domain.model.ShellLinePlan?,
): String {
    val courseNumber = course.toIntOrNull()?.takeIf { it > 0 } ?: return ""
    val lineId = shellLinePlan?.nearestLineIdFor(azimuthDeg.toDoubleOrNull()) ?: return ""
    return shellLocationValue(lineId, courseNumber)
}

private fun shellLocationValue(lineId: String, course: Int): String = "$lineId|$course"

private fun formatShellGlobalLocation(
    azimuthDeg: Double?,
    course: Int?,
    courseOffsetRatio: Double?,
    shellHeightM: Double,
    courseCount: Int,
    referenceLabel: String,
): String? {
    val azimuth = azimuthDeg ?: return null
    val strake = course ?: return null
    if (shellHeightM <= 0.0 || courseCount <= 0) return null
    val normalizedOffset = courseOffsetRatio?.coerceIn(0.08, 0.92) ?: 0.5
    val strakeHeight = shellHeightM / courseCount.toDouble()
    val heightFromBottom = ((strake - 1).coerceAtLeast(0) + normalizedOffset) * strakeHeight
    return "${azimuth.toInt()}° from $referenceLabel · ${"%.2f".format(heightFromBottom)} m from bottom"
}

private fun normalizeShellAzimuth(value: Double): Double {
    var normalized = value % 360.0
    if (normalized < 0) normalized += 360.0
    return normalized
}

private fun shortestAzimuthDelta(fromDeg: Double, toDeg: Double): Double {
    val raw = normalizeShellAzimuth(toDeg - fromDeg)
    return if (raw > 180.0) raw - 360.0 else raw
}

private fun ShellRegistryDraftRow.linkedLineId(
    shellLinePlan: ai.laiq.tankinspection.domain.model.ShellLinePlan?,
): String? = shellLinePlan?.nearestLineIdFor(azimuthDeg.toDoubleOrNull())

private fun ShellRegistryDraftRow.courseOffsetRatioValue(): Float =
    courseOffsetRatio.toFloatOrNull()?.coerceIn(0.08f, 0.92f) ?: 0.5f

private fun shellMarkerXRatio(
    shellLinePlan: ai.laiq.tankinspection.domain.model.ShellLinePlan,
    lineId: String,
    azimuthDeg: Double,
): Float {
    val line = shellLinePlan.lines.firstOrNull { it.lineId == lineId } ?: return 0.5f
    val halfStep = 180.0 / shellLinePlan.lineCount.coerceAtLeast(1)
    val delta = shortestAzimuthDelta(line.azimuthDeg, azimuthDeg).coerceIn(-halfStep, halfStep)
    return ((delta / (halfStep * 2.0)) + 0.5).toFloat().coerceIn(0.08f, 0.92f)
}

private fun ShellRegistryDraftRow.toShellCellMarker(
    shellLinePlan: ai.laiq.tankinspection.domain.model.ShellLinePlan?,
    active: Boolean = false,
): ShellCellMarker? {
    val lineId = linkedLineId(shellLinePlan) ?: return null
    val courseNumber = course.toIntOrNull()?.takeIf { it > 0 } ?: return null
    val azimuth = azimuthDeg.toDoubleOrNull() ?: return null
    return ShellCellMarker(
        markerId = nozzleId,
        lineId = lineId,
        course = courseNumber,
        label = nozzleId,
        xRatio = shellLinePlan?.let { shellMarkerXRatio(it, lineId, azimuth) } ?: 0.5f,
        yRatio = courseOffsetRatioValue(),
        active = active,
    )
}

private fun List<NozzleDefinition>.toShellRegistryDraftRows(): List<ShellRegistryDraftRow> =
    sortedBy { nozzle -> nozzle.nozzleId }
        .mapIndexed { index, nozzle ->
            ShellRegistryDraftRow(
                nozzleId = shellRegistryNozzleId(index),
                size = nozzle.size,
                hasReinforcementPad = nozzle.hasReinforcementPad,
                course = nozzle.course?.toString().orEmpty(),
                azimuthDeg = nozzle.azimuthDeg?.toInt()?.toString().orEmpty(),
                courseOffsetRatio = nozzle.courseOffsetRatio?.let { "%.2f".format(it) }.orEmpty(),
                confirmed = true,
            )
        }

private fun defaultShellRegistryDraftRows(count: Int): List<ShellRegistryDraftRow> =
    List(count.coerceAtLeast(1)) { index ->
        ShellRegistryDraftRow(nozzleId = shellRegistryNozzleId(index))
    }

private fun resizeShellRegistryDraftRows(
    existing: List<ShellRegistryDraftRow>,
    count: Int,
): List<ShellRegistryDraftRow> =
    List(count.coerceAtLeast(1)) { index ->
        existing.getOrNull(index)?.copy(nozzleId = shellRegistryNozzleId(index))
            ?: ShellRegistryDraftRow(nozzleId = shellRegistryNozzleId(index))
    }

private fun List<ShellRegistryDraftRow>.updateShellRegistryRow(
    index: Int,
    transform: ShellRegistryDraftRow.() -> ShellRegistryDraftRow,
): List<ShellRegistryDraftRow> =
    mapIndexed { rowIndex, row ->
        if (rowIndex == index) row.transform() else row
    }

private fun List<ShellRegistryDraftRow>.toShellNozzleDefinitions(): List<NozzleDefinition> =
    mapNotNull { row ->
        val course = row.course.toIntOrNull()?.takeIf { it > 0 } ?: return@mapNotNull null
        val azimuthDeg = row.azimuthDeg.toDoubleOrNull() ?: return@mapNotNull null
        val courseOffsetRatio = row.courseOffsetRatio.toDoubleOrNull()
        row.size.takeIf { it.isNotBlank() }?.let { size ->
            NozzleDefinition(
                nozzleId = row.nozzleId,
                surface = "shell",
                size = size,
                hasReinforcementPad = row.hasReinforcementPad,
                placementMode = if (courseOffsetRatio != null) "line_linked_positioned" else "line_linked",
                course = course,
                azimuthDeg = azimuthDeg,
                courseOffsetRatio = courseOffsetRatio,
            )
        }
    }

private fun shellRegistryNozzleId(index: Int): String =
    "SN-${(index + 1).toString().padStart(3, '0')}"

@Composable
fun ShellNozzleUtScreen(
    draftState: FieldDraftState,
    onDraftStateChange: (FieldDraftState) -> Unit,
    onOpenFindings: (FieldDraftState) -> Unit,
    onBack: () -> Unit,
    contentPadding: PaddingValues,
) {
    val shellLinePlan = draftState.createCommittedShellLinePlanOrNull()
    val thicknessUnit = draftState.committedSetupState().thicknessUnit.label()
    val nozzleSizeUnit = draftState.committedSetupState().nozzleSizeUnit.label()
    val nozzleSizeUnitType = draftState.committedSetupState().nozzleSizeUnit
    val shellHeightM = draftState.committedSetupState().heightM.toDoubleOrNull() ?: 0.0
    val shellCourseCount = draftState.committedSetupState().shellCourseCount.toIntOrNull() ?: 0
    val nozzleSizeOptions = nozzleSizeOptions(nozzleSizeUnitType)
    val displayedLines = shellLinePlan?.displayLinesForMap().orEmpty()
    val shellLocationOptions = if (shellLinePlan != null) {
        val courseCount = draftState.committedSetupState().shellCourseCount.toIntOrNull()?.takeIf { it > 0 } ?: 0
        displayedLines.flatMap { line ->
            (1..courseCount).map { course ->
                shellLocationValue(line.lineId, course) to "${line.label} · Strake $course"
            }
        }
    } else {
        emptyList()
    }
    var showRegistryEditor by rememberSaveable { mutableStateOf(false) }
    var registryCount by remember { mutableStateOf(draftState.shellNozzles.size.takeIf { it > 0 }?.toString() ?: "1") }
    var registryDrafts by remember { mutableStateOf(draftState.shellNozzles.toShellRegistryDraftRows().ifEmpty { defaultShellRegistryDraftRows(1) }) }
    var activeRegistryIndex by remember { mutableIntStateOf(0) }
    var placementModeEnabled by rememberSaveable { mutableStateOf(false) }
    var pendingPlacementAzimuth by rememberSaveable { mutableStateOf("") }
    var pendingPlacementCourseOffset by rememberSaveable { mutableStateOf("") }
    var showUtEditor by rememberSaveable { mutableStateOf(false) }
    val activeRegistryRow = registryDrafts.getOrNull(activeRegistryIndex)
    val registryReady = registryDrafts.isNotEmpty() && registryDrafts.all { row -> row.isReadyForSave() }
    val activeSizeSelection = activeRegistryRow?.let { row -> selectedNozzleSizeOption(row.size, nozzleSizeUnitType) }.orEmpty()
    val showingCustomSizeInput = activeRegistryRow != null && activeSizeSelection == customNozzleSizeOptionValue
    val pendingCourseOffsetValue = pendingPlacementCourseOffset.toFloatOrNull()?.coerceIn(0.08f, 0.92f)
    val listState = rememberLazyListState()
    var pendingDelete by remember { mutableStateOf<LaiqDeleteDialogState?>(null) }

    fun syncPendingPlacementFromRow(row: ShellRegistryDraftRow?) {
        pendingPlacementAzimuth = row?.azimuthDeg.orEmpty()
        pendingPlacementCourseOffset = row?.courseOffsetRatio.orEmpty()
    }

    fun initializePlacementFromLinkedCell(): Boolean {
        val activeRow = activeRegistryRow ?: return false
        val lineId = activeRow.linkedLineId(shellLinePlan) ?: return false
        val lineAzimuth = shellLinePlan?.lines?.firstOrNull { it.lineId == lineId }?.azimuthDeg ?: return false
        if (pendingPlacementAzimuth.isBlank()) {
            pendingPlacementAzimuth = lineAzimuth.toInt().toString()
        }
        if (pendingPlacementCourseOffset.isBlank()) {
            pendingPlacementCourseOffset = "0.50"
        }
        return true
    }

    fun undoFinePlacement() {
        val activeRow = activeRegistryRow ?: return
        val lineId = activeRow.linkedLineId(shellLinePlan) ?: return
        val lineAzimuth = shellLinePlan?.lines?.firstOrNull { it.lineId == lineId }?.azimuthDeg ?: return
        val savedAzimuth = activeRow.azimuthDeg.toDoubleOrNull()
        val savedOffset = activeRow.courseOffsetRatio.toFloatOrNull()
        pendingPlacementAzimuth = (savedAzimuth ?: lineAzimuth).toInt().toString()
        pendingPlacementCourseOffset = "%.2f".format(savedOffset ?: 0.5f)
        placementModeEnabled = activeRow.hasLocationLink()
    }

    fun nudgeShellPlacement(deltaAzimuthDeg: Double = 0.0, deltaCourseOffset: Float = 0f) {
        val activeRow = activeRegistryRow ?: return
        val lineId = activeRow.linkedLineId(shellLinePlan) ?: return
        val line = shellLinePlan?.lines?.firstOrNull { it.lineId == lineId } ?: return
        if (!initializePlacementFromLinkedCell()) return
        val currentAzimuth = pendingPlacementAzimuth.toDoubleOrNull() ?: line.azimuthDeg
        val currentOffset = pendingPlacementCourseOffset.toFloatOrNull() ?: 0.5f
        val halfStep = 180.0 / (shellLinePlan?.lineCount?.coerceAtLeast(1) ?: 1)
        val centeredDelta = shortestAzimuthDelta(line.azimuthDeg, currentAzimuth)
        val nextDelta = (centeredDelta + deltaAzimuthDeg).coerceIn(-halfStep + 2.0, halfStep - 2.0)
        val nextOffset = (currentOffset + deltaCourseOffset).coerceIn(0.08f, 0.92f)
        pendingPlacementAzimuth = normalizeShellAzimuth(line.azimuthDeg + nextDelta).toInt().toString()
        pendingPlacementCourseOffset = "%.2f".format(nextOffset)
    }

    fun resetRegistryEditorFromSaved() {
        val existingRows = draftState.shellNozzles.toShellRegistryDraftRows()
        registryDrafts = existingRows.ifEmpty { defaultShellRegistryDraftRows(1) }
        registryCount = registryDrafts.size.toString()
        activeRegistryIndex = 0
        syncPendingPlacementFromRow(registryDrafts.firstOrNull())
        placementModeEnabled = false
        showRegistryEditor = true
    }

    fun openRegistryEditorForNozzle(nozzleId: String) {
        val existingRows = draftState.shellNozzles.toShellRegistryDraftRows()
        registryDrafts = existingRows.ifEmpty { defaultShellRegistryDraftRows(1) }
        registryCount = registryDrafts.size.toString()
        activeRegistryIndex = existingRows.indexOfFirst { row -> row.nozzleId == nozzleId }.coerceAtLeast(0)
        syncPendingPlacementFromRow(registryDrafts.getOrNull(activeRegistryIndex))
        placementModeEnabled = false
        showRegistryEditor = true
        showUtEditor = false
    }

    LaunchedEffect(draftState.shellNozzleUtDraft.editingRowId) {
        if (draftState.shellNozzleUtDraft.editingRowId != null) {
            showUtEditor = true
        }
    }

    LaunchedEffect(showRegistryEditor) {
        if (showRegistryEditor) {
            listState.animateScrollToItem(0)
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
                title = "Shell Nozzle Registry",
                subtitle = "Register shell nozzles one by one. Set the count, then confirm each generated nozzle with its size, shell location, and reinforcement pad.",
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LaiqStatChip("Registered", draftState.shellNozzles.size.toString(), modifier = Modifier.weight(1f))
                    LaiqStatChip("UT Rows", draftState.shellNozzleUtRows.size.toString(), tone = LaiqColors.AccentOrange, modifier = Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    LaiqPrimaryButton(
                        text = if (draftState.shellNozzles.isEmpty()) "Add Shell Nozzles" else "Edit Shell Registry",
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
                        "Registry editor hidden. Open it to define nozzle count, sizes, and linked shell locations.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                } else {
                    LaiqCountField(
                        label = "Shell Nozzle Count",
                        value = registryCount,
                        onValueChange = { updated ->
                            val normalized = updated.filter(Char::isDigit)
                            registryCount = normalized
                            normalized.toIntOrNull()?.takeIf { it > 0 }?.let { count ->
                                registryDrafts = resizeShellRegistryDraftRows(registryDrafts, count)
                                activeRegistryIndex = activeRegistryIndex.coerceAtMost(registryDrafts.lastIndex)
                                syncPendingPlacementFromRow(registryDrafts.getOrNull(activeRegistryIndex))
                                placementModeEnabled = false
                            }
                        },
                        min = 0,
                        max = 20,
                    )
                    Text(
                        "Shell nozzle IDs are generated automatically. Define one nozzle at a time so the shell map stays visible while you link its lane and strake.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                    if (registryDrafts.isNotEmpty()) {
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
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
                            Surface(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(72.dp),
                                color = Color.White,
                                shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
                                border = BorderStroke(1.dp, LaiqColors.PanelBorder),
                            ) {
                                Column(
                                    modifier = Modifier.fillMaxSize(),
                                    horizontalAlignment = Alignment.CenterHorizontally,
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
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            color = Color.White,
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                            border = BorderStroke(1.dp, LaiqColors.BrandTeal),
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
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
                                        registryDrafts = registryDrafts.updateShellRegistryRow(activeRegistryIndex) {
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
                                            registryDrafts = registryDrafts.updateShellRegistryRow(activeRegistryIndex) {
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
                                        registryDrafts = registryDrafts.updateShellRegistryRow(activeRegistryIndex) {
                                            copy(hasReinforcementPad = selection == "yes")
                                        }
                                    },
                                )
                                if (shellLocationOptions.isNotEmpty()) {
                                    LaiqDropdownField(
                                        label = "Shell Location",
                                        value = activeRegistryRow.locationValue(shellLinePlan),
                                        options = shellLocationOptions,
                                        onSelected = { selectedLocation ->
                                            val parts = selectedLocation.split("|")
                                            val lineId = parts.getOrNull(0).orEmpty()
                                            val course = parts.getOrNull(1)?.toIntOrNull()
                                            val azimuth = shellLinePlan?.lines
                                                ?.firstOrNull { line -> line.lineId == lineId }
                                                ?.azimuthDeg
                                            if (lineId.isNotBlank() && course != null && azimuth != null) {
                                                registryDrafts = registryDrafts.updateShellRegistryRow(activeRegistryIndex) {
                                                    copy(
                                                        course = course.toString(),
                                                        azimuthDeg = azimuth.toInt().toString(),
                                                        courseOffsetRatio = "",
                                                    )
                                                }
                                                pendingPlacementAzimuth = azimuth.toInt().toString()
                                                pendingPlacementCourseOffset = "0.50"
                                                placementModeEnabled = true
                                            }
                                        },
                                    )
                                }
                                LaiqLabeledValue(
                                    label = "Linked Location",
                                    value = activeRegistryRow.linkedLocationLabel(shellLinePlan)
                                        ?: if (shellLocationOptions.isEmpty()) {
                                            "Complete shell geometry first"
                                        } else {
                                            "Select from the dropdown or tap the shell map"
                                        },
                                )
                                LaiqLabeledValue(
                                    label = "Global Location",
                                    value = formatShellGlobalLocation(
                                        azimuthDeg = pendingPlacementAzimuth.toDoubleOrNull()
                                            ?: activeRegistryRow.azimuthDeg.toDoubleOrNull(),
                                        course = activeRegistryRow.course.toIntOrNull(),
                                        courseOffsetRatio = pendingPlacementCourseOffset.toDoubleOrNull()
                                            ?: activeRegistryRow.courseOffsetRatio.toDoubleOrNull(),
                                        shellHeightM = shellHeightM,
                                        courseCount = shellCourseCount,
                                        referenceLabel = shellLinePlan?.startReference ?: "saved 0° reference",
                                    ) ?: "Select a shell location first",
                                )
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    LaiqSecondaryButton(
                                        text = "Undo",
                                        onClick = { undoFinePlacement() },
                                        enabled = activeRegistryRow.hasLocationLink(),
                                        modifier = Modifier.weight(1f),
                                    )
                                    LaiqPrimaryButton(
                                        text = "Confirm Location",
                                        enabled = activeRegistryRow.hasLocationLink(),
                                        onClick = {
                                            if (!initializePlacementFromLinkedCell()) return@LaiqPrimaryButton
                                            registryDrafts = registryDrafts.updateShellRegistryRow(activeRegistryIndex) {
                                                copy(
                                                    azimuthDeg = pendingPlacementAzimuth.ifBlank { azimuthDeg },
                                                    courseOffsetRatio = (pendingPlacementCourseOffset.toFloatOrNull() ?: 0.5f).let { "%.2f".format(it) },
                                                )
                                            }
                                            pendingPlacementCourseOffset = (pendingPlacementCourseOffset.toFloatOrNull() ?: 0.5f).let { "%.2f".format(it) }
                                            placementModeEnabled = true
                                        },
                                        modifier = Modifier.weight(1f),
                                    )
                                }
                            }
                        }
                    }
                    if (shellLinePlan != null && activeRegistryRow != null) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.Top,
                        ) {
                            Column(
                                modifier = Modifier.weight(1f),
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                ShellSurfaceMap(
                                    lines = displayedLines.map { line ->
                                        ShellMapLineVisual(
                                            lineId = line.lineId,
                                            label = line.label,
                                            azimuthDeg = line.azimuthDeg.toInt(),
                                        )
                                    },
                                    courseCount = draftState.committedSetupState().shellCourseCount.toIntOrNull() ?: 0,
                                    activeCell = activeRegistryRow.course.toIntOrNull()?.let { course ->
                                        shellLinePlan.nearestLineIdFor(activeRegistryRow.azimuthDeg.toDoubleOrNull())?.let { lineId ->
                                            lineId to course
                                        }
                                    },
                                    savedCells = emptySet(),
                                    overlayCells = registryDrafts.mapNotNull { row ->
                                        val course = row.course.toIntOrNull() ?: return@mapNotNull null
                                        val lineId = shellLinePlan.nearestLineIdFor(row.azimuthDeg.toDoubleOrNull()) ?: return@mapNotNull null
                                        lineId to course
                                    }.toSet(),
                                    markers = registryDrafts.mapIndexedNotNull { index, row ->
                                        val previewRow = if (index == activeRegistryIndex) {
                                            row.copy(
                                                azimuthDeg = pendingPlacementAzimuth.ifBlank { row.azimuthDeg },
                                                courseOffsetRatio = pendingPlacementCourseOffset.ifBlank { row.courseOffsetRatio.ifBlank { "0.50" } },
                                            )
                                        } else {
                                            row
                                        }
                                        previewRow.toShellCellMarker(shellLinePlan, active = false)
                                    },
                                    scaleOriginLabel = shellLinePlan.startReference,
                                    anchorLaneId = shellLinePlan.lines.firstOrNull()?.lineId,
                                    captureStartLaneId = shellLinePlan.captureStartLaneId,
                                    enableViewportControls = true,
                                    viewportControlsAtBottom = true,
                                    showViewportGuidance = false,
                                    showFooterGuidance = false,
                                    fillActiveCell = false,
                                    showOverlayBadges = false,
                                    showTitle = false,
                                    showScaleOriginText = false,
                                    onSelectCell = { lineId, course ->
                                        shellLinePlan.lines.firstOrNull { it.lineId == lineId }?.azimuthDeg?.let { azimuth ->
                                            registryDrafts = registryDrafts.updateShellRegistryRow(activeRegistryIndex) {
                                                copy(course = course.toString(), azimuthDeg = azimuth.toInt().toString(), courseOffsetRatio = "")
                                            }
                                            pendingPlacementAzimuth = azimuth.toInt().toString()
                                            pendingPlacementCourseOffset = "0.50"
                                            placementModeEnabled = true
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                )
                            }
                            Column(
                                modifier = Modifier.weight(0.42f),
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                LaiqLabeledValue(
                                    label = "Estimated Position",
                                    value = when {
                                        activeRegistryRow.hasLocationLink() ->
                                            formatShellGlobalLocation(
                                                azimuthDeg = pendingPlacementAzimuth.toDoubleOrNull()
                                                    ?: activeRegistryRow.azimuthDeg.toDoubleOrNull(),
                                                course = activeRegistryRow.course.toIntOrNull(),
                                                courseOffsetRatio = pendingPlacementCourseOffset.toDoubleOrNull()
                                                    ?: activeRegistryRow.courseOffsetRatio.toDoubleOrNull(),
                                                shellHeightM = shellHeightM,
                                                courseCount = shellCourseCount,
                                                referenceLabel = shellLinePlan.startReference,
                                            ) ?: "Select a shell cell first"
                                        else -> "Select a shell cell first"
                                    },
                                )
                                ShellNozzleLocationAdjustPad(
                                    enabled = activeRegistryRow.hasLocationLink(),
                                    onUp = { nudgeShellPlacement(deltaCourseOffset = -0.06f) },
                                    onDown = { nudgeShellPlacement(deltaCourseOffset = 0.06f) },
                                    onLeft = { nudgeShellPlacement(deltaAzimuthDeg = -(180.0 / shellLinePlan.lineCount.coerceAtLeast(1)) / 5.0) },
                                    onRight = { nudgeShellPlacement(deltaAzimuthDeg = (180.0 / shellLinePlan.lineCount.coerceAtLeast(1)) / 5.0) },
                                )
                            }
                        }
                    } else {
                        Text(
                            "Complete shell geometry and scope first so the shell crawler lane map can be generated for nozzle linking.",
                            style = MaterialTheme.typography.bodySmall,
                            color = LaiqColors.MutedText,
                        )
                    }
                    Text(
                        "Saving a changed shell nozzle registry will refresh saved shell nozzle UT rows and related shell nozzle findings. All nozzle rows need size and linked shell location before Save is enabled.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.StatusWarning,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        LaiqPrimaryButton(
                            text = "Save Shell Registry",
                            enabled = registryReady,
                            onClick = {
                                onDraftStateChange(draftState.replaceShellNozzleRegistry(registryDrafts.toShellNozzleDefinitions()))
                                placementModeEnabled = false
                                showRegistryEditor = false
                            },
                            modifier = Modifier.weight(1f),
                        )
                        LaiqSecondaryButton(
                            text = "Delete All",
                            onClick = {
                                pendingDelete = LaiqDeleteDialogState(
                                    title = "Delete All Shell Nozzles?",
                                    message = "This will remove all registered shell nozzles, their UT rows, and related findings.",
                                    confirmText = "Delete All",
                                    onConfirm = {
                                        onDraftStateChange(draftState.replaceShellNozzleRegistry(emptyList()))
                                        registryDrafts = defaultShellRegistryDraftRows(1)
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
                title = "Shell Nozzles",
                subtitle = "Each registered nozzle keeps its registration, UT, and findings together on one card.",
            ) {
                if (draftState.shellNozzles.isEmpty()) {
                    Text("No shell nozzles registered yet.", style = MaterialTheme.typography.bodySmall)
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        draftState.shellNozzles.forEach { nozzle ->
                            val nozzleUtRow = draftState.shellNozzleUtRows.firstOrNull { row -> row.nozzleId == nozzle.nozzleId }
                            val isEditingThisNozzle = showUtEditor && draftState.shellNozzleUtDraft.nozzleId == nozzle.nozzleId
                            val includePad = nozzle.hasReinforcementPad
                            val nozzleLocationLabel = nozzle.let { registered ->
                                val lineId = shellLinePlan?.nearestLineIdFor(registered.azimuthDeg)
                                val lineLabel = shellLinePlan?.lines?.firstOrNull { line -> line.lineId == lineId }?.label
                                val course = registered.course
                                if (lineLabel != null && course != null) {
                                    "${registered.nozzleId} · $lineLabel · Strake $course"
                                } else {
                                    registered.nozzleId
                                }
                            }
                            val nozzleFindingCount = draftState.findingsForMeasurement(
                                surface = "shell_nozzle",
                                linkedMeasurementId = nozzle.nozzleId,
                                locationSummary = nozzleLocationLabel,
                            ).size
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                NozzleDefinitionCard(
                                    nozzle = nozzle,
                                    locationSummary = formatShellGlobalLocation(
                                        azimuthDeg = nozzle.azimuthDeg,
                                        course = nozzle.course,
                                        courseOffsetRatio = nozzle.courseOffsetRatio,
                                        shellHeightM = shellHeightM,
                                        courseCount = shellCourseCount,
                                        referenceLabel = shellLinePlan?.startReference ?: "saved 0° reference",
                                    ),
                                )
                                if (nozzleUtRow == null) {
                                    Text(
                                        "No shell nozzle UT saved yet.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = LaiqColors.MutedText,
                                    )
                                } else {
                                    NozzleUtRowCard(
                                        row = nozzleUtRow,
                                        readingLabels = shellNozzleReadingLabels,
                                        includeReinforcementPad = includePad,
                                        thicknessUnit = thicknessUnit,
                                    )
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
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
                                                message = "This will remove the nozzle registration, its UT row, and related findings.",
                                                onConfirm = {
                                                    onDraftStateChange(
                                                        draftState.replaceShellNozzleRegistry(
                                                            draftState.shellNozzles.filterNot { registered -> registered.nozzleId == nozzle.nozzleId },
                                                        ),
                                                    )
                                                    if (draftState.shellNozzleUtDraft.nozzleId == nozzle.nozzleId) {
                                                        showUtEditor = false
                                                    }
                                                },
                                            )
                                        },
                                        modifier = Modifier.weight(1f),
                                    )
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    LaiqPrimaryButton(
                                        text = if (nozzleUtRow == null) "Capture UT" else if (isEditingThisNozzle) "Resume UT" else "Edit UT",
                                        onClick = {
                                            showUtEditor = true
                                            onDraftStateChange(draftState.beginShellNozzleUtForNozzle(nozzle.nozzleId))
                                        },
                                        modifier = Modifier.weight(1f),
                                    )
                                    LaiqSecondaryButton(
                                        text = "Delete UT",
                                        enabled = nozzleUtRow != null,
                                        onClick = {
                                            pendingDelete = LaiqDeleteDialogState(
                                                title = "Delete ${nozzle.nozzleId} UT?",
                                                message = "This will remove the saved shell nozzle UT for ${nozzle.nozzleId}.",
                                                onConfirm = {
                                                    onDraftStateChange(draftState.removeShellNozzleUtForNozzle(nozzle.nozzleId))
                                                    if (draftState.shellNozzleUtDraft.nozzleId == nozzle.nozzleId) {
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
                                                surface = "shell_nozzle",
                                                linkedMeasurementId = nozzle.nozzleId,
                                                locationSummary = nozzleLocationLabel,
                                            ),
                                        )
                                    },
                                )
                                if (isEditingThisNozzle) {
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
                                            verticalArrangement = Arrangement.spacedBy(10.dp),
                                        ) {
                                            LaiqStatusBadge(
                                                text = if (draftState.shellNozzleUtDraft.editingRowId != null) "Editing UT" else "New UT",
                                                tone = LaiqColors.AccentOrange,
                                            )
                                            LaiqDropdownField(
                                                label = "Capture State",
                                                value = draftState.shellNozzleUtDraft.captureState.name,
                                                options = measurementCaptureStateOptions(includeNotApplicable = true),
                                                onSelected = { selected ->
                                                    onDraftStateChange(
                                                        draftState.copy(
                                                            shellNozzleUtDraft = draftState.shellNozzleUtDraft.copy(
                                                                captureState = ai.laiq.tankinspection.domain.model.MeasurementCaptureState.valueOf(selected),
                                                            ),
                                                        ),
                                                    )
                                                },
                                            )
                                            NozzleReadingInputs(
                                                draft = draftState.shellNozzleUtDraft,
                                                readingLabels = shellNozzleReadingLabels,
                                                includeReinforcementPad = includePad,
                                                unitLabel = thicknessUnit,
                                                onDraftChange = { updated ->
                                                    onDraftStateChange(draftState.copy(shellNozzleUtDraft = updated))
                                                },
                                            )
                                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                                LaiqPrimaryButton(
                                                    text = "Save Shell Nozzle UT",
                                                    onClick = {
                                                        val updated = draftState.saveShellNozzleUtDraft()
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
private fun ShellNozzleInputs(
    draft: ShellNozzleDraftInput,
    draftState: FieldDraftState,
    shellLinePlan: ai.laiq.tankinspection.domain.model.ShellLinePlan?,
    displayedLines: List<ai.laiq.tankinspection.domain.model.ShellLine>,
    onDraftChange: (ShellNozzleDraftInput) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        LaiqTextField(
            value = draft.nozzleId,
            onValueChange = { onDraftChange(draft.copy(nozzleId = it)) },
            label = { Text("Nozzle ID") },
            modifier = Modifier.fillMaxWidth(),
        )
        LaiqTextField(
            value = draft.size,
            onValueChange = { onDraftChange(draft.copy(size = it)) },
            label = { Text("Nozzle Size") },
            modifier = Modifier.fillMaxWidth(),
        )
        if (shellLinePlan != null) {
            Text(
                "Tap the shell guide to link the nozzle to the selected crawler lane and strake.",
                style = MaterialTheme.typography.bodySmall,
                color = LaiqColors.MutedText,
            )
            val activeLineId = shellLinePlan.nearestLineIdFor(draft.azimuthDeg.toDoubleOrNull())
            val activeLineLabel = shellLinePlan.lines.firstOrNull { it.lineId == activeLineId }?.label
            if (activeLineLabel != null && draft.course.isNotBlank()) {
                LaiqLabeledValue(
                    label = "Linked Location",
                    value = "$activeLineLabel · Strake ${draft.course}",
                )
            }
            ShellSurfaceMap(
                lines = displayedLines.map { line ->
                    ShellMapLineVisual(
                        lineId = line.lineId,
                        label = line.label,
                        azimuthDeg = line.azimuthDeg.toInt(),
                    )
                },
                courseCount = draftState.committedSetupState().shellCourseCount.toIntOrNull() ?: 0,
                activeCell = draft.course.toIntOrNull()?.let { course ->
                    activeLineId?.let { it to course }
                },
                savedCells = emptySet(),
                overlayCells = draftState.shellNozzles.mapNotNull { nozzle ->
                    val course = nozzle.course ?: return@mapNotNull null
                    val lineId = shellLinePlan.nearestLineIdFor(nozzle.azimuthDeg) ?: return@mapNotNull null
                    lineId to course
                }.toSet(),
                scaleOriginLabel = shellLinePlan.startReference,
                anchorLaneId = shellLinePlan.lines.firstOrNull()?.lineId,
                captureStartLaneId = shellLinePlan.captureStartLaneId,
                onSelectCell = { lineId, course ->
                    shellLinePlan.lines.firstOrNull { it.lineId == lineId }?.azimuthDeg?.toInt()?.let { azimuth ->
                        onDraftChange(
                            draft.copy(
                                course = course.toString(),
                                azimuthDeg = azimuth.toString(),
                            ),
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            )
        } else {
            Text(
                "Complete shell geometry and scope first so the shell crawler lane map can be generated for lane linking.",
                style = MaterialTheme.typography.bodySmall,
                color = LaiqColors.MutedText,
            )
        }
    }
}

private fun ai.laiq.tankinspection.domain.model.ShellLinePlan.nearestLineIdFor(azimuthDeg: Double?): String? {
    azimuthDeg ?: return null
    return lines.minByOrNull { line ->
        val delta = abs(line.azimuthDeg - azimuthDeg)
        minOf(delta, 360.0 - delta)
    }?.lineId
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SketchShellNozzleGuide(
    courseCount: Int,
    lineLabels: List<Pair<String, Pair<String, Int>>>,
    activeCourse: Int?,
    activeAzimuthDeg: Int?,
    onSelectCell: (Int, Int) -> Unit,
) {
    if (courseCount <= 0 || lineLabels.isEmpty()) return

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Shell Placement Guide", style = MaterialTheme.typography.titleSmall)
        lineLabels.forEach { (_, labelAndAzimuth) ->
            val (label, azimuth) = labelAndAzimuth
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("$label · $azimuth°", style = MaterialTheme.typography.labelLarge, color = LaiqColors.MutedText)
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    for (course in 1..courseCount) {
                        val isActive = activeCourse == course && activeAzimuthDeg == azimuth
                        Surface(
                            onClick = { onSelectCell(course, azimuth) },
                            color = if (isActive) LaiqColors.BrandTeal else Color.White,
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(14.dp),
                            border = BorderStroke(1.dp, if (isActive) LaiqColors.BrandTeal else LaiqColors.PanelBorder),
                        ) {
                            Text(
                                "S$course",
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                                style = MaterialTheme.typography.labelMedium,
                                color = if (isActive) Color.White else LaiqColors.BodyText,
                            )
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NozzleReadingInputs(
    draft: NozzleUtDraftInput,
    readingLabels: List<String>,
    includeReinforcementPad: Boolean,
    unitLabel: String,
    onDraftChange: (NozzleUtDraftInput) -> Unit,
) {
    val labels = if (includeReinforcementPad) {
        (readingLabels + List(maxOf(0, 5 - readingLabels.size)) { "" }).take(5)
    } else {
        readingLabels.take(4)
    }
    val readings = (draft.readings + List(maxOf(0, labels.size - draft.readings.size)) { "" }).take(labels.size)

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        DirectionalNozzleGuide(
            topLabel = labels[0],
            rightLabel = labels[1],
            bottomLabel = labels[2],
            leftLabel = labels[3],
        )
        if (draft.captureState.requiresNumericReadings()) {
            Text(
                "Thickness readings are captured in $unitLabel.",
                style = MaterialTheme.typography.bodySmall,
                color = LaiqColors.MutedText,
            )
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                readings.take(4).forEachIndexed { index, reading ->
                    LaiqTextField(
                        value = reading,
                        onValueChange = { updated ->
                            val nextReadings = readings.toMutableList()
                            nextReadings[index] = updated
                            onDraftChange(draft.copy(readings = nextReadings))
                        },
                        label = { Text(labels[index]) },
                        modifier = Modifier.fillMaxWidth(0.48f),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    )
                }
            }
            if (includeReinforcementPad) {
                LaiqTextField(
                    value = readings[4],
                    onValueChange = { updated ->
                        val nextReadings = readings.toMutableList()
                        nextReadings[4] = updated
                        onDraftChange(draft.copy(readings = nextReadings))
                    },
                    label = { Text(labels[4]) },
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
            } else {
                Text(
                    "Reinforcement pad: No Pad",
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.MutedText,
                )
            }
            measurementStatsFromInput(readings)?.let { stats ->
                MeasurementStatsRow(stats = stats, modifier = Modifier.fillMaxWidth())
            }
        } else {
            Text(
                "${draft.captureState.label()} selected. No numeric nozzle readings are required for this UT row.",
                style = MaterialTheme.typography.bodySmall,
                color = LaiqColors.MutedText,
            )
        }
        LaiqTextField(
            value = draft.note,
            onValueChange = { onDraftChange(draft.copy(note = it)) },
            label = { Text("Quick Note") },
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun DirectionalNozzleGuide(
    topLabel: String,
    rightLabel: String,
    bottomLabel: String,
    leftLabel: String,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .size(148.dp)
                .padding(vertical = 6.dp),
            contentAlignment = Alignment.Center,
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val radius = size.minDimension * 0.32f
                val center = Offset(size.width / 2f, size.height / 2f)
                drawCircle(
                    color = LaiqColors.BodyText,
                    radius = radius,
                    center = center,
                    style = Stroke(width = 3f),
                )
                drawLine(
                    color = LaiqColors.BodyText,
                    start = Offset(center.x, center.y - radius - 10f),
                    end = Offset(center.x, center.y - radius + 10f),
                    strokeWidth = 3f,
                )
                drawLine(
                    color = LaiqColors.BodyText,
                    start = Offset(center.x + radius - 10f, center.y),
                    end = Offset(center.x + radius + 10f, center.y),
                    strokeWidth = 3f,
                )
                drawLine(
                    color = LaiqColors.BodyText,
                    start = Offset(center.x, center.y + radius - 10f),
                    end = Offset(center.x, center.y + radius + 10f),
                    strokeWidth = 3f,
                )
                drawLine(
                    color = LaiqColors.BodyText,
                    start = Offset(center.x - radius - 10f, center.y),
                    end = Offset(center.x - radius + 10f, center.y),
                    strokeWidth = 3f,
                )
            }
            Text(topLabel, modifier = Modifier.align(Alignment.TopCenter), style = MaterialTheme.typography.bodySmall)
            Text(rightLabel, modifier = Modifier.align(Alignment.CenterEnd), style = MaterialTheme.typography.bodySmall)
            Text(bottomLabel, modifier = Modifier.align(Alignment.BottomCenter), style = MaterialTheme.typography.bodySmall)
            Text(leftLabel, modifier = Modifier.align(Alignment.CenterStart), style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
fun NozzleDefinitionCard(
    nozzle: NozzleDefinition,
    locationSummary: String? = null,
) {
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
                Text("${nozzle.nozzleId} · ${nozzle.size}", style = MaterialTheme.typography.titleSmall)
                LaiqStatusBadge("Registered", LaiqColors.StatusReady)
            }
            val locationBits = buildList {
                nozzle.course?.let { add("Course $it") }
                nozzle.azimuthDeg?.let { add("${it.toInt()}°") }
                nozzle.radiusRatio?.let { add("${"%.2f".format(it)}R") }
                nozzle.plateId?.let { add(it) }
            }
            if (locationBits.isNotEmpty()) {
                Text(locationBits.joinToString(" · "), style = MaterialTheme.typography.bodySmall)
            }
            locationSummary?.takeIf { it.isNotBlank() }?.let { summary ->
                Text(summary, style = MaterialTheme.typography.bodySmall, color = LaiqColors.BodyText)
            }
            Text(
                if (nozzle.hasReinforcementPad) "Reinforcement Pad: Yes" else "Reinforcement Pad: No Pad",
                style = MaterialTheme.typography.bodySmall,
                color = LaiqColors.MutedText,
            )
            nozzle.placementMode?.let {
                val modeLabel = when (it) {
                    "line_linked" -> "Lane Link"
                    "line_linked_positioned" -> "Lane Link + Position"
                    "plate_linked" -> "Plate Link"
                    "plate_linked_positioned" -> "Plate Link + Position"
                    else -> it.replace('_', ' ').replaceFirstChar { char -> char.uppercase() }
                }
                Text("Link: $modeLabel", style = MaterialTheme.typography.bodySmall, color = LaiqColors.MutedText)
            }
        }
    }
}

@Composable
private fun ShellNozzleLocationAdjustPad(
    enabled: Boolean,
    onUp: () -> Unit,
    onDown: () -> Unit,
    onLeft: () -> Unit,
    onRight: () -> Unit,
) {
    Surface(
        color = Color.White,
        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text("Adjust", style = MaterialTheme.typography.labelMedium, color = LaiqColors.MutedText)
            ShellNozzleDirectionButton("↑", enabled, onUp)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                ShellNozzleDirectionButton("←", enabled, onLeft)
                ShellNozzleDirectionButton("→", enabled, onRight)
            }
            ShellNozzleDirectionButton("↓", enabled, onDown)
        }
    }
}

@Composable
private fun ShellNozzleDirectionButton(
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Surface(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.size(38.dp),
        color = Color.White,
        shape = androidx.compose.foundation.shape.RoundedCornerShape(10.dp),
        border = BorderStroke(
            1.dp,
            if (enabled) LaiqColors.PanelBorder else LaiqColors.PanelBorder.copy(alpha = 0.45f),
        ),
    ) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(
                label,
                style = MaterialTheme.typography.titleMedium,
                color = if (enabled) LaiqColors.BrandTeal else LaiqColors.MutedText,
            )
        }
    }
}

@Composable
fun NozzleUtRowCard(
    row: NozzleUtRow,
    readingLabels: List<String>,
    includeReinforcementPad: Boolean,
    thicknessUnit: String,
) {
    val labels = if (includeReinforcementPad) readingLabels.take(5) else readingLabels.take(4)
    val savedValues = buildList {
        addAll(row.bodyReadings)
        row.reinforcementPadReading?.let { add(it) }
    }

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
                Text(row.nozzleId, style = MaterialTheme.typography.titleSmall)
                LaiqStatusBadge(
                    row.captureState.label(),
                    if (row.captureState.requiresNumericReadings()) LaiqColors.StatusReady else LaiqColors.AccentOrange,
                )
            }
            if (savedValues.isNotEmpty()) {
                savedValues.forEachIndexed { index, value ->
                    val label = labels.getOrElse(index) { "Reading ${index + 1}" }
                    Text("$label ($thicknessUnit): $value", style = MaterialTheme.typography.bodySmall)
                }
                measurementStatsFromValues(savedValues)?.let { stats ->
                    MeasurementStatsRow(stats = stats, modifier = Modifier.fillMaxWidth())
                }
            } else {
                Text("No numeric thickness captured for this nozzle row.", style = MaterialTheme.typography.bodySmall, color = LaiqColors.MutedText)
            }
            if (!includeReinforcementPad) {
                Text("Reinforcement pad: No Pad", style = MaterialTheme.typography.bodySmall, color = LaiqColors.MutedText)
            }
            row.note?.takeIf { it.isNotBlank() }?.let {
                Text("Note: $it", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

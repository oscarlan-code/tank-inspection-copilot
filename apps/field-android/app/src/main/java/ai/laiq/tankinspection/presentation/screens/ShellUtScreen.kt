package ai.laiq.tankinspection.presentation.screens

import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.ShellUtDraftInput
import ai.laiq.tankinspection.presentation.beginFindingForMeasurement
import ai.laiq.tankinspection.presentation.committedSetupState
import ai.laiq.tankinspection.presentation.editShellUtRow
import ai.laiq.tankinspection.presentation.findingsForMeasurement
import ai.laiq.tankinspection.presentation.label
import ai.laiq.tankinspection.presentation.measurementCaptureStateOptions
import ai.laiq.tankinspection.presentation.displayLinesForMap
import ai.laiq.tankinspection.presentation.removeShellUtRow
import ai.laiq.tankinspection.presentation.requiresNumericReadings
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqDeleteConfirmDialog
import ai.laiq.tankinspection.presentation.components.LaiqDeleteDialogState
import ai.laiq.tankinspection.presentation.components.LaiqDropdownField
import ai.laiq.tankinspection.presentation.components.LaiqLabeledValue
import ai.laiq.tankinspection.presentation.components.LaiqOptionChips
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.components.LaiqStatusBadge
import ai.laiq.tankinspection.presentation.components.MeasurementStatsRow
import ai.laiq.tankinspection.presentation.components.ShellMapLineVisual
import ai.laiq.tankinspection.presentation.components.ShellSurfaceMap
import ai.laiq.tankinspection.presentation.components.measurementStatsFromInput
import ai.laiq.tankinspection.presentation.components.measurementStatsFromValues
import ai.laiq.tankinspection.presentation.createCommittedShellLinePlanOrNull
import ai.laiq.tankinspection.presentation.saveShellUtDraft
import ai.laiq.tankinspection.testing.AppReviewTags
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

@Composable
fun ShellUtScreen(
    draftState: FieldDraftState,
    onDraftStateChange: (FieldDraftState) -> Unit,
    onOpenFindings: (FieldDraftState) -> Unit,
    onBack: () -> Unit,
    contentPadding: PaddingValues,
) {
    val shellLinePlan = draftState.createCommittedShellLinePlanOrNull()
    val thicknessUnit = draftState.committedSetupState().thicknessUnit.label()
    val activeLineId = draftState.shellUtDraft.selectedLineId.ifBlank {
        shellLinePlan?.captureStartLaneId ?: shellLinePlan?.lines?.firstOrNull()?.lineId.orEmpty()
    }
    val activeCourse = draftState.shellUtDraft.course.toIntOrNull()?.takeIf { it > 0 }
    val displayedLines = shellLinePlan?.displayLinesForMap().orEmpty()
    val scaleOriginLabel = shellLinePlan?.startReference
    val captureStartLaneId = shellLinePlan?.captureStartLaneId
    val activeLineLabel = displayedLines.firstOrNull { it.lineId == activeLineId }?.label
        ?: shellLinePlan?.lines?.firstOrNull { it.lineId == activeLineId }?.label
    val selectedLocationLabel = if (activeLineLabel != null && activeCourse != null) {
        "$activeLineLabel · Strake $activeCourse"
    } else {
        null
    }
    val selectedFindingCount = selectedLocationLabel?.let { locationSummary ->
        draftState.findingsForMeasurement(
            surface = "shell",
            linkedMeasurementId = draftState.shellUtDraft.editingRowId.orEmpty(),
            locationSummary = locationSummary,
        ).size
    } ?: 0
    val listState = rememberLazyListState()
    var showCaptureEditor by rememberSaveable { mutableStateOf(false) }
    var pendingDelete by remember { mutableStateOf<LaiqDeleteDialogState?>(null) }

    LaunchedEffect(draftState.shellUtDraft.editingRowId) {
        if (draftState.shellUtDraft.editingRowId != null) {
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

    LazyColumn(
        state = listState,
        modifier = Modifier
            .fillMaxSize()
            .testTag(AppReviewTags.ShellUt.Root),
        contentPadding = PaddingValues(
            start = 16.dp,
            end = 16.dp,
            top = contentPadding.calculateTopPadding() + 12.dp,
            bottom = 24.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        if (shellLinePlan == null) {
            item {
                LaiqSectionCard(
                    title = "Shell UT Locked",
                    subtitle = "Setup and scope need a valid diameter before shell crawler lane planning can start.",
                ) {
                    LaiqSecondaryButton("Back", onBack)
                }
            }
            return@LazyColumn
        }

        item {
            LaiqSectionCard(
                title = "Shell UT Crawler Lanes",
                subtitle = "Lane-first shell capture. Numbering stays fixed, while the visible workflow starts from the selected crawler lane.",
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LaiqStatChip(
                        "Recommended",
                        shellLinePlan.recommendedLineCount.toString(),
                        modifier = Modifier
                            .weight(1f)
                            .testTag(AppReviewTags.ShellUt.RecommendedCount),
                    )
                    LaiqStatChip(
                        "Lanes",
                        shellLinePlan.lineCount.toString(),
                        modifier = Modifier
                            .weight(1f)
                            .testTag(AppReviewTags.ShellUt.LaneCount),
                    )
                    LaiqStatChip(
                        "Saved Rows",
                        draftState.shellUtRows.size.toString(),
                        tone = LaiqColors.AccentOrange,
                        modifier = Modifier
                            .weight(1f)
                            .testTag(AppReviewTags.ShellUt.SavedRowCount),
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LaiqStatChip("Lane 1 Anchor", shellLinePlan.startReference, modifier = Modifier.weight(1f))
                    LaiqStatChip(
                        "Start Capture",
                        shellLinePlan.lines.firstOrNull { line -> line.lineId == captureStartLaneId }?.label ?: "Lane 1",
                        tone = LaiqColors.AccentOrange,
                        modifier = Modifier.weight(1f),
                    )
                    LaiqStatChip(
                        "Direction",
                        shellLinePlan.rotationDirection.name.lowercase(),
                        modifier = Modifier.weight(1f),
                    )
                }
                Text(
                    "Lane 1 stays fixed at the saved 0° reference. The map below is shifted so the selected start lane appears first in the capture workflow.",
                    style = MaterialTheme.typography.bodySmall,
                )
                LaiqOptionChips(
                    selectedValue = activeLineId,
                    options = displayedLines.map { line -> line.lineId to line.label },
                    onSelect = {
                        onDraftStateChange(
                            draftState.copy(shellUtDraft = draftState.shellUtDraft.copy(selectedLineId = it)),
                        )
                    },
                )
                ShellSurfaceMap(
                    lines = displayedLines.map {
                        ShellMapLineVisual(
                            lineId = it.lineId,
                            label = it.label,
                            azimuthDeg = it.azimuthDeg.toInt(),
                        )
                    },
                    courseCount = draftState.committedSetupState().shellCourseCount.toIntOrNull() ?: 0,
                    activeCell = activeLineId.takeIf { it.isNotBlank() }?.let { lineId ->
                        activeCourse?.let { lineId to it }
                    },
                    savedCells = draftState.shellUtRows.map { it.lineId to it.course }.toSet(),
                    overlayCells = emptySet(),
                    scaleOriginLabel = scaleOriginLabel,
                    anchorLaneId = shellLinePlan.lines.firstOrNull()?.lineId,
                    captureStartLaneId = captureStartLaneId,
                    onSelectCell = { lineId, course ->
                        onDraftStateChange(
                            draftState.copy(
                                shellUtDraft = draftState.shellUtDraft.copy(
                                    selectedLineId = lineId,
                                    course = course.toString(),
                                ),
                            ),
                        )
                    },
                )
            }
        }

        item {
            LaiqSectionCard(
                title = "Capture Shell Row",
                subtitle = "Open the capture editor only when you want to add or edit one shell measurement row.",
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    LaiqPrimaryButton(
                        text = if (draftState.shellUtDraft.editingRowId != null) "Resume Edit" else "Open Capture",
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
                        "Capture editor hidden. Review saved shell rows below, or open the editor when you need to add or edit one.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                } else {
                    if (draftState.shellUtDraft.editingRowId != null) {
                        Text(
                            "Editing saved row ${draftState.shellUtDraft.editingRowId}",
                            style = MaterialTheme.typography.bodySmall,
                            color = LaiqColors.AccentOrange,
                        )
                    }
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = Color.White,
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
                    ) {
                        Box(modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp)) {
                            if (selectedLocationLabel == null) {
                                Text(
                                    "Tap a shell layout cell first to lock the location.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = LaiqColors.MutedText,
                                )
                            } else {
                                LaiqLabeledValue(
                                    label = "Selected Location",
                                    value = selectedLocationLabel,
                                )
                            }
                        }
                    }
                }
                if (showCaptureEditor && selectedLocationLabel != null) {
                    LaiqDropdownField(
                        label = "Capture State",
                        value = draftState.shellUtDraft.captureState.name,
                        options = measurementCaptureStateOptions(includeNotApplicable = true),
                        onSelected = { selected ->
                            onDraftStateChange(
                                draftState.copy(
                                    shellUtDraft = draftState.shellUtDraft.copy(
                                        captureState = ai.laiq.tankinspection.domain.model.MeasurementCaptureState.valueOf(selected),
                                    ),
                                ),
                            )
                        },
                    )
                    if (draftState.shellUtDraft.captureState.requiresNumericReadings()) {
                        Text(
                            "Thickness readings are captured in $thicknessUnit.",
                            style = MaterialTheme.typography.bodySmall,
                            color = LaiqColors.MutedText,
                        )
                        ShellReadingInputs(
                            draft = draftState.shellUtDraft,
                            onDraftChange = { updated ->
                                onDraftStateChange(draftState.copy(shellUtDraft = updated))
                            },
                        )
                    } else {
                        Text(
                            "${draftState.shellUtDraft.captureState.label()} selected. No numeric thickness readings are required for this shell location.",
                            style = MaterialTheme.typography.bodySmall,
                            color = LaiqColors.MutedText,
                        )
                    }
                    androidx.compose.material3.OutlinedTextField(
                        value = draftState.shellUtDraft.note,
                        onValueChange = {
                            onDraftStateChange(draftState.copy(shellUtDraft = draftState.shellUtDraft.copy(note = it)))
                        },
                        label = { Text("Quick Note") },
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    LaiqPrimaryButton(
                        text = if (draftState.shellUtDraft.editingRowId != null) "Update Shell UT Row" else "Save Shell UT Row",
                        onClick = {
                            val updated = draftState.saveShellUtDraft()
                            onDraftStateChange(updated)
                            if (updated != draftState) {
                                showCaptureEditor = false
                            }
                        },
                    )
                    LaiqSecondaryButton(
                        text = if (selectedFindingCount > 0) "Add Finding ($selectedFindingCount)" else "Add Finding",
                        onClick = {
                            val nextState = draftState.beginFindingForMeasurement(
                                surface = "shell",
                                linkedMeasurementId = draftState.shellUtDraft.editingRowId.orEmpty(),
                                locationSummary = selectedLocationLabel,
                                preciseLineId = activeLineId,
                                preciseCourse = activeCourse?.toString().orEmpty(),
                            )
                            onOpenFindings(nextState)
                        },
                    )
                }
            }
        }

        item {
            LaiqSectionCard(
                title = "Saved Shell Rows",
                subtitle = "Recent shell UT entries captured on-device.",
            ) {
                if (draftState.shellUtRows.isEmpty()) {
                    Text("No shell UT rows saved yet.", style = MaterialTheme.typography.bodySmall)
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        draftState.shellUtRows.takeLast(8).reversed().forEach { row ->
                            val line = shellLinePlan.lines.firstOrNull { it.lineId == row.lineId }
                            val rowLocationLabel = "${line?.label ?: row.lineId} · Strake ${row.course}"
                            val rowFindingCount = draftState.findingsForMeasurement(
                                surface = "shell",
                                linkedMeasurementId = row.rowId,
                                locationSummary = rowLocationLabel,
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
                                        Text("${line?.label ?: row.lineId} · Strake ${row.course}", style = MaterialTheme.typography.titleSmall)
                                        LaiqStatusBadge(row.captureState.label(), if (row.captureState.requiresNumericReadings()) LaiqColors.StatusReady else LaiqColors.AccentOrange)
                                    }
                                    if (row.readings.isNotEmpty()) {
                                        Text("Readings ($thicknessUnit): ${row.readings.joinToString(", ")}", style = MaterialTheme.typography.bodySmall)
                                        measurementStatsFromValues(row.readings)?.let { stats ->
                                            MeasurementStatsRow(stats = stats, modifier = Modifier.fillMaxWidth())
                                        }
                                    } else {
                                        Text("No numeric thickness captured for this row.", style = MaterialTheme.typography.bodySmall, color = LaiqColors.MutedText)
                                    }
                                    row.note?.takeIf { it.isNotBlank() }?.let {
                                        Text("Note: $it", style = MaterialTheme.typography.bodySmall)
                                    }
                                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        OutlinedButton(
                                            onClick = {
                                                showCaptureEditor = true
                                                onDraftStateChange(draftState.editShellUtRow(row.rowId))
                                            },
                                            shape = androidx.compose.foundation.shape.RoundedCornerShape(14.dp),
                                            modifier = Modifier.weight(1f),
                                        ) {
                                            Text("Edit", color = LaiqColors.BrandTeal)
                                        }
                                        OutlinedButton(
                                            onClick = {
                                                pendingDelete = LaiqDeleteDialogState(
                                                    title = "Delete Shell UT Row?",
                                                    message = "This will permanently remove ${line?.label ?: row.lineId} · Strake ${row.course}.",
                                                    onConfirm = { onDraftStateChange(draftState.removeShellUtRow(row.rowId)) },
                                                )
                                            },
                                            shape = androidx.compose.foundation.shape.RoundedCornerShape(14.dp),
                                            modifier = Modifier.weight(1f),
                                        ) {
                                            Text("Delete", color = LaiqColors.BrandRed)
                                        }
                                    }
                                    LaiqSecondaryButton(
                                        text = if (rowFindingCount > 0) "Findings ($rowFindingCount)" else "Add Finding",
                                        onClick = {
                                            onOpenFindings(
                                                draftState.beginFindingForMeasurement(
                                                    surface = "shell",
                                                    linkedMeasurementId = row.rowId,
                                                    locationSummary = rowLocationLabel,
                                                    preciseLineId = row.lineId,
                                                    preciseCourse = row.course.toString(),
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
private fun ShellReadingInputs(
    draft: ShellUtDraftInput,
    onDraftChange: (ShellUtDraftInput) -> Unit,
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

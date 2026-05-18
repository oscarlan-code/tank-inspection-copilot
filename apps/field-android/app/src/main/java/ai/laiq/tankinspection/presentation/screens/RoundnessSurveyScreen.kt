package ai.laiq.tankinspection.presentation.screens

import ai.laiq.tankinspection.domain.model.MeasurementCaptureState
import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.committedScopeBaseline
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqDeleteConfirmDialog
import ai.laiq.tankinspection.presentation.components.LaiqDeleteDialogState
import ai.laiq.tankinspection.presentation.components.LaiqDropdownField
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.editRoundnessSurveyBand
import ai.laiq.tankinspection.presentation.label
import ai.laiq.tankinspection.presentation.measurementCaptureStateOptions
import ai.laiq.tankinspection.presentation.removeRoundnessSurveyBand
import ai.laiq.tankinspection.presentation.requiresNumericReadings
import ai.laiq.tankinspection.presentation.saveRoundnessSurveyDraft
import ai.laiq.tankinspection.presentation.startReferenceLabel
import ai.laiq.tankinspection.presentation.updateRoundnessSurveyHeader
import ai.laiq.tankinspection.presentation.updateRoundnessSurveyStation
import ai.laiq.tankinspection.presentation.updateRoundnessSurveyStationCount
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import java.util.Locale

@Composable
fun RoundnessSurveyScreen(
    draftState: FieldDraftState,
    onDraftStateChange: (FieldDraftState) -> Unit,
    onBack: () -> Unit,
    contentPadding: PaddingValues,
) {
    val committedScope = draftState.committedScopeBaseline()
    val savedSurvey = draftState.savedRoundnessSurvey
    val stateOptions = measurementCaptureStateOptions()
    val draft = draftState.roundnessSurveyDraft
    val listState = rememberLazyListState()
    var pendingDelete by remember { mutableStateOf<LaiqDeleteDialogState?>(null) }
    val parsedCount = draft.stationCount.toIntOrNull()?.coerceAtLeast(1) ?: 0
    val canSave = draft.surveyLabel.isNotBlank() &&
        draft.stations.take(parsedCount).all { station ->
            !station.captureState.requiresNumericReadings() ||
                (station.easting.trim().toDoubleOrNull() != null && station.northing.trim().toDoubleOrNull() != null)
        }

    LaunchedEffect(draft.editingSurveyId) {
        if (draft.editingSurveyId != null) {
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
                title = "Roundness Survey",
                subtitle = "Capture raw E/N coordinates for each shell ring survey. Radius, tolerance, difference, and results are calculated later.",
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LaiqStatChip("Saved Bands", savedSurvey?.surveys?.size?.toString() ?: "0", modifier = Modifier.weight(1f))
                    LaiqStatChip("Stations", draft.stationCount.ifBlank { "—" }, modifier = Modifier.weight(1f))
                    LaiqStatChip("Coordinates", "m", modifier = Modifier.weight(1f))
                }
                Text(
                    "0° reference ${committedScope.startReferenceLabel()} · ${committedScope.rotationDirection.name.lowercase(Locale.US)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.MutedText,
                )
                OutlinedTextField(
                    value = draft.surveyLabel,
                    onValueChange = { onDraftStateChange(draftState.updateRoundnessSurveyHeader(surveyLabel = it)) },
                    label = { Text("Survey Band Label") },
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = draft.heightReference,
                    onValueChange = { onDraftStateChange(draftState.updateRoundnessSurveyHeader(heightReference = it)) },
                    label = { Text("Height / Ring Reference") },
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = draft.stationCount,
                    onValueChange = { onDraftStateChange(draftState.updateRoundnessSurveyStationCount(it)) },
                    label = { Text("Survey Station Count") },
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
            }
        }

        item {
            LaiqSectionCard(
                title = if (draft.editingSurveyId == null) "Coordinate Stations" else "Edit ${draft.surveyLabel}",
                subtitle = "Store only raw coordinates here. Use exception states where a point cannot be captured.",
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    draft.stations.take(parsedCount).forEach { station ->
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
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                Text(
                                    "Station ${station.stationId} · ${formatAngle(station.angleDeg)}",
                                    style = MaterialTheme.typography.titleSmall,
                                )
                                LaiqDropdownField(
                                    label = "Station Status",
                                    value = station.captureState.name,
                                    options = stateOptions,
                                    onSelected = { selected ->
                                        onDraftStateChange(
                                            draftState.updateRoundnessSurveyStation(
                                                stationId = station.stationId,
                                                captureState = MeasurementCaptureState.valueOf(selected),
                                            ),
                                        )
                                    },
                                )
                                if (station.captureState.requiresNumericReadings()) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        OutlinedTextField(
                                            value = station.easting,
                                            onValueChange = { updated ->
                                                onDraftStateChange(
                                                    draftState.updateRoundnessSurveyStation(
                                                        stationId = station.stationId,
                                                        easting = updated,
                                                    ),
                                                )
                                            },
                                            label = { Text("Easting (m)") },
                                            shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                                            singleLine = true,
                                            modifier = Modifier.weight(1f),
                                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                        )
                                        OutlinedTextField(
                                            value = station.northing,
                                            onValueChange = { updated ->
                                                onDraftStateChange(
                                                    draftState.updateRoundnessSurveyStation(
                                                        stationId = station.stationId,
                                                        northing = updated,
                                                    ),
                                                )
                                            },
                                            label = { Text("Northing (m)") },
                                            shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                                            singleLine = true,
                                            modifier = Modifier.weight(1f),
                                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                        )
                                    }
                                } else {
                                    Text(
                                        "${station.captureState.label()} selected. No numeric coordinates are required for this station.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = LaiqColors.MutedText,
                                    )
                                }
                                OutlinedTextField(
                                    value = station.note,
                                    onValueChange = { updated ->
                                        onDraftStateChange(
                                            draftState.updateRoundnessSurveyStation(
                                                stationId = station.stationId,
                                                note = updated,
                                            ),
                                        )
                                    },
                                    label = { Text("Quick Note") },
                                    shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth(),
                                )
                            }
                        }
                    }
                }
                LaiqPrimaryButton(
                    text = if (draft.editingSurveyId == null) "Save Survey Band" else "Update Survey Band",
                    enabled = canSave,
                    onClick = { onDraftStateChange(draftState.saveRoundnessSurveyDraft()) },
                )
            }
        }

        if (!savedSurvey?.surveys.isNullOrEmpty()) {
            item {
                LaiqSectionCard(
                    title = "Saved Survey Bands",
                    subtitle = "Edit or remove each captured roundness ring.",
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        savedSurvey?.surveys.orEmpty().forEach { survey ->
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
                                    verticalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    Text(survey.label, style = MaterialTheme.typography.titleSmall)
                                    Text(
                                        survey.heightReference ?: "No height reference",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = LaiqColors.MutedText,
                                    )
                                    Text(
                                        "${survey.stationCount} stations captured",
                                        style = MaterialTheme.typography.bodySmall,
                                    )
                                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        LaiqSecondaryButton(
                                            text = "Edit",
                                            onClick = { onDraftStateChange(draftState.editRoundnessSurveyBand(survey.surveyId)) },
                                            modifier = Modifier.weight(1f),
                                        )
                                        LaiqSecondaryButton(
                                            text = "Delete",
                                            onClick = {
                                                pendingDelete = LaiqDeleteDialogState(
                                                    title = "Delete ${survey.label}?",
                                                    message = "This will remove the saved roundness survey band.",
                                                    onConfirm = {
                                                        onDraftStateChange(draftState.removeRoundnessSurveyBand(survey.surveyId))
                                                    },
                                                )
                                            },
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

        item {
            LaiqSecondaryButton("Back", onBack)
        }
    }
}

private fun formatAngle(angleDeg: Double): String {
    val rounded = ((angleDeg % 360.0) + 360.0) % 360.0
    return if (rounded % 1.0 == 0.0) {
        "${rounded.toInt()}°"
    } else {
        String.format(Locale.US, "%.1f°", rounded)
    }
}

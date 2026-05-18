package ai.laiq.tankinspection.presentation.screens

import ai.laiq.tankinspection.domain.model.MeasurementCaptureState
import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.committedScopeBaseline
import ai.laiq.tankinspection.presentation.committedSetupState
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqDropdownField
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.label
import ai.laiq.tankinspection.presentation.measurementCaptureStateOptions
import ai.laiq.tankinspection.presentation.requiresNumericReadings
import ai.laiq.tankinspection.presentation.savePlumbnessSurveyDraft
import ai.laiq.tankinspection.presentation.startReferenceLabel
import ai.laiq.tankinspection.presentation.updatePlumbnessSurveyStation
import ai.laiq.tankinspection.presentation.updatePlumbnessSurveyStationCount
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import java.util.Locale

@Composable
fun PlumbnessSurveyScreen(
    draftState: FieldDraftState,
    onDraftStateChange: (FieldDraftState) -> Unit,
    onBack: () -> Unit,
    contentPadding: PaddingValues,
) {
    val committedSetup = draftState.committedSetupState()
    val committedScope = draftState.committedScopeBaseline()
    val savedSurvey = draftState.savedPlumbnessSurvey
    val settlementUnit = committedSetup.settlementUnit.label()
    val stateOptions = measurementCaptureStateOptions()
    val parsedCount = draftState.plumbnessSurveyDraft.stationCount.toIntOrNull()?.coerceAtLeast(1) ?: 0
    val canSave = draftState.plumbnessSurveyDraft.stations.take(parsedCount).all { station ->
        !station.captureState.requiresNumericReadings() || station.plumbness.trim().toDoubleOrNull() != null
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
                title = "Plumbness Survey",
                subtitle = "Capture raw shell plumbness values by station. Acceptance limits are calculated later from the tank height.",
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LaiqStatChip("Survey Unit", settlementUnit, modifier = Modifier.weight(1f))
                    LaiqStatChip("Stations", draftState.plumbnessSurveyDraft.stationCount.ifBlank { "—" }, modifier = Modifier.weight(1f))
                    LaiqStatChip(
                        "Saved",
                        savedSurvey?.stations?.size?.toString() ?: "No",
                        tone = if (savedSurvey == null) LaiqColors.AccentOrange else LaiqColors.BrandTeal,
                        modifier = Modifier.weight(1f),
                    )
                }
                Text(
                    "0° reference ${committedScope.startReferenceLabel()} · ${committedScope.rotationDirection.name.lowercase(Locale.US)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.MutedText,
                )
                OutlinedTextField(
                    value = draftState.plumbnessSurveyDraft.stationCount,
                    onValueChange = { onDraftStateChange(draftState.updatePlumbnessSurveyStationCount(it)) },
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
                title = "Survey Stations",
                subtitle = "Enter the raw plumbness value at each station.",
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    draftState.plumbnessSurveyDraft.stations.take(parsedCount).forEach { station ->
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
                                            draftState.updatePlumbnessSurveyStation(
                                                stationId = station.stationId,
                                                captureState = MeasurementCaptureState.valueOf(selected),
                                            ),
                                        )
                                    },
                                )
                                if (station.captureState.requiresNumericReadings()) {
                                    OutlinedTextField(
                                        value = station.plumbness,
                                        onValueChange = { updated ->
                                            onDraftStateChange(
                                                draftState.updatePlumbnessSurveyStation(
                                                    stationId = station.stationId,
                                                    plumbness = updated,
                                                ),
                                            )
                                        },
                                        label = { Text("Plumbness ($settlementUnit)") },
                                        shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth(),
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                    )
                                } else {
                                    Text(
                                        "${station.captureState.label()} selected. No numeric plumbness value is required for this station.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = LaiqColors.MutedText,
                                    )
                                }
                                OutlinedTextField(
                                    value = station.note,
                                    onValueChange = { updated ->
                                        onDraftStateChange(
                                            draftState.updatePlumbnessSurveyStation(
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
                    text = if (savedSurvey == null) "Save Plumbness Survey" else "Update Plumbness Survey",
                    enabled = canSave,
                    onClick = { onDraftStateChange(draftState.savePlumbnessSurveyDraft()) },
                )
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

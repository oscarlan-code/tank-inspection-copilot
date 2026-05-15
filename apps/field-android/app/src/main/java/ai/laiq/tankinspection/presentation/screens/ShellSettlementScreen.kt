package ai.laiq.tankinspection.presentation.screens

import ai.laiq.tankinspection.domain.model.MeasurementCaptureState
import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.label
import ai.laiq.tankinspection.presentation.measurementCaptureStateOptions
import ai.laiq.tankinspection.presentation.requiresNumericReadings
import ai.laiq.tankinspection.presentation.saveShellSettlementSurveyDraft
import ai.laiq.tankinspection.presentation.startReferenceLabel
import ai.laiq.tankinspection.presentation.updateShellSettlementStation
import ai.laiq.tankinspection.presentation.updateShellSettlementStationCount
import ai.laiq.tankinspection.presentation.committedSetupState
import ai.laiq.tankinspection.presentation.committedScopeBaseline
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqDropdownField
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
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
fun ShellSettlementScreen(
    draftState: FieldDraftState,
    onDraftStateChange: (FieldDraftState) -> Unit,
    onBack: () -> Unit,
    contentPadding: PaddingValues,
) {
    val committedSetup = draftState.committedSetupState()
    val committedScope = draftState.committedScopeBaseline()
    val savedSurvey = draftState.savedShellSettlementSurvey
    val thicknessUnit = committedSetup.thicknessUnit.label()
    val stateOptions = measurementCaptureStateOptions()
    val canSave = draftState.shellSettlementDraft.stations.take(
        draftState.shellSettlementDraft.stationCount.toIntOrNull()?.coerceAtLeast(1) ?: 0,
    ).all { station ->
        !station.captureState.requiresNumericReadings() || station.elevation.trim().toDoubleOrNull() != null
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
                title = "Shell Settlement Survey",
                subtitle = "Capture raw elevation readings around the shell perimeter. Arc length and API deflection values are calculated later.",
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LaiqStatChip("Thickness Unit", thicknessUnit, modifier = Modifier.weight(1f))
                    LaiqStatChip("Stations", draftState.shellSettlementDraft.stationCount.ifBlank { "—" }, modifier = Modifier.weight(1f))
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
                )
                OutlinedTextField(
                    value = draftState.shellSettlementDraft.stationCount,
                    onValueChange = { onDraftStateChange(draftState.updateShellSettlementStationCount(it)) },
                    label = { Text("Survey Station Count") },
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
                Text(
                    "Use equal angular spacing. Each station can store a numeric elevation or an exception state.",
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.MutedText,
                )
            }
        }

        item {
            LaiqSectionCard(
                title = "Survey Stations",
                subtitle = "Enter the raw perimeter level readings only.",
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    draftState.shellSettlementDraft.stations.take(
                        draftState.shellSettlementDraft.stationCount.toIntOrNull()?.coerceAtLeast(1)
                            ?: draftState.shellSettlementDraft.stations.size,
                    ).forEach { station ->
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
                                            draftState.updateShellSettlementStation(
                                                stationId = station.stationId,
                                                captureState = MeasurementCaptureState.valueOf(selected),
                                            ),
                                        )
                                    },
                                )
                                if (station.captureState.requiresNumericReadings()) {
                                    OutlinedTextField(
                                        value = station.elevation,
                                        onValueChange = { updated ->
                                            onDraftStateChange(
                                                draftState.updateShellSettlementStation(
                                                    stationId = station.stationId,
                                                    elevation = updated,
                                                ),
                                            )
                                        },
                                        label = { Text("Elevation ($thicknessUnit)") },
                                        shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth(),
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                    )
                                } else {
                                    Text(
                                        "${station.captureState.label()} selected. No numeric elevation is required for this station.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = LaiqColors.MutedText,
                                    )
                                }
                                OutlinedTextField(
                                    value = station.note,
                                    onValueChange = { updated ->
                                        onDraftStateChange(
                                            draftState.updateShellSettlementStation(
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
                    text = if (savedSurvey == null) "Save Settlement Survey" else "Update Settlement Survey",
                    enabled = canSave,
                    onClick = { onDraftStateChange(draftState.saveShellSettlementSurveyDraft()) },
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

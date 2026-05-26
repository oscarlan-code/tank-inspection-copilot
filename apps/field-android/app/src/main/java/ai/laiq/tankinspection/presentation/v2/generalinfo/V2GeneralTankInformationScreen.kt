package ai.laiq.tankinspection.presentation.v2.generalinfo

import ai.laiq.tankinspection.presentation.GeneralTankInfoFormState
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqDropdownField
import ai.laiq.tankinspection.presentation.components.LaiqOptionChips
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqTextField
import ai.laiq.tankinspection.presentation.requiredValidationErrors
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

private val externalRoofTypeOptions = listOf(
    "na" to "N.A.",
    "cone" to "Cone Roof",
    "dome" to "Dome Roof",
    "umbrella" to "Umbrella Roof",
    "geodesic" to "Geodesic Roof",
    "other_fixed" to "Other Fixed Roof",
    "external_floating" to "External Floating Roof",
)

private val internalRoofTypeOptions = listOf(
    "na" to "N.A.",
    "internal_floating" to "Internal Floating Roof",
)

@Composable
fun V2GeneralTankInformationScreen(
    state: GeneralTankInfoFormState,
    onStateChange: (GeneralTankInfoFormState) -> Unit,
    onBack: () -> Unit,
    onContinue: () -> Unit,
    contentPadding: PaddingValues = PaddingValues(0.dp),
) {
    var showOptionalDetails by rememberSaveable { mutableStateOf(false) }
    val validationErrors = state.requiredValidationErrors()

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val wideLayout = maxWidth >= 760.dp

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
                    "General Tank Information",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = LaiqColors.BrandTeal,
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
            }

            item {
                LaiqSectionCard(
                    title = "Required",
                    subtitle = "Layout-driving tank identity and baseline geometry.",
                ) {
                    SectionLabel("Identity")
                    TwoUpFields(
                        wide = wideLayout,
                        left = {
                            EditableField(
                                label = "Client",
                                value = state.client,
                                onValueChange = { onStateChange(state.copy(client = it)) },
                            )
                        },
                        right = {
                            EditableField(
                                label = "Tank No.",
                                value = state.tankNumber,
                                onValueChange = { onStateChange(state.copy(tankNumber = it)) },
                            )
                        },
                    )
                    TwoUpFields(
                        wide = wideLayout,
                        left = {
                            EditableField(
                                label = "Location",
                                value = state.location,
                                onValueChange = { onStateChange(state.copy(location = it)) },
                            )
                        },
                        right = {
                            EditableField(
                                label = "Field / Lease Name",
                                value = state.fieldLeaseName,
                                onValueChange = { onStateChange(state.copy(fieldLeaseName = it)) },
                            )
                        },
                    )

                    SectionLabel("Layout Baseline")
                    Text(
                        "Construction (Shell)",
                        style = MaterialTheme.typography.labelLarge,
                        color = LaiqColors.BodyText,
                        fontWeight = FontWeight.Medium,
                    )
                    LaiqOptionChips(
                        selectedValue = state.shellConstruction,
                        options = listOf(
                            "butt" to "Butt Welded",
                            "lap" to "Lap Welded",
                            "riveted" to "Riveted",
                        ),
                        onSelect = { onStateChange(state.copy(shellConstruction = it)) },
                    )
                    TwoUpFields(
                        wide = wideLayout,
                        left = {
                            LaiqDropdownField(
                                label = "External Roof Type",
                                value = state.externalRoofType,
                                options = externalRoofTypeOptions,
                                onSelected = {
                                    val nextInternalRoofType =
                                        if (it == "external_floating") "na" else state.internalRoofType
                                    onStateChange(
                                        state.copy(
                                            externalRoofType = it,
                                            internalRoofType = nextInternalRoofType,
                                        ),
                                    )
                                },
                            )
                        },
                        right = {
                            LaiqDropdownField(
                                label = "Internal Roof Type",
                                value = state.internalRoofType,
                                options = internalRoofTypeOptions,
                                onSelected = { onStateChange(state.copy(internalRoofType = it)) },
                            )
                        },
                    )
                    EditableField(
                        label = "Product Stored",
                        value = state.productStored,
                        onValueChange = { onStateChange(state.copy(productStored = it)) },
                    )

                    SectionLabel("Geometry")
                    TwoUpFields(
                        wide = wideLayout,
                        left = {
                            UnitField(
                                label = "Diameter (m)",
                                value = state.diameter,
                                onValueChange = { onStateChange(state.copy(diameter = it)) },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            )
                        },
                        right = {
                            UnitField(
                                label = "Height (m)",
                                value = state.height,
                                onValueChange = { onStateChange(state.copy(height = it)) },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            )
                        },
                    )
                    TwoUpFields(
                        wide = wideLayout,
                        left = {
                            UnitField(
                                label = "Service Height (m)",
                                value = state.serviceHeight,
                                onValueChange = { onStateChange(state.copy(serviceHeight = it)) },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            )
                        },
                        right = {
                            UnitField(
                                label = "Course Number",
                                value = state.courseNumber,
                                onValueChange = { onStateChange(state.copy(courseNumber = it)) },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            )
                        },
                    )
                }
            }

            item {
                LaiqSectionCard(
                    title = "Optional",
                    subtitle = "Additional inspection and reporting details.",
                ) {
                    OptionalSummaryPills()
                    LaiqSecondaryButton(
                        text = if (showOptionalDetails) "Hide Optional Details" else "Show Optional Details",
                        onClick = { showOptionalDetails = !showOptionalDetails },
                    )

                    if (showOptionalDetails) {
                        OptionalPanel(title = "Temporary Counts") {
                            TwoUpFields(
                                wide = wideLayout,
                                left = {
                                    UnitField(
                                        label = "Roof Plate Number (Temp)",
                                        value = state.roofPlateNumber,
                                        onValueChange = { onStateChange(state.copy(roofPlateNumber = it)) },
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    )
                                },
                                right = {
                                    UnitField(
                                        label = "Floor Plate Number (Temp)",
                                        value = state.floorPlateNumber,
                                        onValueChange = { onStateChange(state.copy(floorPlateNumber = it)) },
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    )
                                },
                            )
                            UnitField(
                                label = "Annular Plate Number (Temp)",
                                value = state.annularPlateNumber,
                                onValueChange = { onStateChange(state.copy(annularPlateNumber = it)) },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            )
                        }

                        OptionalPanel(title = "Inspection Details") {
                            TwoUpFields(
                                wide = wideLayout,
                                left = {
                                    EditableField(
                                        label = "Client Representative",
                                        value = state.clientRepresentative,
                                        onValueChange = { onStateChange(state.copy(clientRepresentative = it)) },
                                    )
                                },
                                right = {
                                    EditableField(
                                        label = "Job No.",
                                        value = state.jobNo,
                                        onValueChange = { onStateChange(state.copy(jobNo = it)) },
                                    )
                                },
                            )
                            TwoUpFields(
                                wide = wideLayout,
                                left = {
                                    EditableField(
                                        label = "Date Completed",
                                        value = state.dateCompleted,
                                        onValueChange = { onStateChange(state.copy(dateCompleted = it)) },
                                    )
                                },
                                right = {
                                    EditableField(
                                        label = "Inspector",
                                        value = state.inspector,
                                        onValueChange = { onStateChange(state.copy(inspector = it)) },
                                    )
                                },
                            )
                            TwoUpFields(
                                wide = wideLayout,
                                left = {
                                    EditableField(
                                        label = "Year Built",
                                        value = state.yearBuilt,
                                        onValueChange = { onStateChange(state.copy(yearBuilt = it)) },
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    )
                                },
                                right = {
                                    EditableField(
                                        label = "Original Manufacturer",
                                        value = state.originalManufacturer,
                                        onValueChange = { onStateChange(state.copy(originalManufacturer = it)) },
                                    )
                                },
                            )
                            TwoUpFields(
                                wide = wideLayout,
                                left = {
                                    EditableField(
                                        label = "Original Construction Std.",
                                        value = state.originalConstructionStd,
                                        onValueChange = { onStateChange(state.copy(originalConstructionStd = it)) },
                                    )
                                },
                                right = {
                                    EditableField(
                                        label = "Material Spec.",
                                        value = state.materialSpec,
                                        onValueChange = { onStateChange(state.copy(materialSpec = it)) },
                                    )
                                },
                            )
                            EditableField(
                                label = "Drawing Ref.",
                                value = state.drawingRef,
                                onValueChange = { onStateChange(state.copy(drawingRef = it)) },
                            )
                        }

                        OptionalPanel(title = "Material And Design") {
                            TwoUpFields(
                                wide = wideLayout,
                                left = {
                                    EditableField(
                                        label = "Specific Gravity",
                                        value = state.specificGravity,
                                        onValueChange = { onStateChange(state.copy(specificGravity = it)) },
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                    )
                                },
                                right = {
                                    UnitField(
                                        label = "Design Temp. (C)",
                                        value = state.designTemp,
                                        onValueChange = { onStateChange(state.copy(designTemp = it)) },
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                    )
                                },
                            )
                            EditableField(
                                label = "Internal Pres.",
                                value = state.internalPressure,
                                onValueChange = { onStateChange(state.copy(internalPressure = it)) },
                            )
                        }

                        OptionalPanel(title = "Construction Notes") {
                            TwoUpFields(
                                wide = wideLayout,
                                left = {
                                    UnitField(
                                        label = "Floor Plate Thickness (mm)",
                                        value = state.floorPlateThickness,
                                        onValueChange = { onStateChange(state.copy(floorPlateThickness = it)) },
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                    )
                                },
                                right = {
                                    UnitField(
                                        label = "Annular Plate Thickness (mm)",
                                        value = state.annularPlateThickness,
                                        onValueChange = { onStateChange(state.copy(annularPlateThickness = it)) },
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                    )
                                },
                            )
                            EditableField(
                                label = "Wind Girder",
                                value = state.windGirder,
                                onValueChange = { onStateChange(state.copy(windGirder = it)) },
                            )
                            Text(
                                "Insulated",
                                style = MaterialTheme.typography.labelLarge,
                                color = LaiqColors.BodyText,
                                fontWeight = FontWeight.Medium,
                            )
                            LaiqOptionChips(
                                selectedValue = state.insulated,
                                options = listOf("yes" to "Yes", "no" to "No"),
                                onSelect = { onStateChange(state.copy(insulated = it)) },
                            )
                            if (state.insulated == "yes") {
                                UnitField(
                                    label = "Distance From Curb Angle / Wind Girder (m)",
                                    value = state.insulationDistance,
                                    onValueChange = { onStateChange(state.copy(insulationDistance = it)) },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                )
                            }
                            EditableField(
                                label = "Stiffener",
                                value = state.stiffener,
                                onValueChange = { onStateChange(state.copy(stiffener = it)) },
                            )
                        }

                        OptionalPanel(title = "Previous Inspection History") {
                            TwoUpFields(
                                wide = wideLayout,
                                left = {
                                    EditableField(
                                        label = "Previous External",
                                        value = state.previousExternal,
                                        onValueChange = { onStateChange(state.copy(previousExternal = it)) },
                                    )
                                },
                                right = {
                                    EditableField(
                                        label = "Previous Internal",
                                        value = state.previousInternal,
                                        onValueChange = { onStateChange(state.copy(previousInternal = it)) },
                                    )
                                },
                            )
                            EditableField(
                                label = "Previous Bottom",
                                value = state.previousBottom,
                                onValueChange = { onStateChange(state.copy(previousBottom = it)) },
                            )
                        }
                    }
                }
            }

            item {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (validationErrors.isNotEmpty()) {
                        ValidationPanel(errors = validationErrors)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        LaiqSecondaryButton(
                            text = "Back",
                            onClick = onBack,
                            modifier = Modifier.weight(1f),
                        )
                        LaiqPrimaryButton(
                            text = "Continue",
                            onClick = onContinue,
                            enabled = validationErrors.isEmpty(),
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun EditableField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
) {
    LaiqTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        modifier = Modifier.fillMaxWidth(),
        keyboardOptions = keyboardOptions,
    )
}

@Composable
private fun UnitField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
) {
    LaiqTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        modifier = Modifier.fillMaxWidth(),
        keyboardOptions = keyboardOptions,
    )
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelLarge,
        color = LaiqColors.MutedText,
        fontWeight = FontWeight.SemiBold,
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun OptionalSummaryPills() {
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        OptionalPill("Counts")
        OptionalPill("Inspection")
        OptionalPill("Construction")
        OptionalPill("History")
    }
}

@Composable
private fun OptionalPill(text: String) {
    Surface(
        color = LaiqColors.SurfaceTint,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            style = MaterialTheme.typography.labelMedium,
            color = LaiqColors.BrandTeal,
            fontWeight = FontWeight.Medium,
        )
    }
}

@Composable
private fun OptionalPanel(
    title: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = LaiqColors.SurfaceTint,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                color = LaiqColors.BrandTeal,
                fontWeight = FontWeight.SemiBold,
            )
            content()
        }
    }
}

@Composable
private fun ValidationPanel(errors: List<String>) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = LaiqColors.StatusWarning.copy(alpha = 0.06f),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, LaiqColors.StatusWarning.copy(alpha = 0.18f)),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = "Required fields",
                style = MaterialTheme.typography.labelLarge,
                color = LaiqColors.StatusWarning,
                fontWeight = FontWeight.SemiBold,
            )
            errors.forEach { error ->
                Text(
                    text = error,
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.StatusWarning,
                )
            }
        }
    }
}

@Composable
private fun TwoUpFields(
    wide: Boolean,
    left: @Composable () -> Unit,
    right: @Composable () -> Unit,
) {
    if (wide) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(modifier = Modifier.weight(1f)) { left() }
            Column(modifier = Modifier.weight(1f)) { right() }
        }
    } else {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            left()
            right()
        }
    }
}

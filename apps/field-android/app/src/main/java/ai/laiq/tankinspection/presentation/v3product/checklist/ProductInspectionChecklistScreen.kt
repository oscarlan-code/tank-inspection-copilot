package ai.laiq.tankinspection.presentation.v3product.checklist

import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqDropdownField
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.components.LaiqStatusBadge
import ai.laiq.tankinspection.presentation.components.LaiqTextField
import ai.laiq.tankinspection.presentation.v3product.common.ProductStickyActionBar
import ai.laiq.tankinspection.presentation.v3product.common.ProductStickyActionBarHeight
import ai.laiq.tankinspection.v3product.model.ProductChecklistItemDefinition
import ai.laiq.tankinspection.v3product.model.ProductChecklistRating
import ai.laiq.tankinspection.v3product.model.ProductGeneralTankInfo
import ai.laiq.tankinspection.v3product.model.ProductInspectionChecklistCatalog
import ai.laiq.tankinspection.v3product.model.ProductInspectionChecklistState
import ai.laiq.tankinspection.v3product.model.completedItemCount
import ai.laiq.tankinspection.v3product.model.isComplete
import ai.laiq.tankinspection.v3product.model.withItemNote
import ai.laiq.tankinspection.v3product.model.withRating
import ai.laiq.tankinspection.v3product.model.withSectionComment
import ai.laiq.tankinspection.v3product.model.withSelectedSection
import ai.laiq.tankinspection.v3product.storage.ProductWorkflowScreen
import ai.laiq.tankinspection.v3product.voice.ProductVoiceControlLevel
import ai.laiq.tankinspection.v3product.voice.ProductVoiceCaptureHost
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private val checklistRatings = listOf(
    ProductChecklistRating.GOOD,
    ProductChecklistRating.SATISFACTORY,
    ProductChecklistRating.NOT_TO_CODE,
    ProductChecklistRating.REQUIRES_REPAIR,
    ProductChecklistRating.IMMEDIATE_ATTENTION,
    ProductChecklistRating.INACCESSIBLE,
    ProductChecklistRating.NONE_EVIDENT,
    ProductChecklistRating.NOT_APPLICABLE,
)

@Composable
fun ProductInspectionChecklistScreen(
    generalTankInfo: ProductGeneralTankInfo,
    state: ProductInspectionChecklistState,
    onStateChange: (ProductInspectionChecklistState) -> Unit,
    onBack: () -> Unit,
    onContinue: (ProductInspectionChecklistState) -> Unit,
    contentPadding: PaddingValues = PaddingValues(0.dp),
) {
    val selectedSection = ProductInspectionChecklistCatalog.sectionByKey(state.selectedSectionKey)
    val totalCount = ProductInspectionChecklistCatalog.totalItemCount
    val completedCount = state.completedItemCount()
    val selectedSectionCompletedCount = selectedSection.items.count { item ->
        state.ratingsByItemNumber[item.number] != null
    }
    var expandedNoteItemNumber by rememberSaveable { mutableStateOf<Int?>(null) }

    Box(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            contentPadding = PaddingValues(
                start = 16.dp,
                end = 16.dp,
                top = contentPadding.calculateTopPadding() + 12.dp,
                bottom = ProductStickyActionBarHeight + 28.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Text(
                    text = "Inspection Checklist",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = LaiqColors.BrandTeal,
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
            }

            item {
                LaiqSectionCard(
                    title = "Checklist Progress",
                    subtitle = "PDF checklist sections adapted for mobile with the original numbering intact, including the source form's intentional numbering gaps.",
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        LaiqStatChip(
                            label = "Tank",
                            value = generalTankInfo.tankNumber.ifBlank { "Tank" },
                            modifier = Modifier.weight(1f),
                        )
                        LaiqStatChip(
                            label = "Inspector",
                            value = generalTankInfo.inspector.ifBlank { "Inspector" },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        LaiqStatChip(
                            label = "Rated",
                            value = "$completedCount/$totalCount",
                            tone = if (state.isComplete()) LaiqColors.StatusReady else LaiqColors.AccentOrange,
                            modifier = Modifier.weight(1f),
                        )
                        LaiqStatChip(
                            label = selectedSection.title,
                            value = "$selectedSectionCompletedCount/${selectedSection.items.size}",
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            item {
                LaiqSectionCard(
                    title = "Sections",
                    subtitle = "Work through each checklist section before export.",
                ) {
                    LaiqDropdownField(
                        label = "Checklist section",
                        value = selectedSection.key,
                        options = ProductInspectionChecklistCatalog.sections.map { section ->
                            section.key to "${section.title} (${state.sectionCountLabel(section.key)})"
                        },
                        onSelected = { sectionKey ->
                            onStateChange(state.withSelectedSection(sectionKey))
                        },
                    )
                }
            }

            item {
                LaiqSectionCard(
                    title = selectedSection.title,
                    subtitle = selectedSection.commentsHint ?: "Select one rating for each checklist item.",
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "${selectedSection.items.size} checklist items",
                            style = MaterialTheme.typography.bodyMedium,
                            color = LaiqColors.BodyText,
                        )
                        LaiqStatusBadge(
                            text = "${state.sectionCountLabel(selectedSection.key)} rated",
                            tone = if (selectedSectionCompletedCount == selectedSection.items.size) {
                                LaiqColors.StatusReady
                            } else {
                                LaiqColors.AccentOrange
                            },
                        )
                    }
                }
            }

            items(
                items = selectedSection.items,
                key = { item -> item.number },
            ) { item ->
                ChecklistItemCard(
                    item = item,
                    itemNote = state.itemNotesByItemNumber[item.number].orEmpty(),
                    noteExpanded = expandedNoteItemNumber == item.number,
                    selectedRating = state.ratingsByItemNumber[item.number],
                    onToggleNote = {
                        expandedNoteItemNumber = if (expandedNoteItemNumber == item.number) {
                            null
                        } else {
                            item.number
                        }
                    },
                    onNoteChange = { note ->
                        onStateChange(state.withItemNote(item.number, note))
                    },
                    onSelected = { rating ->
                        onStateChange(state.withRating(item.number, rating))
                    },
                )
            }

            item {
                LaiqSectionCard(
                    title = "${selectedSection.title} Comments",
                    subtitle = "Optional notes for this section.",
                ) {
                    LaiqTextField(
                        value = state.sectionComments[selectedSection.key].orEmpty(),
                        onValueChange = { comment ->
                            onStateChange(state.withSectionComment(selectedSection.key, comment))
                        },
                        label = { Text("Section comments") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = false,
                    )
                }
            }
        }

        ProductStickyActionBar(
            primaryText = if (state.isComplete()) "Complete Checklist" else "Checklist Incomplete",
            onPrimaryClick = { onContinue(state) },
            primaryEnabled = state.isComplete(),
            secondaryText = "Back",
            onSecondaryClick = onBack,
            modifier = Modifier.align(Alignment.BottomCenter),
        )
    }
}


@Composable
private fun ChecklistItemCard(
    item: ProductChecklistItemDefinition,
    itemNote: String,
    noteExpanded: Boolean,
    selectedRating: ProductChecklistRating?,
    onToggleNote: () -> Unit,
    onNoteChange: (String) -> Unit,
    onSelected: (ProductChecklistRating) -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color.White,
        shape = MaterialTheme.shapes.large,
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    text = "Item ${item.number}",
                    style = MaterialTheme.typography.labelLarge,
                    color = LaiqColors.MutedText,
                    fontWeight = FontWeight.Medium,
                )
                Text(
                    text = item.prompt,
                    style = MaterialTheme.typography.bodyLarge,
                    color = LaiqColors.BodyText,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            ChecklistAdditionalNoteResponse(
                item = item,
                itemNote = itemNote,
                expanded = noteExpanded,
                onToggle = onToggleNote,
                onNoteChange = onNoteChange,
            )
            ChecklistRatingList(
                selectedRating = selectedRating,
                onSelected = onSelected,
            )
        }
    }
}

@Composable
private fun ChecklistAdditionalNoteResponse(
    item: ProductChecklistItemDefinition,
    itemNote: String,
    expanded: Boolean,
    onToggle: () -> Unit,
    onNoteChange: (String) -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = if (expanded || itemNote.isNotBlank()) LaiqColors.BrandTeal.copy(alpha = 0.08f) else Color.White,
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, if (expanded) LaiqColors.BrandTeal else LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onToggle() },
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "•",
                    style = MaterialTheme.typography.titleMedium,
                    color = LaiqColors.BrandTeal,
                    fontWeight = FontWeight.SemiBold,
                )
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(3.dp),
                ) {
                    Text(
                        text = "Additional note",
                        style = MaterialTheme.typography.labelLarge,
                        color = LaiqColors.BrandTeal,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = itemNote.ifBlank { "Tap to add text or hold the mic to record for this item." },
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (itemNote.isBlank()) LaiqColors.MutedText else LaiqColors.BodyText,
                    )
                }
            }
            if (expanded) {
                ProductVoiceCaptureHost(
                    screen = ProductWorkflowScreen.CHECKLIST,
                    modifier = Modifier.fillMaxWidth(),
                    buttonAlignment = Alignment.TopEnd,
                    compactButton = true,
                    controlLevel = ProductVoiceControlLevel.LOCAL,
                    cardKey = "checklist_item",
                    fieldKey = "checklist_item_note",
                    itemKey = "checklist:${item.number}",
                    itemLabel = "Item ${item.number}",
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 6.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text = "Hold the mic to record. Double tap the mic to preview this item only.",
                            style = MaterialTheme.typography.bodySmall,
                            color = LaiqColors.MutedText,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(end = 72.dp),
                        )
                        LaiqTextField(
                            value = itemNote,
                            onValueChange = onNoteChange,
                            label = { Text("Additional note for Item ${item.number}") },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(104.dp),
                            singleLine = false,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ChecklistRatingList(
    selectedRating: ProductChecklistRating?,
    onSelected: (ProductChecklistRating) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        checklistRatings.forEach { rating ->
            ChecklistRatingRow(
                rating = rating,
                selected = rating == selectedRating,
                onClick = { onSelected(rating) },
            )
        }
    }
}

@Composable
private fun ChecklistRatingRow(
    rating: ProductChecklistRating,
    selected: Boolean,
    onClick: (() -> Unit)?,
) {
    val rowModifier = if (onClick != null) {
        Modifier.clickable { onClick() }
    } else {
        Modifier
    }
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .then(rowModifier),
        color = if (selected) LaiqColors.BrandTeal.copy(alpha = 0.08f) else Color.White,
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, if (selected) LaiqColors.BrandTeal else LaiqColors.PanelBorder),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RadioButton(
                selected = selected,
                onClick = null,
                enabled = true,
                colors = RadioButtonDefaults.colors(
                    selectedColor = LaiqColors.BrandTeal,
                    unselectedColor = LaiqColors.MutedText,
                    disabledSelectedColor = LaiqColors.BrandTeal,
                    disabledUnselectedColor = LaiqColors.MutedText,
                ),
            )
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text = rating.shortLabel,
                    style = MaterialTheme.typography.labelLarge,
                    color = LaiqColors.BrandTeal,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = rating.label,
                    style = MaterialTheme.typography.bodyMedium,
                    color = LaiqColors.BodyText,
                )
            }
        }
    }
}

private fun ProductInspectionChecklistState.sectionCountLabel(sectionKey: String): String {
    val section = ProductInspectionChecklistCatalog.sectionByKey(sectionKey)
    val count = section.items.count { item -> ratingsByItemNumber[item.number] != null }
    return "$count/${section.items.size}"
}

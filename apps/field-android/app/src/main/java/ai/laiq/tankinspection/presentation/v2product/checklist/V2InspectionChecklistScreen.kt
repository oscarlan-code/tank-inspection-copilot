package ai.laiq.tankinspection.presentation.v2product.checklist

import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqDropdownField
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.components.LaiqStatusBadge
import ai.laiq.tankinspection.presentation.components.LaiqTextField
import ai.laiq.tankinspection.v2product.model.V2ChecklistItemDefinition
import ai.laiq.tankinspection.v2product.model.V2ChecklistRating
import ai.laiq.tankinspection.v2product.model.V2GeneralTankInfo
import ai.laiq.tankinspection.v2product.model.V2InspectionChecklistCatalog
import ai.laiq.tankinspection.v2product.model.V2InspectionChecklistState
import ai.laiq.tankinspection.v2product.model.completedItemCount
import ai.laiq.tankinspection.v2product.model.isComplete
import ai.laiq.tankinspection.v2product.model.withRating
import ai.laiq.tankinspection.v2product.model.withSectionComment
import ai.laiq.tankinspection.v2product.model.withSelectedSection
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private val checklistRatings = listOf(
    V2ChecklistRating.GOOD,
    V2ChecklistRating.SATISFACTORY,
    V2ChecklistRating.NOT_TO_CODE,
    V2ChecklistRating.REQUIRES_REPAIR,
    V2ChecklistRating.IMMEDIATE_ATTENTION,
    V2ChecklistRating.INACCESSIBLE,
    V2ChecklistRating.NONE_EVIDENT,
    V2ChecklistRating.NOT_APPLICABLE,
)

@Composable
fun V2InspectionChecklistScreen(
    generalTankInfo: V2GeneralTankInfo,
    state: V2InspectionChecklistState,
    onStateChange: (V2InspectionChecklistState) -> Unit,
    onBack: () -> Unit,
    onContinue: (V2InspectionChecklistState) -> Unit,
    contentPadding: PaddingValues = PaddingValues(0.dp),
) {
    val selectedSection = V2InspectionChecklistCatalog.sectionByKey(state.selectedSectionKey)
    val totalCount = V2InspectionChecklistCatalog.totalItemCount
    val completedCount = state.completedItemCount()
    val selectedSectionCompletedCount = selectedSection.items.count { item ->
        state.ratingsByItemNumber[item.number] != null
    }

    LazyColumn(
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
                    options = V2InspectionChecklistCatalog.sections.map { section ->
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
                selectedRating = state.ratingsByItemNumber[item.number],
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

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                LaiqSecondaryButton(
                    text = "Back",
                    onClick = onBack,
                    modifier = Modifier.weight(1f),
                )
                LaiqPrimaryButton(
                    text = if (state.isComplete()) "Complete Checklist" else "Checklist Incomplete",
                    onClick = { onContinue(state) },
                    enabled = state.isComplete(),
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun ChecklistItemCard(
    item: V2ChecklistItemDefinition,
    selectedRating: V2ChecklistRating?,
    onSelected: (V2ChecklistRating) -> Unit,
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
            ChecklistRatingList(
                selectedRating = selectedRating,
                onSelected = onSelected,
            )
        }
    }
}

@Composable
private fun ChecklistRatingList(
    selectedRating: V2ChecklistRating?,
    onSelected: (V2ChecklistRating) -> Unit,
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
    rating: V2ChecklistRating,
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

private fun V2InspectionChecklistState.sectionCountLabel(sectionKey: String): String {
    val section = V2InspectionChecklistCatalog.sectionByKey(sectionKey)
    val count = section.items.count { item -> ratingsByItemNumber[item.number] != null }
    return "$count/${section.items.size}"
}

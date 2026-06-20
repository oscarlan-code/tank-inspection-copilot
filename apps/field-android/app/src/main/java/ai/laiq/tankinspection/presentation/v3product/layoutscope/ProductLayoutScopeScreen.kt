package ai.laiq.tankinspection.presentation.v3product.layoutscope

import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.v3product.common.ProductStickyActionBar
import ai.laiq.tankinspection.presentation.v3product.common.ProductStickyActionBarHeight
import ai.laiq.tankinspection.v3product.model.ProductGeneralTankInfo
import ai.laiq.tankinspection.v3product.model.ProductLayoutScope
import ai.laiq.tankinspection.v3product.model.hasExternalRoof
import ai.laiq.tankinspection.v3product.model.hasInternalRoof
import ai.laiq.tankinspection.v3product.model.selectedTargets
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
fun ProductLayoutScopeScreen(
    generalTankInfo: ProductGeneralTankInfo,
    state: ProductLayoutScope,
    onStateChange: (ProductLayoutScope) -> Unit,
    onBack: () -> Unit,
    onContinue: () -> Unit,
    contentPadding: PaddingValues = PaddingValues(0.dp),
) {
    val externalRoofAvailable = generalTankInfo.hasExternalRoof()
    val internalRoofAvailable = generalTankInfo.hasInternalRoof()
    val effectiveState = state.copy(
        externalRoof = state.externalRoof && externalRoofAvailable,
        internalRoof = state.internalRoof && internalRoofAvailable,
    )
    val selectedTargets = effectiveState.selectedTargets()

    Box(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
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
                    "Layout Scope",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = LaiqColors.BrandTeal,
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
            }

        item {
            LaiqSectionCard(title = "General Info") {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    LaiqStatChip(
                        label = "Tank",
                        value = generalTankInfo.tankNumber.ifBlank { "Tank" },
                        modifier = Modifier.weight(1f),
                    )
                    LaiqStatChip(
                        label = "Diameter",
                        value = generalTankInfo.diameter.ifBlank { "-" } + " m",
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }

        item {
            LaiqSectionCard(title = "Layout Maps") {
                LayoutScopeRow(
                    title = "External Roof",
                    detail = roofPresenceLabel(externalRoofAvailable),
                    checked = effectiveState.externalRoof,
                    enabled = externalRoofAvailable,
                    onCheckedChange = {
                        onStateChange(state.copy(externalRoof = it))
                    },
                )
                LayoutScopeRow(
                    title = "Internal Roof",
                    detail = roofPresenceLabel(internalRoofAvailable),
                    checked = effectiveState.internalRoof,
                    enabled = internalRoofAvailable,
                    onCheckedChange = {
                        onStateChange(state.copy(internalRoof = it))
                    },
                )
                LayoutScopeRow(
                    title = "Shell",
                    detail = "${generalTankInfo.courseNumber.ifBlank { "0" }} courses",
                    checked = state.shell,
                    enabled = true,
                    onCheckedChange = {
                        onStateChange(state.copy(shell = it))
                    },
                )
                LayoutScopeRow(
                    title = "Floor",
                    detail = "Set up if floor map or floor findings are required",
                    checked = state.floor,
                    enabled = true,
                    onCheckedChange = {
                        onStateChange(state.copy(floor = it))
                    },
                )
            }
        }

        }

        ProductStickyActionBar(
            primaryText = "Continue",
            onPrimaryClick = onContinue,
            primaryEnabled = selectedTargets.isNotEmpty(),
            onSecondaryClick = onBack,
            modifier = Modifier.align(Alignment.BottomCenter),
        )
    }
}

@Composable
private fun LayoutScopeRow(
    title: String,
    detail: String,
    checked: Boolean,
    enabled: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Surface(
        onClick = { if (enabled) onCheckedChange(!checked) },
        enabled = enabled,
        shape = RoundedCornerShape(18.dp),
        color = if (checked) LaiqColors.SurfaceTint else Color.White,
        border = BorderStroke(1.dp, if (checked) LaiqColors.BrandTeal.copy(alpha = 0.45f) else LaiqColors.PanelBorder),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Checkbox(
                checked = checked,
                enabled = enabled,
                onCheckedChange = onCheckedChange,
                colors = CheckboxDefaults.colors(
                    checkedColor = LaiqColors.BrandTeal,
                    uncheckedColor = LaiqColors.PanelBorder,
                    disabledCheckedColor = LaiqColors.PanelBorder,
                    disabledUncheckedColor = LaiqColors.PanelBorder,
                ),
            )
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    title,
                    style = MaterialTheme.typography.titleSmall,
                    color = if (enabled) LaiqColors.BodyText else LaiqColors.MutedText,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    detail,
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.MutedText,
                )
            }
        }
    }
}

private fun roofPresenceLabel(present: Boolean): String =
    if (present) "Present in general tank information" else "Not present in general tank information"

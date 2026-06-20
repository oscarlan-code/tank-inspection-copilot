package ai.laiq.tankinspection.presentation.v3product.elementsetup

import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.v3product.common.ProductStickyActionBar
import ai.laiq.tankinspection.presentation.v3product.common.ProductStickyActionBarHeight
import ai.laiq.tankinspection.v3product.model.ProductElementSetup
import ai.laiq.tankinspection.v3product.model.ProductGeneralTankInfo
import ai.laiq.tankinspection.v3product.model.ProductLayoutTarget
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.Composable

@Composable
fun ProductElementSetupScreen(
    generalTankInfo: ProductGeneralTankInfo,
    approvedLayoutTargets: List<ProductLayoutTarget>,
    state: ProductElementSetup,
    onStateChange: (ProductElementSetup) -> Unit,
    onBack: () -> Unit,
    onContinue: () -> Unit,
    contentPadding: PaddingValues = PaddingValues(0.dp),
) {
    val selectedTargets = state.selectedTargets().filter { target -> target in approvedLayoutTargets }

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
                    "Element Setup",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = LaiqColors.BrandTeal,
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
            }

        item {
            LaiqSectionCard(title = "Approved Layout Maps") {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    LaiqStatChip(
                        label = "Tank",
                        value = generalTankInfo.tankNumber.ifBlank { "Tank" },
                        modifier = Modifier.weight(1f),
                    )
                    LaiqStatChip(
                        label = "Layouts",
                        value = approvedLayoutTargets.size.toString(),
                        modifier = Modifier.weight(1f),
                    )
                }
                Text(
                    text = "Choose which approved layout maps will receive rough element placement.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = LaiqColors.MutedText,
                )
            }
        }

        item {
            LaiqSectionCard(title = "Add Elements To") {
                if (approvedLayoutTargets.isEmpty()) {
                    Text(
                        text = "No layout maps are approved yet. Go back and approve at least one layout.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = LaiqColors.BrandRed,
                    )
                } else {
                    approvedLayoutTargets.forEach { target ->
                        ElementTargetRow(
                            title = target.label,
                            detail = target.elementDetailLabel(),
                            checked = state.isTargetSelected(target),
                            onCheckedChange = { checked ->
                                onStateChange(state.withTargetSelected(target, checked))
                            },
                        )
                    }
                }
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
private fun ElementTargetRow(
    title: String,
    detail: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Surface(
        onClick = { onCheckedChange(!checked) },
        shape = RoundedCornerShape(18.dp),
        color = if (checked) LaiqColors.SurfaceTint else Color.White,
        border = BorderStroke(
            1.dp,
            if (checked) LaiqColors.BrandTeal.copy(alpha = 0.45f) else LaiqColors.PanelBorder,
        ),
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
                onCheckedChange = onCheckedChange,
                colors = CheckboxDefaults.colors(
                    checkedColor = LaiqColors.BrandTeal,
                    uncheckedColor = LaiqColors.PanelBorder,
                ),
            )
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    color = LaiqColors.BodyText,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = detail,
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.MutedText,
                )
            }
        }
    }
}

private fun ProductElementSetup.isTargetSelected(target: ProductLayoutTarget): Boolean =
    when (target) {
        ProductLayoutTarget.EXTERNAL_ROOF -> externalRoof
        ProductLayoutTarget.INTERNAL_ROOF -> internalRoof
        ProductLayoutTarget.SHELL -> shell
        ProductLayoutTarget.FLOOR -> floor
    }

private fun ProductElementSetup.withTargetSelected(
    target: ProductLayoutTarget,
    selected: Boolean,
): ProductElementSetup =
    when (target) {
        ProductLayoutTarget.EXTERNAL_ROOF -> copy(externalRoof = selected)
        ProductLayoutTarget.INTERNAL_ROOF -> copy(internalRoof = selected)
        ProductLayoutTarget.SHELL -> copy(shell = selected)
        ProductLayoutTarget.FLOOR -> copy(floor = selected)
    }

private fun ProductLayoutTarget.elementDetailLabel(): String =
    when (this) {
        ProductLayoutTarget.EXTERNAL_ROOF -> "Place roof elements such as vents, manholes, drains, and platforms."
        ProductLayoutTarget.INTERNAL_ROOF -> "Place internal roof elements such as supports, seals, and floating roof details."
        ProductLayoutTarget.SHELL -> "Place shell elements such as nozzles, manholes, stairs, and datum references."
        ProductLayoutTarget.FLOOR -> "Place floor elements such as sump, floor references, and local features."
    }

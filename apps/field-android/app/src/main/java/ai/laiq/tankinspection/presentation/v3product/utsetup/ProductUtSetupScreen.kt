package ai.laiq.tankinspection.presentation.v3product.utsetup

import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.v3product.common.ProductStickyActionBar
import ai.laiq.tankinspection.presentation.v3product.common.ProductStickyActionBarHeight
import ai.laiq.tankinspection.v3product.model.ProductGeneralTankInfo
import ai.laiq.tankinspection.v3product.model.ProductLayoutTarget
import ai.laiq.tankinspection.v3product.model.ProductUtSetup
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
fun ProductUtSetupScreen(
    generalTankInfo: ProductGeneralTankInfo,
    approvedLayoutTargets: List<ProductLayoutTarget>,
    state: ProductUtSetup,
    onStateChange: (ProductUtSetup) -> Unit,
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
                    "UT Scope",
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
            }
        }

        item {
            LaiqSectionCard(title = "Layout Maps For UT") {
                if (approvedLayoutTargets.isEmpty()) {
                    Text(
                        text = "No layout maps are approved yet. Go back and approve at least one layout.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = LaiqColors.BrandRed,
                    )
                } else {
                    approvedLayoutTargets.forEach { target ->
                        UtTargetRow(
                            title = target.label,
                            detail = target.utDetailLabel(),
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
private fun UtTargetRow(
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

private fun ProductUtSetup.isTargetSelected(target: ProductLayoutTarget): Boolean =
    when (target) {
        ProductLayoutTarget.EXTERNAL_ROOF -> externalRoof
        ProductLayoutTarget.INTERNAL_ROOF -> internalRoof
        ProductLayoutTarget.SHELL -> shell
        ProductLayoutTarget.FLOOR -> floor
    }

private fun ProductUtSetup.withTargetSelected(
    target: ProductLayoutTarget,
    selected: Boolean,
): ProductUtSetup =
    when (target) {
        ProductLayoutTarget.EXTERNAL_ROOF -> copy(externalRoof = selected)
        ProductLayoutTarget.INTERNAL_ROOF -> copy(internalRoof = selected)
        ProductLayoutTarget.SHELL -> copy(shell = selected)
        ProductLayoutTarget.FLOOR -> copy(floor = selected)
    }

private fun ProductLayoutTarget.utDetailLabel(): String =
    when (this) {
        ProductLayoutTarget.EXTERNAL_ROOF -> "Approved external roof layout map."
        ProductLayoutTarget.INTERNAL_ROOF -> "Approved internal roof layout map."
        ProductLayoutTarget.SHELL -> "Approved shell layout map."
        ProductLayoutTarget.FLOOR -> "Approved floor layout map."
    }

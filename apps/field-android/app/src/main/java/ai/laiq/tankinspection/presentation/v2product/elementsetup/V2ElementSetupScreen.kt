package ai.laiq.tankinspection.presentation.v2product.elementsetup

import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.v2product.model.V2ElementSetup
import ai.laiq.tankinspection.v2product.model.V2GeneralTankInfo
import ai.laiq.tankinspection.v2product.model.V2LayoutTarget
import ai.laiq.tankinspection.v2product.model.selectedTargets
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
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
fun V2ElementSetupScreen(
    generalTankInfo: V2GeneralTankInfo,
    approvedLayoutTargets: List<V2LayoutTarget>,
    state: V2ElementSetup,
    onStateChange: (V2ElementSetup) -> Unit,
    onBack: () -> Unit,
    onContinue: () -> Unit,
    contentPadding: PaddingValues = PaddingValues(0.dp),
) {
    val selectedTargets = state.selectedTargets().filter { target -> target in approvedLayoutTargets }

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

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                LaiqSecondaryButton(
                    text = "Back",
                    onClick = onBack,
                    modifier = Modifier.weight(1f),
                )
                LaiqPrimaryButton(
                    text = "Continue",
                    onClick = onContinue,
                    enabled = selectedTargets.isNotEmpty(),
                    modifier = Modifier.weight(1f),
                )
            }
        }
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

private fun V2ElementSetup.isTargetSelected(target: V2LayoutTarget): Boolean =
    when (target) {
        V2LayoutTarget.EXTERNAL_ROOF -> externalRoof
        V2LayoutTarget.INTERNAL_ROOF -> internalRoof
        V2LayoutTarget.SHELL -> shell
        V2LayoutTarget.FLOOR -> floor
    }

private fun V2ElementSetup.withTargetSelected(
    target: V2LayoutTarget,
    selected: Boolean,
): V2ElementSetup =
    when (target) {
        V2LayoutTarget.EXTERNAL_ROOF -> copy(externalRoof = selected)
        V2LayoutTarget.INTERNAL_ROOF -> copy(internalRoof = selected)
        V2LayoutTarget.SHELL -> copy(shell = selected)
        V2LayoutTarget.FLOOR -> copy(floor = selected)
    }

private fun V2LayoutTarget.elementDetailLabel(): String =
    when (this) {
        V2LayoutTarget.EXTERNAL_ROOF -> "Place roof elements such as vents, manholes, drains, and platforms."
        V2LayoutTarget.INTERNAL_ROOF -> "Place internal roof elements such as supports, seals, and floating roof details."
        V2LayoutTarget.SHELL -> "Place shell elements such as nozzles, manholes, stairs, and datum references."
        V2LayoutTarget.FLOOR -> "Place floor elements such as sump, floor references, and local features."
    }

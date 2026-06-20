package ai.laiq.tankinspection.presentation.v3product.common

import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

val ProductStickyActionBarHeight = 104.dp

@Composable
fun ProductStickyActionBar(
    primaryText: String,
    onPrimaryClick: () -> Unit,
    modifier: Modifier = Modifier,
    secondaryText: String = "Back",
    onSecondaryClick: () -> Unit,
    primaryEnabled: Boolean = true,
    secondaryEnabled: Boolean = true,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = Color.White.copy(alpha = 0.98f),
        shadowElevation = 10.dp,
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LaiqSecondaryButton(
                text = secondaryText,
                onClick = onSecondaryClick,
                enabled = secondaryEnabled,
                modifier = Modifier.weight(1f),
            )
            LaiqPrimaryButton(
                text = primaryText,
                onClick = onPrimaryClick,
                enabled = primaryEnabled,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
fun ProductCollapsibleSectionCard(
    title: String,
    expanded: Boolean,
    onExpandedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    summary: String? = null,
    subtitle: String? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(24.dp),
        color = Color.White,
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
        shadowElevation = 2.dp,
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(3.dp),
                ) {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleMedium,
                        color = LaiqColors.BrandTeal,
                        fontWeight = FontWeight.SemiBold,
                    )
                    if (!summary.isNullOrBlank()) {
                        Text(
                            text = summary,
                            style = MaterialTheme.typography.bodySmall,
                            color = LaiqColors.BodyText,
                        )
                    } else if (!subtitle.isNullOrBlank()) {
                        Text(
                            text = subtitle,
                            style = MaterialTheme.typography.bodySmall,
                            color = LaiqColors.MutedText,
                        )
                    }
                }
                TextButton(onClick = { onExpandedChange(!expanded) }) {
                    Text(if (expanded) "Hide" else "Edit")
                }
            }
            if (expanded) {
                content()
            }
        }
    }
}

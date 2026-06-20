package ai.laiq.tankinspection.presentation.v3product.common

import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.v3product.model.ProductDownstreamDataImpact
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.font.FontWeight

@Composable
fun ProductDownstreamDataWarningDialog(
    impact: ProductDownstreamDataImpact,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = impact.title,
                color = LaiqColors.BrandRed,
                fontWeight = FontWeight.SemiBold,
            )
        },
        text = {
            Text(
                text = impact.message,
                style = MaterialTheme.typography.bodyMedium,
                color = LaiqColors.BodyText,
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text("Clear And Continue")
            }
        },
    )
}

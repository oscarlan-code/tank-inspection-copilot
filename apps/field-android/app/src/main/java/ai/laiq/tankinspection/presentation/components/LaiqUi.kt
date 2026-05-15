package ai.laiq.tankinspection.presentation.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp

object LaiqColors {
    val BrandRed = Color(0xFFD63B3B)
    val BrandTeal = Color(0xFF173B7A)
    val AccentOrange = Color(0xFF4A67A3)
    val SurfaceTint = Color(0xFFF5F7FB)
    val PanelBorder = Color(0xFFD8DFEB)
    val StatusReady = Color(0xFF173B7A)
    val StatusDraft = Color(0xFF77839A)
    val StatusWarning = Color(0xFFD63B3B)
    val StatusInfo = Color(0xFF4A67A3)
    val MutedText = Color(0xFF66758C)
    val BodyText = Color(0xFF1E2C3F)
}

@Composable
fun LaiqFieldTheme(content: @Composable () -> Unit) {
    val colorScheme = lightColorScheme(
        primary = LaiqColors.BrandRed,
        onPrimary = Color.White,
        secondary = LaiqColors.BrandTeal,
        onSecondary = Color.White,
        tertiary = LaiqColors.AccentOrange,
        background = Color(0xFFF8F9FC),
        surface = Color.White,
        surfaceVariant = LaiqColors.SurfaceTint,
        outline = LaiqColors.PanelBorder,
    )
    MaterialTheme(
        colorScheme = colorScheme,
        typography = MaterialTheme.typography,
        content = content,
    )
}

@Composable
fun LaiqSectionCard(
    title: String,
    subtitle: String? = null,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = LaiqColors.BrandTeal,
                )
                if (!subtitle.isNullOrBlank()) {
                    Text(
                        subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                }
            }
            content()
        }
    }
}

@Composable
fun LaiqPrimaryButton(
    text: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
    modifier: Modifier = Modifier,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = ButtonDefaults.buttonColors(containerColor = LaiqColors.BrandRed),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 14.dp),
    ) {
        Text(text, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun LaiqSecondaryButton(
    text: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
    modifier: Modifier = Modifier,
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 14.dp),
    ) {
        Text(text, color = LaiqColors.BrandTeal, fontWeight = FontWeight.Medium)
    }
}

@Composable
fun LaiqStatChip(
    label: String,
    value: String,
    tone: Color = LaiqColors.BrandTeal,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier,
        color = Color.White,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = LaiqColors.MutedText)
            Text(value, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = tone)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun LaiqOptionChips(
    selectedValue: String,
    options: List<Pair<String, String>>,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    FlowRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        options.forEach { (value, label) ->
            val selected = selectedValue == value
            Surface(
                onClick = { onSelect(value) },
                shape = RoundedCornerShape(18.dp),
                color = if (selected) LaiqColors.BrandTeal else Color.White,
                border = BorderStroke(1.dp, if (selected) LaiqColors.BrandTeal else LaiqColors.PanelBorder),
            ) {
                Text(
                    label,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                    color = if (selected) Color.White else LaiqColors.BodyText,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
                )
            }
        }
    }
}

@Composable
fun LaiqDropdownField(
    label: String,
    value: String,
    options: List<Pair<String, String>>,
    onSelected: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = options.firstOrNull { it.first == value }?.second.orEmpty()

    Box(modifier = modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = selectedLabel,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            shape = RoundedCornerShape(18.dp),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Surface(
            onClick = { expanded = true },
            color = Color.Transparent,
            modifier = Modifier.matchParentSize(),
        ) {}
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
        ) {
            options.forEach { (optionValue, optionLabel) ->
                DropdownMenuItem(
                    text = { Text(optionLabel) },
                    onClick = {
                        onSelected(optionValue)
                        expanded = false
                    },
                )
            }
        }
    }
}

fun laiqCountOptions(max: Int = 40): List<Pair<String, String>> =
    (1..max.coerceAtLeast(1)).map { count -> count.toString() to count.toString() }

@Composable
fun LaiqCountField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    min: Int = 0,
    max: Int = 20,
    modifier: Modifier = Modifier,
) {
    val normalizedMin = min.coerceAtLeast(0)
    val normalizedMax = max.coerceAtLeast(normalizedMin)
    val normalizedValue = value.toIntOrNull()
    var manualEntryMode by rememberSaveable(label) { mutableStateOf(false) }

    LaunchedEffect(value, normalizedMin, normalizedMax) {
        if (!manualEntryMode) return@LaunchedEffect
        val parsed = value.toIntOrNull()
        if (value.isNotBlank() && parsed != null && parsed in normalizedMin..normalizedMax) {
            // Keep manual mode active so values like 25 can be typed without the field collapsing after "2".
            return@LaunchedEffect
        }
    }

    val usesOther = manualEntryMode || value.isBlank() || normalizedValue == null || normalizedValue !in normalizedMin..normalizedMax

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        LaiqDropdownField(
            label = label,
            value = if (usesOther) "__other__" else value,
            options = (normalizedMin..normalizedMax).map { count -> count.toString() to count.toString() } +
                listOf("__other__" to "Other"),
            onSelected = { selected ->
                manualEntryMode = selected == "__other__"
                onValueChange(if (selected == "__other__") "" else selected)
            },
        )
        if (usesOther) {
            val focusManager = LocalFocusManager.current
            OutlinedTextField(
                value = value,
                onValueChange = {
                    manualEntryMode = true
                    onValueChange(it.filter(Char::isDigit))
                },
                label = { Text("Other $label") },
                shape = RoundedCornerShape(18.dp),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions.Default.copy(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() }),
            )
        }
    }
}

@Composable
fun LaiqTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: @Composable (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(18.dp),
    singleLine: Boolean = true,
    readOnly: Boolean = false,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
) {
    val focusManager = LocalFocusManager.current
    val resolvedKeyboardOptions = if (singleLine) {
        keyboardOptions.copy(imeAction = ImeAction.Done)
    } else {
        keyboardOptions
    }

    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        readOnly = readOnly,
        label = label,
        shape = shape,
        singleLine = singleLine,
        modifier = modifier,
        keyboardOptions = resolvedKeyboardOptions,
        keyboardActions = KeyboardActions(
            onDone = { focusManager.clearFocus() },
        ),
    )
}

@Composable
fun LaiqLabeledValue(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = LaiqColors.MutedText)
        Text(value, style = MaterialTheme.typography.bodyMedium, color = LaiqColors.BodyText)
    }
}

@Composable
fun LaiqStatusBadge(
    text: String,
    tone: Color,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        color = tone.copy(alpha = 0.12f),
        border = BorderStroke(1.dp, tone.copy(alpha = 0.28f)),
    ) {
        Text(
            text,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            style = MaterialTheme.typography.labelMedium,
            color = tone,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
fun LaiqPlacementAdjustPad(
    enabled: Boolean,
    onUp: () -> Unit,
    onDown: () -> Unit,
    onLeft: () -> Unit,
    onRight: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier,
        color = Color.White,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text("Adjust", style = MaterialTheme.typography.labelMedium, color = LaiqColors.MutedText)
            LaiqPlacementDirectionButton("↑", enabled, onUp)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                LaiqPlacementDirectionButton("←", enabled, onLeft)
                LaiqPlacementDirectionButton("→", enabled, onRight)
            }
            LaiqPlacementDirectionButton("↓", enabled, onDown)
        }
    }
}

@Composable
private fun LaiqPlacementDirectionButton(
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Surface(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.size(38.dp),
        color = Color.White,
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, if (enabled) LaiqColors.PanelBorder else LaiqColors.PanelBorder.copy(alpha = 0.45f)),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                label,
                style = MaterialTheme.typography.titleMedium,
                color = if (enabled) LaiqColors.BrandTeal else LaiqColors.MutedText,
            )
        }
    }
}

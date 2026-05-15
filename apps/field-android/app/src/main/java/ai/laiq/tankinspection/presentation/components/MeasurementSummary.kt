package ai.laiq.tankinspection.presentation.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.util.Locale

data class MeasurementStats(
    val min: Double,
    val max: Double,
    val average: Double,
)

fun measurementStatsFromInput(readings: List<String>): MeasurementStats? =
    readings
        .mapNotNull { reading -> reading.trim().takeIf { it.isNotEmpty() }?.toDoubleOrNull() }
        .takeIf { values -> values.isNotEmpty() }
        ?.let { values -> measurementStatsFromValues(values) }

fun measurementStatsFromValues(readings: List<Double>): MeasurementStats? {
    if (readings.isEmpty()) return null
    val min = readings.minOrNull() ?: return null
    val max = readings.maxOrNull() ?: return null
    val average = readings.average()
    return MeasurementStats(
        min = min,
        max = max,
        average = average,
    )
}

@Composable
fun MeasurementStatsRow(
    stats: MeasurementStats,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        LaiqStatChip(
            label = "Min",
            value = formatMeasurementStat(stats.min),
            modifier = Modifier.weight(1f),
        )
        LaiqStatChip(
            label = "Avg",
            value = formatMeasurementStat(stats.average),
            tone = LaiqColors.AccentOrange,
            modifier = Modifier.weight(1f),
        )
        LaiqStatChip(
            label = "Max",
            value = formatMeasurementStat(stats.max),
            modifier = Modifier.weight(1f),
        )
    }
}

private fun formatMeasurementStat(value: Double): String =
    String.format(Locale.US, "%.2f", value)
        .trimEnd('0')
        .trimEnd('.')

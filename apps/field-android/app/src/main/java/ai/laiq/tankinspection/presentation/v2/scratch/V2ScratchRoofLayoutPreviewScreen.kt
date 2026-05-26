package ai.laiq.tankinspection.presentation.v2.scratch

import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.components.LaiqStatusBadge
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

private data class PreviewMarker(
    val shortLabel: String,
    val detail: String,
    val x: Float,
    val y: Float,
    val tone: Color,
)

private data class LayerPreview(
    val label: String,
    val detail: String,
    val count: Int,
    val tone: Color,
)

@Composable
fun V2ScratchRoofLayoutPreviewScreen(
    onBack: () -> Unit,
    contentPadding: PaddingValues = PaddingValues(0.dp),
) {
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
            V2PreviewHeroCard()
        }

        item {
            V2PreviewWorkspace()
        }

        item {
            V2WorkflowNotesCard()
        }

        item {
            LaiqSecondaryButton(
                text = "Close Preview",
                onClick = onBack,
            )
        }
    }
}

@Composable
private fun V2PreviewHeroCard() {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(28.dp),
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        "V2 Roof Layout Workspace",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = LaiqColors.BrandTeal,
                    )
                    Text(
                        "UI-only preview. One screen for one surface, one job: define the roof map, review rough layers, and leave UT for later.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = LaiqColors.BodyText,
                    )
                }
                LaiqStatusBadge("Preview Only", LaiqColors.AccentOrange)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LaiqStatChip("Surface", "Roof", modifier = Modifier.weight(1f))
                LaiqStatChip("Map", "Large", tone = LaiqColors.AccentOrange, modifier = Modifier.weight(1f))
                LaiqStatChip("Cursor", "Removed", tone = LaiqColors.StatusDraft, modifier = Modifier.weight(1f))
            }
            V2PillRow(
                pills = listOf(
                    "General tank information stays separate",
                    "Roof, shell, and floor get different screens",
                    "Element placement stays separate from UT",
                ),
            )
        }
    }
}

@Composable
private fun V2PreviewWorkspace() {
    BoxWithConstraints {
        val wideLayout = maxWidth >= 920.dp

        if (wideLayout) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Column(
                    modifier = Modifier.weight(1.65f),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    V2SurfaceFrameCard()
                    V2LargeRoofMapCard()
                }
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    V2ElementPaletteCard()
                    V2LayerStackCard()
                }
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                V2SurfaceFrameCard()
                V2LargeRoofMapCard()
                V2ElementPaletteCard()
                V2LayerStackCard()
            }
        }
    }
}

@Composable
private fun V2SurfaceFrameCard() {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(24.dp),
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                "Surface Flow",
                style = MaterialTheme.typography.titleMedium,
                color = LaiqColors.BrandTeal,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                "Each surface gets its own workspace. This preview starts with the roof so the map can stay large and uncluttered.",
                style = MaterialTheme.typography.bodySmall,
                color = LaiqColors.MutedText,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                V2SurfaceChip("Shell", selected = false)
                V2SurfaceChip("Roof", selected = true)
                V2SurfaceChip("Floor", selected = false)
            }
        }
    }
}

@Composable
private fun V2SurfaceChip(
    label: String,
    selected: Boolean,
) {
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = if (selected) LaiqColors.BrandTeal else Color.White,
        border = BorderStroke(1.dp, if (selected) LaiqColors.BrandTeal else LaiqColors.PanelBorder),
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
            color = if (selected) Color.White else LaiqColors.BodyText,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
        )
    }
}

@Composable
private fun V2LargeRoofMapCard() {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(28.dp),
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        "Roof Layout Map",
                        style = MaterialTheme.typography.titleMedium,
                        color = LaiqColors.BrandTeal,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        "The map owns the screen first. Inputs and layer controls sit outside the canvas instead of squeezing it.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                }
                LaiqStatusBadge("No Cursor", LaiqColors.StatusDraft)
            }

            BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
                val mapWidth = maxWidth
                val mapHeight = if (mapWidth >= 700.dp) 620.dp else 460.dp
                val markers = remember {
                    listOf(
                        PreviewMarker("MH", "Manhole", 0.50f, 0.17f, LaiqColors.BrandRed),
                        PreviewMarker("ST", "Staircase", 0.82f, 0.62f, LaiqColors.AccentOrange),
                        PreviewMarker("NZ", "Nozzle Layer", 0.22f, 0.52f, LaiqColors.BrandTeal),
                        PreviewMarker("VENT", "Vent", 0.69f, 0.27f, Color(0xFF3F7B5F)),
                        PreviewMarker("DRAIN", "Drain", 0.38f, 0.80f, Color(0xFF7A5C1A)),
                    )
                }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(mapHeight)
                        .clip(RoundedCornerShape(26.dp))
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(Color(0xFFF9FCFF), Color(0xFFEAF0F8)),
                            ),
                        )
                        .border(
                            width = 1.dp,
                            color = LaiqColors.PanelBorder,
                            shape = RoundedCornerShape(26.dp),
                        ),
                ) {
                    Canvas(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(22.dp),
                    ) {
                        val shortestSide = min(size.width, size.height)
                        val center = Offset(size.width / 2f, size.height / 2f)
                        val outerRadius = shortestSide * 0.41f
                        val ringRadius = outerRadius * 0.77f
                        val centerOpeningRadius = outerRadius * 0.17f
                        val gridColor = LaiqColors.BrandTeal.copy(alpha = 0.11f)
                        val lineColor = LaiqColors.BrandTeal.copy(alpha = 0.26f)
                        val boldColor = LaiqColors.BrandTeal.copy(alpha = 0.4f)

                        repeat(5) { ringIndex ->
                            val ratio = 1f - (ringIndex * 0.15f)
                            drawCircle(
                                color = gridColor,
                                radius = outerRadius * ratio,
                                style = Stroke(width = if (ringIndex == 0) 5f else 2f),
                                center = center,
                            )
                        }

                        repeat(12) { spokeIndex ->
                            val angle = (spokeIndex * 30.0 - 90.0) * (Math.PI / 180.0)
                            val start = Offset(
                                x = center.x + (centerOpeningRadius * cos(angle)).toFloat(),
                                y = center.y + (centerOpeningRadius * sin(angle)).toFloat(),
                            )
                            val end = Offset(
                                x = center.x + (outerRadius * cos(angle)).toFloat(),
                                y = center.y + (outerRadius * sin(angle)).toFloat(),
                            )
                            drawLine(
                                color = if (spokeIndex % 3 == 0) boldColor else lineColor,
                                start = start,
                                end = end,
                                strokeWidth = if (spokeIndex % 3 == 0) 4f else 2f,
                            )
                        }

                        drawCircle(
                            color = Color(0xFFDDE6F3),
                            radius = centerOpeningRadius * 0.68f,
                            center = center,
                        )

                        drawCircle(
                            color = LaiqColors.BrandTeal.copy(alpha = 0.52f),
                            radius = outerRadius,
                            center = center,
                            style = Stroke(width = 6f),
                        )

                        drawCircle(
                            color = LaiqColors.BrandTeal.copy(alpha = 0.22f),
                            radius = ringRadius,
                            center = center,
                            style = Stroke(width = 6f),
                        )
                    }

                    V2MapCornerBadge(
                        title = "Tank North",
                        detail = "0° reference",
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(16.dp),
                    )

                    V2MapCornerBadge(
                        title = "Layers",
                        detail = "No sizes here",
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(16.dp),
                    )

                    markers.forEach { marker ->
                        V2MapMarkerBadge(
                            marker = marker,
                            xOffset = mapWidth * marker.x,
                            yOffset = mapHeight * marker.y,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun V2MapCornerBadge(
    title: String,
    detail: String,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier,
        color = Color.White.copy(alpha = 0.94f),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                title,
                style = MaterialTheme.typography.labelLarge,
                color = LaiqColors.BodyText,
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

@Composable
private fun V2MapMarkerBadge(
    marker: PreviewMarker,
    xOffset: Dp,
    yOffset: Dp,
) {
    Surface(
        modifier = Modifier.offset(
            x = xOffset - 42.dp,
            y = yOffset - 20.dp,
        ),
        color = Color.White,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, marker.tone.copy(alpha = 0.32f)),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .background(marker.tone, CircleShape),
            )
            Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(
                    marker.shortLabel,
                    style = MaterialTheme.typography.labelLarge,
                    color = LaiqColors.BodyText,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    marker.detail,
                    style = MaterialTheme.typography.labelSmall,
                    color = LaiqColors.MutedText,
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun V2ElementPaletteCard() {
    val paletteItems = listOf("Nozzle", "Manhole", "Staircase", "Vent", "Drain", "Platform")

    Surface(
        color = Color.White,
        shape = RoundedCornerShape(24.dp),
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                "Element Palette",
                style = MaterialTheme.typography.titleMedium,
                color = LaiqColors.BrandTeal,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                "Rough placement only in V2. No size, thickness, or UT entry belongs in this step.",
                style = MaterialTheme.typography.bodySmall,
                color = LaiqColors.MutedText,
            )
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                paletteItems.forEach { item ->
                    Surface(
                        color = LaiqColors.SurfaceTint,
                        shape = RoundedCornerShape(18.dp),
                        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
                    ) {
                        Text(
                            text = item,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                            style = MaterialTheme.typography.labelLarge,
                            color = LaiqColors.BodyText,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun V2LayerStackCard() {
    val layers = remember {
        listOf(
            LayerPreview("Nozzle Layer", "Grouped by type, not by UT yet", 4, LaiqColors.BrandTeal),
            LayerPreview("Manhole Layer", "Rough top openings only", 2, LaiqColors.BrandRed),
            LayerPreview("Access Layer", "Staircase and platform", 2, LaiqColors.AccentOrange),
            LayerPreview("Vent / Drain Layer", "Utility fittings", 3, Color(0xFF3F7B5F)),
        )
    }

    Surface(
        color = Color.White,
        shape = RoundedCornerShape(24.dp),
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                "Layer Stack",
                style = MaterialTheme.typography.titleMedium,
                color = LaiqColors.BrandTeal,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                "The user adds and reviews one layer type at a time instead of mixing registration with measurements.",
                style = MaterialTheme.typography.bodySmall,
                color = LaiqColors.MutedText,
            )
            layers.forEach { layer ->
                Surface(
                    color = layer.tone.copy(alpha = 0.08f),
                    shape = RoundedCornerShape(18.dp),
                    border = BorderStroke(1.dp, layer.tone.copy(alpha = 0.24f)),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(12.dp)
                                .background(layer.tone, CircleShape),
                        )
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(2.dp),
                        ) {
                            Text(
                                layer.label,
                                style = MaterialTheme.typography.bodyMedium,
                                color = LaiqColors.BodyText,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                layer.detail,
                                style = MaterialTheme.typography.bodySmall,
                                color = LaiqColors.MutedText,
                            )
                        }
                        Surface(
                            color = Color.White,
                            shape = RoundedCornerShape(14.dp),
                            border = BorderStroke(1.dp, layer.tone.copy(alpha = 0.25f)),
                        ) {
                            Text(
                                text = layer.count.toString(),
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                style = MaterialTheme.typography.labelLarge,
                                color = layer.tone,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun V2WorkflowNotesCard() {
    val notes = listOf(
        "Keep General Tank Information on its own screen using physical PDF page 1 / labeled page 4 only.",
        "Use roof, shell, and floor as separate map screens so the map can stay large and readable.",
        "Register rough elements on the map first, then capture UT in separate task screens.",
        "Support findings from either UT or a dedicated map-first findings section later.",
    )

    Surface(
        color = Color.White,
        shape = RoundedCornerShape(24.dp),
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                "Why This Screen Is Split",
                style = MaterialTheme.typography.titleMedium,
                color = LaiqColors.BrandTeal,
                fontWeight = FontWeight.SemiBold,
            )
            notes.forEachIndexed { index, note ->
                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    Surface(
                        modifier = Modifier.width(26.dp),
                        color = LaiqColors.BrandTeal.copy(alpha = 0.1f),
                        shape = RoundedCornerShape(13.dp),
                        border = BorderStroke(1.dp, LaiqColors.BrandTeal.copy(alpha = 0.18f)),
                    ) {
                        Text(
                            text = (index + 1).toString(),
                            modifier = Modifier.padding(vertical = 4.dp),
                            style = MaterialTheme.typography.labelMedium,
                            color = LaiqColors.BrandTeal,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    Text(
                        text = note,
                        modifier = Modifier.weight(1f),
                        style = MaterialTheme.typography.bodyMedium,
                        color = LaiqColors.BodyText,
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun V2PillRow(
    pills: List<String>,
) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        pills.forEach { pill ->
            Surface(
                color = LaiqColors.SurfaceTint,
                shape = RoundedCornerShape(18.dp),
                border = BorderStroke(1.dp, LaiqColors.PanelBorder),
            ) {
                Text(
                    text = pill,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.BodyText,
                )
            }
        }
    }
}

package ai.laiq.tankinspection.presentation.v2product.finding

import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqOptionChips
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqTextField
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.v2product.model.V2AnnotationPoint
import ai.laiq.tankinspection.v2product.model.V2AnnotationStroke
import ai.laiq.tankinspection.v2product.model.V2FindingPhoto
import ai.laiq.tankinspection.v2product.model.V2FindingRecord
import ai.laiq.tankinspection.v2product.model.hasCapturedEvidence
import ai.laiq.tankinspection.v2product.model.withPhotoAnnotations
import ai.laiq.tankinspection.v2product.model.withRemovedPhoto
import ai.laiq.tankinspection.v2product.model.withSelectedPhoto
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.io.File

private val quickFindingNotes = listOf(
    "External corrosion",
    "Pitting",
    "Coating breakdown",
    "Crack indication",
    "Weld defect",
    "Mechanical damage",
    "Product staining",
    "Water-side corrosion",
)

@Composable
fun V2FindingCaptureScreen(
    record: V2FindingRecord,
    allFindings: List<V2FindingRecord> = emptyList(),
    imageRootDir: File,
    onRecordChange: (V2FindingRecord) -> Unit,
    onSelectFinding: (V2FindingRecord) -> Unit = {},
    onDeleteFinding: (V2FindingRecord) -> Unit = {},
    onTakePhoto: () -> Unit,
    onRetakePhoto: (V2FindingPhoto) -> Unit = {},
    onImportPhoto: () -> Unit,
    onBack: () -> Unit,
    contentPadding: PaddingValues = PaddingValues(0.dp),
) {
    val latestRecord by rememberUpdatedState(record)
    val selectedPhoto = record.photos.firstOrNull { photo -> photo.id == record.selectedPhotoId }
        ?: record.photos.lastOrNull()
    val locationFindings = if (record.hasCapturedEvidence()) {
        emptyList()
    } else {
        allFindings.filter { finding ->
            finding.itemKey == record.itemKey && finding.hasCapturedEvidence()
        }
    }
    var reviewExpanded by remember(record.itemKey) { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<V2FindingRecord?>(null) }

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
                text = "Finding",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.SemiBold,
                color = LaiqColors.BrandTeal,
                modifier = Modifier.padding(horizontal = 4.dp),
            )
        }

        item {
            LaiqSectionCard(title = "Linked Location") {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    LaiqStatChip(
                        label = "Layout",
                        value = record.target.label,
                        modifier = Modifier.weight(1f),
                    )
                    LaiqStatChip(
                        label = "Region",
                        value = record.itemLabel,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }

        item {
            LaiqSectionCard(
                title = "Photos",
                subtitle = "Take or import multiple photos. Draw directly on the selected photo to annotate.",
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    LaiqPrimaryButton(
                        text = "Add Photo",
                        onClick = onTakePhoto,
                        modifier = Modifier.weight(1f),
                    )
                    LaiqSecondaryButton(
                        text = "Import Photo",
                        onClick = onImportPhoto,
                        modifier = Modifier.weight(1f),
                    )
                }

                if (record.photos.isNotEmpty()) {
                    LaiqOptionChips(
                        selectedValue = selectedPhoto?.id.orEmpty(),
                        options = record.photos.mapIndexed { index, photo -> photo.id to "Photo ${index + 1}" },
                        onSelect = { photoId ->
                            onRecordChange(latestRecord.withSelectedPhoto(photoId))
                        },
                    )
                }

                if (selectedPhoto == null) {
                    EmptyPhotoPanel()
                } else {
                    AnnotatablePhoto(
                        photo = selectedPhoto,
                        imageRootDir = imageRootDir,
                        onAnnotationChange = { strokes ->
                            onRecordChange(latestRecord.withPhotoAnnotations(selectedPhoto.id, strokes))
                        },
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        LaiqSecondaryButton(
                            text = "Clear Annotation",
                            onClick = {
                                onRecordChange(latestRecord.withPhotoAnnotations(selectedPhoto.id, emptyList()))
                            },
                            modifier = Modifier.weight(1f),
                        )
                        LaiqSecondaryButton(
                            text = "Retake",
                            onClick = { onRetakePhoto(selectedPhoto) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    LaiqSecondaryButton(
                        text = "Remove Photo",
                        onClick = {
                            onRecordChange(latestRecord.withRemovedPhoto(selectedPhoto.id))
                        },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }

        item {
            LaiqSectionCard(title = "Notes") {
                Text(
                    text = "Quick degradation items",
                    style = MaterialTheme.typography.labelLarge,
                    color = LaiqColors.BodyText,
                    fontWeight = FontWeight.SemiBold,
                )
                LaiqOptionChips(
                    selectedValue = "",
                    options = quickFindingNotes.map { note -> note to note },
                    onSelect = { note ->
                        val existing = latestRecord.note.trim()
                        val next = if (existing.isBlank()) note else "$existing; $note"
                        onRecordChange(latestRecord.copy(note = next))
                    },
                )
                LaiqTextField(
                    value = record.note,
                    onValueChange = { onRecordChange(latestRecord.copy(note = it)) },
                    label = { Text("Finding note") },
                    singleLine = false,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(132.dp),
                )
            }
        }

        if (locationFindings.isNotEmpty()) {
            item {
                PreviousFindingsStrip(
                    findings = locationFindings,
                    expanded = reviewExpanded,
                    onExpandedChange = { expanded -> reviewExpanded = expanded },
                    onSelectFinding = onSelectFinding,
                    onDeleteFinding = { finding -> deleteTarget = finding },
                )
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                LaiqSecondaryButton(
                    text = "Close",
                    onClick = onBack,
                    modifier = Modifier.weight(1f),
                )
                LaiqPrimaryButton(
                    text = "Done",
                    onClick = onBack,
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }

    deleteTarget?.let { finding ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete Finding?") },
            text = {
                Text(
                    text = "This removes notes and photos for ${finding.itemLabel}.",
                    color = LaiqColors.BodyText,
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        deleteTarget = null
                        onDeleteFinding(finding)
                    },
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) {
                    Text("Cancel")
                }
            },
        )
    }
}

@Composable
private fun PreviousFindingsStrip(
    findings: List<V2FindingRecord>,
    expanded: Boolean,
    onExpandedChange: (Boolean) -> Unit,
    onSelectFinding: (V2FindingRecord) -> Unit,
    onDeleteFinding: (V2FindingRecord) -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = LaiqColors.SurfaceTint,
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Text(
                        text = "Saved Finding For This Location",
                        style = MaterialTheme.typography.titleSmall,
                        color = LaiqColors.BodyText,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = "Only records linked to this clicked plate or element are shown.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                }
                OutlinedButton(
                    onClick = { onExpandedChange(!expanded) },
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, LaiqColors.PanelBorder),
                    modifier = Modifier.widthIn(min = 88.dp),
                ) {
                    Text(
                    text = if (expanded) "Hide" else "Preview",
                        color = LaiqColors.BrandTeal,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }

            if (expanded) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    findings.forEach { finding ->
                        FindingPreviewRow(
                            finding = finding,
                            onSelectFinding = onSelectFinding,
                            onDeleteFinding = onDeleteFinding,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun FindingPreviewRow(
    finding: V2FindingRecord,
    onSelectFinding: (V2FindingRecord) -> Unit,
    onDeleteFinding: (V2FindingRecord) -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = Color.White,
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Column(
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = "${finding.target.label} - ${finding.itemLabel}",
                    style = MaterialTheme.typography.titleSmall,
                    color = LaiqColors.BodyText,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = "${finding.photos.size} photo(s) - ${finding.note.ifBlank { "No note yet" }}",
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.MutedText,
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                LaiqSecondaryButton(
                    text = "Preview",
                    onClick = { onSelectFinding(finding) },
                    modifier = Modifier.weight(1f),
                )
                LaiqSecondaryButton(
                    text = "Delete",
                    onClick = { onDeleteFinding(finding) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun EmptyPhotoPanel() {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = LaiqColors.SurfaceTint,
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
        modifier = Modifier
            .fillMaxWidth()
            .height(220.dp),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                text = "No photo yet",
                style = MaterialTheme.typography.titleMedium,
                color = LaiqColors.MutedText,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun AnnotatablePhoto(
    photo: V2FindingPhoto,
    imageRootDir: File,
    onAnnotationChange: (List<V2AnnotationStroke>) -> Unit,
) {
    val latestPhoto by rememberUpdatedState(photo)
    var canvasSize by remember(photo.id) { mutableStateOf(Size.Zero) }
    var activeStroke by remember(photo.id) { mutableStateOf<List<V2AnnotationPoint>>(emptyList()) }
    val imageFile = remember(photo.relativePath) { File(imageRootDir, photo.relativePath) }
    val bitmap = remember(photo.relativePath, imageFile.lastModified()) {
        decodePreviewBitmap(imageFile)
    }

    Surface(
        shape = RoundedCornerShape(20.dp),
        color = Color.White,
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(360.dp)
                .background(LaiqColors.SurfaceTint)
                .onSizeChanged { size ->
                    canvasSize = Size(size.width.toFloat(), size.height.toFloat())
                }
                .pointerInput(photo.id, canvasSize, bitmap?.width, bitmap?.height) {
                    detectDragGestures(
                        onDragStart = { offset ->
                            activeStroke = listOf(offset.toAnnotationPoint(canvasSize, bitmap))
                        },
                        onDrag = { change, _ ->
                            activeStroke = activeStroke + change.position.toAnnotationPoint(canvasSize, bitmap)
                        },
                        onDragEnd = {
                            if (activeStroke.size >= 2) {
                                onAnnotationChange(latestPhoto.annotationStrokes + V2AnnotationStroke(activeStroke))
                            }
                            activeStroke = emptyList()
                        },
                        onDragCancel = {
                            activeStroke = emptyList()
                        },
                    )
                },
        ) {
            if (bitmap == null) {
                Text(
                    text = "Photo file unavailable",
                    style = MaterialTheme.typography.bodyMedium,
                    color = LaiqColors.BrandRed,
                    modifier = Modifier.align(Alignment.Center),
                )
            } else {
                Image(
                    bitmap = bitmap.asImageBitmap(),
                    contentDescription = photo.displayName,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxSize(),
                )
            }

            Canvas(modifier = Modifier.fillMaxSize()) {
                (photo.annotationStrokes + V2AnnotationStroke(activeStroke).takeIf { activeStroke.size >= 2 })
                    .filterNotNull()
                    .forEach { stroke ->
                        stroke.points.zipWithNext().forEach { (from, to) ->
                            drawLine(
                                color = LaiqColors.BrandRed,
                                start = from.toOffset(size, bitmap),
                                end = to.toOffset(size, bitmap),
                                strokeWidth = 5.dp.toPx(),
                            )
                        }
                    }
            }

            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(12.dp)
                    .size(12.dp)
                    .background(LaiqColors.BrandRed, CircleShape),
            )
        }
    }
}

private fun decodePreviewBitmap(file: File, maxDimension: Int = 2048): Bitmap? {
    if (!file.exists() || file.length() <= 0L) return null
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.absolutePath, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    val sampleSize = calculateSampleSize(
        width = bounds.outWidth,
        height = bounds.outHeight,
        maxDimension = maxDimension,
    )
    return BitmapFactory.decodeFile(
        file.absolutePath,
        BitmapFactory.Options().apply {
            inSampleSize = sampleSize
            inPreferredConfig = Bitmap.Config.RGB_565
        },
    )
}

private fun calculateSampleSize(
    width: Int,
    height: Int,
    maxDimension: Int,
): Int {
    var sampleSize = 1
    var nextWidth = width / 2
    var nextHeight = height / 2
    while (nextWidth / sampleSize >= maxDimension || nextHeight / sampleSize >= maxDimension) {
        sampleSize *= 2
    }
    return sampleSize.coerceAtLeast(1)
}

private fun Offset.toAnnotationPoint(
    containerSize: Size,
    bitmap: Bitmap?,
): V2AnnotationPoint {
    val imageBounds = fittedImageBounds(containerSize, bitmap)
    return V2AnnotationPoint(
        x = if (imageBounds.width > 1f) {
            ((x - imageBounds.left) / imageBounds.width).coerceIn(0f, 1f)
        } else {
            0f
        },
        y = if (imageBounds.height > 1f) {
            ((y - imageBounds.top) / imageBounds.height).coerceIn(0f, 1f)
        } else {
            0f
        },
    )
}

private fun V2AnnotationPoint.toOffset(
    containerSize: Size,
    bitmap: Bitmap?,
): Offset {
    val imageBounds = fittedImageBounds(containerSize, bitmap)
    return Offset(
        x = imageBounds.left + x.coerceIn(0f, 1f) * imageBounds.width,
        y = imageBounds.top + y.coerceIn(0f, 1f) * imageBounds.height,
    )
}

private fun fittedImageBounds(
    containerSize: Size,
    bitmap: Bitmap?,
): Rect {
    if (containerSize.width <= 1f || containerSize.height <= 1f || bitmap == null) {
        return Rect(0f, 0f, containerSize.width, containerSize.height)
    }
    val imageWidth = bitmap.width.toFloat().coerceAtLeast(1f)
    val imageHeight = bitmap.height.toFloat().coerceAtLeast(1f)
    val imageAspect = imageWidth / imageHeight
    val containerAspect = containerSize.width / containerSize.height
    return if (imageAspect > containerAspect) {
        val renderedWidth = containerSize.width
        val renderedHeight = renderedWidth / imageAspect
        val top = (containerSize.height - renderedHeight) / 2f
        Rect(0f, top, renderedWidth, top + renderedHeight)
    } else {
        val renderedHeight = containerSize.height
        val renderedWidth = renderedHeight * imageAspect
        val left = (containerSize.width - renderedWidth) / 2f
        Rect(left, 0f, left + renderedWidth, renderedHeight)
    }
}

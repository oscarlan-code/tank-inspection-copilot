package ai.laiq.tankinspection.presentation.screens

import ai.laiq.tankinspection.data.local.AttachmentFileStore
import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.FindingDraftInput
import ai.laiq.tankinspection.presentation.ROOF_SURFACE_FIXED
import ai.laiq.tankinspection.presentation.ROOF_SURFACE_FLOATING
import ai.laiq.tankinspection.presentation.buildRoofLayoutOrNull
import ai.laiq.tankinspection.presentation.committedSetupState
import ai.laiq.tankinspection.presentation.committedScopeBaseline
import ai.laiq.tankinspection.presentation.createCommittedShellLinePlanOrNull
import ai.laiq.tankinspection.presentation.displayLinesForMap
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqDeleteConfirmDialog
import ai.laiq.tankinspection.presentation.components.LaiqDeleteDialogState
import ai.laiq.tankinspection.presentation.components.LaiqOptionChips
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.ShellMapLineVisual
import ai.laiq.tankinspection.presentation.components.ShellSurfaceMap
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.components.LaiqStatusBadge
import ai.laiq.tankinspection.presentation.components.RoofMapMarker
import ai.laiq.tankinspection.presentation.components.RoofSurfaceMap
import ai.laiq.tankinspection.presentation.editFinding
import ai.laiq.tankinspection.presentation.findingsForMeasurement
import ai.laiq.tankinspection.presentation.removeFinding
import ai.laiq.tankinspection.presentation.roofFeatureTypeLabel
import ai.laiq.tankinspection.presentation.roofReferenceLabel
import ai.laiq.tankinspection.presentation.referenceAzimuthDeg
import ai.laiq.tankinspection.presentation.saveFindingDraft
import android.graphics.Canvas
import android.graphics.Bitmap
import android.graphics.Paint
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas as ComposeCanvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.IntSize
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.abs

private val findingSurfaces = listOf(
    "shell" to "Shell",
    "roof_fixed" to "Fixed Roof",
    "roof_floating" to "Floating Roof",
    "shell_nozzle" to "Shell Nozzle",
    "roof_nozzle_fixed" to "Fixed Roof Nozzle",
    "roof_nozzle_floating" to "Floating Roof Nozzle",
)
private val findingTypes = listOf(
    "corrosion" to "Corrosion",
    "crack" to "Crack",
    "deformation" to "Deformation",
    "weld_concern" to "Weld Concern",
    "coating_failure" to "Coating Failure",
)
private val findingSeverities = listOf(
    "low" to "Low",
    "medium" to "Medium",
    "high" to "High",
)

@Composable
fun FindingsScreen(
    draftState: FieldDraftState,
    onDraftStateChange: (FieldDraftState) -> Unit,
    onBack: () -> Unit,
    contentPadding: PaddingValues,
) {
    val context = LocalContext.current
    val attachmentStore = remember(context) { AttachmentFileStore(context.filesDir) }
    val scope = rememberCoroutineScope()
    val committedScope = draftState.committedScopeBaseline()
    val shellLinePlan = draftState.createCommittedShellLinePlanOrNull()
    val findingRoofSurfaceId = roofSurfaceIdForFinding(draftState.findingDraft.surface)
    val roofLayout = draftState.buildRoofLayoutOrNull(findingRoofSurfaceId)
    val roofReferenceLabel = committedScope.roofReferenceLabel()
    val roofReferenceAzimuth = committedScope.referenceAzimuthDeg()
    val displayedLines = shellLinePlan?.displayLinesForMap().orEmpty()
    val isMeasurementContextLocked =
        draftState.findingDraft.linkedMeasurementId.isNotBlank() ||
            draftState.findingDraft.locationSummary.isNotBlank() ||
            draftState.findingDraft.preciseLineId.isNotBlank() ||
            draftState.findingDraft.preciseCourse.isNotBlank()
    val locationOptions = findingLocationOptions(
        draftState = draftState,
        surface = draftState.findingDraft.surface,
    )
    val relatedFindings = draftState.findingsForMeasurement(
        surface = draftState.findingDraft.surface,
        linkedMeasurementId = draftState.findingDraft.linkedMeasurementId,
        locationSummary = draftState.findingDraft.locationSummary,
    )
    val displayFindings = if (isMeasurementContextLocked) relatedFindings else draftState.findings
    val findingVisualContext = resolveFindingVisualContext(
        draftState = draftState,
        shellLinePlan = shellLinePlan,
    )
    var showAnnotationEditor by remember(draftState.findingDraft.photoRelativePath) { mutableStateOf(false) }
    var annotationStrokes by remember(draftState.findingDraft.photoRelativePath) { mutableStateOf<List<List<Offset>>>(emptyList()) }
    var activeAnnotationStroke by remember(draftState.findingDraft.photoRelativePath) { mutableStateOf<List<Offset>>(emptyList()) }
    var annotationViewport by remember(draftState.findingDraft.photoRelativePath) { mutableStateOf(IntSize.Zero) }
    var pendingDelete by remember { mutableStateOf<LaiqDeleteDialogState?>(null) }
    val listState = rememberLazyListState()
    val photoBitmap = remember(draftState.findingDraft.photoRelativePath) {
        attachmentStore.loadBitmap(draftState.findingDraft.photoRelativePath)
    }
    val hasAnnotationStrokes = annotationStrokes.isNotEmpty() || activeAnnotationStroke.isNotEmpty()
    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicturePreview(),
    ) { bitmap: Bitmap? ->
        if (bitmap == null) return@rememberLauncherForActivityResult
        scope.launch {
            val relativePath = withContext(Dispatchers.IO) {
                attachmentStore.saveFindingPhoto(bitmap)
            }
            onDraftStateChange(
                draftState.copy(
                    findingDraft = draftState.findingDraft.copy(photoRelativePath = relativePath),
                ),
            )
        }
    }

    pendingDelete?.let { dialogState ->
        LaiqDeleteConfirmDialog(
            state = dialogState,
            onDismiss = { pendingDelete = null },
        )
    }

    LaunchedEffect(draftState.findingDraft.editingFindingId) {
        if (draftState.findingDraft.editingFindingId != null) {
            listState.animateScrollToItem(0)
        }
    }

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = 16.dp,
            end = 16.dp,
            top = contentPadding.calculateTopPadding() + 12.dp,
            bottom = 24.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            LaiqSectionCard(
                title = "Finding Capture",
                subtitle = if (isMeasurementContextLocked) {
                    "Capture one or more findings for the selected measurement point. Severity, type, photo, and sketch are saved per finding."
                } else {
                    "Photo-linked field finding capture aligned to the canonical package."
                },
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LaiqStatChip("Findings", draftState.findings.size.toString(), modifier = Modifier.weight(1f))
                    LaiqStatChip("Attachments", draftState.attachments.size.toString(), tone = LaiqColors.AccentOrange, modifier = Modifier.weight(1f))
                }
                draftState.findingDraft.editingFindingId?.let { editingId ->
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = LaiqColors.AccentOrange.copy(alpha = 0.10f),
                        shape = RoundedCornerShape(18.dp),
                        border = BorderStroke(1.dp, LaiqColors.AccentOrange),
                    ) {
                        Text(
                            text = "Editing saved finding $editingId",
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                            style = MaterialTheme.typography.bodySmall,
                            color = LaiqColors.BodyText,
                        )
                    }
                }
                if (isMeasurementContextLocked) {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = Color.White,
                        shape = RoundedCornerShape(18.dp),
                        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Text("Linked Measurement", style = MaterialTheme.typography.titleSmall)
                            Text(
                                findingVisualContext?.summary
                                    ?: draftState.findingDraft.locationSummary.ifBlank {
                                        draftState.findingDraft.linkedMeasurementId.ifBlank { "Measurement context loaded" }
                                    },
                                style = MaterialTheme.typography.bodySmall,
                                color = LaiqColors.BodyText,
                            )
                            Text(
                                "Multiple findings can be added here without changing the measurement location.",
                                style = MaterialTheme.typography.bodySmall,
                                color = LaiqColors.MutedText,
                            )
                        }
                    }
                } else {
                    Text("Surface", style = MaterialTheme.typography.titleSmall)
                    LaiqOptionChips(
                        selectedValue = draftState.findingDraft.surface,
                        options = findingSurfaces,
                        onSelect = {
                            onDraftStateChange(draftState.copy(findingDraft = draftState.findingDraft.copy(surface = it)))
                        },
                    )
                    if (locationOptions.isNotEmpty()) {
                        Text("Quick Location Link", style = MaterialTheme.typography.titleSmall)
                        LaiqOptionChips(
                            selectedValue = draftState.findingDraft.linkedMeasurementId,
                            options = locationOptions.map { it.id to it.label },
                            onSelect = { selectedId ->
                                locationOptions.firstOrNull { it.id == selectedId }?.let { option ->
                                    onDraftStateChange(
                                        draftState.copy(
                                            findingDraft = draftState.findingDraft.copy(
                                                linkedMeasurementId = option.id,
                                                locationSummary = option.label,
                                            ),
                                        ),
                                    )
                                }
                            },
                        )
                    }
                }
                findingVisualContext?.let { visualContext ->
                    Text("Highlighted Layout Map", style = MaterialTheme.typography.titleSmall)
                    visualContext.summary?.takeIf { it.isNotBlank() }?.let { summary ->
                        Text(
                            summary,
                            style = MaterialTheme.typography.bodySmall,
                            color = LaiqColors.MutedText,
                        )
                    }
                    when {
                        visualContext.shellCell != null -> ShellSurfaceMap(
                            lines = displayedLines.map { line ->
                                ShellMapLineVisual(
                                    lineId = line.lineId,
                                    label = line.label,
                                    azimuthDeg = line.azimuthDeg.toInt(),
                                )
                            },
                            courseCount = draftState.committedSetupState().shellCourseCount.toIntOrNull() ?: 0,
                            activeCell = visualContext.shellCell,
                            savedCells = emptySet(),
                            overlayCells = emptySet(),
                            scaleOriginLabel = shellLinePlan?.startReference,
                            anchorLaneId = shellLinePlan?.lines?.firstOrNull()?.lineId,
                            captureStartLaneId = shellLinePlan?.captureStartLaneId,
                            enableViewportControls = false,
                            onSelectCell = { _, _ -> },
                            modifier = Modifier.fillMaxWidth(),
                        )

                        visualContext.roofPlateId != null && roofLayout != null -> RoofSurfaceMap(
                            template = roofLayout.template,
                            rowCount = roofLayout.rowCount ?: 0,
                            widestRowPlateCount = roofLayout.widestRowPlateCount ?: 0,
                            ringCount = roofLayout.ringCount ?: 0,
                            sectorCount = roofLayout.sectorCount ?: 0,
                            activePlateId = visualContext.roofPlateId,
                            savedPlateIds = emptySet(),
                            overlayPlateIds = emptySet(),
                            centerFeatureCount = 0,
                            hasAnnularRing = roofLayout.hasAnnularRing,
                            annularSectionCount = roofLayout.annularSectionCount ?: 0,
                            hasPontoonDeck = roofLayout.hasPontoonDeck,
                            markers = draftState.roofFeatures.filter { feature ->
                                (feature.roofSurfaceId ?: ROOF_SURFACE_FIXED) == findingRoofSurfaceId
                            }.map { feature ->
                                RoofMapMarker(
                                    markerId = feature.featureId,
                                    label = feature.label ?: roofFeatureTypeLabel(feature.type),
                                    plateId = feature.plateId,
                                    azimuthDeg = feature.azimuthDeg,
                                    radiusRatio = feature.radiusRatio,
                                )
                            },
                            referenceLabel = roofReferenceLabel,
                            referenceAzimuthDeg = roofReferenceAzimuth,
                            rotationDirection = committedScope.rotationDirection,
                            onSelectPlate = { },
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
                Text("Type", style = MaterialTheme.typography.titleSmall)
                LaiqOptionChips(
                    selectedValue = draftState.findingDraft.type,
                    options = findingTypes,
                    onSelect = {
                        onDraftStateChange(draftState.copy(findingDraft = draftState.findingDraft.copy(type = it)))
                    },
                )
                Text("Severity", style = MaterialTheme.typography.titleSmall)
                LaiqOptionChips(
                    selectedValue = draftState.findingDraft.severity,
                    options = findingSeverities,
                    onSelect = {
                        onDraftStateChange(draftState.copy(findingDraft = draftState.findingDraft.copy(severity = it)))
                    },
                )
                FindingTextInputs(
                    draft = draftState.findingDraft,
                    onDraftChange = { updated ->
                        onDraftStateChange(draftState.copy(findingDraft = updated))
                    },
                )
                LaiqSecondaryButton(
                    text = if (draftState.findingDraft.photoRelativePath.isBlank()) "Capture Photo" else "Retake Photo",
                    onClick = { cameraLauncher.launch(null) },
                )
                if (draftState.findingDraft.photoRelativePath.isNotBlank()) {
                    Text(
                        "Photo: ${draftState.findingDraft.photoRelativePath}",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                }
                if (photoBitmap != null) {
                    if (showAnnotationEditor) {
                        Text("Photo Annotation", style = MaterialTheme.typography.titleSmall)
                        PhotoAnnotationCanvas(
                            bitmap = photoBitmap,
                            completedStrokes = annotationStrokes,
                            activeStroke = activeAnnotationStroke,
                            onStrokeChange = { activeAnnotationStroke = it },
                            onStrokeCompleted = { stroke ->
                                annotationStrokes = annotationStrokes + listOf(stroke)
                                activeAnnotationStroke = emptyList()
                            },
                            onViewportMeasured = { annotationViewport = it },
                        )
                    } else {
                        Image(
                            bitmap = photoBitmap.asImageBitmap(),
                            contentDescription = "Finding photo preview",
                            contentScale = ContentScale.Fit,
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 220.dp),
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        LaiqSecondaryButton(
                            text = "Annotation",
                            onClick = { showAnnotationEditor = true },
                            modifier = Modifier.weight(1f),
                        )
                        LaiqSecondaryButton(
                            text = "Clear",
                            onClick = {
                                annotationStrokes = emptyList()
                                activeAnnotationStroke = emptyList()
                            },
                            enabled = hasAnnotationStrokes,
                            modifier = Modifier.weight(1f),
                        )
                        LaiqPrimaryButton(
                            text = "Confirm",
                            enabled = showAnnotationEditor && hasAnnotationStrokes,
                            onClick = {
                                if (annotationViewport.width <= 0 || annotationViewport.height <= 0) return@LaiqPrimaryButton
                                val allStrokes = annotationStrokes + listOfNotNull(activeAnnotationStroke.takeIf { it.isNotEmpty() })
                                if (allStrokes.isEmpty()) return@LaiqPrimaryButton
                                scope.launch {
                                    val annotatedBitmap = withContext(Dispatchers.Default) {
                                        renderAnnotatedBitmap(photoBitmap, allStrokes, annotationViewport)
                                    }
                                    val relativePath = withContext(Dispatchers.IO) {
                                        attachmentStore.saveAnnotatedFindingPhoto(annotatedBitmap)
                                    }
                                    annotationStrokes = emptyList()
                                    activeAnnotationStroke = emptyList()
                                    showAnnotationEditor = false
                                    onDraftStateChange(
                                        draftState.copy(
                                            findingDraft = draftState.findingDraft.copy(photoRelativePath = relativePath),
                                        ),
                                    )
                                }
                            },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                LaiqPrimaryButton(
                    text = when {
                        draftState.findingDraft.editingFindingId != null -> "Update Finding"
                        isMeasurementContextLocked -> "Save Finding To Measurement"
                        else -> "Save Finding"
                    },
                    onClick = { onDraftStateChange(draftState.saveFindingDraft()) },
                )
            }
        }

        item {
            LaiqSectionCard(
                title = "Saved Findings",
                subtitle = if (isMeasurementContextLocked) {
                    "Only findings linked to this measurement location are shown here."
                } else {
                    "Recent findings stored locally and ready for export."
                },
            ) {
                if (displayFindings.isEmpty()) {
                    Text("No findings saved yet.", style = MaterialTheme.typography.bodySmall)
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        displayFindings.takeLast(10).reversed().forEach { finding ->
                            SavedFindingCard(
                                draftState = draftState,
                                finding = finding,
                                onEdit = { findingId -> onDraftStateChange(draftState.editFinding(findingId)) },
                                onDelete = { findingId ->
                                    pendingDelete = LaiqDeleteDialogState(
                                        title = "Delete Finding?",
                                        message = "This will permanently remove the finding and any attached photo or annotation.",
                                        onConfirm = { onDraftStateChange(draftState.removeFinding(findingId)) },
                                    )
                                },
                            )
                        }
                    }
                }
            }
        }

        item {
            LaiqSecondaryButton("Back", onBack)
        }
    }
}

private data class FindingLocationOption(
    val id: String,
    val label: String,
)

@Composable
private fun PhotoAnnotationCanvas(
    bitmap: Bitmap,
    completedStrokes: List<List<Offset>>,
    activeStroke: List<Offset>,
    onStrokeChange: (List<Offset>) -> Unit,
    onStrokeCompleted: (List<Offset>) -> Unit,
    onViewportMeasured: (IntSize) -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 220.dp)
    ) {
        Image(
            bitmap = bitmap.asImageBitmap(),
            contentDescription = "Finding photo",
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 220.dp),
        )
        ComposeCanvas(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 220.dp)
                .pointerInput(bitmap) {
                    var currentStroke = mutableListOf<Offset>()
                    detectDragGestures(
                        onDragStart = { start ->
                            currentStroke = mutableListOf(start)
                            onStrokeChange(currentStroke.toList())
                        },
                        onDragEnd = {
                            if (currentStroke.isNotEmpty()) {
                                onStrokeCompleted(currentStroke.toList())
                                currentStroke = mutableListOf()
                            }
                        },
                        onDragCancel = {
                            if (currentStroke.isNotEmpty()) {
                                onStrokeCompleted(currentStroke.toList())
                                currentStroke = mutableListOf()
                            }
                        },
                        onDrag = { change, _ ->
                            change.consume()
                            currentStroke.add(change.position)
                            onStrokeChange(currentStroke.toList())
                        },
                    )
                }
                ,
            onDraw = {
                onViewportMeasured(IntSize(size.width.toInt(), size.height.toInt()))
                val strokeColor = androidx.compose.ui.graphics.Color(0xFFC7362F)
                completedStrokes.forEach { stroke ->
                    for (index in 1 until stroke.size) {
                        drawLine(
                            color = strokeColor,
                            start = stroke[index - 1],
                            end = stroke[index],
                            strokeWidth = 6f,
                        )
                    }
                }
                for (index in 1 until activeStroke.size) {
                    drawLine(
                        color = strokeColor,
                        start = activeStroke[index - 1],
                        end = activeStroke[index],
                        strokeWidth = 6f,
                    )
                }
            },
        )
    }
}

private fun renderAnnotatedBitmap(
    source: Bitmap,
    strokes: List<List<Offset>>,
    viewport: IntSize,
): Bitmap {
    val annotated = source.copy(Bitmap.Config.ARGB_8888, true)
    val canvas = Canvas(annotated)
    val scaleX = if (viewport.width > 0) source.width.toFloat() / viewport.width.toFloat() else 1f
    val scaleY = if (viewport.height > 0) source.height.toFloat() / viewport.height.toFloat() else 1f
    val paint = Paint().apply {
        color = android.graphics.Color.parseColor("#C7362F")
        style = Paint.Style.STROKE
        strokeWidth = 8f
        isAntiAlias = true
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }
    strokes.forEach { stroke ->
        for (index in 1 until stroke.size) {
            val start = stroke[index - 1]
            val end = stroke[index]
            canvas.drawLine(
                start.x * scaleX,
                start.y * scaleY,
                end.x * scaleX,
                end.y * scaleY,
                paint,
            )
        }
    }
    return annotated
}

private fun findingLocationOptions(
    draftState: FieldDraftState,
    surface: String,
): List<FindingLocationOption> = when (surface) {
    "shell" -> draftState.shellUtRows.takeLast(8).reversed().map { row ->
        FindingLocationOption(
            id = row.rowId,
            label = shellMeasurementLocationLabel(row, draftState.createCommittedShellLinePlanOrNull()),
        )
    }
    "roof",
    "roof_fixed",
    "roof_floating" -> draftState.roofUtRows
        .filter { row -> (row.roofSurfaceId ?: ROOF_SURFACE_FIXED) == roofSurfaceIdForFinding(surface) }
        .takeLast(8).reversed().map { row ->
        FindingLocationOption(
            id = row.rowId,
            label = "${roofSurfaceLabelForFinding(surface)} · Plate ${row.plateId}",
        )
    }
    "shell_nozzle" -> draftState.shellNozzles.takeLast(8).reversed().map { nozzle ->
        FindingLocationOption(
            id = nozzle.nozzleId,
            label = shellNozzleLocationLabel(nozzle, draftState.createCommittedShellLinePlanOrNull()),
        )
    }
    "roof_nozzle",
    "roof_nozzle_fixed",
    "roof_nozzle_floating" -> draftState.roofNozzles
        .filter { nozzle -> (nozzle.roofSurfaceId ?: ROOF_SURFACE_FIXED) == roofSurfaceIdForFinding(surface) }
        .takeLast(8).reversed().map { nozzle ->
        FindingLocationOption(
            id = nozzle.nozzleId,
            label = roofNozzleLocationLabel(nozzle, roofSurfaceLabelForFinding(surface)),
        )
    }
    else -> emptyList()
}

private data class FindingVisualContext(
    val summary: String? = null,
    val shellCell: Pair<String, Int>? = null,
    val roofPlateId: String? = null,
)

@Composable
private fun SavedFindingCard(
    draftState: FieldDraftState,
    finding: ai.laiq.tankinspection.domain.model.FindingRecord,
    onEdit: (String) -> Unit,
    onDelete: (String) -> Unit,
) {
    val linkedAttachments = draftState.attachments.filter { attachment ->
        attachment.attachmentId in finding.attachmentIds
    }
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color.White,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(
                    "${finding.type.replace('_', ' ')} · ${finding.surface.replace('_', ' ')}",
                    style = MaterialTheme.typography.titleSmall,
                )
                LaiqStatusBadge(
                    finding.severity.replaceFirstChar { it.uppercase() },
                    when (finding.severity) {
                        "high" -> LaiqColors.StatusWarning
                        "medium" -> LaiqColors.AccentOrange
                        else -> LaiqColors.StatusReady
                    },
                )
            }
            finding.locationSummary?.takeIf { it.isNotBlank() }?.let { summary ->
                Text("Location: $summary", style = MaterialTheme.typography.bodySmall)
            }
            finding.note?.takeIf { it.isNotBlank() }?.let { note ->
                Text(note, style = MaterialTheme.typography.bodySmall)
            }
            if (linkedAttachments.isNotEmpty()) {
                Text("Attachments", style = MaterialTheme.typography.titleSmall)
                linkedAttachments.forEach { attachment ->
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = LaiqColors.BrandTeal.copy(alpha = 0.06f),
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Text(
                                attachment.caption ?: attachment.attachmentId,
                                style = MaterialTheme.typography.bodySmall,
                                color = LaiqColors.BodyText,
                            )
                            Text(
                                attachment.relativePath,
                                style = MaterialTheme.typography.bodySmall,
                                color = LaiqColors.MutedText,
                            )
                        }
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                LaiqSecondaryButton(
                    text = "Edit",
                    onClick = { onEdit(finding.findingId) },
                    modifier = Modifier.weight(1f),
                )
                LaiqSecondaryButton(
                    text = "Delete",
                    onClick = { onDelete(finding.findingId) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

private fun resolveFindingVisualContext(
    draftState: FieldDraftState,
    shellLinePlan: ai.laiq.tankinspection.domain.model.ShellLinePlan?,
): FindingVisualContext? {
    val draft = draftState.findingDraft
    return when (draft.surface) {
        "shell" -> {
            val row = draft.linkedMeasurementId.takeIf { it.isNotBlank() }?.let { measurementId ->
                draftState.shellUtRows.firstOrNull { savedRow -> savedRow.rowId == measurementId }
            }
            val lineId = draft.preciseLineId.ifBlank { row?.lineId.orEmpty() }
            val course = draft.preciseCourse.toIntOrNull() ?: row?.course
            val summary = draft.locationSummary.ifBlank {
                row?.let { shellMeasurementLocationLabel(it, shellLinePlan) }.orEmpty()
            }
            if (lineId.isBlank() || course == null) {
                summary.takeIf { it.isNotBlank() }?.let { FindingVisualContext(summary = it) }
            } else {
                FindingVisualContext(
                    summary = summary.ifBlank { shellCellSummary(lineId, course, shellLinePlan) },
                    shellCell = lineId to course,
                )
            }
        }

        "roof",
        "roof_fixed",
        "roof_floating" -> {
            val row = draft.linkedMeasurementId.takeIf { it.isNotBlank() }?.let { measurementId ->
                draftState.roofUtRows.firstOrNull { savedRow ->
                    savedRow.rowId == measurementId &&
                        (savedRow.roofSurfaceId ?: ROOF_SURFACE_FIXED) == roofSurfaceIdForFinding(draft.surface)
                }
            }
            val plateId = row?.plateId ?: parsePlateId(draft.locationSummary)
            FindingVisualContext(
                summary = draft.locationSummary.ifBlank {
                    plateId?.let { "${roofSurfaceLabelForFinding(draft.surface)} · Plate $it" }.orEmpty()
                }.ifBlank { null },
                roofPlateId = plateId,
            )
        }

        "shell_nozzle" -> {
            val nozzle = draft.linkedMeasurementId.takeIf { it.isNotBlank() }?.let { nozzleId ->
                draftState.shellNozzles.firstOrNull { savedNozzle -> savedNozzle.nozzleId == nozzleId }
            }
            val lineId = shellLinePlan.nearestLineIdFor(nozzle?.azimuthDeg)
            val course = nozzle?.course
            FindingVisualContext(
                summary = draft.locationSummary.ifBlank { shellNozzleLocationLabel(nozzle, shellLinePlan) }.ifBlank { null },
                shellCell = if (lineId != null && course != null) lineId to course else null,
            )
        }

        "roof_nozzle",
        "roof_nozzle_fixed",
        "roof_nozzle_floating" -> {
            val nozzle = draft.linkedMeasurementId.takeIf { it.isNotBlank() }?.let { nozzleId ->
                draftState.roofNozzles.firstOrNull { savedNozzle ->
                    savedNozzle.nozzleId == nozzleId &&
                        (savedNozzle.roofSurfaceId ?: ROOF_SURFACE_FIXED) == roofSurfaceIdForFinding(draft.surface)
                }
            }
            val plateId = nozzle?.plateId ?: parsePlateId(draft.locationSummary)
            FindingVisualContext(
                summary = draft.locationSummary.ifBlank {
                    roofNozzleLocationLabel(nozzle, roofSurfaceLabelForFinding(draft.surface))
                }.ifBlank { null },
                roofPlateId = plateId,
            )
        }

        else -> null
    }
}

private fun shellMeasurementLocationLabel(
    row: ai.laiq.tankinspection.domain.model.ShellUtRow,
    shellLinePlan: ai.laiq.tankinspection.domain.model.ShellLinePlan?,
): String = shellCellSummary(row.lineId, row.course, shellLinePlan)

private fun shellCellSummary(
    lineId: String,
    course: Int,
    shellLinePlan: ai.laiq.tankinspection.domain.model.ShellLinePlan?,
): String {
    val lineLabel = shellLinePlan?.lines?.firstOrNull { line -> line.lineId == lineId }?.label ?: lineId
    return "$lineLabel · Strake $course"
}

private fun shellNozzleLocationLabel(
    nozzle: ai.laiq.tankinspection.domain.model.NozzleDefinition?,
    shellLinePlan: ai.laiq.tankinspection.domain.model.ShellLinePlan?,
): String {
    nozzle ?: return ""
    val lineId = shellLinePlan.nearestLineIdFor(nozzle.azimuthDeg)
    val lineLabel = lineId?.let { id -> shellLinePlan?.lines?.firstOrNull { line -> line.lineId == id }?.label } ?: lineId
    return buildString {
        append(nozzle.nozzleId)
        if (lineLabel != null && nozzle.course != null) {
            append(" · ")
            append(lineLabel)
            append(" · Strake ")
            append(nozzle.course)
        }
    }
}

private fun roofNozzleLocationLabel(
    nozzle: ai.laiq.tankinspection.domain.model.NozzleDefinition?,
    surfaceLabel: String? = null,
): String {
    nozzle ?: return ""
    return buildString {
        surfaceLabel?.takeIf { it.isNotBlank() }?.let {
            append(it)
            append(" · ")
        }
        append(nozzle.nozzleId)
        nozzle.plateId?.takeIf { it.isNotBlank() }?.let { plateId ->
            append(" · Plate ")
            append(plateId)
        }
    }
}

private fun roofSurfaceIdForFinding(surface: String): String = when (surface) {
    "roof_floating", "roof_nozzle_floating" -> ROOF_SURFACE_FLOATING
    else -> ROOF_SURFACE_FIXED
}

private fun roofSurfaceLabelForFinding(surface: String): String = when (roofSurfaceIdForFinding(surface)) {
    ROOF_SURFACE_FLOATING -> "Floating Roof"
    else -> "Fixed Roof"
}

private fun parsePlateId(locationSummary: String): String? {
    val match = Regex("""Plate\s+([A-Za-z0-9\-]+)""").find(locationSummary)
    return when {
        match != null -> match.groupValues.getOrNull(1)
        locationSummary.isBlank() -> null
        else -> locationSummary.substringAfterLast('·').trim().takeIf { it.isNotBlank() }
    }
}

private fun ai.laiq.tankinspection.domain.model.ShellLinePlan?.nearestLineIdFor(azimuthDeg: Double?): String? {
    this ?: return null
    azimuthDeg ?: return null
    return lines.minByOrNull { line ->
        val delta = abs(line.azimuthDeg - azimuthDeg)
        minOf(delta, 360.0 - delta)
    }?.lineId
}

@Composable
private fun FindingTextInputs(
    draft: FindingDraftInput,
    onDraftChange: (FindingDraftInput) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedTextField(
            value = draft.note,
            onValueChange = { onDraftChange(draft.copy(note = it)) },
            label = { Text("Finding Note") },
            shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

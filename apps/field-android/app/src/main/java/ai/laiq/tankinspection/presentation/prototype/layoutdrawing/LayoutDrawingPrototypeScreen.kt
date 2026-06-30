package ai.laiq.tankinspection.presentation.prototype.layoutdrawing

import android.graphics.BitmapFactory
import android.graphics.Paint
import android.net.Uri
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.prototype.layoutdrawing.LayoutRecognitionEngine
import ai.laiq.tankinspection.prototype.layoutdrawing.MockLayoutRecognitionEngine
import ai.laiq.tankinspection.prototype.layoutdrawing.PrototypeElementType
import ai.laiq.tankinspection.prototype.layoutdrawing.PrototypeGridSettings
import ai.laiq.tankinspection.prototype.layoutdrawing.PrototypeLayoutDraft
import ai.laiq.tankinspection.prototype.layoutdrawing.PrototypeLayoutExportRepository
import ai.laiq.tankinspection.prototype.layoutdrawing.PrototypeLayoutGeometry
import ai.laiq.tankinspection.prototype.layoutdrawing.PrototypeLayoutPlate
import ai.laiq.tankinspection.prototype.layoutdrawing.PrototypeLayoutSourceType
import ai.laiq.tankinspection.prototype.layoutdrawing.PrototypeLayoutSurface
import ai.laiq.tankinspection.prototype.layoutdrawing.PrototypeMarkerShape
import ai.laiq.tankinspection.prototype.layoutdrawing.PrototypeNormalizedPoint
import ai.laiq.tankinspection.prototype.layoutdrawing.PrototypeRecognitionInput
import ai.laiq.tankinspection.prototype.layoutdrawing.PrototypeSketchLabel
import ai.laiq.tankinspection.prototype.layoutdrawing.PrototypeSketchStroke
import ai.laiq.tankinspection.prototype.layoutdrawing.PrototypeSketchStrokeKind
import ai.laiq.tankinspection.prototype.layoutdrawing.PrototypeValidationStatus
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

@Composable
fun LayoutDrawingPrototypeScreen(
    exportRepository: PrototypeLayoutExportRepository,
    recognitionEngine: LayoutRecognitionEngine = remember { MockLayoutRecognitionEngine() },
) {
    var activeScreen by remember { mutableStateOf(PrototypeScreen.CANVAS) }
    var selectedSurface by remember { mutableStateOf(PrototypeLayoutSurface.EXTERNAL_ROOF) }
    var sourceType by remember { mutableStateOf(PrototypeLayoutSourceType.SKETCH) }
    var sourceImageUri by remember { mutableStateOf<String?>(null) }
    var gridSettings by remember { mutableStateOf(PrototypeGridSettings()) }
    var strokes by remember { mutableStateOf(emptyList<PrototypeSketchStroke>()) }
    var selectedStrokeId by remember { mutableStateOf<String?>(null) }
    var currentStroke by remember { mutableStateOf<List<PrototypeNormalizedPoint>>(emptyList()) }
    var labels by remember { mutableStateOf(emptyList<PrototypeSketchLabel>()) }
    var draft by remember { mutableStateOf<PrototypeLayoutDraft?>(null) }
    var selectedPlateId by remember { mutableStateOf<String?>(null) }
    var selectedElementId by remember { mutableStateOf<String?>(null) }
    var exportMessage by remember { mutableStateOf("") }
    var labelPoint by remember { mutableStateOf<PrototypeNormalizedPoint?>(null) }
    var labelText by remember { mutableStateOf("") }

    val imagePicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri ->
        if (uri != null) {
            selectedSurface = PrototypeLayoutSurface.EXTERNAL_ROOF
            sourceType = PrototypeLayoutSourceType.IMAGE_IMPORT
            sourceImageUri = uri.toString()
            strokes = emptyList()
            selectedStrokeId = null
            labels = emptyList()
            currentStroke = emptyList()
            draft = null
            activeScreen = PrototypeScreen.CANVAS
        }
    }

    fun recognizeCurrentInput(nextSourceType: PrototypeLayoutSourceType = sourceType) {
        val nextDraft = recognitionEngine.recognize(
            PrototypeRecognitionInput(
                surface = selectedSurface,
                sourceType = nextSourceType,
                sourceImageUri = sourceImageUri,
                strokes = strokes,
                labels = labels,
                grid = gridSettings,
            ),
        )
        draft = nextDraft
        selectedPlateId = nextDraft.plates.firstOrNull()?.id
        selectedElementId = null
        exportMessage = ""
        activeScreen = PrototypeScreen.REVIEW
    }

    fun startSketch() {
        selectedSurface = PrototypeLayoutSurface.EXTERNAL_ROOF
        sourceType = PrototypeLayoutSourceType.SKETCH
        sourceImageUri = null
        strokes = emptyList()
        selectedStrokeId = null
        labels = emptyList()
        currentStroke = emptyList()
        draft = null
        activeScreen = PrototypeScreen.CANVAS
    }

    fun startFromV3() {
        selectedSurface = PrototypeLayoutSurface.EXTERNAL_ROOF
        sourceType = PrototypeLayoutSourceType.V3_BASE
        sourceImageUri = null
        strokes = emptyList()
        selectedStrokeId = null
        labels = emptyList()
        currentStroke = emptyList()
        recognizeCurrentInput(PrototypeLayoutSourceType.V3_BASE)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF6F8FC)),
    ) {
        when (activeScreen) {
            PrototypeScreen.HOME -> PrototypeHomeScreen(
                onStartV3Base = { startFromV3() },
                onStartRoofSketch = { startSketch() },
                onImportImage = {
                    imagePicker.launch(
                        PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                    )
                },
                onViewLatestJson = { activeScreen = PrototypeScreen.JSON_VIEWER },
            )
            PrototypeScreen.CANVAS -> PrototypeCanvasScreen(
                surface = selectedSurface,
                sourceType = sourceType,
                sourceImageUri = sourceImageUri,
                gridSettings = gridSettings,
                strokes = strokes,
                selectedStrokeId = selectedStrokeId,
                currentStroke = currentStroke,
                labels = labels,
                onGridChange = { gridSettings = it },
                onCurrentStrokeChange = { currentStroke = it },
                onCommitStroke = { stroke ->
                    strokes = strokes + stroke
                    selectedStrokeId = stroke.id
                    currentStroke = emptyList()
                },
                onSelectStroke = { selectedStrokeId = it },
                onUpdateStroke = { updatedStroke ->
                    strokes = strokes.map { stroke ->
                        if (stroke.id == updatedStroke.id) updatedStroke else stroke
                    }
                    selectedStrokeId = updatedStroke.id
                },
                onAddElement = { point ->
                    strokes = strokes + PrototypeSketchStroke(
                        kind = PrototypeSketchStrokeKind.ELEMENT,
                        points = listOf(point, point.defaultElementRadiusHandle()),
                    )
                },
                onAddLabelRequest = { point ->
                    labelPoint = point
                    labelText = ""
                },
                onEraseNearest = { point ->
                    val nextStrokes = strokes.erasedAt(point)
                    strokes = nextStrokes
                    labels = labels.removeNearestLabel(point)
                    selectedStrokeId = selectedStrokeId?.takeIf { id -> nextStrokes.any { it.id == id } }
                },
                onUndo = {
                    var nextStrokes = strokes
                    when {
                        labels.isNotEmpty() -> labels = labels.dropLast(1)
                        strokes.isNotEmpty() -> {
                            nextStrokes = strokes.dropLast(1)
                            strokes = nextStrokes
                        }
                    }
                    selectedStrokeId = selectedStrokeId?.takeIf { id -> nextStrokes.any { it.id == id } }
                },
                onClear = {
                    strokes = emptyList()
                    selectedStrokeId = null
                    labels = emptyList()
                    currentStroke = emptyList()
                },
                onRecognize = { recognizeCurrentInput() },
                onBack = { activeScreen = PrototypeScreen.HOME },
            )
            PrototypeScreen.REVIEW -> PrototypeReviewScreen(
                draft = draft,
                sourceImageUri = sourceImageUri,
                selectedPlateId = selectedPlateId,
                selectedElementId = selectedElementId,
                onSelectPlate = {
                    selectedPlateId = it
                    selectedElementId = null
                },
                onSelectElement = {
                    selectedElementId = it
                    selectedPlateId = null
                },
                onDraftChange = { nextDraft ->
                    draft = nextDraft
                    selectedPlateId = selectedPlateId?.takeIf { id -> nextDraft.plates.any { it.id == id } }
                        ?: nextDraft.plates.firstOrNull()?.id
                    selectedElementId = selectedElementId?.takeIf { id -> nextDraft.elements.any { it.id == id } }
                },
                onBack = {
                    activeScreen = if (sourceType == PrototypeLayoutSourceType.V3_BASE) {
                        PrototypeScreen.HOME
                    } else {
                        PrototypeScreen.CANVAS
                    }
                },
                onApprove = { activeScreen = PrototypeScreen.APPROVAL },
            )
            PrototypeScreen.APPROVAL -> PrototypeApprovalScreen(
                draft = draft,
                exportPath = exportRepository.latestFilePath(),
                exportMessage = exportMessage,
                onBack = { activeScreen = PrototypeScreen.REVIEW },
                onApproveAndExport = { inspectorName ->
                    val approvedDraft = draft
                        ?.approvedByInspector(inspectorName)
                        ?.withValidation()
                    if (approvedDraft != null) {
                        draft = approvedDraft
                        val file = exportRepository.exportLatest(approvedDraft)
                        exportMessage = "Exported ${file.name} to ${file.parentFile?.absolutePath.orEmpty()}"
                    }
                },
                onViewJson = { activeScreen = PrototypeScreen.JSON_VIEWER },
            )
            PrototypeScreen.JSON_VIEWER -> PrototypeLatestJsonScreen(
                latestJson = exportRepository.readLatestJson(),
                latestPath = exportRepository.latestFilePath(),
                onBack = { activeScreen = PrototypeScreen.HOME },
            )
        }
    }

    labelPoint?.let { point ->
        AlertDialog(
            onDismissRequest = {
                labelPoint = null
                labelText = ""
            },
            title = { Text("Add Label") },
            text = {
                OutlinedTextField(
                    value = labelText,
                    onValueChange = { labelText = it },
                    label = { Text("Label") },
                    singleLine = true,
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (labelText.isNotBlank()) {
                            labels = labels + PrototypeSketchLabel(
                                text = labelText.trim(),
                                position = point,
                            )
                        }
                        labelPoint = null
                        labelText = ""
                    },
                ) {
                    Text("Add")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        labelPoint = null
                        labelText = ""
                    },
                ) {
                    Text("Cancel")
                }
            },
        )
    }
}

@Composable
private fun PrototypeHomeScreen(
    onStartV3Base: () -> Unit,
    onStartRoofSketch: () -> Unit,
    onImportImage: () -> Unit,
    onViewLatestJson: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        PrototypeHeader(
            eyebrow = "Layout Drawing Prototype",
            title = "Roof Layout Drawing",
            subtitle = "A simple Excalidraw-style roof sketch tool that generates structured plate geometry.",
        )

        PrototypePanel(title = "Start") {
            PrototypePrimaryButton(
                text = "New Roof Sketch",
                onClick = onStartRoofSketch,
            )
            PrototypeSecondaryButton(
                text = "Start from V3 Roof Layout",
                onClick = onStartV3Base,
            )
            PrototypeSecondaryButton(
                text = "Import Roof Drawing/Image",
                onClick = onImportImage,
            )
        }

        PrototypePanel(title = "Latest Export") {
            PrototypeSecondaryButton(
                text = "View Latest Structured Layout JSON",
                onClick = onViewLatestJson,
            )
        }
    }
}

@Composable
private fun PrototypeCanvasScreen(
    surface: PrototypeLayoutSurface,
    sourceType: PrototypeLayoutSourceType,
    sourceImageUri: String?,
    gridSettings: PrototypeGridSettings,
    strokes: List<PrototypeSketchStroke>,
    selectedStrokeId: String?,
    currentStroke: List<PrototypeNormalizedPoint>,
    labels: List<PrototypeSketchLabel>,
    onGridChange: (PrototypeGridSettings) -> Unit,
    onCurrentStrokeChange: (List<PrototypeNormalizedPoint>) -> Unit,
    onCommitStroke: (PrototypeSketchStroke) -> Unit,
    onSelectStroke: (String?) -> Unit,
    onUpdateStroke: (PrototypeSketchStroke) -> Unit,
    onAddElement: (PrototypeNormalizedPoint) -> Unit,
    onAddLabelRequest: (PrototypeNormalizedPoint) -> Unit,
    onEraseNearest: (PrototypeNormalizedPoint) -> Unit,
    onUndo: () -> Unit,
    onClear: () -> Unit,
    onRecognize: () -> Unit,
    onBack: () -> Unit,
) {
    var activeTool by remember { mutableStateOf(PrototypeCanvasTool.BOUNDARY) }
    var canvasZoom by remember { mutableStateOf(1f) }
    var gridSpacingText by remember(gridSettings.gridSpacing) {
        mutableStateOf(gridSettings.gridSpacing.toString())
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        RoofDrawingToolbar(
            title = if (sourceType == PrototypeLayoutSourceType.IMAGE_IMPORT) "Trace Roof Drawing" else "Roof Layout Sketch",
            activeTool = activeTool,
            onToolChange = { activeTool = it },
            gridSettings = gridSettings,
            gridSpacingText = gridSpacingText,
            onGridSpacingTextChange = { value ->
                gridSpacingText = value.filter { char -> char.isDigit() || char == '.' }
                val parsed = gridSpacingText.toFloatOrNull()
                if (parsed != null) {
                    onGridChange(gridSettings.copy(gridSpacing = parsed.coerceIn(0.025f, 0.5f)))
                }
            },
            onGridChange = onGridChange,
            zoom = canvasZoom,
            onZoomChange = { canvasZoom = it },
            onUndo = onUndo,
            onClear = onClear,
            onBack = onBack,
            onGenerate = onRecognize,
        )

        Row(
            modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            PrototypePanel(
                title = "Canvas",
                modifier = Modifier
                    .weight(4f)
                    .fillMaxHeight(),
            ) {
                DrawingCanvas(
                    surface = surface,
                    sourceImageUri = sourceImageUri,
                    grid = gridSettings,
                    strokes = strokes,
                    selectedStrokeId = selectedStrokeId,
                    currentStroke = currentStroke,
                    labels = labels,
                    activeTool = activeTool,
                    zoom = canvasZoom,
                    onCurrentStrokeChange = onCurrentStrokeChange,
                    onCommitBoundaryStroke = { points ->
                        if (points.size > 1) {
                            onCommitStroke(
                                PrototypeSketchStroke(
                                    kind = PrototypeSketchStrokeKind.BOUNDARY,
                                    points = points,
                                ),
                            )
                        }
                    },
                    onAddElement = onAddElement,
                    onAddLabelRequest = onAddLabelRequest,
                    onEraseNearest = onEraseNearest,
                    onSelectStroke = onSelectStroke,
                    onUpdateStroke = onUpdateStroke,
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                )
            }

            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                PrototypePanel(title = "Selected Object") {
                    val selectedStroke = strokes.firstOrNull { it.id == selectedStrokeId }
                    if (selectedStroke == null) {
                        Text(
                            "Choose Select, then tap or drag a line or circle.",
                            color = LaiqColors.MutedText,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    } else if (selectedStroke.kind == PrototypeSketchStrokeKind.BOUNDARY) {
                        val start = selectedStroke.points.firstOrNull()
                        val end = selectedStroke.points.lastOrNull()
                        Text(
                            "Line selected",
                            color = LaiqColors.BrandTeal,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            "Start ${start?.x?.format2()}, ${start?.y?.format2()}",
                            color = LaiqColors.MutedText,
                            style = MaterialTheme.typography.bodySmall,
                        )
                        Text(
                            "End ${end?.x?.format2()}, ${end?.y?.format2()}",
                            color = LaiqColors.MutedText,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    } else {
                        val center = selectedStroke.points.firstOrNull()
                        Text(
                            "Circle element selected",
                            color = LaiqColors.BrandTeal,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            "Center ${center?.x?.format2()}, ${center?.y?.format2()}",
                            color = LaiqColors.MutedText,
                            style = MaterialTheme.typography.bodySmall,
                        )
                        Text(
                            "Radius ${selectedStroke.elementRadius().format2()}",
                            color = LaiqColors.MutedText,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
                PrototypePanel(title = "AI Assist Draft") {
                    AssistStatusRow("Angle assist for rows/columns", gridSettings.snapEnabled)
                    AssistStatusRow("Snap close endpoints", gridSettings.snapEnabled)
                    AssistStatusRow("Create plates from closed regions", strokes.count { it.kind == PrototypeSketchStrokeKind.BOUNDARY } >= 2)
                    AssistStatusRow("Keep inspector approval required", true)
                    Text(
                        "Zoom in and draw row by row. Each line becomes a boundary; Generate Plates uses the closed confined areas.",
                        color = LaiqColors.MutedText,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }

                PrototypePanel(title = "Roof Only") {
                    Text(
                        "This prototype now focuses only on roof layout drawing and plate generation.",
                        color = LaiqColors.BodyText,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
    }
}

@Composable
private fun PrototypeReviewScreen(
    draft: PrototypeLayoutDraft?,
    sourceImageUri: String?,
    selectedPlateId: String?,
    selectedElementId: String?,
    onSelectPlate: (String) -> Unit,
    onSelectElement: (String) -> Unit,
    onDraftChange: (PrototypeLayoutDraft) -> Unit,
    onBack: () -> Unit,
    onApprove: () -> Unit,
) {
    if (draft == null) {
        EmptyState("No draft is available.", onBack)
        return
    }
    var reviewZoom by remember { mutableStateOf(1f) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PrototypeTopBar(
            title = "Customize Boundaries",
            action = "Validate & Approve",
            onBack = onBack,
            onAction = onApprove,
        )
        Row(
            modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            PrototypePanel(
                title = "Structured Layout",
                modifier = Modifier
                    .weight(4f)
                    .fillMaxHeight(),
            ) {
                DraftMapCanvas(
                    draft = draft,
                    sourceImageUri = sourceImageUri,
                    selectedPlateId = selectedPlateId,
                    selectedElementId = selectedElementId,
                    zoom = reviewZoom,
                    onSelectPlate = onSelectPlate,
                    onSelectElement = onSelectElement,
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                )
            }

            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                PrototypePanel(title = "View") {
                    ZoomControls(
                        zoom = reviewZoom,
                        onZoomChange = { reviewZoom = it },
                    )
                }
                PrototypePanel(title = "Plate Refinement") {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        PrototypeSmallButton(
                            text = "Split V",
                            onClick = {
                                selectedPlateId?.let { plateId ->
                                    onDraftChange(PrototypeLayoutGeometry.splitPlate(draft, plateId, vertical = true))
                                }
                            },
                            modifier = Modifier.weight(1f),
                        )
                        PrototypeSmallButton(
                            text = "Split H",
                            onClick = {
                                selectedPlateId?.let { plateId ->
                                    onDraftChange(PrototypeLayoutGeometry.splitPlate(draft, plateId, vertical = false))
                                }
                            },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    PrototypeSmallButton(
                        text = "Merge with Adjacent",
                        onClick = {
                            selectedPlateId?.let { plateId ->
                                onDraftChange(PrototypeLayoutGeometry.mergePlateWithFirstAdjacent(draft, plateId))
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Text(
                        "Move selected boundary",
                        style = MaterialTheme.typography.labelLarge,
                        color = LaiqColors.MutedText,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        PrototypeSmallButton(
                            "Left",
                            {
                                selectedPlateId?.let { id ->
                                    onDraftChange(PrototypeLayoutGeometry.nudgePlateBoundary(draft, id, -0.01f, 0f))
                                }
                            },
                            Modifier.weight(1f),
                        )
                        PrototypeSmallButton(
                            "Right",
                            {
                                selectedPlateId?.let { id ->
                                    onDraftChange(PrototypeLayoutGeometry.nudgePlateBoundary(draft, id, 0.01f, 0f))
                                }
                            },
                            Modifier.weight(1f),
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        PrototypeSmallButton(
                            "Up",
                            {
                                selectedPlateId?.let { id ->
                                    onDraftChange(PrototypeLayoutGeometry.nudgePlateBoundary(draft, id, 0f, -0.01f))
                                }
                            },
                            Modifier.weight(1f),
                        )
                        PrototypeSmallButton(
                            "Down",
                            {
                                selectedPlateId?.let { id ->
                                    onDraftChange(PrototypeLayoutGeometry.nudgePlateBoundary(draft, id, 0f, 0.01f))
                                }
                            },
                            Modifier.weight(1f),
                        )
                    }
                }

                PlateEditor(
                    draft = draft,
                    selectedPlateId = selectedPlateId,
                    onDraftChange = onDraftChange,
                )

                ElementEditor(
                    draft = draft,
                    selectedElementId = selectedElementId,
                    onDraftChange = onDraftChange,
                )

                PrototypePanel(title = "Draft Status") {
                    StatusBadge(draft.validation.status)
                    Text(
                        "${draft.plates.size} plates | ${draft.elements.size} elements",
                        color = LaiqColors.BodyText,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    draft.validation.errors.take(2).forEach { error ->
                        Text(error, color = LaiqColors.StatusWarning, style = MaterialTheme.typography.bodySmall)
                    }
                    draft.validation.warnings.take(2).forEach { warning ->
                        Text(warning, color = Color(0xFF8B6500), style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}

@Composable
private fun PlateEditor(
    draft: PrototypeLayoutDraft,
    selectedPlateId: String?,
    onDraftChange: (PrototypeLayoutDraft) -> Unit,
) {
    val selectedPlate = draft.plates.firstOrNull { it.id == selectedPlateId }
    var plateId by remember(selectedPlate?.id) { mutableStateOf(selectedPlate?.id.orEmpty()) }
    var plateLabel by remember(selectedPlate?.displayLabel) { mutableStateOf(selectedPlate?.displayLabel.orEmpty()) }

    PrototypePanel(title = "Selected Plate") {
        if (selectedPlate == null) {
            Text("Tap a plate on the map.", color = LaiqColors.MutedText)
            return@PrototypePanel
        }
        OutlinedTextField(
            value = plateId,
            onValueChange = { plateId = it.take(24) },
            label = { Text("Plate ID") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = plateLabel,
            onValueChange = { plateLabel = it.take(32) },
            label = { Text("Display label") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        PrototypeSmallButton(
            text = "Apply Plate Update",
            onClick = {
                onDraftChange(
                    PrototypeLayoutGeometry.updatePlateIdentity(
                        draft = draft,
                        plateId = selectedPlate.id,
                        newId = plateId,
                        newLabel = plateLabel,
                    ),
                )
            },
            modifier = Modifier.fillMaxWidth(),
        )
        Text(
            "Adjacent: ${selectedPlate.adjacentPlateIds.take(4).joinToString().ifBlank { "None" }}",
            color = LaiqColors.MutedText,
            style = MaterialTheme.typography.bodySmall,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun ElementEditor(
    draft: PrototypeLayoutDraft,
    selectedElementId: String?,
    onDraftChange: (PrototypeLayoutDraft) -> Unit,
) {
    val selectedElement = draft.elements.firstOrNull { it.id == selectedElementId }
    var elementName by remember(selectedElement?.id) { mutableStateOf(selectedElement?.name.orEmpty()) }
    var elementType by remember(selectedElement?.id) {
        mutableStateOf(selectedElement?.type ?: PrototypeElementType.UNKNOWN)
    }
    var attachedPlateId by remember(selectedElement?.id) {
        mutableStateOf(selectedElement?.attachedPlateId.orEmpty())
    }

    PrototypePanel(title = "Selected Element") {
        if (selectedElement == null) {
            Text("Tap an element marker on the map.", color = LaiqColors.MutedText)
            return@PrototypePanel
        }
        OutlinedTextField(
            value = elementName,
            onValueChange = { elementName = it.take(32) },
            label = { Text("Name") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        ElementTypeSelector(selected = elementType, onSelect = { elementType = it })
        OutlinedTextField(
            value = attachedPlateId,
            onValueChange = { attachedPlateId = it.take(32) },
            label = { Text("Attached plate ID") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        PrototypeSmallButton(
            text = "Apply Element Update",
            onClick = {
                onDraftChange(
                    PrototypeLayoutGeometry.updateElement(
                        draft = draft,
                        elementId = selectedElement.id,
                        type = elementType,
                        name = elementName,
                        attachedPlateId = attachedPlateId,
                    ),
                )
            },
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun PrototypeApprovalScreen(
    draft: PrototypeLayoutDraft?,
    exportPath: String,
    exportMessage: String,
    onBack: () -> Unit,
    onApproveAndExport: (String) -> Unit,
    onViewJson: () -> Unit,
) {
    var inspectorName by remember { mutableStateOf("Prototype Inspector") }

    if (draft == null) {
        EmptyState("No draft is available.", onBack)
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        PrototypeTopBar(
            title = "Validate Geometry",
            action = "View JSON",
            onBack = onBack,
            onAction = onViewJson,
        )
        PrototypePanel(title = "Approval Gate") {
            StatusBadge(draft.validation.status)
            OutlinedTextField(
                value = inspectorName,
                onValueChange = { inspectorName = it.take(48) },
                label = { Text("Approved by") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            PrototypePrimaryButton(
                text = "Approve Structured Draft & Export JSON",
                onClick = { onApproveAndExport(inspectorName) },
                enabled = draft.validation.status == PrototypeValidationStatus.READY,
            )
            Text(
                exportMessage.ifBlank { "Export path: $exportPath" },
                color = if (exportMessage.isBlank()) LaiqColors.MutedText else Color(0xFF1E7D4F),
                style = MaterialTheme.typography.bodySmall,
            )
        }

        PrototypePanel(title = "Validation") {
            ValidationList(
                title = "Errors",
                items = draft.validation.errors,
                emptyText = "No blocking errors.",
                color = LaiqColors.StatusWarning,
            )
            ValidationList(
                title = "Warnings",
                items = draft.validation.warnings,
                emptyText = "No warnings.",
                color = Color(0xFF8B6500),
            )
        }
    }
}

@Composable
private fun PrototypeLatestJsonScreen(
    latestJson: String?,
    latestPath: String,
    onBack: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PrototypeTopBar(
            title = "Latest Structured Layout JSON",
            action = "Back Home",
            onBack = onBack,
            onAction = onBack,
        )
        PrototypePanel(
            title = "Export",
            modifier = Modifier.fillMaxSize(),
        ) {
            Text(
                latestPath,
                color = LaiqColors.MutedText,
                style = MaterialTheme.typography.bodySmall,
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .background(Color(0xFF0F172A), RoundedCornerShape(8.dp))
                    .verticalScroll(rememberScrollState())
                    .padding(12.dp),
            ) {
                Text(
                    latestJson ?: "No exported JSON yet.",
                    color = if (latestJson == null) Color(0xFFCBD5E1) else Color(0xFFE5E7EB),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

@Composable
private fun DrawingCanvas(
    surface: PrototypeLayoutSurface,
    sourceImageUri: String?,
    grid: PrototypeGridSettings,
    strokes: List<PrototypeSketchStroke>,
    selectedStrokeId: String?,
    currentStroke: List<PrototypeNormalizedPoint>,
    labels: List<PrototypeSketchLabel>,
    activeTool: PrototypeCanvasTool,
    zoom: Float,
    onCurrentStrokeChange: (List<PrototypeNormalizedPoint>) -> Unit,
    onCommitBoundaryStroke: (List<PrototypeNormalizedPoint>) -> Unit,
    onAddElement: (PrototypeNormalizedPoint) -> Unit,
    onAddLabelRequest: (PrototypeNormalizedPoint) -> Unit,
    onEraseNearest: (PrototypeNormalizedPoint) -> Unit,
    onSelectStroke: (String?) -> Unit,
    onUpdateStroke: (PrototypeSketchStroke) -> Unit,
    modifier: Modifier = Modifier,
) {
    val imageBitmap = rememberImageBitmap(sourceImageUri)
    Canvas(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFFBFCFF), RoundedCornerShape(8.dp))
            .pointerInput(activeTool, zoom) {
                when (activeTool) {
                    PrototypeCanvasTool.BOUNDARY -> {
                        var dragPoints = emptyList<PrototypeNormalizedPoint>()
                        detectDragGestures(
                            onDragStart = { offset ->
                                val start = offset
                                    .toNormalized(size.width, size.height, zoom, surface)
                                    .snappedToBoundaryOrEndpoint(surface, strokes)
                                dragPoints = listOf(start)
                                onCurrentStrokeChange(dragPoints)
                            },
                            onDrag = { change, _ ->
                                val start = dragPoints.firstOrNull()
                                val rawEnd = change.position
                                    .toNormalized(size.width, size.height, zoom, surface)
                                val end = if (start == null) {
                                    rawEnd.snappedToBoundaryOrEndpoint(surface, strokes)
                                } else {
                                    rawEnd
                                        .withAngleAssistFrom(start, grid.snapEnabled)
                                        .snappedAsBoundaryLineEnd(start, surface, strokes)
                                }
                                dragPoints = if (start == null) listOf(end) else listOf(start, end)
                                onCurrentStrokeChange(dragPoints)
                            },
                            onDragEnd = {
                                onCommitBoundaryStroke(dragPoints)
                                dragPoints = emptyList()
                                onCurrentStrokeChange(emptyList())
                            },
                            onDragCancel = {
                                dragPoints = emptyList()
                                onCurrentStrokeChange(emptyList())
                            },
                        )
                    }
                    PrototypeCanvasTool.SELECT -> {
                        var dragTarget: PrototypeLineDragTarget? = null
                        detectDragGestures(
                            onDragStart = { offset ->
                                val point = offset.toNormalized(size.width, size.height, zoom, surface)
                                val nearest = strokes.nearestEditableStroke(point)
                                dragTarget = nearest?.let { target ->
                                    onSelectStroke(target.stroke.id)
                                    PrototypeLineDragTarget(
                                        strokeId = target.stroke.id,
                                        handle = target.handle,
                                        previousPoint = point,
                                    )
                                }
                                if (nearest == null) onSelectStroke(null)
                            },
                            onDrag = { change, _ ->
                                val target = dragTarget ?: return@detectDragGestures
                                val stroke = strokes.firstOrNull { it.id == target.strokeId } ?: return@detectDragGestures
                                val rawPoint = change.position.toNormalized(size.width, size.height, zoom, surface)
                                val point = if (
                                    stroke.kind == PrototypeSketchStrokeKind.BOUNDARY &&
                                    target.handle != PrototypeLineHandle.BODY
                                ) {
                                    val fixedPoint = if (target.handle == PrototypeLineHandle.START) {
                                        stroke.points.lastOrNull()
                                    } else {
                                        stroke.points.firstOrNull()
                                    }
                                    if (fixedPoint == null) {
                                        rawPoint
                                    } else {
                                        rawPoint
                                            .withAngleAssistFrom(fixedPoint, grid.snapEnabled)
                                            .snappedAsBoundaryLineEnd(
                                                start = fixedPoint,
                                                surface = surface,
                                                strokes = strokes.filterNot { it.id == stroke.id },
                                            )
                                    }
                                } else {
                                    rawPoint.snappedToBoundaryOrEndpoint(
                                        surface = surface,
                                        strokes = strokes.filterNot { it.id == stroke.id },
                                    )
                                }
                                val updated = stroke.adjustedByDrag(target, point)
                                onUpdateStroke(updated)
                                dragTarget = target.copy(previousPoint = point)
                            },
                            onDragEnd = { dragTarget = null },
                            onDragCancel = { dragTarget = null },
                        )
                    }
                    PrototypeCanvasTool.ERASER -> {
                        detectDragGestures(
                            onDragStart = { offset ->
                                onEraseNearest(offset.toNormalized(size.width, size.height, zoom, surface))
                            },
                            onDrag = { change, _ ->
                                onEraseNearest(change.position.toNormalized(size.width, size.height, zoom, surface))
                            },
                        )
                    }
                    else -> Unit
                }
            }
            .pointerInput(activeTool, zoom) {
                detectTapGestures { offset ->
                    val point = offset.toNormalized(size.width, size.height, zoom, surface)
                    when (activeTool) {
                        PrototypeCanvasTool.SELECT -> onSelectStroke(strokes.nearestEditableStroke(point)?.stroke?.id)
                        PrototypeCanvasTool.ELEMENT -> onAddElement(point)
                        PrototypeCanvasTool.LABEL -> onAddLabelRequest(point)
                        PrototypeCanvasTool.ERASER -> onEraseNearest(point)
                        PrototypeCanvasTool.BOUNDARY -> Unit
                    }
                }
            },
    ) {
        withTransform({ scale(zoom, zoom, pivot = center) }) {
            drawPrototypeMapBackground(surface = surface, grid = grid, imageBitmap = imageBitmap)
            drawSketchStrokes(strokes, surface, selectedStrokeId = selectedStrokeId)
            if (currentStroke.isNotEmpty()) {
                drawSketchStrokes(
                    listOf(
                        PrototypeSketchStroke(
                            kind = PrototypeSketchStrokeKind.BOUNDARY,
                            points = currentStroke,
                        ),
                    ),
                    surface = surface,
                    preview = true,
                )
            }
            drawSketchLabels(labels, surface)
        }
    }
}

@Composable
private fun DraftMapCanvas(
    draft: PrototypeLayoutDraft,
    sourceImageUri: String?,
    selectedPlateId: String?,
    selectedElementId: String?,
    zoom: Float,
    onSelectPlate: (String) -> Unit,
    onSelectElement: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val imageBitmap = rememberImageBitmap(sourceImageUri)
    Canvas(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFFBFCFF), RoundedCornerShape(8.dp))
            .pointerInput(draft, zoom) {
                detectTapGestures { offset ->
                    val point = offset.toNormalized(size.width, size.height, zoom, draft.surface)
                    val element = draft.elements.minByOrNull { it.position.distanceTo(point) }
                    if (element != null && element.position.distanceTo(point) < 0.055f) {
                        onSelectElement(element.id)
                    } else {
                        draft.plates
                            .minByOrNull { plate -> plate.center.distanceTo(point) }
                            ?.let { onSelectPlate(it.id) }
                    }
                }
            },
    ) {
        withTransform({ scale(zoom, zoom, pivot = center) }) {
            drawPrototypeMapBackground(surface = draft.surface, grid = draft.grid, imageBitmap = imageBitmap)
            drawDraftPlates(draft, selectedPlateId)
            drawDraftElements(draft, selectedElementId)
        }
    }
}

private fun DrawScope.drawPrototypeMapBackground(
    surface: PrototypeLayoutSurface,
    grid: PrototypeGridSettings,
    imageBitmap: ImageBitmap?,
) {
    val viewport = mapViewport(surface)
    imageBitmap?.let { bitmap ->
        drawImage(
            image = bitmap,
            srcOffset = IntOffset.Zero,
            srcSize = IntSize(bitmap.width, bitmap.height),
            dstOffset = IntOffset(viewport.left.toInt(), viewport.top.toInt()),
            dstSize = IntSize(viewport.width.toInt(), viewport.height.toInt()),
            alpha = 0.28f,
        )
    }

    val gridColor = Color(0xFFDDE5F0)
    val spacing = (grid.gridSpacing * min(viewport.width, viewport.height)).coerceAtLeast(12f)
    var x = viewport.left
    while (x <= viewport.right) {
        drawLine(gridColor, Offset(x, viewport.top), Offset(x, viewport.bottom), strokeWidth = 1f)
        x += spacing
    }
    var y = viewport.top
    while (y <= viewport.bottom) {
        drawLine(gridColor, Offset(viewport.left, y), Offset(viewport.right, y), strokeWidth = 1f)
        y += spacing
    }

    if (surface == PrototypeLayoutSurface.SHELL) {
        drawRect(
            color = LaiqColors.BrandTeal,
            topLeft = Offset(viewport.left, viewport.top),
            size = Size(viewport.width, viewport.height),
            style = Stroke(width = 3f),
        )
        drawTextLabel("0°", Offset(viewport.left + 8f, viewport.top + 20f), LaiqColors.BrandTeal)
        drawTextLabel("360°", Offset(viewport.right - 54f, viewport.top + 20f), LaiqColors.BrandTeal)
    } else {
        val radius = min(viewport.width, viewport.height) / 2f - 6f
        drawCircle(
            color = LaiqColors.BrandTeal,
            radius = radius,
            center = viewport.center,
            style = Stroke(width = 3f),
        )
        drawLine(
            color = LaiqColors.BrandRed,
            start = Offset(viewport.center.x, viewport.center.y - radius),
            end = Offset(viewport.center.x, viewport.center.y - radius + 42f),
            strokeWidth = 3f,
        )
        drawTextLabel("0°", Offset(viewport.center.x + 8f, viewport.center.y - radius + 22f), LaiqColors.BrandRed)
    }
}

private fun DrawScope.drawSketchStrokes(
    strokes: List<PrototypeSketchStroke>,
    surface: PrototypeLayoutSurface,
    selectedStrokeId: String? = null,
    preview: Boolean = false,
) {
    strokes.forEach { stroke ->
        when (stroke.kind) {
            PrototypeSketchStrokeKind.BOUNDARY -> {
                val selected = stroke.id == selectedStrokeId
                val points = stroke.points.map { it.toOffset(size.width, size.height, surface) }
                points.zipWithNext().forEach { (start, end) ->
                    drawLine(
                        color = when {
                            preview -> Color(0xFF2A8BD8)
                            selected -> LaiqColors.BrandRed
                            else -> LaiqColors.BrandTeal
                        },
                        start = start,
                        end = end,
                        strokeWidth = if (preview || selected) 5f else 3f,
                        cap = StrokeCap.Round,
                    )
                }
                if (selected) {
                    points.forEach { handle ->
                        drawCircle(
                            color = Color.White,
                            radius = 11f,
                            center = handle,
                        )
                        drawCircle(
                            color = LaiqColors.BrandRed,
                            radius = 11f,
                            center = handle,
                            style = Stroke(width = 3f),
                        )
                    }
                }
            }
            PrototypeSketchStrokeKind.ELEMENT -> {
                stroke.points.firstOrNull()?.let { point ->
                    val selected = stroke.id == selectedStrokeId
                    val viewport = mapViewport(surface)
                    val radiusPx = (stroke.elementRadius() * min(viewport.width, viewport.height))
                        .coerceIn(8f, 54f)
                    val center = point.toOffset(size.width, size.height, surface)
                    drawCircle(
                        color = if (selected) LaiqColors.BrandRed.copy(alpha = 0.16f) else Color(0xFF4A67A3).copy(alpha = 0.12f),
                        radius = radiusPx,
                        center = center,
                    )
                    drawCircle(
                        color = if (selected) LaiqColors.BrandRed else Color(0xFF4A67A3),
                        radius = radiusPx,
                        center = center,
                        style = Stroke(width = if (selected) 4f else 3f),
                    )
                    drawCircle(
                        color = if (selected) LaiqColors.BrandRed else Color(0xFF4A67A3),
                        radius = 5f,
                        center = center,
                    )
                    if (selected) {
                        val handle = stroke.elementRadiusHandle().toOffset(size.width, size.height, surface)
                        drawLine(
                            color = LaiqColors.BrandRed.copy(alpha = 0.55f),
                            start = center,
                            end = handle,
                            strokeWidth = 2f,
                        )
                        drawCircle(color = Color.White, radius = 9f, center = handle)
                        drawCircle(
                            color = LaiqColors.BrandRed,
                            radius = 9f,
                            center = handle,
                            style = Stroke(width = 3f),
                        )
                    }
                }
            }
        }
    }
}

private fun DrawScope.drawSketchLabels(
    labels: List<PrototypeSketchLabel>,
    surface: PrototypeLayoutSurface,
) {
    labels.forEach { label ->
        drawTextLabel(
            text = label.text,
            offset = label.position.toOffset(size.width, size.height, surface),
            color = LaiqColors.BodyText,
        )
    }
}

private fun DrawScope.drawDraftPlates(
    draft: PrototypeLayoutDraft,
    selectedPlateId: String?,
) {
    val viewport = mapViewport(draft.surface)
    val clip = if (draft.surface == PrototypeLayoutSurface.SHELL) null else Path().apply {
        addOval(
            androidx.compose.ui.geometry.Rect(
                left = viewport.left + 4f,
                top = viewport.top + 4f,
                right = viewport.right - 4f,
                bottom = viewport.bottom - 4f,
            ),
        )
    }
    fun drawPlates() {
        draft.plates.forEachIndexed { index, plate ->
            val selected = plate.id == selectedPlateId
            val path = Path().apply {
                plate.polygon.forEachIndexed { pointIndex, point ->
                    val offset = point.toOffset(size.width, size.height, draft.surface)
                    if (pointIndex == 0) moveTo(offset.x, offset.y) else lineTo(offset.x, offset.y)
                }
                close()
            }
            drawPath(
                path = path,
                color = if (selected) LaiqColors.BrandRed.copy(alpha = 0.16f) else plateFillColor(index),
            )
            drawPath(
                path = path,
                color = if (selected) LaiqColors.BrandRed else LaiqColors.BrandTeal,
                style = Stroke(width = if (selected) 4f else 2f),
            )
            drawTextLabel(
                text = plate.displayLabel,
                offset = plate.center.toOffset(size.width, size.height, draft.surface),
                color = if (selected) LaiqColors.BrandRed else LaiqColors.BodyText,
            )
        }
    }
    if (clip == null) {
        drawPlates()
    } else {
        clipPath(clip) { drawPlates() }
    }
}

private fun DrawScope.drawDraftElements(
    draft: PrototypeLayoutDraft,
    selectedElementId: String?,
) {
    draft.elements.forEach { element ->
        val center = element.position.toOffset(size.width, size.height, draft.surface)
        val selected = element.id == selectedElementId
        if (element.markerShape == PrototypeMarkerShape.SQUARE) {
            drawRect(
                color = if (selected) LaiqColors.BrandRed else Color(0xFF4A67A3),
                topLeft = Offset(center.x - 8f, center.y - 8f),
                size = Size(16f, 16f),
            )
        } else {
            drawCircle(
                color = if (selected) LaiqColors.BrandRed else Color(0xFF4A67A3),
                radius = if (selected) 10f else 8f,
                center = center,
            )
        }
        drawTextLabel(
            text = element.name,
            offset = Offset(center.x + 10f, center.y - 8f),
            color = LaiqColors.BodyText,
        )
    }
}

@Composable
private fun PrototypeHeader(
    eyebrow: String,
    title: String,
    subtitle: String,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            eyebrow,
            style = MaterialTheme.typography.labelLarge,
            color = LaiqColors.BrandRed,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            title,
            style = MaterialTheme.typography.headlineSmall,
            color = LaiqColors.BrandTeal,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            subtitle,
            style = MaterialTheme.typography.bodyMedium,
            color = LaiqColors.MutedText,
        )
    }
}

@Composable
private fun PrototypeTopBar(
    title: String,
    action: String,
    onBack: () -> Unit,
    onAction: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedButton(onClick = onBack, shape = RoundedCornerShape(8.dp)) {
            Text("Back")
        }
        Text(
            title,
            modifier = Modifier.weight(1f),
            style = MaterialTheme.typography.titleLarge,
            color = LaiqColors.BrandTeal,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Button(
            onClick = onAction,
            shape = RoundedCornerShape(8.dp),
            colors = ButtonDefaults.buttonColors(containerColor = LaiqColors.BrandRed),
        ) {
            Text(action)
        }
    }
}

@Composable
private fun RoofDrawingToolbar(
    title: String,
    activeTool: PrototypeCanvasTool,
    onToolChange: (PrototypeCanvasTool) -> Unit,
    gridSettings: PrototypeGridSettings,
    gridSpacingText: String,
    onGridSpacingTextChange: (String) -> Unit,
    onGridChange: (PrototypeGridSettings) -> Unit,
    zoom: Float,
    onZoomChange: (Float) -> Unit,
    onUndo: () -> Unit,
    onClear: () -> Unit,
    onBack: () -> Unit,
    onGenerate: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color.White,
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Row(
            modifier = Modifier
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 10.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedButton(onClick = onBack, shape = RoundedCornerShape(8.dp)) {
                Text("Home")
            }
            Text(
                title,
                modifier = Modifier.width(150.dp),
                color = LaiqColors.BrandTeal,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            listOf(
                PrototypeCanvasTool.SELECT to "Select",
                PrototypeCanvasTool.BOUNDARY to "Line",
                PrototypeCanvasTool.ELEMENT to "Element",
                PrototypeCanvasTool.LABEL to "Text",
                PrototypeCanvasTool.ERASER to "Erase",
            ).forEach { (tool, label) ->
                PrototypeToolbarButton(
                    label = label,
                    selected = activeTool == tool,
                    onClick = { onToolChange(tool) },
                )
            }
            Spacer(modifier = Modifier.width(8.dp))
            OutlinedTextField(
                value = gridSettings.unitLabel,
                onValueChange = { onGridChange(gridSettings.copy(unitLabel = it.take(8))) },
                label = { Text("Unit") },
                singleLine = true,
                modifier = Modifier.width(78.dp),
            )
            OutlinedTextField(
                value = gridSpacingText,
                onValueChange = onGridSpacingTextChange,
                label = { Text("Grid") },
                singleLine = true,
                modifier = Modifier.width(86.dp),
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Snap", color = LaiqColors.MutedText, style = MaterialTheme.typography.labelMedium)
                Switch(
                    checked = gridSettings.snapEnabled,
                    onCheckedChange = { onGridChange(gridSettings.copy(snapEnabled = it)) },
                )
            }
            PrototypeToolbarButton(
                label = "-",
                selected = false,
                onClick = { onZoomChange((zoom - MAP_ZOOM_STEP).coerceIn(MIN_MAP_ZOOM, MAX_MAP_ZOOM)) },
            )
            Text(
                "${(zoom * 100f).toInt()}%",
                color = LaiqColors.BodyText,
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.width(42.dp),
            )
            PrototypeToolbarButton(
                label = "+",
                selected = false,
                onClick = { onZoomChange((zoom + MAP_ZOOM_STEP).coerceIn(MIN_MAP_ZOOM, MAX_MAP_ZOOM)) },
            )
            PrototypeToolbarButton(label = "Undo", selected = false, onClick = onUndo)
            PrototypeToolbarButton(label = "Clear", selected = false, onClick = onClear)
            Button(
                onClick = onGenerate,
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = LaiqColors.BrandRed),
            ) {
                Text("Generate Plates")
            }
        }
    }
}

@Composable
private fun PrototypeToolbarButton(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        color = if (selected) LaiqColors.BrandTeal else Color.White,
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, if (selected) LaiqColors.BrandTeal else LaiqColors.PanelBorder),
    ) {
        Text(
            label,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            color = if (selected) Color.White else LaiqColors.BodyText,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
            maxLines = 1,
        )
    }
}

@Composable
private fun PrototypePanel(
    title: String,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                title,
                style = MaterialTheme.typography.titleSmall,
                color = LaiqColors.BrandTeal,
                fontWeight = FontWeight.SemiBold,
            )
            content()
        }
    }
}

@Composable
private fun SurfaceSelector(
    selectedSurface: PrototypeLayoutSurface,
    onSurfaceChange: (PrototypeLayoutSurface) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PrototypeChip(
                label = "External Roof",
                selected = selectedSurface == PrototypeLayoutSurface.EXTERNAL_ROOF,
                onClick = { onSurfaceChange(PrototypeLayoutSurface.EXTERNAL_ROOF) },
                modifier = Modifier.weight(1f),
            )
            PrototypeChip(
                label = "Internal Roof",
                selected = selectedSurface == PrototypeLayoutSurface.INTERNAL_ROOF,
                onClick = { onSurfaceChange(PrototypeLayoutSurface.INTERNAL_ROOF) },
                modifier = Modifier.weight(1f),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PrototypeChip(
                label = "Floor",
                selected = selectedSurface == PrototypeLayoutSurface.FLOOR,
                onClick = { onSurfaceChange(PrototypeLayoutSurface.FLOOR) },
                modifier = Modifier.weight(1f),
            )
            PrototypeChip(
                label = "Shell",
                selected = selectedSurface == PrototypeLayoutSurface.SHELL,
                onClick = { onSurfaceChange(PrototypeLayoutSurface.SHELL) },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun ToolSelector(
    activeTool: PrototypeCanvasTool,
    onToolChange: (PrototypeCanvasTool) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PrototypeChip(
                label = "Add Boundary",
                selected = activeTool == PrototypeCanvasTool.BOUNDARY,
                onClick = { onToolChange(PrototypeCanvasTool.BOUNDARY) },
                modifier = Modifier.weight(1f),
            )
            PrototypeChip(
                label = "Element",
                selected = activeTool == PrototypeCanvasTool.ELEMENT,
                onClick = { onToolChange(PrototypeCanvasTool.ELEMENT) },
                modifier = Modifier.weight(1f),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PrototypeChip(
                label = "Label",
                selected = activeTool == PrototypeCanvasTool.LABEL,
                onClick = { onToolChange(PrototypeCanvasTool.LABEL) },
                modifier = Modifier.weight(1f),
            )
            PrototypeChip(
                label = "Eraser",
                selected = activeTool == PrototypeCanvasTool.ERASER,
                onClick = { onToolChange(PrototypeCanvasTool.ERASER) },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun ElementTypeSelector(
    selected: PrototypeElementType,
    onSelect: (PrototypeElementType) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(
                PrototypeElementType.NOZZLE,
                PrototypeElementType.MANHOLE,
                PrototypeElementType.PATCH,
            ).forEach { type ->
                PrototypeChip(
                    label = type.label,
                    selected = selected == type,
                    onClick = { onSelect(type) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(
                PrototypeElementType.STAIR,
                PrototypeElementType.DRAIN,
                PrototypeElementType.UNKNOWN,
            ).forEach { type ->
                PrototypeChip(
                    label = type.label,
                    selected = selected == type,
                    onClick = { onSelect(type) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun PrototypeChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.clickable(onClick = onClick),
        color = if (selected) LaiqColors.BrandTeal else Color.White,
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, if (selected) LaiqColors.BrandTeal else LaiqColors.PanelBorder),
    ) {
        Text(
            label,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
            color = if (selected) Color.White else LaiqColors.BodyText,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun PrototypePrimaryButton(
    text: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.buttonColors(containerColor = LaiqColors.BrandRed),
    ) {
        Text(text, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun PrototypeSecondaryButton(
    text: String,
    onClick: () -> Unit,
) {
    OutlinedButton(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Text(text, color = LaiqColors.BrandTeal, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun PrototypeSmallButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Text(text, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun ZoomControls(
    zoom: Float,
    onZoomChange: (Float) -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        PrototypeSmallButton(
            text = "-",
            onClick = { onZoomChange((zoom - MAP_ZOOM_STEP).coerceIn(MIN_MAP_ZOOM, MAX_MAP_ZOOM)) },
            modifier = Modifier.weight(1f),
        )
        PrototypeSmallButton(
            text = "100%",
            onClick = { onZoomChange(1f) },
            modifier = Modifier.weight(1f),
        )
        PrototypeSmallButton(
            text = "+",
            onClick = { onZoomChange((zoom + MAP_ZOOM_STEP).coerceIn(MIN_MAP_ZOOM, MAX_MAP_ZOOM)) },
            modifier = Modifier.weight(1f),
        )
    }
    Text(
        "${(zoom * 100f).toInt()}% zoom",
        color = LaiqColors.MutedText,
        style = MaterialTheme.typography.bodySmall,
    )
}

@Composable
private fun AssistStatusRow(
    label: String,
    active: Boolean,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(
            modifier = Modifier
                .size(10.dp)
                .background(if (active) Color(0xFF1E7D4F) else Color(0xFFCBD5E1), CircleShape),
        )
        Text(label, color = LaiqColors.BodyText, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun StatusBadge(status: PrototypeValidationStatus) {
    val color = when (status) {
        PrototypeValidationStatus.READY -> Color(0xFF1E7D4F)
        PrototypeValidationStatus.BLOCKED -> LaiqColors.StatusWarning
        PrototypeValidationStatus.DRAFT -> LaiqColors.MutedText
    }
    Surface(
        color = color.copy(alpha = 0.1f),
        border = BorderStroke(1.dp, color.copy(alpha = 0.35f)),
        shape = RoundedCornerShape(8.dp),
    ) {
        Text(
            status.label,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            color = color,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun ValidationList(
    title: String,
    items: List<String>,
    emptyText: String,
    color: Color,
) {
    Text(title, color = LaiqColors.BrandTeal, fontWeight = FontWeight.SemiBold)
    if (items.isEmpty()) {
        Text(emptyText, color = LaiqColors.MutedText, style = MaterialTheme.typography.bodySmall)
    } else {
        items.forEach { item ->
            Text(item, color = color, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun EmptyState(
    text: String,
    onBack: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(80.dp))
        Text(text, color = LaiqColors.BodyText)
        PrototypeSecondaryButton(text = "Back", onClick = onBack)
    }
}

@Composable
private fun rememberImageBitmap(uriString: String?): ImageBitmap? {
    val context = LocalContext.current
    return remember(uriString) {
        uriString?.let { raw ->
            runCatching {
                context.contentResolver.openInputStream(Uri.parse(raw)).use { stream ->
                    BitmapFactory.decodeStream(stream)?.asImageBitmap()
                }
            }.getOrNull()
        }
    }
}

private fun DrawScope.drawTextLabel(
    text: String,
    offset: Offset,
    color: Color,
) {
    drawContext.canvas.nativeCanvas.drawText(
        text,
        offset.x,
        offset.y,
        Paint().apply {
            isAntiAlias = true
            textSize = 24f
            this.color = color.toArgb()
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        },
    )
}

private fun Offset.toNormalized(
    width: Int,
    height: Int,
    zoom: Float,
    surface: PrototypeLayoutSurface,
): PrototypeNormalizedPoint {
    val safeWidth = max(1, width).toFloat()
    val safeHeight = max(1, height).toFloat()
    val safeZoom = zoom.coerceIn(MIN_MAP_ZOOM, MAX_MAP_ZOOM)
    val centerX = safeWidth / 2f
    val centerY = safeHeight / 2f
    val unzoomedX = ((x - centerX) / safeZoom) + centerX
    val unzoomedY = ((y - centerY) / safeZoom) + centerY
    val viewport = mapViewport(safeWidth, safeHeight, surface)
    return PrototypeNormalizedPoint(
        x = (unzoomedX - viewport.left) / viewport.width,
        y = (unzoomedY - viewport.top) / viewport.height,
    ).clamped()
}

private fun PrototypeNormalizedPoint.toOffset(
    width: Float,
    height: Float,
    surface: PrototypeLayoutSurface,
): Offset =
    mapViewport(width, height, surface).let { viewport ->
        Offset(
            viewport.left + x * viewport.width,
            viewport.top + y * viewport.height,
        )
    }

private fun DrawScope.mapViewport(surface: PrototypeLayoutSurface): PrototypeMapViewport =
    mapViewport(size.width, size.height, surface)

private fun mapViewport(
    width: Float,
    height: Float,
    surface: PrototypeLayoutSurface,
): PrototypeMapViewport {
    if (surface == PrototypeLayoutSurface.SHELL) {
        return PrototypeMapViewport(left = 0f, top = 0f, width = width, height = height)
    }
    val side = (min(width, height) - 12f).coerceAtLeast(1f)
    return PrototypeMapViewport(
        left = (width - side) / 2f,
        top = (height - side) / 2f,
        width = side,
        height = side,
    )
}

private fun PrototypeNormalizedPoint.distanceTo(other: PrototypeNormalizedPoint): Float =
    hypot(x - other.x, y - other.y)

private fun List<PrototypeSketchStroke>.nearestEditableStroke(
    point: PrototypeNormalizedPoint,
): PrototypeNearestStroke? =
    mapNotNull { stroke ->
        when (stroke.kind) {
            PrototypeSketchStrokeKind.BOUNDARY -> stroke.nearestBoundaryHit(point)
            PrototypeSketchStrokeKind.ELEMENT -> stroke.nearestElementHit(point)
        }
    }
        .minByOrNull { nearest -> nearest.distance }

private fun PrototypeSketchStroke.nearestBoundaryHit(
    point: PrototypeNormalizedPoint,
): PrototypeNearestStroke? {
    if (points.size < 2) return null
    val start = points.first()
    val end = points.last()
    val startDistance = point.distanceTo(start)
    val endDistance = point.distanceTo(end)
    val segmentDistance = point.distanceToSegment(start, end)
    return when {
        startDistance <= LINE_ENDPOINT_HIT_TOLERANCE ->
            PrototypeNearestStroke(this, PrototypeLineHandle.START, startDistance)
        endDistance <= LINE_ENDPOINT_HIT_TOLERANCE ->
            PrototypeNearestStroke(this, PrototypeLineHandle.END, endDistance)
        segmentDistance <= LINE_SEGMENT_HIT_TOLERANCE ->
            PrototypeNearestStroke(this, PrototypeLineHandle.BODY, segmentDistance)
        else -> null
    }
}

private fun PrototypeSketchStroke.nearestElementHit(
    point: PrototypeNormalizedPoint,
): PrototypeNearestStroke? {
    val center = points.firstOrNull() ?: return null
    val handle = elementRadiusHandle()
    val handleDistance = point.distanceTo(handle)
    if (handleDistance <= ELEMENT_RESIZE_HIT_TOLERANCE) {
        return PrototypeNearestStroke(this, PrototypeLineHandle.RESIZE, handleDistance)
    }
    val centerDistance = point.distanceTo(center)
    return if (centerDistance <= max(ELEMENT_CENTER_HIT_TOLERANCE, elementRadius())) {
        PrototypeNearestStroke(this, PrototypeLineHandle.CENTER, centerDistance)
    } else {
        null
    }
}

private fun PrototypeNormalizedPoint.distanceToSegment(
    start: PrototypeNormalizedPoint,
    end: PrototypeNormalizedPoint,
): Float {
    val dx = end.x - start.x
    val dy = end.y - start.y
    val lengthSquared = dx * dx + dy * dy
    if (lengthSquared <= 0.000001f) return distanceTo(start)
    val t = (((x - start.x) * dx + (y - start.y) * dy) / lengthSquared).coerceIn(0f, 1f)
    val projection = PrototypeNormalizedPoint(
        x = start.x + t * dx,
        y = start.y + t * dy,
    )
    return distanceTo(projection)
}

private fun PrototypeSketchStroke.adjustedByDrag(
    target: PrototypeLineDragTarget,
    point: PrototypeNormalizedPoint,
): PrototypeSketchStroke {
    if (kind == PrototypeSketchStrokeKind.ELEMENT) {
        return adjustedElementByDrag(target, point)
    }
    val start = points.firstOrNull() ?: return this
    val end = points.lastOrNull() ?: return this
    val updatedPoints = when (target.handle) {
        PrototypeLineHandle.START -> listOf(point, end)
        PrototypeLineHandle.END -> listOf(start, point)
        PrototypeLineHandle.BODY -> {
            val dx = point.x - target.previousPoint.x
            val dy = point.y - target.previousPoint.y
            listOf(
                PrototypeNormalizedPoint(start.x + dx, start.y + dy).clamped(),
                PrototypeNormalizedPoint(end.x + dx, end.y + dy).clamped(),
            )
        }
        PrototypeLineHandle.CENTER,
        PrototypeLineHandle.RESIZE -> points
    }
    return copy(points = updatedPoints)
}

private fun PrototypeSketchStroke.adjustedElementByDrag(
    target: PrototypeLineDragTarget,
    point: PrototypeNormalizedPoint,
): PrototypeSketchStroke {
    val center = points.firstOrNull() ?: return this
    val radiusHandle = elementRadiusHandle()
    return when (target.handle) {
        PrototypeLineHandle.RESIZE -> copy(
            points = listOf(
                center,
                point.coercedToElementRadius(center),
            ),
        )
        PrototypeLineHandle.CENTER,
        PrototypeLineHandle.BODY -> {
            val dx = point.x - target.previousPoint.x
            val dy = point.y - target.previousPoint.y
            copy(
                points = listOf(
                    PrototypeNormalizedPoint(center.x + dx, center.y + dy).clamped(),
                    PrototypeNormalizedPoint(radiusHandle.x + dx, radiusHandle.y + dy).clamped(),
                ),
            )
        }
        PrototypeLineHandle.START,
        PrototypeLineHandle.END -> this
    }
}

private fun PrototypeNormalizedPoint.coercedToElementRadius(
    center: PrototypeNormalizedPoint,
): PrototypeNormalizedPoint {
    val dx = x - center.x
    val dy = y - center.y
    val distance = hypot(dx, dy)
    if (distance <= 0.0001f) {
        return PrototypeNormalizedPoint(center.x + DEFAULT_ELEMENT_RADIUS, center.y).clamped()
    }
    val radius = distance.coerceIn(MIN_ELEMENT_RADIUS, MAX_ELEMENT_RADIUS)
    val scale = radius / distance
    return PrototypeNormalizedPoint(
        x = center.x + dx * scale,
        y = center.y + dy * scale,
    ).clamped()
}

private fun PrototypeSketchStroke.elementRadius(): Float {
    val center = points.firstOrNull() ?: return DEFAULT_ELEMENT_RADIUS
    val handle = points.getOrNull(1) ?: return DEFAULT_ELEMENT_RADIUS
    return center.distanceTo(handle).coerceIn(MIN_ELEMENT_RADIUS, MAX_ELEMENT_RADIUS)
}

private fun PrototypeSketchStroke.elementRadiusHandle(): PrototypeNormalizedPoint {
    val center = points.firstOrNull() ?: return PrototypeNormalizedPoint(0.5f, 0.5f)
    return points.getOrNull(1) ?: center.defaultElementRadiusHandle()
}

private fun PrototypeNormalizedPoint.defaultElementRadiusHandle(): PrototypeNormalizedPoint =
    PrototypeNormalizedPoint(x + DEFAULT_ELEMENT_RADIUS, y).clamped()

private fun Float.format2(): String =
    "%.2f".format(this)

private fun PrototypeNormalizedPoint.withAngleAssistFrom(
    start: PrototypeNormalizedPoint,
    enabled: Boolean,
): PrototypeNormalizedPoint {
    if (!enabled) return this
    val dx = x - start.x
    val dy = y - start.y
    val length = hypot(dx, dy)
    if (length < MIN_ASSIST_LINE_LENGTH) return this

    return when {
        abs(dy) / length <= ANGLE_ASSIST_SIN_TOLERANCE ->
            copy(y = start.y).clamped()
        abs(dx) / length <= ANGLE_ASSIST_SIN_TOLERANCE ->
            copy(x = start.x).clamped()
        else -> this
    }
}

private fun PrototypeNormalizedPoint.snappedAsBoundaryLineEnd(
    start: PrototypeNormalizedPoint,
    surface: PrototypeLayoutSurface,
    strokes: List<PrototypeSketchStroke>,
): PrototypeNormalizedPoint {
    val endpoint = strokes
        .boundaryEndpoints()
        .minByOrNull { endpoint -> endpoint.distanceTo(this) }
    if (endpoint != null && endpoint.distanceTo(this) <= ENDPOINT_SNAP_TOLERANCE) {
        return endpoint
    }
    if (surface == PrototypeLayoutSurface.SHELL) return this
    return snappedToCircularBoundaryAlongLine(start)
}

private fun PrototypeNormalizedPoint.snappedToBoundaryOrEndpoint(
    surface: PrototypeLayoutSurface,
    strokes: List<PrototypeSketchStroke>,
): PrototypeNormalizedPoint {
    val endpoint = strokes
        .boundaryEndpoints()
        .minByOrNull { endpoint -> endpoint.distanceTo(this) }
    if (endpoint != null && endpoint.distanceTo(this) <= ENDPOINT_SNAP_TOLERANCE) {
        return endpoint
    }
    if (surface == PrototypeLayoutSurface.SHELL) return this
    return snappedToCircularBoundary()
}

private fun List<PrototypeSketchStroke>.boundaryEndpoints(): List<PrototypeNormalizedPoint> =
    filter { stroke -> stroke.kind == PrototypeSketchStrokeKind.BOUNDARY }
        .flatMap { stroke -> listOfNotNull(stroke.points.firstOrNull(), stroke.points.lastOrNull()) }

private fun PrototypeNormalizedPoint.snappedToCircularBoundary(): PrototypeNormalizedPoint {
    val dx = x - 0.5f
    val dy = y - 0.5f
    val distance = hypot(dx, dy)
    if (distance <= 0.0001f) return this
    val nearBoundary = abs(distance - ROOF_BOUNDARY_RADIUS) <= ROOF_BOUNDARY_SNAP_TOLERANCE
    val outsideBoundary = distance > ROOF_BOUNDARY_RADIUS
    if (!nearBoundary && !outsideBoundary) return this
    val scale = ROOF_BOUNDARY_RADIUS / distance
    return PrototypeNormalizedPoint(
        x = 0.5f + dx * scale,
        y = 0.5f + dy * scale,
    ).clamped()
}

private fun PrototypeNormalizedPoint.snappedToCircularBoundaryAlongLine(
    start: PrototypeNormalizedPoint,
): PrototypeNormalizedPoint {
    val distanceFromCenter = distanceFromRoofCenter()
    val nearBoundary = abs(distanceFromCenter - ROOF_BOUNDARY_RADIUS) <= ROOF_BOUNDARY_SNAP_TOLERANCE
    val outsideBoundary = distanceFromCenter > ROOF_BOUNDARY_RADIUS
    if (!nearBoundary && !outsideBoundary) return this

    val dx = x - start.x
    val dy = y - start.y
    val a = dx * dx + dy * dy
    if (a <= 0.000001f) return snappedToCircularBoundary()
    val startX = start.x - 0.5f
    val startY = start.y - 0.5f
    val b = 2f * (startX * dx + startY * dy)
    val c = startX * startX + startY * startY - ROOF_BOUNDARY_RADIUS * ROOF_BOUNDARY_RADIUS
    val discriminant = b * b - 4f * a * c
    if (discriminant < 0f) return snappedToCircularBoundary()

    val sqrtDiscriminant = kotlin.math.sqrt(discriminant)
    val roots = listOf(
        (-b - sqrtDiscriminant) / (2f * a),
        (-b + sqrtDiscriminant) / (2f * a),
    )
    val targetT = roots
        .filter { t -> t > 0.02f && t <= 1.35f }
        .minByOrNull { t -> abs(t - 1f) }
        ?: return snappedToCircularBoundary()
    return PrototypeNormalizedPoint(
        x = start.x + dx * targetT,
        y = start.y + dy * targetT,
    ).clamped()
}

private fun PrototypeNormalizedPoint.distanceFromRoofCenter(): Float =
    hypot(x - 0.5f, y - 0.5f)

private data class PrototypeMapViewport(
    val left: Float,
    val top: Float,
    val width: Float,
    val height: Float,
) {
    val right: Float = left + width
    val bottom: Float = top + height
    val center: Offset = Offset(left + width / 2f, top + height / 2f)
}

private data class PrototypeNearestStroke(
    val stroke: PrototypeSketchStroke,
    val handle: PrototypeLineHandle,
    val distance: Float,
)

private data class PrototypeLineDragTarget(
    val strokeId: String,
    val handle: PrototypeLineHandle,
    val previousPoint: PrototypeNormalizedPoint,
)

private enum class PrototypeLineHandle {
    START,
    END,
    BODY,
    CENTER,
    RESIZE,
}

private fun List<PrototypeSketchStroke>.erasedAt(
    point: PrototypeNormalizedPoint,
): List<PrototypeSketchStroke> {
    var changed = false
    val nextStrokes = flatMap { stroke ->
        when (stroke.kind) {
            PrototypeSketchStrokeKind.BOUNDARY -> {
                val remaining = stroke.erasedBoundaryAt(point)
                if (remaining.size != 1 || remaining.firstOrNull() != stroke) changed = true
                remaining
            }
            PrototypeSketchStrokeKind.ELEMENT -> {
                if (stroke.nearestElementHit(point) != null) {
                    changed = true
                    emptyList()
                } else {
                    listOf(stroke)
                }
            }
        }
    }
    return if (changed) nextStrokes else this
}

private fun PrototypeSketchStroke.erasedBoundaryAt(
    point: PrototypeNormalizedPoint,
): List<PrototypeSketchStroke> {
    val start = points.firstOrNull() ?: return listOf(this)
    val end = points.lastOrNull() ?: return listOf(this)
    if (point.distanceToSegment(start, end) > ERASER_RADIUS) return listOf(this)
    val length = start.distanceTo(end)
    if (length <= ERASER_RADIUS) return emptyList()

    val centerT = point.projectParameterOnSegment(start, end)
    val eraseT = (ERASER_RADIUS / length).coerceIn(0.02f, 0.48f)
    val keepBeforeEnd = (centerT - eraseT).coerceIn(0f, 1f)
    val keepAfterStart = (centerT + eraseT).coerceIn(0f, 1f)
    val fragments = mutableListOf<PrototypeSketchStroke>()
    if (keepBeforeEnd > MIN_REMAINING_SEGMENT_T) {
        val newEnd = start.interpolate(end, keepBeforeEnd)
        if (start.distanceTo(newEnd) >= MIN_REMAINING_SEGMENT_LENGTH) {
            fragments += copy(points = listOf(start, newEnd))
        }
    }
    if (1f - keepAfterStart > MIN_REMAINING_SEGMENT_T) {
        val newStart = start.interpolate(end, keepAfterStart)
        if (newStart.distanceTo(end) >= MIN_REMAINING_SEGMENT_LENGTH) {
            fragments += PrototypeSketchStroke(
                kind = kind,
                points = listOf(newStart, end),
            )
        }
    }
    return fragments
}

private fun PrototypeNormalizedPoint.projectParameterOnSegment(
    start: PrototypeNormalizedPoint,
    end: PrototypeNormalizedPoint,
): Float {
    val dx = end.x - start.x
    val dy = end.y - start.y
    val lengthSquared = dx * dx + dy * dy
    if (lengthSquared <= 0.000001f) return 0f
    return (((x - start.x) * dx + (y - start.y) * dy) / lengthSquared).coerceIn(0f, 1f)
}

private fun PrototypeNormalizedPoint.interpolate(
    end: PrototypeNormalizedPoint,
    t: Float,
): PrototypeNormalizedPoint =
    PrototypeNormalizedPoint(
        x = x + (end.x - x) * t,
        y = y + (end.y - y) * t,
    ).clamped()

private fun List<PrototypeSketchLabel>.removeNearestLabel(
    point: PrototypeNormalizedPoint,
): List<PrototypeSketchLabel> {
    val nearest = minByOrNull { label -> label.position.distanceTo(point) } ?: return this
    return if (nearest.position.distanceTo(point) < 0.12f) {
        filterNot { it.id == nearest.id }
    } else {
        this
    }
}

private fun PrototypeLayoutSurface.asCircularSurface(): PrototypeLayoutSurface =
    when (this) {
        PrototypeLayoutSurface.SHELL -> PrototypeLayoutSurface.EXTERNAL_ROOF
        else -> this
    }

private fun plateFillColor(index: Int): Color {
    val colors = listOf(
        Color(0xFFEAF3FF),
        Color(0xFFF0F7EA),
        Color(0xFFFFF5E1),
        Color(0xFFF7ECFF),
        Color(0xFFEAF8F7),
    )
    return colors[index % colors.size].copy(alpha = 0.78f)
}

private enum class PrototypeScreen {
    HOME,
    CANVAS,
    REVIEW,
    APPROVAL,
    JSON_VIEWER,
}

private enum class PrototypeCanvasTool {
    SELECT,
    BOUNDARY,
    ELEMENT,
    LABEL,
    ERASER,
}

private const val MIN_MAP_ZOOM = 0.75f
private const val MAX_MAP_ZOOM = 3.0f
private const val MAP_ZOOM_STEP = 0.25f
private const val ROOF_BOUNDARY_RADIUS = 0.5f
private const val ROOF_BOUNDARY_SNAP_TOLERANCE = 0.09f
private const val ENDPOINT_SNAP_TOLERANCE = 0.045f
private const val LINE_ENDPOINT_HIT_TOLERANCE = 0.055f
private const val LINE_SEGMENT_HIT_TOLERANCE = 0.035f
private const val MIN_ASSIST_LINE_LENGTH = 0.035f
private const val ANGLE_ASSIST_SIN_TOLERANCE = 0.16f
private const val DEFAULT_ELEMENT_RADIUS = 0.045f
private const val MIN_ELEMENT_RADIUS = 0.02f
private const val MAX_ELEMENT_RADIUS = 0.18f
private const val ELEMENT_CENTER_HIT_TOLERANCE = 0.055f
private const val ELEMENT_RESIZE_HIT_TOLERANCE = 0.05f
private const val ERASER_RADIUS = 0.035f
private const val MIN_REMAINING_SEGMENT_T = 0.025f
private const val MIN_REMAINING_SEGMENT_LENGTH = 0.025f

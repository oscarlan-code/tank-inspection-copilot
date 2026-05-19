package ai.laiq.tankinspection.presentation.screens

import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.RoofLayoutDraftInput
import ai.laiq.tankinspection.presentation.activeRoofSurfaceConfig
import ai.laiq.tankinspection.presentation.assignRoofFeatureDraftPlate
import ai.laiq.tankinspection.presentation.assignRoofFeatureDraftPosition
import ai.laiq.tankinspection.presentation.availableRoofSurfaces
import ai.laiq.tankinspection.presentation.buildRoofLayoutOrNull
import ai.laiq.tankinspection.presentation.buildRoofLinkTargets
import ai.laiq.tankinspection.presentation.canvasPointToRoofPolar
import ai.laiq.tankinspection.presentation.circularPlateRowCounts
import ai.laiq.tankinspection.presentation.clearRoofFeatureDraftPosition
import ai.laiq.tankinspection.presentation.committedScopeBaseline
import ai.laiq.tankinspection.presentation.committedSetupState
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqCountField
import ai.laiq.tankinspection.presentation.components.LaiqDeleteConfirmDialog
import ai.laiq.tankinspection.presentation.components.LaiqDeleteDialogState
import ai.laiq.tankinspection.presentation.components.LaiqDropdownField
import ai.laiq.tankinspection.presentation.components.LaiqLabeledValue
import ai.laiq.tankinspection.presentation.components.LaiqPlacementAdjustPad
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatChip
import ai.laiq.tankinspection.presentation.components.RoofMapMarker
import ai.laiq.tankinspection.presentation.components.RoofSurfaceMap
import ai.laiq.tankinspection.presentation.editRoofFeatureType
import ai.laiq.tankinspection.presentation.generatedRoofFeatureLabel
import ai.laiq.tankinspection.presentation.hasSavedRoofLayout
import ai.laiq.tankinspection.presentation.isReadyForInspection
import ai.laiq.tankinspection.presentation.normalizedActiveRoofSurfaceId
import ai.laiq.tankinspection.presentation.nearestRoofPlateId
import ai.laiq.tankinspection.presentation.parseNormalizedDecimal
import ai.laiq.tankinspection.presentation.parsePositiveWholeNumber
import ai.laiq.tankinspection.presentation.roofFeatureTypeLabel
import ai.laiq.tankinspection.presentation.roofFeatureTypeOptionsForSurface
import ai.laiq.tankinspection.presentation.roofFeatureUsesCenterPlacement
import ai.laiq.tankinspection.presentation.roofPlateIdAtPolar
import ai.laiq.tankinspection.presentation.roofPolarToCanvasPoint
import ai.laiq.tankinspection.presentation.roofReferenceLabel
import ai.laiq.tankinspection.presentation.referenceAzimuthDeg
import ai.laiq.tankinspection.presentation.removeRoofFeatureType
import ai.laiq.tankinspection.presentation.saveRoofFeatureDraft
import ai.laiq.tankinspection.presentation.selectRoofFeatureType
import ai.laiq.tankinspection.presentation.updateRoofFeatureDraftCount
import ai.laiq.tankinspection.presentation.usesMarkerReference
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

@Composable
fun RoofLayoutScreen(
    draftState: FieldDraftState,
    onDraftStateChange: (FieldDraftState) -> Unit,
    onBack: () -> Unit,
    contentPadding: PaddingValues,
) {
    val committedScope = draftState.committedScopeBaseline()
    val roofSurfaceId = draftState.normalizedActiveRoofSurfaceId()
    val roofSurfaceConfig = draftState.activeRoofSurfaceConfig()
    val roofSurfaceOptions = draftState.committedSetupState().availableRoofSurfaces()
    val roofLayout = draftState.buildRoofLayoutOrNull(roofSurfaceId)
    val hasSavedLayout = draftState.hasSavedRoofLayout(roofSurfaceId)
    val roofSurfaceKind = roofSurfaceConfig?.surfaceKind ?: "fixed"
    val roofReferenceLabel = committedScope.roofReferenceLabel()
    val roofReferenceAzimuth = committedScope.referenceAzimuthDeg()
    val roofReferenceRemark = committedScope.referenceRemark.trim().takeIf {
        committedScope.usesMarkerReference() && it.isNotBlank()
    }
    val draftFeatureCount = when {
        roofFeatureUsesCenterPlacement(draftState.roofFeatureDraft.type) -> 1
        else -> draftState.roofFeatureDraft.quantity.toIntOrNull()?.takeIf { it > 0 } ?: 0
    }
    val draftFeatureLinks = (draftState.roofFeatureDraft.linkedPlateIds + List(maxOf(0, draftFeatureCount - draftState.roofFeatureDraft.linkedPlateIds.size)) { "" })
        .take(draftFeatureCount.coerceAtLeast(1))
    val draftFeatureAzimuths = (draftState.roofFeatureDraft.azimuthDegrees + List(maxOf(0, draftFeatureCount - draftState.roofFeatureDraft.azimuthDegrees.size)) { "" })
        .take(draftFeatureCount.coerceAtLeast(1))
    val draftFeatureRadii = (draftState.roofFeatureDraft.radiusRatios + List(maxOf(0, draftFeatureCount - draftState.roofFeatureDraft.radiusRatios.size)) { "" })
        .take(draftFeatureCount.coerceAtLeast(1))
    val surfaceFeatures = draftState.roofFeatures.filter { feature -> feature.roofSurfaceId == roofSurfaceId }
    val savedFeatureGroups = surfaceFeatures
        .groupBy { feature -> feature.type }
        .toList()
        .sortedBy { (type, _) -> roofFeatureTypeLabel(type) }
    val plateOptions = roofLayout?.let { layout ->
        buildRoofLinkTargets(layout).map { cell -> cell.plateId to cell.selectionLabel }
    }.orEmpty()
    var showFeatureEditor by rememberSaveable { mutableStateOf(false) }
    var activeFeatureIndex by rememberSaveable { mutableIntStateOf(0) }
    var placementModeEnabled by rememberSaveable { mutableStateOf(false) }
    var pendingPlacementAzimuth by rememberSaveable { mutableStateOf("") }
    var pendingPlacementRadius by rememberSaveable { mutableStateOf("") }
    var pendingPlacementPlateId by rememberSaveable { mutableStateOf("") }
    var confirmedPlacementPlateIds by remember(draftState.roofFeatureDraft.type, roofSurfaceId, draftFeatureCount) {
        mutableStateOf(draftFeatureLinks)
    }
    var confirmedPlacementAzimuths by remember(draftState.roofFeatureDraft.type, roofSurfaceId, draftFeatureCount) {
        mutableStateOf(draftFeatureAzimuths)
    }
    var confirmedPlacementRadii by remember(draftState.roofFeatureDraft.type, roofSurfaceId, draftFeatureCount) {
        mutableStateOf(draftFeatureRadii)
    }
    var pendingDelete by remember { mutableStateOf<LaiqDeleteDialogState?>(null) }
    if (activeFeatureIndex > maxOf(0, draftFeatureCount - 1)) {
        activeFeatureIndex = maxOf(0, draftFeatureCount - 1)
    }
    val activePlacementAzimuthText = pendingPlacementAzimuth.ifBlank {
        draftFeatureAzimuths.getOrElse(activeFeatureIndex) { "" }
    }
    val activePlacementRadiusText = pendingPlacementRadius.ifBlank {
        draftFeatureRadii.getOrElse(activeFeatureIndex) { "" }
    }
    val activePlacementRadiusDisplay = activePlacementRadiusText.toDoubleOrNull()?.let { value ->
        "%.2f".format(value)
    } ?: activePlacementRadiusText
    val canNudgePlacement = activePlacementAzimuthText.isNotBlank() && activePlacementRadiusText.isNotBlank()
    val maxPlacementRadiusRatio = if (roofLayout?.hasAnnularRing == true) {
        0.48 / 0.42
    } else {
        1.0
    }
    fun previewFeaturePlacement(azimuthDeg: Double, radiusRatio: Double) {
        val linkedLayout = roofLayout ?: return
        val selectedPlateId = nearestRoofPlateId(
            template = linkedLayout.template,
            rowCount = linkedLayout.rowCount ?: 0,
            widestRowPlateCount = linkedLayout.widestRowPlateCount ?: 0,
            ringCount = linkedLayout.ringCount ?: 0,
            sectorCount = linkedLayout.sectorCount ?: 0,
            referenceAzimuthDeg = roofReferenceAzimuth,
            rotationDirection = committedScope.rotationDirection,
            hasAnnularRing = linkedLayout.hasAnnularRing,
            annularSectionCount = linkedLayout.annularSectionCount ?: 0,
            azimuthDeg = azimuthDeg,
            radiusRatio = radiusRatio,
        )
        pendingPlacementAzimuth = azimuthDeg.toInt().toString()
        pendingPlacementRadius = "%.2f".format(radiusRatio)
        pendingPlacementPlateId = selectedPlateId.orEmpty()
    }
    fun savedPlacementMatchesLinkedPlate(
        linkedPlateId: String,
        azimuthText: String,
        radiusText: String,
    ): Boolean {
        val linkedLayout = roofLayout ?: return false
        val azimuthDeg = azimuthText.toDoubleOrNull() ?: return false
        val radiusRatio = radiusText.toDoubleOrNull() ?: return false
        val resolvedPlateId = roofPlateIdAtPolar(
            template = linkedLayout.template,
            rowCount = linkedLayout.rowCount ?: 0,
            widestRowPlateCount = linkedLayout.widestRowPlateCount ?: 0,
            ringCount = linkedLayout.ringCount ?: 0,
            sectorCount = linkedLayout.sectorCount ?: 0,
            referenceAzimuthDeg = roofReferenceAzimuth,
            rotationDirection = committedScope.rotationDirection,
            hasAnnularRing = linkedLayout.hasAnnularRing,
            annularSectionCount = linkedLayout.annularSectionCount ?: 0,
            azimuthDeg = azimuthDeg,
            radiusRatio = radiusRatio,
        )
        return resolvedPlateId == linkedPlateId
    }
    fun initializePlacementFromLinkedPlate(): Boolean {
        val linkedPlateId = pendingPlacementPlateId.ifBlank {
            draftFeatureLinks.getOrElse(activeFeatureIndex) { "" }
        }.ifBlank { return false }
        if (pendingPlacementAzimuth.isBlank() && pendingPlacementRadius.isBlank()) {
            val savedAzimuth = draftFeatureAzimuths.getOrElse(activeFeatureIndex) { "" }
            val savedRadius = draftFeatureRadii.getOrElse(activeFeatureIndex) { "" }
            if (
                savedAzimuth.isNotBlank() &&
                savedRadius.isNotBlank() &&
                savedPlacementMatchesLinkedPlate(linkedPlateId, savedAzimuth, savedRadius)
            ) {
                pendingPlacementAzimuth = savedAzimuth
                pendingPlacementRadius = savedRadius
                pendingPlacementPlateId = linkedPlateId
                return true
            }
        }
        if (
            canNudgePlacement &&
            savedPlacementMatchesLinkedPlate(
                linkedPlateId,
                activePlacementAzimuthText,
                activePlacementRadiusText,
            )
        ) {
            pendingPlacementPlateId = linkedPlateId
            return true
        }
        val linkedLayout = roofLayout ?: return false
        val linkedCell = buildRoofLinkTargets(linkedLayout).firstOrNull { cell -> cell.plateId == linkedPlateId } ?: return false
        val (derivedAzimuth, derivedRadius) = canvasPointToRoofPolar(linkedCell.xNorm, linkedCell.yNorm)
        previewFeaturePlacement(derivedAzimuth, derivedRadius)
        return true
    }
    fun nudgeFeaturePlacement(deltaXNorm: Float, deltaYNorm: Float) {
        if (!initializePlacementFromLinkedPlate()) return
        val azimuthDeg = pendingPlacementAzimuth.ifBlank { activePlacementAzimuthText }.toDoubleOrNull() ?: return
        val radiusRatio = pendingPlacementRadius.ifBlank { activePlacementRadiusText }.toDoubleOrNull() ?: return
        val (xNorm, yNorm) = roofPolarToCanvasPoint(azimuthDeg, radiusRatio)
        val nextX = (xNorm + deltaXNorm).coerceIn(0.02f, 0.98f)
        val nextY = (yNorm + deltaYNorm).coerceIn(0.02f, 0.98f)
        val (nextAzimuth, nextRadiusRaw) = canvasPointToRoofPolar(nextX, nextY)
        previewFeaturePlacement(nextAzimuth, nextRadiusRaw.coerceIn(0.0, maxPlacementRadiusRatio))
    }

    fun undoFeaturePlacement() {
        val restoredPlateId = confirmedPlacementPlateIds.getOrElse(activeFeatureIndex) { "" }
        val restoredAzimuth = confirmedPlacementAzimuths.getOrElse(activeFeatureIndex) { "" }
        val restoredRadius = confirmedPlacementRadii.getOrElse(activeFeatureIndex) { "" }
        pendingPlacementPlateId = restoredPlateId
        pendingPlacementAzimuth = restoredAzimuth
        pendingPlacementRadius = restoredRadius
        var restoredState = draftState.assignRoofFeatureDraftPlate(activeFeatureIndex, restoredPlateId)
        restoredState = if (restoredAzimuth.isNotBlank() && restoredRadius.isNotBlank()) {
            restoredState.assignRoofFeatureDraftPosition(
                index = activeFeatureIndex,
                azimuthDeg = restoredAzimuth.toDoubleOrNull() ?: 0.0,
                radiusRatio = restoredRadius.toDoubleOrNull() ?: 0.0,
                plateId = restoredPlateId.ifBlank { null },
            )
        } else {
            restoredState.clearRoofFeatureDraftPosition(activeFeatureIndex)
        }
        onDraftStateChange(restoredState)
        placementModeEnabled = restoredPlateId.isNotBlank()
        initializePlacementFromLinkedPlate()
    }
    LaunchedEffect(showFeatureEditor, draftState.roofFeatureDraft.type, activeFeatureIndex, draftFeatureCount) {
        if (!showFeatureEditor || draftFeatureCount <= 0) return@LaunchedEffect
        pendingPlacementPlateId = pendingPlacementPlateId.ifBlank {
            draftFeatureLinks.getOrElse(activeFeatureIndex) { "" }
        }
        initializePlacementFromLinkedPlate()
    }
    val draftMarkers = if (draftFeatureCount > 0) {
        (0 until draftFeatureCount).map { index ->
            val draftAzimuth = draftFeatureAzimuths.getOrElse(index) { "" }.toDoubleOrNull()
            val draftRadius = draftFeatureRadii.getOrElse(index) { "" }.toDoubleOrNull()
            val previewAzimuth = if (showFeatureEditor && index == activeFeatureIndex) pendingPlacementAzimuth.toDoubleOrNull() else null
            val previewRadius = if (showFeatureEditor && index == activeFeatureIndex) pendingPlacementRadius.toDoubleOrNull() else null
            val previewPlateId = if (showFeatureEditor && index == activeFeatureIndex) pendingPlacementPlateId.ifBlank { null } else null
            RoofMapMarker(
                markerId = "draft-feature-$index",
                label = if (roofFeatureUsesCenterPlacement(draftState.roofFeatureDraft.type)) {
                    "CO"
                } else {
                    generatedRoofFeatureLabel(draftState.roofFeatureDraft.type, index + 1)
                },
                plateId = previewPlateId ?: draftFeatureLinks.getOrElse(index) { "" }.ifBlank { null },
                azimuthDeg = previewAzimuth ?: draftAzimuth,
                radiusRatio = previewRadius ?: draftRadius,
                active = showFeatureEditor && index == activeFeatureIndex,
            )
        }
    } else {
        emptyList()
    }
    val savedMarkers = surfaceFeatures.map { feature ->
        RoofMapMarker(
            markerId = feature.featureId,
            label = feature.label ?: roofFeatureTypeLabel(feature.type),
            plateId = feature.plateId,
            azimuthDeg = feature.azimuthDeg,
            radiusRatio = feature.radiusRatio,
        )
    }
    val editorOverlayPlateIds = if (showFeatureEditor) {
        draftFeatureLinks.filter { link -> link.isNotBlank() }.toSet()
    } else {
        surfaceFeatures.mapNotNull { feature -> feature.plateId }.toSet()
    }
    val editorMarkers = if (showFeatureEditor) {
        draftMarkers
    } else {
        savedMarkers
    }

    if (!hasSavedLayout || roofLayout == null || !roofLayout.isReadyForInspection()) {
        LazyColumn(
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
                    title = "Roof Elements Locked",
                    subtitle = "Complete and save the roof layout in Inspection Setup first. Later screens can use that roof map, but they do not edit it.",
                ) {
                    LaiqSecondaryButton("Back", onBack)
                }
            }
        }
        return
    }

    pendingDelete?.let { dialogState ->
        LaiqDeleteConfirmDialog(
            state = dialogState,
            onDismiss = { pendingDelete = null },
        )
    }

    LazyColumn(
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
                title = "Committed Roof Layout",
                subtitle = "This read-only roof plate map comes from Inspection Setup. Roof elements are placed on this committed basis and do not change the plate numbering later.",
            ) {
                if (roofSurfaceOptions.size > 1) {
                    LaiqDropdownField(
                        label = "Roof Surface",
                        value = roofSurfaceId,
                        options = roofSurfaceOptions.map { surface -> surface.roofSurfaceId to surface.label },
                        onSelected = { selectedSurfaceId ->
                            onDraftStateChange(
                                draftState.copy(
                                    activeRoofSurfaceId = selectedSurfaceId,
                                    roofFeatureDraft = draftState.roofFeatureDraft.copy(roofSurfaceId = selectedSurfaceId),
                                    roofUtDraft = draftState.roofUtDraft.copy(roofSurfaceId = selectedSurfaceId),
                                    roofNozzleDraft = draftState.roofNozzleDraft.copy(roofSurfaceId = selectedSurfaceId),
                                    roofNozzleUtDraft = draftState.roofNozzleUtDraft.copy(roofSurfaceId = selectedSurfaceId),
                                ),
                            )
                        },
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    when (roofLayout?.template) {
                        RoofTemplate.UMBRELLA_RADIAL -> {
                            LaiqStatChip("Rings", roofLayout.ringCount?.toString() ?: "—", modifier = Modifier.weight(1f))
                            LaiqStatChip("Sectors", roofLayout.sectorCount?.toString() ?: "—", modifier = Modifier.weight(1f))
                        }

                        RoofTemplate.CONE_RADIAL -> {
                            LaiqStatChip("Sectors", roofLayout.sectorCount?.toString() ?: "—", modifier = Modifier.weight(1f))
                            LaiqStatChip("Center Plates", roofLayout.ringCount?.toString() ?: "—", modifier = Modifier.weight(1f))
                        }

                        else -> {
                            LaiqStatChip("Rows", roofLayout?.rowCount?.toString() ?: "—", modifier = Modifier.weight(1f))
                            LaiqStatChip(
                                "Max Columns",
                                roofLayout?.widestRowPlateCount?.toString() ?: "—",
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                    LaiqStatChip("0° Ref", roofReferenceLabel, tone = LaiqColors.AccentOrange, modifier = Modifier.weight(1f))
                }
                roofReferenceRemark?.let { remark ->
                    Text(
                        "Tank north marker: $remark",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                }
                RoofSurfaceMap(
                    template = roofLayout.template,
                    rowCount = roofLayout.rowCount ?: 0,
                    widestRowPlateCount = roofLayout.widestRowPlateCount ?: 0,
                    ringCount = roofLayout.ringCount ?: 0,
                    sectorCount = roofLayout.sectorCount ?: 0,
                    activePlateId = "",
                    savedPlateIds = emptySet(),
                    overlayPlateIds = emptySet(),
                    centerFeatureCount = 0,
                    hasAnnularRing = roofLayout.hasAnnularRing,
                    annularSectionCount = roofLayout.annularSectionCount ?: 0,
                    hasPontoonDeck = roofLayout.hasPontoonDeck,
                    markers = savedMarkers + draftMarkers.filterNot { marker -> marker.active },
                    referenceLabel = roofReferenceLabel,
                    referenceAzimuthDeg = roofReferenceAzimuth,
                    rotationDirection = committedScope.rotationDirection,
                    onSelectPosition = null,
                    onSelectPlate = {},
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    text = "Roof layout is already locked from setup. To change it, go back to Inspection Setup and re-save the fundamentals.",
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.MutedText,
                )
            }
        }

        item {
            LaiqSectionCard(
                title = "Roof Elements",
                subtitle = "Keep roof appurtenances and floating-roof elements on the same committed roof basis. Nozzles stay in their own registry because size, pad, and nozzle UT still belong to a nozzle workflow.",
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LaiqStatChip("Elements", surfaceFeatures.size.toString(), modifier = Modifier.weight(1f))
                    LaiqStatChip("Types", surfaceFeatures.map { it.type }.toSet().size.toString(), modifier = Modifier.weight(1f))
                    LaiqStatChip(
                        "Overlays",
                        listOfNotNull(
                            roofLayout.hasAnnularRing.takeIf { it }?.let { "Annular" },
                            roofLayout.hasPontoonDeck.takeIf { it }?.let { "Pontoon" },
                        ).size.toString(),
                        tone = LaiqColors.AccentOrange,
                        modifier = Modifier.weight(1f),
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    LaiqPrimaryButton(
                        text = "Add Roof Element",
                        onClick = {
                            showFeatureEditor = true
                            placementModeEnabled = false
                            pendingPlacementAzimuth = ""
                            pendingPlacementRadius = ""
                            pendingPlacementPlateId = ""
                        },
                        modifier = Modifier.weight(1f),
                    )
                    if (showFeatureEditor) {
                        LaiqSecondaryButton(
                            text = "Close Editor",
                            onClick = {
                                showFeatureEditor = false
                                placementModeEnabled = false
                                pendingPlacementAzimuth = ""
                                pendingPlacementRadius = ""
                                pendingPlacementPlateId = ""
                            },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                if (!showFeatureEditor) {
                    Text(
                        "Roof element editor hidden. Open it to place one element at a time on the committed roof map.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                } else {
                        RoofFeatureBatchInputs(
                            draft = draftState.roofFeatureDraft,
                            surfaceKind = roofSurfaceKind,
                            onTypeSelected = { type ->
                                activeFeatureIndex = 0
                                onDraftStateChange(draftState.selectRoofFeatureType(type, roofSurfaceId))
                            },
                        onCountChange = { count ->
                            activeFeatureIndex = 0
                            onDraftStateChange(draftState.updateRoofFeatureDraftCount(count))
                        },
                    )
                    if (draftFeatureCount > 0) {
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            LaiqSecondaryButton(
                                text = "Previous",
                                onClick = {
                                    activeFeatureIndex = (activeFeatureIndex - 1).coerceAtLeast(0)
                                    placementModeEnabled = false
                                    pendingPlacementAzimuth = ""
                                    pendingPlacementRadius = ""
                                    pendingPlacementPlateId = ""
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(72.dp),
                            )
                            Surface(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(72.dp),
                                color = Color.White,
                                shape = RoundedCornerShape(16.dp),
                                border = BorderStroke(1.dp, LaiqColors.PanelBorder),
                            ) {
                                Column(
                                    modifier = Modifier.fillMaxSize(),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center,
                                ) {
                                    Text("Current", style = MaterialTheme.typography.labelMedium, color = LaiqColors.MutedText)
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        "${generatedRoofFeatureLabel(draftState.roofFeatureDraft.type, activeFeatureIndex + 1)} (${activeFeatureIndex + 1}/$draftFeatureCount)",
                                        style = MaterialTheme.typography.titleSmall,
                                        color = LaiqColors.AccentOrange,
                                    )
                                }
                            }
                            LaiqSecondaryButton(
                                text = "Next",
                                onClick = {
                                    activeFeatureIndex = (activeFeatureIndex + 1).coerceAtMost(draftFeatureCount - 1)
                                    placementModeEnabled = false
                                    pendingPlacementAzimuth = ""
                                    pendingPlacementRadius = ""
                                    pendingPlacementPlateId = ""
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(72.dp),
                            )
                        }
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            color = Color.White,
                            shape = RoundedCornerShape(18.dp),
                            border = BorderStroke(1.dp, LaiqColors.BrandTeal),
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                Text(
                                    generatedRoofFeatureLabel(draftState.roofFeatureDraft.type, activeFeatureIndex + 1),
                                    style = MaterialTheme.typography.titleSmall,
                                )
                                Text(
                                    roofFeatureTypeLabel(draftState.roofFeatureDraft.type),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = LaiqColors.MutedText,
                                )
                                if (roofFeatureUsesCenterPlacement(draftState.roofFeatureDraft.type)) {
                                    Text(
                                        "Center opening is fixed at roof center and does not require plate linking.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = LaiqColors.MutedText,
                                    )
                                } else {
                                    LaiqDropdownField(
                                        label = "Plate Link",
                                        value = draftFeatureLinks.getOrElse(activeFeatureIndex) { "" },
                                        options = plateOptions,
                                        onSelected = { plateId ->
                                            pendingPlacementPlateId = plateId
                                            pendingPlacementAzimuth = ""
                                            pendingPlacementRadius = ""
                                            onDraftStateChange(
                                                draftState.assignRoofFeatureDraftPlate(activeFeatureIndex, plateId),
                                            )
                                            initializePlacementFromLinkedPlate()
                                            placementModeEnabled = true
                                        },
                                    )
                                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        LaiqSecondaryButton(
                                            text = "Undo",
                                            onClick = { undoFeaturePlacement() },
                                            modifier = Modifier.weight(1f),
                                        )
                                        LaiqPrimaryButton(
                                            text = "Confirm",
                                        onClick = {
                                            if (!initializePlacementFromLinkedPlate()) return@LaiqPrimaryButton
                                            val azimuthDeg = pendingPlacementAzimuth.toDoubleOrNull() ?: return@LaiqPrimaryButton
                                            val radiusRatio = pendingPlacementRadius.toDoubleOrNull() ?: return@LaiqPrimaryButton
                                            confirmedPlacementPlateIds = confirmedPlacementPlateIds.toMutableList().apply {
                                                while (size <= activeFeatureIndex) add("")
                                                this[activeFeatureIndex] = pendingPlacementPlateId
                                            }
                                            confirmedPlacementAzimuths = confirmedPlacementAzimuths.toMutableList().apply {
                                                while (size <= activeFeatureIndex) add("")
                                                this[activeFeatureIndex] = pendingPlacementAzimuth
                                            }
                                            confirmedPlacementRadii = confirmedPlacementRadii.toMutableList().apply {
                                                while (size <= activeFeatureIndex) add("")
                                                this[activeFeatureIndex] = pendingPlacementRadius
                                            }
                                            onDraftStateChange(
                                                draftState.assignRoofFeatureDraftPosition(
                                                    index = activeFeatureIndex,
                                                    azimuthDeg = azimuthDeg,
                                                    radiusRatio = radiusRatio,
                                                        plateId = pendingPlacementPlateId.ifBlank { null },
                                                    ),
                                                )
                                                placementModeEnabled = true
                                            },
                                            enabled = draftFeatureLinks.getOrElse(activeFeatureIndex) { "" }.isNotBlank() || pendingPlacementPlateId.isNotBlank(),
                                            modifier = Modifier.weight(1f),
                                        )
                                    }
                                }
                            }
                        }
                        if (roofLayout != null && !roofFeatureUsesCenterPlacement(draftState.roofFeatureDraft.type)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalAlignment = Alignment.Top,
                            ) {
                                RoofSurfaceMap(
                                    template = roofLayout.template,
                                    rowCount = roofLayout.rowCount ?: 0,
                                    widestRowPlateCount = roofLayout.widestRowPlateCount ?: 0,
                                    ringCount = roofLayout.ringCount ?: 0,
                                    sectorCount = roofLayout.sectorCount ?: 0,
                                    activePlateId = pendingPlacementPlateId.ifBlank { draftFeatureLinks.getOrElse(activeFeatureIndex) { "" } },
                                    savedPlateIds = emptySet(),
                                    overlayPlateIds = editorOverlayPlateIds,
                                    centerFeatureCount = surfaceFeatures.count { feature -> roofFeatureUsesCenterPlacement(feature.type) },
                                    hasAnnularRing = roofLayout.hasAnnularRing,
                                    annularSectionCount = roofLayout.annularSectionCount ?: 0,
                                    hasPontoonDeck = roofLayout.hasPontoonDeck,
                                    markers = editorMarkers,
                                    referenceLabel = roofReferenceLabel,
                                    referenceAzimuthDeg = roofReferenceAzimuth,
                                    rotationDirection = committedScope.rotationDirection,
                                    onSelectPosition = { azimuthDeg, radiusRatio ->
                                        previewFeaturePlacement(azimuthDeg, radiusRatio)
                                        placementModeEnabled = true
                                    },
                                    onSelectPlate = { plateId ->
                                        pendingPlacementPlateId = plateId
                                        pendingPlacementAzimuth = ""
                                        pendingPlacementRadius = ""
                                        onDraftStateChange(
                                            draftState.assignRoofFeatureDraftPlate(activeFeatureIndex, plateId),
                                        )
                                        initializePlacementFromLinkedPlate()
                                        placementModeEnabled = true
                                    },
                                    modifier = Modifier.weight(1f),
                                )
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    LaiqLabeledValue(
                                        label = "Estimated Position",
                                        value = activePlacementAzimuthText
                                            .takeIf { it.isNotBlank() }
                                            ?.let { azimuth ->
                                                val radius = activePlacementRadiusDisplay.ifBlank { "0.50" }
                                                "${azimuth}° / ${radius}R"
                                            }
                                            ?: "Select a plate first",
                                    )
                                    LaiqPlacementAdjustPad(
                                        enabled = draftFeatureLinks.getOrElse(activeFeatureIndex) { "" }.isNotBlank() || canNudgePlacement,
                                        onUp = { nudgeFeaturePlacement(0f, -0.012f) },
                                        onDown = { nudgeFeaturePlacement(0f, 0.012f) },
                                        onLeft = { nudgeFeaturePlacement(-0.012f, 0f) },
                                        onRight = { nudgeFeaturePlacement(0.012f, 0f) },
                                    )
                                }
                            }
                        }
                        LaiqPrimaryButton(
                            text = "Save This Type",
                            onClick = {
                                val updated = draftState.saveRoofFeatureDraft()
                                onDraftStateChange(updated)
                                placementModeEnabled = false
                                pendingPlacementAzimuth = ""
                                pendingPlacementRadius = ""
                                pendingPlacementPlateId = ""
                                if (updated != draftState) showFeatureEditor = false
                            },
                        )
                        LaiqSecondaryButton(
                            text = "Delete This Type",
                            onClick = {
                                val typeLabel = roofFeatureTypeLabel(draftState.roofFeatureDraft.type)
                                val surfaceLabel = roofSurfaceConfig?.label ?: roofSurfaceKind.replaceFirstChar { it.uppercase() }
                                pendingDelete = LaiqDeleteDialogState(
                                    title = "Delete $typeLabel?",
                                    message = "This will remove all saved $typeLabel items on $surfaceLabel and any related findings.",
                                    onConfirm = {
                                        onDraftStateChange(draftState.removeRoofFeatureType(draftState.roofFeatureDraft.type, roofSurfaceId))
                                        placementModeEnabled = false
                                        pendingPlacementAzimuth = ""
                                        pendingPlacementRadius = ""
                                        pendingPlacementPlateId = ""
                                        showFeatureEditor = false
                                    },
                                )
                            },
                        )
                    }
                }
                if (savedFeatureGroups.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        savedFeatureGroups.forEach { (type, features) ->
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
                                    Text(roofFeatureTypeLabel(type), style = MaterialTheme.typography.titleSmall)
                                    Text(
                                        features.joinToString(", ") { feature -> feature.label ?: roofFeatureTypeLabel(type) },
                                        style = MaterialTheme.typography.bodySmall,
                                    )
                                    Text(
                                        "${features.count { feature -> feature.azimuthDeg != null && feature.radiusRatio != null }} visually placed of ${features.size}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = LaiqColors.MutedText,
                                    )
                                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        LaiqSecondaryButton(
                                            text = "Edit",
                                            onClick = {
                                                activeFeatureIndex = 0
                                                onDraftStateChange(draftState.editRoofFeatureType(type, roofSurfaceId))
                                                placementModeEnabled = false
                                                pendingPlacementAzimuth = ""
                                                pendingPlacementRadius = ""
                                                pendingPlacementPlateId = ""
                                                showFeatureEditor = true
                                            },
                                            modifier = Modifier.weight(1f),
                                        )
                                        LaiqSecondaryButton(
                                            text = "Delete",
                                            onClick = {
                                                val typeLabel = roofFeatureTypeLabel(type)
                                                val surfaceLabel = roofSurfaceConfig?.label ?: roofSurfaceKind.replaceFirstChar { it.uppercase() }
                                                pendingDelete = LaiqDeleteDialogState(
                                                    title = "Delete $typeLabel?",
                                                    message = "This will remove all saved $typeLabel items on $surfaceLabel and any related findings.",
                                                    onConfirm = {
                                                        onDraftStateChange(draftState.removeRoofFeatureType(type, roofSurfaceId))
                                                    },
                                                )
                                            },
                                            modifier = Modifier.weight(1f),
                                        )
                                    }
                                }
                            }
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

private fun roofLayoutSaveValidationMessage(draft: RoofLayoutDraftInput): String? = when (draft.template) {
    RoofTemplate.CIRCULAR_PLATE -> {
        when {
            parsePositiveWholeNumber(draft.rowCount) == null -> "Enter roof plate rows greater than 0 to save the layout."
            parsePositiveWholeNumber(draft.widestRowPlateCount) == null -> "Enter columns in widest row greater than 0 to save the layout."
            draft.hasAnnularRing && parsePositiveWholeNumber(draft.annularSectionCount) == null ->
                "Enter annular ring sections greater than 0 to save the layout."
            else -> null
        }
    }

    RoofTemplate.CIRCULAR_CENTER_OPENING -> {
        when {
            parsePositiveWholeNumber(draft.rowCount) == null -> "Enter roof plate rows greater than 0 to save the layout."
            parsePositiveWholeNumber(draft.widestRowPlateCount) == null -> "Enter columns in widest row greater than 0 to save the layout."
            draft.centerOpeningRatio.isNotBlank() && parseNormalizedDecimal(draft.centerOpeningRatio)?.let { it in 0.0..1.0 } != true ->
                "Center opening ratio must be between 0 and 1."
            draft.hasAnnularRing && parsePositiveWholeNumber(draft.annularSectionCount) == null ->
                "Enter annular ring sections greater than 0 to save the layout."
            else -> null
        }
    }

    RoofTemplate.CONE_RADIAL -> {
        when {
            parsePositiveWholeNumber(draft.sectorCount) == null -> "Enter outer sector count greater than 0 to save the layout."
            parsePositiveWholeNumber(draft.ringCount)?.let { it in 1..3 } != true ->
                "Enter center plate count from 1 to 3 to save the layout."
            draft.hasAnnularRing && parsePositiveWholeNumber(draft.annularSectionCount) == null ->
                "Enter annular ring sections greater than 0 to save the layout."
            else -> null
        }
    }

    RoofTemplate.UMBRELLA_RADIAL -> {
        when {
            parsePositiveWholeNumber(draft.ringCount) == null -> "Enter center plate count greater than 0 to save the layout."
            parsePositiveWholeNumber(draft.sectorCount) == null -> "Enter sector count greater than 0 to save the layout."
            draft.hasAnnularRing && parsePositiveWholeNumber(draft.annularSectionCount) == null ->
                "Enter annular ring sections greater than 0 to save the layout."
            else -> null
        }
    }
}

@Composable
private fun RoofLayoutInputs(
    draft: RoofLayoutDraftInput,
    roofType: String,
    onDraftChange: (RoofLayoutDraftInput) -> Unit,
) {
    val isFloatingRoof = roofType.contains("floating")
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        when (draft.template) {
            RoofTemplate.CIRCULAR_PLATE,
            RoofTemplate.CIRCULAR_CENTER_OPENING -> {
                LaiqCountField(
                    label = "Roof Plate Rows",
                    value = draft.rowCount,
                    onValueChange = { onDraftChange(draft.copy(rowCount = normalizedIntegerInput(it))) },
                    min = 0,
                    max = 20,
                )
                LaiqCountField(
                    label = "Columns In Widest Row",
                    value = draft.widestRowPlateCount,
                    onValueChange = { onDraftChange(draft.copy(widestRowPlateCount = normalizedIntegerInput(it))) },
                    min = 0,
                    max = 20,
                )
                Text(
                    "Rows run top to bottom. Columns define the normal plate width in the widest row, and adjacent rows offset by 50% across the full circular roof.",
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.MutedText,
                )
                val rows = parsePositiveWholeNumber(draft.rowCount)
                val columns = parsePositiveWholeNumber(draft.widestRowPlateCount)
                if (rows != null && columns != null) {
                    Text(
                        "Generated row plates: ${circularPlateRowCounts(rows, columns).joinToString(" / ")}",
                        style = MaterialTheme.typography.bodySmall,
                        color = LaiqColors.MutedText,
                    )
                }
                if (draft.template == RoofTemplate.CIRCULAR_CENTER_OPENING) {
                    OutlinedTextField(
                        value = draft.centerOpeningRatio,
                        onValueChange = { onDraftChange(draft.copy(centerOpeningRatio = normalizedDecimalInput(it))) },
                        label = { Text("Center Opening Ratio (0-1)") },
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    )
                }
            }

            RoofTemplate.CONE_RADIAL -> {
                LaiqCountField(
                    label = "Outer Sector Count",
                    value = draft.sectorCount,
                    onValueChange = { onDraftChange(draft.copy(sectorCount = normalizedIntegerInput(it))) },
                    min = 0,
                    max = 40,
                )
                LaiqCountField(
                    label = "Center Plate Count",
                    value = draft.ringCount,
                    onValueChange = { onDraftChange(draft.copy(ringCount = normalizedIntegerInput(it))) },
                    min = 1,
                    max = 3,
                )
                Text(
                    "Cone / radial roofs use numbered outer sectors plus a configurable center cluster of 1 to 3 plates.",
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.MutedText,
                )
            }

            RoofTemplate.UMBRELLA_RADIAL -> {
                LaiqCountField(
                    label = "Ring Count",
                    value = draft.ringCount,
                    onValueChange = { onDraftChange(draft.copy(ringCount = normalizedIntegerInput(it))) },
                    min = 0,
                    max = 20,
                )
                LaiqCountField(
                    label = "Sector Count",
                    value = draft.sectorCount,
                    onValueChange = { onDraftChange(draft.copy(sectorCount = normalizedIntegerInput(it))) },
                    min = 0,
                    max = 20,
                )
                Text(
                    "Plates are numbered 1 to N clockwise within each ring, starting from the saved 0° reference.",
                    style = MaterialTheme.typography.bodySmall,
                    color = LaiqColors.MutedText,
                )
            }
        }
        Text(
            "Outer Roof Zones",
            style = MaterialTheme.typography.titleSmall,
            color = LaiqColors.BodyText,
        )
        LaiqDropdownField(
            label = "Annular Ring",
            value = if (draft.hasAnnularRing) "yes" else "no",
            options = listOf("yes" to "Yes", "no" to "No"),
            onSelected = { selected ->
                onDraftChange(
                    draft.copy(
                        hasAnnularRing = selected == "yes",
                        annularSectionCount = if (selected == "yes") draft.annularSectionCount else "",
                    ),
                )
            },
        )
        if (draft.hasAnnularRing) {
            LaiqCountField(
                label = "Annular Ring Sections",
                value = draft.annularSectionCount,
                onValueChange = { onDraftChange(draft.copy(annularSectionCount = normalizedIntegerInput(it))) },
                min = 0,
                max = 20,
            )
            Text(
                "Define how many annular sections exist around the roof perimeter. The app will split the annular ring overlay into that many visible sections.",
                style = MaterialTheme.typography.bodySmall,
                color = LaiqColors.MutedText,
            )
        }
        if (isFloatingRoof) {
            LaiqDropdownField(
                label = "Pontoon Deck",
                value = if (draft.hasPontoonDeck) "yes" else "no",
                options = listOf("yes" to "Yes", "no" to "No"),
                onSelected = { selected -> onDraftChange(draft.copy(hasPontoonDeck = selected == "yes")) },
            )
        } else {
            Text(
                "Pontoon deck is only available when the roof type is a floating roof.",
                style = MaterialTheme.typography.bodySmall,
                color = LaiqColors.MutedText,
            )
        }
        Text(
            if (isFloatingRoof) {
                "Use annular ring and pontoon deck overlays before placing sumps, roof legs, or other floating-roof appurtenances."
            } else {
                "Use annular ring only when the roof layout includes a dedicated outer annular zone."
            },
            style = MaterialTheme.typography.bodySmall,
            color = LaiqColors.MutedText,
        )
    }
}

private fun templateLabel(template: RoofTemplate): String = when (template) {
    RoofTemplate.CIRCULAR_PLATE -> "Circular Plate"
    RoofTemplate.CIRCULAR_CENTER_OPENING -> "Circular + Center Opening"
    RoofTemplate.CONE_RADIAL -> "Cone / Radial"
    RoofTemplate.UMBRELLA_RADIAL -> "Umbrella / Radial"
}

private fun normalizedIntegerInput(raw: String): String =
    raw.mapNotNull { it.digitToIntOrNull()?.toString() }.joinToString("")

private fun normalizedDecimalInput(raw: String): String {
    var seenSeparator = false
    return buildString {
        raw.forEach { char ->
            when {
                char.digitToIntOrNull() != null -> append(char.digitToInt())
                (char == '.' || char == ',') && !seenSeparator -> {
                    append('.')
                    seenSeparator = true
                }
            }
        }
    }
}

@Composable
private fun RoofFeatureBatchInputs(
    draft: ai.laiq.tankinspection.presentation.RoofFeatureDraftInput,
    surfaceKind: String,
    onTypeSelected: (String) -> Unit,
    onCountChange: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        LaiqDropdownField(
            label = "Element Type",
            value = draft.type,
            options = roofFeatureTypeOptionsForSurface(surfaceKind),
            onSelected = onTypeSelected,
        )
        if (roofFeatureUsesCenterPlacement(draft.type)) {
            Text(
                "Center opening uses one center reference and does not need manual placement.",
                style = MaterialTheme.typography.bodySmall,
                color = LaiqColors.MutedText,
            )
        } else {
            LaiqCountField(
                label = "Element Count",
                value = draft.quantity,
                onValueChange = onCountChange,
                min = 0,
                max = 20,
            )
            Text(
                if (draft.type == "roof_leg") {
                    "Roof legs are placed one by one. Set the count, then use Previous / Next and place each leg individually on the map."
                } else {
                    "Select the count first, then use the roof map to place each item visually while keeping its plate link."
                },
                style = MaterialTheme.typography.bodySmall,
                color = LaiqColors.MutedText,
            )
        }
    }
}

package ai.laiq.tankinspection.presentation

import ai.laiq.tankinspection.domain.model.AttachmentRecord
import ai.laiq.tankinspection.domain.model.FindingRecord
import ai.laiq.tankinspection.domain.model.MeasurementUnit
import ai.laiq.tankinspection.domain.model.NozzleDefinition
import ai.laiq.tankinspection.domain.model.NozzleSizeUnit
import ai.laiq.tankinspection.domain.model.NozzleUtRow
import ai.laiq.tankinspection.domain.model.PlumbnessSurvey
import ai.laiq.tankinspection.domain.model.PlumbnessSurveyStation
import ai.laiq.tankinspection.domain.model.ReferenceMode
import ai.laiq.tankinspection.domain.model.RoundnessSurvey
import ai.laiq.tankinspection.domain.model.RoundnessSurveyBand
import ai.laiq.tankinspection.domain.model.RoundnessSurveyStation
import ai.laiq.tankinspection.domain.model.RoofFeature
import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.domain.model.RoofUtRow
import ai.laiq.tankinspection.domain.model.RotationDirection
import ai.laiq.tankinspection.domain.model.ShellSettlementStation
import ai.laiq.tankinspection.domain.model.ShellSettlementSurvey
import ai.laiq.tankinspection.domain.model.ShellUtRow

data class DemoInspectionScenario(
    val id: String,
    val label: String,
    val description: String,
)

private const val demoScenarioPacificFloating = "pacific-floating"
private const val demoScenarioTjsFixed = "tjs-465-fixed"
private const val demoScenarioCoverageMixed = "coverage-mixed-roof"

private val reportFaithfulPacificTasks = linkedSetOf(
    FieldTask.ROOF_ELEMENTS,
    FieldTask.SHELL_UT,
    FieldTask.SHELL_SETTLEMENT,
    FieldTask.ROOF_UT,
    FieldTask.SHELL_NOZZLE_UT,
    FieldTask.ROOF_NOZZLE_UT,
    FieldTask.REVIEW_EXPORT,
)

private val reportFaithfulTjsTasks = linkedSetOf(
    FieldTask.ROOF_ELEMENTS,
    FieldTask.SHELL_UT,
    FieldTask.ROOF_UT,
    FieldTask.SHELL_NOZZLE_UT,
    FieldTask.ROOF_NOZZLE_UT,
    FieldTask.REVIEW_EXPORT,
)

private val demoInspectionScenarios = listOf(
    DemoInspectionScenario(
        id = demoScenarioPacificFloating,
        label = "Pacific Energy TK-13",
        description = "Report-faithful external floating roof sample based on IRS 24PE1-2 with shell settlement, roof/shell UT, nozzle UT, and floating-roof elements.",
    ),
    DemoInspectionScenario(
        id = demoScenarioTjsFixed,
        label = "TJS TK-465",
        description = "Report-faithful fixed cone-roof sample based on IRS 16TJS4-1 with shell/roof UT, roof appurtenances, and shell/roof nozzle UT.",
    ),
    DemoInspectionScenario(
        id = demoScenarioCoverageMixed,
        label = "Full Coverage Sample",
        description = "Mixed fixed-roof plus internal floating-roof sample that intentionally exercises surveys, floating-roof elements, both roof surfaces, and all major capture branches.",
    ),
)

fun demoInspectionScenarioOptions(): List<Pair<String, String>> =
    demoInspectionScenarios.map { scenario -> scenario.id to scenario.label }

fun defaultDemoInspectionScenarioId(): String =
    demoInspectionScenarios.first().id

fun demoInspectionScenarioDescription(id: String): String =
    demoInspectionScenarios.firstOrNull { scenario -> scenario.id == id }?.description
        ?: demoInspectionScenarios.first().description

fun loadDemoInspectionScenario(id: String): FieldDraftState = when (id) {
    demoScenarioTjsFixed -> demoTjs465FieldDraftState()
    demoScenarioCoverageMixed -> demoCoverageMixedFieldDraftState()
    else -> demoPacificFloatingFieldDraftState()
}

fun demoFieldDraftState(): FieldDraftState = loadDemoInspectionScenario(defaultDemoInspectionScenarioId())

private fun finalizeDemoState(state: FieldDraftState): FieldDraftState =
    state.let {
        it.copy(
            savedReferenceBaselineKey = it.currentFundamentalBaselineKey(),
            savedSetupBaseline = it.setup,
            savedScopeBaseline = it.scope,
            savedShellLineCountOverride = it.shellLineCountOverride,
            savedShellCaptureStartLaneId = it.currentShellCaptureStartLaneId(),
            savedShellPlanKey = it.currentShellPlanKey(),
        )
    }

private fun demoPacificFloatingFieldDraftState(): FieldDraftState {
    val selectedTasks = reportFaithfulPacificTasks
    val settlementStations = demoShellSettlementStations()

    return finalizeDemoState(
        FieldDraftState(
            startedAtIso = "2026-05-15T08:00:00Z",
            setup = SetupFormState(
                client = "Pacific Energy SWP Ltd",
            site = "Utulei Terminal, Pago Pago, American Samoa",
            tankNumber = "TK-13",
            diameterM = "24.384",
            heightM = "8.53",
            shellCourseCount = "3",
            fixedRoofType = "none",
            floatingRoofType = "external",
            inspector = "Syed Abdul Rahman Balkhi",
            thicknessUnit = MeasurementUnit.MM,
            settlementUnit = MeasurementUnit.MM,
            nozzleSizeUnit = NozzleSizeUnit.MIXED_TEXT,
        ),
        scope = ScopeFormState(
            referenceMode = ReferenceMode.TANK_NORTH,
            referenceRemark = "Stairway / gauge pole centerline used as 0° reference",
            rotationDirection = RotationDirection.CLOCKWISE,
            selectedTasks = selectedTasks,
        ),
        shellLineCountOverride = "4",
        shellCaptureStartLaneId = "line-01",
        shellUtRows = demoShellUtRows(),
        shellSettlementDraft = ShellSettlementDraftInput(
            stationCount = settlementStations.size.toString(),
            stations = settlementStations.map { station ->
                ShellSettlementStationDraftInput(
                    stationId = station.stationId,
                    angleDeg = station.angleDeg,
                    elevation = station.elevation?.toString().orEmpty(),
                    captureState = station.captureState,
                    note = station.note.orEmpty(),
                )
            },
        ),
        savedShellSettlementSurvey = ShellSettlementSurvey(
            stationCount = settlementStations.size,
            stations = settlementStations,
        ),
        floatingRoofLayoutDraft = floatingRoofDemoLayoutDraft,
        savedFloatingRoofLayoutDraft = floatingRoofDemoLayoutDraft,
        activeRoofSurfaceId = ROOF_SURFACE_FLOATING,
        roofFeatureDraft = RoofFeatureDraftInput(
            roofSurfaceId = ROOF_SURFACE_FLOATING,
            type = "roof_leg",
            quantity = "4",
        ),
        roofFeatures = demoRoofFeatures(),
        roofUtDraft = RoofUtDraftInput(roofSurfaceId = ROOF_SURFACE_FLOATING),
        roofUtRows = demoRoofUtRows(),
        shellNozzles = demoShellNozzles(),
        shellNozzleUtDraft = NozzleUtDraftInput(),
        shellNozzleUtRows = demoShellNozzleUtRows(),
        roofNozzleDraft = RoofNozzleDraftInput(roofSurfaceId = ROOF_SURFACE_FLOATING),
        roofNozzles = demoRoofNozzles(),
        roofNozzleUtDraft = NozzleUtDraftInput(roofSurfaceId = ROOF_SURFACE_FLOATING),
        roofNozzleUtRows = demoRoofNozzleUtRows(),
        findings = demoFindings(),
        attachments = demoAttachments(),
        mflImportDraft = MflImportDraftInput(),
        )
    )
}

private val floatingRoofDemoLayoutDraft = RoofLayoutDraftInput(
    template = RoofTemplate.CIRCULAR_PLATE,
    rowCount = "5",
    widestRowPlateCount = "12",
    hasAnnularRing = true,
    annularSectionCount = "16",
    hasPontoonDeck = true,
)

private val tjs465FixedRoofLayoutDraft = RoofLayoutDraftInput(
    template = RoofTemplate.CONE_RADIAL,
    ringCount = "3",
    sectorCount = "20",
)

private val tjs465FloatingRoofLayoutDraft = RoofLayoutDraftInput(
    template = RoofTemplate.CIRCULAR_PLATE,
    rowCount = "4",
    widestRowPlateCount = "10",
    hasAnnularRing = true,
    annularSectionCount = "12",
    hasPontoonDeck = true,
)

private val floatingRoofDemoLinkTargets by lazy {
    demoRoofLinkTargetsForDraft(floatingRoofDemoLayoutDraft)
}

private fun demoRoofLinkTargetsForDraft(
    layoutDraft: RoofLayoutDraftInput,
    referenceAzimuthDeg: Double = 0.0,
    rotationDirection: RotationDirection = RotationDirection.CLOCKWISE,
) = buildRoofLinkTargetsForConfig(
    template = layoutDraft.template,
    rowCount = layoutDraft.rowCount.toIntOrNull() ?: 0,
    widestRowPlateCount = layoutDraft.widestRowPlateCount.toIntOrNull() ?: 0,
    ringCount = layoutDraft.ringCount.toIntOrNull() ?: 0,
    sectorCount = layoutDraft.sectorCount.toIntOrNull() ?: 0,
    referenceAzimuthDeg = referenceAzimuthDeg,
    rotationDirection = rotationDirection,
    hasAnnularRing = layoutDraft.hasAnnularRing,
    annularSectionCount = layoutDraft.annularSectionCount.toIntOrNull() ?: 0,
)

private fun demoRoofPlacementForPlate(
    layoutDraft: RoofLayoutDraftInput,
    plateId: String,
    referenceAzimuthDeg: Double = 0.0,
    rotationDirection: RotationDirection = RotationDirection.CLOCKWISE,
): Pair<Double, Double> {
    val cell = demoRoofLinkTargetsForDraft(layoutDraft, referenceAzimuthDeg, rotationDirection)
        .firstOrNull { target -> target.plateId == plateId }
        ?: error("Missing demo roof plate target for $plateId")
    return canvasPointToRoofPolar(cell.xNorm, cell.yNorm)
}

private fun floatingRoofDemoPlacementForPlate(plateId: String): Pair<Double, Double> =
    demoRoofPlacementForPlate(floatingRoofDemoLayoutDraft, plateId)

private fun demoRoofFeature(
    featureId: String,
    type: String,
    label: String,
    plateId: String,
): RoofFeature {
    val (azimuthDeg, radiusRatio) = floatingRoofDemoPlacementForPlate(plateId)
    return RoofFeature(
        featureId = featureId,
        roofSurfaceId = ROOF_SURFACE_FLOATING,
        type = type,
        label = label,
        placementMode = "plate_linked_positioned",
        plateId = plateId,
        azimuthDeg = azimuthDeg,
        radiusRatio = radiusRatio,
    )
}

private fun demoRoofFeatureForSurface(
    featureId: String,
    roofSurfaceId: String,
    layoutDraft: RoofLayoutDraftInput,
    type: String,
    label: String,
    plateId: String,
): RoofFeature {
    val (azimuthDeg, radiusRatio) = demoRoofPlacementForPlate(layoutDraft, plateId)
    return RoofFeature(
        featureId = featureId,
        roofSurfaceId = roofSurfaceId,
        type = type,
        label = label,
        placementMode = "plate_linked_positioned",
        plateId = plateId,
        azimuthDeg = azimuthDeg,
        radiusRatio = radiusRatio,
    )
}

private fun demoRoofNozzle(
    nozzleId: String,
    size: String,
    plateId: String,
    hasReinforcementPad: Boolean = true,
): NozzleDefinition {
    val (azimuthDeg, radiusRatio) = floatingRoofDemoPlacementForPlate(plateId)
    return NozzleDefinition(
        nozzleId = nozzleId,
        surface = "roof",
        roofSurfaceId = ROOF_SURFACE_FLOATING,
        size = size,
        hasReinforcementPad = hasReinforcementPad,
        placementMode = "plate_linked_positioned",
        azimuthDeg = azimuthDeg,
        radiusRatio = radiusRatio,
        plateId = plateId,
    )
}

private fun demoRoofNozzleForSurface(
    nozzleId: String,
    roofSurfaceId: String,
    layoutDraft: RoofLayoutDraftInput,
    size: String,
    plateId: String,
    hasReinforcementPad: Boolean = true,
): NozzleDefinition {
    val (azimuthDeg, radiusRatio) = demoRoofPlacementForPlate(layoutDraft, plateId)
    return NozzleDefinition(
        nozzleId = nozzleId,
        surface = "roof",
        roofSurfaceId = roofSurfaceId,
        size = size,
        hasReinforcementPad = hasReinforcementPad,
        placementMode = "plate_linked_positioned",
        azimuthDeg = azimuthDeg,
        radiusRatio = radiusRatio,
        plateId = plateId,
    )
}

private data class DemoShellUtSpec(
    val rowId: String,
    val lineId: String,
    val course: Int,
    val readings: List<Double>,
)

private data class DemoNozzleUtSpec(
    val rowId: String,
    val nozzleId: String,
    val bodyReadings: List<Double>,
    val note: String,
)

private fun demoShellUtRows(): List<ShellUtRow> =
    listOf(
        DemoShellUtSpec("shell-ut-001", "line-01", 1, listOf(8.763, 8.712, 8.763, 8.712, 8.712)),
        DemoShellUtSpec("shell-ut-002", "line-02", 1, listOf(8.738, 8.788, 8.865, 8.788, 8.839)),
        DemoShellUtSpec("shell-ut-003", "line-03", 1, listOf(8.738, 8.763, 8.788, 8.865, 8.839)),
        DemoShellUtSpec("shell-ut-004", "line-04", 1, listOf(8.687, 8.611, 8.687, 8.661, 8.661)),
        DemoShellUtSpec("shell-ut-005", "line-01", 2, listOf(8.306, 8.255, 8.280, 8.255, 8.255)),
        DemoShellUtSpec("shell-ut-006", "line-02", 2, listOf(7.976, 7.976, 7.874, 8.001, 8.052)),
        DemoShellUtSpec("shell-ut-007", "line-03", 2, listOf(8.179, 8.204, 8.306, 8.255, 8.230)),
        DemoShellUtSpec("shell-ut-008", "line-04", 2, listOf(8.306, 8.230, 8.255, 8.255, 8.280)),
        DemoShellUtSpec("shell-ut-009", "line-01", 3, listOf(8.052, 8.077, 8.128, 8.103, 8.077)),
        DemoShellUtSpec("shell-ut-010", "line-02", 3, listOf(8.153, 8.153, 8.204, 8.179, 8.153)),
        DemoShellUtSpec("shell-ut-011", "line-03", 3, listOf(8.179, 8.230, 8.153, 8.153, 8.179)),
        DemoShellUtSpec("shell-ut-012", "line-04", 3, listOf(8.153, 8.179, 8.153, 8.230, 8.230)),
    ).map { spec ->
        ShellUtRow(
            rowId = spec.rowId,
            lineId = spec.lineId,
            course = spec.course,
            readings = spec.readings,
            note = shellUtDemoNote(spec.course, spec.lineId),
        )
    }

private fun shellUtDemoNote(course: Int, lineId: String): String =
    "Demo shell UT set for ${lineId.replace("line-", "Lane ")} · Strake $course."

private fun demoShellSettlementStations(): List<ShellSettlementStation> =
    listOf(
        ShellSettlementStation("1", 0.0, 1258.0),
        ShellSettlementStation("2", 45.0, 1256.0),
        ShellSettlementStation("3", 90.0, 1251.0),
        ShellSettlementStation("4", 135.0, 1248.0, note = "Slight low point near the stair landing."),
        ShellSettlementStation("5", 180.0, 1249.0),
        ShellSettlementStation("6", 225.0, 1252.0),
        ShellSettlementStation("7", 270.0, 1256.0),
        ShellSettlementStation("8", 315.0, 1259.0),
    )

private fun demoRoundnessSurvey(): RoundnessSurvey =
    RoundnessSurvey(
        surveys = listOf(
            RoundnessSurveyBand(
                surveyId = "roundness-01",
                label = "Ring 1",
                heightReference = "1 ft above bottom projection plate",
                stationCount = 8,
                stations = listOf(
                    RoundnessSurveyStation("1", 0.0, -34.408, 6.945),
                    RoundnessSurveyStation("2", 45.0, -36.186, -1.270),
                    RoundnessSurveyStation("3", 90.0, -40.173, -9.523),
                    RoundnessSurveyStation("4", 135.0, -45.969, -16.593),
                    RoundnessSurveyStation("5", 180.0, -53.311, -22.124),
                    RoundnessSurveyStation("6", 225.0, -61.760, -25.720),
                    RoundnessSurveyStation("7", 270.0, -70.785, -27.229),
                    RoundnessSurveyStation("8", 315.0, -79.914, -26.514),
                ),
            ),
            RoundnessSurveyBand(
                surveyId = "roundness-02",
                label = "Ring 2",
                heightReference = "Top of the 1st shell course",
                stationCount = 8,
                stations = listOf(
                    RoundnessSurveyStation("1", 0.0, -34.375, 6.936),
                    RoundnessSurveyStation("2", 45.0, -36.150, -1.272),
                    RoundnessSurveyStation("3", 90.0, -40.154, -9.522),
                    RoundnessSurveyStation("4", 135.0, -45.939, -16.582),
                    RoundnessSurveyStation("5", 180.0, -53.287, -22.132),
                    RoundnessSurveyStation("6", 225.0, -61.746, -25.722),
                    RoundnessSurveyStation("7", 270.0, -70.779, -27.206),
                    RoundnessSurveyStation("8", 315.0, -79.915, -26.487),
                ),
            ),
        ),
    )

private fun demoPlumbnessSurvey(): PlumbnessSurvey =
    PlumbnessSurvey(
        stationCount = 12,
        stations = listOf(
            PlumbnessSurveyStation("1", 0.0, -34.13),
            PlumbnessSurveyStation("2", 30.0, 39.20),
            PlumbnessSurveyStation("3", 60.0, 55.52),
            PlumbnessSurveyStation("4", 90.0, 56.69),
            PlumbnessSurveyStation("5", 120.0, 39.33),
            PlumbnessSurveyStation("6", 150.0, 65.83),
            PlumbnessSurveyStation("7", 180.0, 38.33),
            PlumbnessSurveyStation("8", 210.0, 27.46),
            PlumbnessSurveyStation("9", 240.0, 2.11),
            PlumbnessSurveyStation("10", 270.0, -20.34),
            PlumbnessSurveyStation("11", 300.0, -43.71),
            PlumbnessSurveyStation("12", 330.0, -36.39),
        ),
    )

private fun demoRoofFeatures(): List<RoofFeature> =
    listOf(
        demoRoofFeature("roof-feature-001", "manhole", "MH1", "24"),
        demoRoofFeature("roof-feature-002", "gauge_hatch", "GH1", "27"),
        demoRoofFeature("roof-feature-003", "sump", "SU1", "25"),
        demoRoofFeature("roof-feature-004", "roof_leg", "RL1", "4"),
        demoRoofFeature("roof-feature-005", "roof_leg", "RL2", "14"),
        demoRoofFeature("roof-feature-006", "roof_leg", "RL3", "38"),
        demoRoofFeature("roof-feature-007", "roof_leg", "RL4", "47"),
        demoRoofFeature("roof-feature-008", "pontoon_fitting", "PT1", "8"),
        demoRoofFeature("roof-feature-009", "pontoon_fitting", "PT2", "46"),
        demoRoofFeature("roof-feature-010", "seal_detail", "SD1", "32"),
    )

private fun demoRoofUtRows(): List<RoofUtRow> =
    listOf(
        1 to listOf(4.902, 4.902, 4.851, 4.953, 4.953),
        2 to listOf(4.953, 4.928, 4.953, 5.004, 4.953),
        3 to listOf(4.801, 4.826, 4.750, 4.750, 4.750),
        4 to listOf(4.750, 4.699, 4.826, 4.775, 4.826),
        5 to listOf(4.902, 4.902, 4.953, 4.953, 4.877),
        6 to listOf(4.699, 4.572, 4.750, 4.826, 4.750),
        7 to listOf(4.674, 4.648, 4.699, 4.826, 4.826),
        8 to listOf(5.004, 4.953, 4.851, 4.953, 5.004),
        9 to listOf(4.953, 4.851, 4.902, 4.826, 4.953),
        10 to listOf(4.801, 4.851, 4.851, 4.801, 4.851),
        11 to listOf(4.851, 4.826, 4.851, 4.902, 4.902),
        12 to listOf(4.648, 4.572, 4.648, 4.648, 4.674),
        13 to listOf(4.826, 4.775, 4.851, 4.902, 4.902),
        14 to listOf(4.699, 4.750, 4.750, 4.699, 4.775),
        15 to listOf(4.801, 4.801, 4.775, 4.801, 4.801),
        16 to listOf(4.826, 4.775, 4.826, 4.826, 4.775),
        17 to listOf(4.902, 4.826, 4.826, 4.826, 4.902),
        18 to listOf(4.928, 4.902, 4.826, 4.826, 4.902),
        19 to listOf(4.902, 4.877, 4.902, 4.877, 4.953),
        20 to listOf(4.750, 4.750, 4.699, 4.699, 4.750),
        21 to listOf(4.826, 4.750, 4.750, 4.775, 4.775),
        22 to listOf(4.775, 4.750, 4.750, 4.826, 4.750),
        23 to listOf(4.902, 4.826, 4.902, 4.826, 4.826),
        24 to listOf(4.877, 4.851, 4.877, 4.851, 4.877),
        25 to listOf(4.902, 4.877, 4.826, 4.851, 4.851),
        26 to listOf(4.648, 4.572, 4.699, 4.648, 4.572),
        27 to listOf(4.775, 4.724, 4.623, 4.623, 4.623),
        28 to listOf(4.648, 4.699, 4.623, 4.648, 4.699),
        29 to listOf(4.699, 4.750, 4.699, 4.775, 4.775),
        30 to listOf(4.750, 4.750, 4.801, 4.826, 4.750),
        31 to listOf(4.648, 4.572, 4.699, 4.648, 4.572),
        32 to listOf(4.775, 4.724, 4.623, 4.623, 4.623),
        33 to listOf(4.648, 4.699, 4.623, 4.648, 4.699),
        34 to listOf(4.699, 4.750, 4.699, 4.775, 4.775),
        35 to listOf(4.750, 4.750, 4.801, 4.826, 4.750),
        36 to listOf(4.699, 4.750, 4.750, 4.775, 4.750),
        37 to listOf(4.826, 4.750, 4.775, 4.750, 4.775),
        38 to listOf(4.750, 4.801, 4.775, 4.750, 4.801),
        39 to listOf(4.623, 4.750, 4.699, 4.750, 4.750),
        40 to listOf(4.775, 4.826, 4.750, 4.750, 4.775),
        41 to listOf(4.826, 4.775, 4.750, 4.750, 4.750),
        42 to listOf(4.674, 4.750, 4.750, 4.801, 4.826),
        43 to listOf(4.775, 4.826, 4.750, 4.750, 4.750),
        44 to listOf(4.826, 4.851, 4.775, 4.851, 4.851),
        45 to listOf(4.775, 4.750, 4.750, 4.826, 4.801),
        46 to listOf(4.775, 4.750, 4.775, 4.750, 4.750),
        47 to listOf(4.953, 5.004, 4.953, 5.004, 4.978),
        48 to listOf(5.004, 4.953, 4.953, 5.004, 5.004),
        49 to listOf(4.877, 4.826, 4.902, 4.902, 4.851),
        50 to listOf(4.775, 4.750, 4.750, 4.775, 4.750),
    ).map { (plateNumber, readings) ->
        RoofUtRow(
            rowId = "roof-ut-${plateNumber.toString().padStart(3, '0')}",
            roofSurfaceId = ROOF_SURFACE_FLOATING,
            plateId = plateNumber.toString(),
            readings = readings,
            note = roofUtNoteForPlate(plateNumber),
        )
    }

private fun roofUtNoteForPlate(plateNumber: Int): String = when (plateNumber) {
    24 -> "Demo floating-roof UT near the main manhole access path."
    27 -> "Demo floating-roof UT near the gauge hatch and sump area."
    46 -> "Demo floating-roof UT near the outer pontoon fitting."
    else -> "Demo floating-roof plate UT."
}

private fun demoShellNozzles(): List<NozzleDefinition> =
    listOf(
        NozzleDefinition("SN-001", "shell", size = "24\"x36\"", placementMode = "line_linked_positioned", course = 1, azimuthDeg = 18.0, courseOffsetRatio = 0.52),
        NozzleDefinition("SN-002", "shell", size = "2\"", placementMode = "line_linked_positioned", course = 1, azimuthDeg = 92.0, courseOffsetRatio = 0.66),
        NozzleDefinition("SN-003", "shell", size = "30\"", placementMode = "line_linked_positioned", course = 2, azimuthDeg = 143.0, courseOffsetRatio = 0.43),
        NozzleDefinition("SN-004", "shell", size = "2\"", placementMode = "line_linked_positioned", course = 2, azimuthDeg = 214.0, courseOffsetRatio = 0.61),
        NozzleDefinition("SN-005", "shell", size = "8\"", placementMode = "line_linked_positioned", course = 3, azimuthDeg = 278.0, courseOffsetRatio = 0.48),
        NozzleDefinition("SN-006", "shell", size = "6\"", placementMode = "line_linked_positioned", course = 1, azimuthDeg = 336.0, courseOffsetRatio = 0.38),
    )

private fun demoShellNozzleUtRows(): List<NozzleUtRow> =
    listOf(
        DemoNozzleUtSpec("shell-nozzle-ut-001", "SN-001", listOf(13.487, 13.386, 13.589, 13.538), "Directional order: 12, 3, 6, 9 o'clock. Reinforcement pad included."),
        DemoNozzleUtSpec("shell-nozzle-ut-002", "SN-002", listOf(5.080, 5.207, 5.309, 5.207), "Directional order: 12, 3, 6, 9 o'clock. Reinforcement pad included."),
        DemoNozzleUtSpec("shell-nozzle-ut-003", "SN-003", listOf(13.589, 13.487, 13.335, 13.411), "Directional order: 12, 3, 6, 9 o'clock. Reinforcement pad included."),
        DemoNozzleUtSpec("shell-nozzle-ut-004", "SN-004", listOf(5.309, 5.131, 5.004, 5.182), "Directional order: 12, 3, 6, 9 o'clock. Reinforcement pad included."),
        DemoNozzleUtSpec("shell-nozzle-ut-005", "SN-005", listOf(13.589, 13.538, 13.513, 13.589), "Directional order: 12, 3, 6, 9 o'clock. Reinforcement pad included."),
        DemoNozzleUtSpec("shell-nozzle-ut-006", "SN-006", listOf(13.157, 12.929, 12.776, 13.005), "Directional order: 12, 3, 6, 9 o'clock. Reinforcement pad included."),
    ).map { spec ->
        NozzleUtRow(
            rowId = spec.rowId,
            nozzleId = spec.nozzleId,
            bodyReadings = spec.bodyReadings,
            reinforcementPadReading = when (spec.nozzleId) {
                "SN-001" -> 13.818
                "SN-002" -> 13.843
                "SN-003" -> 13.995
                "SN-004" -> 13.792
                "SN-005" -> 13.995
                "SN-006" -> 13.995
                else -> null
            },
            note = spec.note,
        )
    }

private fun demoRoofNozzles(): List<NozzleDefinition> =
    listOf(
        demoRoofNozzle("RN-001", "10\"", "11"),
        demoRoofNozzle("RN-002", "24\"", "15"),
        demoRoofNozzle("RN-003", "2\"", "18", hasReinforcementPad = false),
        demoRoofNozzle("RN-004", "2\"", "22", hasReinforcementPad = false),
        demoRoofNozzle("RN-005", "6\"", "27", hasReinforcementPad = false),
        demoRoofNozzle("RN-006", "2\"", "31", hasReinforcementPad = false),
        demoRoofNozzle("RN-007", "6\"", "35"),
        demoRoofNozzle("RN-008", "4\"", "41"),
        demoRoofNozzle("RN-009", "10\"", "46"),
    )

private fun demoRoofNozzleUtRows(): List<NozzleUtRow> =
    listOf(
        DemoNozzleUtSpec("roof-nozzle-ut-001", "RN-001", listOf(9.754, 9.677, 9.677, 9.754), "Directional order: north, east, south, west. Reinforcement pad included."),
        DemoNozzleUtSpec("roof-nozzle-ut-002", "RN-002", listOf(6.528, 6.477, 6.502, 6.502), "Directional order: north, east, south, west. Reinforcement pad included."),
        DemoNozzleUtSpec("roof-nozzle-ut-003", "RN-003", listOf(3.658, 3.683, 3.632, 3.632), "Directional order: north, east, south, west. No Pad."),
        DemoNozzleUtSpec("roof-nozzle-ut-004", "RN-004", listOf(3.556, 3.531, 3.531, 3.581), "Directional order: north, east, south, west. No Pad."),
        DemoNozzleUtSpec("roof-nozzle-ut-005", "RN-005", listOf(3.556, 3.607, 3.607, 3.632), "Directional order: north, east, south, west. No Pad."),
        DemoNozzleUtSpec("roof-nozzle-ut-006", "RN-006", listOf(3.632, 3.607, 3.632, 3.607), "Directional order: north, east, south, west. No Pad."),
        DemoNozzleUtSpec("roof-nozzle-ut-007", "RN-007", listOf(6.985, 7.010, 7.010, 6.985), "Directional order: north, east, south, west. Reinforcement pad included."),
        DemoNozzleUtSpec("roof-nozzle-ut-008", "RN-008", listOf(6.248, 6.248, 6.223, 6.274), "Directional order: north, east, south, west. Reinforcement pad included."),
        DemoNozzleUtSpec("roof-nozzle-ut-009", "RN-009", listOf(10.338, 10.312, 10.287, 10.312), "Directional order: north, east, south, west. Reinforcement pad included."),
    ).map { spec ->
        NozzleUtRow(
            rowId = spec.rowId,
            nozzleId = spec.nozzleId,
            roofSurfaceId = ROOF_SURFACE_FLOATING,
            bodyReadings = spec.bodyReadings,
            reinforcementPadReading = when (spec.nozzleId) {
                "RN-001" -> 6.401
                "RN-002" -> 6.299
                "RN-007" -> 6.350
                "RN-008" -> 6.198
                "RN-009" -> 6.172
                else -> null
            },
            note = spec.note,
        )
    }

private fun demoFindings(): List<FindingRecord> =
    listOf(
        FindingRecord(
            findingId = "finding-001",
            surface = "shell",
            type = "corrosion",
            severity = "medium",
            note = "Localized metal loss band visible on Lane 2, course 2. Use the loaded UT row as the reference point.",
            linkedMeasurementId = "shell-ut-006",
            locationSummary = "Lane 2 · Course 2 | east quadrant",
            preciseLineId = "line-02",
            preciseCourse = 2,
            attachmentIds = listOf("photo-004"),
        ),
        FindingRecord(
            findingId = "finding-002",
            surface = roofFindingSurface(ROOF_SURFACE_FLOATING),
            type = "coating_failure",
            severity = "low",
            note = "Coating wear concentrated around the floating-roof manhole and gauge hatch traffic path.",
            linkedMeasurementId = "roof-ut-024",
            locationSummary = "Floating roof · Plate 24 / MH1 approach",
            attachmentIds = listOf("photo-016"),
        ),
        FindingRecord(
            findingId = "finding-003",
            surface = roofFindingSurface(ROOF_SURFACE_FLOATING),
            type = "deformation",
            severity = "low",
            note = "Slight waviness observed on the outer deck between the pontoon fitting and seal detail zone.",
            linkedMeasurementId = "roof-ut-046",
            locationSummary = "Floating roof · Plate 46 · outer pontoon deck",
            attachmentIds = listOf("photo-017"),
        ),
        FindingRecord(
            findingId = "finding-004",
            surface = "shell_nozzle",
            type = "weld_concern",
            severity = "medium",
            note = "Nozzle neck to shell weld profile should be reviewed during repair planning.",
            linkedMeasurementId = "shell-nozzle-ut-003",
            locationSummary = "Shell nozzle SN-003 · Course 2 · 143°",
            attachmentIds = listOf("photo-010"),
        ),
        FindingRecord(
            findingId = "finding-005",
            surface = roofNozzleFindingSurface(ROOF_SURFACE_FLOATING),
            type = "corrosion",
            severity = "medium",
            note = "Roof nozzle bolting and local coating breakdown observed around the 10-inch nozzle assembly.",
            linkedMeasurementId = "roof-nozzle-ut-001",
            locationSummary = "Floating roof nozzle RN-001 · Plate 11",
            attachmentIds = listOf("photo-018"),
        ),
        FindingRecord(
            findingId = "finding-006",
            surface = "shell_element",
            type = "coating_failure",
            severity = "low",
            note = "Coating breakdown on the shell ladder / handrail assembly. Use this as the shell-element example in the coverage sample.",
            locationSummary = "Shell element · access ladder north side",
            attachmentIds = listOf("photo-019"),
        ),
        FindingRecord(
            findingId = "finding-007",
            surface = "diked_area",
            type = "housekeeping",
            severity = "low",
            note = "Diked area housekeeping issue with pooled water and surface debris near the tank pad.",
            locationSummary = "Diked area · east drain corner",
            attachmentIds = listOf("photo-020"),
        ),
    )

private fun demoAttachments(): List<AttachmentRecord> =
    listOf(
        AttachmentRecord("photo-004", "photo", "images/photo_04.jpg", "Demo shell corrosion band"),
        AttachmentRecord("photo-010", "photo", "images/photo_10.jpg", "Demo shell nozzle weld concern"),
        AttachmentRecord("photo-016", "photo", "images/photo_16.jpg", "Demo floating-roof coating wear"),
        AttachmentRecord("photo-017", "photo", "images/photo_17.jpg", "Demo outer deck waviness"),
        AttachmentRecord("photo-018", "photo", "images/photo_18.jpg", "Demo floating-roof nozzle corrosion"),
        AttachmentRecord("photo-019", "photo", "images/photo_19.jpg", "Demo shell ladder / handrail coating failure"),
        AttachmentRecord("photo-020", "photo", "images/photo_20.jpg", "Demo diked area pooled water and debris"),
    )

private fun demoCoverageMixedFieldDraftState(): FieldDraftState {
    val selectedTasks = defaultFieldTasks()
    val roundnessSurvey = demoRoundnessSurvey()
    val plumbnessSurvey = demoPlumbnessSurvey()

    return finalizeDemoState(
        FieldDraftState(
            startedAtIso = "2026-05-16T08:00:00Z",
            setup = SetupFormState(
                client = "IRS Coverage Demo",
                site = "Mixed Roof Verification Yard",
                tankNumber = "COV-01",
                diameterM = "28.65",
                heightM = "14.20",
                shellCourseCount = "4",
                fixedRoofType = "cone",
                floatingRoofType = "internal",
                inspector = "Syed Abdul Rahman Balkhi / Mulyadi Bin Taib",
                thicknessUnit = MeasurementUnit.MM,
                settlementUnit = MeasurementUnit.MM,
                nozzleSizeUnit = NozzleSizeUnit.INCH,
            ),
            scope = ScopeFormState(
                referenceMode = ReferenceMode.TANK_NORTH,
                referenceRemark = "Gauge pole centerline used as 0° reference",
                rotationDirection = RotationDirection.CLOCKWISE,
                selectedTasks = selectedTasks,
            ),
            shellLineCountOverride = "4",
            shellCaptureStartLaneId = "line-01",
            shellUtRows = demoShellUtRows(),
            shellSettlementDraft = ShellSettlementDraftInput(
                stationCount = "8",
                stations = demoShellSettlementStations().map { station ->
                    ShellSettlementStationDraftInput(
                        stationId = station.stationId,
                        angleDeg = station.angleDeg,
                        elevation = station.elevation?.toString().orEmpty(),
                        captureState = station.captureState,
                        note = station.note.orEmpty(),
                    )
                },
            ),
            savedShellSettlementSurvey = ShellSettlementSurvey(
                stationCount = 8,
                stations = demoShellSettlementStations(),
            ),
            roundnessSurveyDraft = RoundnessSurveyDraftInput(
                surveyLabel = "Ring 1",
                heightReference = "1 ft above bottom projection plate",
                stationCount = "8",
                stations = defaultRoundnessSurveyStationDrafts(8),
            ),
            savedRoundnessSurvey = roundnessSurvey,
            plumbnessSurveyDraft = PlumbnessSurveyDraftInput(
                stationCount = plumbnessSurvey.stationCount.toString(),
                stations = plumbnessSurvey.stations.map { station ->
                    PlumbnessSurveyStationDraftInput(
                        stationId = station.stationId,
                        angleDeg = station.angleDeg,
                        plumbness = station.plumbness?.toString().orEmpty(),
                        captureState = station.captureState,
                        note = station.note.orEmpty(),
                    )
                },
            ),
            savedPlumbnessSurvey = plumbnessSurvey,
            fixedRoofLayoutDraft = tjs465FixedRoofLayoutDraft,
            savedFixedRoofLayoutDraft = tjs465FixedRoofLayoutDraft,
            floatingRoofLayoutDraft = tjs465FloatingRoofLayoutDraft,
            savedFloatingRoofLayoutDraft = tjs465FloatingRoofLayoutDraft,
            activeRoofSurfaceId = ROOF_SURFACE_FIXED,
            roofFeatureDraft = RoofFeatureDraftInput(
                roofSurfaceId = ROOF_SURFACE_FIXED,
                type = "support_column",
                quantity = "4",
            ),
            roofFeatures = demoTjs465RoofFeatures(),
            roofUtDraft = RoofUtDraftInput(roofSurfaceId = ROOF_SURFACE_FIXED),
            roofUtRows = demoTjs465RoofUtRows(),
            shellNozzles = demoShellNozzles(),
            shellNozzleUtDraft = NozzleUtDraftInput(),
            shellNozzleUtRows = demoShellNozzleUtRows(),
            roofNozzleDraft = RoofNozzleDraftInput(roofSurfaceId = ROOF_SURFACE_FIXED),
            roofNozzles = demoTjs465RoofNozzles(),
            roofNozzleUtDraft = NozzleUtDraftInput(roofSurfaceId = ROOF_SURFACE_FIXED),
            roofNozzleUtRows = demoTjs465RoofNozzleUtRows(),
            findings = demoTjs465Findings(),
            attachments = demoTjs465Attachments(),
            mflImportDraft = MflImportDraftInput(),
        ),
    )
}

private fun demoTjs465FieldDraftState(): FieldDraftState =
    finalizeDemoState(
        FieldDraftState(
            startedAtIso = "2026-05-16T08:00:00Z",
            setup = SetupFormState(
                client = "TJS Pte Ltd (Chemstationasia Group)",
                site = "Vava'u Terminal, Tonga",
                tankNumber = "465",
                diameterM = "7.8",
                heightM = "9.14",
                shellCourseCount = "6",
                fixedRoofType = "cone",
                floatingRoofType = "none",
                inspector = "Syed Abdul Rahman Balkhi / Mulyadi Bin Taib",
                thicknessUnit = MeasurementUnit.MM,
                settlementUnit = MeasurementUnit.MM,
                nozzleSizeUnit = NozzleSizeUnit.INCH,
            ),
            scope = ScopeFormState(
                referenceMode = ReferenceMode.TANK_NORTH,
                referenceRemark = "Gauge pole centerline used as 0° reference",
                rotationDirection = RotationDirection.CLOCKWISE,
                selectedTasks = reportFaithfulTjsTasks,
            ),
            shellLineCountOverride = "4",
            shellCaptureStartLaneId = "line-01",
            shellUtRows = tjs465ShellUtRows(),
            fixedRoofLayoutDraft = tjs465ReportFixedRoofLayoutDraft,
            savedFixedRoofLayoutDraft = tjs465ReportFixedRoofLayoutDraft,
            activeRoofSurfaceId = ROOF_SURFACE_FIXED,
            roofFeatureDraft = RoofFeatureDraftInput(
                roofSurfaceId = ROOF_SURFACE_FIXED,
                type = "support_column",
                quantity = "4",
            ),
            roofFeatures = demoTjs465RoofFeatures().filter { feature -> feature.roofSurfaceId == ROOF_SURFACE_FIXED },
            roofUtDraft = RoofUtDraftInput(roofSurfaceId = ROOF_SURFACE_FIXED),
            roofUtRows = tjs465RoofUtRows(),
            shellNozzles = tjs465ShellNozzles(),
            shellNozzleUtDraft = NozzleUtDraftInput(),
            shellNozzleUtRows = tjs465ShellNozzleUtRows(),
            roofNozzleDraft = RoofNozzleDraftInput(roofSurfaceId = ROOF_SURFACE_FIXED),
            roofNozzles = tjs465RoofNozzles(),
            roofNozzleUtDraft = NozzleUtDraftInput(roofSurfaceId = ROOF_SURFACE_FIXED),
            roofNozzleUtRows = tjs465RoofNozzleUtRows(),
            findings = tjs465Findings(),
            attachments = tjs465Attachments(),
            mflImportDraft = MflImportDraftInput(),
        ),
    )

private val tjs465ReportFixedRoofLayoutDraft = RoofLayoutDraftInput(
    template = RoofTemplate.CONE_RADIAL,
    ringCount = "3",
    sectorCount = "20",
)

private fun tjs465ShellUtRows(): List<ShellUtRow> =
    listOf(
        tjsShellUtRow("tjs-shell-ut-001", "line-01", 1, listOf(6.52, 6.48, 6.51, 6.43, 6.50)),
        tjsShellUtRow("tjs-shell-ut-002", "line-02", 1, listOf(6.55, 6.54, 6.60, 6.61, 6.60)),
        tjsShellUtRow("tjs-shell-ut-003", "line-03", 1, listOf(6.60, 6.64, 6.67, 6.69, 6.66)),
        tjsShellUtRow("tjs-shell-ut-004", "line-04", 1, listOf(6.70, 6.72, 6.76, 6.75, 6.70)),
        tjsShellUtRow("tjs-shell-ut-005", "line-01", 2, listOf(6.58, 6.31, 6.66, 6.60, 6.61)),
        tjsShellUtRow("tjs-shell-ut-006", "line-02", 2, listOf(6.62, 6.66, 6.58, 6.66, 6.63)),
        tjsShellUtRow("tjs-shell-ut-007", "line-03", 2, listOf(6.70, 6.85, 6.87, 6.55, 6.55)),
        tjsShellUtRow("tjs-shell-ut-008", "line-04", 2, listOf(6.30, 6.28, 6.33, 6.36, 6.24)),
        tjsShellUtRow("tjs-shell-ut-009", "line-01", 3, listOf(6.65, 6.54, 6.51, 6.51, 6.56)),
        tjsShellUtRow("tjs-shell-ut-010", "line-02", 3, listOf(6.51, 6.54, 6.44, 6.45, 6.50)),
        tjsShellUtRow("tjs-shell-ut-011", "line-03", 3, listOf(6.61, 6.37, 6.61, 6.66, 6.64)),
        tjsShellUtRow("tjs-shell-ut-012", "line-04", 3, listOf(6.54, 6.54, 6.46, 6.58, 6.55)),
        tjsShellUtRow("tjs-shell-ut-013", "line-01", 4, listOf(6.51, 6.51, 6.52, 6.50, 6.49)),
        tjsShellUtRow("tjs-shell-ut-014", "line-02", 4, listOf(6.57, 6.54, 6.52, 6.51, 6.54)),
        tjsShellUtRow("tjs-shell-ut-015", "line-03", 4, listOf(6.46, 6.48, 6.58, 6.57, 6.48)),
        tjsShellUtRow("tjs-shell-ut-016", "line-04", 4, listOf(6.21, 6.27, 6.37, 6.35, 6.31)),
        tjsShellUtRow("tjs-shell-ut-017", "line-01", 5, listOf(6.57, 6.60, 6.58, 6.56, 6.55)),
        tjsShellUtRow("tjs-shell-ut-018", "line-02", 5, listOf(6.61, 6.60, 6.57, 6.39, 6.55)),
        tjsShellUtRow("tjs-shell-ut-019", "line-03", 5, listOf(6.39, 6.42, 6.48, 6.43, 6.33)),
        tjsShellUtRow("tjs-shell-ut-020", "line-04", 5, listOf(6.30, 6.34, 6.33, 6.28, 6.27)),
        tjsShellUtRow("tjs-shell-ut-021", "line-01", 6, listOf(6.63, 6.60, 6.55, 6.56, 6.57)),
        tjsShellUtRow("tjs-shell-ut-022", "line-02", 6, listOf(6.70, 6.68, 6.66, 6.70, 6.71)),
        tjsShellUtRow("tjs-shell-ut-023", "line-03", 6, listOf(6.51, 6.60, 6.65, 6.73, 6.60)),
        tjsShellUtRow("tjs-shell-ut-024", "line-04", 6, listOf(6.41, 6.41, 6.37, 6.48, 6.40)),
    )

private fun tjsShellUtRow(
    rowId: String,
    lineId: String,
    course: Int,
    readings: List<Double>,
): ShellUtRow = ShellUtRow(
    rowId = rowId,
    lineId = lineId,
    course = course,
    readings = readings,
    note = "IRS 16TJS4 TK-465 shell UT · ${lineId.replace("line-01", "N").replace("line-02", "E").replace("line-03", "S").replace("line-04", "W")} · Strake $course.",
)

private fun tjs465RoofUtRows(): List<RoofUtRow> =
    listOf(
        tjsRoofUtRow(1, listOf(4.55, 4.41, 4.63, 4.50, 4.49)),
        tjsRoofUtRow(2, listOf(4.54, 4.17, 4.39, 4.46, 4.45)),
        tjsRoofUtRow(3, listOf(4.45, 4.36, 4.35, 4.42, 4.49)),
        tjsRoofUtRow(4, listOf(4.45, 4.26, 4.36, 4.46, 4.42)),
        tjsRoofUtRow(5, listOf(4.50, 4.33, 4.53, 4.45, 4.46)),
        tjsRoofUtRow(6, listOf(4.45, 4.35, 4.19, 4.28, 4.36)),
        tjsRoofUtRow(7, listOf(4.29, 4.47, 4.55, 4.47, 4.36)),
        tjsRoofUtRow(8, listOf(4.37, 4.50, 4.30, 4.43, 4.51)),
        tjsRoofUtRow(9, listOf(4.47, 4.51, 4.45, 4.33, 4.38)),
        tjsRoofUtRow(10, listOf(4.52, 4.37, 4.28, 4.43, 4.45)),
        tjsRoofUtRow(11, listOf(4.60, 4.51, 4.52, 4.50, 4.47)),
        tjsRoofUtRow(12, listOf(4.56, 4.57, 4.49, 4.41, 4.51)),
        tjsRoofUtRow(13, listOf(4.53, 4.27, 4.29, 4.55, 4.46)),
        tjsRoofUtRow(14, listOf(4.44, 4.38, 4.36, 4.52, 4.51)),
        tjsRoofUtRow(15, listOf(4.37, 4.28, 4.25, 4.51, 4.37)),
        tjsRoofUtRow(16, listOf(4.59, 4.55, 4.56, 4.32, 4.33)),
        tjsRoofUtRow(17, listOf(4.35, 4.54, 4.54, 4.41, 4.43)),
        tjsRoofUtRow(18, listOf(4.53, 4.31, 4.52, 4.33, 4.57)),
        tjsRoofUtRow(19, listOf(4.45, 4.45, 4.30, 4.38, 4.35)),
        tjsRoofUtRow(20, listOf(4.53, 4.30, 4.33, 4.42, 4.45)),
        tjsRoofUtRow(21, listOf(9.39, 9.71, 9.56, 9.50, 9.41)),
        tjsRoofUtRow(22, listOf(9.46, 9.36, 9.55, 9.54, 9.46)),
        tjsRoofUtRow(23, listOf(9.50, 9.53, 9.61, 9.55, 9.56)),
    )

private fun tjsRoofUtRow(
    plateNumber: Int,
    readings: List<Double>,
): RoofUtRow = RoofUtRow(
    rowId = "tjs-roof-ut-${plateNumber.toString().padStart(3, '0')}",
    roofSurfaceId = ROOF_SURFACE_FIXED,
    plateId = plateNumber.toString(),
    readings = readings,
    note = "IRS 16TJS4 TK-465 fixed-roof plate UT.",
)

private fun tjs465ShellNozzles(): List<NozzleDefinition> =
    listOf(
        NozzleDefinition("S1", "shell", size = "Unknown", hasReinforcementPad = true, placementMode = "line_linked_positioned", course = 1, azimuthDeg = 0.0, courseOffsetRatio = 0.45),
        NozzleDefinition("S2", "shell", size = "Unknown", hasReinforcementPad = true, placementMode = "line_linked_positioned", course = 2, azimuthDeg = 90.0, courseOffsetRatio = 0.52),
        NozzleDefinition("S3", "shell", size = "Unknown", hasReinforcementPad = true, placementMode = "line_linked_positioned", course = 3, azimuthDeg = 180.0, courseOffsetRatio = 0.48),
        NozzleDefinition("S4", "shell", size = "Unknown", hasReinforcementPad = true, placementMode = "line_linked_positioned", course = 4, azimuthDeg = 270.0, courseOffsetRatio = 0.50),
    )

private fun tjs465ShellNozzleUtRows(): List<NozzleUtRow> =
    listOf(
        NozzleUtRow("tjs-shell-nozzle-ut-001", "S1", bodyReadings = listOf(10.04, 10.01, 9.84, 10.04), reinforcementPadReading = 6.09, note = "IRS 16TJS4 TK-465 shell nozzle UT."),
        NozzleUtRow("tjs-shell-nozzle-ut-002", "S2", bodyReadings = listOf(5.63, 5.34, 5.50, 5.46), reinforcementPadReading = 6.20, note = "IRS 16TJS4 TK-465 shell nozzle UT."),
        NozzleUtRow("tjs-shell-nozzle-ut-003", "S3", bodyReadings = listOf(5.40, 5.50, 5.51, 5.42), reinforcementPadReading = 6.03, note = "IRS 16TJS4 TK-465 shell nozzle UT."),
        NozzleUtRow("tjs-shell-nozzle-ut-004", "S4", bodyReadings = listOf(5.55, 5.36, 5.41, 5.39), reinforcementPadReading = 6.01, note = "IRS 16TJS4 TK-465 shell nozzle UT."),
    )

private fun tjs465RoofNozzles(): List<NozzleDefinition> =
    listOf(
        demoRoofNozzleForSurface("R1", ROOF_SURFACE_FIXED, tjs465ReportFixedRoofLayoutDraft, "Unknown", "1"),
        demoRoofNozzleForSurface("R2", ROOF_SURFACE_FIXED, tjs465ReportFixedRoofLayoutDraft, "Unknown", "4"),
        demoRoofNozzleForSurface("R3", ROOF_SURFACE_FIXED, tjs465ReportFixedRoofLayoutDraft, "Unknown", "6"),
    )

private fun tjs465RoofNozzleUtRows(): List<NozzleUtRow> =
    listOf(
        NozzleUtRow("tjs-roof-nozzle-ut-001", "R1", ROOF_SURFACE_FIXED, listOf(6.28, 6.05, 6.25, 6.17), reinforcementPadReading = 6.39, note = "IRS 16TJS4 TK-465 roof nozzle UT."),
        NozzleUtRow("tjs-roof-nozzle-ut-002", "R2", ROOF_SURFACE_FIXED, listOf(6.70, 6.58, 6.61, 6.58), reinforcementPadReading = 9.45, note = "IRS 16TJS4 TK-465 roof nozzle UT."),
        NozzleUtRow("tjs-roof-nozzle-ut-003", "R3", ROOF_SURFACE_FIXED, listOf(5.97, 6.12, 5.99, 6.03), reinforcementPadReading = 5.99, note = "IRS 16TJS4 TK-465 roof nozzle UT."),
    )

private fun tjs465Findings(): List<FindingRecord> =
    listOf(
        FindingRecord(
            findingId = "tjs-finding-001",
            surface = roofFindingSurface(ROOF_SURFACE_FIXED),
            type = "coating_failure",
            severity = "low",
            note = "Coating wear visible around the fixed-roof manhole and adjacent support-column traffic path.",
            linkedMeasurementId = "tjs-roof-ut-004",
            locationSummary = "Fixed roof · Plate 4 / MH1 area",
            attachmentIds = listOf("tjs-photo-001"),
        ),
        FindingRecord(
            findingId = "tjs-finding-002",
            surface = "shell_nozzle",
            type = "weld_concern",
            severity = "medium",
            note = "Local corrosion and coating breakdown around shell nozzle S2.",
            linkedMeasurementId = "tjs-shell-nozzle-ut-002",
            locationSummary = "Shell nozzle S2 · east quadrant",
            attachmentIds = listOf("tjs-photo-002"),
        ),
        FindingRecord(
            findingId = "tjs-finding-003",
            surface = roofNozzleFindingSurface(ROOF_SURFACE_FIXED),
            type = "corrosion",
            severity = "medium",
            note = "Local corrosion around the roof nozzle collar and nearby reinforcement pad.",
            linkedMeasurementId = "tjs-roof-nozzle-ut-002",
            locationSummary = "Fixed roof nozzle R2",
            attachmentIds = listOf("tjs-photo-003"),
        ),
    )

private fun tjs465Attachments(): List<AttachmentRecord> =
    listOf(
        AttachmentRecord("tjs-photo-001", "photo", "images/tjs_465_photo_01.jpg", "TK-465 fixed-roof manhole coating wear"),
        AttachmentRecord("tjs-photo-002", "photo", "images/tjs_465_photo_02.jpg", "TK-465 shell nozzle corrosion"),
        AttachmentRecord("tjs-photo-003", "photo", "images/tjs_465_photo_03.jpg", "TK-465 roof nozzle corrosion"),
    )

private fun demoTjs465RoofFeatures(): List<RoofFeature> =
    listOf(
        demoRoofFeatureForSurface("tjs-fixed-feature-001", ROOF_SURFACE_FIXED, tjs465FixedRoofLayoutDraft, "manhole", "MH1", "1"),
        demoRoofFeatureForSurface("tjs-fixed-feature-002", ROOF_SURFACE_FIXED, tjs465FixedRoofLayoutDraft, "stairway_termination", "ST1", "1"),
        demoRoofFeatureForSurface("tjs-fixed-feature-003", ROOF_SURFACE_FIXED, tjs465FixedRoofLayoutDraft, "stairway_termination", "ST2", "6"),
        demoRoofFeatureForSurface("tjs-fixed-feature-004", ROOF_SURFACE_FIXED, tjs465FixedRoofLayoutDraft, "stairway_termination", "ST3", "16"),
        demoRoofFeatureForSurface("tjs-fixed-feature-005", ROOF_SURFACE_FIXED, tjs465FixedRoofLayoutDraft, "roof_ladder", "LD1", "11"),
        demoRoofFeatureForSurface("tjs-floating-feature-001", ROOF_SURFACE_FLOATING, tjs465FloatingRoofLayoutDraft, "seal_detail", "SD1", "24"),
        demoRoofFeatureForSurface("tjs-floating-feature-002", ROOF_SURFACE_FLOATING, tjs465FloatingRoofLayoutDraft, "seal_shoe", "SS1", "AR4"),
        demoRoofFeatureForSurface("tjs-floating-feature-003", ROOF_SURFACE_FLOATING, tjs465FloatingRoofLayoutDraft, "drain_hose", "DH1", "21"),
        demoRoofFeatureForSurface("tjs-floating-feature-004", ROOF_SURFACE_FLOATING, tjs465FloatingRoofLayoutDraft, "guide_pole", "GP1", "15"),
        demoRoofFeatureForSurface("tjs-floating-feature-005", ROOF_SURFACE_FLOATING, tjs465FloatingRoofLayoutDraft, "anti_rotation_cable", "AC1", "18"),
        demoRoofFeatureForSurface("tjs-floating-feature-006", ROOF_SURFACE_FLOATING, tjs465FloatingRoofLayoutDraft, "roof_leg", "RL1", "4"),
        demoRoofFeatureForSurface("tjs-floating-feature-007", ROOF_SURFACE_FLOATING, tjs465FloatingRoofLayoutDraft, "roof_leg", "RL2", "8"),
        demoRoofFeatureForSurface("tjs-floating-feature-008", ROOF_SURFACE_FLOATING, tjs465FloatingRoofLayoutDraft, "roof_leg", "RL3", "33"),
        demoRoofFeatureForSurface("tjs-floating-feature-009", ROOF_SURFACE_FLOATING, tjs465FloatingRoofLayoutDraft, "roof_leg", "RL4", "30"),
        demoRoofFeatureForSurface("tjs-floating-feature-010", ROOF_SURFACE_FLOATING, tjs465FloatingRoofLayoutDraft, "rolling_ladder", "RD1", "28"),
        demoRoofFeatureForSurface("tjs-floating-feature-011", ROOF_SURFACE_FLOATING, tjs465FloatingRoofLayoutDraft, "pontoon_manhole", "PMH1", "36"),
        demoRoofFeatureForSurface("tjs-floating-feature-012", ROOF_SURFACE_FLOATING, tjs465FloatingRoofLayoutDraft, "pontoon_fitting", "PT1", "AR9"),
    )

private fun demoTjs465RoofUtRows(): List<RoofUtRow> =
    listOf(
        RoofUtRow("tjs-fixed-roof-ut-001", ROOF_SURFACE_FIXED, "4", listOf(4.82, 4.80, 4.85, 4.83, 4.84), note = "Fixed roof plate UT near the main roof manhole."),
        RoofUtRow("tjs-fixed-roof-ut-002", ROOF_SURFACE_FIXED, "16", listOf(4.91, 4.88, 4.90, 4.89, 4.86), note = "Fixed roof plate UT around the support-column grid."),
        RoofUtRow("tjs-fixed-roof-ut-003", ROOF_SURFACE_FIXED, "21", listOf(4.78, 4.81, 4.79, 4.82, 4.80), note = "Fixed roof plate UT near the center transition plate."),
        RoofUtRow("tjs-floating-roof-ut-001", ROOF_SURFACE_FLOATING, "15", listOf(5.03, 5.01, 5.00, 5.04, 5.02), note = "Internal floating roof center-deck plate UT near the guide pole."),
        RoofUtRow("tjs-floating-roof-ut-002", ROOF_SURFACE_FLOATING, "24", listOf(4.92, 4.90, 4.91, 4.88, 4.89), note = "Internal floating roof deck plate UT near the primary seal detail."),
        RoofUtRow("tjs-floating-roof-ut-003", ROOF_SURFACE_FLOATING, "36", listOf(4.86, 4.88, 4.84, 4.87, 4.85), note = "Internal floating roof plate UT near the pontoon manhole."),
    )

private fun demoTjs465RoofNozzles(): List<NozzleDefinition> =
    listOf(
        demoRoofNozzleForSurface("FRN-001", ROOF_SURFACE_FIXED, tjs465FixedRoofLayoutDraft, "10\"", "4"),
        demoRoofNozzleForSurface("FRN-002", ROOF_SURFACE_FIXED, tjs465FixedRoofLayoutDraft, "6\"", "22"),
        demoRoofNozzleForSurface("FRN-003", ROOF_SURFACE_FIXED, tjs465FixedRoofLayoutDraft, "4\"", "6", hasReinforcementPad = false),
        demoRoofNozzleForSurface("IRN-001", ROOF_SURFACE_FLOATING, tjs465FloatingRoofLayoutDraft, "8\"", "12"),
        demoRoofNozzleForSurface("IRN-002", ROOF_SURFACE_FLOATING, tjs465FloatingRoofLayoutDraft, "4\"", "27", hasReinforcementPad = false),
        demoRoofNozzleForSurface("IRN-003", ROOF_SURFACE_FLOATING, tjs465FloatingRoofLayoutDraft, "6\"", "31"),
    )

private fun demoTjs465RoofNozzleUtRows(): List<NozzleUtRow> =
    listOf(
        NozzleUtRow("tjs-fixed-roof-nozzle-ut-001", "FRN-001", ROOF_SURFACE_FIXED, listOf(8.22, 8.18, 8.19, 8.21), reinforcementPadReading = 8.33, note = "Fixed roof nozzle UT at the 10-inch vent nozzle."),
        NozzleUtRow("tjs-fixed-roof-nozzle-ut-002", "FRN-002", ROOF_SURFACE_FIXED, listOf(6.41, 6.38, 6.39, 6.40), reinforcementPadReading = 6.55, note = "Fixed roof nozzle UT around the ladder-side branch nozzle."),
        NozzleUtRow("tjs-fixed-roof-nozzle-ut-003", "FRN-003", ROOF_SURFACE_FIXED, listOf(4.76, 4.74, 4.73, 4.75), reinforcementPadReading = null, note = "Fixed roof nozzle UT. No Pad."),
        NozzleUtRow("tjs-floating-roof-nozzle-ut-001", "IRN-001", ROOF_SURFACE_FLOATING, listOf(7.16, 7.13, 7.14, 7.12), reinforcementPadReading = 7.28, note = "Internal floating roof nozzle UT near the guide pole well."),
        NozzleUtRow("tjs-floating-roof-nozzle-ut-002", "IRN-002", ROOF_SURFACE_FLOATING, listOf(4.28, 4.26, 4.27, 4.24), reinforcementPadReading = null, note = "Internal floating roof nozzle UT. No Pad."),
        NozzleUtRow("tjs-floating-roof-nozzle-ut-003", "IRN-003", ROOF_SURFACE_FLOATING, listOf(5.94, 5.91, 5.93, 5.90), reinforcementPadReading = 6.08, note = "Internal floating roof nozzle UT near the pontoon deck access."),
    )

private fun demoTjs465Findings(): List<FindingRecord> =
    listOf(
        FindingRecord(
            findingId = "tjs-finding-001",
            surface = roofFindingSurface(ROOF_SURFACE_FIXED),
            type = "coating_failure",
            severity = "low",
            note = "Coating wear visible around the fixed-roof manhole and adjacent support-column traffic path.",
            linkedMeasurementId = "tjs-fixed-roof-ut-001",
            locationSummary = "Fixed roof · Plate 4 / MH1 area",
            attachmentIds = listOf("tjs-photo-001"),
        ),
        FindingRecord(
            findingId = "tjs-finding-002",
            surface = roofFindingSurface(ROOF_SURFACE_FLOATING),
            type = "deformation",
            severity = "medium",
            note = "Seal detail shows waviness and local seal-shoe wear near the drain hose path.",
            linkedMeasurementId = "tjs-floating-roof-ut-002",
            locationSummary = "Internal floating roof · Plate 24 / seal detail zone",
            attachmentIds = listOf("tjs-photo-002"),
        ),
        FindingRecord(
            findingId = "tjs-finding-003",
            surface = roofNozzleFindingSurface(ROOF_SURFACE_FLOATING),
            type = "corrosion",
            severity = "medium",
            note = "Local corrosion around the floating-roof nozzle collar and attachment bolts.",
            linkedMeasurementId = "tjs-floating-roof-nozzle-ut-003",
            locationSummary = "Internal floating roof nozzle IRN-003 · Plate 31",
            attachmentIds = listOf("tjs-photo-003"),
        ),
    )

private fun demoTjs465Attachments(): List<AttachmentRecord> =
    demoAttachments() + listOf(
        AttachmentRecord("tjs-photo-001", "photo", "images/tjs_465_photo_01.jpg", "Demo fixed-roof manhole coating wear"),
        AttachmentRecord("tjs-photo-002", "photo", "images/tjs_465_photo_02.jpg", "Demo internal floating-roof seal-detail wear"),
        AttachmentRecord("tjs-photo-003", "photo", "images/tjs_465_photo_03.jpg", "Demo internal floating-roof nozzle corrosion"),
    )

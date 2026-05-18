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

fun demoFieldDraftState(): FieldDraftState {
    val selectedTasks = defaultFieldTasks()
    val settlementStations = demoShellSettlementStations()
    val roundnessSurvey = demoRoundnessSurvey()
    val plumbnessSurvey = demoPlumbnessSurvey()

    return FieldDraftState(
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
        roundnessSurveyDraft = RoundnessSurveyDraftInput(
            surveyLabel = "Ring 3",
            heightReference = "Top of the 2nd shell course",
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
    ).let { state ->
        state.copy(
            savedReferenceBaselineKey = state.currentFundamentalBaselineKey(),
            savedSetupBaseline = state.setup,
            savedScopeBaseline = state.scope,
            savedShellLineCountOverride = state.shellLineCountOverride,
            savedShellCaptureStartLaneId = state.currentShellCaptureStartLaneId(),
            savedShellPlanKey = state.currentShellPlanKey(),
        )
    }
}

private val floatingRoofDemoLayoutDraft = RoofLayoutDraftInput(
    template = RoofTemplate.CIRCULAR_PLATE,
    rowCount = "5",
    widestRowPlateCount = "12",
    hasAnnularRing = true,
    annularSectionCount = "16",
    hasPontoonDeck = true,
)

private val floatingRoofDemoLinkTargets by lazy {
    buildRoofLinkTargetsForConfig(
        template = floatingRoofDemoLayoutDraft.template,
        rowCount = floatingRoofDemoLayoutDraft.rowCount.toIntOrNull() ?: 0,
        widestRowPlateCount = floatingRoofDemoLayoutDraft.widestRowPlateCount.toIntOrNull() ?: 0,
        ringCount = floatingRoofDemoLayoutDraft.ringCount.toIntOrNull() ?: 0,
        sectorCount = floatingRoofDemoLayoutDraft.sectorCount.toIntOrNull() ?: 0,
        referenceAzimuthDeg = 0.0,
        rotationDirection = RotationDirection.CLOCKWISE,
        hasAnnularRing = floatingRoofDemoLayoutDraft.hasAnnularRing,
        annularSectionCount = floatingRoofDemoLayoutDraft.annularSectionCount.toIntOrNull() ?: 0,
    )
}

private fun floatingRoofDemoPlacementForPlate(plateId: String): Pair<Double, Double> {
    val cell = floatingRoofDemoLinkTargets.firstOrNull { target -> target.plateId == plateId }
        ?: error("Missing demo roof plate target for $plateId")
    return canvasPointToRoofPolar(cell.xNorm, cell.yNorm)
}

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
    )

private fun demoAttachments(): List<AttachmentRecord> =
    listOf(
        AttachmentRecord("photo-004", "photo", "images/photo_04.jpg", "Demo shell corrosion band"),
        AttachmentRecord("photo-010", "photo", "images/photo_10.jpg", "Demo shell nozzle weld concern"),
        AttachmentRecord("photo-016", "photo", "images/photo_16.jpg", "Demo floating-roof coating wear"),
        AttachmentRecord("photo-017", "photo", "images/photo_17.jpg", "Demo outer deck waviness"),
        AttachmentRecord("photo-018", "photo", "images/photo_18.jpg", "Demo floating-roof nozzle corrosion"),
    )

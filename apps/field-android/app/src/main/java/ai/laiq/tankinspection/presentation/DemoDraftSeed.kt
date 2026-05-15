package ai.laiq.tankinspection.presentation

import ai.laiq.tankinspection.domain.model.FindingRecord
import ai.laiq.tankinspection.domain.model.NozzleDefinition
import ai.laiq.tankinspection.domain.model.NozzleUtRow
import ai.laiq.tankinspection.domain.model.ReferenceMode
import ai.laiq.tankinspection.domain.model.RoofFeature
import ai.laiq.tankinspection.domain.model.ShellSettlementStation
import ai.laiq.tankinspection.domain.model.ShellSettlementSurvey
import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.domain.model.RoofUtRow
import ai.laiq.tankinspection.domain.model.RotationDirection
import ai.laiq.tankinspection.domain.model.ShellUtRow

fun demoFieldDraftState(): FieldDraftState =
    FieldDraftState(
        startedAtIso = "2026-05-12T08:30:00Z",
        setup = SetupFormState(
            client = "Terminal Integrity",
            site = "Kerteh Tank Farm",
            tankNumber = "TK-13",
            diameterM = "20",
            heightM = "14.5",
            shellCourseCount = "8",
            roofType = "umbrella",
            inspector = "Field Engineer",
        ),
        scope = ScopeFormState(
            referenceMode = ReferenceMode.TANK_NORTH,
            referenceRemark = "Stairway centerline used as 0° start",
            rotationDirection = RotationDirection.CLOCKWISE,
            selectedTasks = defaultFieldTasks(),
        ),
        shellLineCountOverride = "",
        shellUtRows = listOf(
            ShellUtRow("shell-ut-001", "line-01", 1, listOf(6.31, 6.28, 6.25, 6.30, 6.27), note = "North line base course"),
            ShellUtRow("shell-ut-002", "line-01", 2, listOf(6.22, 6.19, 6.17, 6.20, 6.18), note = null),
            ShellUtRow("shell-ut-003", "line-02", 1, listOf(6.14, 6.10, 6.08, 6.11, 6.09), note = "Adjacent to stairway"),
            ShellUtRow("shell-ut-004", "line-03", 4, listOf(5.92, 5.88, 5.90, 5.91, 5.87), note = "Localized thinning check"),
        ),
        savedShellSettlementSurvey = ShellSettlementSurvey(
            stationCount = 8,
            stations = listOf(
                ShellSettlementStation("1", 0.0, 1077.0),
                ShellSettlementStation("2", 45.0, 1046.0),
                ShellSettlementStation("3", 90.0, 1030.0),
                ShellSettlementStation("4", 135.0, 1008.0),
                ShellSettlementStation("5", 180.0, 1001.0),
                ShellSettlementStation("6", 225.0, 1025.0),
                ShellSettlementStation("7", 270.0, 1054.0),
                ShellSettlementStation("8", 315.0, 1078.0),
            ),
        ),
        roofLayoutDraft = RoofLayoutDraftInput(
            template = RoofTemplate.UMBRELLA_RADIAL,
            ringCount = "3",
            sectorCount = "8",
        ),
        roofFeatures = emptyList(),
        roofUtRows = listOf(
            RoofUtRow("roof-ut-001", "1", listOf(5.12, 5.10, 5.08, 5.11, 5.09), note = null),
            RoofUtRow("roof-ut-002", "11", listOf(4.96, 4.94, 4.91, 4.93, 4.92), note = "Near manhole"),
            RoofUtRow("roof-ut-003", "22", listOf(4.85, 4.83, 4.81, 4.82, 4.80), note = "Outer plate check"),
        ),
        shellNozzles = listOf(
            NozzleDefinition(
                nozzleId = "SN-001",
                surface = "shell",
                size = "8",
                placementMode = "line_linked",
                course = 2,
                azimuthDeg = 90.0,
            ),
            NozzleDefinition(
                nozzleId = "SN-002",
                surface = "shell",
                size = "12",
                placementMode = "line_linked",
                course = 4,
                azimuthDeg = 185.0,
            ),
        ),
        shellNozzleUtRows = listOf(
            NozzleUtRow(
                rowId = "shell-nozzle-ut-001",
                nozzleId = "SN-001",
                bodyReadings = listOf(6.02, 6.01, 5.98, 5.99),
                reinforcementPadReading = 6.00,
                note = "Shell nozzle check",
            ),
        ),
        roofNozzles = listOf(
            NozzleDefinition(
                nozzleId = "RN-001",
                surface = "roof",
                size = "6",
                placementMode = "plate_linked",
                plateId = "10",
            ),
            NozzleDefinition(
                nozzleId = "RN-002",
                surface = "roof",
                size = "4",
                placementMode = "plate_linked",
                plateId = "22",
            ),
        ),
        roofNozzleUtRows = listOf(
            NozzleUtRow(
                rowId = "roof-nozzle-ut-001",
                nozzleId = "RN-001",
                bodyReadings = listOf(4.75, 4.74, 4.72, 4.73),
                reinforcementPadReading = 4.71,
                note = "Roof nozzle pad",
            ),
        ),
        findings = listOf(
            FindingRecord(
                findingId = "finding-001",
                surface = "shell",
                type = "corrosion",
                severity = "medium",
                note = "Localized thinning on shell line 03.",
                linkedMeasurementId = "shell-ut-004",
                locationSummary = "line-03 · Strake 4 | x=42%",
            ),
            FindingRecord(
                findingId = "finding-002",
                surface = "roof",
                type = "coating_failure",
                severity = "low",
                note = "Coating degradation near roof manhole.",
                linkedMeasurementId = "roof-ut-002",
                locationSummary = "Plate 11",
            ),
        ),
    )
        .let { state ->
            state.copy(
                savedReferenceBaselineKey = state.currentFundamentalBaselineKey(),
                savedSetupBaseline = state.setup,
                savedScopeBaseline = state.scope,
                savedShellLineCountOverride = state.shellLineCountOverride,
                savedShellPlanKey = state.currentShellPlanKey(),
                savedRoofLayoutDraft = state.roofLayoutDraft,
            )
        }

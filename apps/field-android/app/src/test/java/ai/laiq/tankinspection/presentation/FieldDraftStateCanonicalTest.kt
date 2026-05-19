package ai.laiq.tankinspection.presentation

import ai.laiq.tankinspection.domain.model.ReferenceMode
import ai.laiq.tankinspection.domain.model.RoofFeature
import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.domain.model.RotationDirection
import ai.laiq.tankinspection.domain.model.MeasurementUnit
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FieldDraftStateCanonicalTest {
    @Test
    fun toCanonicalPackage_mapsCurrentDraftIntoRequiredSections() {
        val state = FieldDraftState(
            setup = SetupFormState(
                client = "Petronas",
                site = "Kerteh",
                tankNumber = "TK-13",
                diameterM = "20",
                heightM = "10",
                shellCourseCount = "6",
                fixedRoofType = "cone",
                floatingRoofType = "none",
                inspector = "Field Engineer",
                thicknessUnit = MeasurementUnit.INCH,
                settlementUnit = MeasurementUnit.MM,
            ),
            scope = ScopeFormState(
                referenceMode = ReferenceMode.TRUE_NORTH,
                startReference = StartReference.E,
                rotationDirection = RotationDirection.CLOCKWISE,
                selectedTasks = linkedSetOf(
                    FieldTask.SHELL_UT,
                    FieldTask.ROOF_UT,
                    FieldTask.MFL_IMPORT,
                    FieldTask.REVIEW_EXPORT,
                ),
            ),
            shellLineCountOverride = "7",
            savedShellPlanKey = "TRUE_NORTH|True North|CLOCKWISE|7|6",
            shellUtRows = listOf(
                ai.laiq.tankinspection.domain.model.ShellUtRow(
                    rowId = "shell-ut-001",
                    lineId = "line-01",
                    course = 1,
                    readings = listOf(6.31, 6.28, 6.25, 6.30, 6.27),
                    note = null,
                ),
            ),
            fixedRoofLayoutDraft = RoofLayoutDraftInput(
                template = RoofTemplate.CIRCULAR_PLATE,
                rowCount = "6",
                widestRowPlateCount = "7",
            ),
            savedFixedRoofLayoutDraft = RoofLayoutDraftInput(
                template = RoofTemplate.CIRCULAR_PLATE,
                rowCount = "6",
                widestRowPlateCount = "7",
            ),
            roofUtRows = listOf(
                ai.laiq.tankinspection.domain.model.RoofUtRow(
                    rowId = "roof-ut-001",
                    roofSurfaceId = ROOF_SURFACE_FIXED,
                    plateId = "R2-P3",
                    readings = listOf(5.1, 5.0, 4.98, 5.02, 5.04),
                    note = "Near manhole",
                ),
            ),
            mflImportDraft = MflImportDraftInput(
                contractor = "Vendor A",
                reportReference = "MFL-2026-001",
                reportDate = "2026-05-12",
                severity = "medium",
                pdfRelativePath = "attachments/mfl/mfl-report.pdf",
                pdfCaption = "Third-party MFL report",
                attachmentId = "mfl-report",
            ),
            attachments = listOf(
                ai.laiq.tankinspection.domain.model.AttachmentRecord(
                    attachmentId = "mfl-report",
                    kind = "mfl_report",
                    relativePath = "attachments/mfl/mfl-report.pdf",
                    caption = "Third-party MFL report",
                ),
            ),
        )

        val pkg = state.toCanonicalPackage()

        assertEquals("0.1.0", pkg.schemaVersion)
        assertEquals("Petronas", pkg.inspection.client)
        assertEquals("TK-13", pkg.inspection.tankNumber)
        assertEquals("internal_external", pkg.inspection.inspectionType)
        assertEquals("android-field-prototype", pkg.inspection.deviceId)
        assertEquals(20.0, pkg.tankMaster.diameterM, 0.0)
        assertEquals("True North", pkg.shellLinePlan.startReference)
        assertEquals(7, pkg.shellLinePlan.lineCount)
        assertEquals(MeasurementUnit.MM, pkg.unitProfile.settlementUnit)
        assertEquals(1, pkg.measurements.shellUtRows.size)
        assertEquals(1, pkg.measurements.roofUtRows.size)
        assertNotNull(pkg.mflImport)
        assertEquals("mfl-report", pkg.mflImport?.attachmentId)
        assertTrue(pkg.reviewStatus.warnings.isEmpty())
    }

    @Test
    fun reviewWarnings_flagMissingMflAttachmentForSelectedTask() {
        val state = FieldDraftState(
            setup = SetupFormState(
                client = "Petronas",
                site = "Kerteh",
                tankNumber = "TK-13",
                diameterM = "20",
                heightM = "10",
                shellCourseCount = "6",
            ),
            scope = ScopeFormState(
                selectedTasks = linkedSetOf(
                    FieldTask.SHELL_UT,
                    FieldTask.ROOF_UT,
                    FieldTask.MFL_IMPORT,
                    FieldTask.REVIEW_EXPORT,
                ),
            ),
        )

        val warnings = state.reviewWarnings()

        assertTrue(warnings.any { it.contains("third-party MFL PDF", ignoreCase = true) })
    }

    @Test
    fun validationErrors_requireMarkerRemarkWhenUsingTankMarkerReference() {
        val state = FieldDraftState(
            setup = SetupFormState(
                client = "Petronas",
                site = "Kerteh",
                tankNumber = "TK-13",
                diameterM = "20",
                heightM = "10",
                shellCourseCount = "6",
            ),
            scope = ScopeFormState(
                referenceMode = ReferenceMode.TANK_NORTH,
                referenceRemark = "",
                selectedTasks = linkedSetOf(FieldTask.SHELL_UT),
            ),
        )

        assertTrue(state.validationErrors().any { it.contains("marker", ignoreCase = true) })
    }

    @Test
    fun saveRoofLayoutDraft_clearsDependentRoofDataWhenLayoutChanges() {
        val state = FieldDraftState(
            setup = SetupFormState(
                fixedRoofType = "dome",
            ),
            fixedRoofLayoutDraft = RoofLayoutDraftInput(
                template = RoofTemplate.CIRCULAR_PLATE,
                rowCount = "7",
                widestRowPlateCount = "8",
            ),
            savedFixedRoofLayoutDraft = RoofLayoutDraftInput(
                template = RoofTemplate.CIRCULAR_PLATE,
                rowCount = "6",
                widestRowPlateCount = "8",
            ),
            roofFeatures = listOf(
                RoofFeature(
                    featureId = "roof-feature-001",
                    roofSurfaceId = ROOF_SURFACE_FIXED,
                    type = "manhole",
                    label = "MH1",
                    placementMode = "plate_linked",
                    plateId = "P-01",
                ),
            ),
            roofUtRows = listOf(
                ai.laiq.tankinspection.domain.model.RoofUtRow(
                    rowId = "roof-ut-001",
                    roofSurfaceId = ROOF_SURFACE_FIXED,
                    plateId = "P-01",
                    readings = listOf(5.0),
                    note = null,
                ),
            ),
            roofNozzles = listOf(
                ai.laiq.tankinspection.domain.model.NozzleDefinition(
                    nozzleId = "RN-001",
                    surface = "roof",
                    roofSurfaceId = ROOF_SURFACE_FIXED,
                    size = "6",
                    placementMode = "plate_linked",
                    plateId = "P-02",
                ),
            ),
            roofNozzleUtRows = listOf(
                ai.laiq.tankinspection.domain.model.NozzleUtRow(
                    rowId = "roof-nozzle-ut-001",
                    nozzleId = "RN-001",
                    roofSurfaceId = ROOF_SURFACE_FIXED,
                    bodyReadings = listOf(4.8),
                    note = null,
                ),
            ),
            findings = listOf(
                ai.laiq.tankinspection.domain.model.FindingRecord(
                    findingId = "finding-001",
                    surface = roofFindingSurface(ROOF_SURFACE_FIXED),
                    type = "corrosion",
                    severity = "medium",
                    note = "Roof issue",
                    linkedMeasurementId = "roof-ut-001",
                ),
            ),
        )

        val updated = state.saveRoofLayoutDraft()

        assertEquals("7", updated.savedFixedRoofLayoutDraft?.rowCount)
        assertTrue(updated.roofFeatures.isEmpty())
        assertTrue(updated.roofUtRows.isEmpty())
        assertTrue(updated.roofNozzles.isEmpty())
        assertTrue(updated.roofNozzleUtRows.isEmpty())
        assertTrue(updated.findings.isEmpty())
    }

    @Test
    fun commitShellPlanningInputs_clearsDependentShellDataWhenPlanChanges() {
        val baseState = FieldDraftState(
            setup = SetupFormState(
                diameterM = "20",
                heightM = "10",
                shellCourseCount = "6",
            ),
            scope = ScopeFormState(
                referenceMode = ReferenceMode.TRUE_NORTH,
                startReference = StartReference.N,
                rotationDirection = RotationDirection.CLOCKWISE,
                selectedTasks = linkedSetOf(FieldTask.SHELL_UT, FieldTask.SHELL_NOZZLE_UT),
            ),
            shellUtRows = listOf(
                ai.laiq.tankinspection.domain.model.ShellUtRow(
                    rowId = "shell-ut-001",
                    lineId = "line-01",
                    course = 1,
                    readings = listOf(6.1),
                    note = null,
                ),
            ),
            shellNozzles = listOf(
                ai.laiq.tankinspection.domain.model.NozzleDefinition(
                    nozzleId = "SN-001",
                    surface = "shell",
                    size = "8",
                    placementMode = "line_linked",
                    course = 2,
                    azimuthDeg = 90.0,
                ),
            ),
            shellNozzleUtRows = listOf(
                ai.laiq.tankinspection.domain.model.NozzleUtRow(
                    rowId = "shell-nozzle-ut-001",
                    nozzleId = "SN-001",
                    bodyReadings = listOf(6.0),
                    note = null,
                ),
            ),
            roofUtRows = listOf(
                ai.laiq.tankinspection.domain.model.RoofUtRow(
                    rowId = "roof-ut-001",
                    plateId = "P-01",
                    readings = listOf(4.9),
                    note = null,
                ),
            ),
            findings = listOf(
                ai.laiq.tankinspection.domain.model.FindingRecord(
                    findingId = "finding-001",
                    surface = "shell",
                    type = "corrosion",
                    severity = "medium",
                    note = "Shell issue",
                    linkedMeasurementId = "shell-ut-001",
                ),
            ),
        ).copy(savedShellPlanKey = null).commitShellPlanningInputs()

        val updated = baseState.copy(shellLineCountOverride = "8").commitShellPlanningInputs()

        assertTrue(updated.shellUtRows.isEmpty())
        assertTrue(updated.shellNozzles.isEmpty())
        assertTrue(updated.shellNozzleUtRows.isEmpty())
        assertTrue(updated.findings.isEmpty())
        assertEquals(1, updated.roofUtRows.size)
        assertTrue(updated.savedShellPlanKey?.contains("|8|6") == true)
    }

    @Test
    fun commitScopeInputs_clearsAllDownstreamWhenReferenceBaselineChanges() {
        val baseState = FieldDraftState(
            setup = SetupFormState(
                diameterM = "20",
                heightM = "10",
                shellCourseCount = "6",
            ),
            scope = ScopeFormState(
                referenceMode = ReferenceMode.TRUE_NORTH,
                startReference = StartReference.N,
                rotationDirection = RotationDirection.CLOCKWISE,
                selectedTasks = linkedSetOf(
                    FieldTask.SHELL_UT,
                    FieldTask.ROOF_UT,
                    FieldTask.SHELL_NOZZLE_UT,
                    FieldTask.ROOF_NOZZLE_UT,
                ),
            ),
            savedReferenceBaselineKey = "20|10|6|cone|none|TRUE_NORTH|North|CLOCKWISE|MM|MM|INCH",
            activeRoofSurfaceId = ROOF_SURFACE_FIXED,
            savedShellPlanKey = "TRUE_NORTH|North|CLOCKWISE|7|6",
            shellUtRows = listOf(
                ai.laiq.tankinspection.domain.model.ShellUtRow(
                    rowId = "shell-ut-001",
                    lineId = "line-01",
                    course = 1,
                    readings = listOf(6.1),
                    note = null,
                ),
            ),
            fixedRoofLayoutDraft = RoofLayoutDraftInput(
                template = RoofTemplate.CIRCULAR_PLATE,
                rowCount = "6",
                widestRowPlateCount = "7",
            ),
            savedFixedRoofLayoutDraft = RoofLayoutDraftInput(
                template = RoofTemplate.CIRCULAR_PLATE,
                rowCount = "6",
                widestRowPlateCount = "7",
            ),
            roofFeatures = listOf(
                RoofFeature(
                    featureId = "roof-feature-001",
                    roofSurfaceId = ROOF_SURFACE_FIXED,
                    type = "manhole",
                    label = "MH1",
                    placementMode = "plate_linked",
                    plateId = "1",
                ),
            ),
            roofUtRows = listOf(
                ai.laiq.tankinspection.domain.model.RoofUtRow(
                    rowId = "roof-ut-001",
                    roofSurfaceId = ROOF_SURFACE_FIXED,
                    plateId = "1",
                    readings = listOf(4.9),
                    note = null,
                ),
            ),
            shellNozzles = listOf(
                ai.laiq.tankinspection.domain.model.NozzleDefinition(
                    nozzleId = "SN-001",
                    surface = "shell",
                    size = "8",
                    placementMode = "line_linked",
                    course = 2,
                    azimuthDeg = 90.0,
                ),
            ),
            shellNozzleUtRows = listOf(
                ai.laiq.tankinspection.domain.model.NozzleUtRow(
                    rowId = "shell-nozzle-ut-001",
                    nozzleId = "SN-001",
                    bodyReadings = listOf(6.0),
                    note = null,
                ),
            ),
            roofNozzles = listOf(
                ai.laiq.tankinspection.domain.model.NozzleDefinition(
                    nozzleId = "RN-001",
                    surface = "roof",
                    roofSurfaceId = ROOF_SURFACE_FIXED,
                    size = "6",
                    placementMode = "plate_linked",
                    plateId = "1",
                ),
            ),
            roofNozzleUtRows = listOf(
                ai.laiq.tankinspection.domain.model.NozzleUtRow(
                    rowId = "roof-nozzle-ut-001",
                    nozzleId = "RN-001",
                    roofSurfaceId = ROOF_SURFACE_FIXED,
                    bodyReadings = listOf(4.8),
                    note = null,
                ),
            ),
            findings = listOf(
                ai.laiq.tankinspection.domain.model.FindingRecord(
                    findingId = "finding-001",
                    surface = roofFindingSurface(ROOF_SURFACE_FIXED),
                    type = "corrosion",
                    severity = "medium",
                    note = "Roof issue",
                    linkedMeasurementId = "roof-ut-001",
                ),
            ),
        )

        val updated = baseState.copy(
            setup = baseState.setup.copy(fixedRoofType = "umbrella"),
            scope = baseState.scope.copy(
                referenceMode = ReferenceMode.TANK_NORTH,
                referenceRemark = "Stairway centerline",
            ),
        ).commitScopeInputs()

        assertTrue(updated.shellUtRows.isEmpty())
        assertTrue(updated.shellNozzles.isEmpty())
        assertTrue(updated.shellNozzleUtRows.isEmpty())
        assertTrue(updated.roofFeatures.isEmpty())
        assertTrue(updated.roofUtRows.isEmpty())
        assertTrue(updated.roofNozzles.isEmpty())
        assertTrue(updated.roofNozzleUtRows.isEmpty())
        assertTrue(updated.findings.isEmpty())
        assertEquals(RoofTemplate.UMBRELLA_RADIAL, updated.fixedRoofLayoutDraft.template)
        assertEquals(null, updated.savedFixedRoofLayoutDraft)
        assertEquals(
            "20|10|6|umbrella|none|TANK_NORTH|Tank North / Site Marker: Stairway centerline|CLOCKWISE|MM|MM|INCH",
            updated.savedReferenceBaselineKey,
        )
        assertEquals("umbrella", updated.savedSetupBaseline?.fixedRoofType)
        assertEquals("Stairway centerline", updated.savedScopeBaseline?.referenceRemark)
    }
}

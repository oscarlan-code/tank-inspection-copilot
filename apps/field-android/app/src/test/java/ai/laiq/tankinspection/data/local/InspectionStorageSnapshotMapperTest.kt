package ai.laiq.tankinspection.data.local

import ai.laiq.tankinspection.domain.model.AttachmentRecord
import ai.laiq.tankinspection.domain.model.FindingRecord
import ai.laiq.tankinspection.domain.model.NozzleDefinition
import ai.laiq.tankinspection.domain.model.NozzleUtRow
import ai.laiq.tankinspection.domain.model.ReferenceMode
import ai.laiq.tankinspection.domain.model.PlumbnessSurvey
import ai.laiq.tankinspection.domain.model.PlumbnessSurveyStation
import ai.laiq.tankinspection.domain.model.RoundnessSurvey
import ai.laiq.tankinspection.domain.model.RoundnessSurveyBand
import ai.laiq.tankinspection.domain.model.RoundnessSurveyStation
import ai.laiq.tankinspection.domain.model.RoofFeature
import ai.laiq.tankinspection.domain.model.RoofUtRow
import ai.laiq.tankinspection.domain.model.ShellSettlementStation
import ai.laiq.tankinspection.domain.model.ShellSettlementSurvey
import ai.laiq.tankinspection.domain.model.ShellUtRow
import ai.laiq.tankinspection.data.local.db.InspectionBaselineEntity
import ai.laiq.tankinspection.data.local.db.InspectionRecordEntity
import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.FieldTask
import ai.laiq.tankinspection.presentation.currentInspectionId
import ai.laiq.tankinspection.presentation.currentPackageId
import ai.laiq.tankinspection.presentation.isMaterialInspectionDraft
import ai.laiq.tankinspection.presentation.MflImportDraftInput
import ai.laiq.tankinspection.presentation.ROOF_SURFACE_FIXED
import ai.laiq.tankinspection.presentation.ROOF_SURFACE_FLOATING
import ai.laiq.tankinspection.presentation.RoofLayoutDraftInput
import ai.laiq.tankinspection.presentation.ScopeFormState
import ai.laiq.tankinspection.presentation.SetupFormState
import ai.laiq.tankinspection.presentation.localInspectionStorageKey
import ai.laiq.tankinspection.presentation.toCanonicalPackage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.file.Files

class InspectionStorageSnapshotMapperTest {
    @Test
    fun toInspectionTaskSnapshots_tracksNozzleWorkflowAndReviewBlockingState() {
        val state = FieldDraftState(
            setup = SetupFormState(
                client = "PAC",
                site = "Terminal A",
                tankNumber = "TK-13",
                diameterM = "20",
                heightM = "10",
                shellCourseCount = "6",
            ),
            scope = ScopeFormState(
                referenceMode = ReferenceMode.TRUE_NORTH,
                selectedTasks = linkedSetOf(
                    FieldTask.SHELL_NOZZLE_UT,
                    FieldTask.REVIEW_EXPORT,
                ),
            ),
            shellNozzles = listOf(
                NozzleDefinition(
                    nozzleId = "SN-001",
                    surface = "shell",
                    size = "8",
                    course = 1,
                    azimuthDeg = 90.0,
                ),
                NozzleDefinition(
                    nozzleId = "SN-002",
                    surface = "shell",
                    size = "10",
                    course = 2,
                    azimuthDeg = 180.0,
                ),
            ),
            shellNozzleUtRows = listOf(
                NozzleUtRow(
                    rowId = "shell-nozzle-ut-001",
                    nozzleId = "SN-001",
                    bodyReadings = listOf(6.1, 6.0, 5.9),
                ),
            ),
        )

        val snapshots = state.toInspectionTaskSnapshots(
            packagePreview = state.toCanonicalPackage(),
            updatedAtIso = "2026-05-19T00:00:00Z",
        )

        val shellNozzleTask = snapshots.first { it.taskKey == FieldTask.SHELL_NOZZLE_UT.name }
        assertTrue(shellNozzleTask.inScope)
        assertEquals("in_progress", shellNozzleTask.statusCode)
        assertEquals("In progress", shellNozzleTask.statusLabel)
        assertFalse(shellNozzleTask.isComplete)
        assertEquals(1, shellNozzleTask.entryCount)
        assertEquals(2, shellNozzleTask.referenceCount)

        val reviewTask = snapshots.first { it.taskKey == FieldTask.REVIEW_EXPORT.name }
        assertTrue(reviewTask.inScope)
        assertEquals("warnings", reviewTask.statusCode)
        assertEquals("Warnings", reviewTask.statusLabel)
        assertFalse(reviewTask.isComplete)
        assertEquals(0, reviewTask.entryCount)
        assertEquals(1, reviewTask.referenceCount)
    }

    @Test
    fun toInspectionTaskSnapshots_marksTasksOutsideScopeWithoutLosingCounts() {
        val state = FieldDraftState(
            setup = SetupFormState(
                client = "TJS",
                site = "Tank Farm",
                tankNumber = "TK-465",
                diameterM = "30",
                heightM = "15",
                shellCourseCount = "8",
            ),
            scope = ScopeFormState(
                referenceMode = ReferenceMode.TRUE_NORTH,
                selectedTasks = linkedSetOf(FieldTask.SHELL_UT),
            ),
            shellNozzles = listOf(
                NozzleDefinition(
                    nozzleId = "SN-001",
                    surface = "shell",
                    size = "8",
                    course = 1,
                ),
            ),
        )

        val snapshots = state.toInspectionTaskSnapshots(
            packagePreview = state.toCanonicalPackage(),
            updatedAtIso = "2026-05-19T00:00:00Z",
        )

        val shellNozzleTask = snapshots.first { it.taskKey == FieldTask.SHELL_NOZZLE_UT.name }
        assertFalse(shellNozzleTask.inScope)
        assertEquals("out_of_scope", shellNozzleTask.statusCode)
        assertEquals("Out of scope", shellNozzleTask.statusLabel)
        assertFalse(shellNozzleTask.blocksExport)
        assertEquals(0, shellNozzleTask.entryCount)
        assertEquals(1, shellNozzleTask.referenceCount)
    }

    @Test
    fun toInspectionAttachmentEntities_indexesPhotoAndMflFilesWithMetadata() {
        val tempDir = Files.createTempDirectory("attachment-index-test").toFile()
        val photoPath = "inspections/insp-local-TK-13-2026-05-19T00-00-00Z/photos/photo-001.jpg"
        val mflPath = "inspections/insp-local-TK-13-2026-05-19T00-00-00Z/attachments/mfl/report.pdf"
        writeFile(tempDir, photoPath, ByteArray(12) { 1 })
        writeFile(tempDir, mflPath, ByteArray(20) { 2 })

        val state = FieldDraftState(
            startedAtIso = "2026-05-19T00:00:00Z",
            setup = SetupFormState(
                client = "PAC",
                site = "Terminal A",
                tankNumber = "TK-13",
                diameterM = "20",
                heightM = "10",
                shellCourseCount = "6",
            ),
            findings = listOf(
                FindingRecord(
                    findingId = "finding-001",
                    surface = "shell",
                    type = "corrosion",
                    severity = "medium",
                    attachmentIds = listOf("photo-001"),
                ),
            ),
            attachments = listOf(
                AttachmentRecord(
                    attachmentId = "photo-001",
                    kind = "photo",
                    relativePath = photoPath,
                    caption = "Shell corrosion photo",
                ),
                AttachmentRecord(
                    attachmentId = "mfl-report",
                    kind = "mfl_report",
                    relativePath = mflPath,
                    caption = "Imported MFL report",
                ),
            ),
            mflImportDraft = MflImportDraftInput(
                attachmentId = "mfl-report",
                pdfRelativePath = mflPath,
            ),
        )

        val entities = state.toInspectionAttachmentEntities(
            packagePreview = state.toCanonicalPackage(),
            filesDir = tempDir,
            updatedAtIso = "2026-05-19T01:00:00Z",
        )

        val photo = entities.first { it.attachmentId == "photo-001" }
        assertEquals("image/jpeg", photo.mediaType)
        assertTrue(photo.fileExists)
        assertEquals(12L, photo.fileByteSize)
        assertEquals("finding", photo.linkedRecordType)
        assertEquals("finding-001", photo.linkedRecordId)

        val mfl = entities.first { it.attachmentId == "mfl-report" }
        assertEquals("application/pdf", mfl.mediaType)
        assertTrue(mfl.fileExists)
        assertEquals(20L, mfl.fileByteSize)
        assertEquals("mfl_import", mfl.linkedRecordType)
        assertEquals("mfl-report", mfl.linkedRecordId)
    }

    @Test
    fun localInspectionStorageKey_usesStableInspectionScopedFolderName() {
        val state = FieldDraftState(
            startedAtIso = "2026-05-19T10:11:12.123Z",
            setup = SetupFormState(
                tankNumber = "TK 465/A",
            ),
        )

        assertEquals(
            "insp-local-TK_465_A-2026-05-19T10-11-12-123Z",
            state.localInspectionStorageKey(),
        )
    }

    @Test
    fun canonicalIds_areStablePerInspectionInstanceAndIndependentOfTankNumber() {
        val original = FieldDraftState(
            startedAtIso = "2026-05-19T10:11:12.123Z",
            setup = SetupFormState(tankNumber = "TK-1"),
        )
        val renamed = original.copy(setup = original.setup.copy(tankNumber = "TK-999"))

        assertEquals("insp-2026-05-19T10-11-12-123Z", original.currentInspectionId())
        assertEquals("pkg-2026-05-19T10-11-12-123Z", original.currentPackageId())
        assertEquals(original.currentInspectionId(), renamed.currentInspectionId())
        assertEquals(original.currentPackageId(), renamed.currentPackageId())
    }

    @Test
    fun materialInspectionDraft_detectsBlankVersusMeaningfulLocalInspection() {
        assertFalse(FieldDraftState().isMaterialInspectionDraft())
        assertTrue(
            FieldDraftState(
                setup = SetupFormState(tankNumber = "TK-13"),
            ).isMaterialInspectionDraft(),
        )
    }

    @Test
    fun detailStorageMappers_coverBaselineComponentsMeasurementsAndFindings() {
        val state = buildDetailedState()

        val packagePreview = state.toCanonicalPackage()
        val baseline = state.toInspectionBaseline(
            packagePreview = packagePreview,
            updatedAtIso = "2026-05-19T01:00:00Z",
        )
        val components = state.toInspectionComponentEntities(
            packagePreview = packagePreview,
            updatedAtIso = "2026-05-19T01:00:00Z",
        )
        val measurements = state.toInspectionMeasurementEntities(
            packagePreview = packagePreview,
            updatedAtIso = "2026-05-19T01:00:00Z",
        )
        val findings = state.toInspectionFindingEntities(
            packagePreview = packagePreview,
            updatedAtIso = "2026-05-19T01:00:00Z",
        )

        assertEquals("internal_external", baseline.inspectionType)
        assertEquals("SITE_MARKER", baseline.referenceMode)
        assertEquals("Reference leg A", baseline.referenceRemark)
        assertTrue(baseline.selectedTaskKeys.contains(FieldTask.ROOF_UT.name))
        assertTrue(baseline.fixedRoofLayoutReady)
        assertTrue(baseline.floatingRoofLayoutReady)
        assertEquals(ROOF_SURFACE_FIXED, baseline.activeRoofSurfaceId)
        assertEquals(3, baseline.fixedRoofRingCount)
        assertEquals(20, baseline.fixedRoofSectorCount)
        assertEquals(4, baseline.floatingRoofRowCount)
        assertEquals(12, baseline.floatingRoofWidestRowPlateCount)
        assertEquals(1, baseline.fixedRoofFeatureCount)
        assertEquals(1, baseline.floatingRoofFeatureCount)
        assertEquals("mfl-report", baseline.mflAttachmentId)

        assertEquals(4, components.size)
        assertEquals(2, components.count { it.componentKind == "roof_feature" })
        assertEquals(1, components.count { it.componentKind == "shell_nozzle" })
        assertEquals(1, components.count { it.componentKind == "roof_nozzle" })

        assertEquals(7, measurements.size)
        val roofUt = measurements.first { it.moduleKey == "roof_ut" }
        assertEquals("16", roofUt.plateId)
        assertEquals(5.5, roofUt.value1 ?: 0.0, 0.0)

        val shellNozzleUt = measurements.first { it.moduleKey == "shell_nozzle_ut" }
        assertEquals("SN-001", shellNozzleUt.nozzleId)
        assertEquals(5.8, shellNozzleUt.value4 ?: 0.0, 0.0)

        val roundness = measurements.first { it.moduleKey == "roundness" }
        assertEquals("round-001", roundness.groupId)
        assertEquals("Ring 1", roundness.groupLabel)
        assertEquals("1 ft above floor", roundness.heightReference)

        assertEquals(1, findings.size)
        assertEquals("shell-ut-001", findings.first().linkedMeasurementId)
        assertEquals(1, findings.first().attachmentCount)
    }

    @Test
    fun structuredRestore_rebuildsInspectionWithoutDraftJson() {
        val original = buildDetailedState()
        val packagePreview = original.toCanonicalPackage()
        val baseline = original.toInspectionBaseline(packagePreview, "2026-05-19T01:00:00Z")
        val components = original.toInspectionComponentEntities(packagePreview, "2026-05-19T01:00:00Z")
        val measurements = original.toInspectionMeasurementEntities(packagePreview, "2026-05-19T01:00:00Z")
        val findings = original.toInspectionFindingEntities(packagePreview, "2026-05-19T01:00:00Z")
        val tempDir = Files.createTempDirectory("structured-restore-test").toFile()
        original.attachments.forEachIndexed { index, attachment ->
            writeFile(tempDir, attachment.relativePath, ByteArray(index + 5) { 1 })
        }
        val attachmentEntities = original.toInspectionAttachmentEntities(
            packagePreview = packagePreview,
            filesDir = tempDir,
            updatedAtIso = "2026-05-19T01:00:00Z",
        )

        val restored = restoreSavedSessionFromStructuredInspection(
            currentSession = null,
            baseline = baseline,
            components = components,
            measurements = measurements,
            findings = findings,
            attachments = attachmentEntities,
        ).draftState

        assertEquals(original.startedAtIso, restored.startedAtIso)
        assertEquals(original.setup, restored.setup)
        assertEquals(original.scope, restored.scope)
        assertEquals(original.savedReferenceBaselineKey, restored.savedReferenceBaselineKey)
        assertEquals(original.savedShellPlanKey, restored.savedShellPlanKey)
        assertEquals(original.shellUtRows, restored.shellUtRows)
        assertEquals(original.roofUtRows, restored.roofUtRows)
        assertEquals(original.shellNozzles, restored.shellNozzles)
        assertEquals(original.shellNozzleUtRows, restored.shellNozzleUtRows)
        assertEquals(original.roofNozzles, restored.roofNozzles)
        assertEquals(original.roofNozzleUtRows, restored.roofNozzleUtRows)
        assertEquals(original.savedShellSettlementSurvey, restored.savedShellSettlementSurvey)
        assertEquals(original.savedRoundnessSurvey, restored.savedRoundnessSurvey)
        assertEquals(original.savedPlumbnessSurvey, restored.savedPlumbnessSurvey)
        assertEquals(original.savedFixedRoofLayoutDraft, restored.savedFixedRoofLayoutDraft)
        assertEquals(original.savedFloatingRoofLayoutDraft, restored.savedFloatingRoofLayoutDraft)
        assertEquals(original.roofFeatures, restored.roofFeatures)
        assertEquals(original.findings, restored.findings)
        assertEquals(
            original.attachments.sortedBy { it.attachmentId },
            restored.attachments.sortedBy { it.attachmentId },
        )
        assertEquals(original.mflImportDraft.attachmentId, restored.mflImportDraft.attachmentId)
        assertEquals(original.mflImportDraft.contractor, restored.mflImportDraft.contractor)
        assertEquals(original.mflImportDraft.reportReference, restored.mflImportDraft.reportReference)
    }

    @Test
    fun filterRestorableInspectionRecords_keepsOnlyRecordsWithStructuredRestoreReadyBaseline() {
        val readyRecord = inspectionRecord(
            inspectionId = "insp-ready",
            tankNumber = "TK-465",
            client = "TJS",
        )
        val orphanRecord = inspectionRecord(
            inspectionId = "insp-orphan",
            tankNumber = "TK-13",
            client = "PAC",
        )
        val incompleteRecord = inspectionRecord(
            inspectionId = "insp-incomplete",
            tankNumber = "TK-22",
            client = "Legacy",
        )

        val filtered = filterRestorableInspectionRecords(
            records = listOf(readyRecord, orphanRecord, incompleteRecord),
            baselines = listOf(
                inspectionBaseline(inspectionId = "insp-ready"),
                inspectionBaseline(
                    inspectionId = "insp-incomplete",
                    fixedRoofLayoutReady = true,
                    fixedRoofLayoutTemplate = "CONE_RADIAL",
                    fixedRoofRingCount = null,
                    fixedRoofSectorCount = null,
                ),
            ),
        )

        assertEquals(listOf(readyRecord), filtered)
    }

    private fun buildDetailedState(): FieldDraftState =
        FieldDraftState(
            startedAtIso = "2026-05-19T00:00:00Z",
            setup = SetupFormState(
                client = "TJS",
                site = "Jurong",
                tankNumber = "TK-465",
                diameterM = "38.4",
                heightM = "17.8",
                shellCourseCount = "8",
                fixedRoofType = "cone",
                floatingRoofType = "internal",
                inspector = "Oscar",
            ),
            scope = ScopeFormState(
                referenceMode = ReferenceMode.SITE_MARKER,
                referenceRemark = "Reference leg A",
                selectedTasks = linkedSetOf(
                    FieldTask.ROOF_ELEMENTS,
                    FieldTask.SHELL_UT,
                    FieldTask.SHELL_SETTLEMENT,
                    FieldTask.ROUNDNESS_SURVEY,
                    FieldTask.PLUMBNESS_SURVEY,
                    FieldTask.ROOF_UT,
                    FieldTask.SHELL_NOZZLE_UT,
                    FieldTask.ROOF_NOZZLE_UT,
                    FieldTask.MFL_IMPORT,
                    FieldTask.REVIEW_EXPORT,
                ),
            ),
            savedReferenceBaselineKey = "baseline-001",
            savedSetupBaseline = SetupFormState(
                client = "TJS",
                site = "Jurong",
                tankNumber = "TK-465",
                diameterM = "38.4",
                heightM = "17.8",
                shellCourseCount = "8",
                fixedRoofType = "cone",
                floatingRoofType = "internal",
                inspector = "Oscar",
            ),
            savedScopeBaseline = ScopeFormState(
                referenceMode = ReferenceMode.SITE_MARKER,
                referenceRemark = "Reference leg A",
                selectedTasks = linkedSetOf(
                    FieldTask.ROOF_ELEMENTS,
                    FieldTask.SHELL_UT,
                    FieldTask.SHELL_SETTLEMENT,
                    FieldTask.ROUNDNESS_SURVEY,
                    FieldTask.PLUMBNESS_SURVEY,
                    FieldTask.ROOF_UT,
                    FieldTask.SHELL_NOZZLE_UT,
                    FieldTask.ROOF_NOZZLE_UT,
                    FieldTask.MFL_IMPORT,
                    FieldTask.REVIEW_EXPORT,
                ),
            ),
            shellLineCountOverride = "10",
            savedShellLineCountOverride = "10",
            savedShellCaptureStartLaneId = "L1",
            shellCaptureStartLaneId = "L1",
            savedShellPlanKey = "shell-plan-001",
            fixedRoofLayoutDraft = RoofLayoutDraftInput(
                template = ai.laiq.tankinspection.domain.model.RoofTemplate.CONE_RADIAL,
                ringCount = "3",
                sectorCount = "20",
            ),
            savedFixedRoofLayoutDraft = RoofLayoutDraftInput(
                template = ai.laiq.tankinspection.domain.model.RoofTemplate.CONE_RADIAL,
                ringCount = "3",
                sectorCount = "20",
            ),
            floatingRoofLayoutDraft = RoofLayoutDraftInput(
                template = ai.laiq.tankinspection.domain.model.RoofTemplate.CIRCULAR_PLATE,
                rowCount = "4",
                widestRowPlateCount = "12",
                hasPontoonDeck = true,
            ),
            savedFloatingRoofLayoutDraft = RoofLayoutDraftInput(
                template = ai.laiq.tankinspection.domain.model.RoofTemplate.CIRCULAR_PLATE,
                rowCount = "4",
                widestRowPlateCount = "12",
                hasPontoonDeck = true,
            ),
            roofFeatures = listOf(
                RoofFeature(
                    featureId = "feature-001",
                    roofSurfaceId = ROOF_SURFACE_FIXED,
                    type = "manhole",
                    plateId = "5",
                ),
                RoofFeature(
                    featureId = "feature-002",
                    roofSurfaceId = ROOF_SURFACE_FLOATING,
                    type = "drain",
                    azimuthDeg = 45.0,
                    radiusRatio = 0.5,
                ),
            ),
            shellUtRows = listOf(
                ShellUtRow(
                    rowId = "shell-ut-001",
                    lineId = "L1",
                    course = 1,
                    readings = listOf(8.1, 8.0, 7.9, 7.8, 7.7),
                ),
            ),
            roofUtRows = listOf(
                RoofUtRow(
                    rowId = "roof-ut-001",
                    roofSurfaceId = ROOF_SURFACE_FIXED,
                    plateId = "16",
                    readings = listOf(5.5, 5.4, 5.3, 5.2, 5.1),
                ),
            ),
            shellNozzles = listOf(
                NozzleDefinition(
                    nozzleId = "SN-001",
                    surface = "shell",
                    size = "8",
                    course = 2,
                    azimuthDeg = 120.0,
                ),
            ),
            shellNozzleUtRows = listOf(
                NozzleUtRow(
                    rowId = "shell-nozzle-ut-001",
                    nozzleId = "SN-001",
                    bodyReadings = listOf(6.1, 6.0, 5.9),
                    reinforcementPadReading = 5.8,
                ),
            ),
            roofNozzles = listOf(
                NozzleDefinition(
                    nozzleId = "RN-001",
                    surface = "roof",
                    roofSurfaceId = ROOF_SURFACE_FLOATING,
                    size = "6",
                    plateId = "F-03",
                    azimuthDeg = 45.0,
                ),
            ),
            roofNozzleUtRows = listOf(
                NozzleUtRow(
                    rowId = "roof-nozzle-ut-001",
                    nozzleId = "RN-001",
                    roofSurfaceId = ROOF_SURFACE_FLOATING,
                    bodyReadings = listOf(4.9, 4.8, 4.7),
                ),
            ),
            savedShellSettlementSurvey = ShellSettlementSurvey(
                stationCount = 1,
                stations = listOf(
                    ShellSettlementStation(
                        stationId = "1",
                        angleDeg = 0.0,
                        elevation = 1.2,
                    ),
                ),
            ),
            savedRoundnessSurvey = RoundnessSurvey(
                surveys = listOf(
                    RoundnessSurveyBand(
                        surveyId = "round-001",
                        label = "Ring 1",
                        heightReference = "1 ft above floor",
                        stationCount = 1,
                        stations = listOf(
                            RoundnessSurveyStation(
                                stationId = "1",
                                angleDeg = 0.0,
                                easting = 0.1,
                                northing = 0.2,
                            ),
                        ),
                    ),
                ),
            ),
            savedPlumbnessSurvey = PlumbnessSurvey(
                stationCount = 1,
                stations = listOf(
                    PlumbnessSurveyStation(
                        stationId = "1",
                        angleDeg = 0.0,
                        plumbness = 0.3,
                    ),
                ),
            ),
            findings = listOf(
                FindingRecord(
                    findingId = "finding-001",
                    surface = "shell",
                    type = "corrosion",
                    severity = "medium",
                    linkedMeasurementId = "shell-ut-001",
                    locationSummary = "Line L1 · Course 1",
                    preciseLineId = "L1",
                    preciseCourse = 1,
                    attachmentIds = listOf("photo-001"),
                ),
            ),
            attachments = listOf(
                AttachmentRecord(
                    attachmentId = "photo-001",
                    kind = "photo",
                    relativePath = "inspections/insp-local-TK-465-2026-05-19T00-00-00Z/photos/photo-001.jpg",
                ),
                AttachmentRecord(
                    attachmentId = "mfl-report",
                    kind = "mfl_report",
                    relativePath = "inspections/insp-local-TK-465-2026-05-19T00-00-00Z/attachments/mfl/report.pdf",
                ),
            ),
            mflImportDraft = MflImportDraftInput(
                contractor = "ScanMFL",
                reportReference = "MFL-2026-001",
                reportDate = "2026-05-19",
                severity = "medium",
                attachmentId = "mfl-report",
                pdfRelativePath = "inspections/insp-local-TK-465-2026-05-19T00-00-00Z/attachments/mfl/report.pdf",
            ),
        )

    private fun inspectionRecord(
        inspectionId: String,
        tankNumber: String,
        client: String,
    ) = InspectionRecordEntity(
        inspectionId = inspectionId,
        packageId = "pkg-$inspectionId",
        startedAtIso = "2026-05-19T00:00:00Z",
        client = client,
        site = "Site",
        tankNumber = tankNumber,
        inspector = "Inspector",
        roofType = "Fixed Cone",
        referenceMode = ReferenceMode.TRUE_NORTH.name,
        startReference = "N",
        rotationDirection = "CLOCKWISE",
        diameterM = 20.0,
        heightM = 10.0,
        shellCourseCount = 6,
        shellLineCountOverride = null,
        reviewStatus = "ready_for_upload",
        updatedAtIso = "2026-05-19T01:00:00Z",
    )

    private fun inspectionBaseline(
        inspectionId: String,
        fixedRoofLayoutReady: Boolean = false,
        fixedRoofLayoutTemplate: String? = null,
        fixedRoofRingCount: Int? = null,
        fixedRoofSectorCount: Int? = null,
    ) = InspectionBaselineEntity(
        inspectionId = inspectionId,
        packageId = "pkg-$inspectionId",
        startedAtIso = "2026-05-19T00:00:00Z",
        inspectionType = "api653",
        client = "Client",
        site = "Site",
        tankNumber = "Tank",
        inspector = "Inspector",
        diameterM = 20.0,
        heightM = 10.0,
        shellCourseCount = 6,
        roofType = "Fixed Cone",
        fixedRoofType = "cone",
        floatingRoofType = "none",
        thicknessUnit = "MM",
        settlementUnit = "MM",
        nozzleSizeUnit = "INCH",
        referenceMode = ReferenceMode.TRUE_NORTH.name,
        startReferenceCode = "N",
        startReferenceLabel = "North",
        referenceRemark = "",
        rotationDirection = "CLOCKWISE",
        selectedTaskKeys = FieldTask.SHELL_UT.name,
        savedReferenceBaselineKey = null,
        savedShellPlanKey = null,
        shellLineCountOverride = null,
        recommendedShellLineCount = 4,
        resolvedShellLineCount = 4,
        captureStartLaneId = "L1",
        activeRoofSurfaceId = ROOF_SURFACE_FIXED,
        fixedRoofLayoutTemplate = fixedRoofLayoutTemplate,
        fixedRoofLayoutReady = fixedRoofLayoutReady,
        fixedRoofRowCount = null,
        fixedRoofWidestRowPlateCount = null,
        fixedRoofRingCount = fixedRoofRingCount,
        fixedRoofSectorCount = fixedRoofSectorCount,
        fixedRoofCenterOpeningRatio = null,
        fixedRoofHasAnnularRing = false,
        fixedRoofAnnularSectionCount = null,
        fixedRoofHasPontoonDeck = false,
        fixedRoofFeatureCount = 0,
        floatingRoofLayoutTemplate = null,
        floatingRoofLayoutReady = false,
        floatingRoofRowCount = null,
        floatingRoofWidestRowPlateCount = null,
        floatingRoofRingCount = null,
        floatingRoofSectorCount = null,
        floatingRoofCenterOpeningRatio = null,
        floatingRoofHasAnnularRing = false,
        floatingRoofAnnularSectionCount = null,
        floatingRoofHasPontoonDeck = false,
        floatingRoofFeatureCount = 0,
        mflContractor = null,
        mflReportReference = null,
        mflReportDate = null,
        mflSeverity = null,
        mflAttachmentId = null,
        reviewStatus = "READY_FOR_UPLOAD",
        reviewWarningCount = 0,
        updatedAtIso = "2026-05-19T01:00:00Z",
    )

    private fun writeFile(baseDir: java.io.File, relativePath: String, bytes: ByteArray) {
        val file = java.io.File(baseDir, relativePath)
        file.parentFile?.mkdirs()
        file.writeBytes(bytes)
    }
}

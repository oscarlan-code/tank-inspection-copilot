package ai.laiq.tankinspection.data.export

import ai.laiq.tankinspection.domain.model.AttachmentRecord
import ai.laiq.tankinspection.domain.model.CanonicalInspectionPackage
import ai.laiq.tankinspection.domain.model.InspectionMeta
import ai.laiq.tankinspection.domain.model.Measurements
import ai.laiq.tankinspection.domain.model.ReferenceMode
import ai.laiq.tankinspection.domain.model.ReviewState
import ai.laiq.tankinspection.domain.model.ReviewStatus
import ai.laiq.tankinspection.domain.model.RotationDirection
import ai.laiq.tankinspection.domain.model.ShellLine
import ai.laiq.tankinspection.domain.model.ShellLinePlan
import ai.laiq.tankinspection.domain.model.TankMaster
import ai.laiq.tankinspection.domain.model.MeasurementUnit
import ai.laiq.tankinspection.domain.model.NozzleSizeUnit
import ai.laiq.tankinspection.domain.model.UnitProfile
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File

@RunWith(RobolectricTestRunner::class)
class CanonicalPackageExporterTest {
    @get:Rule
    val temporaryFolder = TemporaryFolder()

    @Test
    fun export_writesPackageFilesCopiesAttachmentsAndBuildsZip() = runBlocking {
        val filesDir = temporaryFolder.newFolder("filesDir")
        writeFile(filesDir, "photos/photo-001.jpg", "photo bytes")
        writeFile(filesDir, "attachments/mfl/report.pdf", "mfl bytes")

        val exporter = CanonicalPackageExporter(filesDir)
        val pkg = samplePackage(
            attachments = listOf(
                AttachmentRecord(
                    attachmentId = "photo-001",
                    kind = "photo",
                    relativePath = "photos/photo-001.jpg",
                    caption = "Shell crack close-up",
                ),
                AttachmentRecord(
                    attachmentId = "mfl-001",
                    kind = "mfl_report",
                    relativePath = "attachments/mfl/report.pdf",
                    caption = "Third-party MFL report",
                ),
            ),
        )

        val exported = exporter.export(pkg)

        assertTrue(exported.packageDir.exists())
        assertTrue(File(exported.packageDir, "inspection-package.json").exists())
        assertTrue(File(exported.packageDir, "manifest.json").exists())
        assertTrue(File(exported.packageDir, "README.txt").exists())
        assertTrue(File(exported.packageDir, "photos/photo-001.jpg").exists())
        assertTrue(File(exported.packageDir, "attachments/mfl/report.pdf").exists())
        assertTrue(exported.zipFile.exists())
        assertEquals(2, exported.copiedAttachments.size)
        assertTrue(exported.copiedAttachments.all { it.existsInPackage })
    }

    @Test
    fun export_marksMissingAttachmentWithoutFailing() = runBlocking {
        val filesDir = temporaryFolder.newFolder("filesDir-missing")
        val exporter = CanonicalPackageExporter(filesDir)
        val pkg = samplePackage(
            attachments = listOf(
                AttachmentRecord(
                    attachmentId = "photo-404",
                    kind = "photo",
                    relativePath = "photos/photo-404.jpg",
                    caption = "Missing image",
                ),
            ),
        )

        val exported = exporter.export(pkg)

        assertEquals(1, exported.copiedAttachments.size)
        assertTrue(!exported.copiedAttachments.single().existsInPackage)
        assertTrue(exported.zipFile.exists())
    }

    private fun samplePackage(
        attachments: List<AttachmentRecord>,
    ) = CanonicalInspectionPackage(
        schemaVersion = "0.1.0",
        packageId = "pkg-test-001",
        inspection = InspectionMeta(
            inspectionId = "insp-test-001",
            client = "Petronas",
            site = "Kerteh",
            tankNumber = "TK-13",
            inspectionType = "internal_external",
            startedAt = "2026-05-12T09:00:00Z",
            completedAt = "2026-05-12T12:00:00Z",
            inspector = "Field Engineer",
            deviceId = "android-field-prototype",
        ),
        tankMaster = TankMaster(
            diameterM = 20.0,
            heightM = 10.0,
            roofType = "fixed_cone",
            shellCourseCount = 6,
            referenceMode = ReferenceMode.TANK_NORTH,
            startReference = "N",
        ),
        unitProfile = UnitProfile(
            thicknessUnit = MeasurementUnit.MM,
            settlementUnit = MeasurementUnit.MM,
            nozzleSizeUnit = NozzleSizeUnit.INCH,
        ),
        shellLinePlan = ShellLinePlan(
            lineCount = 4,
            recommendedLineCount = 4,
            startReference = "N",
            rotationDirection = RotationDirection.CLOCKWISE,
            lines = listOf(
                ShellLine("line-01", "N", 0.0),
                ShellLine("line-02", "E", 90.0),
            ),
        ),
        roofLayout = null,
        nozzleRegistries = null,
        measurements = Measurements(),
        shellSettlementSurvey = null,
        findings = emptyList(),
        attachments = attachments,
        mflImport = null,
        reviewStatus = ReviewStatus(
            status = ReviewState.READY_FOR_UPLOAD,
            warnings = emptyList(),
        ),
    )

    private fun writeFile(root: File, relativePath: String, contents: String) {
        val target = File(root, relativePath)
        target.parentFile?.mkdirs()
        target.writeText(contents)
    }
}

package ai.laiq.tankinspection.data.export

import ai.laiq.tankinspection.domain.model.CanonicalInspectionPackage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class CanonicalPackageExporter(
    private val filesDir: File,
) {
    private val exportDir = File(filesDir, "exports")

    suspend fun export(pkg: CanonicalInspectionPackage): ExportedCanonicalPackage = withContext(Dispatchers.IO) {
        if (!exportDir.exists()) {
            exportDir.mkdirs()
        }

        val packageDir = File(exportDir, pkg.packageId)
        packageDir.deleteRecursively()
        packageDir.mkdirs()

        val copiedAttachments = pkg.attachments.map { attachment ->
            val targetFile = File(packageDir, attachment.relativePath)
            targetFile.parentFile?.mkdirs()

            val sourceFile = File(filesDir, attachment.relativePath)
            val exists = sourceFile.exists()
            if (exists) {
                sourceFile.copyTo(targetFile, overwrite = true)
            }

            ExportedAttachmentStatus(
                attachmentId = attachment.attachmentId,
                kind = attachment.kind,
                relativePath = attachment.relativePath,
                existsInPackage = exists,
            )
        }

        val inspectionPackageFile = File(packageDir, "inspection-package.json")
        inspectionPackageFile.writeText(CanonicalPackageJsonCodec.encode(pkg))

        File(packageDir, "manifest.json").writeText(
            JSONObject().apply {
                put("packageId", pkg.packageId)
                put("schemaVersion", pkg.schemaVersion)
                put("rootDocument", "inspection-package.json")
                put(
                    "attachments",
                    JSONArray(
                        copiedAttachments.map { status ->
                            JSONObject().apply {
                                put("attachmentId", status.attachmentId)
                                put("kind", status.kind)
                                put("relativePath", status.relativePath)
                                put("existsInPackage", status.existsInPackage)
                            }
                        },
                    ),
                )
            }.toString(2),
        )

        File(packageDir, "README.txt").writeText(
            buildString {
                appendLine("LAIQ canonical inspection package")
                appendLine("packageId=${pkg.packageId}")
                appendLine("schemaVersion=${pkg.schemaVersion}")
                appendLine()
                appendLine("Package contents:")
                appendLine("- inspection-package.json")
                appendLine("- manifest.json")
                if (copiedAttachments.isEmpty()) {
                    appendLine("- no attachments")
                } else {
                    copiedAttachments.forEach { attachment ->
                        appendLine("- ${attachment.relativePath} (${attachment.kind}) exists=${attachment.existsInPackage}")
                    }
                }
            },
        )

        val zipFile = File(exportDir, "${pkg.packageId}.zip")
        zipFile.delete()
        zipDirectory(packageDir, zipFile)

        ExportedCanonicalPackage(
            packageDir = packageDir,
            zipFile = zipFile,
            copiedAttachments = copiedAttachments,
        )
    }

    private fun zipDirectory(sourceDir: File, zipFile: File) {
        ZipOutputStream(FileOutputStream(zipFile)).use { zip ->
            sourceDir.walkTopDown()
                .filter { it.isFile }
                .forEach { file ->
                    val entryName = sourceDir.toPath().relativize(file.toPath()).toString()
                    zip.putNextEntry(ZipEntry(entryName))
                    FileInputStream(file).use { input ->
                        input.copyTo(zip)
                    }
                    zip.closeEntry()
                }
        }
    }
}

data class ExportedCanonicalPackage(
    val packageDir: File,
    val zipFile: File,
    val copiedAttachments: List<ExportedAttachmentStatus>,
)

data class ExportedAttachmentStatus(
    val attachmentId: String,
    val kind: String,
    val relativePath: String,
    val existsInPackage: Boolean,
)

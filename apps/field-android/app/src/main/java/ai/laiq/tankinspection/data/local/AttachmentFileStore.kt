package ai.laiq.tankinspection.data.local

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import java.io.File
import java.io.FileOutputStream
import java.time.Instant

class AttachmentFileStore(
    private val filesDir: File,
) {
    fun saveFindingPhoto(
        inspectionStorageKey: String,
        bitmap: Bitmap,
    ): String {
        val fileName = "photo-${Instant.now().toEpochMilli()}.jpg"
        val relativePath = inspectionRelativePath(inspectionStorageKey, "photos/$fileName")
        val outputFile = File(filesDir, relativePath)
        outputFile.parentFile?.mkdirs()
        FileOutputStream(outputFile).use { output ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, 90, output)
        }
        return relativePath
    }

    fun loadBitmap(relativePath: String): Bitmap? {
        if (relativePath.isBlank()) return null
        val file = File(filesDir, relativePath)
        if (!file.exists()) return null
        return BitmapFactory.decodeFile(file.absolutePath)
    }

    fun saveAnnotatedFindingPhoto(
        inspectionStorageKey: String,
        bitmap: Bitmap,
    ): String {
        val fileName = "photo-annotated-${Instant.now().toEpochMilli()}.jpg"
        val relativePath = inspectionRelativePath(inspectionStorageKey, "photos/$fileName")
        val outputFile = File(filesDir, relativePath)
        outputFile.parentFile?.mkdirs()
        FileOutputStream(outputFile).use { output ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, 92, output)
        }
        return relativePath
    }

    fun importMflPdf(
        context: Context,
        inspectionStorageKey: String,
        uri: Uri,
    ): ImportedAttachment {
        val originalName = resolveDisplayName(context, uri)
        val safeName = sanitizeFileName(
            originalName.ifBlank { "mfl-report-${Instant.now().toEpochMilli()}.pdf" },
        ).let { if (it.endsWith(".pdf", ignoreCase = true)) it else "$it.pdf" }
        val relativePath = inspectionRelativePath(inspectionStorageKey, "attachments/mfl/$safeName")
        val outputFile = File(filesDir, relativePath)
        outputFile.parentFile?.mkdirs()

        context.contentResolver.openInputStream(uri)?.use { input ->
            outputFile.outputStream().use { output ->
                input.copyTo(output)
            }
        } ?: error("Unable to open selected PDF")

        return ImportedAttachment(
            relativePath = relativePath,
            displayName = originalName.ifBlank { safeName },
        )
    }

    private fun resolveDisplayName(context: Context, uri: Uri): String {
        val projection = arrayOf(OpenableColumns.DISPLAY_NAME)
        context.contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (nameIndex >= 0 && cursor.moveToFirst()) {
                return cursor.getString(nameIndex).orEmpty()
            }
        }
        return uri.lastPathSegment.orEmpty()
    }

    private fun sanitizeFileName(value: String): String =
        value.replace(Regex("[^A-Za-z0-9._-]"), "_")

    private fun inspectionRelativePath(
        inspectionStorageKey: String,
        childPath: String,
    ): String = "inspections/${sanitizeFileName(inspectionStorageKey)}/$childPath"
}

data class ImportedAttachment(
    val relativePath: String,
    val displayName: String,
)

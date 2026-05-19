package ai.laiq.tankinspection.data.export

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.DataOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

class ReportPlatformUploader {
    suspend fun uploadZip(
        endpointUrl: String,
        zipFile: File,
        packageId: String,
        schemaVersion: String,
    ): UploadZipResult = withContext(Dispatchers.IO) {
        if (endpointUrl.isBlank()) {
            return@withContext UploadZipResult(
                success = false,
                responseCode = null,
                responseBody = "Upload endpoint is blank.",
            )
        }
        if (!zipFile.exists()) {
            return@withContext UploadZipResult(
                success = false,
                responseCode = null,
                responseBody = "ZIP file not found: ${zipFile.absolutePath}",
            )
        }

        val boundary = "----LaiqFieldBoundary${System.currentTimeMillis()}"
        val connection = (URL(endpointUrl).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doInput = true
            doOutput = true
            useCaches = false
            setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            setRequestProperty("Accept", "application/json, text/plain, */*")
        }

        runCatching {
            DataOutputStream(connection.outputStream).use { output ->
                output.writeMultipartTextPart(boundary, "packageId", packageId)
                output.writeMultipartTextPart(boundary, "schemaVersion", schemaVersion)
                output.writeMultipartFilePart(boundary, "bundle", zipFile)
                output.writeBytes("--$boundary--\r\n")
                output.flush()
            }

            val responseCode = connection.responseCode
            val responseBody = buildString {
                val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
                if (stream != null) {
                    append(stream.bufferedReader().use { it.readText() })
                }
            }.ifBlank { "HTTP $responseCode" }

            UploadZipResult(
                success = responseCode in 200..299,
                responseCode = responseCode,
                responseBody = responseBody,
            )
        }.getOrElse { error ->
            UploadZipResult(
                success = false,
                responseCode = null,
                responseBody = error.message ?: "Upload failed.",
            )
        }.also {
            connection.disconnect()
        }
    }
}

data class UploadZipResult(
    val success: Boolean,
    val responseCode: Int?,
    val responseBody: String,
)

private fun DataOutputStream.writeMultipartTextPart(
    boundary: String,
    fieldName: String,
    value: String,
) {
    writeBytes("--$boundary\r\n")
    writeBytes("Content-Disposition: form-data; name=\"$fieldName\"\r\n")
    writeBytes("\r\n")
    writeBytes(value)
    writeBytes("\r\n")
}

private fun DataOutputStream.writeMultipartFilePart(
    boundary: String,
    fieldName: String,
    file: File,
) {
    writeBytes("--$boundary\r\n")
    writeBytes("Content-Disposition: form-data; name=\"$fieldName\"; filename=\"${file.name}\"\r\n")
    writeBytes("Content-Type: application/zip\r\n")
    writeBytes("\r\n")
    file.inputStream().use { input -> input.copyTo(this) }
    writeBytes("\r\n")
}

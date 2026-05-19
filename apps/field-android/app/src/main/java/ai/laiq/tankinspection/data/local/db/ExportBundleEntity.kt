package ai.laiq.tankinspection.data.local.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "export_bundle")
data class ExportBundleEntity(
    @PrimaryKey
    val exportId: String,
    val inspectionId: String,
    val packageId: String,
    val schemaVersion: String,
    val packageDirPath: String,
    val zipFilePath: String,
    val zipByteSize: Long,
    val zipExists: Boolean,
    val attachmentCount: Int,
    val missingAttachmentCount: Int,
    val status: String,
    val exportedAtIso: String,
    val uploadAttemptCount: Int,
    val lastAttemptedAtIso: String?,
    val uploadedAtIso: String?,
    val lastError: String?,
)

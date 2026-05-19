package ai.laiq.tankinspection.data.local.db

import androidx.room.Entity

@Entity(
    tableName = "inspection_attachment",
    primaryKeys = ["inspectionId", "attachmentId"],
)
data class InspectionAttachmentEntity(
    val inspectionId: String,
    val attachmentId: String,
    val kind: String,
    val relativePath: String,
    val caption: String?,
    val mediaType: String,
    val fileByteSize: Long?,
    val fileExists: Boolean,
    val linkedRecordType: String?,
    val linkedRecordId: String?,
    val updatedAtIso: String,
)

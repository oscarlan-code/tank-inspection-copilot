package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Entity

@Entity(
    tableName = "v3_attachment",
    primaryKeys = ["inspectionId", "attachmentId"],
)
data class ProductAttachmentEntity(
    val inspectionId: String,
    val attachmentId: String,
    val findingId: String,
    val kind: String,
    val relativePath: String,
    val displayName: String,
    val mediaType: String,
    val fileByteSize: Long?,
    val fileExists: Boolean,
    val annotationStrokeCount: Int,
    val annotationPointCount: Int,
    val updatedAtIso: String,
)

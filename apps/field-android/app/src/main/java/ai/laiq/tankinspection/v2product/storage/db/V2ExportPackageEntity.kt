package ai.laiq.tankinspection.v2product.storage.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "v2_export_package",
    indices = [
        Index("inspectionId"),
        Index("exportedAtIso"),
    ],
)
data class V2ExportPackageEntity(
    @PrimaryKey
    val exportPackageId: String,
    val inspectionId: String,
    val tenantId: String,
    val workspaceId: String,
    val inspectionReference: String,
    val createdByUserId: String,
    val lastEditedByUserId: String,
    val exportedByUserId: String,
    val deviceId: String,
    val schemaVersion: Int,
    val validationStatusCode: String,
    val validationStatusLabel: String,
    val fileRelativePath: String,
    val fileByteSize: Long?,
    val attachmentCount: Int,
    val findingCount: Int,
    val exportedAtIso: String,
    val createdAtIso: String,
    val updatedAtIso: String,
)

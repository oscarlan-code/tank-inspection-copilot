package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Entity
import androidx.room.Index

@Entity(
    tableName = "v3_export_validation_result",
    primaryKeys = ["inspectionId", "ruleCode"],
    indices = [
        Index("inspectionId"),
        Index("updatedAtIso"),
    ],
)
data class ProductExportValidationResultEntity(
    val inspectionId: String,
    val tenantId: String,
    val workspaceId: String,
    val inspectionReference: String,
    val createdByUserId: String,
    val lastEditedByUserId: String,
    val deviceId: String,
    val ruleCode: String,
    val ruleLabel: String,
    val passed: Boolean,
    val blocksExport: Boolean,
    val message: String,
    val createdAtIso: String,
    val updatedAtIso: String,
)

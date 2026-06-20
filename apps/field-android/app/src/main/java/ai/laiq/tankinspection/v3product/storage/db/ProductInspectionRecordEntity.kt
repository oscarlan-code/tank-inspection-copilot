package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "v3_inspection_record")
data class ProductInspectionRecordEntity(
    @PrimaryKey
    val inspectionId: String,
    val tenantId: String,
    val workspaceId: String,
    val inspectionReference: String,
    val createdByUserId: String,
    val lastEditedByUserId: String,
    val deviceId: String,
    val schemaVersion: Int,
    val client: String,
    val tankNumber: String,
    val location: String,
    val fieldLeaseName: String,
    val inspector: String,
    val externalRoofType: String,
    val internalRoofType: String,
    val referenceMode: String,
    val referenceNote: String,
    val diameterM: Double?,
    val heightM: Double?,
    val shellCourseCount: Int?,
    val shellLaneCount: Int?,
    val reviewStatus: String,
    val createdAtIso: String,
    val updatedAtIso: String,
)

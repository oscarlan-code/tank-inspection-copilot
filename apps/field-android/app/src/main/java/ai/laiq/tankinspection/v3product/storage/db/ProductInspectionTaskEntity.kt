package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "v3_inspection_task",
    indices = [
        Index("lifecycleState"),
        Index("workspaceId"),
        Index("updatedAtIso"),
    ],
)
data class ProductInspectionTaskEntity(
    @PrimaryKey
    val inspectionId: String,
    val inspectionReference: String,
    val tenantId: String,
    val workspaceId: String,
    val createdByUserId: String,
    val lastEditedByUserId: String,
    val deviceId: String,
    val client: String,
    val tankNumber: String,
    val location: String,
    val lifecycleState: String,
    val currentScreenKey: String,
    val currentScreenLabel: String,
    val readinessStatusCode: String,
    val readinessStatusLabel: String,
    val exportStatusCode: String,
    val exportStatusLabel: String,
    val archivedAtIso: String?,
    val exportedAtIso: String?,
    val createdAtIso: String,
    val updatedAtIso: String,
)

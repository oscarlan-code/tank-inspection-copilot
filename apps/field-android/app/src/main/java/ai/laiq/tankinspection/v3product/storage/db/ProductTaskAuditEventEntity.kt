package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "v3_task_audit_event",
    indices = [
        Index("inspectionId"),
        Index("createdAtIso"),
    ],
)
data class ProductTaskAuditEventEntity(
    @PrimaryKey
    val auditEventId: String,
    val inspectionId: String,
    val tenantId: String,
    val workspaceId: String,
    val inspectionReference: String,
    val actorUserId: String,
    val eventCode: String,
    val eventLabel: String,
    val note: String?,
    val createdAtIso: String,
)

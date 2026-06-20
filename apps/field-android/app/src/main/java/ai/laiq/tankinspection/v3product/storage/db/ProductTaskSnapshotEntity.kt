package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Entity

@Entity(
    tableName = "v3_task_snapshot",
    primaryKeys = ["inspectionId", "taskKey"],
)
data class ProductTaskSnapshotEntity(
    val inspectionId: String,
    val taskKey: String,
    val taskTitle: String,
    val taskOrder: Int,
    val inScope: Boolean,
    val statusCode: String,
    val statusLabel: String,
    val isComplete: Boolean,
    val blocksExport: Boolean,
    val entryCount: Int,
    val referenceCount: Int,
    val updatedAtIso: String,
)

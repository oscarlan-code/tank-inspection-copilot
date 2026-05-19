package ai.laiq.tankinspection.data.local.db

import androidx.room.Entity

@Entity(
    tableName = "inspection_task_snapshot",
    primaryKeys = ["inspectionId", "taskKey"],
)
data class InspectionTaskSnapshotEntity(
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

package ai.laiq.tankinspection.v2product.storage.db

import androidx.room.Entity

@Entity(
    tableName = "v2_layout_target",
    primaryKeys = ["inspectionId", "targetKey"],
)
data class V2LayoutTargetEntity(
    val inspectionId: String,
    val targetKey: String,
    val targetLabel: String,
    val surfaceKey: String,
    val inLayoutScope: Boolean,
    val layoutApproved: Boolean,
    val elementInScope: Boolean,
    val elementApproved: Boolean,
    val utInScope: Boolean,
    val utApproved: Boolean,
    val updatedAtIso: String,
)

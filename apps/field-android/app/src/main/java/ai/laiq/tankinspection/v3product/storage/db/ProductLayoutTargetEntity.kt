package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Entity

@Entity(
    tableName = "v3_layout_target",
    primaryKeys = ["inspectionId", "targetKey"],
)
data class ProductLayoutTargetEntity(
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

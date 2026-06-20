package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Entity

@Entity(
    tableName = "v3_element",
    primaryKeys = ["inspectionId", "targetKey", "elementId"],
)
data class ProductElementEntity(
    val inspectionId: String,
    val targetKey: String,
    val elementId: String,
    val elementLabel: String,
    val elementTypeKey: String,
    val normalizedX: Float,
    val normalizedY: Float,
    val updatedAtIso: String,
)

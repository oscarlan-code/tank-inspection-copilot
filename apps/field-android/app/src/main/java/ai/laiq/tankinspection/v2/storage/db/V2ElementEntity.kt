package ai.laiq.tankinspection.v2.storage.db

import androidx.room.Entity

@Entity(
    tableName = "v2_element",
    primaryKeys = ["inspectionId", "targetKey", "elementId"],
)
data class V2ElementEntity(
    val inspectionId: String,
    val targetKey: String,
    val elementId: String,
    val elementLabel: String,
    val elementTypeKey: String,
    val normalizedX: Float,
    val normalizedY: Float,
    val updatedAtIso: String,
)

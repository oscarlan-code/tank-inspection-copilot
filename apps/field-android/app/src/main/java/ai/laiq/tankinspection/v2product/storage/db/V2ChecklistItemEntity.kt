package ai.laiq.tankinspection.v2product.storage.db

import androidx.room.Entity

@Entity(
    tableName = "v2_checklist_item",
    primaryKeys = ["inspectionId", "itemNumber"],
)
data class V2ChecklistItemEntity(
    val inspectionId: String,
    val sectionKey: String,
    val sectionTitle: String,
    val itemNumber: Int,
    val itemPrompt: String,
    val ratingKey: String,
    val ratingLabel: String,
    val updatedAtIso: String,
)

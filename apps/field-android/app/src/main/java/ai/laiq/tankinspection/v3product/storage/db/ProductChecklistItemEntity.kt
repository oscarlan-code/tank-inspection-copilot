package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Entity

@Entity(
    tableName = "v3_checklist_item",
    primaryKeys = ["inspectionId", "itemNumber"],
)
data class ProductChecklistItemEntity(
    val inspectionId: String,
    val sectionKey: String,
    val sectionTitle: String,
    val itemNumber: Int,
    val itemPrompt: String,
    val ratingKey: String,
    val ratingLabel: String,
    val itemNote: String?,
    val updatedAtIso: String,
)

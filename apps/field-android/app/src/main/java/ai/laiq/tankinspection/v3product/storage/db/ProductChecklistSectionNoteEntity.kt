package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Entity

@Entity(
    tableName = "v3_checklist_section_note",
    primaryKeys = ["inspectionId", "sectionKey"],
)
data class ProductChecklistSectionNoteEntity(
    val inspectionId: String,
    val sectionKey: String,
    val sectionTitle: String,
    val note: String,
    val updatedAtIso: String,
)

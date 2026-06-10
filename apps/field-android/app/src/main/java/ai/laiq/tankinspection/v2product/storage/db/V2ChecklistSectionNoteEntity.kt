package ai.laiq.tankinspection.v2product.storage.db

import androidx.room.Entity

@Entity(
    tableName = "v2_checklist_section_note",
    primaryKeys = ["inspectionId", "sectionKey"],
)
data class V2ChecklistSectionNoteEntity(
    val inspectionId: String,
    val sectionKey: String,
    val sectionTitle: String,
    val note: String,
    val updatedAtIso: String,
)

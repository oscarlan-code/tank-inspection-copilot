package ai.laiq.tankinspection.v2product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface V2ChecklistSectionNoteDao {
    @Query("SELECT * FROM v2_checklist_section_note WHERE inspectionId = :inspectionId ORDER BY sectionKey ASC")
    suspend fun listByInspection(inspectionId: String): List<V2ChecklistSectionNoteEntity>

    @Query("DELETE FROM v2_checklist_section_note WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<V2ChecklistSectionNoteEntity>)
}

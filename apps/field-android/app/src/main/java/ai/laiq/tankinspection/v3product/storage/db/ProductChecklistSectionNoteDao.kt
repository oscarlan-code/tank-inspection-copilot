package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ProductChecklistSectionNoteDao {
    @Query("SELECT * FROM v3_checklist_section_note WHERE inspectionId = :inspectionId ORDER BY sectionKey ASC")
    suspend fun listByInspection(inspectionId: String): List<ProductChecklistSectionNoteEntity>

    @Query("DELETE FROM v3_checklist_section_note WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<ProductChecklistSectionNoteEntity>)
}

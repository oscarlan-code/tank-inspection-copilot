package ai.laiq.tankinspection.v2product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface V2ChecklistItemDao {
    @Query("SELECT * FROM v2_checklist_item WHERE inspectionId = :inspectionId ORDER BY itemNumber ASC")
    suspend fun listByInspection(inspectionId: String): List<V2ChecklistItemEntity>

    @Query("DELETE FROM v2_checklist_item WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<V2ChecklistItemEntity>)
}

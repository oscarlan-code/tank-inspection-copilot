package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ProductChecklistItemDao {
    @Query("SELECT * FROM v3_checklist_item WHERE inspectionId = :inspectionId ORDER BY itemNumber ASC")
    suspend fun listByInspection(inspectionId: String): List<ProductChecklistItemEntity>

    @Query("DELETE FROM v3_checklist_item WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<ProductChecklistItemEntity>)
}

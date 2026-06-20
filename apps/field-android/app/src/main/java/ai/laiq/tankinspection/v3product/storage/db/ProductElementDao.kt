package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ProductElementDao {
    @Query("SELECT * FROM v3_element WHERE inspectionId = :inspectionId ORDER BY targetKey ASC, elementLabel ASC")
    suspend fun listByInspection(inspectionId: String): List<ProductElementEntity>

    @Query("DELETE FROM v3_element WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<ProductElementEntity>)
}

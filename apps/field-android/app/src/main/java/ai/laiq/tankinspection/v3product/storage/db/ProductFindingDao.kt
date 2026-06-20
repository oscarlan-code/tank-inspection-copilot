package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ProductFindingDao {
    @Query("SELECT * FROM v3_finding WHERE inspectionId = :inspectionId ORDER BY targetKey ASC, itemLabel ASC")
    suspend fun listByInspection(inspectionId: String): List<ProductFindingEntity>

    @Query("DELETE FROM v3_finding WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<ProductFindingEntity>)
}

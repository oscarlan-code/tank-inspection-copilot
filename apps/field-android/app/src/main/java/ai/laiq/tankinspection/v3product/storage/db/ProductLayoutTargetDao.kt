package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ProductLayoutTargetDao {
    @Query("SELECT * FROM v3_layout_target WHERE inspectionId = :inspectionId ORDER BY targetKey ASC")
    suspend fun listByInspection(inspectionId: String): List<ProductLayoutTargetEntity>

    @Query("DELETE FROM v3_layout_target WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<ProductLayoutTargetEntity>)
}

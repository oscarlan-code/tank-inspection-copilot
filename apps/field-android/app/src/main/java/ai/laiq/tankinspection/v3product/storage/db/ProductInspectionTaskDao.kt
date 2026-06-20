package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ProductInspectionTaskDao {
    @Query(
        """
        SELECT * FROM v3_inspection_task
        ORDER BY CASE WHEN lifecycleState = 'ongoing' THEN 0 ELSE 1 END, updatedAtIso DESC
        """,
    )
    suspend fun listAll(): List<ProductInspectionTaskEntity>

    @Query("SELECT * FROM v3_inspection_task WHERE inspectionId = :inspectionId LIMIT 1")
    suspend fun get(inspectionId: String): ProductInspectionTaskEntity?

    @Query("SELECT COUNT(*) FROM v3_inspection_task")
    suspend fun countAll(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: ProductInspectionTaskEntity)

    @Query("DELETE FROM v3_inspection_task WHERE inspectionId = :inspectionId")
    suspend fun deleteByInspection(inspectionId: String)
}

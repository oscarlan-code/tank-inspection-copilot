package ai.laiq.tankinspection.v2product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface V2InspectionTaskDao {
    @Query(
        """
        SELECT * FROM v2_inspection_task
        ORDER BY CASE WHEN lifecycleState = 'ongoing' THEN 0 ELSE 1 END, updatedAtIso DESC
        """,
    )
    suspend fun listAll(): List<V2InspectionTaskEntity>

    @Query("SELECT * FROM v2_inspection_task WHERE inspectionId = :inspectionId LIMIT 1")
    suspend fun get(inspectionId: String): V2InspectionTaskEntity?

    @Query("SELECT COUNT(*) FROM v2_inspection_task")
    suspend fun countAll(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: V2InspectionTaskEntity)

    @Query("DELETE FROM v2_inspection_task WHERE inspectionId = :inspectionId")
    suspend fun deleteByInspection(inspectionId: String)
}

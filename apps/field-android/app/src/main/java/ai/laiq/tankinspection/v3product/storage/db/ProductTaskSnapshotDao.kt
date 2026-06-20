package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ProductTaskSnapshotDao {
    @Query("SELECT * FROM v3_task_snapshot WHERE inspectionId = :inspectionId ORDER BY taskOrder ASC")
    suspend fun listByInspection(inspectionId: String): List<ProductTaskSnapshotEntity>

    @Query("DELETE FROM v3_task_snapshot WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<ProductTaskSnapshotEntity>)
}

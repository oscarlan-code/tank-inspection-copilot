package ai.laiq.tankinspection.v2.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface V2TaskSnapshotDao {
    @Query("SELECT * FROM v2_task_snapshot WHERE inspectionId = :inspectionId ORDER BY taskOrder ASC")
    suspend fun listByInspection(inspectionId: String): List<V2TaskSnapshotEntity>

    @Query("DELETE FROM v2_task_snapshot WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<V2TaskSnapshotEntity>)
}

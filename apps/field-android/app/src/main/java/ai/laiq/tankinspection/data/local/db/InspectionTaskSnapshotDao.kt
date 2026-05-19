package ai.laiq.tankinspection.data.local.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface InspectionTaskSnapshotDao {
    @Query("SELECT * FROM inspection_task_snapshot WHERE inspectionId = :inspectionId ORDER BY taskOrder ASC")
    suspend fun listByInspection(inspectionId: String): List<InspectionTaskSnapshotEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<InspectionTaskSnapshotEntity>)
}

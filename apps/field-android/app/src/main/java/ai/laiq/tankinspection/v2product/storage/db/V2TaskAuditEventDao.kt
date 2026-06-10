package ai.laiq.tankinspection.v2product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface V2TaskAuditEventDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: V2TaskAuditEventEntity)

    @Query("DELETE FROM v2_task_audit_event WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)
}

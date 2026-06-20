package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ProductTaskAuditEventDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: ProductTaskAuditEventEntity)

    @Query("DELETE FROM v3_task_audit_event WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)
}

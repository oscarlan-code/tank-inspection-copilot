package ai.laiq.tankinspection.data.local.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface InspectionAttachmentDao {
    @Query("SELECT * FROM inspection_attachment WHERE inspectionId = :inspectionId ORDER BY attachmentId ASC")
    suspend fun listByInspection(inspectionId: String): List<InspectionAttachmentEntity>

    @Query("DELETE FROM inspection_attachment WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Query("DELETE FROM inspection_attachment WHERE inspectionId = :inspectionId AND attachmentId NOT IN (:attachmentIds)")
    suspend fun deleteMissingByInspection(inspectionId: String, attachmentIds: List<String>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<InspectionAttachmentEntity>)
}

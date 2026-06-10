package ai.laiq.tankinspection.v2product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface V2AttachmentDao {
    @Query("SELECT * FROM v2_attachment WHERE inspectionId = :inspectionId ORDER BY findingId ASC, attachmentId ASC")
    suspend fun listByInspection(inspectionId: String): List<V2AttachmentEntity>

    @Query("DELETE FROM v2_attachment WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<V2AttachmentEntity>)
}

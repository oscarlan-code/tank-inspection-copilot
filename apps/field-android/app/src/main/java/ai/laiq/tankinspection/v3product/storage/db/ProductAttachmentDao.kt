package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ProductAttachmentDao {
    @Query("SELECT * FROM v3_attachment WHERE inspectionId = :inspectionId ORDER BY findingId ASC, attachmentId ASC")
    suspend fun listByInspection(inspectionId: String): List<ProductAttachmentEntity>

    @Query("DELETE FROM v3_attachment WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<ProductAttachmentEntity>)
}

package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ProductVoiceNoteDao {
    @Query("SELECT * FROM v3_voice_note WHERE inspectionId = :inspectionId ORDER BY capturedAtIso ASC, voiceNoteId ASC")
    suspend fun listByInspection(inspectionId: String): List<ProductVoiceNoteEntity>

    @Query("DELETE FROM v3_voice_note WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<ProductVoiceNoteEntity>)
}

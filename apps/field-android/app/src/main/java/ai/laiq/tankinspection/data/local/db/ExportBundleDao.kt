package ai.laiq.tankinspection.data.local.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ExportBundleDao {
    @Query("SELECT * FROM export_bundle ORDER BY exportedAtIso DESC LIMIT :limit")
    suspend fun listRecent(limit: Int): List<ExportBundleEntity>

    @Query(
        """
        UPDATE export_bundle
        SET status = :status,
            uploadedAtIso = :uploadedAtIso,
            uploadAttemptCount = :uploadAttemptCount,
            lastAttemptedAtIso = :lastAttemptedAtIso,
            lastError = :lastError
        WHERE exportId = :exportId
        """,
    )
    suspend fun updateUploadState(
        exportId: String,
        status: String,
        uploadedAtIso: String?,
        uploadAttemptCount: Int,
        lastAttemptedAtIso: String?,
        lastError: String?,
    )

    @Query("SELECT * FROM export_bundle WHERE exportId = :exportId LIMIT 1")
    suspend fun get(exportId: String): ExportBundleEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: ExportBundleEntity)
}

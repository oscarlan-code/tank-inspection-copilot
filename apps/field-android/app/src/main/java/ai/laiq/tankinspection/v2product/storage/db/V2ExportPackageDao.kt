package ai.laiq.tankinspection.v2product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface V2ExportPackageDao {
    @Query("SELECT * FROM v2_export_package WHERE inspectionId = :inspectionId ORDER BY exportedAtIso DESC")
    suspend fun listByInspection(inspectionId: String): List<V2ExportPackageEntity>

    @Query("SELECT * FROM v2_export_package WHERE inspectionId = :inspectionId ORDER BY exportedAtIso DESC LIMIT 1")
    suspend fun latestByInspection(inspectionId: String): V2ExportPackageEntity?

    @Query("DELETE FROM v2_export_package WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: V2ExportPackageEntity)
}

package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ProductExportPackageDao {
    @Query("SELECT * FROM v3_export_package WHERE inspectionId = :inspectionId ORDER BY exportedAtIso DESC")
    suspend fun listByInspection(inspectionId: String): List<ProductExportPackageEntity>

    @Query("SELECT * FROM v3_export_package WHERE inspectionId = :inspectionId ORDER BY exportedAtIso DESC LIMIT 1")
    suspend fun latestByInspection(inspectionId: String): ProductExportPackageEntity?

    @Query("DELETE FROM v3_export_package WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: ProductExportPackageEntity)
}

package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ProductExportValidationResultDao {
    @Query("SELECT * FROM v3_export_validation_result WHERE inspectionId = :inspectionId ORDER BY ruleCode ASC")
    suspend fun listByInspection(inspectionId: String): List<ProductExportValidationResultEntity>

    @Query("DELETE FROM v3_export_validation_result WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<ProductExportValidationResultEntity>)
}

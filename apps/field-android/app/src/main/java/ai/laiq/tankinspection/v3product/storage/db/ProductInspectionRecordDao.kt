package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ProductInspectionRecordDao {
    @Query("SELECT * FROM v3_inspection_record WHERE inspectionId = :inspectionId")
    suspend fun get(inspectionId: String): ProductInspectionRecordEntity?

    @Query("SELECT * FROM v3_inspection_record ORDER BY updatedAtIso DESC")
    suspend fun listAll(): List<ProductInspectionRecordEntity>

    @Query("DELETE FROM v3_inspection_record WHERE inspectionId = :inspectionId")
    suspend fun deleteByInspection(inspectionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: ProductInspectionRecordEntity)
}

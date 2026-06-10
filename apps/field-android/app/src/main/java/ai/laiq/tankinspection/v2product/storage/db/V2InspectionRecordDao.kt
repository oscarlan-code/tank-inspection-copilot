package ai.laiq.tankinspection.v2product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface V2InspectionRecordDao {
    @Query("SELECT * FROM v2_inspection_record WHERE inspectionId = :inspectionId")
    suspend fun get(inspectionId: String): V2InspectionRecordEntity?

    @Query("SELECT * FROM v2_inspection_record ORDER BY updatedAtIso DESC")
    suspend fun listAll(): List<V2InspectionRecordEntity>

    @Query("DELETE FROM v2_inspection_record WHERE inspectionId = :inspectionId")
    suspend fun deleteByInspection(inspectionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: V2InspectionRecordEntity)
}

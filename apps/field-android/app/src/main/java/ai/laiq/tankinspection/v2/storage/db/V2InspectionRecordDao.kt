package ai.laiq.tankinspection.v2.storage.db

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

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: V2InspectionRecordEntity)
}

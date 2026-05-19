package ai.laiq.tankinspection.data.local.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface InspectionRecordDao {
    @Query("SELECT * FROM inspection_record ORDER BY updatedAtIso DESC")
    suspend fun listAll(): List<InspectionRecordEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: InspectionRecordEntity)
}

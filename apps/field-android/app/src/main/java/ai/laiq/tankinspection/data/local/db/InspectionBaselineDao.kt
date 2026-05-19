package ai.laiq.tankinspection.data.local.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface InspectionBaselineDao {
    @Query("SELECT * FROM inspection_baseline")
    suspend fun listAll(): List<InspectionBaselineEntity>

    @Query("SELECT * FROM inspection_baseline WHERE inspectionId = :inspectionId")
    suspend fun getByInspection(inspectionId: String): InspectionBaselineEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: InspectionBaselineEntity)
}

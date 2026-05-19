package ai.laiq.tankinspection.data.local.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface InspectionFindingDao {
    @Query("SELECT * FROM inspection_finding WHERE inspectionId = :inspectionId ORDER BY sortOrder ASC, findingId ASC")
    suspend fun listByInspection(inspectionId: String): List<InspectionFindingEntity>

    @Query("DELETE FROM inspection_finding WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Query("DELETE FROM inspection_finding WHERE inspectionId = :inspectionId AND findingId NOT IN (:findingIds)")
    suspend fun deleteMissingByInspection(inspectionId: String, findingIds: List<String>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<InspectionFindingEntity>)
}

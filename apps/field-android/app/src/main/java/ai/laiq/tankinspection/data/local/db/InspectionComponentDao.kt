package ai.laiq.tankinspection.data.local.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface InspectionComponentDao {
    @Query("SELECT * FROM inspection_component WHERE inspectionId = :inspectionId ORDER BY sortOrder ASC, componentId ASC")
    suspend fun listByInspection(inspectionId: String): List<InspectionComponentEntity>

    @Query("DELETE FROM inspection_component WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Query("DELETE FROM inspection_component WHERE inspectionId = :inspectionId AND componentId NOT IN (:componentIds)")
    suspend fun deleteMissingByInspection(inspectionId: String, componentIds: List<String>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<InspectionComponentEntity>)
}

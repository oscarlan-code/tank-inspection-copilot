package ai.laiq.tankinspection.data.local.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface InspectionMeasurementDao {
    @Query("SELECT * FROM inspection_measurement WHERE inspectionId = :inspectionId ORDER BY moduleKey ASC, sortOrder ASC, measurementId ASC")
    suspend fun listByInspection(inspectionId: String): List<InspectionMeasurementEntity>

    @Query("SELECT * FROM inspection_measurement WHERE inspectionId = :inspectionId AND moduleKey = :moduleKey ORDER BY sortOrder ASC, measurementId ASC")
    suspend fun listByInspectionAndModule(inspectionId: String, moduleKey: String): List<InspectionMeasurementEntity>

    @Query("DELETE FROM inspection_measurement WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Query("DELETE FROM inspection_measurement WHERE inspectionId = :inspectionId AND measurementId NOT IN (:measurementIds)")
    suspend fun deleteMissingByInspection(inspectionId: String, measurementIds: List<String>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<InspectionMeasurementEntity>)
}

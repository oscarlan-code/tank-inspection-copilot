package ai.laiq.tankinspection.v2product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface V2UtMeasurementDao {
    @Query("SELECT * FROM v2_ut_measurement WHERE inspectionId = :inspectionId ORDER BY targetKey ASC, itemKey ASC")
    suspend fun listByInspection(inspectionId: String): List<V2UtMeasurementEntity>

    @Query("DELETE FROM v2_ut_measurement WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<V2UtMeasurementEntity>)
}

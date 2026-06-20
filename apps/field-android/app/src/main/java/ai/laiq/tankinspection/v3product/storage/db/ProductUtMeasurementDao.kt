package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ProductUtMeasurementDao {
    @Query("SELECT * FROM v3_ut_measurement WHERE inspectionId = :inspectionId ORDER BY targetKey ASC, itemKey ASC")
    suspend fun listByInspection(inspectionId: String): List<ProductUtMeasurementEntity>

    @Query("DELETE FROM v3_ut_measurement WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<ProductUtMeasurementEntity>)
}

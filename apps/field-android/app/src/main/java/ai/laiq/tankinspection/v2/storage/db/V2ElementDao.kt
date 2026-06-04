package ai.laiq.tankinspection.v2.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface V2ElementDao {
    @Query("SELECT * FROM v2_element WHERE inspectionId = :inspectionId ORDER BY targetKey ASC, elementLabel ASC")
    suspend fun listByInspection(inspectionId: String): List<V2ElementEntity>

    @Query("DELETE FROM v2_element WHERE inspectionId = :inspectionId")
    suspend fun deleteAllByInspection(inspectionId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<V2ElementEntity>)
}

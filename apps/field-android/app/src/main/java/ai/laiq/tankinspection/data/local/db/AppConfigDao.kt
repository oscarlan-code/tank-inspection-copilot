package ai.laiq.tankinspection.data.local.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface AppConfigDao {
    @Query("SELECT * FROM app_config WHERE configKey = :configKey LIMIT 1")
    suspend fun get(configKey: String): AppConfigEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: AppConfigEntity)
}

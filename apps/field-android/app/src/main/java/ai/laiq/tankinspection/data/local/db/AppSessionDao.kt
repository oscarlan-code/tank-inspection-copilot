package ai.laiq.tankinspection.data.local.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface AppSessionDao {
    @Query("SELECT * FROM app_session WHERE sessionId = :sessionId LIMIT 1")
    suspend fun get(sessionId: String = AppSessionEntity.DEFAULT_SESSION_ID): AppSessionEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: AppSessionEntity)
}

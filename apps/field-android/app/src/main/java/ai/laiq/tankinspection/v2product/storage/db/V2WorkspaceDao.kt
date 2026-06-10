package ai.laiq.tankinspection.v2product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface V2WorkspaceDao {
    @Query("SELECT * FROM v2_workspace WHERE isDefault = 1 LIMIT 1")
    suspend fun getDefault(): V2WorkspaceEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: V2WorkspaceEntity)
}

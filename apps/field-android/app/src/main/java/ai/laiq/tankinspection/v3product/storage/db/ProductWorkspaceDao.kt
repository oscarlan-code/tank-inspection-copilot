package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ProductWorkspaceDao {
    @Query("SELECT * FROM v3_workspace WHERE isDefault = 1 LIMIT 1")
    suspend fun getDefault(): ProductWorkspaceEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: ProductWorkspaceEntity)
}

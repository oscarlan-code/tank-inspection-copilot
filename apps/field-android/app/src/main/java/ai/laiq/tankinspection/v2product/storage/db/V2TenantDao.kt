package ai.laiq.tankinspection.v2product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface V2TenantDao {
    @Query("SELECT * FROM v2_tenant WHERE isDefault = 1 LIMIT 1")
    suspend fun getDefault(): V2TenantEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: V2TenantEntity)
}

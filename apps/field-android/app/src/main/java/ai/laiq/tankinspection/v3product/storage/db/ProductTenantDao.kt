package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ProductTenantDao {
    @Query("SELECT * FROM v3_tenant WHERE isDefault = 1 LIMIT 1")
    suspend fun getDefault(): ProductTenantEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: ProductTenantEntity)
}

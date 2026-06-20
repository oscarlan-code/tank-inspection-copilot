package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ProductUserProfileDao {
    @Query("SELECT * FROM v3_user_profile WHERE isDefault = 1 LIMIT 1")
    suspend fun getDefault(): ProductUserProfileEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: ProductUserProfileEntity)
}

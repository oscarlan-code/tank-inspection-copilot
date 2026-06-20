package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "v3_user_profile",
    indices = [
        Index("tenantId"),
        Index("workspaceId"),
    ],
)
data class ProductUserProfileEntity(
    @PrimaryKey
    val userId: String,
    val tenantId: String,
    val workspaceId: String,
    val displayName: String,
    val roleCodes: String,
    val deviceId: String,
    val isDefault: Boolean,
    val createdAtIso: String,
    val updatedAtIso: String,
)

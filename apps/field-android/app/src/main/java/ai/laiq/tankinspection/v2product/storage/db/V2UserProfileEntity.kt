package ai.laiq.tankinspection.v2product.storage.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "v2_user_profile",
    indices = [
        Index("tenantId"),
        Index("workspaceId"),
    ],
)
data class V2UserProfileEntity(
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

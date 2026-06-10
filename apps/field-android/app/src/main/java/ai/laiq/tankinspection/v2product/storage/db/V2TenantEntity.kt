package ai.laiq.tankinspection.v2product.storage.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "v2_tenant")
data class V2TenantEntity(
    @PrimaryKey
    val tenantId: String,
    val tenantName: String,
    val isDefault: Boolean,
    val createdAtIso: String,
    val updatedAtIso: String,
)

package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "v3_tenant")
data class ProductTenantEntity(
    @PrimaryKey
    val tenantId: String,
    val tenantName: String,
    val isDefault: Boolean,
    val createdAtIso: String,
    val updatedAtIso: String,
)

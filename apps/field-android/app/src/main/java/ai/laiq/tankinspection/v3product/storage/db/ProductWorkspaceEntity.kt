package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "v3_workspace",
    indices = [Index("tenantId")],
)
data class ProductWorkspaceEntity(
    @PrimaryKey
    val workspaceId: String,
    val tenantId: String,
    val workspaceName: String,
    val isDefault: Boolean,
    val createdAtIso: String,
    val updatedAtIso: String,
)

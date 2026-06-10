package ai.laiq.tankinspection.v2product.storage.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "v2_workspace",
    indices = [Index("tenantId")],
)
data class V2WorkspaceEntity(
    @PrimaryKey
    val workspaceId: String,
    val tenantId: String,
    val workspaceName: String,
    val isDefault: Boolean,
    val createdAtIso: String,
    val updatedAtIso: String,
)

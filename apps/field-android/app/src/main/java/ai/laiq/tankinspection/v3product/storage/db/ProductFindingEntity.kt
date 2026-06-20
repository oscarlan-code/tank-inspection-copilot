package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Entity

@Entity(
    tableName = "v3_finding",
    primaryKeys = ["inspectionId", "findingId"],
)
data class ProductFindingEntity(
    val inspectionId: String,
    val findingId: String,
    val targetKey: String,
    val itemLabel: String,
    val itemKind: String,
    val elementTypeKey: String?,
    val linkedUtItemKey: String,
    val note: String?,
    val attachmentCount: Int,
    val hasMissingAttachment: Boolean,
    val updatedAtIso: String,
)

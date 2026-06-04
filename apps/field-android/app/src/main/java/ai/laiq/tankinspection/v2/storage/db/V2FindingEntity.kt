package ai.laiq.tankinspection.v2.storage.db

import androidx.room.Entity

@Entity(
    tableName = "v2_finding",
    primaryKeys = ["inspectionId", "findingId"],
)
data class V2FindingEntity(
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

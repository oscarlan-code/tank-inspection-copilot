package ai.laiq.tankinspection.data.local.db

import androidx.room.Entity

@Entity(
    tableName = "inspection_component",
    primaryKeys = ["inspectionId", "componentId"],
)
data class InspectionComponentEntity(
    val inspectionId: String,
    val componentId: String,
    val componentKind: String,
    val componentType: String,
    val sortOrder: Int,
    val surface: String,
    val roofSurfaceId: String?,
    val label: String?,
    val size: String?,
    val hasReinforcementPad: Boolean?,
    val placementMode: String?,
    val course: Int?,
    val azimuthDeg: Double?,
    val radiusRatio: Double?,
    val courseOffsetRatio: Double?,
    val plateId: String?,
    val updatedAtIso: String,
)

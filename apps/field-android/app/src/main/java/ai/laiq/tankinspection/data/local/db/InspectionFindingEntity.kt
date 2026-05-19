package ai.laiq.tankinspection.data.local.db

import androidx.room.Entity

@Entity(
    tableName = "inspection_finding",
    primaryKeys = ["inspectionId", "findingId"],
)
data class InspectionFindingEntity(
    val inspectionId: String,
    val findingId: String,
    val sortOrder: Int,
    val surface: String,
    val type: String,
    val severity: String,
    val note: String?,
    val linkedMeasurementId: String?,
    val locationSummary: String?,
    val preciseLineId: String?,
    val preciseCourse: Int?,
    val attachmentCount: Int,
    val updatedAtIso: String,
)

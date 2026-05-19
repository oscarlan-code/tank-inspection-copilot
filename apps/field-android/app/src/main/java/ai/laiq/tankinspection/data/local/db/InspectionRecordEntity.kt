package ai.laiq.tankinspection.data.local.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "inspection_record")
data class InspectionRecordEntity(
    @PrimaryKey
    val inspectionId: String,
    val packageId: String,
    val startedAtIso: String,
    val client: String,
    val site: String,
    val tankNumber: String,
    val inspector: String,
    val roofType: String,
    val referenceMode: String,
    val startReference: String,
    val rotationDirection: String,
    val diameterM: Double,
    val heightM: Double,
    val shellCourseCount: Int,
    val shellLineCountOverride: Int?,
    val reviewStatus: String,
    val updatedAtIso: String,
)

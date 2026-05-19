package ai.laiq.tankinspection.data.local.db

import androidx.room.Entity

@Entity(
    tableName = "inspection_measurement",
    primaryKeys = ["inspectionId", "measurementId"],
)
data class InspectionMeasurementEntity(
    val inspectionId: String,
    val measurementId: String,
    val moduleKey: String,
    val sortOrder: Int,
    val sourceRecordId: String?,
    val groupId: String?,
    val groupLabel: String?,
    val lineId: String?,
    val course: Int?,
    val roofSurfaceId: String?,
    val plateId: String?,
    val nozzleId: String?,
    val stationId: String?,
    val angleDeg: Double?,
    val heightReference: String?,
    val captureState: String,
    val value1: Double?,
    val value2: Double?,
    val value3: Double?,
    val value4: Double?,
    val value5: Double?,
    val note: String?,
    val updatedAtIso: String,
)

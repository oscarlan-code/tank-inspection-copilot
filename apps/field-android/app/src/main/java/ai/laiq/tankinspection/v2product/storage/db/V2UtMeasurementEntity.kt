package ai.laiq.tankinspection.v2product.storage.db

import androidx.room.Entity

@Entity(
    tableName = "v2_ut_measurement",
    primaryKeys = ["inspectionId", "itemKey"],
)
data class V2UtMeasurementEntity(
    val inspectionId: String,
    val itemKey: String,
    val targetKey: String,
    val itemLabel: String,
    val itemKind: String,
    val elementTypeKey: String?,
    val nozzleSize: String?,
    val reinforcementPadReading: Double?,
    val laneId: String?,
    val course: Int?,
    val plateId: String?,
    val elementId: String?,
    val confirmed: Boolean,
    val measured: Boolean,
    val value1: Double?,
    val value2: Double?,
    val value3: Double?,
    val value4: Double?,
    val value5: Double?,
    val updatedAtIso: String,
)

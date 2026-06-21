package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Entity

@Entity(
    tableName = "v3_layout_config",
    primaryKeys = ["inspectionId", "targetKey"],
)
data class ProductLayoutConfigEntity(
    val inspectionId: String,
    val targetKey: String,
    val surfaceKey: String,
    val referenceMode: String,
    val referenceNote: String,
    val roofPattern: String?,
    val roofRingCount: Int?,
    val roofSectorCount: Int?,
    val roofRowCount: Int?,
    val roofWidestRowPlateCount: Int?,
    val roofHasCenterOpening: Boolean?,
    val roofHasAnnularRing: Boolean?,
    val roofAnnularSectionCount: Int?,
    val shellCourseCount: Int?,
    val shellPlatesPerCourse: Int?,
    val shellLaneCount: Int?,
    val shellPlateOffset: String?,
    val shellOffsetStartRow: String?,
    val shellThirdOffsetStart: String?,
    val floorTemplate: String?,
    val floorPlateCount: Int?,
    val floorAnnularSectionCount: Int?,
    val floorPatternCountX: Int?,
    val floorPatternCountY: Int?,
    val customCircularLayoutJson: String?,
    val updatedAtIso: String,
)

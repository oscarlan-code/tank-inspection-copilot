package ai.laiq.tankinspection.v2.storage.db

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [
        V2InspectionRecordEntity::class,
        V2LayoutTargetEntity::class,
        V2LayoutConfigEntity::class,
        V2ElementEntity::class,
        V2UtMeasurementEntity::class,
        V2FindingEntity::class,
        V2AttachmentEntity::class,
        V2TaskSnapshotEntity::class,
    ],
    version = 1,
    exportSchema = true,
)
abstract class V2FieldDatabase : RoomDatabase() {
    abstract fun inspectionRecordDao(): V2InspectionRecordDao
    abstract fun layoutTargetDao(): V2LayoutTargetDao
    abstract fun layoutConfigDao(): V2LayoutConfigDao
    abstract fun elementDao(): V2ElementDao
    abstract fun utMeasurementDao(): V2UtMeasurementDao
    abstract fun findingDao(): V2FindingDao
    abstract fun attachmentDao(): V2AttachmentDao
    abstract fun taskSnapshotDao(): V2TaskSnapshotDao
}

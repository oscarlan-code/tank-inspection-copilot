package ai.laiq.tankinspection.data.local.db

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [
        AppSessionEntity::class,
        InspectionRecordEntity::class,
        ExportBundleEntity::class,
        AppConfigEntity::class,
        InspectionTaskSnapshotEntity::class,
        InspectionAttachmentEntity::class,
        InspectionBaselineEntity::class,
        InspectionComponentEntity::class,
        InspectionMeasurementEntity::class,
        InspectionFindingEntity::class,
    ],
    version = 10,
    exportSchema = true,
)
abstract class LaiqFieldDatabase : RoomDatabase() {
    abstract fun appSessionDao(): AppSessionDao
    abstract fun inspectionRecordDao(): InspectionRecordDao
    abstract fun exportBundleDao(): ExportBundleDao
    abstract fun appConfigDao(): AppConfigDao
    abstract fun inspectionTaskSnapshotDao(): InspectionTaskSnapshotDao
    abstract fun inspectionAttachmentDao(): InspectionAttachmentDao
    abstract fun inspectionBaselineDao(): InspectionBaselineDao
    abstract fun inspectionComponentDao(): InspectionComponentDao
    abstract fun inspectionMeasurementDao(): InspectionMeasurementDao
    abstract fun inspectionFindingDao(): InspectionFindingDao
}

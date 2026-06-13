package ai.laiq.tankinspection.v2product.storage.db

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        V2TenantEntity::class,
        V2WorkspaceEntity::class,
        V2UserProfileEntity::class,
        V2InspectionTaskEntity::class,
        V2TaskAuditEventEntity::class,
        V2ExportPackageEntity::class,
        V2ExportValidationResultEntity::class,
        V2InspectionRecordEntity::class,
        V2LayoutTargetEntity::class,
        V2LayoutConfigEntity::class,
        V2ElementEntity::class,
        V2UtMeasurementEntity::class,
        V2ChecklistItemEntity::class,
        V2ChecklistSectionNoteEntity::class,
        V2FindingEntity::class,
        V2AttachmentEntity::class,
        V2TaskSnapshotEntity::class,
    ],
    version = 5,
    exportSchema = true,
)
abstract class V2FieldDatabase : RoomDatabase() {
    abstract fun tenantDao(): V2TenantDao
    abstract fun workspaceDao(): V2WorkspaceDao
    abstract fun userProfileDao(): V2UserProfileDao
    abstract fun inspectionTaskDao(): V2InspectionTaskDao
    abstract fun taskAuditEventDao(): V2TaskAuditEventDao
    abstract fun exportPackageDao(): V2ExportPackageDao
    abstract fun exportValidationResultDao(): V2ExportValidationResultDao
    abstract fun inspectionRecordDao(): V2InspectionRecordDao
    abstract fun layoutTargetDao(): V2LayoutTargetDao
    abstract fun layoutConfigDao(): V2LayoutConfigDao
    abstract fun elementDao(): V2ElementDao
    abstract fun utMeasurementDao(): V2UtMeasurementDao
    abstract fun checklistItemDao(): V2ChecklistItemDao
    abstract fun checklistSectionNoteDao(): V2ChecklistSectionNoteDao
    abstract fun findingDao(): V2FindingDao
    abstract fun attachmentDao(): V2AttachmentDao
    abstract fun taskSnapshotDao(): V2TaskSnapshotDao

    companion object {
        val MIGRATION_1_2 =
            object : Migration(1, 2) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    db.execSQL(
                        """
                        ALTER TABLE v2_inspection_record
                        ADD COLUMN tenantId TEXT NOT NULL DEFAULT ''
                        """.trimIndent(),
                    )
                    db.execSQL(
                        """
                        ALTER TABLE v2_inspection_record
                        ADD COLUMN workspaceId TEXT NOT NULL DEFAULT ''
                        """.trimIndent(),
                    )
                    db.execSQL(
                        """
                        ALTER TABLE v2_inspection_record
                        ADD COLUMN inspectionReference TEXT NOT NULL DEFAULT ''
                        """.trimIndent(),
                    )
                    db.execSQL(
                        """
                        ALTER TABLE v2_inspection_record
                        ADD COLUMN createdByUserId TEXT NOT NULL DEFAULT ''
                        """.trimIndent(),
                    )
                    db.execSQL(
                        """
                        ALTER TABLE v2_inspection_record
                        ADD COLUMN lastEditedByUserId TEXT NOT NULL DEFAULT ''
                        """.trimIndent(),
                    )
                    db.execSQL(
                        """
                        ALTER TABLE v2_inspection_record
                        ADD COLUMN deviceId TEXT NOT NULL DEFAULT ''
                        """.trimIndent(),
                    )
                    db.execSQL(
                        """
                        CREATE TABLE IF NOT EXISTS `v2_tenant` (
                            `tenantId` TEXT NOT NULL,
                            `tenantName` TEXT NOT NULL,
                            `isDefault` INTEGER NOT NULL,
                            `createdAtIso` TEXT NOT NULL,
                            `updatedAtIso` TEXT NOT NULL,
                            PRIMARY KEY(`tenantId`)
                        )
                        """.trimIndent(),
                    )
                    db.execSQL(
                        """
                        CREATE TABLE IF NOT EXISTS `v2_workspace` (
                            `workspaceId` TEXT NOT NULL,
                            `tenantId` TEXT NOT NULL,
                            `workspaceName` TEXT NOT NULL,
                            `isDefault` INTEGER NOT NULL,
                            `createdAtIso` TEXT NOT NULL,
                            `updatedAtIso` TEXT NOT NULL,
                            PRIMARY KEY(`workspaceId`)
                        )
                        """.trimIndent(),
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v2_workspace_tenantId` ON `v2_workspace` (`tenantId`)",
                    )
                    db.execSQL(
                        """
                        CREATE TABLE IF NOT EXISTS `v2_user_profile` (
                            `userId` TEXT NOT NULL,
                            `tenantId` TEXT NOT NULL,
                            `workspaceId` TEXT NOT NULL,
                            `displayName` TEXT NOT NULL,
                            `roleCodes` TEXT NOT NULL,
                            `deviceId` TEXT NOT NULL,
                            `isDefault` INTEGER NOT NULL,
                            `createdAtIso` TEXT NOT NULL,
                            `updatedAtIso` TEXT NOT NULL,
                            PRIMARY KEY(`userId`)
                        )
                        """.trimIndent(),
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v2_user_profile_tenantId` ON `v2_user_profile` (`tenantId`)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v2_user_profile_workspaceId` ON `v2_user_profile` (`workspaceId`)",
                    )
                    db.execSQL(
                        """
                        CREATE TABLE IF NOT EXISTS `v2_inspection_task` (
                            `inspectionId` TEXT NOT NULL,
                            `inspectionReference` TEXT NOT NULL,
                            `tenantId` TEXT NOT NULL,
                            `workspaceId` TEXT NOT NULL,
                            `createdByUserId` TEXT NOT NULL,
                            `lastEditedByUserId` TEXT NOT NULL,
                            `deviceId` TEXT NOT NULL,
                            `client` TEXT NOT NULL,
                            `tankNumber` TEXT NOT NULL,
                            `location` TEXT NOT NULL,
                            `lifecycleState` TEXT NOT NULL,
                            `currentScreenKey` TEXT NOT NULL,
                            `currentScreenLabel` TEXT NOT NULL,
                            `readinessStatusCode` TEXT NOT NULL,
                            `readinessStatusLabel` TEXT NOT NULL,
                            `exportStatusCode` TEXT NOT NULL,
                            `exportStatusLabel` TEXT NOT NULL,
                            `archivedAtIso` TEXT,
                            `exportedAtIso` TEXT,
                            `createdAtIso` TEXT NOT NULL,
                            `updatedAtIso` TEXT NOT NULL,
                            PRIMARY KEY(`inspectionId`)
                        )
                        """.trimIndent(),
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v2_inspection_task_lifecycleState` ON `v2_inspection_task` (`lifecycleState`)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v2_inspection_task_workspaceId` ON `v2_inspection_task` (`workspaceId`)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v2_inspection_task_updatedAtIso` ON `v2_inspection_task` (`updatedAtIso`)",
                    )
                    db.execSQL(
                        """
                        CREATE TABLE IF NOT EXISTS `v2_task_audit_event` (
                            `auditEventId` TEXT NOT NULL,
                            `inspectionId` TEXT NOT NULL,
                            `tenantId` TEXT NOT NULL,
                            `workspaceId` TEXT NOT NULL,
                            `inspectionReference` TEXT NOT NULL,
                            `actorUserId` TEXT NOT NULL,
                            `eventCode` TEXT NOT NULL,
                            `eventLabel` TEXT NOT NULL,
                            `note` TEXT,
                            `createdAtIso` TEXT NOT NULL,
                            PRIMARY KEY(`auditEventId`)
                        )
                        """.trimIndent(),
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v2_task_audit_event_inspectionId` ON `v2_task_audit_event` (`inspectionId`)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v2_task_audit_event_createdAtIso` ON `v2_task_audit_event` (`createdAtIso`)",
                    )
                }
            }

        val MIGRATION_2_3 =
            object : Migration(2, 3) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    db.execSQL(
                        """
                        CREATE TABLE IF NOT EXISTS `v2_export_package` (
                            `exportPackageId` TEXT NOT NULL,
                            `inspectionId` TEXT NOT NULL,
                            `tenantId` TEXT NOT NULL,
                            `workspaceId` TEXT NOT NULL,
                            `inspectionReference` TEXT NOT NULL,
                            `createdByUserId` TEXT NOT NULL,
                            `lastEditedByUserId` TEXT NOT NULL,
                            `exportedByUserId` TEXT NOT NULL,
                            `deviceId` TEXT NOT NULL,
                            `schemaVersion` INTEGER NOT NULL,
                            `validationStatusCode` TEXT NOT NULL,
                            `validationStatusLabel` TEXT NOT NULL,
                            `fileRelativePath` TEXT NOT NULL,
                            `fileByteSize` INTEGER,
                            `attachmentCount` INTEGER NOT NULL,
                            `findingCount` INTEGER NOT NULL,
                            `exportedAtIso` TEXT NOT NULL,
                            `createdAtIso` TEXT NOT NULL,
                            `updatedAtIso` TEXT NOT NULL,
                            PRIMARY KEY(`exportPackageId`)
                        )
                        """.trimIndent(),
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v2_export_package_inspectionId` ON `v2_export_package` (`inspectionId`)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v2_export_package_exportedAtIso` ON `v2_export_package` (`exportedAtIso`)",
                    )
                    db.execSQL(
                        """
                        CREATE TABLE IF NOT EXISTS `v2_export_validation_result` (
                            `inspectionId` TEXT NOT NULL,
                            `tenantId` TEXT NOT NULL,
                            `workspaceId` TEXT NOT NULL,
                            `inspectionReference` TEXT NOT NULL,
                            `createdByUserId` TEXT NOT NULL,
                            `lastEditedByUserId` TEXT NOT NULL,
                            `deviceId` TEXT NOT NULL,
                            `ruleCode` TEXT NOT NULL,
                            `ruleLabel` TEXT NOT NULL,
                            `passed` INTEGER NOT NULL,
                            `blocksExport` INTEGER NOT NULL,
                            `message` TEXT NOT NULL,
                            `createdAtIso` TEXT NOT NULL,
                            `updatedAtIso` TEXT NOT NULL,
                            PRIMARY KEY(`inspectionId`, `ruleCode`)
                        )
                        """.trimIndent(),
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v2_export_validation_result_inspectionId` ON `v2_export_validation_result` (`inspectionId`)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v2_export_validation_result_updatedAtIso` ON `v2_export_validation_result` (`updatedAtIso`)",
                    )
                }
            }

        val MIGRATION_3_4 =
            object : Migration(3, 4) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    db.execSQL(
                        """
                        CREATE TABLE IF NOT EXISTS `v2_checklist_item` (
                            `inspectionId` TEXT NOT NULL,
                            `sectionKey` TEXT NOT NULL,
                            `sectionTitle` TEXT NOT NULL,
                            `itemNumber` INTEGER NOT NULL,
                            `itemPrompt` TEXT NOT NULL,
                            `ratingKey` TEXT NOT NULL,
                            `ratingLabel` TEXT NOT NULL,
                            `updatedAtIso` TEXT NOT NULL,
                            PRIMARY KEY(`inspectionId`, `itemNumber`)
                        )
                        """.trimIndent(),
                    )
                    db.execSQL(
                        """
                        CREATE TABLE IF NOT EXISTS `v2_checklist_section_note` (
                            `inspectionId` TEXT NOT NULL,
                            `sectionKey` TEXT NOT NULL,
                            `sectionTitle` TEXT NOT NULL,
                            `note` TEXT NOT NULL,
                            `updatedAtIso` TEXT NOT NULL,
                            PRIMARY KEY(`inspectionId`, `sectionKey`)
                        )
                        """.trimIndent(),
                    )
                }
            }

        val MIGRATION_4_5 =
            object : Migration(4, 5) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    db.execSQL(
                        """
                        ALTER TABLE v2_ut_measurement
                        ADD COLUMN reinforcementPadReading REAL
                        """.trimIndent(),
                    )
                }
            }
    }
}

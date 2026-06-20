package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        ProductTenantEntity::class,
        ProductWorkspaceEntity::class,
        ProductUserProfileEntity::class,
        ProductInspectionTaskEntity::class,
        ProductTaskAuditEventEntity::class,
        ProductExportPackageEntity::class,
        ProductExportValidationResultEntity::class,
        ProductInspectionRecordEntity::class,
        ProductLayoutTargetEntity::class,
        ProductLayoutConfigEntity::class,
        ProductElementEntity::class,
        ProductUtMeasurementEntity::class,
        ProductChecklistItemEntity::class,
        ProductChecklistSectionNoteEntity::class,
        ProductFindingEntity::class,
        ProductAttachmentEntity::class,
        ProductVoiceNoteEntity::class,
        ProductTaskSnapshotEntity::class,
    ],
    version = 7,
    exportSchema = true,
)
abstract class ProductFieldDatabase : RoomDatabase() {
    abstract fun tenantDao(): ProductTenantDao
    abstract fun workspaceDao(): ProductWorkspaceDao
    abstract fun userProfileDao(): ProductUserProfileDao
    abstract fun inspectionTaskDao(): ProductInspectionTaskDao
    abstract fun taskAuditEventDao(): ProductTaskAuditEventDao
    abstract fun exportPackageDao(): ProductExportPackageDao
    abstract fun exportValidationResultDao(): ProductExportValidationResultDao
    abstract fun inspectionRecordDao(): ProductInspectionRecordDao
    abstract fun layoutTargetDao(): ProductLayoutTargetDao
    abstract fun layoutConfigDao(): ProductLayoutConfigDao
    abstract fun elementDao(): ProductElementDao
    abstract fun utMeasurementDao(): ProductUtMeasurementDao
    abstract fun checklistItemDao(): ProductChecklistItemDao
    abstract fun checklistSectionNoteDao(): ProductChecklistSectionNoteDao
    abstract fun findingDao(): ProductFindingDao
    abstract fun attachmentDao(): ProductAttachmentDao
    abstract fun voiceNoteDao(): ProductVoiceNoteDao
    abstract fun taskSnapshotDao(): ProductTaskSnapshotDao

    companion object {
        val MIGRATION_1_2 =
            object : Migration(1, 2) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    db.execSQL(
                        """
                        ALTER TABLE v3_inspection_record
                        ADD COLUMN tenantId TEXT NOT NULL DEFAULT ''
                        """.trimIndent(),
                    )
                    db.execSQL(
                        """
                        ALTER TABLE v3_inspection_record
                        ADD COLUMN workspaceId TEXT NOT NULL DEFAULT ''
                        """.trimIndent(),
                    )
                    db.execSQL(
                        """
                        ALTER TABLE v3_inspection_record
                        ADD COLUMN inspectionReference TEXT NOT NULL DEFAULT ''
                        """.trimIndent(),
                    )
                    db.execSQL(
                        """
                        ALTER TABLE v3_inspection_record
                        ADD COLUMN createdByUserId TEXT NOT NULL DEFAULT ''
                        """.trimIndent(),
                    )
                    db.execSQL(
                        """
                        ALTER TABLE v3_inspection_record
                        ADD COLUMN lastEditedByUserId TEXT NOT NULL DEFAULT ''
                        """.trimIndent(),
                    )
                    db.execSQL(
                        """
                        ALTER TABLE v3_inspection_record
                        ADD COLUMN deviceId TEXT NOT NULL DEFAULT ''
                        """.trimIndent(),
                    )
                    db.execSQL(
                        """
                        CREATE TABLE IF NOT EXISTS `v3_tenant` (
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
                        CREATE TABLE IF NOT EXISTS `v3_workspace` (
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
                        "CREATE INDEX IF NOT EXISTS `index_v3_workspace_tenantId` ON `v3_workspace` (`tenantId`)",
                    )
                    db.execSQL(
                        """
                        CREATE TABLE IF NOT EXISTS `v3_user_profile` (
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
                        "CREATE INDEX IF NOT EXISTS `index_v3_user_profile_tenantId` ON `v3_user_profile` (`tenantId`)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v3_user_profile_workspaceId` ON `v3_user_profile` (`workspaceId`)",
                    )
                    db.execSQL(
                        """
                        CREATE TABLE IF NOT EXISTS `v3_inspection_task` (
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
                        "CREATE INDEX IF NOT EXISTS `index_v3_inspection_task_lifecycleState` ON `v3_inspection_task` (`lifecycleState`)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v3_inspection_task_workspaceId` ON `v3_inspection_task` (`workspaceId`)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v3_inspection_task_updatedAtIso` ON `v3_inspection_task` (`updatedAtIso`)",
                    )
                    db.execSQL(
                        """
                        CREATE TABLE IF NOT EXISTS `v3_task_audit_event` (
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
                        "CREATE INDEX IF NOT EXISTS `index_v3_task_audit_event_inspectionId` ON `v3_task_audit_event` (`inspectionId`)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v3_task_audit_event_createdAtIso` ON `v3_task_audit_event` (`createdAtIso`)",
                    )
                }
            }

        val MIGRATION_2_3 =
            object : Migration(2, 3) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    db.execSQL(
                        """
                        CREATE TABLE IF NOT EXISTS `v3_export_package` (
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
                        "CREATE INDEX IF NOT EXISTS `index_v3_export_package_inspectionId` ON `v3_export_package` (`inspectionId`)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v3_export_package_exportedAtIso` ON `v3_export_package` (`exportedAtIso`)",
                    )
                    db.execSQL(
                        """
                        CREATE TABLE IF NOT EXISTS `v3_export_validation_result` (
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
                        "CREATE INDEX IF NOT EXISTS `index_v3_export_validation_result_inspectionId` ON `v3_export_validation_result` (`inspectionId`)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v3_export_validation_result_updatedAtIso` ON `v3_export_validation_result` (`updatedAtIso`)",
                    )
                }
            }

        val MIGRATION_3_4 =
            object : Migration(3, 4) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    db.execSQL(
                        """
                        CREATE TABLE IF NOT EXISTS `v3_checklist_item` (
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
                        CREATE TABLE IF NOT EXISTS `v3_checklist_section_note` (
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
                        ALTER TABLE v3_ut_measurement
                        ADD COLUMN reinforcementPadReading REAL
                        """.trimIndent(),
                    )
                }
            }

        val MIGRATION_5_6 =
            object : Migration(5, 6) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    db.execSQL(
                        """
                        CREATE TABLE IF NOT EXISTS `v3_voice_note` (
                            `inspectionId` TEXT NOT NULL,
                            `voiceNoteId` TEXT NOT NULL,
                            `relativePath` TEXT NOT NULL,
                            `displayName` TEXT NOT NULL,
                            `screenKey` TEXT NOT NULL,
                            `screenLabel` TEXT NOT NULL,
                            `cardKey` TEXT NOT NULL,
                            `fieldKey` TEXT NOT NULL,
                            `targetKey` TEXT,
                            `targetLabel` TEXT,
                            `itemKey` TEXT,
                            `itemLabel` TEXT,
                            `transcriptStatus` TEXT NOT NULL,
                            `transcriptText` TEXT,
                            `durationMs` INTEGER,
                            `mediaType` TEXT NOT NULL,
                            `fileByteSize` INTEGER,
                            `fileExists` INTEGER NOT NULL,
                            `capturedAtIso` TEXT NOT NULL,
                            `updatedAtIso` TEXT NOT NULL,
                            PRIMARY KEY(`inspectionId`, `voiceNoteId`)
                        )
                        """.trimIndent(),
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v3_voice_note_inspectionId` ON `v3_voice_note` (`inspectionId`)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v3_voice_note_screenKey` ON `v3_voice_note` (`screenKey`)",
                    )
                    db.execSQL(
                        "CREATE INDEX IF NOT EXISTS `index_v3_voice_note_itemKey` ON `v3_voice_note` (`itemKey`)",
                    )
                }
            }

        val MIGRATION_6_7 =
            object : Migration(6, 7) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    db.execSQL(
                        """
                        ALTER TABLE v3_checklist_item
                        ADD COLUMN itemNote TEXT
                        """.trimIndent(),
                    )
                }
            }
    }
}

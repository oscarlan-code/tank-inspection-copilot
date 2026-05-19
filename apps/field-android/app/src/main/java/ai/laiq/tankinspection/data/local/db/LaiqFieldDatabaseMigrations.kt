package ai.laiq.tankinspection.data.local.db

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

object LaiqFieldDatabaseMigrations {
    val MIGRATION_1_2 = object : Migration(1, 2) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `inspection_record` (
                    `inspectionId` TEXT NOT NULL,
                    `packageId` TEXT NOT NULL,
                    `startedAtIso` TEXT NOT NULL,
                    `client` TEXT NOT NULL,
                    `site` TEXT NOT NULL,
                    `tankNumber` TEXT NOT NULL,
                    `inspector` TEXT NOT NULL,
                    `roofType` TEXT NOT NULL,
                    `referenceMode` TEXT NOT NULL,
                    `startReference` TEXT NOT NULL,
                    `rotationDirection` TEXT NOT NULL,
                    `diameterM` REAL NOT NULL,
                    `heightM` REAL NOT NULL,
                    `shellCourseCount` INTEGER NOT NULL,
                    `shellLineCountOverride` INTEGER,
                    `reviewStatus` TEXT NOT NULL,
                    `updatedAtIso` TEXT NOT NULL,
                    PRIMARY KEY(`inspectionId`)
                )
                """.trimIndent(),
            )
        }
    }

    val MIGRATION_2_3 = object : Migration(2, 3) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `export_bundle` (
                    `exportId` TEXT NOT NULL,
                    `inspectionId` TEXT NOT NULL,
                    `packageId` TEXT NOT NULL,
                    `schemaVersion` TEXT NOT NULL,
                    `packageDirPath` TEXT NOT NULL,
                    `zipFilePath` TEXT NOT NULL,
                    `attachmentCount` INTEGER NOT NULL,
                    `missingAttachmentCount` INTEGER NOT NULL,
                    `status` TEXT NOT NULL,
                    `exportedAtIso` TEXT NOT NULL,
                    `uploadedAtIso` TEXT,
                    PRIMARY KEY(`exportId`)
                )
                """.trimIndent(),
            )
        }
    }

    val MIGRATION_3_4 = object : Migration(3, 4) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `app_config` (
                    `configKey` TEXT NOT NULL,
                    `configValue` TEXT NOT NULL,
                    `updatedAtIso` TEXT NOT NULL,
                    PRIMARY KEY(`configKey`)
                )
                """.trimIndent(),
            )
        }
    }

    val MIGRATION_4_5 = object : Migration(4, 5) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `inspection_task_snapshot` (
                    `inspectionId` TEXT NOT NULL,
                    `taskKey` TEXT NOT NULL,
                    `taskTitle` TEXT NOT NULL,
                    `taskOrder` INTEGER NOT NULL,
                    `inScope` INTEGER NOT NULL,
                    `statusCode` TEXT NOT NULL,
                    `statusLabel` TEXT NOT NULL,
                    `isComplete` INTEGER NOT NULL,
                    `blocksExport` INTEGER NOT NULL,
                    `entryCount` INTEGER NOT NULL,
                    `referenceCount` INTEGER NOT NULL,
                    `updatedAtIso` TEXT NOT NULL,
                    PRIMARY KEY(`inspectionId`, `taskKey`)
                )
                """.trimIndent(),
            )
        }
    }

    val MIGRATION_5_6 = object : Migration(5, 6) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `inspection_attachment` (
                    `inspectionId` TEXT NOT NULL,
                    `attachmentId` TEXT NOT NULL,
                    `kind` TEXT NOT NULL,
                    `relativePath` TEXT NOT NULL,
                    `caption` TEXT,
                    `mediaType` TEXT NOT NULL,
                    `fileByteSize` INTEGER,
                    `fileExists` INTEGER NOT NULL,
                    `linkedRecordType` TEXT,
                    `linkedRecordId` TEXT,
                    `updatedAtIso` TEXT NOT NULL,
                    PRIMARY KEY(`inspectionId`, `attachmentId`)
                )
                """.trimIndent(),
            )
        }
    }

    val MIGRATION_6_7 = object : Migration(6, 7) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `inspection_baseline` (
                    `inspectionId` TEXT NOT NULL,
                    `packageId` TEXT NOT NULL,
                    `startedAtIso` TEXT NOT NULL,
                    `inspectionType` TEXT NOT NULL,
                    `client` TEXT NOT NULL,
                    `site` TEXT NOT NULL,
                    `tankNumber` TEXT NOT NULL,
                    `inspector` TEXT NOT NULL,
                    `diameterM` REAL NOT NULL,
                    `heightM` REAL NOT NULL,
                    `shellCourseCount` INTEGER NOT NULL,
                    `roofType` TEXT NOT NULL,
                    `fixedRoofType` TEXT,
                    `floatingRoofType` TEXT,
                    `thicknessUnit` TEXT NOT NULL,
                    `settlementUnit` TEXT NOT NULL,
                    `nozzleSizeUnit` TEXT NOT NULL,
                    `referenceMode` TEXT NOT NULL,
                    `startReferenceCode` TEXT NOT NULL,
                    `startReferenceLabel` TEXT NOT NULL,
                    `referenceRemark` TEXT NOT NULL,
                    `rotationDirection` TEXT NOT NULL,
                    `selectedTaskKeys` TEXT NOT NULL,
                    `savedReferenceBaselineKey` TEXT,
                    `savedShellPlanKey` TEXT,
                    `shellLineCountOverride` INTEGER,
                    `recommendedShellLineCount` INTEGER,
                    `resolvedShellLineCount` INTEGER,
                    `captureStartLaneId` TEXT,
                    `fixedRoofLayoutTemplate` TEXT,
                    `fixedRoofLayoutReady` INTEGER NOT NULL,
                    `fixedRoofFeatureCount` INTEGER NOT NULL,
                    `floatingRoofLayoutTemplate` TEXT,
                    `floatingRoofLayoutReady` INTEGER NOT NULL,
                    `floatingRoofFeatureCount` INTEGER NOT NULL,
                    `mflContractor` TEXT,
                    `mflReportReference` TEXT,
                    `mflReportDate` TEXT,
                    `mflSeverity` TEXT,
                    `mflAttachmentId` TEXT,
                    `reviewStatus` TEXT NOT NULL,
                    `reviewWarningCount` INTEGER NOT NULL,
                    `updatedAtIso` TEXT NOT NULL,
                    PRIMARY KEY(`inspectionId`)
                )
                """.trimIndent(),
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `inspection_component` (
                    `inspectionId` TEXT NOT NULL,
                    `componentId` TEXT NOT NULL,
                    `componentKind` TEXT NOT NULL,
                    `componentType` TEXT NOT NULL,
                    `sortOrder` INTEGER NOT NULL,
                    `surface` TEXT NOT NULL,
                    `roofSurfaceId` TEXT,
                    `label` TEXT,
                    `size` TEXT,
                    `hasReinforcementPad` INTEGER,
                    `placementMode` TEXT,
                    `course` INTEGER,
                    `azimuthDeg` REAL,
                    `radiusRatio` REAL,
                    `courseOffsetRatio` REAL,
                    `plateId` TEXT,
                    `updatedAtIso` TEXT NOT NULL,
                    PRIMARY KEY(`inspectionId`, `componentId`)
                )
                """.trimIndent(),
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `inspection_measurement` (
                    `inspectionId` TEXT NOT NULL,
                    `measurementId` TEXT NOT NULL,
                    `moduleKey` TEXT NOT NULL,
                    `sortOrder` INTEGER NOT NULL,
                    `sourceRecordId` TEXT,
                    `groupId` TEXT,
                    `groupLabel` TEXT,
                    `lineId` TEXT,
                    `course` INTEGER,
                    `roofSurfaceId` TEXT,
                    `plateId` TEXT,
                    `nozzleId` TEXT,
                    `stationId` TEXT,
                    `angleDeg` REAL,
                    `heightReference` TEXT,
                    `captureState` TEXT NOT NULL,
                    `value1` REAL,
                    `value2` REAL,
                    `value3` REAL,
                    `value4` REAL,
                    `value5` REAL,
                    `note` TEXT,
                    `updatedAtIso` TEXT NOT NULL,
                    PRIMARY KEY(`inspectionId`, `measurementId`)
                )
                """.trimIndent(),
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS `inspection_finding` (
                    `inspectionId` TEXT NOT NULL,
                    `findingId` TEXT NOT NULL,
                    `sortOrder` INTEGER NOT NULL,
                    `surface` TEXT NOT NULL,
                    `type` TEXT NOT NULL,
                    `severity` TEXT NOT NULL,
                    `note` TEXT,
                    `linkedMeasurementId` TEXT,
                    `locationSummary` TEXT,
                    `preciseLineId` TEXT,
                    `preciseCourse` INTEGER,
                    `attachmentCount` INTEGER NOT NULL,
                    `updatedAtIso` TEXT NOT NULL,
                    PRIMARY KEY(`inspectionId`, `findingId`)
                )
                """.trimIndent(),
            )
        }
    }

    val MIGRATION_7_8 = object : Migration(7, 8) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE `inspection_baseline` ADD COLUMN `activeRoofSurfaceId` TEXT NOT NULL DEFAULT 'fixed'")
            db.execSQL("ALTER TABLE `inspection_baseline` ADD COLUMN `fixedRoofRowCount` INTEGER")
            db.execSQL("ALTER TABLE `inspection_baseline` ADD COLUMN `fixedRoofWidestRowPlateCount` INTEGER")
            db.execSQL("ALTER TABLE `inspection_baseline` ADD COLUMN `fixedRoofRingCount` INTEGER")
            db.execSQL("ALTER TABLE `inspection_baseline` ADD COLUMN `fixedRoofSectorCount` INTEGER")
            db.execSQL("ALTER TABLE `inspection_baseline` ADD COLUMN `fixedRoofCenterOpeningRatio` REAL")
            db.execSQL("ALTER TABLE `inspection_baseline` ADD COLUMN `fixedRoofHasAnnularRing` INTEGER NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE `inspection_baseline` ADD COLUMN `fixedRoofAnnularSectionCount` INTEGER")
            db.execSQL("ALTER TABLE `inspection_baseline` ADD COLUMN `fixedRoofHasPontoonDeck` INTEGER NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE `inspection_baseline` ADD COLUMN `floatingRoofRowCount` INTEGER")
            db.execSQL("ALTER TABLE `inspection_baseline` ADD COLUMN `floatingRoofWidestRowPlateCount` INTEGER")
            db.execSQL("ALTER TABLE `inspection_baseline` ADD COLUMN `floatingRoofRingCount` INTEGER")
            db.execSQL("ALTER TABLE `inspection_baseline` ADD COLUMN `floatingRoofSectorCount` INTEGER")
            db.execSQL("ALTER TABLE `inspection_baseline` ADD COLUMN `floatingRoofCenterOpeningRatio` REAL")
            db.execSQL("ALTER TABLE `inspection_baseline` ADD COLUMN `floatingRoofHasAnnularRing` INTEGER NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE `inspection_baseline` ADD COLUMN `floatingRoofAnnularSectionCount` INTEGER")
            db.execSQL("ALTER TABLE `inspection_baseline` ADD COLUMN `floatingRoofHasPontoonDeck` INTEGER NOT NULL DEFAULT 0")
        }
    }

    val MIGRATION_8_9 = object : Migration(8, 9) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE `app_session` ADD COLUMN `activeInspectionId` TEXT")
        }
    }

    val MIGRATION_9_10 = object : Migration(9, 10) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE `export_bundle` ADD COLUMN `zipByteSize` INTEGER NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE `export_bundle` ADD COLUMN `zipExists` INTEGER NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE `export_bundle` ADD COLUMN `uploadAttemptCount` INTEGER NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE `export_bundle` ADD COLUMN `lastAttemptedAtIso` TEXT")
            db.execSQL("ALTER TABLE `export_bundle` ADD COLUMN `lastError` TEXT")
            db.execSQL("UPDATE `export_bundle` SET `zipExists` = 1 WHERE `zipFilePath` IS NOT NULL AND `zipFilePath` != ''")
        }
    }

    val ALL = arrayOf(
        MIGRATION_1_2,
        MIGRATION_2_3,
        MIGRATION_3_4,
        MIGRATION_4_5,
        MIGRATION_5_6,
        MIGRATION_6_7,
        MIGRATION_7_8,
        MIGRATION_8_9,
        MIGRATION_9_10,
    )
}

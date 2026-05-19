package ai.laiq.tankinspection.data.local

import ai.laiq.tankinspection.data.local.db.AppConfigEntity
import ai.laiq.tankinspection.data.local.db.InspectionAttachmentEntity
import ai.laiq.tankinspection.data.local.db.AppSessionEntity
import ai.laiq.tankinspection.data.local.db.ExportBundleEntity
import ai.laiq.tankinspection.data.local.db.InspectionBaselineEntity
import ai.laiq.tankinspection.data.local.db.InspectionComponentEntity
import ai.laiq.tankinspection.data.local.db.InspectionFindingEntity
import ai.laiq.tankinspection.data.local.db.InspectionMeasurementEntity
import ai.laiq.tankinspection.data.local.db.InspectionRecordEntity
import ai.laiq.tankinspection.data.local.db.InspectionTaskSnapshotEntity
import ai.laiq.tankinspection.data.local.db.LaiqFieldDatabase
import ai.laiq.tankinspection.data.local.db.LaiqFieldDatabaseMigrations
import ai.laiq.tankinspection.data.export.ExportedCanonicalPackage
import ai.laiq.tankinspection.domain.model.CanonicalInspectionPackage
import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.ProductScreen
import ai.laiq.tankinspection.presentation.isMaterialInspectionDraft
import ai.laiq.tankinspection.presentation.toCanonicalPackage
import android.content.Context
import androidx.room.Room
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.time.Instant

data class SavedAppSession(
    val currentScreen: ProductScreen,
    val draftState: FieldDraftState,
)

class AppSessionStore(
    context: Context,
) {
    private val reportPlatformEndpointKey = "report_platform_upload_endpoint"
    private val filesDir = context.filesDir
    private val legacySessionFile = File(filesDir, "laiq-field-session-v1.json")
    private val database = Room.databaseBuilder(
        context,
        LaiqFieldDatabase::class.java,
        "laiq-field-db",
    ).addMigrations(*LaiqFieldDatabaseMigrations.ALL).build()

    suspend fun load(): SavedAppSession? = withContext(Dispatchers.IO) {
        val currentSession = database.appSessionDao().get()
        val preferredInspectionId = currentSession?.activeInspectionId
        if (!preferredInspectionId.isNullOrBlank()) {
            val baseline = database.inspectionBaselineDao().getByInspection(preferredInspectionId)
            if (baseline != null && baseline.isStructuredRestoreReady()) {
                return@withContext restoreSavedSessionFromStructuredInspection(
                    currentSession = currentSession,
                    baseline = baseline,
                    components = database.inspectionComponentDao().listByInspection(preferredInspectionId),
                    measurements = database.inspectionMeasurementDao().listByInspection(preferredInspectionId),
                    findings = database.inspectionFindingDao().listByInspection(preferredInspectionId),
                    attachments = database.inspectionAttachmentDao().listByInspection(preferredInspectionId),
                )
            }
        }

        val fromDb = currentSession?.toSavedSession()
        if (fromDb != null) return@withContext fromDb

        val latestInspection = database.inspectionRecordDao().listAll().firstOrNull()

        if (latestInspection != null) {
            val baseline = database.inspectionBaselineDao().getByInspection(latestInspection.inspectionId)
            if (baseline != null) {
                return@withContext restoreSavedSessionFromStructuredInspection(
                    currentSession = currentSession,
                    baseline = baseline,
                    components = database.inspectionComponentDao().listByInspection(latestInspection.inspectionId),
                    measurements = database.inspectionMeasurementDao().listByInspection(latestInspection.inspectionId),
                    findings = database.inspectionFindingDao().listByInspection(latestInspection.inspectionId),
                    attachments = database.inspectionAttachmentDao().listByInspection(latestInspection.inspectionId),
                )
            }
        }

        if (!legacySessionFile.exists()) return@withContext null

        val migrated = runCatching {
            AppSessionJsonCodec.decode(legacySessionFile.readText())
        }.getOrNull() ?: return@withContext null

        val packagePreview = migrated.draftState.toCanonicalPackage()
        val activeInspectionId = packagePreview.inspection.inspectionId.takeIf { migrated.draftState.isMaterialInspectionDraft() }
        database.appSessionDao().upsert(
            AppSessionEntity(
                currentScreen = migrated.currentScreen.name,
                draftJson = AppSessionJsonCodec.encodeDraftState(migrated.draftState).toString(),
                activeInspectionId = activeInspectionId,
                updatedAtIso = Instant.now().toString(),
            ),
        )
        val nowIso = Instant.now().toString()
        if (migrated.draftState.isMaterialInspectionDraft()) {
            database.inspectionBaselineDao().upsert(migrated.draftState.toInspectionBaseline(packagePreview, nowIso))
            database.inspectionRecordDao().upsert(migrated.draftState.toInspectionRecord(packagePreview, nowIso))
            database.inspectionTaskSnapshotDao().upsertAll(
                migrated.draftState.toInspectionTaskSnapshots(packagePreview, nowIso),
            )
            database.inspectionComponentDao().replaceInspectionComponents(
                inspectionId = packagePreview.inspection.inspectionId,
                entities = migrated.draftState.toInspectionComponentEntities(packagePreview, nowIso),
            )
            database.inspectionMeasurementDao().replaceInspectionMeasurements(
                inspectionId = packagePreview.inspection.inspectionId,
                entities = migrated.draftState.toInspectionMeasurementEntities(packagePreview, nowIso),
            )
            database.inspectionFindingDao().replaceInspectionFindings(
                inspectionId = packagePreview.inspection.inspectionId,
                entities = migrated.draftState.toInspectionFindingEntities(packagePreview, nowIso),
            )
            database.inspectionAttachmentDao().replaceInspectionAttachments(
                inspectionId = packagePreview.inspection.inspectionId,
                entities = migrated.draftState.toInspectionAttachmentEntities(packagePreview, filesDir, nowIso),
            )
        }
        legacySessionFile.delete()
        migrated
    }

    suspend fun save(session: SavedAppSession) = withContext(Dispatchers.IO) {
        val nowIso = Instant.now().toString()
        val packagePreview = session.draftState.toCanonicalPackage()
        val activeInspectionId = packagePreview.inspection.inspectionId.takeIf { session.draftState.isMaterialInspectionDraft() }
        database.appSessionDao().upsert(
            AppSessionEntity(
                currentScreen = session.currentScreen.name,
                draftJson = AppSessionJsonCodec.encodeDraftState(session.draftState).toString(),
                activeInspectionId = activeInspectionId,
                updatedAtIso = nowIso,
            ),
        )
        if (session.draftState.isMaterialInspectionDraft()) {
            database.inspectionBaselineDao().upsert(session.draftState.toInspectionBaseline(packagePreview, nowIso))
            database.inspectionRecordDao().upsert(session.draftState.toInspectionRecord(packagePreview, nowIso))
            database.inspectionTaskSnapshotDao().upsertAll(
                session.draftState.toInspectionTaskSnapshots(packagePreview, nowIso),
            )
            database.inspectionComponentDao().replaceInspectionComponents(
                inspectionId = packagePreview.inspection.inspectionId,
                entities = session.draftState.toInspectionComponentEntities(packagePreview, nowIso),
            )
            database.inspectionMeasurementDao().replaceInspectionMeasurements(
                inspectionId = packagePreview.inspection.inspectionId,
                entities = session.draftState.toInspectionMeasurementEntities(packagePreview, nowIso),
            )
            database.inspectionFindingDao().replaceInspectionFindings(
                inspectionId = packagePreview.inspection.inspectionId,
                entities = session.draftState.toInspectionFindingEntities(packagePreview, nowIso),
            )
            database.inspectionAttachmentDao().replaceInspectionAttachments(
                inspectionId = packagePreview.inspection.inspectionId,
                entities = session.draftState.toInspectionAttachmentEntities(packagePreview, filesDir, nowIso),
            )
        }
    }

    suspend fun listInspections(): List<InspectionRecordEntity> = withContext(Dispatchers.IO) {
        filterRestorableInspectionRecords(
            records = database.inspectionRecordDao().listAll(),
            baselines = database.inspectionBaselineDao().listAll(),
        )
    }

    suspend fun loadInspection(inspectionId: String): SavedAppSession? = withContext(Dispatchers.IO) {
        val currentSession = database.appSessionDao().get()
        val baseline = database.inspectionBaselineDao().getByInspection(inspectionId) ?: return@withContext null
        if (!baseline.isStructuredRestoreReady()) return@withContext null
        val restored = restoreSavedSessionFromStructuredInspection(
            currentSession = currentSession?.takeIf { it.activeInspectionId == inspectionId },
            baseline = baseline,
            components = database.inspectionComponentDao().listByInspection(inspectionId),
            measurements = database.inspectionMeasurementDao().listByInspection(inspectionId),
            findings = database.inspectionFindingDao().listByInspection(inspectionId),
            attachments = database.inspectionAttachmentDao().listByInspection(inspectionId),
        )
        restored.copy(currentScreen = ProductScreen.TaskBoard)
    }

    suspend fun loadInspectionTaskSnapshots(inspectionId: String): List<InspectionTaskSnapshotEntity> = withContext(Dispatchers.IO) {
        database.inspectionTaskSnapshotDao().listByInspection(inspectionId)
    }

    suspend fun loadInspectionBaseline(inspectionId: String): InspectionBaselineEntity? = withContext(Dispatchers.IO) {
        database.inspectionBaselineDao().getByInspection(inspectionId)
    }

    suspend fun loadInspectionComponents(inspectionId: String): List<InspectionComponentEntity> = withContext(Dispatchers.IO) {
        database.inspectionComponentDao().listByInspection(inspectionId)
    }

    suspend fun loadInspectionMeasurements(inspectionId: String): List<InspectionMeasurementEntity> = withContext(Dispatchers.IO) {
        database.inspectionMeasurementDao().listByInspection(inspectionId)
    }

    suspend fun loadInspectionMeasurements(
        inspectionId: String,
        moduleKey: String,
    ): List<InspectionMeasurementEntity> = withContext(Dispatchers.IO) {
        database.inspectionMeasurementDao().listByInspectionAndModule(inspectionId, moduleKey)
    }

    suspend fun loadInspectionFindings(inspectionId: String): List<InspectionFindingEntity> = withContext(Dispatchers.IO) {
        database.inspectionFindingDao().listByInspection(inspectionId)
    }

    suspend fun loadInspectionAttachments(inspectionId: String): List<InspectionAttachmentEntity> = withContext(Dispatchers.IO) {
        database.inspectionAttachmentDao().listByInspection(inspectionId)
    }

    suspend fun recordExport(
        pkg: CanonicalInspectionPackage,
        exported: ExportedCanonicalPackage,
    ): ExportBundleEntity = withContext(Dispatchers.IO) {
        val nowIso = Instant.now().toString()
        val entity = ExportBundleEntity(
            exportId = "${pkg.packageId}-$nowIso",
            inspectionId = pkg.inspection.inspectionId,
            packageId = pkg.packageId,
            schemaVersion = pkg.schemaVersion,
            packageDirPath = exported.packageDir.absolutePath,
            zipFilePath = exported.zipFile.absolutePath,
            zipByteSize = exported.zipFile.length(),
            zipExists = exported.zipFile.exists(),
            attachmentCount = exported.copiedAttachments.size,
            missingAttachmentCount = exported.copiedAttachments.count { !it.existsInPackage },
            status = "exported",
            exportedAtIso = nowIso,
            uploadAttemptCount = 0,
            lastAttemptedAtIso = null,
            uploadedAtIso = null,
            lastError = null,
        )
        database.exportBundleDao().upsert(entity)
        entity
    }

    suspend fun recentExports(limit: Int = 5): List<ExportBundleEntity> = withContext(Dispatchers.IO) {
        database.exportBundleDao().listRecent(limit)
    }

    suspend fun markExportShared(exportId: String) = withContext(Dispatchers.IO) {
        val existing = database.exportBundleDao().get(exportId) ?: return@withContext
        database.exportBundleDao().updateUploadState(
            exportId = exportId,
            status = "shared",
            uploadedAtIso = existing.uploadedAtIso,
            uploadAttemptCount = existing.uploadAttemptCount,
            lastAttemptedAtIso = existing.lastAttemptedAtIso,
            lastError = existing.lastError,
        )
    }

    suspend fun markUploadStarted(exportId: String) = withContext(Dispatchers.IO) {
        val existing = database.exportBundleDao().get(exportId) ?: return@withContext
        database.exportBundleDao().updateUploadState(
            exportId = exportId,
            status = "uploading",
            uploadedAtIso = existing.uploadedAtIso,
            uploadAttemptCount = existing.uploadAttemptCount + 1,
            lastAttemptedAtIso = Instant.now().toString(),
            lastError = null,
        )
    }

    suspend fun markExportUploaded(exportId: String) = withContext(Dispatchers.IO) {
        val existing = database.exportBundleDao().get(exportId) ?: return@withContext
        database.exportBundleDao().updateUploadState(
            exportId = exportId,
            status = "uploaded",
            uploadedAtIso = Instant.now().toString(),
            uploadAttemptCount = existing.uploadAttemptCount,
            lastAttemptedAtIso = existing.lastAttemptedAtIso,
            lastError = null,
        )
    }

    suspend fun markUploadFailed(exportId: String, error: String) = withContext(Dispatchers.IO) {
        val existing = database.exportBundleDao().get(exportId) ?: return@withContext
        database.exportBundleDao().updateUploadState(
            exportId = exportId,
            status = "upload_failed",
            uploadedAtIso = existing.uploadedAtIso,
            uploadAttemptCount = existing.uploadAttemptCount,
            lastAttemptedAtIso = existing.lastAttemptedAtIso ?: Instant.now().toString(),
            lastError = error,
        )
    }

    suspend fun loadReportPlatformUploadEndpoint(): String = withContext(Dispatchers.IO) {
        database.appConfigDao().get(reportPlatformEndpointKey)?.configValue.orEmpty()
    }

    suspend fun saveReportPlatformUploadEndpoint(endpointUrl: String) = withContext(Dispatchers.IO) {
        database.appConfigDao().upsert(
            AppConfigEntity(
                configKey = reportPlatformEndpointKey,
                configValue = endpointUrl,
                updatedAtIso = Instant.now().toString(),
            ),
        )
    }
}

private suspend fun ai.laiq.tankinspection.data.local.db.InspectionAttachmentDao.replaceInspectionAttachments(
    inspectionId: String,
    entities: List<InspectionAttachmentEntity>,
) {
    if (entities.isEmpty()) {
        deleteAllByInspection(inspectionId)
        return
    }
    upsertAll(entities)
    deleteMissingByInspection(inspectionId, entities.map { it.attachmentId })
}

private suspend fun ai.laiq.tankinspection.data.local.db.InspectionComponentDao.replaceInspectionComponents(
    inspectionId: String,
    entities: List<InspectionComponentEntity>,
) {
    if (entities.isEmpty()) {
        deleteAllByInspection(inspectionId)
        return
    }
    upsertAll(entities)
    deleteMissingByInspection(inspectionId, entities.map { it.componentId })
}

private suspend fun ai.laiq.tankinspection.data.local.db.InspectionMeasurementDao.replaceInspectionMeasurements(
    inspectionId: String,
    entities: List<InspectionMeasurementEntity>,
) {
    if (entities.isEmpty()) {
        deleteAllByInspection(inspectionId)
        return
    }
    upsertAll(entities)
    deleteMissingByInspection(inspectionId, entities.map { it.measurementId })
}

private suspend fun ai.laiq.tankinspection.data.local.db.InspectionFindingDao.replaceInspectionFindings(
    inspectionId: String,
    entities: List<InspectionFindingEntity>,
) {
    if (entities.isEmpty()) {
        deleteAllByInspection(inspectionId)
        return
    }
    upsertAll(entities)
    deleteMissingByInspection(inspectionId, entities.map { it.findingId })
}

private fun AppSessionEntity.toSavedSession(): SavedAppSession? {
    val draftState = runCatching {
        AppSessionJsonCodec.decodeDraftState(AppSessionJsonCodec.parseObject(draftJson))
    }.getOrNull() ?: return null

    val currentScreen = runCatching {
        enumValueOf<ProductScreen>(currentScreen)
    }.getOrElse { ProductScreen.Setup }

    return SavedAppSession(
        currentScreen = currentScreen,
        draftState = draftState,
    )
}

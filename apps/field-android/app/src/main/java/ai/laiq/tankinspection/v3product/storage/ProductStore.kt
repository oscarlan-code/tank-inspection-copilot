package ai.laiq.tankinspection.v3product.storage

import ai.laiq.tankinspection.v3product.model.ProductDraftState
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularPlate
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularPlateLayout
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularPlateRow
import ai.laiq.tankinspection.v3product.model.ProductElementType
import ai.laiq.tankinspection.v3product.model.ProductFindingRecord
import ai.laiq.tankinspection.v3product.model.ProductInspectionChecklistCatalog
import ai.laiq.tankinspection.v3product.model.ProductLayoutSurface
import ai.laiq.tankinspection.v3product.model.ProductLayoutTarget
import ai.laiq.tankinspection.v3product.model.ProductUtItemKind
import ai.laiq.tankinspection.v3product.model.ProductUtMeasurementEntry
import ai.laiq.tankinspection.v3product.model.completedItemCount
import ai.laiq.tankinspection.v3product.model.customCircularLayoutFor
import ai.laiq.tankinspection.v3product.model.isComplete
import ai.laiq.tankinspection.v3product.model.placementsFor
import ai.laiq.tankinspection.v3product.model.requiredValidationErrors
import ai.laiq.tankinspection.v3product.model.requiresElementUt
import ai.laiq.tankinspection.v3product.model.selectedTargets
import ai.laiq.tankinspection.v3product.storage.db.ProductAttachmentEntity
import ai.laiq.tankinspection.v3product.storage.db.ProductChecklistItemEntity
import ai.laiq.tankinspection.v3product.storage.db.ProductChecklistSectionNoteEntity
import ai.laiq.tankinspection.v3product.storage.db.ProductElementEntity
import ai.laiq.tankinspection.v3product.storage.db.ProductExportPackageEntity
import ai.laiq.tankinspection.v3product.storage.db.ProductExportValidationResultEntity
import ai.laiq.tankinspection.v3product.storage.db.ProductFieldDatabase
import ai.laiq.tankinspection.v3product.storage.db.ProductFindingEntity
import ai.laiq.tankinspection.v3product.storage.db.ProductInspectionRecordEntity
import ai.laiq.tankinspection.v3product.storage.db.ProductInspectionTaskEntity
import ai.laiq.tankinspection.v3product.storage.db.ProductLayoutConfigEntity
import ai.laiq.tankinspection.v3product.storage.db.ProductLayoutTargetEntity
import ai.laiq.tankinspection.v3product.storage.db.ProductTaskAuditEventEntity
import ai.laiq.tankinspection.v3product.storage.db.ProductTaskSnapshotEntity
import ai.laiq.tankinspection.v3product.storage.db.ProductTenantEntity
import ai.laiq.tankinspection.v3product.storage.db.ProductUserProfileEntity
import ai.laiq.tankinspection.v3product.storage.db.ProductUtMeasurementEntity
import ai.laiq.tankinspection.v3product.storage.db.ProductVoiceNoteEntity
import ai.laiq.tankinspection.v3product.storage.db.ProductWorkspaceEntity
import android.content.Context
import android.provider.Settings
import androidx.room.Room
import androidx.room.withTransaction
import java.io.File
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.UUID
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject

class ProductStore(
    context: Context,
) {
    private val filesDir = context.filesDir
    private val deviceId = resolveDeviceId(context)
    private val database = Room.databaseBuilder(
        context.applicationContext,
        ProductFieldDatabase::class.java,
        "laiq-field-v3-product-db",
    )
        .addMigrations(ProductFieldDatabase.MIGRATION_1_2, ProductFieldDatabase.MIGRATION_2_3)
        .addMigrations(ProductFieldDatabase.MIGRATION_3_4, ProductFieldDatabase.MIGRATION_4_5)
        .addMigrations(ProductFieldDatabase.MIGRATION_5_6, ProductFieldDatabase.MIGRATION_6_7)
        .addMigrations(ProductFieldDatabase.MIGRATION_7_8)
        .build()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val saveMutex = Mutex()

    @Volatile
    var lastSaveError: Throwable? = null
        private set

    suspend fun ensureLocalProfile(): ProductLocalProfile =
        database.withTransaction {
            val nowIso = Instant.now().toString()
            val existingTenant = database.tenantDao().getDefault()
            val existingWorkspace = database.workspaceDao().getDefault()
            val existingUser = database.userProfileDao().getDefault()

            val tenant = ProductTenantEntity(
                tenantId = LOCAL_TENANT_ID,
                tenantName = existingTenant?.tenantName?.ifBlank { DEFAULT_TENANT_NAME } ?: DEFAULT_TENANT_NAME,
                isDefault = true,
                createdAtIso = existingTenant?.createdAtIso ?: nowIso,
                updatedAtIso = nowIso,
            )
            val workspace = ProductWorkspaceEntity(
                workspaceId = LOCAL_WORKSPACE_ID,
                tenantId = tenant.tenantId,
                workspaceName = existingWorkspace?.workspaceName?.ifBlank { DEFAULT_WORKSPACE_NAME } ?: DEFAULT_WORKSPACE_NAME,
                isDefault = true,
                createdAtIso = existingWorkspace?.createdAtIso ?: nowIso,
                updatedAtIso = nowIso,
            )
            val user = ProductUserProfileEntity(
                userId = LOCAL_USER_ID,
                tenantId = tenant.tenantId,
                workspaceId = workspace.workspaceId,
                displayName = existingUser?.displayName?.ifBlank { DEFAULT_USER_NAME } ?: DEFAULT_USER_NAME,
                roleCodes = existingUser?.roleCodes?.ifBlank { DEFAULT_ROLE_CODE } ?: DEFAULT_ROLE_CODE,
                deviceId = existingUser?.deviceId?.ifBlank { deviceId } ?: deviceId,
                isDefault = true,
                createdAtIso = existingUser?.createdAtIso ?: nowIso,
                updatedAtIso = nowIso,
            )

            database.tenantDao().upsert(tenant)
            database.workspaceDao().upsert(workspace)
            database.userProfileDao().upsert(user)

            tenant.toLocalProfile(workspace, user)
        }

    suspend fun updateLocalProfile(
        tenantName: String,
        workspaceName: String,
        displayName: String,
    ): ProductLocalProfile =
        database.withTransaction {
            val nowIso = Instant.now().toString()
            val existingTenant = database.tenantDao().getDefault()
            val existingWorkspace = database.workspaceDao().getDefault()
            val existingUser = database.userProfileDao().getDefault()
            val tenant = ProductTenantEntity(
                tenantId = LOCAL_TENANT_ID,
                tenantName = tenantName.trim().ifBlank { DEFAULT_TENANT_NAME },
                isDefault = true,
                createdAtIso = existingTenant?.createdAtIso ?: nowIso,
                updatedAtIso = nowIso,
            )
            val workspace = ProductWorkspaceEntity(
                workspaceId = LOCAL_WORKSPACE_ID,
                tenantId = tenant.tenantId,
                workspaceName = workspaceName.trim().ifBlank { DEFAULT_WORKSPACE_NAME },
                isDefault = true,
                createdAtIso = existingWorkspace?.createdAtIso ?: nowIso,
                updatedAtIso = nowIso,
            )
            val user = ProductUserProfileEntity(
                userId = LOCAL_USER_ID,
                tenantId = tenant.tenantId,
                workspaceId = workspace.workspaceId,
                displayName = displayName.trim().ifBlank { DEFAULT_USER_NAME },
                roleCodes = DEFAULT_ROLE_CODE,
                deviceId = existingUser?.deviceId?.ifBlank { deviceId } ?: deviceId,
                isDefault = true,
                createdAtIso = existingUser?.createdAtIso ?: nowIso,
                updatedAtIso = nowIso,
            )

            database.tenantDao().upsert(tenant)
            database.workspaceDao().upsert(workspace)
            database.userProfileDao().upsert(user)

            tenant.toLocalProfile(workspace, user)
        }

    suspend fun hasAnyTasks(): Boolean =
        database.inspectionTaskDao().countAll() > 0

    suspend fun listTaskSummaries(): List<ProductTaskSummary> =
        database.inspectionTaskDao().listAll().map { task -> task.toSummary() }

    suspend fun getTaskSummary(inspectionId: String): ProductTaskSummary? =
        database.inspectionTaskDao().get(inspectionId)?.toSummary()

    suspend fun getTaskIdentity(inspectionId: String): ProductTaskIdentity? =
        database.inspectionTaskDao().get(inspectionId)?.toIdentity()

    suspend fun listExportValidationChecks(inspectionId: String): List<ProductExportValidationCheck> =
        database.exportValidationResultDao().listByInspection(inspectionId).map { entity ->
            ProductExportValidationCheck(
                ruleCode = entity.ruleCode,
                ruleLabel = entity.ruleLabel,
                passed = entity.passed,
                blocksExport = entity.blocksExport,
                message = entity.message,
            )
        }

    suspend fun latestExportPackage(inspectionId: String): ProductExportPackageSummary? =
        database.exportPackageDao().latestByInspection(inspectionId)?.toSummary()

    suspend fun createInspectionTask(
        state: ProductDraftState,
        currentScreen: ProductWorkflowScreen,
    ): ProductTaskIdentity {
        check(state.generalTankInfo.requiredValidationErrors().isEmpty()) {
            "General tank information is incomplete."
        }
        val profile = ensureLocalProfile()
        val createdAtIso = Instant.now().toString()
        val identity = ProductTaskIdentity(
            inspectionId = UUID.randomUUID().toString(),
            inspectionReference = buildInspectionReference(state.generalTankInfo.tankNumber, createdAtIso),
            tenantId = profile.tenantId,
            workspaceId = profile.workspaceId,
            createdByUserId = profile.userId,
            lastEditedByUserId = profile.userId,
            deviceId = profile.deviceId,
            createdAtIso = createdAtIso,
        )
        saveNow(state, identity, currentScreen)
        recordAuditEvent(
            identity = identity,
            eventCode = "task_created",
            eventLabel = "Task Created",
            note = "Inspection task created after required setup was completed.",
        )
        return identity
    }

    suspend fun noteTaskContinued(inspectionId: String) {
        val identity = getTaskIdentity(inspectionId) ?: return
        recordAuditEvent(
            identity = identity,
            eventCode = "task_continued",
            eventLabel = "Task Continued",
            note = "Inspector continued this ongoing task from Task Home.",
        )
    }

    suspend fun archiveInspection(inspectionId: String) {
        database.withTransaction {
            val existing = database.inspectionTaskDao().get(inspectionId) ?: return@withTransaction
            if (existing.lifecycleState == ProductTaskLifecycle.ARCHIVED.key) return@withTransaction
            val nowIso = Instant.now().toString()
            database.inspectionTaskDao().upsert(
                existing.copy(
                    lifecycleState = ProductTaskLifecycle.ARCHIVED.key,
                    archivedAtIso = nowIso,
                    updatedAtIso = nowIso,
                ),
            )
            recordAuditEventInTransaction(
                identity = existing.toIdentity(),
                eventCode = "task_archived",
                eventLabel = "Task Archived",
                note = "Inspection archived from Task Home.",
                createdAtIso = nowIso,
                actorUserId = existing.lastEditedByUserId,
            )
        }
    }

    suspend fun deleteInspection(inspectionId: String) {
        val attachments = database.attachmentDao().listByInspection(inspectionId)
        val exportPackages = database.exportPackageDao().listByInspection(inspectionId)
        database.withTransaction {
            val task = database.inspectionTaskDao().get(inspectionId) ?: return@withTransaction
            check(task.exportedAtIso == null) {
                "Exported inspections require a manager override before deletion."
            }
            database.exportPackageDao().deleteAllByInspection(inspectionId)
            database.exportValidationResultDao().deleteAllByInspection(inspectionId)
            database.taskAuditEventDao().deleteAllByInspection(inspectionId)
            database.taskSnapshotDao().deleteAllByInspection(inspectionId)
            database.attachmentDao().deleteAllByInspection(inspectionId)
            database.voiceNoteDao().deleteAllByInspection(inspectionId)
            database.findingDao().deleteAllByInspection(inspectionId)
            database.checklistSectionNoteDao().deleteAllByInspection(inspectionId)
            database.checklistItemDao().deleteAllByInspection(inspectionId)
            database.utMeasurementDao().deleteAllByInspection(inspectionId)
            database.elementDao().deleteAllByInspection(inspectionId)
            database.layoutConfigDao().deleteAllByInspection(inspectionId)
            database.layoutTargetDao().deleteAllByInspection(inspectionId)
            database.inspectionRecordDao().deleteByInspection(inspectionId)
            database.inspectionTaskDao().deleteByInspection(inspectionId)
        }
        attachments.forEach { attachment ->
            File(filesDir, attachment.relativePath).takeIf { file -> file.exists() }?.delete()
        }
        exportPackages.forEach { exportPackage ->
            File(filesDir, exportPackage.fileRelativePath).takeIf { file -> file.exists() }?.delete()
        }
    }

    suspend fun importLegacyInspection(state: ProductDraftState): ProductTaskIdentity? {
        if (state.generalTankInfo.requiredValidationErrors().isNotEmpty()) return null
        if (hasAnyTasks()) return null
        return createInspectionTask(state, ProductWorkflowScreen.GENERAL_INFO)
    }

    suspend fun exportInspection(inspectionId: String): ProductExportPackageSummary {
        val profile = ensureLocalProfile()
        val createdAtIso = Instant.now().toString()
        val exportEntity = database.withTransaction {
            val task = database.inspectionTaskDao().get(inspectionId)
                ?: error("Inspection task not found.")
            val record = database.inspectionRecordDao().get(inspectionId)
                ?: error("Inspection record not found.")
            val validationResults = database.exportValidationResultDao().listByInspection(inspectionId)
            val blockingFailure = validationResults.firstOrNull { result -> result.blocksExport && !result.passed }
            check(blockingFailure == null) {
                blockingFailure?.message ?: "Export is blocked."
            }

            val layoutTargets = database.layoutTargetDao().listByInspection(inspectionId)
            val layoutConfigs = database.layoutConfigDao().listByInspection(inspectionId)
            val elements = database.elementDao().listByInspection(inspectionId)
            val utMeasurements = database.utMeasurementDao().listByInspection(inspectionId)
            val checklistItems = database.checklistItemDao().listByInspection(inspectionId)
            val checklistSectionNotes = database.checklistSectionNoteDao().listByInspection(inspectionId)
            val findings = database.findingDao().listByInspection(inspectionId)
            val voiceNotes = database.voiceNoteDao().listByInspection(inspectionId)
            val attachments = database.attachmentDao().listByInspection(inspectionId)
            val taskSnapshots = database.taskSnapshotDao().listByInspection(inspectionId)

            val exportPackageId = UUID.randomUUID().toString()
            val relativePath = buildExportRelativePath(inspectionId, createdAtIso)
            val exportJson = buildExportPackageJson(
                task = task,
                record = record,
                profile = profile,
                layoutTargets = layoutTargets,
                layoutConfigs = layoutConfigs,
                elements = elements,
                utMeasurements = utMeasurements,
                checklistItems = checklistItems,
                checklistSectionNotes = checklistSectionNotes,
                findings = findings,
                voiceNotes = voiceNotes,
                attachments = attachments,
                taskSnapshots = taskSnapshots,
                validationResults = validationResults,
                exportedByUserId = profile.userId,
                exportedAtIso = createdAtIso,
                schemaVersion = EXPORT_PACKAGE_SCHEMA_VERSION,
            )
            val outputFile = File(filesDir, relativePath)
            outputFile.parentFile?.mkdirs()
            outputFile.writeText(exportJson.toString(2), Charsets.UTF_8)
            val fileSize = outputFile.takeIf { file -> file.exists() }?.length()

            val exportEntity = ProductExportPackageEntity(
                exportPackageId = exportPackageId,
                inspectionId = inspectionId,
                tenantId = task.tenantId,
                workspaceId = task.workspaceId,
                inspectionReference = task.inspectionReference,
                createdByUserId = task.createdByUserId,
                lastEditedByUserId = profile.userId,
                exportedByUserId = profile.userId,
                deviceId = task.deviceId,
                schemaVersion = EXPORT_PACKAGE_SCHEMA_VERSION,
                validationStatusCode = "exported",
                validationStatusLabel = "Exported",
                fileRelativePath = relativePath,
                fileByteSize = fileSize,
                attachmentCount = attachments.size,
                findingCount = findings.size,
                exportedAtIso = createdAtIso,
                createdAtIso = createdAtIso,
                updatedAtIso = createdAtIso,
            )
            database.exportPackageDao().upsert(exportEntity)
            database.inspectionTaskDao().upsert(
                task.copy(
                    lastEditedByUserId = profile.userId,
                    exportStatusCode = "exported",
                    exportStatusLabel = "Exported",
                    exportedAtIso = createdAtIso,
                    updatedAtIso = createdAtIso,
                ),
            )
            recordAuditEventInTransaction(
                identity = task.toIdentity(),
                eventCode = "task_exported",
                eventLabel = "Task Exported",
                note = "Canonical export package generated for report handoff.",
                createdAtIso = createdAtIso,
                actorUserId = profile.userId,
            )
            exportEntity
        }
        return exportEntity.toSummary()
    }

    fun saveAsync(
        state: ProductDraftState,
        identity: ProductTaskIdentity,
        currentScreen: ProductWorkflowScreen,
    ) {
        val snapshot = state
        scope.launch {
            saveMutex.withLock {
                runCatching { save(snapshot, identity, currentScreen) }
                    .onSuccess { lastSaveError = null }
                    .onFailure { error -> lastSaveError = error }
            }
        }
    }

    suspend fun saveNow(
        state: ProductDraftState,
        identity: ProductTaskIdentity,
        currentScreen: ProductWorkflowScreen,
    ) {
        saveMutex.withLock {
            runCatching { save(state, identity, currentScreen) }
                .onSuccess { lastSaveError = null }
                .onFailure { error ->
                    lastSaveError = error
                    throw error
                }
        }
    }

    private suspend fun save(
        state: ProductDraftState,
        identity: ProductTaskIdentity,
        currentScreen: ProductWorkflowScreen,
    ) {
        val nowIso = Instant.now().toString()
        val targets = ProductLayoutTarget.entries
        val attachments = state.toAttachmentEntities(identity.inspectionId, nowIso)
        val voiceNotes = state.toVoiceNoteEntities(identity.inspectionId, nowIso)
        val checklistItems = state.toChecklistItemEntities(identity.inspectionId, nowIso)
        val checklistSectionNotes = state.toChecklistSectionNoteEntities(identity.inspectionId, nowIso)
        val snapshots = state.toTaskSnapshots(identity.inspectionId, nowIso, attachments)
        val validationResults = state.toExportValidationResults(identity, nowIso, attachments)
        val readiness = deriveTaskReadiness(state, snapshots, validationResults)
        database.withTransaction {
            val existingTask = database.inspectionTaskDao().get(identity.inspectionId)
            database.inspectionTaskDao().upsert(
                state.toInspectionTask(
                    identity = identity,
                    existingTask = existingTask,
                    currentScreen = currentScreen,
                    readiness = readiness,
                    nowIso = nowIso,
                ),
            )
            database.inspectionRecordDao().upsert(state.toInspectionRecord(identity, nowIso))
            database.layoutTargetDao().replaceAll(identity.inspectionId, state.toLayoutTargetEntities(identity.inspectionId, nowIso, targets))
            database.layoutConfigDao().replaceAll(identity.inspectionId, state.toLayoutConfigEntities(identity.inspectionId, nowIso, targets))
            database.elementDao().replaceAll(identity.inspectionId, state.toElementEntities(identity.inspectionId, nowIso))
            database.utMeasurementDao().replaceAll(identity.inspectionId, state.toUtMeasurementEntities(identity.inspectionId, nowIso))
            database.checklistItemDao().replaceAll(identity.inspectionId, checklistItems)
            database.checklistSectionNoteDao().replaceAll(identity.inspectionId, checklistSectionNotes)
            database.findingDao().replaceAll(identity.inspectionId, state.toFindingEntities(identity.inspectionId, nowIso, attachments))
            database.voiceNoteDao().replaceAll(identity.inspectionId, voiceNotes)
            database.attachmentDao().replaceAll(identity.inspectionId, attachments)
            database.taskSnapshotDao().replaceAll(identity.inspectionId, snapshots)
            database.exportValidationResultDao().replaceAll(identity.inspectionId, validationResults)
        }
    }

    private suspend fun recordAuditEvent(
        identity: ProductTaskIdentity,
        eventCode: String,
        eventLabel: String,
        note: String?,
    ) {
        database.withTransaction {
            recordAuditEventInTransaction(
                identity = identity,
                eventCode = eventCode,
                eventLabel = eventLabel,
                note = note,
                createdAtIso = Instant.now().toString(),
                actorUserId = identity.lastEditedByUserId,
            )
        }
    }

    private suspend fun recordAuditEventInTransaction(
        identity: ProductTaskIdentity,
        eventCode: String,
        eventLabel: String,
        note: String?,
        createdAtIso: String,
        actorUserId: String,
    ) {
        database.taskAuditEventDao().insert(
            ProductTaskAuditEventEntity(
                auditEventId = UUID.randomUUID().toString(),
                inspectionId = identity.inspectionId,
                tenantId = identity.tenantId,
                workspaceId = identity.workspaceId,
                inspectionReference = identity.inspectionReference,
                actorUserId = actorUserId,
                eventCode = eventCode,
                eventLabel = eventLabel,
                note = note,
                createdAtIso = createdAtIso,
            ),
        )
    }

    private fun ProductTenantEntity.toLocalProfile(
        workspace: ProductWorkspaceEntity,
        user: ProductUserProfileEntity,
    ): ProductLocalProfile =
        ProductLocalProfile(
            tenantId = tenantId,
            tenantName = tenantName,
            workspaceId = workspace.workspaceId,
            workspaceName = workspace.workspaceName,
            userId = user.userId,
            displayName = user.displayName,
            roleLabel = user.roleCodes,
            deviceId = user.deviceId,
        )

    private fun ProductInspectionTaskEntity.toIdentity(): ProductTaskIdentity =
        ProductTaskIdentity(
            inspectionId = inspectionId,
            inspectionReference = inspectionReference,
            tenantId = tenantId,
            workspaceId = workspaceId,
            createdByUserId = createdByUserId,
            lastEditedByUserId = lastEditedByUserId,
            deviceId = deviceId,
            createdAtIso = createdAtIso,
        )

    private fun ProductInspectionTaskEntity.toSummary(): ProductTaskSummary =
        ProductTaskSummary(
            inspectionId = inspectionId,
            inspectionReference = inspectionReference,
            client = client,
            tankNumber = tankNumber,
            location = location,
            lifecycle = if (lifecycleState == ProductTaskLifecycle.ARCHIVED.key) {
                ProductTaskLifecycle.ARCHIVED
            } else {
                ProductTaskLifecycle.ONGOING
            },
            currentScreen = ProductWorkflowScreen.fromKey(currentScreenKey),
            readinessStatusCode = readinessStatusCode,
            readinessStatusLabel = readinessStatusLabel,
            exportStatusCode = exportStatusCode,
            exportStatusLabel = exportStatusLabel,
            updatedAtIso = updatedAtIso,
        )

    private fun ProductExportPackageEntity.toSummary(): ProductExportPackageSummary =
        ProductExportPackageSummary(
            exportPackageId = exportPackageId,
            inspectionId = inspectionId,
            inspectionReference = inspectionReference,
            schemaVersion = schemaVersion,
            exportedByUserId = exportedByUserId,
            exportedAtIso = exportedAtIso,
            fileRelativePath = fileRelativePath,
            fileByteSize = fileByteSize,
            validationStatusCode = validationStatusCode,
            validationStatusLabel = validationStatusLabel,
        )

    private fun ProductDraftState.toInspectionTask(
        identity: ProductTaskIdentity,
        existingTask: ProductInspectionTaskEntity?,
        currentScreen: ProductWorkflowScreen,
        readiness: ProductTaskReadiness,
        nowIso: String,
    ): ProductInspectionTaskEntity {
        val exportStatus = when {
            existingTask?.exportedAtIso != null -> "stale_export" to "Updated since export"
            readiness.code == "ready" -> "ready_to_export" to "Ready to export"
            else -> "not_exported" to "Not exported"
        }
        return ProductInspectionTaskEntity(
            inspectionId = identity.inspectionId,
            inspectionReference = identity.inspectionReference,
            tenantId = identity.tenantId,
            workspaceId = identity.workspaceId,
            createdByUserId = identity.createdByUserId,
            lastEditedByUserId = identity.lastEditedByUserId,
            deviceId = identity.deviceId,
            client = generalTankInfo.client,
            tankNumber = generalTankInfo.tankNumber,
            location = generalTankInfo.location,
            lifecycleState = existingTask?.lifecycleState ?: ProductTaskLifecycle.ONGOING.key,
            currentScreenKey = currentScreen.key,
            currentScreenLabel = currentScreen.label,
            readinessStatusCode = readiness.code,
            readinessStatusLabel = readiness.label,
            exportStatusCode = exportStatus.first,
            exportStatusLabel = exportStatus.second,
            archivedAtIso = existingTask?.archivedAtIso,
            exportedAtIso = existingTask?.exportedAtIso,
            createdAtIso = identity.createdAtIso,
            updatedAtIso = nowIso,
        )
    }

    private fun ProductDraftState.toInspectionRecord(
        identity: ProductTaskIdentity,
        nowIso: String,
    ): ProductInspectionRecordEntity =
        ProductInspectionRecordEntity(
            inspectionId = identity.inspectionId,
            tenantId = identity.tenantId,
            workspaceId = identity.workspaceId,
            inspectionReference = identity.inspectionReference,
            createdByUserId = identity.createdByUserId,
            lastEditedByUserId = identity.lastEditedByUserId,
            deviceId = identity.deviceId,
            schemaVersion = EXPORT_PACKAGE_SCHEMA_VERSION,
            client = generalTankInfo.client,
            tankNumber = generalTankInfo.tankNumber,
            location = generalTankInfo.location,
            fieldLeaseName = generalTankInfo.fieldLeaseName,
            inspector = generalTankInfo.inspector,
            externalRoofType = generalTankInfo.externalRoofType,
            internalRoofType = generalTankInfo.internalRoofType,
            referenceMode = layoutMapSetup.referenceMode.key,
            referenceNote = layoutMapSetup.referenceNote,
            diameterM = generalTankInfo.diameter.toPositiveDoubleOrNull(),
            heightM = generalTankInfo.height.toPositiveDoubleOrNull(),
            shellCourseCount = generalTankInfo.courseNumber.toPositiveIntOrNull(),
            shellLaneCount = layoutMapSetup.shellLaneCount.toPositiveIntOrNull(),
            reviewStatus = if (generalTankInfo.requiredValidationErrors().isEmpty()) {
                "draft_ready"
            } else {
                "draft_incomplete"
            },
            createdAtIso = identity.createdAtIso,
            updatedAtIso = nowIso,
        )

    private fun ProductDraftState.toLayoutTargetEntities(
        inspectionId: String,
        nowIso: String,
        targets: List<ProductLayoutTarget>,
    ): List<ProductLayoutTargetEntity> {
        val layoutTargets = layoutScope.selectedTargets().toSet()
        val elementTargets = elementSetup.selectedTargets().toSet()
        val utTargets = utSetup.selectedTargets().toSet()
        return targets.map { target ->
            ProductLayoutTargetEntity(
                inspectionId = inspectionId,
                targetKey = target.key,
                targetLabel = target.label,
                surfaceKey = target.surface.key,
                inLayoutScope = target in layoutTargets,
                layoutApproved = target in layoutMapSetup.approvedTargets,
                elementInScope = target in elementTargets,
                elementApproved = target in elementPlacement.approvedTargets,
                utInScope = target in utTargets,
                utApproved = target in utMeasurements.approvedTargets,
                updatedAtIso = nowIso,
            )
        }
    }

    private fun ProductDraftState.toLayoutConfigEntities(
        inspectionId: String,
        nowIso: String,
        targets: List<ProductLayoutTarget>,
    ): List<ProductLayoutConfigEntity> =
        targets.map { target ->
            ProductLayoutConfigEntity(
                inspectionId = inspectionId,
                targetKey = target.key,
                surfaceKey = target.surface.key,
                referenceMode = layoutMapSetup.referenceMode.key,
                referenceNote = layoutMapSetup.referenceNote,
                roofPattern = layoutMapSetup.roofPattern.name.takeIf { target.surface == ProductLayoutSurface.ROOF },
                roofRingCount = layoutMapSetup.roofRingCount.toPositiveIntOrNull().takeIf { target.surface == ProductLayoutSurface.ROOF },
                roofSectorCount = layoutMapSetup.roofSectorCount.toPositiveIntOrNull().takeIf { target.surface == ProductLayoutSurface.ROOF },
                roofRowCount = layoutMapSetup.roofRowCount.toPositiveIntOrNull().takeIf { target.surface == ProductLayoutSurface.ROOF },
                roofWidestRowPlateCount = layoutMapSetup.roofWidestRowPlateCount.toPositiveIntOrNull()
                    .takeIf { target.surface == ProductLayoutSurface.ROOF },
                roofHasCenterOpening = layoutMapSetup.roofHasCenterOpening.takeIf { target.surface == ProductLayoutSurface.ROOF },
                roofHasAnnularRing = layoutMapSetup.roofHasAnnularRing.takeIf { target.surface == ProductLayoutSurface.ROOF },
                roofAnnularSectionCount = layoutMapSetup.roofAnnularSectionCount.toPositiveIntOrNull()
                    .takeIf { target.surface == ProductLayoutSurface.ROOF },
                shellCourseCount = layoutMapSetup.shellCourseCount.toPositiveIntOrNull().takeIf { target.surface == ProductLayoutSurface.SHELL },
                shellPlatesPerCourse = layoutMapSetup.shellPlatesPerCourse.toPositiveIntOrNull()
                    .takeIf { target.surface == ProductLayoutSurface.SHELL },
                shellLaneCount = layoutMapSetup.shellLaneCount.toPositiveIntOrNull().takeIf { target.surface == ProductLayoutSurface.SHELL },
                shellPlateOffset = layoutMapSetup.shellPlateOffset.takeIf { target.surface == ProductLayoutSurface.SHELL },
                shellOffsetStartRow = layoutMapSetup.shellOffsetStartRow.key.takeIf { target.surface == ProductLayoutSurface.SHELL },
                shellThirdOffsetStart = layoutMapSetup.shellThirdOffsetStart.key.takeIf { target.surface == ProductLayoutSurface.SHELL },
                floorTemplate = layoutMapSetup.floorTemplate.key.takeIf { target.surface == ProductLayoutSurface.FLOOR },
                floorPlateCount = layoutMapSetup.floorPlateCount.toPositiveIntOrNull().takeIf { target.surface == ProductLayoutSurface.FLOOR },
                floorAnnularSectionCount = layoutMapSetup.floorAnnularSectionCount.toPositiveIntOrNull()
                    .takeIf { target.surface == ProductLayoutSurface.FLOOR },
                floorPatternCountX = layoutMapSetup.floorPatternCountX.toPositiveIntOrNull().takeIf { target.surface == ProductLayoutSurface.FLOOR },
                floorPatternCountY = layoutMapSetup.floorPatternCountY.toPositiveIntOrNull().takeIf { target.surface == ProductLayoutSurface.FLOOR },
                customCircularLayoutJson = layoutMapSetup.customCircularLayoutFor(target)?.toCustomCircularLayoutJson(),
                updatedAtIso = nowIso,
            )
        }

    private fun ProductDraftState.toElementEntities(
        inspectionId: String,
        nowIso: String,
    ): List<ProductElementEntity> =
        ProductLayoutTarget.entries.flatMap { target ->
            elementPlacement.placementsFor(target).map { element ->
                ProductElementEntity(
                    inspectionId = inspectionId,
                    targetKey = target.key,
                    elementId = element.id,
                    elementLabel = element.label,
                    elementTypeKey = element.type.key,
                    normalizedX = element.normalizedX,
                    normalizedY = element.normalizedY,
                    updatedAtIso = nowIso,
                )
            }
        }

    private fun ProductDraftState.toUtMeasurementEntities(
        inspectionId: String,
        nowIso: String,
    ): List<ProductUtMeasurementEntity> =
        utMeasurements.entriesByItemKey.values
            .sortedWith(compareBy<ProductUtMeasurementEntry> { it.target.key }.thenBy { it.itemKey })
            .map { entry ->
                val readings = entry.readings.map { reading -> reading.trim().toDoubleOrNull() }
                val laneCourse = entry.itemLabel.toLaneCourse()
                ProductUtMeasurementEntity(
                    inspectionId = inspectionId,
                    itemKey = entry.itemKey,
                    targetKey = entry.target.key,
                    itemLabel = entry.itemLabel,
                    itemKind = entry.kind.name,
                    elementTypeKey = entry.elementType?.key,
                    nozzleSize = entry.nozzleSize.takeIf { entry.requiresElementUt() },
                    reinforcementPadReading = entry.reinforcementPadReading.trim().toDoubleOrNull()
                        .takeIf { entry.requiresElementUt() },
                    laneId = laneCourse?.laneId,
                    course = laneCourse?.course,
                    plateId = entry.itemLabel.takeIf { entry.kind == ProductUtItemKind.LAYOUT_REGION && laneCourse == null },
                    elementId = entry.elementId(),
                    confirmed = entry.confirmed,
                    measured = entry.hasPositiveReading(),
                    value1 = readings.getOrNull(0),
                    value2 = readings.getOrNull(1),
                    value3 = readings.getOrNull(2),
                    value4 = readings.getOrNull(3),
                    value5 = readings.getOrNull(4),
                    updatedAtIso = nowIso,
                )
            }

    private fun ProductDraftState.toChecklistItemEntities(
        inspectionId: String,
        nowIso: String,
    ): List<ProductChecklistItemEntity> =
        ProductInspectionChecklistCatalog.sections.flatMap { section ->
            section.items.mapNotNull { item ->
                val rating = inspectionChecklist.ratingsByItemNumber[item.number] ?: return@mapNotNull null
                ProductChecklistItemEntity(
                    inspectionId = inspectionId,
                    sectionKey = section.key,
                    sectionTitle = section.title,
                    itemNumber = item.number,
                    itemPrompt = item.prompt,
                    ratingKey = rating.key,
                    ratingLabel = rating.label,
                    itemNote = inspectionChecklist.itemNotesByItemNumber[item.number]?.trim()?.ifBlank { null },
                    updatedAtIso = nowIso,
                )
            }
        }

    private fun ProductDraftState.toChecklistSectionNoteEntities(
        inspectionId: String,
        nowIso: String,
    ): List<ProductChecklistSectionNoteEntity> =
        ProductInspectionChecklistCatalog.sections.mapNotNull { section ->
            val note = inspectionChecklist.sectionComments[section.key]?.trim().orEmpty()
            if (note.isBlank()) return@mapNotNull null
            ProductChecklistSectionNoteEntity(
                inspectionId = inspectionId,
                sectionKey = section.key,
                sectionTitle = section.title,
                note = note,
                updatedAtIso = nowIso,
            )
        }

    private fun ProductDraftState.toFindingEntities(
        inspectionId: String,
        nowIso: String,
        attachments: List<ProductAttachmentEntity>,
    ): List<ProductFindingEntity> {
        val missingByFinding = attachments
            .groupBy { attachment -> attachment.findingId }
            .mapValues { (_, items) -> items.any { attachment -> !attachment.fileExists } }
        return findingState.findingsByItemKey.values
            .filter { finding -> finding.hasFieldEvidence() }
            .sortedBy { finding -> finding.itemKey }
            .map { finding ->
                ProductFindingEntity(
                    inspectionId = inspectionId,
                    findingId = finding.itemKey,
                    targetKey = finding.target.key,
                    itemLabel = finding.itemLabel,
                    itemKind = finding.itemKind.name,
                    elementTypeKey = finding.elementType?.key,
                    linkedUtItemKey = finding.itemKey,
                    note = finding.note.ifBlank { null },
                    attachmentCount = finding.photos.size,
                    hasMissingAttachment = missingByFinding[finding.itemKey] == true,
                    updatedAtIso = nowIso,
                )
            }
    }

    private fun ProductDraftState.toAttachmentEntities(
        inspectionId: String,
        nowIso: String,
    ): List<ProductAttachmentEntity> {
        val findingAttachments = findingState.findingsByItemKey.values
            .filter { finding -> finding.hasFieldEvidence() }
            .flatMap { finding ->
                finding.photos.map { photo ->
                    val file = File(filesDir, photo.relativePath)
                    ProductAttachmentEntity(
                        inspectionId = inspectionId,
                        attachmentId = "${finding.itemKey}:${photo.id}",
                        findingId = finding.itemKey,
                        kind = "finding_photo",
                        relativePath = photo.relativePath,
                        displayName = photo.displayName,
                        mediaType = photo.relativePath.inferredImageMediaType(),
                        fileByteSize = file.takeIf { it.exists() }?.length(),
                        fileExists = file.exists() && file.length() > 0L,
                        annotationStrokeCount = photo.annotationStrokes.size,
                        annotationPointCount = photo.annotationStrokes.sumOf { stroke -> stroke.points.size },
                        updatedAtIso = nowIso,
                    )
                }
            }
        val voiceAttachments = voiceNotes.map { note ->
            val file = File(filesDir, note.relativePath)
            ProductAttachmentEntity(
                inspectionId = inspectionId,
                attachmentId = "voice:${note.id}",
                findingId = note.itemKey ?: note.screenKey,
                kind = "voice_audio",
                relativePath = note.relativePath,
                displayName = note.displayName,
                mediaType = note.relativePath.inferredVoiceMediaType(),
                fileByteSize = file.takeIf { it.exists() }?.length(),
                fileExists = file.exists() && file.length() > 0L,
                annotationStrokeCount = 0,
                annotationPointCount = 0,
                updatedAtIso = nowIso,
            )
        }
        return findingAttachments + voiceAttachments
    }

    private fun ProductDraftState.toVoiceNoteEntities(
        inspectionId: String,
        nowIso: String,
    ): List<ProductVoiceNoteEntity> =
        voiceNotes.map { note ->
            val file = File(filesDir, note.relativePath)
            ProductVoiceNoteEntity(
                inspectionId = inspectionId,
                voiceNoteId = note.id,
                relativePath = note.relativePath,
                displayName = note.displayName,
                screenKey = note.screenKey,
                screenLabel = note.screenLabel,
                cardKey = note.cardKey,
                fieldKey = note.fieldKey,
                targetKey = note.targetKey,
                targetLabel = note.targetLabel,
                itemKey = note.itemKey,
                itemLabel = note.itemLabel,
                transcriptStatus = note.transcriptStatus,
                transcriptText = note.transcriptText.ifBlank { null },
                durationMs = note.durationMs,
                mediaType = note.relativePath.inferredVoiceMediaType(),
                fileByteSize = file.takeIf { it.exists() }?.length(),
                fileExists = file.exists() && file.length() > 0L,
                capturedAtIso = note.capturedAtIso,
                updatedAtIso = nowIso,
            )
        }

    private fun ProductDraftState.toTaskSnapshots(
        inspectionId: String,
        nowIso: String,
        attachments: List<ProductAttachmentEntity>,
    ): List<ProductTaskSnapshotEntity> {
        val selectedLayoutTargets = layoutScope.selectedTargets()
        val approvedLayouts = selectedLayoutTargets.count { target -> target in layoutMapSetup.approvedTargets }
        val selectedUtTargets = utSetup.selectedTargets().filter { target -> target in layoutMapSetup.approvedTargets }
        val measuredCount = utMeasurements.entriesByItemKey.values.count { entry -> entry.hasPositiveReading() }
        val checklistCompletedCount = inspectionChecklist.completedItemCount()
        val checklistTotalCount = ProductInspectionChecklistCatalog.totalItemCount
        val checklistComplete = inspectionChecklist.isComplete()
        val findingCount = findingState.findingsByItemKey.values.count { finding -> finding.hasFieldEvidence() }
        val missingAttachmentCount = attachments.count { attachment -> !attachment.fileExists }
        return listOf(
            ProductTaskSnapshotEntity(
                inspectionId = inspectionId,
                taskKey = "general_info",
                taskTitle = "General Tank Information",
                taskOrder = 10,
                inScope = true,
                statusCode = if (generalTankInfo.requiredValidationErrors().isEmpty()) "complete" else "incomplete",
                statusLabel = if (generalTankInfo.requiredValidationErrors().isEmpty()) "Complete" else "Incomplete",
                isComplete = generalTankInfo.requiredValidationErrors().isEmpty(),
                blocksExport = generalTankInfo.requiredValidationErrors().isNotEmpty(),
                entryCount = 1,
                referenceCount = 0,
                updatedAtIso = nowIso,
            ),
            ProductTaskSnapshotEntity(
                inspectionId = inspectionId,
                taskKey = "layout_maps",
                taskTitle = "Layout Maps",
                taskOrder = 20,
                inScope = selectedLayoutTargets.isNotEmpty(),
                statusCode = if (approvedLayouts == selectedLayoutTargets.size && selectedLayoutTargets.isNotEmpty()) {
                    "complete"
                } else {
                    "in_progress"
                },
                statusLabel = "$approvedLayouts/${selectedLayoutTargets.size} approved",
                isComplete = approvedLayouts == selectedLayoutTargets.size && selectedLayoutTargets.isNotEmpty(),
                blocksExport = approvedLayouts == 0,
                entryCount = approvedLayouts,
                referenceCount = selectedLayoutTargets.size,
                updatedAtIso = nowIso,
            ),
            ProductTaskSnapshotEntity(
                inspectionId = inspectionId,
                taskKey = "ut_measurements",
                taskTitle = "UT Measurements",
                taskOrder = 30,
                inScope = selectedUtTargets.isNotEmpty(),
                statusCode = if (utMeasurements.approvedTargets.containsAll(selectedUtTargets)) "complete" else "in_progress",
                statusLabel = "$measuredCount measured points",
                isComplete = utMeasurements.approvedTargets.containsAll(selectedUtTargets),
                blocksExport = false,
                entryCount = measuredCount,
                referenceCount = utMeasurements.entriesByItemKey.size,
                updatedAtIso = nowIso,
            ),
            ProductTaskSnapshotEntity(
                inspectionId = inspectionId,
                taskKey = "inspection_checklist",
                taskTitle = "Inspection Checklist",
                taskOrder = 35,
                inScope = true,
                statusCode = if (checklistComplete) "complete" else "in_progress",
                statusLabel = "$checklistCompletedCount/$checklistTotalCount rated",
                isComplete = checklistComplete,
                blocksExport = !checklistComplete,
                entryCount = checklistCompletedCount,
                referenceCount = checklistTotalCount,
                updatedAtIso = nowIso,
            ),
            ProductTaskSnapshotEntity(
                inspectionId = inspectionId,
                taskKey = "findings",
                taskTitle = "Findings",
                taskOrder = 40,
                inScope = findingCount > 0,
                statusCode = if (missingAttachmentCount == 0) "complete" else "blocked_missing_attachment",
                statusLabel = if (missingAttachmentCount == 0) {
                    "$findingCount findings"
                } else {
                    "$missingAttachmentCount missing photos"
                },
                isComplete = missingAttachmentCount == 0,
                blocksExport = missingAttachmentCount > 0,
                entryCount = findingCount,
                referenceCount = attachments.size,
                updatedAtIso = nowIso,
            ),
        )
    }

    private fun ProductDraftState.toExportValidationResults(
        identity: ProductTaskIdentity,
        nowIso: String,
        attachments: List<ProductAttachmentEntity>,
    ): List<ProductExportValidationResultEntity> {
        val selectedLayoutTargets = layoutScope.selectedTargets()
        val elementTargets = elementSetup.selectedTargets()
        val utTargets = utSetup.selectedTargets().filter { target -> target in layoutMapSetup.approvedTargets }
        val checklistCompletedCount = inspectionChecklist.completedItemCount()
        val checklistTotalCount = ProductInspectionChecklistCatalog.totalItemCount
        val findings = findingState.findingsByItemKey.values.filter { finding -> finding.hasFieldEvidence() }
        val allFindingsLinked = findings.all { finding ->
            finding.itemKey.isNotBlank() && finding.itemLabel.isNotBlank()
        }
        val validations = listOf(
            ProductExportValidationRule(
                ruleCode = "general_info_complete",
                ruleLabel = "General info complete",
                passed = generalTankInfo.requiredValidationErrors().isEmpty(),
                blocksExport = true,
                message = if (generalTankInfo.requiredValidationErrors().isEmpty()) {
                    "Required general tank information is complete."
                } else {
                    "Complete client, tank, location, geometry, and roof presence before export."
                },
            ),
            ProductExportValidationRule(
                ruleCode = "layout_maps_approved",
                ruleLabel = "Layout maps approved",
                passed = selectedLayoutTargets.isNotEmpty() &&
                    selectedLayoutTargets.all { target -> target in layoutMapSetup.approvedTargets },
                blocksExport = true,
                message = if (selectedLayoutTargets.isNotEmpty() &&
                    selectedLayoutTargets.all { target -> target in layoutMapSetup.approvedTargets }) {
                    "All layout maps in scope are approved."
                } else {
                    "Approve every layout map in scope before export."
                },
            ),
            ProductExportValidationRule(
                ruleCode = "element_placement_approved",
                ruleLabel = "Element placement approved",
                passed = elementTargets.isEmpty() ||
                    elementTargets.all { target -> target in elementPlacement.approvedTargets },
                blocksExport = true,
                message = if (elementTargets.isEmpty() ||
                    elementTargets.all { target -> target in elementPlacement.approvedTargets }) {
                    "Element placement is approved where required."
                } else {
                    "Approve element placement for every target in element scope."
                },
            ),
            ProductExportValidationRule(
                ruleCode = "ut_decisions_saved",
                ruleLabel = "UT decisions saved",
                passed = utTargets.isEmpty() ||
                    utTargets.all { target -> target in utMeasurements.approvedTargets },
                blocksExport = true,
                message = if (utTargets.isEmpty() ||
                    utTargets.all { target -> target in utMeasurements.approvedTargets }) {
                    "UT scope decisions and confirmations are saved."
                } else {
                    "Confirm UT scope/measurements for each approved target before export."
                },
            ),
            ProductExportValidationRule(
                ruleCode = "inspection_checklist_complete",
                ruleLabel = "Inspection checklist complete",
                passed = inspectionChecklist.isComplete(),
                blocksExport = true,
                message = if (inspectionChecklist.isComplete()) {
                    "The full inspection checklist has been rated."
                } else {
                    "Complete all $checklistTotalCount checklist items before export. Rated so far: $checklistCompletedCount."
                },
            ),
            ProductExportValidationRule(
                ruleCode = "findings_have_location_linkage",
                ruleLabel = "Findings linked to locations",
                passed = allFindingsLinked,
                blocksExport = true,
                message = if (allFindingsLinked) {
                    "All findings remain linked to durable item locations."
                } else {
                    "Every finding must stay linked to a plate, course/lane, or element."
                },
            ),
            ProductExportValidationRule(
                ruleCode = "attachment_files_exist",
                ruleLabel = "Attachment files exist",
                passed = attachments.all { attachment -> attachment.fileExists },
                blocksExport = true,
                message = if (attachments.all { attachment -> attachment.fileExists }) {
                    "All linked attachment files exist locally."
                } else {
                    "One or more linked attachment files are missing."
                },
            ),
            ProductExportValidationRule(
                ruleCode = "attachment_file_sizes_nonzero",
                ruleLabel = "Attachment file sizes are valid",
                passed = attachments.all { attachment -> (attachment.fileByteSize ?: 0L) > 0L },
                blocksExport = true,
                message = if (attachments.all { attachment -> (attachment.fileByteSize ?: 0L) > 0L }) {
                    "All linked attachment files have non-zero sizes."
                } else {
                    "One or more linked attachment files are empty."
                },
            ),
            ProductExportValidationRule(
                ruleCode = "task_metadata_present",
                ruleLabel = "Task metadata present",
                passed = identity.tenantId.isNotBlank() &&
                    identity.workspaceId.isNotBlank() &&
                    identity.inspectionReference.isNotBlank() &&
                    identity.createdByUserId.isNotBlank() &&
                    identity.deviceId.isNotBlank(),
                blocksExport = true,
                message = if (identity.tenantId.isNotBlank() &&
                    identity.workspaceId.isNotBlank() &&
                    identity.inspectionReference.isNotBlank() &&
                    identity.createdByUserId.isNotBlank() &&
                    identity.deviceId.isNotBlank()) {
                    "Tenant, workspace, user, inspection, and device metadata are present."
                } else {
                    "Task metadata is incomplete for export."
                },
            ),
        )
        return validations.map { validation ->
            ProductExportValidationResultEntity(
                inspectionId = identity.inspectionId,
                tenantId = identity.tenantId,
                workspaceId = identity.workspaceId,
                inspectionReference = identity.inspectionReference,
                createdByUserId = identity.createdByUserId,
                lastEditedByUserId = identity.lastEditedByUserId,
                deviceId = identity.deviceId,
                ruleCode = validation.ruleCode,
                ruleLabel = validation.ruleLabel,
                passed = validation.passed,
                blocksExport = validation.blocksExport,
                message = validation.message,
                createdAtIso = identity.createdAtIso,
                updatedAtIso = nowIso,
            )
        }
    }

    private fun deriveTaskReadiness(
        state: ProductDraftState,
        snapshots: List<ProductTaskSnapshotEntity>,
        validationResults: List<ProductExportValidationResultEntity>,
    ): ProductTaskReadiness {
        val blockingValidation = validationResults.firstOrNull { result -> result.blocksExport && !result.passed }
        if (blockingValidation != null) {
            return ProductTaskReadiness(
                code = "blocked_${blockingValidation.ruleCode}",
                label = blockingValidation.message,
            )
        }
        if (state.generalTankInfo.requiredValidationErrors().isNotEmpty()) {
            return ProductTaskReadiness(
                code = "blocked_general_info",
                label = "General setup incomplete",
            )
        }
        val blockingSnapshot = snapshots.firstOrNull { snapshot -> snapshot.blocksExport }
        if (blockingSnapshot != null) {
            return ProductTaskReadiness(
                code = "blocked_${blockingSnapshot.taskKey}",
                label = blockingSnapshot.statusLabel,
            )
        }
        val incompleteSnapshot = snapshots.firstOrNull { snapshot ->
            snapshot.inScope && !snapshot.isComplete
        }
        if (incompleteSnapshot != null) {
            return ProductTaskReadiness(
                code = "in_progress",
                label = incompleteSnapshot.statusLabel,
            )
        }
        return ProductTaskReadiness(
            code = "ready",
            label = "Ready for export",
        )
    }

    companion object {
        private const val LOCAL_TENANT_ID = "local-tenant"
        private const val LOCAL_WORKSPACE_ID = "local-workspace"
        private const val LOCAL_USER_ID = "local-user"
        private const val DEFAULT_TENANT_NAME = "Local Tenant"
        private const val DEFAULT_WORKSPACE_NAME = "Field Workspace"
        private const val DEFAULT_USER_NAME = "Inspector"
        private const val DEFAULT_ROLE_CODE = "Inspector"
        private const val EXPORT_PACKAGE_SCHEMA_VERSION = 3
        private const val VOICE_NOTE_MEDIA_TYPE = "audio/mp4"
    }

    private data class ProductTaskReadiness(
        val code: String,
        val label: String,
    )

    private data class ProductExportValidationRule(
        val ruleCode: String,
        val ruleLabel: String,
        val passed: Boolean,
        val blocksExport: Boolean,
        val message: String,
    )
}

private suspend fun ai.laiq.tankinspection.v3product.storage.db.ProductLayoutTargetDao.replaceAll(
    inspectionId: String,
    entities: List<ProductLayoutTargetEntity>,
) {
    deleteAllByInspection(inspectionId)
    if (entities.isNotEmpty()) upsertAll(entities)
}

private suspend fun ai.laiq.tankinspection.v3product.storage.db.ProductLayoutConfigDao.replaceAll(
    inspectionId: String,
    entities: List<ProductLayoutConfigEntity>,
) {
    deleteAllByInspection(inspectionId)
    if (entities.isNotEmpty()) upsertAll(entities)
}

private suspend fun ai.laiq.tankinspection.v3product.storage.db.ProductElementDao.replaceAll(
    inspectionId: String,
    entities: List<ProductElementEntity>,
) {
    deleteAllByInspection(inspectionId)
    if (entities.isNotEmpty()) upsertAll(entities)
}

private suspend fun ai.laiq.tankinspection.v3product.storage.db.ProductUtMeasurementDao.replaceAll(
    inspectionId: String,
    entities: List<ProductUtMeasurementEntity>,
) {
    deleteAllByInspection(inspectionId)
    if (entities.isNotEmpty()) upsertAll(entities)
}

private suspend fun ai.laiq.tankinspection.v3product.storage.db.ProductChecklistItemDao.replaceAll(
    inspectionId: String,
    entities: List<ProductChecklistItemEntity>,
) {
    deleteAllByInspection(inspectionId)
    if (entities.isNotEmpty()) upsertAll(entities)
}

private suspend fun ai.laiq.tankinspection.v3product.storage.db.ProductChecklistSectionNoteDao.replaceAll(
    inspectionId: String,
    entities: List<ProductChecklistSectionNoteEntity>,
) {
    deleteAllByInspection(inspectionId)
    if (entities.isNotEmpty()) upsertAll(entities)
}

private suspend fun ai.laiq.tankinspection.v3product.storage.db.ProductFindingDao.replaceAll(
    inspectionId: String,
    entities: List<ProductFindingEntity>,
) {
    deleteAllByInspection(inspectionId)
    if (entities.isNotEmpty()) upsertAll(entities)
}

private suspend fun ai.laiq.tankinspection.v3product.storage.db.ProductAttachmentDao.replaceAll(
    inspectionId: String,
    entities: List<ProductAttachmentEntity>,
) {
    deleteAllByInspection(inspectionId)
    if (entities.isNotEmpty()) upsertAll(entities)
}

private suspend fun ai.laiq.tankinspection.v3product.storage.db.ProductVoiceNoteDao.replaceAll(
    inspectionId: String,
    entities: List<ProductVoiceNoteEntity>,
) {
    deleteAllByInspection(inspectionId)
    if (entities.isNotEmpty()) upsertAll(entities)
}

private suspend fun ai.laiq.tankinspection.v3product.storage.db.ProductTaskSnapshotDao.replaceAll(
    inspectionId: String,
    entities: List<ProductTaskSnapshotEntity>,
) {
    deleteAllByInspection(inspectionId)
    if (entities.isNotEmpty()) upsertAll(entities)
}

private suspend fun ai.laiq.tankinspection.v3product.storage.db.ProductExportValidationResultDao.replaceAll(
    inspectionId: String,
    entities: List<ProductExportValidationResultEntity>,
) {
    deleteAllByInspection(inspectionId)
    if (entities.isNotEmpty()) upsertAll(entities)
}

private data class ProductLaneCourse(
    val laneId: String,
    val course: Int,
)

private fun ProductFindingRecord.hasFieldEvidence(): Boolean =
    note.isNotBlank() || photos.isNotEmpty()

private fun ProductUtMeasurementEntry.hasPositiveReading(): Boolean =
    readings.any { reading -> reading.trim().toDoubleOrNull()?.let { value -> value > 0.0 } == true } ||
        reinforcementPadReading.trim().toDoubleOrNull()?.let { value -> value > 0.0 } == true

private fun ProductUtMeasurementEntry.elementId(): String? =
    itemKey.substringAfter(":element:", missingDelimiterValue = "").ifBlank { null }

private fun String.toLaneCourse(): ProductLaneCourse? {
    val match = Regex("""L(\d+)-C(\d+)""").find(this) ?: return null
    val lane = match.groupValues.getOrNull(1)?.toIntOrNull() ?: return null
    val course = match.groupValues.getOrNull(2)?.toIntOrNull() ?: return null
    return ProductLaneCourse(laneId = "L$lane", course = course)
}

private fun String.toPositiveIntOrNull(): Int? =
    trim().toIntOrNull()?.takeIf { value -> value > 0 }

private fun String.toPositiveDoubleOrNull(): Double? =
    trim().toDoubleOrNull()?.takeIf { value -> value > 0.0 }

private fun String.inferredImageMediaType(): String =
    when (substringAfterLast('.', missingDelimiterValue = "").lowercase()) {
        "png" -> "image/png"
        "webp" -> "image/webp"
        "gif" -> "image/gif"
        else -> "image/jpeg"
    }

private fun String.inferredVoiceMediaType(): String =
    when (substringAfterLast('.', missingDelimiterValue = "").lowercase()) {
        "txt" -> "text/plain"
        "wav" -> "audio/wav"
        else -> "audio/mp4"
    }

private fun resolveDeviceId(context: Context): String =
    Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        ?.takeIf { id -> id.isNotBlank() }
        ?: "unknown-device"

private fun buildInspectionReference(
    tankNumber: String,
    createdAtIso: String,
): String {
    val timestamp = Instant.parse(createdAtIso)
        .atZone(ZoneId.systemDefault())
        .format(REFERENCE_TIMESTAMP_FORMATTER)
    val tankToken = tankNumber
        .trim()
        .uppercase()
        .replace(Regex("\\s+"), "")
        .replace(Regex("[^A-Z0-9_-]"), "")
        .ifBlank { "TANK" }
    return "LAIQ-$tankToken-$timestamp"
}

private val REFERENCE_TIMESTAMP_FORMATTER: DateTimeFormatter =
    DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")

private fun buildExportRelativePath(
    inspectionId: String,
    exportedAtIso: String,
): String {
    val timestamp = Instant.parse(exportedAtIso)
        .atZone(ZoneId.systemDefault())
        .format(REFERENCE_TIMESTAMP_FORMATTER)
    return "v3-product-exports/$inspectionId/export-$timestamp.json"
}

private fun buildExportPackageJson(
    task: ProductInspectionTaskEntity,
    record: ProductInspectionRecordEntity,
    profile: ProductLocalProfile,
    layoutTargets: List<ai.laiq.tankinspection.v3product.storage.db.ProductLayoutTargetEntity>,
    layoutConfigs: List<ProductLayoutConfigEntity>,
    elements: List<ProductElementEntity>,
    utMeasurements: List<ProductUtMeasurementEntity>,
    checklistItems: List<ProductChecklistItemEntity>,
    checklistSectionNotes: List<ProductChecklistSectionNoteEntity>,
    findings: List<ProductFindingEntity>,
    voiceNotes: List<ProductVoiceNoteEntity>,
    attachments: List<ProductAttachmentEntity>,
    taskSnapshots: List<ProductTaskSnapshotEntity>,
    validationResults: List<ProductExportValidationResultEntity>,
    exportedByUserId: String,
    exportedAtIso: String,
    schemaVersion: Int,
): JSONObject =
    JSONObject().apply {
        put("packageType", "v3_product_export")
        put("schemaVersion", schemaVersion)
        put("inspectionReference", task.inspectionReference)
        put("tenantId", task.tenantId)
        put("workspaceId", task.workspaceId)
        put("inspectionId", task.inspectionId)
        put("exportedByUserId", exportedByUserId)
        put("exportedAtIso", exportedAtIso)
        put("deviceId", task.deviceId)
        put("workflowScreen", task.currentScreenKey)
        put(
            "profile",
            JSONObject()
                .put("tenantId", profile.tenantId)
                .put("tenantName", profile.tenantName)
                .put("workspaceId", profile.workspaceId)
                .put("workspaceName", profile.workspaceName)
                .put("userId", profile.userId)
                .put("displayName", profile.displayName)
                .put("roleLabel", profile.roleLabel)
                .put("deviceId", profile.deviceId),
        )
        put("task", task.toJson())
        put("inspectionRecord", record.toJson())
        put("validationResults", JSONArray().apply {
            validationResults.forEach { result -> put(result.toJson()) }
        })
        put("taskSnapshots", JSONArray().apply {
            taskSnapshots.forEach { snapshot -> put(snapshot.toJson()) }
        })
        put("layoutTargets", JSONArray().apply {
            layoutTargets.forEach { target -> put(target.toJson()) }
        })
        put("layoutConfigs", JSONArray().apply {
            layoutConfigs.forEach { config -> put(config.toJson()) }
        })
        put("elements", JSONArray().apply {
            elements.forEach { element -> put(element.toJson()) }
        })
        put("utMeasurements", JSONArray().apply {
            utMeasurements.forEach { measurement -> put(measurement.toJson()) }
        })
        put("inspectionChecklistItems", JSONArray().apply {
            checklistItems.forEach { item -> put(item.toJson()) }
        })
        put("inspectionChecklistSectionNotes", JSONArray().apply {
            checklistSectionNotes.forEach { note -> put(note.toJson()) }
        })
        put("findings", JSONArray().apply {
            findings.forEach { finding -> put(finding.toJson()) }
        })
        put("voiceNotes", JSONArray().apply {
            voiceNotes.forEach { note -> put(note.toJson()) }
        })
        put("attachments", JSONArray().apply {
            attachments.forEach { attachment -> put(attachment.toJson()) }
        })
    }

private fun ProductInspectionTaskEntity.toJson(): JSONObject =
    JSONObject()
        .put("inspectionId", inspectionId)
        .put("inspectionReference", inspectionReference)
        .put("tenantId", tenantId)
        .put("workspaceId", workspaceId)
        .put("createdByUserId", createdByUserId)
        .put("lastEditedByUserId", lastEditedByUserId)
        .put("deviceId", deviceId)
        .put("client", client)
        .put("tankNumber", tankNumber)
        .put("location", location)
        .put("lifecycleState", lifecycleState)
        .put("currentScreenKey", currentScreenKey)
        .put("readinessStatusCode", readinessStatusCode)
        .put("readinessStatusLabel", readinessStatusLabel)
        .put("exportStatusCode", exportStatusCode)
        .put("exportStatusLabel", exportStatusLabel)
        .put("archivedAtIso", archivedAtIso)
        .put("exportedAtIso", exportedAtIso)
        .put("createdAtIso", createdAtIso)
        .put("updatedAtIso", updatedAtIso)

private fun ProductInspectionRecordEntity.toJson(): JSONObject =
    JSONObject()
        .put("inspectionId", inspectionId)
        .put("tenantId", tenantId)
        .put("workspaceId", workspaceId)
        .put("inspectionReference", inspectionReference)
        .put("createdByUserId", createdByUserId)
        .put("lastEditedByUserId", lastEditedByUserId)
        .put("deviceId", deviceId)
        .put("schemaVersion", schemaVersion)
        .put("client", client)
        .put("tankNumber", tankNumber)
        .put("location", location)
        .put("fieldLeaseName", fieldLeaseName)
        .put("inspector", inspector)
        .put("externalRoofType", externalRoofType)
        .put("internalRoofType", internalRoofType)
        .put("referenceMode", referenceMode)
        .put("referenceNote", referenceNote)
        .put("diameterM", diameterM)
        .put("heightM", heightM)
        .put("shellCourseCount", shellCourseCount)
        .put("shellLaneCount", shellLaneCount)
        .put("reviewStatus", reviewStatus)
        .put("createdAtIso", createdAtIso)
        .put("updatedAtIso", updatedAtIso)

private fun ProductExportValidationResultEntity.toJson(): JSONObject =
    JSONObject()
        .put("inspectionId", inspectionId)
        .put("ruleCode", ruleCode)
        .put("ruleLabel", ruleLabel)
        .put("passed", passed)
        .put("blocksExport", blocksExport)
        .put("message", message)
        .put("updatedAtIso", updatedAtIso)

private fun ProductTaskSnapshotEntity.toJson(): JSONObject =
    JSONObject()
        .put("inspectionId", inspectionId)
        .put("taskKey", taskKey)
        .put("taskTitle", taskTitle)
        .put("taskOrder", taskOrder)
        .put("inScope", inScope)
        .put("statusCode", statusCode)
        .put("statusLabel", statusLabel)
        .put("isComplete", isComplete)
        .put("blocksExport", blocksExport)
        .put("entryCount", entryCount)
        .put("referenceCount", referenceCount)
        .put("updatedAtIso", updatedAtIso)

private fun ai.laiq.tankinspection.v3product.storage.db.ProductLayoutTargetEntity.toJson(): JSONObject =
    JSONObject()
        .put("inspectionId", inspectionId)
        .put("targetKey", targetKey)
        .put("targetLabel", targetLabel)
        .put("surfaceKey", surfaceKey)
        .put("inLayoutScope", inLayoutScope)
        .put("layoutApproved", layoutApproved)
        .put("elementInScope", elementInScope)
        .put("elementApproved", elementApproved)
        .put("utInScope", utInScope)
        .put("utApproved", utApproved)
        .put("updatedAtIso", updatedAtIso)

private fun ProductCustomCircularPlateLayout.toCustomCircularLayoutJson(): String =
    JSONObject()
        .put("annularRotationDeg", annularRotationDeg)
        .put("rows", JSONArray().apply { rows.forEach { row -> put(row.toJson()) } })
        .toString()

private fun ProductCustomCircularPlateRow.toJson(): JSONObject =
    JSONObject()
        .put("rowNumber", rowNumber)
        .put("shiftRatio", shiftRatio)
        .put("plates", JSONArray().apply { plates.forEach { plate -> put(plate.toJson()) } })

private fun ProductCustomCircularPlate.toJson(): JSONObject =
    JSONObject()
        .put("widthWeight", widthWeight)
        .put("splitGroupKey", splitGroupKey)
        .put("splitPartIndex", splitPartIndex)
        .put("splitPartCount", splitPartCount)

private fun ProductLayoutConfigEntity.toJson(): JSONObject =
    JSONObject()
        .put("inspectionId", inspectionId)
        .put("targetKey", targetKey)
        .put("surfaceKey", surfaceKey)
        .put("referenceMode", referenceMode)
        .put("referenceNote", referenceNote)
        .put("roofPattern", roofPattern)
        .put("roofRingCount", roofRingCount)
        .put("roofSectorCount", roofSectorCount)
        .put("roofRowCount", roofRowCount)
        .put("roofWidestRowPlateCount", roofWidestRowPlateCount)
        .put("roofHasCenterOpening", roofHasCenterOpening)
        .put("roofHasAnnularRing", roofHasAnnularRing)
        .put("roofAnnularSectionCount", roofAnnularSectionCount)
        .put("shellCourseCount", shellCourseCount)
        .put("shellPlatesPerCourse", shellPlatesPerCourse)
        .put("shellLaneCount", shellLaneCount)
        .put("shellPlateOffset", shellPlateOffset)
        .put("shellOffsetStartRow", shellOffsetStartRow)
        .put("shellThirdOffsetStart", shellThirdOffsetStart)
        .put("floorTemplate", floorTemplate)
        .put("floorPlateCount", floorPlateCount)
        .put("floorAnnularSectionCount", floorAnnularSectionCount)
        .put("floorPatternCountX", floorPatternCountX)
        .put("floorPatternCountY", floorPatternCountY)
        .put("customCircularLayout", customCircularLayoutJson?.let { JSONObject(it) })
        .put("updatedAtIso", updatedAtIso)

private fun ProductElementEntity.toJson(): JSONObject =
    JSONObject()
        .put("inspectionId", inspectionId)
        .put("targetKey", targetKey)
        .put("elementId", elementId)
        .put("elementLabel", elementLabel)
        .put("elementTypeKey", elementTypeKey)
        .put("normalizedX", normalizedX.toDouble())
        .put("normalizedY", normalizedY.toDouble())
        .put("updatedAtIso", updatedAtIso)

private fun ProductUtMeasurementEntity.toJson(): JSONObject =
    JSONObject()
        .put("inspectionId", inspectionId)
        .put("itemKey", itemKey)
        .put("targetKey", targetKey)
        .put("itemLabel", itemLabel)
        .put("itemKind", itemKind)
        .put("elementTypeKey", elementTypeKey)
        .put("nozzleSize", nozzleSize)
        .put("reinforcementPadReading", reinforcementPadReading)
        .put("laneId", laneId)
        .put("course", course)
        .put("plateId", plateId)
        .put("elementId", elementId)
        .put("confirmed", confirmed)
        .put("measured", measured)
        .put("value1", value1)
        .put("value2", value2)
        .put("value3", value3)
        .put("value4", value4)
        .put("value5", value5)
        .put("updatedAtIso", updatedAtIso)

private fun ProductChecklistItemEntity.toJson(): JSONObject =
    JSONObject()
        .put("inspectionId", inspectionId)
        .put("sectionKey", sectionKey)
        .put("sectionTitle", sectionTitle)
        .put("itemNumber", itemNumber)
        .put("itemPrompt", itemPrompt)
        .put("ratingKey", ratingKey)
        .put("ratingLabel", ratingLabel)
        .put("itemNote", itemNote)
        .put("updatedAtIso", updatedAtIso)

private fun ProductChecklistSectionNoteEntity.toJson(): JSONObject =
    JSONObject()
        .put("inspectionId", inspectionId)
        .put("sectionKey", sectionKey)
        .put("sectionTitle", sectionTitle)
        .put("note", note)
        .put("updatedAtIso", updatedAtIso)

private fun ProductFindingEntity.toJson(): JSONObject =
    JSONObject()
        .put("inspectionId", inspectionId)
        .put("findingId", findingId)
        .put("targetKey", targetKey)
        .put("itemLabel", itemLabel)
        .put("itemKind", itemKind)
        .put("elementTypeKey", elementTypeKey)
        .put("linkedUtItemKey", linkedUtItemKey)
        .put("note", note)
        .put("attachmentCount", attachmentCount)
        .put("hasMissingAttachment", hasMissingAttachment)
        .put("updatedAtIso", updatedAtIso)

private fun ProductVoiceNoteEntity.toJson(): JSONObject =
    JSONObject()
        .put("inspectionId", inspectionId)
        .put("voiceNoteId", voiceNoteId)
        .put("relativePath", relativePath)
        .put("displayName", displayName)
        .put("screenKey", screenKey)
        .put("screenLabel", screenLabel)
        .put("cardKey", cardKey)
        .put("fieldKey", fieldKey)
        .put("targetKey", targetKey)
        .put("targetLabel", targetLabel)
        .put("itemKey", itemKey)
        .put("itemLabel", itemLabel)
        .put("transcriptStatus", transcriptStatus)
        .put("transcriptText", transcriptText)
        .put("durationMs", durationMs)
        .put("mediaType", mediaType)
        .put("fileByteSize", fileByteSize)
        .put("fileExists", fileExists)
        .put("capturedAtIso", capturedAtIso)
        .put("updatedAtIso", updatedAtIso)

private fun ProductAttachmentEntity.toJson(): JSONObject =
    JSONObject()
        .put("inspectionId", inspectionId)
        .put("attachmentId", attachmentId)
        .put("findingId", findingId)
        .put("kind", kind)
        .put("relativePath", relativePath)
        .put("displayName", displayName)
        .put("mediaType", mediaType)
        .put("fileByteSize", fileByteSize)
        .put("fileExists", fileExists)
        .put("annotationStrokeCount", annotationStrokeCount)
        .put("annotationPointCount", annotationPointCount)
        .put("updatedAtIso", updatedAtIso)

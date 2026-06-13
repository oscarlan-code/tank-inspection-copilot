package ai.laiq.tankinspection.v2product.preview

import android.content.Context
import ai.laiq.tankinspection.v2product.model.V2DraftState
import ai.laiq.tankinspection.v2product.model.V2ElementPlacementState
import ai.laiq.tankinspection.v2product.model.V2ElementSetup
import ai.laiq.tankinspection.v2product.model.V2GeneralTankInfo
import ai.laiq.tankinspection.v2product.model.V2InspectionChecklistState
import ai.laiq.tankinspection.v2product.model.V2LayoutMapSetup
import ai.laiq.tankinspection.v2product.model.V2LayoutScope
import ai.laiq.tankinspection.v2product.model.V2RoofLayoutMap
import ai.laiq.tankinspection.v2product.storage.V2ExportPackageSummary
import ai.laiq.tankinspection.v2product.storage.V2ExportValidationCheck
import ai.laiq.tankinspection.v2product.model.V2UtMeasurementState
import ai.laiq.tankinspection.v2product.model.V2UtSetup
import ai.laiq.tankinspection.v2product.model.defaultV2PreviewDraftState
import ai.laiq.tankinspection.v2product.storage.V2LocalProfile
import ai.laiq.tankinspection.v2product.storage.V2ProductStore
import ai.laiq.tankinspection.v2product.storage.V2TaskIdentity
import ai.laiq.tankinspection.v2product.storage.V2TaskSummary
import ai.laiq.tankinspection.v2product.storage.V2WorkflowScreen
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import kotlinx.coroutines.runBlocking

object V2PreviewSession {
    private const val PREFS_NAME = "v2_product_preview_session"
    private const val LEGACY_DRAFT_STATE_KEY = "draft_state_json"
    private const val ACTIVE_INSPECTION_ID_KEY = "active_inspection_id"
    private const val ACTIVE_SCREEN_KEY = "active_screen_key"
    private const val MOCK_TASKS_SEEDED_KEY = "mock_tasks_seeded_api_standard_v10_20260611_complete_report_data"
    private const val STORAGE_DIR_NAME = "v2-product-session"
    private const val TASKS_DIR_NAME = "tasks"
    private const val DRAFT_FILE_NAME = "draft-state.json"
    private const val BACKUP_FILE_NAME = "draft-state.backup.json"

    private var appContext: Context? = null
    private var loadedFromDisk = false
    private var productStore: V2ProductStore? = null
    private val ioLock = Any()

    var lastPersistenceError: Throwable? = null
        private set

    var draftState: V2DraftState = defaultV2PreviewDraftState()
        private set

    var activeTaskIdentity: V2TaskIdentity? = null
        private set

    var activeWorkflowScreen: V2WorkflowScreen = V2WorkflowScreen.GENERAL_INFO
        private set

    var localProfile: V2LocalProfile? = null
        private set

    fun attach(context: Context) {
        appContext = context.applicationContext
        if (productStore == null) {
            productStore = V2ProductStore(context.applicationContext)
        }
        if (loadedFromDisk) return
        loadedFromDisk = true
        bootstrap()
    }

    fun reset() {
        beginNewInspection()
    }

    fun beginNewInspection() {
        activeTaskIdentity = null
        activeWorkflowScreen = V2WorkflowScreen.GENERAL_INFO
        draftState = defaultV2PreviewDraftState()
        persistSessionMetadata()
    }

    fun continueInspection(inspectionId: String): Boolean {
        val store = productStore ?: return false
        val identity = runBlocking { store.getTaskIdentity(inspectionId) } ?: return false
        val summary = runBlocking { store.getTaskSummary(inspectionId) }
        val restoredDraft = decodeFile(taskDraftFile(inspectionId))
            ?: decodeFile(taskBackupFile(inspectionId))
            ?: defaultV2PreviewDraftState()
        activeTaskIdentity = identity
        activeWorkflowScreen = summary?.currentScreen ?: V2WorkflowScreen.GENERAL_INFO
        draftState = restoredDraft
        persistSessionMetadata()
        runBlocking { store.noteTaskContinued(inspectionId) }
        return true
    }

    fun ensureTaskCreated(): Boolean {
        val existing = activeTaskIdentity
        if (existing != null) {
            persist()
            return true
        }
        val store = productStore ?: return false
        return runCatching {
            val identity = runBlocking { store.createInspectionTask(draftState, activeWorkflowScreen) }
            activeTaskIdentity = identity
            persistTaskSnapshot(identity.inspectionId, draftState)
            persistSessionMetadata()
            true
        }.getOrElse { error ->
            lastPersistenceError = error
            false
        }
    }

    fun setActiveWorkflowScreen(screen: V2WorkflowScreen) {
        activeWorkflowScreen = screen
        persistSessionMetadata()
        if (activeTaskIdentity != null) {
            persist()
        }
    }

    fun loadLocalProfile(): V2LocalProfile {
        val store = requireNotNull(productStore)
        return runBlocking {
            store.ensureLocalProfile().also { profile ->
                localProfile = profile
            }
        }
    }

    fun updateLocalProfile(
        tenantName: String,
        workspaceName: String,
        displayName: String,
    ): V2LocalProfile {
        val store = requireNotNull(productStore)
        return runBlocking {
            store.updateLocalProfile(
                tenantName = tenantName,
                workspaceName = workspaceName,
                displayName = displayName,
            ).also { profile ->
                localProfile = profile
            }
        }
    }

    fun listTaskSummaries(): List<V2TaskSummary> {
        val store = requireNotNull(productStore)
        return runBlocking { store.listTaskSummaries() }
    }

    fun listExportValidationChecks(inspectionId: String): List<V2ExportValidationCheck> {
        val store = requireNotNull(productStore)
        return runBlocking { store.listExportValidationChecks(inspectionId) }
    }

    fun latestExportPackage(inspectionId: String): V2ExportPackageSummary? {
        val store = requireNotNull(productStore)
        return runBlocking { store.latestExportPackage(inspectionId) }
    }

    fun exportInspection(inspectionId: String): V2ExportPackageSummary {
        val store = requireNotNull(productStore)
        return runBlocking { store.exportInspection(inspectionId) }
    }

    fun archiveInspection(inspectionId: String) {
        val store = requireNotNull(productStore)
        runBlocking { store.archiveInspection(inspectionId) }
        if (activeTaskIdentity?.inspectionId == inspectionId) {
            beginNewInspection()
        }
    }

    fun deleteInspection(inspectionId: String) {
        val store = requireNotNull(productStore)
        runBlocking { store.deleteInspection(inspectionId) }
        if (activeTaskIdentity?.inspectionId == inspectionId) {
            beginNewInspection()
        }
        deleteTaskSnapshotFiles(inspectionId)
    }

    fun updateGeneralTankInfo(updated: V2GeneralTankInfo) {
        updateDraftState(draftState.copy(generalTankInfo = updated))
    }

    fun updateLayoutMapSetup(updated: V2LayoutMapSetup) {
        updateDraftState(draftState.copy(layoutMapSetup = updated))
    }

    fun updateElementSetup(updated: V2ElementSetup) {
        updateDraftState(draftState.copy(elementSetup = updated))
    }

    fun updateElementPlacement(updated: V2ElementPlacementState) {
        updateDraftState(draftState.copy(elementPlacement = updated))
    }

    fun updateUtSetup(updated: V2UtSetup) {
        updateDraftState(draftState.copy(utSetup = updated))
    }

    fun updateUtMeasurements(updated: V2UtMeasurementState) {
        updateDraftState(draftState.copy(utMeasurements = updated))
    }

    fun updateInspectionChecklist(updated: V2InspectionChecklistState) {
        updateDraftState(draftState.copy(inspectionChecklist = updated))
    }

    fun updateLayoutScope(updated: V2LayoutScope) {
        updateDraftState(draftState.copy(layoutScope = updated))
    }

    fun updateRoofLayoutMap(updated: V2RoofLayoutMap) {
        updateDraftState(draftState.copy(roofLayoutMap = updated))
    }

    fun updateDraftState(updated: V2DraftState) {
        draftState = updated
        if (activeTaskIdentity != null) {
            persist()
        }
    }

    private fun bootstrap() {
        loadLocalProfile()
        migrateLegacySingleDraftIfNeeded()
        seedMockTasksIfNeeded()
        restoreActiveInspectionFromPrefs()
    }

    private fun seedMockTasksIfNeeded() {
        val store = productStore ?: return
        val preferences = prefs() ?: return
        if (preferences.getBoolean(MOCK_TASKS_SEEDED_KEY, false)) return
        val hasExistingTasks = runBlocking { store.hasAnyTasks() }
        runCatching {
            runBlocking {
                if (hasExistingTasks) {
                    seedOrRefreshMockTask(store, v2ProductApiStandardV10Seed())
                } else {
                    v2ProductMockTaskSeeds().forEach { seed ->
                        val identity = store.createInspectionTask(seed.state, seed.workflowScreen)
                        persistTaskSnapshot(identity.inspectionId, seed.state)
                    }
                }
            }
            preferences.edit().putBoolean(MOCK_TASKS_SEEDED_KEY, true).apply()
        }.onFailure { error ->
            lastPersistenceError = error
        }
    }

    private suspend fun seedOrRefreshMockTask(
        store: V2ProductStore,
        seed: V2MockTaskSeed,
    ) {
        val matchingSummaries = store.listTaskSummaries()
            .sortedByDescending { task -> task.updatedAtIso }
            .filter { summary ->
                val savedState = decodeFile(taskDraftFile(summary.inspectionId))
                    ?: decodeFile(taskBackupFile(summary.inspectionId))
                    ?: return@filter false
                savedState.generalTankInfo.client == seed.state.generalTankInfo.client &&
                    savedState.generalTankInfo.tankNumber == seed.state.generalTankInfo.tankNumber &&
                    savedState.generalTankInfo.jobNo == seed.state.generalTankInfo.jobNo
            }

        if (matchingSummaries.isEmpty()) {
            val identity = store.createInspectionTask(seed.state, seed.workflowScreen)
            persistTaskSnapshot(identity.inspectionId, seed.state)
            return
        }

        matchingSummaries.forEach { summary ->
            val identity = store.getTaskIdentity(summary.inspectionId) ?: return@forEach
            store.saveNow(seed.state, identity, seed.workflowScreen)
            persistTaskSnapshot(identity.inspectionId, seed.state)
        }
    }

    private fun persist() {
        val identity = activeTaskIdentity ?: return
        lastPersistenceError = null
        runCatching {
            persistTaskSnapshot(identity.inspectionId, draftState)
        }.onFailure { error ->
            lastPersistenceError = error
        }
        productStore?.saveAsync(draftState, identity, activeWorkflowScreen)
        persistSessionMetadata()
    }

    private fun prefs() = appContext?.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun restoreActiveInspectionFromPrefs() {
        val inspectionId = prefs()?.getString(ACTIVE_INSPECTION_ID_KEY, null)
        if (inspectionId.isNullOrBlank()) {
            beginNewInspection()
            return
        }
        val store = productStore ?: run {
            beginNewInspection()
            return
        }
        val identity = runBlocking { store.getTaskIdentity(inspectionId) }
        if (identity == null) {
            beginNewInspection()
            return
        }
        activeTaskIdentity = identity
        activeWorkflowScreen = V2WorkflowScreen.fromKey(
            prefs()?.getString(ACTIVE_SCREEN_KEY, null).orEmpty(),
        )
        draftState = decodeFile(taskDraftFile(inspectionId))
            ?: decodeFile(taskBackupFile(inspectionId))
            ?: defaultV2PreviewDraftState()
        persistSessionMetadata()
    }

    private fun migrateLegacySingleDraftIfNeeded() {
        val store = productStore ?: return
        if (runBlocking { store.hasAnyTasks() }) return
        val legacyDraft = loadLegacyDraftState() ?: return
        val importedIdentity = runBlocking { store.importLegacyInspection(legacyDraft) }
        if (importedIdentity != null) {
            persistTaskSnapshot(importedIdentity.inspectionId, legacyDraft)
        }
        clearLegacyDraftState()
    }

    private fun loadLegacyDraftState(): V2DraftState? {
        decodeFile(legacyDraftFile())?.let { return it }
        decodeFile(legacyBackupFile())?.let { return it }
        val savedJson = prefs()?.getString(LEGACY_DRAFT_STATE_KEY, null)
        if (savedJson.isNullOrBlank()) return null
        return runCatching { V2DraftJsonCodec.decode(savedJson) }.getOrNull()
    }

    private fun clearLegacyDraftState() {
        prefs()?.edit()?.remove(LEGACY_DRAFT_STATE_KEY)?.apply()
        legacyDraftFile()?.takeIf { file -> file.exists() }?.delete()
        legacyBackupFile()?.takeIf { file -> file.exists() }?.delete()
    }

    private fun decodeFile(file: File?): V2DraftState? {
        if (file == null || !file.exists() || file.length() <= 0L) return null
        return runCatching {
            V2DraftJsonCodec.decode(file.readText(Charsets.UTF_8))
        }.getOrNull()
    }

    private fun persistTaskSnapshot(
        inspectionId: String,
        state: V2DraftState,
    ) {
        val primary = taskDraftFile(inspectionId) ?: return
        val backup = taskBackupFile(inspectionId) ?: return
        persistAtomically(primary, backup, state)
    }

    private fun persistAtomically(
        primary: File,
        backup: File,
        state: V2DraftState,
    ) {
        synchronized(ioLock) {
            primary.parentFile?.mkdirs()
            backup.parentFile?.mkdirs()
            val temp = File.createTempFile("draft-state-", ".tmp", primary.parentFile)
            try {
                writeSynced(temp, V2DraftJsonCodec.encode(state))
                if (primary.exists() && primary.length() > 0L) {
                    copySynced(primary, backup)
                }
                if (primary.exists() && !primary.delete()) {
                    error("Unable to replace V2 product task draft.")
                }
                if (!temp.renameTo(primary)) {
                    copySynced(temp, primary)
                    temp.delete()
                }
            } catch (error: Throwable) {
                temp.delete()
                throw error
            }
        }
    }

    private fun writeSynced(file: File, contents: String) {
        FileOutputStream(file, false).use { output ->
            output.write(contents.toByteArray(Charsets.UTF_8))
            output.fd.sync()
        }
    }

    private fun copySynced(source: File, destination: File) {
        destination.parentFile?.mkdirs()
        FileInputStream(source).use { input ->
            FileOutputStream(destination, false).use { output ->
                input.copyTo(output)
                output.fd.sync()
            }
        }
    }

    private fun deleteTaskSnapshotFiles(inspectionId: String) {
        taskDraftFile(inspectionId)?.takeIf { file -> file.exists() }?.delete()
        taskBackupFile(inspectionId)?.takeIf { file -> file.exists() }?.delete()
        taskDirectory(inspectionId)?.takeIf { dir -> dir.exists() }?.delete()
    }

    private fun persistSessionMetadata() {
        val editor = prefs()?.edit() ?: return
        val activeInspectionId = activeTaskIdentity?.inspectionId
        if (activeInspectionId.isNullOrBlank()) {
            editor.remove(ACTIVE_INSPECTION_ID_KEY)
        } else {
            editor.putString(ACTIVE_INSPECTION_ID_KEY, activeInspectionId)
        }
        editor.putString(ACTIVE_SCREEN_KEY, activeWorkflowScreen.key)
        editor.apply()
    }

    private fun storageDir(): File? =
        appContext?.filesDir?.let { filesDir -> File(filesDir, STORAGE_DIR_NAME) }

    private fun tasksDir(): File? =
        storageDir()?.let { dir -> File(dir, TASKS_DIR_NAME) }

    private fun taskDirectory(inspectionId: String): File? =
        tasksDir()?.let { dir -> File(dir, inspectionId) }

    private fun taskDraftFile(inspectionId: String): File? =
        taskDirectory(inspectionId)?.let { dir -> File(dir, DRAFT_FILE_NAME) }

    private fun taskBackupFile(inspectionId: String): File? =
        taskDirectory(inspectionId)?.let { dir -> File(dir, BACKUP_FILE_NAME) }

    private fun legacyDraftFile(): File? =
        storageDir()?.let { dir -> File(dir, DRAFT_FILE_NAME) }

    private fun legacyBackupFile(): File? =
        storageDir()?.let { dir -> File(dir, BACKUP_FILE_NAME) }
}

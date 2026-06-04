package ai.laiq.tankinspection.v2.preview

import android.content.Context
import ai.laiq.tankinspection.v2.model.V2DraftState
import ai.laiq.tankinspection.v2.model.V2ElementPlacementState
import ai.laiq.tankinspection.v2.model.V2ElementSetup
import ai.laiq.tankinspection.v2.model.V2GeneralTankInfo
import ai.laiq.tankinspection.v2.model.V2LayoutMapSetup
import ai.laiq.tankinspection.v2.model.V2LayoutScope
import ai.laiq.tankinspection.v2.model.V2RoofLayoutMap
import ai.laiq.tankinspection.v2.model.V2UtMeasurementState
import ai.laiq.tankinspection.v2.model.V2UtSetup
import ai.laiq.tankinspection.v2.model.defaultV2PreviewDraftState
import ai.laiq.tankinspection.v2.storage.V2ProductStore
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

object V2PreviewSession {
    private const val PREFS_NAME = "v2_preview_session"
    private const val DRAFT_STATE_KEY = "draft_state_json"
    private const val STORAGE_DIR_NAME = "v2-session"
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

    fun attach(context: Context) {
        appContext = context.applicationContext
        if (productStore == null) {
            productStore = V2ProductStore(context.applicationContext)
        }
        if (loadedFromDisk) return
        loadedFromDisk = true
        draftState = loadPersistedDraftState()
        productStore?.saveAsync(draftState)
    }

    fun reset() {
        draftState = defaultV2PreviewDraftState()
        persist()
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

    fun updateLayoutScope(updated: V2LayoutScope) {
        updateDraftState(draftState.copy(layoutScope = updated))
    }

    fun updateRoofLayoutMap(updated: V2RoofLayoutMap) {
        updateDraftState(draftState.copy(roofLayoutMap = updated))
    }

    fun updateDraftState(updated: V2DraftState) {
        draftState = updated
        persist()
    }

    private fun persist() {
        lastPersistenceError = null
        runCatching {
            persistAtomically(draftState)
        }.onFailure { error ->
            lastPersistenceError = error
        }
        productStore?.saveAsync(draftState)
    }

    private fun prefs() = appContext?.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun loadPersistedDraftState(): V2DraftState {
        decodeFile(draftFile())?.let { return it }
        decodeFile(backupFile())?.let { recovered ->
            runCatching { persistAtomically(recovered) }
            return recovered
        }
        loadLegacyDraftState()?.let { migrated ->
            runCatching {
                persistAtomically(migrated)
                clearLegacyDraftState()
            }
            return migrated
        }
        return defaultV2PreviewDraftState()
    }

    private fun decodeFile(file: File?): V2DraftState? {
        if (file == null || !file.exists() || file.length() <= 0L) return null
        return runCatching {
            V2DraftJsonCodec.decode(file.readText(Charsets.UTF_8))
        }.getOrNull()
    }

    private fun loadLegacyDraftState(): V2DraftState? {
        val savedJson = prefs()?.getString(DRAFT_STATE_KEY, null)
        if (savedJson.isNullOrBlank()) return null
        return runCatching { V2DraftJsonCodec.decode(savedJson) }.getOrNull()
    }

    private fun clearLegacyDraftState() {
        prefs()?.edit()?.remove(DRAFT_STATE_KEY)?.apply()
    }

    private fun persistAtomically(state: V2DraftState) {
        val dir = storageDir() ?: return
        synchronized(ioLock) {
            dir.mkdirs()
            val primary = File(dir, DRAFT_FILE_NAME)
            val backup = File(dir, BACKUP_FILE_NAME)
            val temp = File.createTempFile("draft-state-", ".tmp", dir)
            try {
                writeSynced(temp, V2DraftJsonCodec.encode(state))
                if (primary.exists() && primary.length() > 0L) {
                    copySynced(primary, backup)
                }
                if (primary.exists() && !primary.delete()) {
                    error("Unable to replace V2 draft file.")
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

    private fun storageDir(): File? =
        appContext?.filesDir?.let { filesDir -> File(filesDir, STORAGE_DIR_NAME) }

    private fun draftFile(): File? =
        storageDir()?.let { dir -> File(dir, DRAFT_FILE_NAME) }

    private fun backupFile(): File? =
        storageDir()?.let { dir -> File(dir, BACKUP_FILE_NAME) }
}

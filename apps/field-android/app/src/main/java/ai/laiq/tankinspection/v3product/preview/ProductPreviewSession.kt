package ai.laiq.tankinspection.v3product.preview

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import ai.laiq.tankinspection.v3product.model.ProductDraftState
import ai.laiq.tankinspection.v3product.model.ProductElementPlacementState
import ai.laiq.tankinspection.v3product.model.ProductElementSetup
import ai.laiq.tankinspection.v3product.model.ProductFindingPhoto
import ai.laiq.tankinspection.v3product.model.ProductGeneralTankInfo
import ai.laiq.tankinspection.v3product.model.ProductInspectionChecklistState
import ai.laiq.tankinspection.v3product.model.ProductLayoutMapSetup
import ai.laiq.tankinspection.v3product.model.ProductLayoutScope
import ai.laiq.tankinspection.v3product.model.ProductRoofLayoutMap
import ai.laiq.tankinspection.v3product.storage.ProductExportPackageSummary
import ai.laiq.tankinspection.v3product.storage.ProductExportValidationCheck
import ai.laiq.tankinspection.v3product.model.ProductUtMeasurementState
import ai.laiq.tankinspection.v3product.model.ProductUtSetup
import ai.laiq.tankinspection.v3product.model.ProductVoiceNote
import ai.laiq.tankinspection.v3product.model.defaultProductPreviewDraftState
import ai.laiq.tankinspection.v3product.storage.ProductLocalProfile
import ai.laiq.tankinspection.v3product.storage.ProductStore
import ai.laiq.tankinspection.v3product.storage.ProductTaskIdentity
import ai.laiq.tankinspection.v3product.storage.ProductTaskSummary
import ai.laiq.tankinspection.v3product.storage.ProductWorkflowScreen
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import kotlin.math.min
import kotlinx.coroutines.runBlocking

object ProductPreviewSession {
    private const val PREFS_NAME = "v3_product_preview_session"
    private const val LEGACY_DRAFT_STATE_KEY = "draft_state_json"
    private const val ACTIVE_INSPECTION_ID_KEY = "active_inspection_id"
    private const val ACTIVE_SCREEN_KEY = "active_screen_key"
    private const val MOCK_TASKS_SEEDED_KEY = "mock_tasks_seeded_api_standard_v10_20260623_synthetic_voice"
    private const val STORAGE_DIR_NAME = "v3-product-session"
    private const val TASKS_DIR_NAME = "tasks"
    private const val DRAFT_FILE_NAME = "draft-state.json"
    private const val BACKUP_FILE_NAME = "draft-state.backup.json"

    private var appContext: Context? = null
    private var loadedFromDisk = false
    private var productStore: ProductStore? = null
    private val ioLock = Any()

    var lastPersistenceError: Throwable? = null
        private set

    var draftState: ProductDraftState = defaultProductPreviewDraftState()
        private set

    var activeTaskIdentity: ProductTaskIdentity? = null
        private set

    var activeWorkflowScreen: ProductWorkflowScreen = ProductWorkflowScreen.GENERAL_INFO
        private set

    var localProfile: ProductLocalProfile? = null
        private set

    fun attach(context: Context) {
        appContext = context.applicationContext
        if (productStore == null) {
            productStore = ProductStore(context.applicationContext)
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
        activeWorkflowScreen = ProductWorkflowScreen.GENERAL_INFO
        draftState = defaultProductPreviewDraftState()
        persistSessionMetadata()
    }

    fun continueInspection(inspectionId: String): Boolean {
        val store = productStore ?: return false
        val identity = runBlocking { store.getTaskIdentity(inspectionId) } ?: return false
        val summary = runBlocking { store.getTaskSummary(inspectionId) }
        val restoredDraft = decodeFile(taskDraftFile(inspectionId))
            ?: decodeFile(taskBackupFile(inspectionId))
            ?: defaultProductPreviewDraftState()
        activeTaskIdentity = identity
        activeWorkflowScreen = summary?.currentScreen ?: ProductWorkflowScreen.GENERAL_INFO
        draftState = restoredDraft
        ensureDraftAssetsMaterialized()
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

    fun setActiveWorkflowScreen(screen: ProductWorkflowScreen) {
        activeWorkflowScreen = screen
        persistSessionMetadata()
        if (activeTaskIdentity != null) {
            persist()
        }
    }

    fun loadLocalProfile(): ProductLocalProfile {
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
    ): ProductLocalProfile {
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

    fun listTaskSummaries(): List<ProductTaskSummary> {
        val store = requireNotNull(productStore)
        return runBlocking { store.listTaskSummaries() }
    }

    fun listExportValidationChecks(inspectionId: String): List<ProductExportValidationCheck> {
        val store = requireNotNull(productStore)
        return runBlocking { store.listExportValidationChecks(inspectionId) }
    }

    fun latestExportPackage(inspectionId: String): ProductExportPackageSummary? {
        val store = requireNotNull(productStore)
        return runBlocking { store.latestExportPackage(inspectionId) }
    }

    fun exportInspection(inspectionId: String): ProductExportPackageSummary {
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

    fun updateGeneralTankInfo(updated: ProductGeneralTankInfo) {
        updateDraftState(draftState.copy(generalTankInfo = updated))
    }

    fun updateLayoutMapSetup(updated: ProductLayoutMapSetup) {
        updateDraftState(draftState.copy(layoutMapSetup = updated))
    }

    fun updateElementSetup(updated: ProductElementSetup) {
        updateDraftState(draftState.copy(elementSetup = updated))
    }

    fun updateElementPlacement(updated: ProductElementPlacementState) {
        updateDraftState(draftState.copy(elementPlacement = updated))
    }

    fun updateUtSetup(updated: ProductUtSetup) {
        updateDraftState(draftState.copy(utSetup = updated))
    }

    fun updateUtMeasurements(updated: ProductUtMeasurementState) {
        updateDraftState(draftState.copy(utMeasurements = updated))
    }

    fun updateInspectionChecklist(updated: ProductInspectionChecklistState) {
        updateDraftState(draftState.copy(inspectionChecklist = updated))
    }

    fun updateLayoutScope(updated: ProductLayoutScope) {
        updateDraftState(draftState.copy(layoutScope = updated))
    }

    fun updateRoofLayoutMap(updated: ProductRoofLayoutMap) {
        updateDraftState(draftState.copy(roofLayoutMap = updated))
    }

    fun addVoiceNote(note: ProductVoiceNote) {
        val updatedNotes = draftState.voiceNotes
            .filterNot { existing -> existing.id == note.id } + note
        updateDraftState(draftState.copy(voiceNotes = updatedNotes))
    }

    fun removeVoiceNote(noteId: String) {
        updateDraftState(
            draftState.copy(
                voiceNotes = draftState.voiceNotes.filterNot { note -> note.id == noteId },
            ),
        )
    }

    fun updateDraftState(updated: ProductDraftState) {
        draftState = updated
        if (activeTaskIdentity != null) {
            persist()
        }
    }

    fun ensureDraftAssetsMaterialized() {
        materializeMockAssets(draftState)
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
        if (hasExistingTasks) {
            preferences.edit().putBoolean(MOCK_TASKS_SEEDED_KEY, true).apply()
            return
        }
        runCatching {
            runBlocking {
                productMockTaskSeeds().forEach { seed ->
                    materializeMockAssets(seed.state)
                    val identity = store.createInspectionTask(seed.state, seed.workflowScreen)
                    persistTaskSnapshot(identity.inspectionId, seed.state)
                }
            }
            preferences.edit().putBoolean(MOCK_TASKS_SEEDED_KEY, true).apply()
        }.onFailure { error ->
            lastPersistenceError = error
        }
    }

    private fun materializeMockAssets(state: ProductDraftState) {
        materializeMockFindingPhotos(state)
        materializeMockVoiceAssets(state)
    }

    private fun materializeMockFindingPhotos(state: ProductDraftState) {
        val filesRoot = appContext?.filesDir ?: return
        state.findingState.findingsByItemKey.values
            .flatMap { finding -> finding.photos }
            .filter { photo -> photo.relativePath.startsWith("v3-findings/mock/") }
            .forEach { photo ->
                val file = File(filesRoot, photo.relativePath)
                if (file.exists() && file.length() > 0L) return@forEach
                runCatching { writeMockFindingPhoto(file, photo) }
                    .onFailure { error -> lastPersistenceError = error }
            }
    }

    private fun materializeMockVoiceAssets(state: ProductDraftState) {
        val context = appContext ?: return
        val filesRoot = context.filesDir
        state.voiceNotes
            .filter { note -> note.relativePath.startsWith("v3-voice-notes/mock/") }
            .forEach { note ->
                val file = File(filesRoot, note.relativePath)
                runCatching {
                    file.parentFile?.mkdirs()
                    context.assets.open(note.relativePath).use { input ->
                        FileOutputStream(file, false).use { output ->
                            input.copyTo(output)
                            output.fd.sync()
                        }
                    }
                }.onFailure { error -> lastPersistenceError = error }
            }
    }

    private fun writeMockFindingPhoto(
        file: File,
        photo: ProductFindingPhoto,
    ) {
        file.parentFile?.mkdirs()
        val width = 1200
        val height = 800
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val hashColor = photo.id.fold(0) { acc, char -> acc + char.code }
        val baseColor = Color.rgb(
            32 + hashColor % 42,
            82 + hashColor % 58,
            108 + hashColor % 46,
        )
        canvas.drawColor(baseColor)

        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        paint.color = Color.argb(44, 255, 255, 255)
        canvas.drawRect(48f, 48f, width - 48f, height - 48f, paint)
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 6f
        paint.color = Color.argb(180, 255, 255, 255)
        canvas.drawRect(72f, 72f, width - 72f, height - 72f, paint)
        paint.style = Paint.Style.FILL

        paint.color = Color.WHITE
        paint.textSize = 52f
        paint.isFakeBoldText = true
        canvas.drawText("LAIQ MOCK FIELD PHOTO", 108f, 150f, paint)

        paint.textSize = 34f
        paint.isFakeBoldText = false
        canvas.drawText("V10 API 653 inspection evidence placeholder", 108f, 210f, paint)

        paint.textSize = 44f
        paint.isFakeBoldText = true
        drawWrappedText(
            canvas = canvas,
            text = photo.displayName,
            x = 108f,
            y = 340f,
            maxWidth = width - 216f,
            lineHeight = 58f,
            paint = paint,
            maxLines = 5,
        )

        paint.textSize = 28f
        paint.isFakeBoldText = false
        paint.color = Color.argb(220, 255, 255, 255)
        canvas.drawText("Seeded for V3 Product demo and report-generation fixture.", 108f, height - 120f, paint)

        FileOutputStream(file, false).use { output ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
            output.fd.sync()
        }
        bitmap.recycle()
    }

    private fun drawWrappedText(
        canvas: Canvas,
        text: String,
        x: Float,
        y: Float,
        maxWidth: Float,
        lineHeight: Float,
        paint: Paint,
        maxLines: Int,
    ) {
        val words = text.split(Regex("\\s+")).filter { word -> word.isNotBlank() }
        val lines = mutableListOf<String>()
        var currentLine = ""
        words.forEach { word ->
            val candidate = if (currentLine.isBlank()) word else "$currentLine $word"
            if (paint.measureText(candidate) <= maxWidth) {
                currentLine = candidate
            } else {
                if (currentLine.isNotBlank()) lines += currentLine
                currentLine = word
            }
        }
        if (currentLine.isNotBlank()) lines += currentLine

        val clippedLines = lines.take(maxLines).toMutableList()
        if (lines.size > maxLines && clippedLines.isNotEmpty()) {
            val lastIndex = clippedLines.lastIndex
            clippedLines[lastIndex] = clippedLines[lastIndex].trimEnd('.', ',') + "..."
        }
        clippedLines.take(min(maxLines, clippedLines.size)).forEachIndexed { index, line ->
            canvas.drawText(line, x, y + index * lineHeight, paint)
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
        activeWorkflowScreen = ProductWorkflowScreen.fromKey(
            prefs()?.getString(ACTIVE_SCREEN_KEY, null).orEmpty(),
        )
        draftState = decodeFile(taskDraftFile(inspectionId))
            ?: decodeFile(taskBackupFile(inspectionId))
            ?: defaultProductPreviewDraftState()
        ensureDraftAssetsMaterialized()
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

    private fun loadLegacyDraftState(): ProductDraftState? {
        decodeFile(legacyDraftFile())?.let { return it }
        decodeFile(legacyBackupFile())?.let { return it }
        val savedJson = prefs()?.getString(LEGACY_DRAFT_STATE_KEY, null)
        if (savedJson.isNullOrBlank()) return null
        return runCatching { ProductDraftJsonCodec.decode(savedJson) }.getOrNull()
    }

    private fun clearLegacyDraftState() {
        prefs()?.edit()?.remove(LEGACY_DRAFT_STATE_KEY)?.apply()
        legacyDraftFile()?.takeIf { file -> file.exists() }?.delete()
        legacyBackupFile()?.takeIf { file -> file.exists() }?.delete()
    }

    private fun decodeFile(file: File?): ProductDraftState? {
        if (file == null || !file.exists() || file.length() <= 0L) return null
        return runCatching {
            ProductDraftJsonCodec.decode(file.readText(Charsets.UTF_8))
        }.getOrNull()
    }

    private fun persistTaskSnapshot(
        inspectionId: String,
        state: ProductDraftState,
    ) {
        val primary = taskDraftFile(inspectionId) ?: return
        val backup = taskBackupFile(inspectionId) ?: return
        persistAtomically(primary, backup, state)
    }

    private fun persistAtomically(
        primary: File,
        backup: File,
        state: ProductDraftState,
    ) {
        synchronized(ioLock) {
            primary.parentFile?.mkdirs()
            backup.parentFile?.mkdirs()
            val temp = File.createTempFile("draft-state-", ".tmp", primary.parentFile)
            try {
                writeSynced(temp, ProductDraftJsonCodec.encode(state))
                if (primary.exists() && primary.length() > 0L) {
                    copySynced(primary, backup)
                }
                if (primary.exists() && !primary.delete()) {
                    error("Unable to replace product task draft.")
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

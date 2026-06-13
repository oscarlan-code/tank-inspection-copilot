package ai.laiq.tankinspection.v2product.finding

import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.widget.Toast
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v2product.finding.V2FindingCaptureScreen
import ai.laiq.tankinspection.v2product.model.V2DraftState
import ai.laiq.tankinspection.v2product.model.V2FindingPhoto
import ai.laiq.tankinspection.v2product.model.V2FindingRecord
import ai.laiq.tankinspection.v2product.model.V2LayoutTarget
import ai.laiq.tankinspection.v2product.model.V2UtItemKind
import ai.laiq.tankinspection.v2product.model.V2UtMeasurementEntry
import ai.laiq.tankinspection.v2product.model.hasCapturedEvidence
import ai.laiq.tankinspection.v2product.model.withActiveFinding
import ai.laiq.tankinspection.v2product.model.withPhoto
import ai.laiq.tankinspection.v2product.model.withReplacedPhoto
import ai.laiq.tankinspection.v2product.model.withRemovedFinding
import ai.laiq.tankinspection.v2product.model.withSavedFinding
import ai.laiq.tankinspection.v2product.preview.V2PreviewSession
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import java.io.File
import java.time.Instant
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class V2FindingCapturePreviewActivity : ComponentActivity() {
    private var pendingCameraPhoto: V2FindingPhoto? = null
    private var pendingReplacementPhotoId: String? = null
    private var applyDraftUpdate: ((V2FindingRecord) -> Unit)? = null
    private var latestFindingRecord: V2FindingRecord? = null
    private var activeItemKeyForPhoto: String? = null

    private val takePictureLauncher = registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        val photo = pendingCameraPhoto
        val replacementPhotoId = pendingReplacementPhotoId
        pendingCameraPhoto = null
        pendingReplacementPhotoId = null
        if (success && photo != null) {
            if (replacementPhotoId != null) {
                replacePhotoInActiveFinding(replacementPhotoId, photo)
            } else {
                addPhotoToActiveFinding(photo)
            }
        } else if (photo != null) {
            File(filesDir, photo.relativePath).delete()
        }
    }

    private val importPhotoLauncher = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            lifecycleScope.launch {
                runCatching {
                    withContext(Dispatchers.IO) { importPhoto(uri) }
                }
                    .onSuccess(::addPhotoToActiveFinding)
                    .onFailure {
                        Toast.makeText(
                            this@V2FindingCapturePreviewActivity,
                            it.message ?: "Unable to import photo.",
                            Toast.LENGTH_LONG,
                        ).show()
                    }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        V2PreviewSession.attach(applicationContext)
        pendingCameraPhoto = savedInstanceState?.toPendingPhoto()
        val initialItemKey = intent.getStringExtra(EXTRA_ITEM_KEY).orEmpty()

        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var draftState by remember { mutableStateOf(V2PreviewSession.draftState) }
                    var activeItemKey by remember { mutableStateOf(initialItemKey) }
                    var record by remember {
                        mutableStateOf(blankFindingRecord(initialItemKey, V2PreviewSession.draftState))
                    }
                    activeItemKeyForPhoto = record.itemKey
                    latestFindingRecord = record

                    fun updateRecord(updated: V2FindingRecord) {
                        latestFindingRecord = updated
                        record = updated
                        activeItemKey = updated.itemKey
                        activeItemKeyForPhoto = updated.itemKey
                        val nextDraftState = draftState.copy(
                            findingState = draftState.findingState.withSavedFinding(updated),
                        )
                        draftState = nextDraftState
                        V2PreviewSession.updateDraftState(nextDraftState)
                    }

                    applyDraftUpdate = ::updateRecord

                    fun close() {
                        val latestRecord = latestFindingRecord ?: record
                        if (latestRecord.hasCapturedEvidence()) {
                            updateRecord(latestRecord)
                        }
                        finish()
                    }

                    fun deleteFinding(finding: V2FindingRecord) {
                        finding.photos.forEach { photo ->
                            File(filesDir, photo.relativePath).delete()
                        }
                        if (latestFindingRecord?.itemKey == finding.itemKey) {
                            latestFindingRecord = null
                        }
                        val nextFindingState = draftState.findingState.withRemovedFinding(finding.itemKey)
                        val nextDraftState = draftState.copy(findingState = nextFindingState)
                        draftState = nextDraftState
                        V2PreviewSession.updateDraftState(nextDraftState)
                        if (record.itemKey == finding.itemKey) {
                            val blankRecord = blankFindingRecord(finding.itemKey, nextDraftState)
                            record = blankRecord
                            latestFindingRecord = blankRecord
                            activeItemKey = blankRecord.itemKey
                            activeItemKeyForPhoto = blankRecord.itemKey
                        }
                    }

                    BackHandler { close() }
                    V2FindingCaptureScreen(
                        record = record,
                        allFindings = draftState.findingState.findingsByItemKey.values
                            .sortedWith(compareBy<V2FindingRecord> { it.target.key }.thenBy { it.itemLabel }),
                        imageRootDir = filesDir,
                        onRecordChange = ::updateRecord,
                        onSelectFinding = { selected ->
                            val latestRecord = latestFindingRecord ?: record
                            if (latestRecord.hasCapturedEvidence() && latestRecord.itemKey != selected.itemKey) {
                                updateRecord(latestRecord)
                            }
                            record = selected
                            activeItemKey = selected.itemKey
                            activeItemKeyForPhoto = selected.itemKey
                            latestFindingRecord = selected
                        },
                        onDeleteFinding = ::deleteFinding,
                        onTakePhoto = {
                            runCatching {
                                val photo = prepareCameraPhoto()
                                pendingCameraPhoto = photo
                                takePictureLauncher.launch(uriForPhoto(photo))
                            }.onFailure {
                                val photo = pendingCameraPhoto
                                pendingCameraPhoto = null
                                if (photo != null) File(filesDir, photo.relativePath).delete()
                                Toast.makeText(
                                    this,
                                    it.message ?: "No camera app available.",
                                    Toast.LENGTH_LONG,
                                ).show()
                            }
                        },
                        onRetakePhoto = { selectedPhoto ->
                            runCatching {
                                val photo = prepareCameraPhoto(displayName = selectedPhoto.displayName)
                                pendingCameraPhoto = photo
                                pendingReplacementPhotoId = selectedPhoto.id
                                takePictureLauncher.launch(uriForPhoto(photo))
                            }.onFailure {
                                val photo = pendingCameraPhoto
                                pendingCameraPhoto = null
                                pendingReplacementPhotoId = null
                                if (photo != null) File(filesDir, photo.relativePath).delete()
                                Toast.makeText(
                                    this,
                                    it.message ?: "No camera app available.",
                                    Toast.LENGTH_LONG,
                                ).show()
                            }
                        },
                        onImportPhoto = {
                            importPhotoLauncher.launch(arrayOf("image/*"))
                        },
                        onBack = { close() },
                    )
                }
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        pendingCameraPhoto?.let { photo ->
            outState.putString(KEY_PENDING_PHOTO_ID, photo.id)
            outState.putString(KEY_PENDING_PHOTO_PATH, photo.relativePath)
            outState.putString(KEY_PENDING_PHOTO_NAME, photo.displayName)
        }
    }

    private fun addPhotoToActiveFinding(photo: V2FindingPhoto) {
        val itemKey = activeItemKeyForPhoto ?: intent.getStringExtra(EXTRA_ITEM_KEY).orEmpty()
        val currentState = V2PreviewSession.draftState
        val currentRecord = latestFindingRecord?.takeIf { record -> record.itemKey == itemKey }
            ?: currentState.findingState.findingsByItemKey[itemKey]
            ?: currentState.utMeasurements.entriesByItemKey[itemKey]?.toFindingRecord()
            ?: fallbackFindingRecord(itemKey)
        val updatedRecord = currentRecord.withPhoto(photo)
        latestFindingRecord = updatedRecord
        val update = applyDraftUpdate
        if (update != null) {
            update(updatedRecord)
        } else {
            V2PreviewSession.updateDraftState(
                currentState.copy(findingState = currentState.findingState.withActiveFinding(updatedRecord)),
            )
        }
    }

    private fun replacePhotoInActiveFinding(photoId: String, replacement: V2FindingPhoto) {
        val itemKey = activeItemKeyForPhoto ?: intent.getStringExtra(EXTRA_ITEM_KEY).orEmpty()
        val currentState = V2PreviewSession.draftState
        val currentRecord = latestFindingRecord?.takeIf { record -> record.itemKey == itemKey }
            ?: currentState.findingState.findingsByItemKey[itemKey]
            ?: currentState.utMeasurements.entriesByItemKey[itemKey]?.toFindingRecord()
            ?: fallbackFindingRecord(itemKey)
        val oldPhoto = currentRecord.photos.firstOrNull { photo -> photo.id == photoId }
        val updatedRecord = currentRecord.withReplacedPhoto(photoId, replacement)
        latestFindingRecord = updatedRecord
        oldPhoto?.let { photo -> File(filesDir, photo.relativePath).delete() }
        val update = applyDraftUpdate
        if (update != null) {
            update(updatedRecord)
        } else {
            V2PreviewSession.updateDraftState(
                currentState.copy(findingState = currentState.findingState.withActiveFinding(updatedRecord)),
            )
        }
    }

    private fun prepareCameraPhoto(displayName: String? = null): V2FindingPhoto {
        val timestamp = Instant.now().toEpochMilli()
        val relativePath = "v2-findings/photo-$timestamp.jpg"
        File(filesDir, relativePath).also { file ->
            file.parentFile?.mkdirs()
            file.createNewFile()
        }
        return V2FindingPhoto(
            id = "photo-$timestamp",
            relativePath = relativePath,
            displayName = displayName ?: "Photo $timestamp",
        )
    }

    private fun importPhoto(uri: Uri): V2FindingPhoto {
        val sourceSize = resolveFileSize(uri)
        if (sourceSize != null && sourceSize > MAX_IMPORT_BYTES) {
            error("Photo is too large to import safely.")
        }
        val timestamp = Instant.now().toEpochMilli()
        val displayName = resolveDisplayName(uri).ifBlank { "imported-$timestamp.jpg" }
        val safeName = sanitizeFileName(displayName).ifBlank { "imported-$timestamp.jpg" }
        val relativePath = "v2-findings/imported-$timestamp-$safeName"
        val outputFile = File(filesDir, relativePath)
        outputFile.parentFile?.mkdirs()
        contentResolver.openInputStream(uri)?.use { input ->
            outputFile.outputStream().use { output -> input.copyTo(output) }
        } ?: error("Unable to read image")
        return V2FindingPhoto(
            id = "photo-$timestamp",
            relativePath = relativePath,
            displayName = displayName,
        )
    }

    private fun Bundle.toPendingPhoto(): V2FindingPhoto? {
        val id = getString(KEY_PENDING_PHOTO_ID) ?: return null
        val path = getString(KEY_PENDING_PHOTO_PATH) ?: return null
        val name = getString(KEY_PENDING_PHOTO_NAME) ?: "Photo"
        return V2FindingPhoto(id = id, relativePath = path, displayName = name)
    }

    private fun uriForPhoto(photo: V2FindingPhoto): Uri =
        FileProvider.getUriForFile(
            this,
            "$packageName.fileprovider",
            File(filesDir, photo.relativePath).also { file -> file.parentFile?.mkdirs() },
        )

    private fun resolveDisplayName(uri: Uri): String {
        val projection = arrayOf(OpenableColumns.DISPLAY_NAME)
        contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (nameIndex >= 0 && cursor.moveToFirst()) {
                return cursor.getString(nameIndex).orEmpty()
            }
        }
        return uri.lastPathSegment.orEmpty()
    }

    private fun resolveFileSize(uri: Uri): Long? {
        val projection = arrayOf(OpenableColumns.SIZE)
        contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
            val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (sizeIndex >= 0 && cursor.moveToFirst() && !cursor.isNull(sizeIndex)) {
                return cursor.getLong(sizeIndex)
            }
        }
        return null
    }

    private fun sanitizeFileName(value: String): String =
        value.replace(Regex("[^A-Za-z0-9._-]"), "_")

    private fun V2UtMeasurementEntry.toFindingRecord(): V2FindingRecord =
        V2FindingRecord(
            itemKey = itemKey,
            target = target,
            itemLabel = itemLabel,
            itemKind = kind,
            elementType = elementType,
        )

    private fun blankFindingRecord(itemKey: String, state: V2DraftState): V2FindingRecord =
        state.utMeasurements.entriesByItemKey[itemKey]?.toFindingRecord()
            ?: fallbackFindingRecord(itemKey)

    private fun fallbackFindingRecord(itemKey: String): V2FindingRecord =
        V2FindingRecord(
            itemKey = itemKey.ifBlank { "external_roof:region:unknown" },
            target = V2LayoutTarget.EXTERNAL_ROOF,
            itemLabel = itemKey.substringAfterLast(':').ifBlank { "Unknown" },
            itemKind = V2UtItemKind.LAYOUT_REGION,
        )

    companion object {
        const val EXTRA_ITEM_KEY = "item_key"
        private const val KEY_PENDING_PHOTO_ID = "pending_photo_id"
        private const val KEY_PENDING_PHOTO_PATH = "pending_photo_path"
        private const val KEY_PENDING_PHOTO_NAME = "pending_photo_name"
        private const val MAX_IMPORT_BYTES = 75L * 1024L * 1024L
    }
}

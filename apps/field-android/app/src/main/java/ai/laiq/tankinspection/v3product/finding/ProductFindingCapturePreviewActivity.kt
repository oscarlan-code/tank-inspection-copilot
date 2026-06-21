package ai.laiq.tankinspection.v3product.finding

import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.widget.Toast
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v3product.finding.ProductFindingCaptureScreen
import ai.laiq.tankinspection.v3product.model.ProductDraftState
import ai.laiq.tankinspection.v3product.model.ProductFindingPhoto
import ai.laiq.tankinspection.v3product.model.ProductFindingRecord
import ai.laiq.tankinspection.v3product.model.ProductLayoutTarget
import ai.laiq.tankinspection.v3product.model.ProductUtItemKind
import ai.laiq.tankinspection.v3product.model.ProductUtMeasurementEntry
import ai.laiq.tankinspection.v3product.model.hasCapturedEvidence
import ai.laiq.tankinspection.v3product.model.withActiveFinding
import ai.laiq.tankinspection.v3product.model.withPhoto
import ai.laiq.tankinspection.v3product.model.withReplacedPhoto
import ai.laiq.tankinspection.v3product.model.withRemovedFinding
import ai.laiq.tankinspection.v3product.model.withSavedFinding
import ai.laiq.tankinspection.v3product.preview.ProductPreviewSession
import ai.laiq.tankinspection.v3product.storage.ProductWorkflowScreen
import ai.laiq.tankinspection.v3product.voice.ProductVoiceCaptureHost
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

class ProductFindingCapturePreviewActivity : ComponentActivity() {
    private var pendingCameraPhoto: ProductFindingPhoto? = null
    private var pendingReplacementPhotoId: String? = null
    private var applyDraftUpdate: ((ProductFindingRecord) -> Unit)? = null
    private var latestFindingRecord: ProductFindingRecord? = null
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
                            this@ProductFindingCapturePreviewActivity,
                            it.message ?: "Unable to import photo.",
                            Toast.LENGTH_LONG,
                        ).show()
                    }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ProductPreviewSession.attach(applicationContext)
        ProductPreviewSession.setActiveWorkflowScreen(ProductWorkflowScreen.FINDINGS)
        pendingCameraPhoto = savedInstanceState?.toPendingPhoto()
        val initialItemKey = intent.getStringExtra(EXTRA_ITEM_KEY).orEmpty()

        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var draftState by remember { mutableStateOf(ProductPreviewSession.draftState) }
                    var activeItemKey by remember { mutableStateOf(initialItemKey) }
                    var record by remember {
                        mutableStateOf(blankFindingRecord(initialItemKey, ProductPreviewSession.draftState))
                    }
                    activeItemKeyForPhoto = record.itemKey
                    latestFindingRecord = record

                    fun updateRecord(updated: ProductFindingRecord) {
                        latestFindingRecord = updated
                        record = updated
                        activeItemKey = updated.itemKey
                        activeItemKeyForPhoto = updated.itemKey
                        val nextDraftState = draftState.copy(
                            findingState = draftState.findingState.withSavedFinding(updated),
                        )
                        draftState = nextDraftState
                        ProductPreviewSession.updateDraftState(nextDraftState)
                    }

                    applyDraftUpdate = ::updateRecord

                    fun close() {
                        val latestRecord = latestFindingRecord ?: record
                        if (latestRecord.hasCapturedEvidence()) {
                            updateRecord(latestRecord)
                        }
                        finish()
                    }

                    fun deleteFinding(finding: ProductFindingRecord) {
                        finding.photos.forEach { photo ->
                            File(filesDir, photo.relativePath).delete()
                        }
                        if (latestFindingRecord?.itemKey == finding.itemKey) {
                            latestFindingRecord = null
                        }
                        val nextFindingState = draftState.findingState.withRemovedFinding(finding.itemKey)
                        val nextDraftState = draftState.copy(findingState = nextFindingState)
                        draftState = nextDraftState
                        ProductPreviewSession.updateDraftState(nextDraftState)
                        if (record.itemKey == finding.itemKey) {
                            val blankRecord = blankFindingRecord(finding.itemKey, nextDraftState)
                            record = blankRecord
                            latestFindingRecord = blankRecord
                            activeItemKey = blankRecord.itemKey
                            activeItemKeyForPhoto = blankRecord.itemKey
                        }
                    }

                    ProductVoiceCaptureHost(
                        screen = ProductWorkflowScreen.FINDINGS,
                        cardKey = "finding_capture",
                        fieldKey = "finding_note",
                        targetKey = record.target.key,
                        targetLabel = record.target.label,
                        itemKey = record.itemKey,
                        itemLabel = record.itemLabel,
                    ) {
                        BackHandler { close() }
                        ProductFindingCaptureScreen(
                            record = record,
                            allFindings = draftState.findingState.findingsByItemKey.values
                                .sortedWith(compareBy<ProductFindingRecord> { it.target.key }.thenBy { it.itemLabel }),
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
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        pendingCameraPhoto?.let { photo ->
            outState.putString(KEY_PENDING_PHOTO_ID, photo.id)
            outState.putString(KEY_PENDING_PHOTO_PATH, photo.relativePath)
            outState.putString(KEY_PENDING_PHOTO_NAME, photo.displayName)
        }
    }

    private fun addPhotoToActiveFinding(photo: ProductFindingPhoto) {
        val itemKey = activeItemKeyForPhoto ?: intent.getStringExtra(EXTRA_ITEM_KEY).orEmpty()
        val currentState = ProductPreviewSession.draftState
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
            ProductPreviewSession.updateDraftState(
                currentState.copy(findingState = currentState.findingState.withActiveFinding(updatedRecord)),
            )
        }
    }

    private fun replacePhotoInActiveFinding(photoId: String, replacement: ProductFindingPhoto) {
        val itemKey = activeItemKeyForPhoto ?: intent.getStringExtra(EXTRA_ITEM_KEY).orEmpty()
        val currentState = ProductPreviewSession.draftState
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
            ProductPreviewSession.updateDraftState(
                currentState.copy(findingState = currentState.findingState.withActiveFinding(updatedRecord)),
            )
        }
    }

    private fun prepareCameraPhoto(displayName: String? = null): ProductFindingPhoto {
        val timestamp = Instant.now().toEpochMilli()
        val relativePath = "v3-findings/photo-$timestamp.jpg"
        File(filesDir, relativePath).also { file ->
            file.parentFile?.mkdirs()
            file.createNewFile()
        }
        return ProductFindingPhoto(
            id = "photo-$timestamp",
            relativePath = relativePath,
            displayName = displayName ?: "Photo $timestamp",
        )
    }

    private fun importPhoto(uri: Uri): ProductFindingPhoto {
        val sourceSize = resolveFileSize(uri)
        if (sourceSize != null && sourceSize > MAX_IMPORT_BYTES) {
            error("Photo is too large to import safely.")
        }
        val timestamp = Instant.now().toEpochMilli()
        val displayName = resolveDisplayName(uri).ifBlank { "imported-$timestamp.jpg" }
        val safeName = sanitizeFileName(displayName).ifBlank { "imported-$timestamp.jpg" }
        val relativePath = "v3-findings/imported-$timestamp-$safeName"
        val outputFile = File(filesDir, relativePath)
        outputFile.parentFile?.mkdirs()
        contentResolver.openInputStream(uri)?.use { input ->
            outputFile.outputStream().use { output -> input.copyTo(output) }
        } ?: error("Unable to read image")
        return ProductFindingPhoto(
            id = "photo-$timestamp",
            relativePath = relativePath,
            displayName = displayName,
        )
    }

    private fun Bundle.toPendingPhoto(): ProductFindingPhoto? {
        val id = getString(KEY_PENDING_PHOTO_ID) ?: return null
        val path = getString(KEY_PENDING_PHOTO_PATH) ?: return null
        val name = getString(KEY_PENDING_PHOTO_NAME) ?: "Photo"
        return ProductFindingPhoto(id = id, relativePath = path, displayName = name)
    }

    private fun uriForPhoto(photo: ProductFindingPhoto): Uri =
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

    private fun ProductUtMeasurementEntry.toFindingRecord(): ProductFindingRecord =
        ProductFindingRecord(
            itemKey = itemKey,
            target = target,
            itemLabel = itemLabel,
            itemKind = kind,
            elementType = elementType,
        )

    private fun blankFindingRecord(itemKey: String, state: ProductDraftState): ProductFindingRecord =
        state.utMeasurements.entriesByItemKey[itemKey]?.toFindingRecord()
            ?: fallbackFindingRecord(itemKey)

    private fun fallbackFindingRecord(itemKey: String): ProductFindingRecord =
        ProductFindingRecord(
            itemKey = itemKey.ifBlank { "external_roof:region:unknown" },
            target = ProductLayoutTarget.EXTERNAL_ROOF,
            itemLabel = itemKey.substringAfterLast(':').ifBlank { "Unknown" },
            itemKind = ProductUtItemKind.LAYOUT_REGION,
        )

    companion object {
        const val EXTRA_ITEM_KEY = "item_key"
        private const val KEY_PENDING_PHOTO_ID = "pending_photo_id"
        private const val KEY_PENDING_PHOTO_PATH = "pending_photo_path"
        private const val KEY_PENDING_PHOTO_NAME = "pending_photo_name"
        private const val MAX_IMPORT_BYTES = 75L * 1024L * 1024L
    }
}

package ai.laiq.tankinspection.v3product.voice

import android.content.Context
import android.content.Intent
import android.media.MediaPlayer
import android.os.Bundle
import android.widget.Toast
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.components.LaiqPrimaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSecondaryButton
import ai.laiq.tankinspection.presentation.components.LaiqSectionCard
import ai.laiq.tankinspection.presentation.components.LaiqStatusBadge
import ai.laiq.tankinspection.v3product.model.ProductVoiceNote
import ai.laiq.tankinspection.v3product.preview.ProductPreviewSession
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.io.File

class ProductVoicePreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ProductPreviewSession.attach(applicationContext)
        ProductPreviewSession.ensureDraftAssetsMaterialized()
        val filter = ProductVoicePreviewFilter.fromIntent(intent)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    BackHandler { finish() }
                    var scopedNotes by remember(filter) {
                        val allNotes = ProductPreviewSession.draftState.voiceNotes
                        val exactNotes = allNotes.filter { note -> filter.matchesExactly(note) }
                        val visibleNotes = exactNotes.takeIf { notes -> notes.isNotEmpty() }
                            ?: allNotes.filter { note -> filter.matchesRelated(note) }
                        mutableStateOf(
                            visibleNotes
                                .sortedByDescending { note -> note.capturedAtIso },
                        )
                    }
                    ProductVoicePreviewScreen(
                        filter = filter,
                        filesDir = filesDir,
                        notes = scopedNotes,
                        onBack = { finish() },
                        onDelete = { note ->
                            File(filesDir, note.relativePath).delete()
                            ProductPreviewSession.removeVoiceNote(note.id)
                            scopedNotes = scopedNotes.filterNot { existing -> existing.id == note.id }
                        },
                    )
                }
            }
        }
    }

    companion object {
        const val EXTRA_SCREEN_KEY = "screenKey"
        const val EXTRA_SCREEN_LABEL = "screenLabel"
        const val EXTRA_CARD_KEY = "cardKey"
        const val EXTRA_FIELD_KEY = "fieldKey"
        const val EXTRA_TARGET_KEY = "targetKey"
        const val EXTRA_TARGET_LABEL = "targetLabel"
        const val EXTRA_ITEM_KEY = "itemKey"
        const val EXTRA_ITEM_LABEL = "itemLabel"

        fun intent(
            context: Context,
            screenKey: String,
            screenLabel: String,
            cardKey: String,
            fieldKey: String,
            targetKey: String?,
            targetLabel: String?,
            itemKey: String?,
            itemLabel: String?,
        ): Intent =
            Intent(context, ProductVoicePreviewActivity::class.java)
                .putExtra(EXTRA_SCREEN_KEY, screenKey)
                .putExtra(EXTRA_SCREEN_LABEL, screenLabel)
                .putExtra(EXTRA_CARD_KEY, cardKey)
                .putExtra(EXTRA_FIELD_KEY, fieldKey)
                .putExtra(EXTRA_TARGET_KEY, targetKey)
                .putExtra(EXTRA_TARGET_LABEL, targetLabel)
                .putExtra(EXTRA_ITEM_KEY, itemKey)
                .putExtra(EXTRA_ITEM_LABEL, itemLabel)
    }
}

@Composable
private fun ProductVoicePreviewScreen(
    filter: ProductVoicePreviewFilter,
    filesDir: File,
    notes: List<ProductVoiceNote>,
    onBack: () -> Unit,
    onDelete: (ProductVoiceNote) -> Unit,
) {
    val context = LocalContext.current
    var playingId by remember { mutableStateOf<String?>(null) }
    var mediaPlayer by remember { mutableStateOf<MediaPlayer?>(null) }

    fun stopPlayback() {
        runCatching { mediaPlayer?.release() }
        mediaPlayer = null
        playingId = null
    }

    fun play(note: ProductVoiceNote) {
        stopPlayback()
        val file = File(filesDir, note.relativePath)
        if (!file.exists() || file.length() == 0L) return
        val player = MediaPlayer()
        runCatching {
            player.setDataSource(file.absolutePath)
            player.setOnCompletionListener { stopPlayback() }
            player.prepare()
            player.start()
        }.onSuccess {
            mediaPlayer = player
            playingId = note.id
        }.onFailure {
            runCatching { player.release() }
            Toast.makeText(context, "Unable to play this voice note.", Toast.LENGTH_SHORT).show()
        }
    }

    DisposableEffect(Unit) {
        onDispose { stopPlayback() }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 112.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item {
                Text(
                    text = "Voice Preview",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = LaiqColors.BrandTeal,
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
            }
            item {
                LaiqSectionCard(
                    title = filter.title,
                    subtitle = "Exact notes are shown first. If none exist yet, related notes for this screen or target are shown.",
                ) {
                    LaiqStatusBadge(
                        text = "${notes.size} note${if (notes.size == 1) "" else "s"}",
                        tone = if (notes.isNotEmpty()) LaiqColors.StatusReady else LaiqColors.MutedText,
                    )
                }
            }
            if (notes.isEmpty()) {
                item {
                    LaiqSectionCard(
                        title = "No voice notes yet",
                        subtitle = "Long-press and hold the mic button to record. Release to save.",
                    ) {}
                }
            } else {
                items(notes, key = { note -> note.id }) { note ->
                    VoiceNoteCard(
                        note = note,
                        file = File(filesDir, note.relativePath),
                        playing = playingId == note.id,
                        onPlay = { play(note) },
                        onStop = ::stopPlayback,
                        onDelete = {
                            if (playingId == note.id) stopPlayback()
                            onDelete(note)
                        },
                    )
                }
            }
        }

        Surface(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth(),
            color = Color.White,
            shadowElevation = 10.dp,
        ) {
            LaiqSecondaryButton(
                text = "Back",
                onClick = onBack,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
            )
        }
    }
}

@Composable
private fun VoiceNoteCard(
    note: ProductVoiceNote,
    file: File,
    playing: Boolean,
    onPlay: () -> Unit,
    onStop: () -> Unit,
    onDelete: () -> Unit,
) {
    val hasTranscript = note.transcriptText.isNotBlank()
    val hasFile = file.exists() && file.length() > 0L
    val hasPlayableAudio = hasFile && note.relativePath.isPlayableAudioPath()
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color.White,
        shape = MaterialTheme.shapes.large,
        border = BorderStroke(1.dp, LaiqColors.PanelBorder),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = note.displayName,
                style = MaterialTheme.typography.titleMedium,
                color = LaiqColors.BrandTeal,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = listOfNotNull(
                    note.itemLabel,
                    note.targetLabel,
                    note.capturedAtIso,
                ).joinToString(" | "),
                style = MaterialTheme.typography.bodyMedium,
                color = LaiqColors.MutedText,
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                LaiqStatusBadge(
                    text = when {
                        hasPlayableAudio -> note.durationMs?.let { "${(it / 1000.0).toDisplaySeconds()} sec" } ?: "Audio"
                        hasTranscript -> "Prepared transcript"
                        else -> "Audio"
                    },
                    tone = if (hasPlayableAudio || hasTranscript) LaiqColors.StatusReady else LaiqColors.BrandRed,
                )
                LaiqStatusBadge(
                    text = when {
                        hasPlayableAudio -> "${file.length()} bytes"
                        hasFile -> "Transcript artifact"
                        hasTranscript -> "Transcript only"
                        else -> "Missing file"
                    },
                    tone = if (hasPlayableAudio || hasTranscript) LaiqColors.MutedText else LaiqColors.BrandRed,
                )
            }
            if (hasTranscript) {
                Text(
                    text = "Transcript",
                    style = MaterialTheme.typography.labelLarge,
                    color = LaiqColors.MutedText,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = note.transcriptText,
                    style = MaterialTheme.typography.bodyMedium,
                    color = LaiqColors.BodyText,
                )
            }
            if (playing) {
                LaiqSecondaryButton(
                    text = "Stop",
                    onClick = onStop,
                    modifier = Modifier.fillMaxWidth(),
                )
            } else {
                LaiqPrimaryButton(
                    text = if (hasPlayableAudio) "Play" else "Transcript only",
                    onClick = onPlay,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = hasPlayableAudio,
                )
            }
            LaiqSecondaryButton(
                text = "Delete Voice Note",
                onClick = onDelete,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

private fun String.isPlayableAudioPath(): Boolean =
    substringAfterLast('.', missingDelimiterValue = "").lowercase() in setOf("m4a", "mp4", "wav")

private data class ProductVoicePreviewFilter(
    val screenKey: String,
    val screenLabel: String,
    val cardKey: String,
    val fieldKey: String,
    val targetKey: String?,
    val targetLabel: String?,
    val itemKey: String?,
    val itemLabel: String?,
) {
    val title: String =
        itemLabel ?: targetLabel ?: screenLabel

    fun matchesExactly(note: ProductVoiceNote): Boolean =
        note.screenKey == screenKey &&
            note.cardKey == cardKey &&
            note.fieldKey == fieldKey &&
            note.targetKey == targetKey &&
            note.itemKey == itemKey

    fun matchesRelated(note: ProductVoiceNote): Boolean {
        if (note.screenKey != screenKey) return false
        if (matchesExactly(note)) return true

        val requestIsScreenLevel = targetKey == null && itemKey == null
        if (requestIsScreenLevel) return true

        val sameItem = itemKey != null && note.itemKey == itemKey
        val sameTarget = targetKey != null && note.targetKey == targetKey
        val targetLevelNoteForSelectedTarget = sameTarget && note.itemKey == null
        val screenLevelNote = note.targetKey == null && note.itemKey == null

        return sameItem || targetLevelNoteForSelectedTarget || screenLevelNote
    }

    companion object {
        fun fromIntent(intent: Intent): ProductVoicePreviewFilter =
            ProductVoicePreviewFilter(
                screenKey = intent.getStringExtra(ProductVoicePreviewActivity.EXTRA_SCREEN_KEY).orEmpty(),
                screenLabel = intent.getStringExtra(ProductVoicePreviewActivity.EXTRA_SCREEN_LABEL).orEmpty(),
                cardKey = intent.getStringExtra(ProductVoicePreviewActivity.EXTRA_CARD_KEY).orEmpty(),
                fieldKey = intent.getStringExtra(ProductVoicePreviewActivity.EXTRA_FIELD_KEY).orEmpty(),
                targetKey = intent.getStringExtra(ProductVoicePreviewActivity.EXTRA_TARGET_KEY),
                targetLabel = intent.getStringExtra(ProductVoicePreviewActivity.EXTRA_TARGET_LABEL),
                itemKey = intent.getStringExtra(ProductVoicePreviewActivity.EXTRA_ITEM_KEY),
                itemLabel = intent.getStringExtra(ProductVoicePreviewActivity.EXTRA_ITEM_LABEL),
            )
    }
}

private fun Double.toDisplaySeconds(): String =
    "%.1f".format(this)

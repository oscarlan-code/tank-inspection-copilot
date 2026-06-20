package ai.laiq.tankinspection.v3product.voice

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.widget.Toast
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.v3product.model.ProductVoiceNote
import ai.laiq.tankinspection.v3product.preview.ProductPreviewSession
import ai.laiq.tankinspection.v3product.storage.ProductWorkflowScreen
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import java.io.File
import java.time.Duration
import java.time.Instant
import java.util.UUID

enum class ProductVoiceControlLevel {
    SCREEN,
    LOCAL,
}

private class ProductVoiceLayerState {
    var localControlCount by mutableIntStateOf(0)
}

private val LocalProductVoiceLayerState = staticCompositionLocalOf<ProductVoiceLayerState?> { null }

@Composable
fun ProductVoiceCaptureHost(
    screen: ProductWorkflowScreen,
    modifier: Modifier = Modifier.fillMaxSize(),
    buttonAlignment: Alignment = Alignment.TopEnd,
    compactButton: Boolean = false,
    controlLevel: ProductVoiceControlLevel = ProductVoiceControlLevel.SCREEN,
    showButton: Boolean = true,
    cardKey: String = "screen",
    fieldKey: String = "voice_note",
    targetKey: String? = null,
    targetLabel: String? = null,
    itemKey: String? = null,
    itemLabel: String? = null,
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val parentVoiceLayerState = LocalProductVoiceLayerState.current
    val voiceLayerState = remember(parentVoiceLayerState) { parentVoiceLayerState ?: ProductVoiceLayerState() }
    var activeCapture by remember { mutableStateOf<ProductVoiceCapture?>(null) }
    var lastTapUptimeMillis by remember { mutableStateOf(0L) }
    val buttonVisible = showButton &&
        (controlLevel == ProductVoiceControlLevel.LOCAL || voiceLayerState.localControlCount == 0)

    DisposableEffect(controlLevel, showButton) {
        if (controlLevel == ProductVoiceControlLevel.LOCAL && showButton) {
            voiceLayerState.localControlCount += 1
            onDispose {
                voiceLayerState.localControlCount = (voiceLayerState.localControlCount - 1).coerceAtLeast(0)
            }
        } else {
            onDispose {}
        }
    }

    fun startCapture() {
        if (activeCapture != null) return
        val noteId = UUID.randomUUID().toString()
        val startedAt = Instant.now()
        val relativePath = "v3-voice-notes/${screen.key}/${startedAt.toSafeFileToken()}-$noteId.m4a"
        val file = File(context.filesDir, relativePath)
        file.parentFile?.mkdirs()
        val recorder = MediaRecorder()
        val started = runCatching {
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC)
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            recorder.setOutputFile(file.absolutePath)
            recorder.prepare()
            recorder.start()
            activeCapture = ProductVoiceCapture(
                recorder = recorder,
                file = file,
                noteId = noteId,
                relativePath = relativePath,
                startedAt = startedAt,
                screenKey = screen.key,
                screenLabel = screen.label,
                cardKey = cardKey,
                fieldKey = fieldKey,
                targetKey = targetKey,
                targetLabel = targetLabel,
                itemKey = itemKey,
                itemLabel = itemLabel,
            )
        }
        started.onFailure { error ->
            recorder.releaseSafely()
            file.delete()
            Toast.makeText(
                context,
                error.message ?: "Unable to start voice note.",
                Toast.LENGTH_LONG,
            ).show()
        }
    }

    fun stopCapture(
        saveIfValid: Boolean = true,
        showTooShortToast: Boolean = true,
    ) {
        val capture = activeCapture ?: return
        activeCapture = null
        val stoppedAt = Instant.now()
        val stopped = runCatching {
            capture.recorder.stop()
        }.onFailure {
            capture.file.delete()
        }.isSuccess
        capture.recorder.releaseSafely()
        val durationMs = Duration.between(capture.startedAt, stoppedAt).toMillis().coerceAtLeast(0L)
        if (saveIfValid && stopped && capture.file.exists() && capture.file.length() > 0L) {
            ProductPreviewSession.addVoiceNote(
                ProductVoiceNote(
                    id = capture.noteId,
                    relativePath = capture.relativePath,
                    displayName = "${capture.screenLabel} voice note",
                    screenKey = capture.screenKey,
                    screenLabel = capture.screenLabel,
                    cardKey = capture.cardKey,
                    fieldKey = capture.fieldKey,
                    targetKey = capture.targetKey,
                    targetLabel = capture.targetLabel,
                    itemKey = capture.itemKey,
                    itemLabel = capture.itemLabel,
                    durationMs = durationMs,
                    capturedAtIso = capture.startedAt.toString(),
                ),
            )
            Toast.makeText(context, "Voice note saved for ${capture.screenLabel}.", Toast.LENGTH_SHORT).show()
        } else {
            capture.file.delete()
            if (showTooShortToast) {
                Toast.makeText(context, "Voice note was too short to save.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun openPreview() {
        context.startActivity(
            ProductVoicePreviewActivity.intent(
                context = context,
                screenKey = screen.key,
                screenLabel = screen.label,
                cardKey = cardKey,
                fieldKey = fieldKey,
                targetKey = targetKey,
                targetLabel = targetLabel,
                itemKey = itemKey,
                itemLabel = itemLabel,
            ),
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            startCapture()
        } else {
            Toast.makeText(context, "Microphone permission is required for voice notes.", Toast.LENGTH_LONG).show()
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            activeCapture?.let { capture ->
                capture.recorder.releaseSafely()
                capture.file.delete()
            }
            activeCapture = null
        }
    }

    CompositionLocalProvider(LocalProductVoiceLayerState provides voiceLayerState) {
        Box(modifier = modifier) {
            content()
            if (buttonVisible) {
                ProductVoiceHoldButton(
                    recording = activeCapture != null,
                    compact = compactButton,
                    modifier = Modifier
                        .align(buttonAlignment)
                        .then(if (compactButton) Modifier else Modifier.navigationBarsPadding())
                        .padding(if (compactButton) 8.dp else 18.dp)
                        .pointerInput(activeCapture, compactButton) {
                            awaitEachGesture {
                                val down = awaitFirstDown(requireUnconsumed = false)
                                val doubleTap = down.uptimeMillis - lastTapUptimeMillis <= 320L
                                if (doubleTap) {
                                    lastTapUptimeMillis = 0L
                                    openPreview()
                                    waitForUpOrCancellation()
                                    return@awaitEachGesture
                                }
                                val canRecord = ContextCompat.checkSelfPermission(
                                    context,
                                    Manifest.permission.RECORD_AUDIO,
                                ) == PackageManager.PERMISSION_GRANTED
                                if (canRecord) {
                                    startCapture()
                                    val up = waitForUpOrCancellation()
                                    val pressDuration = ((up?.uptimeMillis ?: down.uptimeMillis) - down.uptimeMillis)
                                        .coerceAtLeast(0L)
                                    stopCapture(
                                        saveIfValid = pressDuration >= 450L,
                                        showTooShortToast = pressDuration >= 450L,
                                    )
                                    lastTapUptimeMillis = if (pressDuration <= 240L) down.uptimeMillis else 0L
                                } else {
                                    permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                                    Toast.makeText(
                                        context,
                                        "Microphone permission requested. Hold mic again to record.",
                                        Toast.LENGTH_SHORT,
                                    ).show()
                                    waitForUpOrCancellation()
                                    lastTapUptimeMillis = 0L
                                }
                            }
                        },
                )
            }
        }
    }
}

@Composable
private fun ProductVoiceHoldButton(
    recording: Boolean,
    compact: Boolean,
    modifier: Modifier = Modifier,
) {
    val buttonSize = if (compact) 44.dp else 52.dp
    val iconSize = if (compact) 18.dp else 22.dp
    Surface(
        modifier = modifier.size(buttonSize),
        shape = CircleShape,
        color = if (recording) MaterialTheme.colorScheme.error else LaiqColors.BrandRed,
        shadowElevation = 6.dp,
    ) {
        Box(contentAlignment = Alignment.Center) {
            if (recording) {
                Text(
                    text = "REC",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = androidx.compose.ui.graphics.Color.White,
                )
            } else {
                Canvas(modifier = Modifier.size(iconSize)) {
                    val white = androidx.compose.ui.graphics.Color.White
                    val stroke = size.width * 0.12f
                    drawRoundRect(
                        color = white,
                        topLeft = Offset(size.width * 0.32f, size.height * 0.08f),
                        size = Size(size.width * 0.36f, size.height * 0.52f),
                        cornerRadius = CornerRadius(size.width * 0.18f, size.width * 0.18f),
                    )
                    drawLine(
                        color = white,
                        start = Offset(size.width * 0.18f, size.height * 0.42f),
                        end = Offset(size.width * 0.18f, size.height * 0.42f),
                        strokeWidth = stroke,
                    )
                    drawArc(
                        color = white,
                        startAngle = 20f,
                        sweepAngle = 140f,
                        useCenter = false,
                        topLeft = Offset(size.width * 0.18f, size.height * 0.32f),
                        size = Size(size.width * 0.64f, size.height * 0.42f),
                        style = androidx.compose.ui.graphics.drawscope.Stroke(width = stroke, cap = StrokeCap.Round),
                    )
                    drawLine(
                        color = white,
                        start = Offset(size.width * 0.5f, size.height * 0.72f),
                        end = Offset(size.width * 0.5f, size.height * 0.9f),
                        strokeWidth = stroke,
                        cap = StrokeCap.Round,
                    )
                    drawLine(
                        color = white,
                        start = Offset(size.width * 0.34f, size.height * 0.92f),
                        end = Offset(size.width * 0.66f, size.height * 0.92f),
                        strokeWidth = stroke,
                        cap = StrokeCap.Round,
                    )
                }
            }
        }
    }
}

private data class ProductVoiceCapture(
    val recorder: MediaRecorder,
    val file: File,
    val noteId: String,
    val relativePath: String,
    val startedAt: Instant,
    val screenKey: String,
    val screenLabel: String,
    val cardKey: String,
    val fieldKey: String,
    val targetKey: String?,
    val targetLabel: String?,
    val itemKey: String?,
    val itemLabel: String?,
)

private fun MediaRecorder.releaseSafely() {
    runCatching { release() }
}

private fun Instant.toSafeFileToken(): String =
    toString()
        .replace(":", "")
        .replace(".", "-")

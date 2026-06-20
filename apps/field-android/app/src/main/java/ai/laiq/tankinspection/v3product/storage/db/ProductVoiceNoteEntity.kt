package ai.laiq.tankinspection.v3product.storage.db

import androidx.room.Entity
import androidx.room.Index

@Entity(
    tableName = "v3_voice_note",
    primaryKeys = ["inspectionId", "voiceNoteId"],
    indices = [
        Index("inspectionId"),
        Index("screenKey"),
        Index("itemKey"),
    ],
)
data class ProductVoiceNoteEntity(
    val inspectionId: String,
    val voiceNoteId: String,
    val relativePath: String,
    val displayName: String,
    val screenKey: String,
    val screenLabel: String,
    val cardKey: String,
    val fieldKey: String,
    val targetKey: String?,
    val targetLabel: String?,
    val itemKey: String?,
    val itemLabel: String?,
    val transcriptStatus: String,
    val transcriptText: String?,
    val durationMs: Long?,
    val mediaType: String,
    val fileByteSize: Long?,
    val fileExists: Boolean,
    val capturedAtIso: String,
    val updatedAtIso: String,
)

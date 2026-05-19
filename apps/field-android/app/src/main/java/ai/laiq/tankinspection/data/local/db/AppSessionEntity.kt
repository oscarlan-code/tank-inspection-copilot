package ai.laiq.tankinspection.data.local.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "app_session")
data class AppSessionEntity(
    @PrimaryKey
    val sessionId: String = DEFAULT_SESSION_ID,
    val currentScreen: String,
    val draftJson: String,
    val activeInspectionId: String?,
    val updatedAtIso: String,
) {
    companion object {
        const val DEFAULT_SESSION_ID = "active"
    }
}

package ai.laiq.tankinspection

import ai.laiq.tankinspection.v3product.preview.ProductPreviewSession
import ai.laiq.tankinspection.v3product.storage.ProductTaskSummary
import ai.laiq.tankinspection.v3product.taskhome.ProductTaskHomeActivity
import android.content.Context
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.AndroidComposeTestRule
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.ExternalResource
import org.junit.rules.RuleChain
import java.io.File

class AppSmokeReviewTest {
    private val composeRule = createAndroidComposeRule<ProductTaskHomeActivity>()

    @get:Rule
    val ruleChain: RuleChain = RuleChain
        .outerRule(ClearAppDataRule())
        .around(composeRule)

    @Test
    fun v3ProductLauncher_seedsReviewAndExportsVoiceAudioContract() {
        composeRule.onNodeWithText("Task Home").assertIsDisplayed()
        composeRule.onNodeWithText("Ongoing Inspections").assertIsDisplayed()

        val task = composeRule.waitForSeededReadyTask()
        composeRule.assertAnyText("Continue")
        composeRule.assertAnyText("Review / Export")

        val exportSummary = ProductPreviewSession.exportInspection(task.inspectionId)
        val exportFile = File(
            InstrumentationRegistry.getInstrumentation().targetContext.filesDir,
            exportSummary.fileRelativePath,
        )
        val exportJson = JSONObject(exportFile.readText())

        assertEquals("v3_product_export", exportJson.getString("packageType"))
        assertEquals(3, exportJson.getInt("schemaVersion"))
        assertEquals("Demo Energy Storage Ltd", exportJson.getJSONObject("task").getString("client"))

        val voiceNotes = exportJson.getJSONArray("voiceNotes")
        val attachments = exportJson.getJSONArray("attachments")
        assertTrue("Expected mock export to include voice notes.", voiceNotes.length() > 0)

        val voiceAttachmentIds = buildSet {
            for (index in 0 until attachments.length()) {
                val attachment = attachments.getJSONObject(index)
                if (attachment.getString("kind") == "voice_audio") {
                    add(attachment.getString("attachmentId").removePrefix("voice:"))
                }
            }
        }

        for (index in 0 until voiceNotes.length()) {
            val note = voiceNotes.getJSONObject(index)
            assertEquals("audio/mp4", note.getString("mediaType"))
            assertTrue(
                "Unexpected voice transcript status: ${note.getString("transcriptStatus")}",
                note.getString("transcriptStatus") in setOf("pending_server", "transcribed_mock"),
            )
            assertTrue(
                "Voice note ${note.getString("voiceNoteId")} lacks a matching voice_audio attachment.",
                voiceAttachmentIds.contains(note.getString("voiceNoteId")),
            )
        }
    }
}

private class ClearAppDataRule : ExternalResource() {
    override fun before() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        context.deleteDatabase("laiq-field-db")
        context.deleteDatabase("laiq-field-v3-product-db")
        context
            .getSharedPreferences("v3_product_preview_session", Context.MODE_PRIVATE)
            .edit()
            .clear()
            .commit()
        listOf(
            "laiq-field-session-v1.json",
            "v3-product-session",
            "v3-product-exports",
            "v3-findings",
            "v3-voice-notes",
            "exports",
            "canonical-exports",
            "inspections",
        ).forEach { relativePath ->
            File(context.filesDir, relativePath).deleteRecursively()
        }
    }
}

private fun AndroidComposeTestRule<*, ProductTaskHomeActivity>.waitForSeededReadyTask(): ProductTaskSummary {
    var seededTask: ProductTaskSummary? = null
    waitUntil(timeoutMillis = 15_000) {
        seededTask = runCatching {
            ProductPreviewSession.listTaskSummaries()
                .firstOrNull { task -> task.readinessStatusCode == "ready" }
        }.getOrNull()
        seededTask != null
    }
    return requireNotNull(seededTask)
}

private fun AndroidComposeTestRule<*, ProductTaskHomeActivity>.assertAnyText(text: String) {
    waitUntil(timeoutMillis = 15_000) {
        onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
    }
}

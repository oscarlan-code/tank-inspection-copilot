package ai.laiq.tankinspection

import ai.laiq.tankinspection.testing.AppReviewTags
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Rule
import org.junit.Test
import org.junit.rules.ExternalResource
import org.junit.rules.RuleChain
import java.io.File

class AppSmokeReviewTest {
    private val composeRule = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val ruleChain: RuleChain = RuleChain
        .outerRule(ClearAppDataRule())
        .around(composeRule)

    @Test
    fun sampleInspection_canBeReloadedAndShowsExpectedShellUtCounts() {
        composeRule.onNodeWithTag(AppReviewTags.Setup.LoadSampleData).performClick()

        composeRule.waitForTag(AppReviewTags.Setup.OpenCurrentInspection)
        composeRule.onNodeWithTag(AppReviewTags.Setup.OpenCurrentInspection).performClick()

        composeRule.waitForTag(AppReviewTags.TaskBoard.Root)
        composeRule.onNodeWithTag(AppReviewTags.TaskBoard.OpenShellUt).performClick()

        composeRule.waitForTag(AppReviewTags.ShellUt.Root)
        composeRule.onNodeWithTag(AppReviewTags.ShellUt.SavedRowCount).assertTextContains("24")
        composeRule.onNodeWithTag(AppReviewTags.ShellUt.LaneCount).assertTextContains("4")
        composeRule.onNodeWithTag(AppReviewTags.ShellUt.RecommendedCount).assertTextContains("4")
    }

    @Test
    fun systemBack_stepsThroughTheInAppWorkflow() {
        composeRule.onNodeWithTag(AppReviewTags.Setup.LoadSampleData).performClick()

        composeRule.waitForTag(AppReviewTags.Setup.OpenCurrentInspection)
        composeRule.onNodeWithTag(AppReviewTags.Setup.OpenCurrentInspection).performClick()

        composeRule.waitForTag(AppReviewTags.TaskBoard.Root)
        composeRule.onNodeWithTag(AppReviewTags.TaskBoard.OpenShellUt).performClick()

        composeRule.waitForTag(AppReviewTags.ShellUt.Root)
        composeRule.pressSystemBack()

        composeRule.waitForTag(AppReviewTags.TaskBoard.Root)
        composeRule.pressSystemBack()

        composeRule.waitForTag(AppReviewTags.Scope.Root)
        composeRule.pressSystemBack()

        composeRule.waitForTag(AppReviewTags.Setup.Root)
    }
}

private class ClearAppDataRule : ExternalResource() {
    override fun before() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        context.deleteDatabase("laiq-field-db")
        File(context.filesDir, "laiq-field-session-v1.json").delete()
        File(context.filesDir, "exports").deleteRecursively()
        File(context.filesDir, "canonical-exports").deleteRecursively()
        File(context.filesDir, "inspections").deleteRecursively()
    }
}

private fun androidx.compose.ui.test.junit4.AndroidComposeTestRule<*, *>.waitForTag(tag: String) {
    waitUntil(timeoutMillis = 15_000) {
        onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
    }
}

private fun androidx.compose.ui.test.junit4.AndroidComposeTestRule<*, MainActivity>.pressSystemBack() {
    runOnUiThread {
        activity.onBackPressedDispatcher.onBackPressed()
    }
}

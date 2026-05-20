package ai.laiq.tankinspection.presentation

import ai.laiq.tankinspection.domain.model.AttachmentRecord
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WorkflowGuardrailsTest {
    @Test
    fun visibleSelectedTasks_alwaysKeepsReviewExportAtTheEnd() {
        val visibleTasks = visibleSelectedTasks(setOf(FieldTask.SHELL_UT, FieldTask.MFL_IMPORT))

        assertEquals(listOf(FieldTask.SHELL_UT, FieldTask.REVIEW_EXPORT), visibleTasks)
    }

    @Test
    fun validationErrors_requireAtLeastOneCaptureTask() {
        val draftState = FieldDraftState(
            setup = SetupFormState(
                client = "Client",
                site = "Site",
                tankNumber = "TK-1",
                diameterM = "10",
                heightM = "12",
                shellCourseCount = "4",
            ),
            scope = ScopeFormState(
                selectedTasks = setOf(FieldTask.REVIEW_EXPORT),
            ),
        )

        assertTrue(draftState.validationErrors().contains("Select at least one active task."))
    }

    @Test
    fun selectableFieldTasks_hidesDeferredMflTask() {
        assertFalse(selectableFieldTasks().contains(FieldTask.MFL_IMPORT))
    }

    @Test
    fun hasSavedMflAttachment_requiresMatchingSavedAttachment() {
        val draftWithoutAttachment = FieldDraftState(
            mflImportDraft = MflImportDraftInput(
                pdfRelativePath = "inspections/demo/mfl.pdf",
                attachmentId = "mfl-report",
            ),
        )

        assertFalse(draftWithoutAttachment.hasSavedMflAttachment())

        val draftWithAttachment = draftWithoutAttachment.copy(
            attachments = listOf(
                AttachmentRecord(
                    attachmentId = "mfl-report",
                    kind = "mfl_report",
                    relativePath = "inspections/demo/mfl.pdf",
                    caption = "Demo MFL report",
                ),
            ),
        )

        assertTrue(draftWithAttachment.hasSavedMflAttachment())
    }
}

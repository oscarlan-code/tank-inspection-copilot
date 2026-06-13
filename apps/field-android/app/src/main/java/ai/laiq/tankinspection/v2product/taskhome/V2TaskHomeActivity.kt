package ai.laiq.tankinspection.v2product.taskhome

import android.content.Intent
import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v2product.taskhome.V2ExportReviewUiState
import ai.laiq.tankinspection.presentation.v2product.taskhome.V2TaskHomeScreen
import ai.laiq.tankinspection.presentation.v2product.taskhome.V2TaskHomeUiState
import ai.laiq.tankinspection.v2product.checklist.V2InspectionChecklistPreviewActivity
import ai.laiq.tankinspection.v2product.elementsetup.V2ElementPlacementPreviewActivity
import ai.laiq.tankinspection.v2product.elementsetup.V2ElementSetupPreviewActivity
import ai.laiq.tankinspection.v2product.generalinfo.V2GeneralTankInformationPreviewActivity
import ai.laiq.tankinspection.v2product.layoutscope.V2LayoutScopePreviewActivity
import ai.laiq.tankinspection.v2product.layoutsetup.V2LayoutMapSetupPreviewActivity
import ai.laiq.tankinspection.v2product.preview.V2PreviewSession
import ai.laiq.tankinspection.v2product.storage.V2TaskSummary
import ai.laiq.tankinspection.v2product.storage.V2WorkflowScreen
import ai.laiq.tankinspection.v2product.utmeasurement.V2UtMeasurementPreviewActivity
import ai.laiq.tankinspection.v2product.utsetup.V2UtSetupPreviewActivity
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class V2TaskHomeActivity : ComponentActivity() {
    private var uiState by mutableStateOf(V2TaskHomeUiState())
    private var exportReviewState by mutableStateOf<V2ExportReviewUiState?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        V2PreviewSession.attach(applicationContext)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    V2TaskHomeScreen(
                        state = uiState,
                        exportReviewState = exportReviewState,
                        onStartNewInspection = {
                            exportReviewState = null
                            V2PreviewSession.beginNewInspection()
                            startActivity(Intent(this, V2GeneralTankInformationPreviewActivity::class.java))
                        },
                        onContinueInspection = { task ->
                            exportReviewState = null
                            if (V2PreviewSession.continueInspection(task.inspectionId)) {
                                startActivities(resumeIntentsFor(task.currentScreen))
                            }
                        },
                        onReviewExport = { task ->
                            openExportReview(task)
                        },
                        onDismissExportReview = {
                            exportReviewState = null
                        },
                        onExportInspection = { task ->
                            exportInspection(task)
                        },
                        onArchiveInspection = { task ->
                            lifecycleScope.launch {
                                withContext(Dispatchers.IO) {
                                    V2PreviewSession.archiveInspection(task.inspectionId)
                                }
                                refreshUi()
                            }
                        },
                        onDeleteInspection = { task ->
                            lifecycleScope.launch {
                                withContext(Dispatchers.IO) {
                                    V2PreviewSession.deleteInspection(task.inspectionId)
                                }
                                refreshUi()
                            }
                        },
                        onSaveProfile = { tenantName, workspaceName, displayName ->
                            lifecycleScope.launch {
                                withContext(Dispatchers.IO) {
                                    V2PreviewSession.updateLocalProfile(
                                        tenantName = tenantName,
                                        workspaceName = workspaceName,
                                        displayName = displayName,
                                    )
                                }
                                refreshUi()
                            }
                        },
                    )
                }
            }
        }
        refreshUi()
    }

    override fun onResume() {
        super.onResume()
        refreshUi()
    }

    private fun refreshUi() {
        lifecycleScope.launch {
            uiState = uiState.copy(isLoading = true)
            val profile = withContext(Dispatchers.IO) { V2PreviewSession.loadLocalProfile() }
            val tasks = withContext(Dispatchers.IO) { V2PreviewSession.listTaskSummaries() }
            uiState = V2TaskHomeUiState(
                isLoading = false,
                profile = profile,
                tasks = tasks,
            )
        }
    }

    private fun openExportReview(task: V2TaskSummary) {
        exportReviewState = V2ExportReviewUiState(task = task, isLoading = true)
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    loadExportReviewBundle(task)
                }
            }.onSuccess { bundle ->
                uiState = uiState.copy(
                    isLoading = false,
                    tasks = bundle.tasks,
                )
                exportReviewState = bundle.reviewState
            }.onFailure { error ->
                exportReviewState = V2ExportReviewUiState(
                    task = task,
                    isLoading = false,
                    errorMessage = error.message ?: "Unable to load export review.",
                )
            }
        }
    }

    private fun exportInspection(task: V2TaskSummary) {
        val currentState = exportReviewState ?: V2ExportReviewUiState(task = task)
        exportReviewState = currentState.copy(isExporting = true, errorMessage = null)
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    V2PreviewSession.exportInspection(task.inspectionId)
                    loadExportReviewBundle(task)
                }
            }.onSuccess { bundle ->
                uiState = uiState.copy(
                    isLoading = false,
                    tasks = bundle.tasks,
                )
                exportReviewState = bundle.reviewState
            }.onFailure { error ->
                exportReviewState = currentState.copy(
                    isLoading = false,
                    isExporting = false,
                    errorMessage = error.message ?: "Export failed.",
                )
            }
        }
    }

    private fun loadExportReviewBundle(task: V2TaskSummary): ExportReviewBundle {
        val tasks = V2PreviewSession.listTaskSummaries()
        val refreshedTask = tasks.firstOrNull { summary -> summary.inspectionId == task.inspectionId } ?: task
        return ExportReviewBundle(
            tasks = tasks,
            reviewState = V2ExportReviewUiState(
                task = refreshedTask,
                isLoading = false,
                validationChecks = V2PreviewSession.listExportValidationChecks(task.inspectionId),
                latestExportPackage = V2PreviewSession.latestExportPackage(task.inspectionId),
            ),
        )
    }

    private fun resumeIntentsFor(screen: V2WorkflowScreen): Array<Intent> =
        workflowPathFor(screen)
            .map { workflowScreen -> Intent(this, activityFor(workflowScreen)) }
            .toTypedArray()

    private fun workflowPathFor(screen: V2WorkflowScreen): List<V2WorkflowScreen> {
        val resumeTarget = when (screen) {
            V2WorkflowScreen.TASK_HOME,
            V2WorkflowScreen.GENERAL_INFO -> V2WorkflowScreen.GENERAL_INFO
            V2WorkflowScreen.FINDINGS -> V2WorkflowScreen.UT_MEASUREMENT
            else -> screen
        }
        val orderedWorkflow = listOf(
            V2WorkflowScreen.GENERAL_INFO,
            V2WorkflowScreen.LAYOUT_SCOPE,
            V2WorkflowScreen.LAYOUT_MAP_SETUP,
            V2WorkflowScreen.ELEMENT_SETUP,
            V2WorkflowScreen.ELEMENT_PLACEMENT,
            V2WorkflowScreen.UT_SETUP,
            V2WorkflowScreen.UT_MEASUREMENT,
            V2WorkflowScreen.CHECKLIST,
        )
        val targetIndex = orderedWorkflow.indexOf(resumeTarget)
        return if (targetIndex >= 0) {
            orderedWorkflow.subList(0, targetIndex + 1)
        } else {
            listOf(V2WorkflowScreen.GENERAL_INFO)
        }
    }

    private fun activityFor(screen: V2WorkflowScreen): Class<out ComponentActivity> =
        when (screen) {
            V2WorkflowScreen.TASK_HOME,
            V2WorkflowScreen.GENERAL_INFO -> V2GeneralTankInformationPreviewActivity::class.java
            V2WorkflowScreen.LAYOUT_SCOPE -> V2LayoutScopePreviewActivity::class.java
            V2WorkflowScreen.LAYOUT_MAP_SETUP -> V2LayoutMapSetupPreviewActivity::class.java
            V2WorkflowScreen.ELEMENT_SETUP -> V2ElementSetupPreviewActivity::class.java
            V2WorkflowScreen.ELEMENT_PLACEMENT -> V2ElementPlacementPreviewActivity::class.java
            V2WorkflowScreen.UT_SETUP -> V2UtSetupPreviewActivity::class.java
            V2WorkflowScreen.UT_MEASUREMENT -> V2UtMeasurementPreviewActivity::class.java
            V2WorkflowScreen.CHECKLIST -> V2InspectionChecklistPreviewActivity::class.java
            V2WorkflowScreen.FINDINGS -> V2UtMeasurementPreviewActivity::class.java
        }

    private data class ExportReviewBundle(
        val tasks: List<V2TaskSummary>,
        val reviewState: V2ExportReviewUiState,
    )
}

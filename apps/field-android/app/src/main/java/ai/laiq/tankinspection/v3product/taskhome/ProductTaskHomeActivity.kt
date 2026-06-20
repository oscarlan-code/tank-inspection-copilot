package ai.laiq.tankinspection.v3product.taskhome

import android.content.Intent
import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v3product.taskhome.ProductExportReviewUiState
import ai.laiq.tankinspection.presentation.v3product.taskhome.ProductTaskHomeScreen
import ai.laiq.tankinspection.presentation.v3product.taskhome.ProductTaskHomeUiState
import ai.laiq.tankinspection.v3product.checklist.ProductInspectionChecklistPreviewActivity
import ai.laiq.tankinspection.v3product.elementsetup.ProductElementPlacementPreviewActivity
import ai.laiq.tankinspection.v3product.elementsetup.ProductElementSetupPreviewActivity
import ai.laiq.tankinspection.v3product.generalinfo.ProductGeneralTankInformationPreviewActivity
import ai.laiq.tankinspection.v3product.layoutscope.ProductLayoutScopePreviewActivity
import ai.laiq.tankinspection.v3product.layoutsetup.ProductLayoutMapSetupPreviewActivity
import ai.laiq.tankinspection.v3product.preview.ProductPreviewSession
import ai.laiq.tankinspection.v3product.storage.ProductTaskSummary
import ai.laiq.tankinspection.v3product.storage.ProductWorkflowScreen
import ai.laiq.tankinspection.v3product.utmeasurement.ProductUtMeasurementPreviewActivity
import ai.laiq.tankinspection.v3product.utsetup.ProductUtSetupPreviewActivity
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

class ProductTaskHomeActivity : ComponentActivity() {
    private var uiState by mutableStateOf(ProductTaskHomeUiState())
    private var exportReviewState by mutableStateOf<ProductExportReviewUiState?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ProductPreviewSession.attach(applicationContext)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ProductTaskHomeScreen(
                        state = uiState,
                        exportReviewState = exportReviewState,
                        onStartNewInspection = {
                            exportReviewState = null
                            ProductPreviewSession.beginNewInspection()
                            startActivity(Intent(this, ProductGeneralTankInformationPreviewActivity::class.java))
                        },
                        onContinueInspection = { task ->
                            exportReviewState = null
                            if (ProductPreviewSession.continueInspection(task.inspectionId)) {
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
                                    ProductPreviewSession.archiveInspection(task.inspectionId)
                                }
                                refreshUi()
                            }
                        },
                        onDeleteInspection = { task ->
                            lifecycleScope.launch {
                                withContext(Dispatchers.IO) {
                                    ProductPreviewSession.deleteInspection(task.inspectionId)
                                }
                                refreshUi()
                            }
                        },
                        onSaveProfile = { tenantName, workspaceName, displayName ->
                            lifecycleScope.launch {
                                withContext(Dispatchers.IO) {
                                    ProductPreviewSession.updateLocalProfile(
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
            val profile = withContext(Dispatchers.IO) { ProductPreviewSession.loadLocalProfile() }
            val tasks = withContext(Dispatchers.IO) { ProductPreviewSession.listTaskSummaries() }
            uiState = ProductTaskHomeUiState(
                isLoading = false,
                profile = profile,
                tasks = tasks,
            )
        }
    }

    private fun openExportReview(task: ProductTaskSummary) {
        exportReviewState = ProductExportReviewUiState(task = task, isLoading = true)
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
                exportReviewState = ProductExportReviewUiState(
                    task = task,
                    isLoading = false,
                    errorMessage = error.message ?: "Unable to load export review.",
                )
            }
        }
    }

    private fun exportInspection(task: ProductTaskSummary) {
        val currentState = exportReviewState ?: ProductExportReviewUiState(task = task)
        exportReviewState = currentState.copy(isExporting = true, errorMessage = null)
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    ProductPreviewSession.exportInspection(task.inspectionId)
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

    private fun loadExportReviewBundle(task: ProductTaskSummary): ExportReviewBundle {
        val tasks = ProductPreviewSession.listTaskSummaries()
        val refreshedTask = tasks.firstOrNull { summary -> summary.inspectionId == task.inspectionId } ?: task
        return ExportReviewBundle(
            tasks = tasks,
            reviewState = ProductExportReviewUiState(
                task = refreshedTask,
                isLoading = false,
                validationChecks = ProductPreviewSession.listExportValidationChecks(task.inspectionId),
                latestExportPackage = ProductPreviewSession.latestExportPackage(task.inspectionId),
            ),
        )
    }

    private fun resumeIntentsFor(screen: ProductWorkflowScreen): Array<Intent> =
        workflowPathFor(screen)
            .map { workflowScreen -> Intent(this, activityFor(workflowScreen)) }
            .toTypedArray()

    private fun workflowPathFor(screen: ProductWorkflowScreen): List<ProductWorkflowScreen> {
        val resumeTarget = when (screen) {
            ProductWorkflowScreen.TASK_HOME,
            ProductWorkflowScreen.GENERAL_INFO -> ProductWorkflowScreen.GENERAL_INFO
            ProductWorkflowScreen.FINDINGS -> ProductWorkflowScreen.UT_MEASUREMENT
            else -> screen
        }
        val orderedWorkflow = listOf(
            ProductWorkflowScreen.GENERAL_INFO,
            ProductWorkflowScreen.LAYOUT_SCOPE,
            ProductWorkflowScreen.LAYOUT_MAP_SETUP,
            ProductWorkflowScreen.ELEMENT_SETUP,
            ProductWorkflowScreen.ELEMENT_PLACEMENT,
            ProductWorkflowScreen.UT_SETUP,
            ProductWorkflowScreen.UT_MEASUREMENT,
            ProductWorkflowScreen.CHECKLIST,
        )
        val targetIndex = orderedWorkflow.indexOf(resumeTarget)
        return if (targetIndex >= 0) {
            orderedWorkflow.subList(0, targetIndex + 1)
        } else {
            listOf(ProductWorkflowScreen.GENERAL_INFO)
        }
    }

    private fun activityFor(screen: ProductWorkflowScreen): Class<out ComponentActivity> =
        when (screen) {
            ProductWorkflowScreen.TASK_HOME,
            ProductWorkflowScreen.GENERAL_INFO -> ProductGeneralTankInformationPreviewActivity::class.java
            ProductWorkflowScreen.LAYOUT_SCOPE -> ProductLayoutScopePreviewActivity::class.java
            ProductWorkflowScreen.LAYOUT_MAP_SETUP -> ProductLayoutMapSetupPreviewActivity::class.java
            ProductWorkflowScreen.ELEMENT_SETUP -> ProductElementSetupPreviewActivity::class.java
            ProductWorkflowScreen.ELEMENT_PLACEMENT -> ProductElementPlacementPreviewActivity::class.java
            ProductWorkflowScreen.UT_SETUP -> ProductUtSetupPreviewActivity::class.java
            ProductWorkflowScreen.UT_MEASUREMENT -> ProductUtMeasurementPreviewActivity::class.java
            ProductWorkflowScreen.CHECKLIST -> ProductInspectionChecklistPreviewActivity::class.java
            ProductWorkflowScreen.FINDINGS -> ProductUtMeasurementPreviewActivity::class.java
        }

    private data class ExportReviewBundle(
        val tasks: List<ProductTaskSummary>,
        val reviewState: ProductExportReviewUiState,
    )
}

package ai.laiq.tankinspection.v3product.checklist

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v3product.checklist.ProductInspectionChecklistScreen
import ai.laiq.tankinspection.v3product.preview.ProductPreviewSession
import ai.laiq.tankinspection.v3product.storage.ProductWorkflowScreen
import ai.laiq.tankinspection.v3product.taskhome.ProductTaskHomeActivity
import ai.laiq.tankinspection.v3product.utmeasurement.ProductUtMeasurementPreviewActivity
import ai.laiq.tankinspection.v3product.voice.ProductVoiceCaptureHost
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier

class ProductInspectionChecklistPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ProductPreviewSession.attach(applicationContext)
        ProductPreviewSession.setActiveWorkflowScreen(ProductWorkflowScreen.CHECKLIST)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ProductVoiceCaptureHost(screen = ProductWorkflowScreen.CHECKLIST) {
                        var draftState by remember { mutableStateOf(ProductPreviewSession.draftState) }

                        fun goBackToUtMeasurements() {
                            ProductPreviewSession.updateDraftState(draftState)
                            startActivity(
                                Intent(this, ProductUtMeasurementPreviewActivity::class.java).apply {
                                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                                },
                            )
                            finish()
                        }

                        fun goToTaskHome() {
                            ProductPreviewSession.updateDraftState(draftState)
                            startActivity(
                                Intent(this, ProductTaskHomeActivity::class.java).apply {
                                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                                },
                            )
                            finish()
                        }

                        BackHandler { goBackToUtMeasurements() }

                        ProductInspectionChecklistScreen(
                            generalTankInfo = draftState.generalTankInfo,
                            state = draftState.inspectionChecklist,
                            onStateChange = { updatedChecklist ->
                                draftState = draftState.copy(inspectionChecklist = updatedChecklist)
                                ProductPreviewSession.updateInspectionChecklist(updatedChecklist)
                            },
                            onBack = { goBackToUtMeasurements() },
                            onContinue = { updatedChecklist ->
                                draftState = draftState.copy(inspectionChecklist = updatedChecklist)
                                ProductPreviewSession.updateInspectionChecklist(updatedChecklist)
                                Toast.makeText(
                                    this,
                                    "Checklist saved. Task is ready for export when the remaining validations pass.",
                                    Toast.LENGTH_LONG,
                                ).show()
                                goToTaskHome()
                            },
                        )
                    }
                }
            }
        }
    }
}

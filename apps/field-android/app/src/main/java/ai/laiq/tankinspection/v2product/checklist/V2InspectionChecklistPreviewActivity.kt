package ai.laiq.tankinspection.v2product.checklist

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v2product.checklist.V2InspectionChecklistScreen
import ai.laiq.tankinspection.v2product.preview.V2PreviewSession
import ai.laiq.tankinspection.v2product.storage.V2WorkflowScreen
import ai.laiq.tankinspection.v2product.taskhome.V2TaskHomeActivity
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

class V2InspectionChecklistPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        V2PreviewSession.attach(applicationContext)
        V2PreviewSession.setActiveWorkflowScreen(V2WorkflowScreen.CHECKLIST)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var draftState by remember { mutableStateOf(V2PreviewSession.draftState) }

                    fun goBackToUtMeasurements() {
                        V2PreviewSession.updateDraftState(draftState)
                        finish()
                    }

                    fun goToTaskHome() {
                        V2PreviewSession.updateDraftState(draftState)
                        startActivity(
                            Intent(this, V2TaskHomeActivity::class.java).apply {
                                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                            },
                        )
                        finish()
                    }

                    BackHandler { goBackToUtMeasurements() }

                    V2InspectionChecklistScreen(
                        generalTankInfo = draftState.generalTankInfo,
                        state = draftState.inspectionChecklist,
                        onStateChange = { updatedChecklist ->
                            draftState = draftState.copy(inspectionChecklist = updatedChecklist)
                            V2PreviewSession.updateInspectionChecklist(updatedChecklist)
                        },
                        onBack = { goBackToUtMeasurements() },
                        onContinue = { updatedChecklist ->
                            draftState = draftState.copy(inspectionChecklist = updatedChecklist)
                            V2PreviewSession.updateInspectionChecklist(updatedChecklist)
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

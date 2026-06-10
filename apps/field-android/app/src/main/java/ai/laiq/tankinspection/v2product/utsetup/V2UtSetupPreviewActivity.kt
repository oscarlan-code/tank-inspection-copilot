package ai.laiq.tankinspection.v2product.utsetup

import android.content.Intent
import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v2product.utsetup.V2UtSetupScreen
import ai.laiq.tankinspection.v2product.model.selectedTargets
import ai.laiq.tankinspection.v2product.model.withReconciledUtSetup
import ai.laiq.tankinspection.v2product.preview.V2PreviewSession
import ai.laiq.tankinspection.v2product.storage.V2WorkflowScreen
import ai.laiq.tankinspection.v2product.utmeasurement.V2UtMeasurementPreviewActivity
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

class V2UtSetupPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        V2PreviewSession.attach(applicationContext)
        V2PreviewSession.setActiveWorkflowScreen(V2WorkflowScreen.UT_SETUP)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var draftState by remember { mutableStateOf(V2PreviewSession.draftState) }
                    val approvedLayoutTargets = draftState.layoutScope.selectedTargets()
                        .filter { target -> target in draftState.layoutMapSetup.approvedTargets }

                    fun goBackToElementPlacement() {
                        V2PreviewSession.updateDraftState(draftState)
                        finish()
                    }

                    BackHandler { goBackToElementPlacement() }
                    V2UtSetupScreen(
                        generalTankInfo = draftState.generalTankInfo,
                        approvedLayoutTargets = approvedLayoutTargets,
                        state = draftState.utSetup,
                        onStateChange = {
                            draftState = draftState.withReconciledUtSetup(it)
                            V2PreviewSession.updateDraftState(draftState)
                        },
                        onBack = { goBackToElementPlacement() },
                        onContinue = {
                            V2PreviewSession.updateDraftState(draftState)
                            startActivity(Intent(this, V2UtMeasurementPreviewActivity::class.java))
                        },
                    )
                }
            }
        }
    }
}

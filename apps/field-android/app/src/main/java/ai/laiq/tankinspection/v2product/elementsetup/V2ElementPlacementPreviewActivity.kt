package ai.laiq.tankinspection.v2product.elementsetup

import android.content.Intent
import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v2product.elementsetup.V2ElementPlacementScreen
import ai.laiq.tankinspection.v2product.model.selectedTargets
import ai.laiq.tankinspection.v2product.model.withFirstAvailableTarget
import ai.laiq.tankinspection.v2product.model.withReconciledElementPlacement
import ai.laiq.tankinspection.v2product.preview.V2PreviewSession
import ai.laiq.tankinspection.v2product.storage.V2WorkflowScreen
import ai.laiq.tankinspection.v2product.utsetup.V2UtSetupPreviewActivity
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

class V2ElementPlacementPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        V2PreviewSession.attach(applicationContext)
        V2PreviewSession.setActiveWorkflowScreen(V2WorkflowScreen.ELEMENT_PLACEMENT)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var draftState by remember {
                        mutableStateOf(
                            V2PreviewSession.draftState.let { current ->
                                val approvedLayoutTargets = current.layoutScope.selectedTargets()
                                    .filter { target -> target in current.layoutMapSetup.approvedTargets }
                                val selectedElementTargets = current.elementSetup.selectedTargets()
                                    .filter { target -> target in approvedLayoutTargets }
                                current.copy(
                                    elementPlacement = current.elementPlacement.withFirstAvailableTarget(selectedElementTargets),
                                )
                            },
                        )
                    }

                    val approvedLayoutTargets = draftState.layoutScope.selectedTargets()
                        .filter { target -> target in draftState.layoutMapSetup.approvedTargets }
                    val visibleTargets = draftState.elementSetup.selectedTargets()
                        .filter { target -> target in approvedLayoutTargets }

                    fun openElementScope() {
                        V2PreviewSession.updateDraftState(draftState)
                        startActivity(
                            Intent(this, V2ElementSetupPreviewActivity::class.java).apply {
                                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                            },
                        )
                        finish()
                    }

                    BackHandler { openElementScope() }
                    V2ElementPlacementScreen(
                        generalTankInfo = draftState.generalTankInfo,
                        layoutMapSetup = draftState.layoutMapSetup,
                        visibleTargets = visibleTargets,
                        state = draftState.elementPlacement,
                        onStateChange = {
                            val nextDraftState = draftState.withReconciledElementPlacement(it)
                            draftState = nextDraftState
                            V2PreviewSession.updateDraftState(nextDraftState)
                        },
                        onBack = { openElementScope() },
                        onContinue = { approvedState ->
                            val nextDraftState = draftState.copy(elementPlacement = approvedState)
                            draftState = nextDraftState
                            V2PreviewSession.updateDraftState(nextDraftState)
                            startActivity(Intent(this, V2UtSetupPreviewActivity::class.java))
                        },
                    )
                }
            }
        }
    }
}

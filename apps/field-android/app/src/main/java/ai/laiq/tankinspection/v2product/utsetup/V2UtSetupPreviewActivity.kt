package ai.laiq.tankinspection.v2product.utsetup

import android.content.Intent
import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v2product.common.V2DownstreamDataWarningDialog
import ai.laiq.tankinspection.presentation.v2product.utsetup.V2UtSetupScreen
import ai.laiq.tankinspection.v2product.model.V2DownstreamDataImpact
import ai.laiq.tankinspection.v2product.model.V2DraftState
import ai.laiq.tankinspection.v2product.model.downstreamDataImpactComparedTo
import ai.laiq.tankinspection.v2product.model.selectedTargets
import ai.laiq.tankinspection.v2product.model.withReconciledUtSetup
import ai.laiq.tankinspection.v2product.elementsetup.V2ElementPlacementPreviewActivity
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
                    var pendingDraftState by remember { mutableStateOf<V2DraftState?>(null) }
                    var pendingImpact by remember { mutableStateOf<V2DownstreamDataImpact?>(null) }
                    val approvedLayoutTargets = draftState.layoutScope.selectedTargets()
                        .filter { target -> target in draftState.layoutMapSetup.approvedTargets }

                    fun goBackToElementPlacement() {
                        V2PreviewSession.updateDraftState(draftState)
                        startActivity(
                            Intent(this, V2ElementPlacementPreviewActivity::class.java).apply {
                                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                            },
                        )
                        finish()
                    }

                    fun applyDraftState(nextDraftState: V2DraftState) {
                        val impact = draftState.downstreamDataImpactComparedTo(nextDraftState)
                        if (impact != null) {
                            pendingDraftState = nextDraftState
                            pendingImpact = impact
                        } else {
                            draftState = nextDraftState
                            V2PreviewSession.updateDraftState(nextDraftState)
                        }
                    }

                    BackHandler { goBackToElementPlacement() }
                    V2UtSetupScreen(
                        generalTankInfo = draftState.generalTankInfo,
                        approvedLayoutTargets = approvedLayoutTargets,
                        state = draftState.utSetup,
                        onStateChange = {
                            applyDraftState(draftState.withReconciledUtSetup(it))
                        },
                        onBack = { goBackToElementPlacement() },
                        onContinue = {
                            V2PreviewSession.updateDraftState(draftState)
                            startActivity(Intent(this, V2UtMeasurementPreviewActivity::class.java))
                        },
                    )
                    pendingImpact?.let { impact ->
                        V2DownstreamDataWarningDialog(
                            impact = impact,
                            onDismiss = {
                                pendingImpact = null
                                pendingDraftState = null
                            },
                            onConfirm = {
                                pendingDraftState?.let { nextDraftState ->
                                    draftState = nextDraftState
                                    V2PreviewSession.updateDraftState(nextDraftState)
                                }
                                pendingImpact = null
                                pendingDraftState = null
                            },
                        )
                    }
                }
            }
        }
    }
}

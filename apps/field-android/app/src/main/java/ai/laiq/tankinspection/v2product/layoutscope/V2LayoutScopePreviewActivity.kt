package ai.laiq.tankinspection.v2product.layoutscope

import android.content.Intent
import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v2product.common.V2DownstreamDataWarningDialog
import ai.laiq.tankinspection.presentation.v2product.layoutscope.V2LayoutScopeScreen
import ai.laiq.tankinspection.v2product.generalinfo.V2GeneralTankInformationPreviewActivity
import ai.laiq.tankinspection.v2product.layoutsetup.V2LayoutMapSetupPreviewActivity
import ai.laiq.tankinspection.v2product.model.V2DownstreamDataImpact
import ai.laiq.tankinspection.v2product.model.V2DraftState
import ai.laiq.tankinspection.v2product.model.downstreamDataImpactComparedTo
import ai.laiq.tankinspection.v2product.model.selectedTargets
import ai.laiq.tankinspection.v2product.model.withFirstAvailableTarget
import ai.laiq.tankinspection.v2product.model.withReconciledLayoutScope
import ai.laiq.tankinspection.v2product.preview.V2PreviewSession
import ai.laiq.tankinspection.v2product.storage.V2WorkflowScreen
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

class V2LayoutScopePreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        V2PreviewSession.attach(applicationContext)
        V2PreviewSession.setActiveWorkflowScreen(V2WorkflowScreen.LAYOUT_SCOPE)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var draftState by remember { mutableStateOf(V2PreviewSession.draftState) }
                    var pendingDraftState by remember { mutableStateOf<V2DraftState?>(null) }
                    var pendingImpact by remember { mutableStateOf<V2DownstreamDataImpact?>(null) }

                    fun openGeneralTankInfo() {
                        V2PreviewSession.updateDraftState(draftState)
                        startActivity(
                            Intent(this, V2GeneralTankInformationPreviewActivity::class.java).apply {
                                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                            },
                        )
                        finish()
                    }

                    fun openLayoutMapSetup() {
                        val selectedTargets = draftState.layoutScope.selectedTargets()
                        val nextDraftState = draftState.copy(
                            layoutMapSetup = draftState.layoutMapSetup.withFirstAvailableTarget(selectedTargets),
                        )
                        V2PreviewSession.updateDraftState(nextDraftState)
                        startActivity(Intent(this, V2LayoutMapSetupPreviewActivity::class.java))
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

                    BackHandler { openGeneralTankInfo() }
                    V2LayoutScopeScreen(
                        generalTankInfo = draftState.generalTankInfo,
                        state = draftState.layoutScope,
                        onStateChange = {
                            applyDraftState(draftState.withReconciledLayoutScope(it))
                        },
                        onBack = { openGeneralTankInfo() },
                        onContinue = { openLayoutMapSetup() },
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

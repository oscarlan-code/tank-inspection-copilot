package ai.laiq.tankinspection.v2product.generalinfo

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v2product.common.V2DownstreamDataWarningDialog
import ai.laiq.tankinspection.presentation.v2product.generalinfo.V2GeneralTankInformationScreen
import ai.laiq.tankinspection.v2product.layoutscope.V2LayoutScopePreviewActivity
import ai.laiq.tankinspection.v2product.model.V2DownstreamDataImpact
import ai.laiq.tankinspection.v2product.model.V2DraftState
import ai.laiq.tankinspection.v2product.model.downstreamDataImpactComparedTo
import ai.laiq.tankinspection.v2product.model.withReconciledGeneralTankInfo
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

class V2GeneralTankInformationPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        V2PreviewSession.attach(applicationContext)
        V2PreviewSession.setActiveWorkflowScreen(V2WorkflowScreen.GENERAL_INFO)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var draftState by remember { mutableStateOf(V2PreviewSession.draftState) }
                    var pendingDraftState by remember { mutableStateOf<V2DraftState?>(null) }
                    var pendingImpact by remember { mutableStateOf<V2DownstreamDataImpact?>(null) }

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

                    BackHandler { finish() }
                    V2GeneralTankInformationScreen(
                        state = draftState.generalTankInfo,
                        onStateChange = {
                            applyDraftState(draftState.withReconciledGeneralTankInfo(it))
                        },
                        onBack = { finish() },
                        onContinue = {
                            V2PreviewSession.updateDraftState(draftState)
                            if (V2PreviewSession.ensureTaskCreated()) {
                                startActivity(
                                    Intent(this, V2LayoutScopePreviewActivity::class.java),
                                )
                            } else {
                                Toast.makeText(
                                    this,
                                    "Finish the required setup before creating the inspection task.",
                                    Toast.LENGTH_LONG,
                                ).show()
                            }
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

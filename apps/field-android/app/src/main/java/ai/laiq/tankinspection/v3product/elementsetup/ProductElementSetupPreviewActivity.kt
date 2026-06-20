package ai.laiq.tankinspection.v3product.elementsetup

import android.content.Intent
import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v3product.common.ProductDownstreamDataWarningDialog
import ai.laiq.tankinspection.presentation.v3product.elementsetup.ProductElementSetupScreen
import ai.laiq.tankinspection.v3product.layoutsetup.ProductLayoutMapSetupPreviewActivity
import ai.laiq.tankinspection.v3product.model.ProductDownstreamDataImpact
import ai.laiq.tankinspection.v3product.model.ProductDraftState
import ai.laiq.tankinspection.v3product.model.downstreamDataImpactComparedTo
import ai.laiq.tankinspection.v3product.model.selectedTargets
import ai.laiq.tankinspection.v3product.model.withReconciledElementSetup
import ai.laiq.tankinspection.v3product.preview.ProductPreviewSession
import ai.laiq.tankinspection.v3product.storage.ProductWorkflowScreen
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

class ProductElementSetupPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ProductPreviewSession.attach(applicationContext)
        ProductPreviewSession.setActiveWorkflowScreen(ProductWorkflowScreen.ELEMENT_SETUP)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ProductVoiceCaptureHost(screen = ProductWorkflowScreen.ELEMENT_SETUP) {
                        var draftState by remember { mutableStateOf(ProductPreviewSession.draftState) }
                        var pendingDraftState by remember { mutableStateOf<ProductDraftState?>(null) }
                        var pendingImpact by remember { mutableStateOf<ProductDownstreamDataImpact?>(null) }
                        val approvedLayoutTargets = draftState.layoutScope.selectedTargets()
                            .filter { target -> target in draftState.layoutMapSetup.approvedTargets }

                        fun goBackToLastLayout() {
                            ProductPreviewSession.updateDraftState(draftState)
                            startActivity(
                                Intent(this, ProductLayoutMapSetupPreviewActivity::class.java).apply {
                                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                                },
                            )
                            finish()
                        }

                        fun applyDraftState(nextDraftState: ProductDraftState) {
                            val impact = draftState.downstreamDataImpactComparedTo(nextDraftState)
                            if (impact != null) {
                                pendingDraftState = nextDraftState
                                pendingImpact = impact
                            } else {
                                draftState = nextDraftState
                                ProductPreviewSession.updateDraftState(nextDraftState)
                            }
                        }

                        BackHandler { goBackToLastLayout() }
                        ProductElementSetupScreen(
                            generalTankInfo = draftState.generalTankInfo,
                            approvedLayoutTargets = approvedLayoutTargets,
                            state = draftState.elementSetup,
                            onStateChange = {
                                applyDraftState(draftState.withReconciledElementSetup(it))
                            },
                            onBack = { goBackToLastLayout() },
                            onContinue = {
                                ProductPreviewSession.updateDraftState(draftState)
                                startActivity(Intent(this, ProductElementPlacementPreviewActivity::class.java))
                            },
                        )
                        pendingImpact?.let { impact ->
                            ProductDownstreamDataWarningDialog(
                                impact = impact,
                                onDismiss = {
                                    pendingImpact = null
                                    pendingDraftState = null
                                },
                                onConfirm = {
                                    pendingDraftState?.let { nextDraftState ->
                                        draftState = nextDraftState
                                        ProductPreviewSession.updateDraftState(nextDraftState)
                                    }
                                    pendingImpact = null
                                    pendingDraftState = null
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

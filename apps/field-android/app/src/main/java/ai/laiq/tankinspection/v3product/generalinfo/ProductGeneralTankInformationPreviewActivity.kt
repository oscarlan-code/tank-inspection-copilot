package ai.laiq.tankinspection.v3product.generalinfo

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v3product.common.ProductDownstreamDataWarningDialog
import ai.laiq.tankinspection.presentation.v3product.generalinfo.ProductGeneralTankInformationScreen
import ai.laiq.tankinspection.v3product.layoutscope.ProductLayoutScopePreviewActivity
import ai.laiq.tankinspection.v3product.model.ProductDownstreamDataImpact
import ai.laiq.tankinspection.v3product.model.ProductDraftState
import ai.laiq.tankinspection.v3product.model.downstreamDataImpactComparedTo
import ai.laiq.tankinspection.v3product.model.withReconciledGeneralTankInfo
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

class ProductGeneralTankInformationPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ProductPreviewSession.attach(applicationContext)
        ProductPreviewSession.setActiveWorkflowScreen(ProductWorkflowScreen.GENERAL_INFO)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ProductVoiceCaptureHost(screen = ProductWorkflowScreen.GENERAL_INFO) {
                        var draftState by remember { mutableStateOf(ProductPreviewSession.draftState) }
                        var pendingDraftState by remember { mutableStateOf<ProductDraftState?>(null) }
                        var pendingImpact by remember { mutableStateOf<ProductDownstreamDataImpact?>(null) }

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

                        BackHandler { finish() }
                        ProductGeneralTankInformationScreen(
                            state = draftState.generalTankInfo,
                            onStateChange = {
                                applyDraftState(draftState.withReconciledGeneralTankInfo(it))
                            },
                            onBack = { finish() },
                            onContinue = {
                                ProductPreviewSession.updateDraftState(draftState)
                                if (ProductPreviewSession.ensureTaskCreated()) {
                                    startActivity(
                                        Intent(this, ProductLayoutScopePreviewActivity::class.java),
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
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

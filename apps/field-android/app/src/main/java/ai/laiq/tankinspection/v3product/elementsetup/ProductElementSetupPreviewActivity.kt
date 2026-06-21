package ai.laiq.tankinspection.v3product.elementsetup

import android.content.Intent
import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v3product.common.ProductDownstreamDataWarningDialog
import ai.laiq.tankinspection.presentation.v3product.elementsetup.ProductElementSetupScreen
import ai.laiq.tankinspection.v3product.layoutsetup.ProductLayoutMapSetupPreviewActivity
import ai.laiq.tankinspection.v3product.model.ProductDownstreamDataImpact
import ai.laiq.tankinspection.v3product.model.ProductDraftState
import ai.laiq.tankinspection.v3product.model.ProductLayoutTarget
import ai.laiq.tankinspection.v3product.model.downstreamDataImpactComparedTo
import ai.laiq.tankinspection.v3product.model.selectedTargets
import ai.laiq.tankinspection.v3product.model.withActiveWorkflowTarget
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
        val requestedTarget = intent.getStringExtra(EXTRA_TARGET)
            ?.let { key -> ProductLayoutTarget.entries.firstOrNull { target -> target.key == key } }
        requestedTarget
            ?.takeIf { target -> target in ProductPreviewSession.draftState.layoutScope.selectedTargets() }
            ?.let { target ->
                ProductPreviewSession.updateDraftState(
                    ProductPreviewSession.draftState.withActiveWorkflowTarget(target),
                )
            }
        ProductPreviewSession.setActiveWorkflowScreen(ProductWorkflowScreen.ELEMENT_SETUP)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ProductVoiceCaptureHost(screen = ProductWorkflowScreen.ELEMENT_SETUP) {
                        var draftState by remember {
                            mutableStateOf(
                                ProductPreviewSession.draftState.let { current ->
                                    requestedTarget
                                        ?.takeIf { target -> target in current.layoutScope.selectedTargets() }
                                        ?.let { target -> current.withActiveWorkflowTarget(target) }
                                        ?: current
                                },
                            )
                        }
                        var pendingDraftState by remember { mutableStateOf<ProductDraftState?>(null) }
                        var pendingImpact by remember { mutableStateOf<ProductDownstreamDataImpact?>(null) }
                        val approvedLayoutTargets = draftState.layoutScope.selectedTargets()
                            .filter { target -> target in draftState.layoutMapSetup.approvedTargets }

                        fun latestDraftWithElementSetup(): ProductDraftState =
                            ProductPreviewSession.draftState.copy(
                                layoutMapSetup = draftState.layoutMapSetup,
                                elementSetup = draftState.elementSetup,
                                elementPlacement = draftState.elementPlacement,
                                utMeasurements = draftState.utMeasurements,
                            )

                        fun latestDraftWithElementSetupChanges(nextDraftState: ProductDraftState): ProductDraftState =
                            ProductPreviewSession.draftState.copy(
                                layoutMapSetup = nextDraftState.layoutMapSetup,
                                elementSetup = nextDraftState.elementSetup,
                                elementPlacement = nextDraftState.elementPlacement,
                                utMeasurements = nextDraftState.utMeasurements,
                                findingState = nextDraftState.findingState,
                            )

                        fun goBackToLastLayout() {
                            ProductPreviewSession.updateDraftState(latestDraftWithElementSetup())
                            startActivity(
                                Intent(this, ProductLayoutMapSetupPreviewActivity::class.java).apply {
                                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                                    putExtra(
                                        ProductLayoutMapSetupPreviewActivity.EXTRA_TARGET,
                                        draftState.layoutMapSetup.selectedTarget.key,
                                    )
                                },
                            )
                            finish()
                        }

                        fun applyDraftState(nextDraftState: ProductDraftState) {
                            val impact = draftState.downstreamDataImpactComparedTo(nextDraftState)
                            if (impact != null) {
                                pendingDraftState = latestDraftWithElementSetupChanges(nextDraftState)
                                pendingImpact = impact
                            } else {
                                val mergedDraftState = latestDraftWithElementSetupChanges(nextDraftState)
                                draftState = mergedDraftState
                                ProductPreviewSession.updateDraftState(mergedDraftState)
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
                                ProductPreviewSession.updateDraftState(latestDraftWithElementSetup())
                                val targetForNext = approvedLayoutTargets.firstOrNull()
                                startActivity(
                                    Intent(this, ProductElementPlacementPreviewActivity::class.java).apply {
                                        targetForNext?.let { target ->
                                            putExtra(ProductElementPlacementPreviewActivity.EXTRA_TARGET, target.key)
                                        }
                                    },
                                )
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

    companion object {
        const val EXTRA_TARGET = "target"
    }
}

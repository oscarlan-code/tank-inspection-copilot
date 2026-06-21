package ai.laiq.tankinspection.v3product.elementsetup

import android.content.Intent
import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v3product.common.ProductDownstreamDataWarningDialog
import ai.laiq.tankinspection.presentation.v3product.elementsetup.ProductElementPlacementScreen
import ai.laiq.tankinspection.v3product.model.ProductDownstreamDataImpact
import ai.laiq.tankinspection.v3product.model.ProductDraftState
import ai.laiq.tankinspection.v3product.model.ProductElementPlacementState
import ai.laiq.tankinspection.v3product.model.downstreamDataImpactComparedTo
import ai.laiq.tankinspection.v3product.model.selectedTargets
import ai.laiq.tankinspection.v3product.model.withActiveWorkflowTarget
import ai.laiq.tankinspection.v3product.model.withFirstAvailableTarget
import ai.laiq.tankinspection.v3product.model.withReconciledElementPlacement
import ai.laiq.tankinspection.v3product.model.withSelectedTarget
import ai.laiq.tankinspection.v3product.preview.ProductPreviewSession
import ai.laiq.tankinspection.v3product.storage.ProductWorkflowScreen
import ai.laiq.tankinspection.v3product.utsetup.ProductUtSetupPreviewActivity
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

class ProductElementPlacementPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ProductPreviewSession.attach(applicationContext)
        ProductPreviewSession.draftState.let { current ->
            val approvedLayoutTargets = current.layoutScope.selectedTargets()
                .filter { target -> target in current.layoutMapSetup.approvedTargets }
            val selectedElementTargets = current.elementSetup.selectedTargets()
                .filter { target -> target in approvedLayoutTargets }
            val targetForEntry = selectedElementTargets.firstOrNull()
            if (targetForEntry != null) {
                ProductPreviewSession.updateDraftState(current.withActiveWorkflowTarget(targetForEntry))
            }
        }
        ProductPreviewSession.setActiveWorkflowScreen(ProductWorkflowScreen.ELEMENT_PLACEMENT)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ProductVoiceCaptureHost(screen = ProductWorkflowScreen.ELEMENT_PLACEMENT) {
                        var draftState by remember {
                            mutableStateOf(
                                ProductPreviewSession.draftState.let { current ->
                                    val approvedLayoutTargets = current.layoutScope.selectedTargets()
                                        .filter { target -> target in current.layoutMapSetup.approvedTargets }
                                    val selectedElementTargets = current.elementSetup.selectedTargets()
                                        .filter { target -> target in approvedLayoutTargets }
                                    val targetForEntry = selectedElementTargets.firstOrNull()
                                    if (targetForEntry != null) {
                                        current.withActiveWorkflowTarget(targetForEntry)
                                    } else {
                                        current.copy(
                                            elementPlacement = current.elementPlacement
                                                .withFirstAvailableTarget(selectedElementTargets),
                                        )
                                    }
                                },
                            )
                        }
                        var pendingDraftState by remember { mutableStateOf<ProductDraftState?>(null) }
                        var pendingImpact by remember { mutableStateOf<ProductDownstreamDataImpact?>(null) }

                        val approvedLayoutTargets = draftState.layoutScope.selectedTargets()
                            .filter { target -> target in draftState.layoutMapSetup.approvedTargets }
                        val visibleTargets = draftState.elementSetup.selectedTargets()
                            .filter { target -> target in approvedLayoutTargets }

                        fun latestDraftWithElementPlacement(
                            placementState: ProductElementPlacementState = draftState.elementPlacement,
                        ): ProductDraftState {
                            val latestDraftState = ProductPreviewSession.draftState
                            return latestDraftState.copy(
                                layoutMapSetup = latestDraftState.layoutMapSetup
                                    .withSelectedTarget(placementState.selectedTarget),
                                elementPlacement = placementState,
                                utMeasurements = latestDraftState.utMeasurements
                                    .withSelectedTarget(placementState.selectedTarget),
                            )
                        }

                        fun latestDraftWithElementPlacementChanges(nextDraftState: ProductDraftState): ProductDraftState {
                            val latestDraftState = ProductPreviewSession.draftState
                            return latestDraftState.copy(
                                layoutMapSetup = nextDraftState.layoutMapSetup
                                    .withSelectedTarget(nextDraftState.elementPlacement.selectedTarget),
                                elementPlacement = nextDraftState.elementPlacement,
                                utMeasurements = nextDraftState.utMeasurements
                                    .withSelectedTarget(nextDraftState.elementPlacement.selectedTarget),
                                findingState = nextDraftState.findingState,
                            )
                        }

                        fun openElementScope() {
                            ProductPreviewSession.updateDraftState(latestDraftWithElementPlacement())
                            startActivity(
                                Intent(this, ProductElementSetupPreviewActivity::class.java).apply {
                                    flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                                    putExtra(ProductElementSetupPreviewActivity.EXTRA_TARGET, draftState.elementPlacement.selectedTarget.key)
                                },
                            )
                            finish()
                        }

                        fun applyDraftState(nextDraftState: ProductDraftState) {
                            val impact = draftState.downstreamDataImpactComparedTo(nextDraftState)
                            if (impact != null) {
                                pendingDraftState = latestDraftWithElementPlacementChanges(nextDraftState)
                                pendingImpact = impact
                            } else {
                                val mergedDraftState = latestDraftWithElementPlacementChanges(nextDraftState)
                                draftState = mergedDraftState
                                ProductPreviewSession.updateDraftState(mergedDraftState)
                            }
                        }

                        BackHandler { openElementScope() }
                        ProductElementPlacementScreen(
                            generalTankInfo = draftState.generalTankInfo,
                            layoutMapSetup = draftState.layoutMapSetup,
                            visibleTargets = visibleTargets,
                            state = draftState.elementPlacement,
                            onStateChange = {
                                applyDraftState(draftState.withReconciledElementPlacement(it))
                            },
                            onBack = { openElementScope() },
                            onContinue = { approvedState ->
                                val nextDraftState = latestDraftWithElementPlacement(approvedState)
                                draftState = nextDraftState
                                ProductPreviewSession.updateDraftState(nextDraftState)
                                startActivity(
                                    Intent(this, ProductUtSetupPreviewActivity::class.java)
                                        .putExtra(ProductUtSetupPreviewActivity.EXTRA_TARGET, approvedState.selectedTarget.key),
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

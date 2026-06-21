package ai.laiq.tankinspection.v3product.utsetup

import android.content.Intent
import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v3product.common.ProductDownstreamDataWarningDialog
import ai.laiq.tankinspection.presentation.v3product.utsetup.ProductUtSetupScreen
import ai.laiq.tankinspection.v3product.model.ProductDownstreamDataImpact
import ai.laiq.tankinspection.v3product.model.ProductDraftState
import ai.laiq.tankinspection.v3product.model.downstreamDataImpactComparedTo
import ai.laiq.tankinspection.v3product.model.selectedTargets
import ai.laiq.tankinspection.v3product.model.withActiveWorkflowTarget
import ai.laiq.tankinspection.v3product.model.withReconciledUtSetup
import ai.laiq.tankinspection.v3product.model.withSelectedTarget
import ai.laiq.tankinspection.v3product.elementsetup.ProductElementPlacementPreviewActivity
import ai.laiq.tankinspection.v3product.preview.ProductPreviewSession
import ai.laiq.tankinspection.v3product.storage.ProductWorkflowScreen
import ai.laiq.tankinspection.v3product.utmeasurement.ProductUtMeasurementPreviewActivity
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

class ProductUtSetupPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ProductPreviewSession.attach(applicationContext)
        ProductPreviewSession.draftState.let { current ->
            val approvedLayoutTargets = current.layoutScope.selectedTargets()
                .filter { target -> target in current.layoutMapSetup.approvedTargets }
            val selectedUtTargets = current.utSetup.selectedTargets()
                .filter { target -> target in approvedLayoutTargets }
            val targetForEntry = selectedUtTargets.firstOrNull()
            if (targetForEntry != null) {
                ProductPreviewSession.updateDraftState(current.withActiveWorkflowTarget(targetForEntry))
            }
        }
        ProductPreviewSession.setActiveWorkflowScreen(ProductWorkflowScreen.UT_SETUP)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ProductVoiceCaptureHost(screen = ProductWorkflowScreen.UT_SETUP) {
                        var draftState by remember {
                            mutableStateOf(
                                ProductPreviewSession.draftState.let { current ->
                                    val approvedLayoutTargets = current.layoutScope.selectedTargets()
                                        .filter { target -> target in current.layoutMapSetup.approvedTargets }
                                    val selectedUtTargets = current.utSetup.selectedTargets()
                                        .filter { target -> target in approvedLayoutTargets }
                                    val targetForEntry = selectedUtTargets.firstOrNull()
                                    targetForEntry
                                        ?.let { target -> current.withActiveWorkflowTarget(target) }
                                        ?: current
                                },
                            )
                        }
                        var pendingDraftState by remember { mutableStateOf<ProductDraftState?>(null) }
                        var pendingImpact by remember { mutableStateOf<ProductDownstreamDataImpact?>(null) }
                        val approvedLayoutTargets = draftState.layoutScope.selectedTargets()
                            .filter { target -> target in draftState.layoutMapSetup.approvedTargets }

                        fun latestDraftWithUtSetup(): ProductDraftState =
                            draftState.utMeasurements.selectedTarget.let { activeTarget ->
                                ProductPreviewSession.draftState.copy(
                                    layoutMapSetup = draftState.layoutMapSetup.withSelectedTarget(activeTarget),
                                    elementPlacement = draftState.elementPlacement.withSelectedTarget(activeTarget),
                                    utSetup = draftState.utSetup,
                                    utMeasurements = draftState.utMeasurements,
                                )
                            }

                        fun latestDraftWithUtSetupChanges(nextDraftState: ProductDraftState): ProductDraftState =
                            nextDraftState.utMeasurements.selectedTarget.let { activeTarget ->
                                ProductPreviewSession.draftState.copy(
                                    layoutMapSetup = nextDraftState.layoutMapSetup.withSelectedTarget(activeTarget),
                                    elementPlacement = nextDraftState.elementPlacement.withSelectedTarget(activeTarget),
                                    utSetup = nextDraftState.utSetup,
                                    utMeasurements = nextDraftState.utMeasurements,
                                    findingState = nextDraftState.findingState,
                                )
                            }

                        fun goBackToElementPlacement() {
                            ProductPreviewSession.updateDraftState(latestDraftWithUtSetup())
                            startActivity(
                                Intent(this, ProductElementPlacementPreviewActivity::class.java).apply {
                                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                                    putExtra(
                                        ProductElementPlacementPreviewActivity.EXTRA_TARGET,
                                        draftState.utMeasurements.selectedTarget.key,
                                    )
                                },
                            )
                            finish()
                        }

                        fun applyDraftState(nextDraftState: ProductDraftState) {
                            val impact = draftState.downstreamDataImpactComparedTo(nextDraftState)
                            if (impact != null) {
                                pendingDraftState = latestDraftWithUtSetupChanges(nextDraftState)
                                pendingImpact = impact
                            } else {
                                val mergedDraftState = latestDraftWithUtSetupChanges(nextDraftState)
                                draftState = mergedDraftState
                                ProductPreviewSession.updateDraftState(mergedDraftState)
                            }
                        }

                        BackHandler { goBackToElementPlacement() }
                        ProductUtSetupScreen(
                            generalTankInfo = draftState.generalTankInfo,
                            approvedLayoutTargets = approvedLayoutTargets,
                            state = draftState.utSetup,
                            onStateChange = {
                                applyDraftState(draftState.withReconciledUtSetup(it))
                            },
                            onBack = { goBackToElementPlacement() },
                            onContinue = {
                                val selectedUtTargets = draftState.utSetup.selectedTargets()
                                val targetForNext = selectedUtTargets.firstOrNull()
                                val latestDraft = latestDraftWithUtSetup()
                                val nextDraftState = targetForNext
                                    ?.let { target -> latestDraft.withActiveWorkflowTarget(target) }
                                    ?: latestDraft
                                ProductPreviewSession.updateDraftState(nextDraftState)
                                startActivity(
                                    Intent(this, ProductUtMeasurementPreviewActivity::class.java).apply {
                                        targetForNext?.let { target ->
                                            putExtra(ProductUtMeasurementPreviewActivity.EXTRA_TARGET, target.key)
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

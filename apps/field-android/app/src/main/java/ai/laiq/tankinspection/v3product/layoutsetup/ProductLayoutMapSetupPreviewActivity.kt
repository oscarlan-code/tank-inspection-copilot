package ai.laiq.tankinspection.v3product.layoutsetup

import android.content.Intent
import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v3product.common.ProductDownstreamDataWarningDialog
import ai.laiq.tankinspection.presentation.v3product.layoutsetup.ProductLayoutMapSetupScreen
import ai.laiq.tankinspection.v3product.elementsetup.ProductElementSetupPreviewActivity
import ai.laiq.tankinspection.v3product.layoutscope.ProductLayoutScopePreviewActivity
import ai.laiq.tankinspection.v3product.model.ProductDownstreamDataImpact
import ai.laiq.tankinspection.v3product.model.ProductDraftState
import ai.laiq.tankinspection.v3product.model.ProductLayoutSurface
import ai.laiq.tankinspection.v3product.model.ProductLayoutTarget
import ai.laiq.tankinspection.v3product.model.downstreamDataImpactComparedTo
import ai.laiq.tankinspection.v3product.model.roofSummaryLabel
import ai.laiq.tankinspection.v3product.model.selectedTargets
import ai.laiq.tankinspection.v3product.model.tankBadgeLabel
import ai.laiq.tankinspection.v3product.model.withFirstAvailableTarget
import ai.laiq.tankinspection.v3product.model.withReconciledLayoutMapSetup
import ai.laiq.tankinspection.v3product.model.withSelectedTarget
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

class ProductLayoutMapSetupPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ProductPreviewSession.attach(applicationContext)
        ProductPreviewSession.setActiveWorkflowScreen(ProductWorkflowScreen.LAYOUT_MAP_SETUP)
        val requestedTarget = intent.getStringExtra(EXTRA_TARGET)
            ?.let { key -> ProductLayoutTarget.entries.firstOrNull { it.key == key } }
        val requestedSurface = intent.getStringExtra(EXTRA_SURFACE)
            ?.let { key -> ProductLayoutSurface.entries.firstOrNull { it.key == key } }
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ProductVoiceCaptureHost(screen = ProductWorkflowScreen.LAYOUT_MAP_SETUP) {
                        var draftState by remember {
                        mutableStateOf(
                            ProductPreviewSession.draftState.let { current ->
                                val selectedTargets = current.layoutScope.selectedTargets()
                                val surfaceTarget = requestedSurface?.let { surface ->
                                    selectedTargets.firstOrNull { it.surface == surface }
                                }
                                val nextTarget = requestedTarget ?: surfaceTarget
                                val nextSetup = current.layoutMapSetup.withFirstAvailableTarget(selectedTargets)
                                    .let { setup ->
                                        if (nextTarget != null && nextTarget in selectedTargets) {
                                            setup.withSelectedTarget(nextTarget)
                                        } else {
                                            setup
                                        }
                                    }
                                current.copy(layoutMapSetup = nextSetup)
                            },
                        )
                    }
                        var pendingDraftState by remember { mutableStateOf<ProductDraftState?>(null) }
                        var pendingImpact by remember { mutableStateOf<ProductDownstreamDataImpact?>(null) }

	                    fun openLayoutScope() {
	                        ProductPreviewSession.updateDraftState(draftState)
	                        startActivity(
                            Intent(this, ProductLayoutScopePreviewActivity::class.java).apply {
                                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                            },
                        )
	                        finish()
	                    }

	                    val selectedTargets = draftState.layoutScope.selectedTargets()

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

	                    BackHandler { openLayoutScope() }
	                    ProductLayoutMapSetupScreen(
                        state = draftState.layoutMapSetup,
                        layoutTargets = selectedTargets,
                        tankLabel = draftState.tankBadgeLabel(),
                        roofLabel = draftState.roofSummaryLabel(),
                        onStateChange = {
                            applyDraftState(draftState.withReconciledLayoutMapSetup(it))
                        },
	                        onBack = { openLayoutScope() },
	                        onContinue = { approvedSetup ->
	                            val nextDraftState = draftState.copy(layoutMapSetup = approvedSetup)
	                            draftState = nextDraftState
	                            ProductPreviewSession.updateDraftState(nextDraftState)
	                            startActivity(Intent(this, ProductElementSetupPreviewActivity::class.java))
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

    companion object {
        const val EXTRA_SURFACE = "surface"
        const val EXTRA_TARGET = "target"
    }
}

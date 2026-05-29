package ai.laiq.tankinspection.v2.layoutsetup

import android.content.Intent
import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v2.layoutsetup.V2LayoutMapSetupScreen
import ai.laiq.tankinspection.v2.layoutscope.V2LayoutScopePreviewActivity
import ai.laiq.tankinspection.v2.model.V2LayoutSurface
import ai.laiq.tankinspection.v2.model.V2LayoutTarget
import ai.laiq.tankinspection.v2.model.roofSummaryLabel
import ai.laiq.tankinspection.v2.model.selectedTargets
import ai.laiq.tankinspection.v2.model.tankBadgeLabel
import ai.laiq.tankinspection.v2.model.toRoofLayoutMap
import ai.laiq.tankinspection.v2.model.withFirstAvailableTarget
import ai.laiq.tankinspection.v2.model.withSelectedTarget
import ai.laiq.tankinspection.v2.preview.V2PreviewSession
import ai.laiq.tankinspection.v2.rooflayout.V2RoofLayoutMapPreviewActivity
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

class V2LayoutMapSetupPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val requestedTarget = intent.getStringExtra(EXTRA_TARGET)
            ?.let { key -> V2LayoutTarget.entries.firstOrNull { it.key == key } }
        val requestedSurface = intent.getStringExtra(EXTRA_SURFACE)
            ?.let { key -> V2LayoutSurface.entries.firstOrNull { it.key == key } }
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var draftState by remember {
                        mutableStateOf(
                            V2PreviewSession.draftState.let { current ->
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

                    fun openLayoutScope() {
                        V2PreviewSession.updateDraftState(draftState)
                        startActivity(
                            Intent(this, V2LayoutScopePreviewActivity::class.java).apply {
                                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                            },
                        )
                        finish()
                    }

                    val selectedTargets = draftState.layoutScope.selectedTargets()

                    BackHandler { openLayoutScope() }
                    V2LayoutMapSetupScreen(
                        state = draftState.layoutMapSetup,
                        layoutTargets = selectedTargets,
                        tankLabel = draftState.tankBadgeLabel(),
                        roofLabel = draftState.roofSummaryLabel(),
                        onStateChange = {
                            draftState = draftState.copy(layoutMapSetup = it)
                            V2PreviewSession.updateDraftState(draftState)
                        },
                        onBack = { openLayoutScope() },
                        onContinue = {
                            val nextRoofTarget = selectedTargets.firstOrNull { target ->
                                target.surface == V2LayoutSurface.ROOF
                            }
                            val nextDraftState = if (nextRoofTarget != null) {
                                draftState.copy(
                                    layoutMapSetup = draftState.layoutMapSetup.withSelectedTarget(nextRoofTarget),
                                    roofLayoutMap = draftState.layoutMapSetup
                                        .withSelectedTarget(nextRoofTarget)
                                        .toRoofLayoutMap(),
                                )
                            } else {
                                draftState
                            }
                            V2PreviewSession.updateDraftState(nextDraftState)
                            if (nextRoofTarget != null) {
                                startActivity(Intent(this, V2RoofLayoutMapPreviewActivity::class.java))
                            }
                        },
                    )
                }
            }
        }
    }

    companion object {
        const val EXTRA_SURFACE = "surface"
        const val EXTRA_TARGET = "target"
    }
}

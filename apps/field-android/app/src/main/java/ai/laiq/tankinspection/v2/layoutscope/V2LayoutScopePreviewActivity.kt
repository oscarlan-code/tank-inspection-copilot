package ai.laiq.tankinspection.v2.layoutscope

import android.content.Intent
import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v2.layoutscope.V2LayoutScopeScreen
import ai.laiq.tankinspection.v2.generalinfo.V2GeneralTankInformationPreviewActivity
import ai.laiq.tankinspection.v2.layoutsetup.V2LayoutMapSetupPreviewActivity
import ai.laiq.tankinspection.v2.model.selectedTargets
import ai.laiq.tankinspection.v2.model.withFirstAvailableTarget
import ai.laiq.tankinspection.v2.model.withReconciledLayoutScope
import ai.laiq.tankinspection.v2.preview.V2PreviewSession
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
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var draftState by remember { mutableStateOf(V2PreviewSession.draftState) }

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

                    BackHandler { openGeneralTankInfo() }
                    V2LayoutScopeScreen(
                        generalTankInfo = draftState.generalTankInfo,
                        state = draftState.layoutScope,
                        onStateChange = {
                            draftState = draftState.withReconciledLayoutScope(it)
                            V2PreviewSession.updateDraftState(draftState)
                        },
                        onBack = { openGeneralTankInfo() },
                        onContinue = { openLayoutMapSetup() },
                    )
                }
            }
        }
    }
}

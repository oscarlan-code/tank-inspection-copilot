package ai.laiq.tankinspection.v2.elementsetup

import android.content.Intent
import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v2.elementsetup.V2ElementSetupScreen
import ai.laiq.tankinspection.v2.model.selectedTargets
import ai.laiq.tankinspection.v2.model.withReconciledElementSetup
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

class V2ElementSetupPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        V2PreviewSession.attach(applicationContext)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var draftState by remember { mutableStateOf(V2PreviewSession.draftState) }
                    val approvedLayoutTargets = draftState.layoutScope.selectedTargets()
                        .filter { target -> target in draftState.layoutMapSetup.approvedTargets }

                    fun goBackToLastLayout() {
                        V2PreviewSession.updateDraftState(draftState)
                        finish()
                    }

                    BackHandler { goBackToLastLayout() }
                    V2ElementSetupScreen(
                        generalTankInfo = draftState.generalTankInfo,
                        approvedLayoutTargets = approvedLayoutTargets,
                        state = draftState.elementSetup,
                        onStateChange = {
                            draftState = draftState.withReconciledElementSetup(it)
                            V2PreviewSession.updateDraftState(draftState)
                        },
                        onBack = { goBackToLastLayout() },
                        onContinue = {
                            V2PreviewSession.updateDraftState(draftState)
                            startActivity(Intent(this, V2ElementPlacementPreviewActivity::class.java))
                        },
                    )
                }
            }
        }
    }
}

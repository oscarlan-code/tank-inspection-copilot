package ai.laiq.tankinspection.v2.generalinfo

import android.content.Intent
import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v2.generalinfo.V2GeneralTankInformationScreen
import ai.laiq.tankinspection.v2.layoutscope.V2LayoutScopePreviewActivity
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

class V2GeneralTankInformationPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var draftState by remember { mutableStateOf(V2PreviewSession.draftState) }
                    BackHandler { finish() }
                    V2GeneralTankInformationScreen(
                        state = draftState.generalTankInfo,
                        onStateChange = {
                            draftState = draftState.copy(generalTankInfo = it)
                            V2PreviewSession.updateDraftState(draftState)
                        },
                        onBack = { finish() },
                        onContinue = {
                            V2PreviewSession.updateDraftState(draftState)
                            startActivity(
                                Intent(this, V2LayoutScopePreviewActivity::class.java),
                            )
                        },
                    )
                }
            }
        }
    }
}

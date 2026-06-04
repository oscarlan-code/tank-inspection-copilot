package ai.laiq.tankinspection.v2.scratch

import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v2.scratch.V2ScratchRoofLayoutPreviewScreen
import ai.laiq.tankinspection.v2.preview.V2PreviewSession
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier

class V2ScratchPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        V2PreviewSession.attach(applicationContext)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    V2ScratchRoofLayoutPreviewScreen(
                        onBack = { finish() },
                    )
                }
            }
        }
    }
}

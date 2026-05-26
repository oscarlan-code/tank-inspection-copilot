package ai.laiq.tankinspection.v2.rooflayout

import android.content.Intent
import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v2.rooflayout.V2RoofLayoutMapScreen
import ai.laiq.tankinspection.v2.layoutsetup.V2LayoutMapSetupPreviewActivity
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier

class V2RoofLayoutMapPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    fun openLayoutMapSetup() {
                        startActivity(
                            Intent(this, V2LayoutMapSetupPreviewActivity::class.java).apply {
                                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                            },
                        )
                        finish()
                    }

                    BackHandler { openLayoutMapSetup() }
                    V2RoofLayoutMapScreen(
                        onBack = { openLayoutMapSetup() },
                        onContinue = {},
                    )
                }
            }
        }
    }
}

package ai.laiq.tankinspection.v2.layoutsetup

import android.content.Intent
import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v2.layoutsetup.LayoutSurfaceSelection
import ai.laiq.tankinspection.presentation.v2.layoutsetup.V2LayoutMapSetupScreen
import ai.laiq.tankinspection.v2.generalinfo.V2GeneralTankInformationPreviewActivity
import ai.laiq.tankinspection.v2.rooflayout.V2RoofLayoutMapPreviewActivity
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier

class V2LayoutMapSetupPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    fun openGeneralTankInfo() {
                        startActivity(
                            Intent(this, V2GeneralTankInformationPreviewActivity::class.java).apply {
                                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                            },
                        )
                        finish()
                    }

                    BackHandler { openGeneralTankInfo() }
                    V2LayoutMapSetupScreen(
                        onBack = { openGeneralTankInfo() },
                        onContinue = { selectedSurface ->
                            if (selectedSurface == LayoutSurfaceSelection.ROOF) {
                                startActivity(
                                    Intent(this, V2RoofLayoutMapPreviewActivity::class.java),
                                )
                            }
                        },
                    )
                }
            }
        }
    }
}

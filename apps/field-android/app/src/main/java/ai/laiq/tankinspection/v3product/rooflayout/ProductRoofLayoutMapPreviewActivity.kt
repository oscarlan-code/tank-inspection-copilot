package ai.laiq.tankinspection.v3product.rooflayout

import android.content.Intent
import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v3product.rooflayout.ProductRoofLayoutMapScreen
import ai.laiq.tankinspection.v3product.layoutsetup.ProductLayoutMapSetupPreviewActivity
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

class ProductRoofLayoutMapPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ProductPreviewSession.attach(applicationContext)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ProductVoiceCaptureHost(
                        screen = ProductWorkflowScreen.LAYOUT_MAP_SETUP,
                        cardKey = "roof_layout_map",
                    ) {
                        var draftState by remember { mutableStateOf(ProductPreviewSession.draftState) }

                        fun openLayoutMapSetup() {
                            ProductPreviewSession.updateDraftState(draftState)
                            startActivity(
                                Intent(this, ProductLayoutMapSetupPreviewActivity::class.java).apply {
                                    flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                                },
                            )
                            finish()
                        }

                        BackHandler { openLayoutMapSetup() }
                        ProductRoofLayoutMapScreen(
                            state = draftState.roofLayoutMap,
                            onStateChange = {
                                draftState = draftState.copy(roofLayoutMap = it)
                                ProductPreviewSession.updateDraftState(draftState)
                            },
                            onBack = { openLayoutMapSetup() },
                            onContinue = { ProductPreviewSession.updateDraftState(draftState) },
                        )
                    }
                }
            }
        }
    }
}

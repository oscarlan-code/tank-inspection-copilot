package ai.laiq.tankinspection.v3product.scratch

import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v3product.scratch.ProductScratchRoofLayoutPreviewScreen
import ai.laiq.tankinspection.v3product.preview.ProductPreviewSession
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier

class ProductScratchPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ProductPreviewSession.attach(applicationContext)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ProductScratchRoofLayoutPreviewScreen(
                        onBack = { finish() },
                    )
                }
            }
        }
    }
}

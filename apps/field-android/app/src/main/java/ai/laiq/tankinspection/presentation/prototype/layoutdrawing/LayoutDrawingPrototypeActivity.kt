package ai.laiq.tankinspection.presentation.prototype.layoutdrawing

import android.content.pm.ActivityInfo
import android.os.Bundle
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.prototype.layoutdrawing.PrototypeLayoutExportRepository
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier

class LayoutDrawingPrototypeActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    LayoutDrawingPrototypeScreen(
                        exportRepository = PrototypeLayoutExportRepository(applicationContext),
                    )
                }
            }
        }
    }
}

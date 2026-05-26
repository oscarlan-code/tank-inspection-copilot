package ai.laiq.tankinspection.v2.generalinfo

import android.content.Intent
import android.os.Bundle
import ai.laiq.tankinspection.presentation.GeneralTankInfoFormState
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v2.generalinfo.V2GeneralTankInformationScreen
import ai.laiq.tankinspection.v2.layoutsetup.V2LayoutMapSetupPreviewActivity
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
                    var state by remember { mutableStateOf(defaultGeneralTankInfoPreviewState()) }
                    BackHandler { finish() }
                    V2GeneralTankInformationScreen(
                        state = state,
                        onStateChange = { state = it },
                        onBack = { finish() },
                        onContinue = {
                            startActivity(
                                Intent(this, V2LayoutMapSetupPreviewActivity::class.java),
                            )
                        },
                    )
                }
            }
        }
    }
}

private fun defaultGeneralTankInfoPreviewState(): GeneralTankInfoFormState =
    GeneralTankInfoFormState(
        client = "Pacific Energy",
        tankNumber = "TK-13",
        location = "Utulei, American Samoa",
        fieldLeaseName = "Pacific Terminal",
        shellConstruction = "butt",
        externalRoofType = "cone",
        internalRoofType = "na",
        productStored = "Diesel",
        diameter = "16.0",
        height = "12.0",
        serviceHeight = "10.8",
        courseNumber = "6",
    )

package ai.laiq.tankinspection.v2product.utmeasurement

import android.os.Bundle
import android.widget.Toast
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v2product.utmeasurement.V2UtMeasurementScreen
import ai.laiq.tankinspection.v2product.checklist.V2InspectionChecklistPreviewActivity
import ai.laiq.tankinspection.v2product.finding.V2FindingCapturePreviewActivity
import ai.laiq.tankinspection.v2product.model.placementsFor
import ai.laiq.tankinspection.v2product.model.selectedTargets
import ai.laiq.tankinspection.v2product.model.withFirstAvailableTarget
import ai.laiq.tankinspection.v2product.model.withSelectedEntry
import ai.laiq.tankinspection.v2product.model.withUpdatedEntry
import ai.laiq.tankinspection.v2product.preview.V2PreviewSession
import ai.laiq.tankinspection.v2product.storage.V2WorkflowScreen
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

class V2UtMeasurementPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        V2PreviewSession.attach(applicationContext)
        V2PreviewSession.setActiveWorkflowScreen(V2WorkflowScreen.UT_MEASUREMENT)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var draftState by remember {
                        mutableStateOf(
                            V2PreviewSession.draftState.let { current ->
                                val approvedLayoutTargets = current.layoutScope.selectedTargets()
                                    .filter { target -> target in current.layoutMapSetup.approvedTargets }
                                val selectedUtTargets = current.utSetup.selectedTargets()
                                    .filter { target -> target in approvedLayoutTargets }
                                current.copy(
                                    utMeasurements = current.utMeasurements.withFirstAvailableTarget(selectedUtTargets),
                                )
                            },
                        )
                    }
                    val approvedLayoutTargets = draftState.layoutScope.selectedTargets()
                        .filter { target -> target in draftState.layoutMapSetup.approvedTargets }
                    val visibleTargets = draftState.utSetup.selectedTargets()
                        .filter { target -> target in approvedLayoutTargets }
                    val placementsByTarget = visibleTargets.associateWith { target ->
                        draftState.elementPlacement.placementsFor(target)
                    }

                    fun goBackToUtScope() {
                        V2PreviewSession.updateDraftState(draftState)
                        finish()
                    }

                    BackHandler { goBackToUtScope() }
                    V2UtMeasurementScreen(
                        generalTankInfo = draftState.generalTankInfo,
                        layoutMapSetup = draftState.layoutMapSetup,
                        visibleTargets = visibleTargets,
                        placementsByTarget = placementsByTarget,
	                        state = draftState.utMeasurements,
	                        onStateChange = {
	                            draftState = draftState.copy(utMeasurements = it)
	                            V2PreviewSession.updateDraftState(draftState)
	                        },
	                        onBack = { goBackToUtScope() },
	                        onOpenFinding = { entry ->
	                            val nextUtMeasurements = draftState.utMeasurements
	                                .withSelectedEntry(entry)
	                                .withUpdatedEntry(entry)
	                                .withSelectedEntry(entry)
	                            draftState = draftState.copy(utMeasurements = nextUtMeasurements)
	                            V2PreviewSession.updateDraftState(draftState)
	                            startActivity(
	                                android.content.Intent(
	                                    this,
	                                    V2FindingCapturePreviewActivity::class.java,
	                                ).putExtra(V2FindingCapturePreviewActivity.EXTRA_ITEM_KEY, entry.itemKey),
	                            )
	                        },
                        onContinue = { approvedState ->
                            draftState = draftState.copy(utMeasurements = approvedState)
                            V2PreviewSession.updateDraftState(draftState)
                            Toast.makeText(this, "UT measurements approved. Opening checklist.", Toast.LENGTH_SHORT).show()
                            startActivity(android.content.Intent(this, V2InspectionChecklistPreviewActivity::class.java))
                        },
                    )
                }
            }
        }
    }
}

package ai.laiq.tankinspection.v2product.utmeasurement

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v2product.utmeasurement.V2UtMeasurementScreen
import ai.laiq.tankinspection.v2product.checklist.V2InspectionChecklistPreviewActivity
import ai.laiq.tankinspection.v2product.finding.V2FindingCapturePreviewActivity
import ai.laiq.tankinspection.v2product.model.V2FindingRecord
import ai.laiq.tankinspection.v2product.model.V2DraftState
import ai.laiq.tankinspection.v2product.model.V2UtItemKind
import ai.laiq.tankinspection.v2product.model.V2UtMeasurementEntry
import ai.laiq.tankinspection.v2product.model.V2UtMeasurementState
import ai.laiq.tankinspection.v2product.model.placementsFor
import ai.laiq.tankinspection.v2product.model.requiresElementUt
import ai.laiq.tankinspection.v2product.model.selectedTargets
import ai.laiq.tankinspection.v2product.model.withActiveFinding
import ai.laiq.tankinspection.v2product.model.withFirstAvailableTarget
import ai.laiq.tankinspection.v2product.model.withSelectedEntry
import ai.laiq.tankinspection.v2product.model.withUpdatedEntry
import ai.laiq.tankinspection.v2product.preview.V2PreviewSession
import ai.laiq.tankinspection.v2product.storage.V2WorkflowScreen
import ai.laiq.tankinspection.v2product.utsetup.V2UtSetupPreviewActivity
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
                            V2PreviewSession.draftState.withNormalizedUtTarget(),
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
                        val latestDraft = V2PreviewSession.draftState.copy(utMeasurements = draftState.utMeasurements)
                        V2PreviewSession.updateDraftState(latestDraft)
                        startActivity(
                            Intent(this, V2UtSetupPreviewActivity::class.java).apply {
                                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                            },
                        )
                        finish()
                    }

                    BackHandler { goBackToUtScope() }

                    fun updateUtMeasurements(updated: V2UtMeasurementState) {
                        val nextDraftState = V2PreviewSession.draftState
                            .copy(utMeasurements = updated)
                            .withNormalizedUtTarget()
                        draftState = nextDraftState
                        V2PreviewSession.updateDraftState(nextDraftState)
                    }

                    V2UtMeasurementScreen(
                        generalTankInfo = draftState.generalTankInfo,
                        layoutMapSetup = draftState.layoutMapSetup,
                        visibleTargets = visibleTargets,
                        placementsByTarget = placementsByTarget,
	                        state = draftState.utMeasurements,
	                        onStateChange = ::updateUtMeasurements,
	                        onBack = { goBackToUtScope() },
	                        onOpenFinding = { entry ->
                                val latestDraft = V2PreviewSession.draftState
                                val nextDraftState = if (entry.kind == V2UtItemKind.ELEMENT && !entry.requiresElementUt()) {
                                    val findingRecord = latestDraft.findingState.findingsByItemKey[entry.itemKey]
                                        ?: entry.toFindingRecord()
                                    latestDraft.copy(
                                        findingState = latestDraft.findingState.withActiveFinding(findingRecord),
                                    )
                                } else {
                                    val nextUtMeasurements = latestDraft.utMeasurements
                                        .withSelectedEntry(entry)
                                        .withUpdatedEntry(entry)
                                        .withSelectedEntry(entry)
                                    latestDraft.copy(utMeasurements = nextUtMeasurements)
                                }
	                            draftState = nextDraftState
	                            V2PreviewSession.updateDraftState(nextDraftState)
	                            startActivity(
	                                android.content.Intent(
	                                    this,
	                                    V2FindingCapturePreviewActivity::class.java,
	                                ).putExtra(V2FindingCapturePreviewActivity.EXTRA_ITEM_KEY, entry.itemKey),
	                            )
	                        },
                        onContinue = { approvedState ->
                            val nextDraftState = V2PreviewSession.draftState.copy(utMeasurements = approvedState)
                            draftState = nextDraftState
                            V2PreviewSession.updateDraftState(nextDraftState)
                            Toast.makeText(this, "UT measurements approved. Opening checklist.", Toast.LENGTH_SHORT).show()
                            startActivity(Intent(this, V2InspectionChecklistPreviewActivity::class.java))
                        },
                    )
                }
            }
        }
    }

    private fun V2UtMeasurementEntry.toFindingRecord(): V2FindingRecord =
        V2FindingRecord(
            itemKey = itemKey,
            target = target,
            itemLabel = itemLabel,
            itemKind = kind,
            elementType = elementType,
        )

    private fun V2DraftState.withNormalizedUtTarget(): V2DraftState {
        val approvedLayoutTargets = layoutScope.selectedTargets()
            .filter { target -> target in layoutMapSetup.approvedTargets }
        val selectedUtTargets = utSetup.selectedTargets()
            .filter { target -> target in approvedLayoutTargets }
        return copy(
            utMeasurements = utMeasurements.withFirstAvailableTarget(selectedUtTargets),
        )
    }
}

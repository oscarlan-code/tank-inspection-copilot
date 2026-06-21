package ai.laiq.tankinspection.v3product.utmeasurement

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.presentation.v3product.utmeasurement.ProductUtMeasurementScreen
import ai.laiq.tankinspection.v3product.checklist.ProductInspectionChecklistPreviewActivity
import ai.laiq.tankinspection.v3product.finding.ProductFindingCapturePreviewActivity
import ai.laiq.tankinspection.v3product.model.ProductFindingRecord
import ai.laiq.tankinspection.v3product.model.ProductDraftState
import ai.laiq.tankinspection.v3product.model.ProductLayoutTarget
import ai.laiq.tankinspection.v3product.model.ProductUtItemKind
import ai.laiq.tankinspection.v3product.model.ProductUtMeasurementEntry
import ai.laiq.tankinspection.v3product.model.ProductUtMeasurementState
import ai.laiq.tankinspection.v3product.model.placementsFor
import ai.laiq.tankinspection.v3product.model.requiresElementUt
import ai.laiq.tankinspection.v3product.model.selectedTargets
import ai.laiq.tankinspection.v3product.model.withActiveFinding
import ai.laiq.tankinspection.v3product.model.withActiveWorkflowTarget
import ai.laiq.tankinspection.v3product.model.withFirstAvailableTarget
import ai.laiq.tankinspection.v3product.model.withSelectedEntry
import ai.laiq.tankinspection.v3product.model.withSelectedTarget
import ai.laiq.tankinspection.v3product.model.withUpdatedEntry
import ai.laiq.tankinspection.v3product.preview.ProductPreviewSession
import ai.laiq.tankinspection.v3product.storage.ProductWorkflowScreen
import ai.laiq.tankinspection.v3product.utsetup.ProductUtSetupPreviewActivity
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

class ProductUtMeasurementPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ProductPreviewSession.attach(applicationContext)
        val requestedTarget = intent.getStringExtra(EXTRA_TARGET)
            ?.let { key -> ProductLayoutTarget.entries.firstOrNull { target -> target.key == key } }
        ProductPreviewSession.draftState.let { current ->
            val approvedLayoutTargets = current.layoutScope.selectedTargets()
                .filter { target -> target in current.layoutMapSetup.approvedTargets }
            val selectedUtTargets = current.utSetup.selectedTargets()
                .filter { target -> target in approvedLayoutTargets }
            val targetForEntry = requestedTarget
                ?.takeIf { target -> target in selectedUtTargets }
                ?: current.layoutMapSetup.selectedTarget
                    .takeIf { target -> target in selectedUtTargets }
            if (targetForEntry != null) {
                ProductPreviewSession.updateDraftState(current.withActiveWorkflowTarget(targetForEntry))
            }
        }
        ProductPreviewSession.setActiveWorkflowScreen(ProductWorkflowScreen.UT_MEASUREMENT)
        setContent {
            LaiqFieldTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ProductVoiceCaptureHost(screen = ProductWorkflowScreen.UT_MEASUREMENT) {
                        var draftState by remember {
                            mutableStateOf(
                                ProductPreviewSession.draftState.withNormalizedUtTarget(requestedTarget),
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
                            val activeTarget = draftState.utMeasurements.selectedTarget
                            val latestDraft = ProductPreviewSession.draftState.copy(
                                layoutMapSetup = draftState.layoutMapSetup.withSelectedTarget(activeTarget),
                                elementPlacement = draftState.elementPlacement.withSelectedTarget(activeTarget),
                                utMeasurements = draftState.utMeasurements,
                            )
                            ProductPreviewSession.updateDraftState(latestDraft)
                            startActivity(
                                Intent(this, ProductUtSetupPreviewActivity::class.java).apply {
                                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                                    putExtra(ProductUtSetupPreviewActivity.EXTRA_TARGET, draftState.utMeasurements.selectedTarget.key)
                                },
                            )
                            finish()
                        }

                        BackHandler { goBackToUtScope() }

                        fun updateUtMeasurements(updated: ProductUtMeasurementState) {
                            val activeTarget = updated.selectedTarget
                            val nextDraftState = ProductPreviewSession.draftState
                                .copy(
                                    layoutMapSetup = ProductPreviewSession.draftState.layoutMapSetup
                                        .withSelectedTarget(activeTarget),
                                    elementPlacement = ProductPreviewSession.draftState.elementPlacement
                                        .withSelectedTarget(activeTarget),
                                    utMeasurements = updated,
                                )
                                .withNormalizedUtTarget(activeTarget)
                            draftState = nextDraftState
                            ProductPreviewSession.updateDraftState(nextDraftState)
                        }

                        ProductUtMeasurementScreen(
                            generalTankInfo = draftState.generalTankInfo,
                            layoutMapSetup = draftState.layoutMapSetup,
                            visibleTargets = visibleTargets,
                            placementsByTarget = placementsByTarget,
                            state = draftState.utMeasurements,
                            onStateChange = ::updateUtMeasurements,
                            onBack = { goBackToUtScope() },
                            onOpenFinding = { entry ->
                                val latestDraft = ProductPreviewSession.draftState
                                val nextDraftState = if (entry.kind == ProductUtItemKind.ELEMENT && !entry.requiresElementUt()) {
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
                                ProductPreviewSession.updateDraftState(nextDraftState)
                                startActivity(
                                    android.content.Intent(
                                        this,
                                        ProductFindingCapturePreviewActivity::class.java,
                                    ).putExtra(ProductFindingCapturePreviewActivity.EXTRA_ITEM_KEY, entry.itemKey),
                                )
                            },
                            onContinue = { approvedState ->
                                val activeTarget = approvedState.selectedTarget
                                val nextDraftState = ProductPreviewSession.draftState.copy(
                                    layoutMapSetup = ProductPreviewSession.draftState.layoutMapSetup
                                        .withSelectedTarget(activeTarget),
                                    elementPlacement = ProductPreviewSession.draftState.elementPlacement
                                        .withSelectedTarget(activeTarget),
                                    utMeasurements = approvedState,
                                )
                                draftState = nextDraftState
                                ProductPreviewSession.updateDraftState(nextDraftState)
                                Toast.makeText(this, "UT measurements approved. Opening checklist.", Toast.LENGTH_SHORT).show()
                                startActivity(Intent(this, ProductInspectionChecklistPreviewActivity::class.java))
                            },
                        )
                    }
                }
            }
        }
    }

    private fun ProductUtMeasurementEntry.toFindingRecord(): ProductFindingRecord =
        ProductFindingRecord(
            itemKey = itemKey,
            target = target,
            itemLabel = itemLabel,
            itemKind = kind,
            elementType = elementType,
        )

    private fun ProductDraftState.withNormalizedUtTarget(): ProductDraftState {
        return withNormalizedUtTarget(preferredTarget = null)
    }

    private fun ProductDraftState.withNormalizedUtTarget(preferredTarget: ProductLayoutTarget?): ProductDraftState {
        val approvedLayoutTargets = layoutScope.selectedTargets()
            .filter { target -> target in layoutMapSetup.approvedTargets }
        val selectedUtTargets = utSetup.selectedTargets()
            .filter { target -> target in approvedLayoutTargets }
        val targetForEntry = preferredTarget
            ?.takeIf { target -> target in selectedUtTargets }
            ?: selectedUtTargets.firstOrNull()
        val nextMeasurements = if (targetForEntry != null) {
            if (utMeasurements.selectedTarget == targetForEntry) {
                utMeasurements
            } else {
                utMeasurements.withSelectedTarget(targetForEntry)
            }
        } else {
            utMeasurements.withFirstAvailableTarget(selectedUtTargets)
        }
        val normalizedTarget = nextMeasurements.selectedTarget
        return copy(
            layoutMapSetup = layoutMapSetup.withSelectedTarget(normalizedTarget),
            elementPlacement = elementPlacement.withSelectedTarget(normalizedTarget),
            utMeasurements = nextMeasurements,
        )
    }

    companion object {
        const val EXTRA_TARGET = "target"
    }
}

package ai.laiq.tankinspection.v2.preview

import ai.laiq.tankinspection.v2.model.V2DraftState
import ai.laiq.tankinspection.v2.model.V2ElementPlacementState
import ai.laiq.tankinspection.v2.model.V2ElementSetup
import ai.laiq.tankinspection.v2.model.V2GeneralTankInfo
import ai.laiq.tankinspection.v2.model.V2LayoutMapSetup
import ai.laiq.tankinspection.v2.model.V2LayoutScope
import ai.laiq.tankinspection.v2.model.V2RoofLayoutMap
import ai.laiq.tankinspection.v2.model.defaultV2PreviewDraftState

object V2PreviewSession {
    var draftState: V2DraftState = defaultV2PreviewDraftState()
        private set

    fun reset() {
        draftState = defaultV2PreviewDraftState()
    }

    fun updateGeneralTankInfo(updated: V2GeneralTankInfo) {
        draftState = draftState.copy(generalTankInfo = updated)
    }

    fun updateLayoutMapSetup(updated: V2LayoutMapSetup) {
        draftState = draftState.copy(layoutMapSetup = updated)
    }

    fun updateElementSetup(updated: V2ElementSetup) {
        draftState = draftState.copy(elementSetup = updated)
    }

    fun updateElementPlacement(updated: V2ElementPlacementState) {
        draftState = draftState.copy(elementPlacement = updated)
    }

    fun updateLayoutScope(updated: V2LayoutScope) {
        draftState = draftState.copy(layoutScope = updated)
    }

    fun updateRoofLayoutMap(updated: V2RoofLayoutMap) {
        draftState = draftState.copy(roofLayoutMap = updated)
    }

    fun updateDraftState(updated: V2DraftState) {
        draftState = updated
    }
}

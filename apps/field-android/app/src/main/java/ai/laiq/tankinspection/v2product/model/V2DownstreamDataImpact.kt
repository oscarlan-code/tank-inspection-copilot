package ai.laiq.tankinspection.v2product.model

data class V2DownstreamDataImpact(
    val title: String,
    val message: String,
)

fun V2DraftState.downstreamDataImpactComparedTo(
    next: V2DraftState,
): V2DownstreamDataImpact? {
    val removedElementPlacements = removedElementPlacementCount(next)
    val clearedPlateUt = removedUtCount(next, V2UtItemKind.LAYOUT_REGION)
    val clearedElementUt = removedUtCount(next, V2UtItemKind.ELEMENT)
    val clearedFindings = findingState.findingsByItemKey.keys.count { key ->
        key !in next.findingState.findingsByItemKey
    }

    if (
        removedElementPlacements == 0 &&
        clearedPlateUt == 0 &&
        clearedElementUt == 0 &&
        clearedFindings == 0
    ) {
        return null
    }

    val details = buildList {
        if (removedElementPlacements > 0) add("$removedElementPlacements element placement(s)")
        if (clearedPlateUt > 0) add("$clearedPlateUt plate/region UT row(s)")
        if (clearedElementUt > 0) add("$clearedElementUt element UT row(s)")
        if (clearedFindings > 0) add("$clearedFindings finding record(s)")
    }.joinToString(separator = "\n")

    val scopeNote = if (clearedPlateUt == 0 && clearedElementUt > 0) {
        "Plate UT readings will be kept. Only element-linked downstream data is affected."
    } else {
        "Downstream data that depends on the changed setup will be cleared."
    }

    return V2DownstreamDataImpact(
        title = "Clear Downstream Data?",
        message = "$scopeNote\n\nThis change will clear:\n$details",
    )
}

private fun V2DraftState.removedElementPlacementCount(next: V2DraftState): Int =
    elementPlacement.placementsByTarget.values.flatten().count { element ->
        next.elementPlacement.placementsByTarget.values.flatten().none { nextElement ->
            nextElement.id == element.id
        }
    }

private fun V2DraftState.removedUtCount(
    next: V2DraftState,
    kind: V2UtItemKind,
): Int =
    utMeasurements.entriesByItemKey.values.count { entry ->
        entry.kind == kind && entry.itemKey !in next.utMeasurements.entriesByItemKey
    }

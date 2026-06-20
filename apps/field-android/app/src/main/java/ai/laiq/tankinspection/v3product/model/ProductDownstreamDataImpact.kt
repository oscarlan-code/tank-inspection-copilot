package ai.laiq.tankinspection.v3product.model

data class ProductDownstreamDataImpact(
    val title: String,
    val message: String,
)

fun ProductDraftState.downstreamDataImpactComparedTo(
    next: ProductDraftState,
): ProductDownstreamDataImpact? {
    val removedElementPlacements = removedElementPlacementCount(next)
    val clearedPlateUt = removedUtCount(next, ProductUtItemKind.LAYOUT_REGION)
    val clearedElementUt = removedUtCount(next, ProductUtItemKind.ELEMENT)
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

    return ProductDownstreamDataImpact(
        title = "Clear Downstream Data?",
        message = "$scopeNote\n\nThis change will clear:\n$details",
    )
}

private fun ProductDraftState.removedElementPlacementCount(next: ProductDraftState): Int =
    elementPlacement.placementsByTarget.values.flatten().count { element ->
        next.elementPlacement.placementsByTarget.values.flatten().none { nextElement ->
            nextElement.id == element.id
        }
    }

private fun ProductDraftState.removedUtCount(
    next: ProductDraftState,
    kind: ProductUtItemKind,
): Int =
    utMeasurements.entriesByItemKey.values.count { entry ->
        entry.kind == kind && entry.itemKey !in next.utMeasurements.entriesByItemKey
    }

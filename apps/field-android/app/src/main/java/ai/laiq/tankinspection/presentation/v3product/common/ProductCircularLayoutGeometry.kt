package ai.laiq.tankinspection.presentation.v3product.common

import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.presentation.RoofPlateCell
import ai.laiq.tankinspection.presentation.circularPlateRowCounts
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularPlate
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularPlateLayout
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularPlateRow
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularRowGroup
import ai.laiq.tankinspection.v3product.model.ProductLayoutSurface
import ai.laiq.tankinspection.v3product.model.ProductLayoutTarget
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

private const val circularMapCenterNorm = 0.5f
private const val circularMapRadiusNorm = 0.42f
private const val minimumCircularPlateWeight = 0.001f
private const val minimumCircularRowHeightWeight = 0.001f
private const val minimumVisibleRowHeightShareFactor = 0.75f
private const val minimumVisibleRowHeightShareFloor = 0.035f
private const val minimumVisibleRowHeightShareCeiling = 0.18f
private const val minimumCrossRowOverlapNorm = 0.001f
private const val mergeAlignmentToleranceNorm = 0.0015f
private const val mergeRectangleAbsoluteAreaToleranceNorm = 0.0008f
private const val mergeRectangleRelativeAreaTolerance = 0.01f
private const val magneticRowShiftSnapTolerance = 0.035f
private const val magneticSeamSnapToleranceNorm = 0.02f
private const val rowShiftSpanFactor = 0.16f
private const val seamBiasScale = 0.38f
private const val seamBiasMinShare = 0.18f
private const val seamBiasMaxShare = 0.82f

data class ProductCircularPlateRef(
    val label: String,
    val rowIndex: Int,
    val plateIndex: Int,
    val rowNumber: Int,
)

private data class ProductVisibleCircularPlate(
    val cell: RoofPlateCell,
    val sourceLabels: Set<String>,
    val mergeKey: String?,
)

private data class ProductMergedCircularPlateGroup(
    val mergeKey: String,
    val primary: RoofPlateCell,
    val cells: List<RoofPlateCell>,
)

private data class ProductPlateBoundaryRef(
    val rowIndex: Int,
    val rowNumber: Int,
    val leftIndex: Int,
    val rightIndex: Int,
)

private data class ProductPlateBoundaryGeometry(
    val boundary: ProductPlateBoundaryRef,
    val pairLeft: Float,
    val pairWidth: Float,
)

private data class ProductCircularRowGeometry(
    val rowIndex: Int,
    val modelRowNumber: Int,
    val cellRowNumber: Int,
    val topNorm: Float,
    val bottomNorm: Float,
    val rowCenter: Float,
    val maxShiftOffset: Float,
    val stripLeft: Float,
    val stripWidth: Float,
)

fun generatedProductCircularPlateLayout(
    rowCount: Int,
    widestRowPlateCount: Int,
): ProductCustomCircularPlateLayout {
    val rowCounts = circularPlateRowCounts(rowCount, widestRowPlateCount).ifEmpty {
        List(rowCount.coerceAtLeast(1)) { widestRowPlateCount.coerceAtLeast(1) }
    }
    return ProductCustomCircularPlateLayout(
        rows = rowCounts.mapIndexed { index, count ->
            ProductCustomCircularPlateRow(
                rowNumber = index + 1,
                plates = List(count.coerceAtLeast(1)) { ProductCustomCircularPlate() },
            )
        },
    )
}

fun ProductCustomCircularPlateLayout.normalizedFor(
    rowCount: Int,
    widestRowPlateCount: Int,
): ProductCustomCircularPlateLayout =
    takeIf { rows.isNotEmpty() } ?: generatedProductCircularPlateLayout(rowCount, widestRowPlateCount)

fun ProductCustomCircularPlateLayout.toRoofPlateCells(
    target: ProductLayoutTarget,
    rowCount: Int,
    widestRowPlateCount: Int,
): List<RoofPlateCell> {
    val normalizedLayout = normalizedFor(rowCount, widestRowPlateCount)
    return normalizedLayout.visiblePlates(target).map { visiblePlate -> visiblePlate.cell }
}

private fun ProductCustomCircularPlateLayout.toRawRoofPlateCells(
    target: ProductLayoutTarget,
): List<RoofPlateCell> {
    val rows = rows.ifEmpty { return emptyList() }
    val rowHeightWeights = normalizedRowHeightWeights()
    val labelsByRowAndPlate = plateRefs(target).associateBy { it.rowIndex to it.plateIndex }

    return circularRowGeometries(rowHeightWeights).flatMap { geometry ->
        val row = rows[geometry.rowIndex]
        val rowNumber = geometry.cellRowNumber
        val plates = row.plates.ifEmpty { listOf(ProductCustomCircularPlate()) }
        val plateGroupCount = plates.groupedBySplitKey().size.coerceAtLeast(1)
        val totalWeight = plates.fold(0f) { total, plate ->
            total + plate.widthWeight.coerceAtLeast(minimumCircularPlateWeight)
        }
            .coerceAtLeast(1f)
        val plateWidths = plates
            .map { plate -> geometry.stripWidth * (plate.widthWeight.coerceAtLeast(minimumCircularPlateWeight) / totalWeight) }
        val nominalPlateWidth = geometry.stripWidth / plateGroupCount.toFloat()
        val rowShiftOffset = row.shiftRatio.coerceIn(-1f, 1f) * geometry.maxShiftOffset
        var cursor = geometry.stripLeft + rowShiftOffset

        plates.mapIndexed { plateIndex, _ ->
            val width = plateWidths.getOrElse(plateIndex) { nominalPlateWidth }
            val left = cursor
            val right = cursor + width
            cursor += width
            val label = labelsByRowAndPlate[geometry.rowIndex to plateIndex]?.label ?: "${rowNumber}.${plateIndex + 1}"
            RoofPlateCell(
                plateId = label,
                mapLabel = label,
                selectionLabel = "Plate $label · Row $rowNumber",
                rowNumber = rowNumber,
                xNorm = (left + right) / 2f,
                yNorm = geometry.rowCenter,
                labelXNorm = ((left + right) / 2f).coerceIn(0.08f, 0.92f),
                labelYNorm = geometry.rowCenter,
                leftNorm = left,
                rightNorm = right,
                topNorm = geometry.topNorm,
                bottomNorm = geometry.bottomNorm,
            )
        }
    }
}

private fun ProductCustomCircularPlateLayout.circularRowGeometries(
    rowHeightWeights: List<Float> = normalizedRowHeightWeights(),
): List<ProductCircularRowGeometry> {
    val layoutRows = rows.ifEmpty { return emptyList() }
    val totalHeightWeight = rowHeightWeights
        .sumOf { weight -> weight.coerceAtLeast(minimumCircularRowHeightWeight).toDouble() }
        .toFloat()
        .coerceAtLeast(1f)
    val stableHorizontalRowHeight = (2f * circularMapRadiusNorm) / layoutRows.size.coerceAtLeast(1).toFloat()
    var rowTop = circularMapCenterNorm - circularMapRadiusNorm

    return layoutRows.mapIndexed { rowIndex, row ->
        val rowHeight = (2f * circularMapRadiusNorm) *
            (rowHeightWeights.getOrElse(rowIndex) { row.heightWeight }.coerceAtLeast(minimumCircularRowHeightWeight) / totalHeightWeight)
        val topNorm = rowTop
        val bottomNorm = (rowTop + rowHeight).coerceAtMost(circularMapCenterNorm + circularMapRadiusNorm)
        rowTop = bottomNorm
        val rowCenter = (topNorm + bottomNorm) / 2f
        val stableHorizontalTop = circularMapCenterNorm - circularMapRadiusNorm +
            (stableHorizontalRowHeight * rowIndex)
        val stableHorizontalBottom = stableHorizontalTop + stableHorizontalRowHeight
        val rowHalfWidth = circularBandMaxChordHalfWidth(stableHorizontalTop, stableHorizontalBottom)
        val rowLeft = circularMapCenterNorm - rowHalfWidth
        val rowRight = circularMapCenterNorm + rowHalfWidth
        val rowWidth = (rowRight - rowLeft).coerceAtLeast(0.06f)
        val maxShiftOffset = rowWidth * rowShiftSpanFactor
        ProductCircularRowGeometry(
            rowIndex = rowIndex,
            modelRowNumber = row.rowNumber,
            cellRowNumber = rowIndex + 1,
            topNorm = topNorm,
            bottomNorm = bottomNorm,
            rowCenter = rowCenter,
            maxShiftOffset = maxShiftOffset,
            stripLeft = rowLeft - maxShiftOffset,
            stripWidth = rowWidth + (2f * maxShiftOffset),
        )
    }
}

private fun ProductCustomCircularPlateLayout.normalizedRowHeightWeights(): List<Float> {
    if (rows.isEmpty()) return emptyList()
    var weights = rows.map { row -> row.heightWeight.coerceAtLeast(minimumCircularRowHeightWeight) }
    repeat(rows.size.coerceAtLeast(1)) {
        val normalizedWeights = weights.mapIndexed { index, weight ->
            val range = rowHeightValueRangeForWeights(weights, index)
            weight.coerceIn(range.start, range.endInclusive)
        }
        if (normalizedWeights.zip(weights).all { (left, right) -> abs(left - right) <= 0.0001f }) {
            return normalizedWeights
        }
        weights = normalizedWeights
    }
    return weights
}

fun ProductCustomCircularPlateLayout.rowHeightValueRange(rowNumber: Int): ClosedFloatingPointRange<Float> {
    val rowIndex = rows.indexOfFirst { row -> row.rowNumber == rowNumber }
    if (rowIndex !in rows.indices) return minimumCircularRowHeightWeight..minimumCircularRowHeightWeight
    val weights = rows.map { row -> row.heightWeight.coerceAtLeast(minimumCircularRowHeightWeight) }
    return rowHeightValueRangeForWeights(weights, rowIndex)
}

private fun rowHeightValueRangeForWeights(
    weights: List<Float>,
    selectedIndex: Int,
): ClosedFloatingPointRange<Float> {
    if (weights.size <= 1 || selectedIndex !in weights.indices) {
        return minimumCircularRowHeightWeight..Float.MAX_VALUE
    }
    val remainingRowCount = weights.size - 1
    val otherWeight = weights
        .filterIndexed { index, _ -> index != selectedIndex }
        .sum()
        .coerceAtLeast(minimumCircularRowHeightWeight * remainingRowCount)
    val minimumRowShare = minimumVisibleRowHeightShare(weights.size)
    val maximumRowShare = (1f - minimumRowShare * remainingRowCount)
        .coerceIn(minimumRowShare, 0.96f)
    val minimumWeight = rowHeightWeightForShare(minimumRowShare, otherWeight)
    val maximumWeight = rowHeightWeightForShare(maximumRowShare, otherWeight)
        .coerceAtLeast(minimumWeight)
    return minimumWeight..maximumWeight
}

private fun minimumVisibleRowHeightShare(rowCount: Int): Float {
    val maximumSafeSharePerRow = 0.9f / rowCount.coerceAtLeast(1).toFloat()
    return (minimumVisibleRowHeightShareFactor / rowCount.coerceAtLeast(1).toFloat())
        .coerceIn(minimumVisibleRowHeightShareFloor, minimumVisibleRowHeightShareCeiling)
        .coerceAtMost(maximumSafeSharePerRow)
        .coerceAtLeast(0.02f)
}

private fun rowHeightWeightForShare(
    rowShare: Float,
    otherWeight: Float,
): Float {
    val safeShare = rowShare.coerceIn(0.001f, 0.98f)
    return (safeShare * otherWeight) / (1f - safeShare)
}

private fun circularChordHalfWidth(yNorm: Float): Float {
    val dy = (yNorm - circularMapCenterNorm).coerceIn(-circularMapRadiusNorm, circularMapRadiusNorm)
    return sqrt(max(0f, circularMapRadiusNorm * circularMapRadiusNorm - dy * dy))
}

private fun circularBandMaxChordHalfWidth(topNorm: Float, bottomNorm: Float): Float {
    val clampedTop = topNorm.coerceIn(
        circularMapCenterNorm - circularMapRadiusNorm,
        circularMapCenterNorm + circularMapRadiusNorm,
    )
    val clampedBottom = bottomNorm.coerceIn(
        circularMapCenterNorm - circularMapRadiusNorm,
        circularMapCenterNorm + circularMapRadiusNorm,
    )
    val nearestCenterY = circularMapCenterNorm.coerceIn(clampedTop, clampedBottom)
    return circularChordHalfWidth(nearestCenterY)
}

fun ProductCustomCircularPlateLayout.plateRefs(target: ProductLayoutTarget): List<ProductCircularPlateRef> {
    val roofLike = target.surface == ProductLayoutSurface.ROOF
    var roofCounter = 1
    return buildList {
        rows.forEachIndexed { rowIndex, row ->
            val plateGroups = row.plates.groupedBySplitKey()
            val rowRoofLabels = if (roofLike) {
                val startLabel = roofCounter
                val groupCount = plateGroups.size
                List(groupCount) { groupIndex ->
                    val offset = if (row.rowNumber % 2 == 0) {
                        groupCount - 1 - groupIndex
                    } else {
                        groupIndex
                    }
                    startLabel + offset
                }
            } else {
                emptyList()
            }
            plateGroups.forEachIndexed { groupIndex, group ->
                val base = if (roofLike) rowRoofLabels[groupIndex].toString() else "${row.rowNumber}.${groupIndex + 1}"
                group.forEach { plateIndex ->
                    val plate = row.plates[plateIndex]
                    val suffix = if (plate.splitGroupKey != null) splitSuffix(plate.splitPartIndex) else ""
                    add(
                        ProductCircularPlateRef(
                            label = "$base$suffix",
                            rowIndex = rowIndex,
                            plateIndex = plateIndex,
                            rowNumber = row.rowNumber,
                        ),
                    )
                }
            }
            if (roofLike) {
                roofCounter += plateGroups.size
            }
        }
    }
}

private fun List<ProductCustomCircularPlate>.groupedBySplitKey(): List<List<Int>> {
    val groups = mutableListOf<List<Int>>()
    var plateIndex = 0
    while (plateIndex < size) {
        val splitKey = this[plateIndex].splitGroupKey
        if (splitKey == null) {
            groups += listOf(plateIndex)
            plateIndex++
            continue
        }
        val groupStart = plateIndex
        var groupEnd = plateIndex
        while (groupEnd + 1 < size && this[groupEnd + 1].splitGroupKey == splitKey) {
            groupEnd++
        }
        groups += (groupStart..groupEnd).toList()
        plateIndex = groupEnd + 1
    }
    return groups
}

fun ProductCustomCircularPlateLayout.splitPlate(
    target: ProductLayoutTarget,
    plateLabel: String,
    parts: Int,
): ProductCustomCircularPlateLayout {
    val normalizedParts = parts.coerceIn(2, 3)
    val refsByLabel = plateRefs(target).associateBy { ref -> ref.label }
    val selected = resolveVisiblePlate(target, plateLabel)
    val sourceRefs = selected
        ?.sourceLabels
        ?.mapNotNull { label -> refsByLabel[label] }
        ?.takeIf { refs -> refs.isNotEmpty() }
        ?: listOfNotNull(refsByLabel[plateLabel])
    if (sourceRefs.isEmpty()) return this
    val sourceRefsByRow = sourceRefs.groupBy { ref -> ref.rowIndex }
    val rowRanges = sourceRefsByRow.mapValues { (_, refs) ->
        val sortedIndexes = refs.map { ref -> ref.plateIndex }.sorted()
        if (sortedIndexes.zipWithNext().any { (left, right) -> right != left + 1 }) return this
        sortedIndexes.first()..sortedIndexes.last()
    }
    val splitMergeKeys = if (sourceRefsByRow.size > 1) {
        val primaryLabel = selected?.cell?.plateId ?: sourceRefs.minBy { ref -> ref.rowIndex }.label
        List(normalizedParts) { index ->
            "m_primary:${primaryLabel}${splitSuffix(index)}:split_${System.nanoTime()}_$index"
        }
    } else {
        emptyList()
    }
    return copy(
        rows = rows.mapIndexed { rowIndex, row ->
            val rowRange = rowRanges[rowIndex]
            if (rowRange == null) {
                row
            } else {
                val totalWeight = rowRange.sumOf { plateIndex ->
                    row.plates.getOrNull(plateIndex)?.widthWeight?.toDouble() ?: 0.0
                }.toFloat().coerceAtLeast(minimumCircularPlateWeight * normalizedParts)
                val groupKey = "r${row.rowNumber}p${rowRange.first}_${System.nanoTime()}"
                val splitPlates = List(normalizedParts) { index ->
                    ProductCustomCircularPlate(
                        widthWeight = totalWeight / normalizedParts.toFloat(),
                        splitGroupKey = groupKey,
                        splitPartIndex = index,
                        splitPartCount = normalizedParts,
                        verticalMergeGroupKey = splitMergeKeys.getOrNull(index),
                    )
                }
                row.copy(
                    plates = row.plates.take(rowRange.first) +
                        splitPlates +
                        row.plates.drop(rowRange.last + 1),
                )
            }
        },
    )
}

fun ProductCustomCircularPlateLayout.mergePlate(
    target: ProductLayoutTarget,
    plateLabel: String,
    direction: Int,
): ProductCustomCircularPlateLayout {
    val selected = resolveVisiblePlate(target, plateLabel) ?: return this
    val adjacent = visiblePlates(target).horizontalMergeTarget(selected, direction) ?: return this
    return withMergedSourceLabels(
        target = target,
        sourceLabels = selected.sourceLabels + adjacent.sourceLabels,
        primaryLabel = selected.cell.plateId,
    )
}

fun ProductCustomCircularPlateLayout.canMergePlateHorizontally(
    target: ProductLayoutTarget,
    plateLabel: String,
    direction: Int,
): Boolean {
    val selected = resolveVisiblePlate(target, plateLabel) ?: return false
    return visiblePlates(target).horizontalMergeTarget(selected, direction) != null
}

fun ProductCustomCircularPlateLayout.withRowShift(
    rowNumber: Int,
    shiftRatio: Float,
): ProductCustomCircularPlateLayout {
    val resolvedShift = snappedRowShift(
        rowNumber = rowNumber,
        groupedRows = setOf(rowNumber),
        proposedShift = shiftRatio.coerceIn(-1f, 1f),
    )
    return copy(
        rows = rows.map { row ->
            if (row.rowNumber == rowNumber) {
                row.copy(shiftRatio = resolvedShift)
            } else {
                row
            }
        },
    ).withCrossRowMergesDetachedForRows(setOf(rowNumber))
}

private fun ProductCustomCircularPlateLayout.withCrossRowMergesDetachedForRows(
    rowNumbers: Set<Int>,
): ProductCustomCircularPlateLayout {
    if (rowNumbers.isEmpty()) return this
    val mergeRowsByKey = rows
        .flatMap { row ->
            row.plates.mapNotNull { plate ->
                plate.verticalMergeGroupKey?.let { key -> key to row.rowNumber }
            }
        }
        .groupBy({ (key, _) -> key }, { (_, mergedRowNumber) -> mergedRowNumber })
    val crossRowKeysToDetach = mergeRowsByKey
        .filterValues { mergedRows ->
            mergedRows.any { mergedRowNumber -> mergedRowNumber in rowNumbers } &&
                mergedRows.any { mergedRowNumber -> mergedRowNumber !in rowNumbers }
        }
        .keys
    if (crossRowKeysToDetach.isEmpty() && rowGroups.none { group -> group.rowNumbers.any { rowNumber -> rowNumber in rowNumbers } }) {
        return this
    }
    return copy(
        rows = rows.map { row ->
            row.copy(
                plates = row.plates.map { plate ->
                    if (plate.verticalMergeGroupKey in crossRowKeysToDetach) {
                        plate.copy(verticalMergeGroupKey = null)
                    } else {
                        plate
                    }
                },
            )
        },
        rowGroups = rowGroups.filterNot { group ->
            group.rowNumbers.any { rowNumber -> rowNumber in rowNumbers }
        },
    )
}

private fun ProductCustomCircularPlateLayout.snappedRowShift(
    rowNumber: Int,
    groupedRows: Set<Int>,
    proposedShift: Float,
): Float {
    val adjacentRowNumbers = groupedRows
        .flatMap { groupedRowNumber -> listOf(groupedRowNumber - 1, groupedRowNumber + 1) }
        .filter { adjacentRowNumber -> adjacentRowNumber > 0 && adjacentRowNumber !in groupedRows }
        .toSet()
        .ifEmpty { setOf(rowNumber - 1, rowNumber + 1).filter { adjacentRowNumber -> adjacentRowNumber > 0 }.toSet() }
    return rows
        .filter { row -> row.rowNumber in adjacentRowNumbers }
        .map { row -> row.shiftRatio.coerceIn(-1f, 1f) }
        .minByOrNull { adjacentShift -> abs(adjacentShift - proposedShift) }
        ?.takeIf { adjacentShift -> abs(adjacentShift - proposedShift) <= magneticRowShiftSnapTolerance }
        ?: proposedShift
}

fun ProductCustomCircularPlateLayout.rowGroupFor(rowNumber: Int): Set<Int> =
    crossRowMergedRowGroups()
        .connectedComponentFor(rowNumber)
        .ifEmpty { setOf(rowNumber) }

private fun ProductCustomCircularPlateLayout.crossRowMergedRowGroups(): List<Set<Int>> =
    rows.flatMap { row ->
        row.plates.mapNotNull { plate ->
            plate.verticalMergeGroupKey?.let { key -> key to row.rowNumber }
        }
    }
        .groupBy({ (key, _) -> key }, { (_, rowNumber) -> rowNumber })
        .values
        .map { rowNumbers -> rowNumbers.toSet() }
        .filter { rowNumbers -> rowNumbers.size > 1 }

private fun List<Set<Int>>.connectedComponentFor(rowNumber: Int): Set<Int> {
    var component = setOf(rowNumber)
    var changed: Boolean
    do {
        val expanded = filter { group -> group.any { connectedRow -> connectedRow in component } }
            .flatten()
            .toSet() + component
        changed = expanded.size != component.size
        component = expanded
    } while (changed)
    return component
}

fun ProductCustomCircularPlateLayout.withRowHeight(
    rowNumber: Int,
    heightWeight: Float,
): ProductCustomCircularPlateLayout {
    val rowHeightRange = rowHeightValueRange(rowNumber)
    return copy(
        rows = rows.map { row ->
            if (row.rowNumber == rowNumber) {
                row.copy(heightWeight = heightWeight.coerceIn(rowHeightRange.start, rowHeightRange.endInclusive))
            } else {
                row
            }
        },
    )
}

fun ProductCustomCircularPlateLayout.withAdjacentPlateBoundaryBias(
    target: ProductLayoutTarget,
    plateLabel: String,
    direction: Int,
    bias: Float,
): ProductCustomCircularPlateLayout {
    val proposedLeftShare = (0.5f + bias.coerceIn(-1f, 1f) * seamBiasScale)
        .coerceIn(seamBiasMinShare, seamBiasMaxShare)
    val boundaryRefs = plateBoundaryRefsFor(target, plateLabel, direction)
    if (boundaryRefs.isEmpty()) return this
    val boundaryGeometries = boundaryGeometriesFor(target, boundaryRefs)
    if (boundaryGeometries.isEmpty()) return this
    val selectedRef = plateRefs(target).firstOrNull { ref -> ref.label == plateLabel }
    val anchorGeometry = boundaryGeometries.firstOrNull { geometry ->
        geometry.boundary.rowNumber == selectedRef?.rowNumber
    } ?: boundaryGeometries.first()
    val anchorLeftShare = snappedAdjacentPlateLeftShare(
        target = target,
        boundary = anchorGeometry.boundary,
        proposedLeftShare = proposedLeftShare,
    )
    val proposedSharedSeam = anchorGeometry.pairLeft + (anchorGeometry.pairWidth * anchorLeftShare)
    val minimumSharedSeam = boundaryGeometries.maxOf { geometry ->
        geometry.pairLeft + (geometry.pairWidth * seamBiasMinShare)
    }
    val maximumSharedSeam = boundaryGeometries.minOf { geometry ->
        geometry.pairLeft + (geometry.pairWidth * seamBiasMaxShare)
    }
    if (minimumSharedSeam > maximumSharedSeam) return this
    val sharedSeam = proposedSharedSeam.coerceIn(minimumSharedSeam, maximumSharedSeam)
    var updatedRows = rows
    boundaryGeometries.forEach { geometry ->
        val boundary = geometry.boundary
        val row = updatedRows.getOrNull(boundary.rowIndex) ?: return@forEach
        val left = row.plates.getOrNull(boundary.leftIndex) ?: return@forEach
        val right = row.plates.getOrNull(boundary.rightIndex) ?: return@forEach
        val pairWeight = (left.widthWeight + right.widthWeight).coerceAtLeast(minimumCircularPlateWeight * 2f)
        val leftShare = ((sharedSeam - geometry.pairLeft) / geometry.pairWidth)
            .coerceIn(seamBiasMinShare, seamBiasMaxShare)
        val newPlates = row.plates.toMutableList()
        newPlates[boundary.leftIndex] = left.copy(widthWeight = pairWeight * leftShare)
        newPlates[boundary.rightIndex] = right.copy(widthWeight = pairWeight * (1f - leftShare))
        updatedRows = updatedRows.replace(boundary.rowIndex, row.copy(plates = newPlates))
    }
    return copy(rows = updatedRows)
}

fun ProductCustomCircularPlateLayout.canAdjustAdjacentPlateBoundary(
    target: ProductLayoutTarget,
    plateLabel: String,
    direction: Int,
): Boolean =
    plateBoundaryRefsFor(target, plateLabel, direction).isNotEmpty()

private fun ProductCustomCircularPlateLayout.plateBoundaryRefsFor(
    target: ProductLayoutTarget,
    plateLabel: String,
    direction: Int,
): List<ProductPlateBoundaryRef> {
    val normalizedDirection = direction.coerceIn(-1, 1)
    if (normalizedDirection == 0) return emptyList()
    val refsByLabel = plateRefs(target).associateBy { ref -> ref.label }
    val selected = resolveVisiblePlate(target, plateLabel)
    val sourceRefs = selected
        ?.sourceLabels
        ?.mapNotNull { label -> refsByLabel[label] }
        ?.takeIf { refs -> refs.isNotEmpty() }
        ?: listOfNotNull(refsByLabel[plateLabel])
    return sourceRefs
        .groupBy { ref -> ref.rowIndex }
        .mapNotNull { (rowIndex, rowRefs) ->
            val row = rows.getOrNull(rowIndex) ?: return@mapNotNull null
            val edgeIndex = if (normalizedDirection < 0) {
                rowRefs.minOf { ref -> ref.plateIndex }
            } else {
                rowRefs.maxOf { ref -> ref.plateIndex }
            }
            val leftIndex = if (normalizedDirection < 0) edgeIndex - 1 else edgeIndex
            val rightIndex = leftIndex + 1
            if (leftIndex !in row.plates.indices || rightIndex !in row.plates.indices) {
                null
            } else {
                ProductPlateBoundaryRef(
                    rowIndex = rowIndex,
                    rowNumber = row.rowNumber,
                    leftIndex = leftIndex,
                    rightIndex = rightIndex,
                )
            }
        }
}

private fun ProductCustomCircularPlateLayout.boundaryGeometriesFor(
    target: ProductLayoutTarget,
    boundaryRefs: List<ProductPlateBoundaryRef>,
): List<ProductPlateBoundaryGeometry> {
    val refsByPosition = plateRefs(target).associateBy { plateRef -> plateRef.rowIndex to plateRef.plateIndex }
    val cellsByLabel = currentPlateCells(target).associateBy { cell -> cell.plateId }
    return boundaryRefs.mapNotNull { boundary ->
        val leftLabel = refsByPosition[boundary.rowIndex to boundary.leftIndex]?.label ?: return@mapNotNull null
        val rightLabel = refsByPosition[boundary.rowIndex to boundary.rightIndex]?.label ?: return@mapNotNull null
        val leftCell = cellsByLabel[leftLabel] ?: return@mapNotNull null
        val rightCell = cellsByLabel[rightLabel] ?: return@mapNotNull null
        val pairLeft = min(leftCell.leftNorm, rightCell.leftNorm)
        val pairRight = max(leftCell.rightNorm, rightCell.rightNorm)
        val pairWidth = pairRight - pairLeft
        if (pairWidth <= minimumCrossRowOverlapNorm) {
            null
        } else {
            ProductPlateBoundaryGeometry(
                boundary = boundary,
                pairLeft = pairLeft,
                pairWidth = pairWidth,
            )
        }
    }
}

private fun ProductCustomCircularPlateLayout.snappedAdjacentPlateLeftShare(
    target: ProductLayoutTarget,
    boundary: ProductPlateBoundaryRef,
    proposedLeftShare: Float,
): Float {
    val refsByPosition = plateRefs(target).associateBy { plateRef -> plateRef.rowIndex to plateRef.plateIndex }
    val leftLabel = refsByPosition[boundary.rowIndex to boundary.leftIndex]?.label ?: return proposedLeftShare
    val rightLabel = refsByPosition[boundary.rowIndex to boundary.rightIndex]?.label ?: return proposedLeftShare
    val cells = currentPlateCells(target)
    val leftCell = cells.firstOrNull { cell -> cell.plateId == leftLabel } ?: return proposedLeftShare
    val rightCell = cells.firstOrNull { cell -> cell.plateId == rightLabel } ?: return proposedLeftShare
    val pairLeft = min(leftCell.leftNorm, rightCell.leftNorm)
    val pairRight = max(leftCell.rightNorm, rightCell.rightNorm)
    val pairWidth = pairRight - pairLeft
    if (pairWidth <= minimumCrossRowOverlapNorm) return proposedLeftShare
    val proposedSeam = pairLeft + (pairWidth * proposedLeftShare)
    val adjacentRows = setOf(boundary.rowNumber - 1, boundary.rowNumber + 1)
    val nearestAdjacentSeam = cells
        .asSequence()
        .filter { cell -> cell.rowNumber in adjacentRows }
        .flatMap { cell -> sequenceOf(cell.leftNorm, cell.rightNorm) }
        .filter { seamX ->
            seamX > pairLeft + magneticSeamSnapToleranceNorm &&
                seamX < pairRight - magneticSeamSnapToleranceNorm
        }
        .minByOrNull { seamX -> abs(seamX - proposedSeam) }
        ?.takeIf { seamX -> abs(seamX - proposedSeam) <= magneticSeamSnapToleranceNorm }
        ?: return proposedLeftShare
    return ((nearestAdjacentSeam - pairLeft) / pairWidth).coerceIn(seamBiasMinShare, seamBiasMaxShare)
}

private fun ProductCustomCircularPlateLayout.resolveVisiblePlate(
    target: ProductLayoutTarget,
    plateLabel: String,
): ProductVisibleCircularPlate? =
    visiblePlates(target).firstOrNull { visiblePlate ->
        visiblePlate.cell.plateId == plateLabel ||
            visiblePlate.cell.mapLabel == plateLabel ||
            plateLabel in visiblePlate.sourceLabels
    }

private fun List<ProductVisibleCircularPlate>.horizontalMergeTarget(
    selected: ProductVisibleCircularPlate,
    direction: Int,
): ProductVisibleCircularPlate? {
    val normalizedDirection = direction.coerceIn(-1, 1)
    if (normalizedDirection == 0) return null
    val selectedCell = selected.cell
    return filter { candidate ->
        candidate.sourceLabels != selected.sourceLabels &&
            sameVerticalSpan(selectedCell, candidate.cell) &&
            verticalOverlap(selectedCell, candidate.cell) > minimumCrossRowOverlapNorm &&
            if (normalizedDirection < 0) {
                candidate.cell.xNorm < selectedCell.xNorm
            } else {
                candidate.cell.xNorm > selectedCell.xNorm
            }
    }
        .minWithOrNull(
            compareBy<ProductVisibleCircularPlate> { candidate ->
                if (normalizedDirection < 0) {
                    max(0f, selectedCell.leftNorm - candidate.cell.rightNorm)
                } else {
                    max(0f, candidate.cell.leftNorm - selectedCell.rightNorm)
                }
            }.thenBy { candidate ->
                kotlin.math.abs(candidate.cell.xNorm - selectedCell.xNorm)
            },
        )
}

private fun ProductCustomCircularPlateLayout.withMergedSourceLabels(
    target: ProductLayoutTarget,
    sourceLabels: Set<String>,
    primaryLabel: String? = null,
): ProductCustomCircularPlateLayout {
    if (sourceLabels.size < 2) return this
    val refsByPosition = plateRefs(target)
        .filter { ref -> ref.label in sourceLabels }
        .associateBy { ref -> ref.rowIndex to ref.plateIndex }
    if (refsByPosition.size < 2) return this
    val resolvedPrimaryLabel = primaryLabel?.takeIf { label -> refsByPosition.values.any { ref -> ref.label == label } }
    val mergeGroupKey = buildString {
        append("m_")
        if (resolvedPrimaryLabel != null) {
            append("primary:")
            append(resolvedPrimaryLabel)
            append(":")
        }
        append(refsByPosition.values.joinToString("_") { ref -> ref.label })
        append("_")
        append(System.nanoTime())
    }
    return copy(
        rows = rows.mapIndexed { rowIndex, row ->
            row.copy(
                plates = row.plates.mapIndexed { plateIndex, plate ->
                    if ((rowIndex to plateIndex) in refsByPosition) {
                        plate.copy(verticalMergeGroupKey = mergeGroupKey)
                    } else {
                        plate
                    }
                },
            )
        },
    )
}

fun ProductCustomCircularPlateLayout.mergePlateAcrossRows(
    target: ProductLayoutTarget,
    plateLabel: String,
    direction: Int,
): ProductCustomCircularPlateLayout {
    val selected = resolveVisiblePlate(target, plateLabel) ?: return this
    val targetRef = crossRowMergeTarget(target, plateLabel, direction) ?: return this
    val adjacent = resolveVisiblePlate(target, targetRef.label) ?: return this
    val mergedSourceLabels = selected.sourceLabels + adjacent.sourceLabels
    return withMergedSourceLabels(
        target = target,
        sourceLabels = mergedSourceLabels,
        primaryLabel = selected.cell.plateId,
    ).withRowGroupForSourceLabels(target, mergedSourceLabels)
}

private fun ProductCustomCircularPlateLayout.withRowGroupForSourceLabels(
    target: ProductLayoutTarget,
    sourceLabels: Set<String>,
): ProductCustomCircularPlateLayout {
    val refsByLabel = plateRefs(target).associateBy { ref -> ref.label }
    val groupedRows = sourceLabels
        .mapNotNull { label -> refsByLabel[label]?.rowNumber }
        .flatMap { rowNumber -> rowGroupFor(rowNumber) }
        .toSortedSet()
    if (groupedRows.size < 2) return this
    val updatedGroups = rowGroups
        .filterNot { group -> group.rowNumbers.any { rowNumber -> rowNumber in groupedRows } } +
        ProductCustomCircularRowGroup(
            groupId = "rg_${groupedRows.joinToString("_")}",
            rowNumbers = groupedRows,
        )
    return copy(rowGroups = updatedGroups)
}

fun ProductCustomCircularPlateLayout.crossRowMergeTarget(
    target: ProductLayoutTarget,
    plateLabel: String,
    direction: Int,
): ProductCircularPlateRef? {
    val normalizedDirection = direction.coerceIn(-1, 1)
    if (normalizedDirection == 0) return null
    val refs = plateRefs(target)
    val source = resolveVisiblePlate(target, plateLabel) ?: return null
    val candidate = visiblePlates(target).verticalMergeTarget(source, normalizedDirection) ?: return null
    return refs.firstOrNull { ref -> ref.label == candidate.cell.plateId }
}

private fun List<ProductVisibleCircularPlate>.verticalMergeTarget(
    selected: ProductVisibleCircularPlate,
    direction: Int,
): ProductVisibleCircularPlate? {
    val selectedCell = selected.cell
    return filter { candidate ->
        candidate.sourceLabels != selected.sourceLabels &&
            sameHorizontalSpan(selectedCell, candidate.cell) &&
            if (direction < 0) {
                candidate.cell.bottomNorm <= selectedCell.topNorm + mergeAlignmentToleranceNorm
            } else {
                candidate.cell.topNorm >= selectedCell.bottomNorm - mergeAlignmentToleranceNorm
            }
    }
        .minWithOrNull(
            compareBy<ProductVisibleCircularPlate> { candidate ->
                if (direction < 0) {
                    abs(selectedCell.topNorm - candidate.cell.bottomNorm)
                } else {
                    abs(candidate.cell.topNorm - selectedCell.bottomNorm)
                }
            }.thenBy { candidate ->
                abs(candidate.cell.xNorm - selectedCell.xNorm)
            },
        )
}

fun ProductCustomCircularPlateLayout.verticalMergeGroupLabels(
    target: ProductLayoutTarget,
    plateLabel: String?,
): Set<String> {
    if (plateLabel == null) return emptySet()
    val refs = plateRefs(target)
    val selectedRef = refs.firstOrNull { ref -> ref.label == plateLabel } ?: return emptySet()
    val selectedKey = rows.getOrNull(selectedRef.rowIndex)
        ?.plates
        ?.getOrNull(selectedRef.plateIndex)
        ?.verticalMergeGroupKey
        ?: return emptySet()
    return refs.filter { ref ->
        rows.getOrNull(ref.rowIndex)
            ?.plates
            ?.getOrNull(ref.plateIndex)
            ?.verticalMergeGroupKey == selectedKey
    }
        .map { ref -> ref.label }
        .toSet()
}

fun ProductCustomCircularPlateLayout.displayPlateLabelFor(
    target: ProductLayoutTarget,
    plateLabel: String?,
): String? {
    if (plateLabel == null) return null
    return toRoofPlateCells(
        target = target,
        rowCount = rows.size.coerceAtLeast(1),
        widestRowPlateCount = rows.maxOfOrNull { row -> row.plates.size }?.coerceAtLeast(1) ?: 1,
    )
        .firstOrNull { cell -> cell.plateId == plateLabel }
        ?.mapLabel
}

fun ProductCustomCircularPlateLayout.withAnnularRotation(rotationDeg: Float): ProductCustomCircularPlateLayout =
    copy(annularRotationDeg = rotationDeg.coerceIn(-180f, 180f))

private fun ProductCustomCircularPlateLayout.currentPlateCells(target: ProductLayoutTarget): List<RoofPlateCell> =
    toRawRoofPlateCells(target)

private fun ProductCustomCircularPlateLayout.visiblePlates(
    target: ProductLayoutTarget,
): List<ProductVisibleCircularPlate> {
    val rawCells = toRawRoofPlateCells(target)
    val mergeKeyByLabel = mergeKeyByLabel(target)
    if (mergeKeyByLabel.isEmpty()) {
        return rawCells.map { cell ->
            ProductVisibleCircularPlate(
                cell = cell,
                sourceLabels = setOf(cell.plateId),
                mergeKey = null,
            )
        }
    }
    val groupedCells = rawCells.filter { cell -> mergeKeyByLabel[cell.plateId] != null }
        .groupBy { cell -> mergeKeyByLabel.getValue(cell.plateId) }
        .filterValues { cells -> cells.size > 1 && cells.canRenderAsSingleMergedRectangle() }
    if (groupedCells.isEmpty()) {
        return rawCells.map { cell ->
            ProductVisibleCircularPlate(
                cell = cell,
                sourceLabels = setOf(cell.plateId),
                mergeKey = mergeKeyByLabel[cell.plateId],
            )
        }
    }

    val sortedGroups = groupedCells.entries
        .map { (mergeKey, cells) ->
            val sortedCells = cells.sortedWith(
                compareBy<RoofPlateCell> { cell -> cell.topNorm }
                    .thenBy { cell -> cell.leftNorm }
                    .thenBy { cell -> cell.plateId },
            )
            val primaryLabel = primaryLabelFromMergeKey(mergeKey)
            ProductMergedCircularPlateGroup(
                mergeKey = mergeKey,
                primary = sortedCells.firstOrNull { cell -> cell.plateId == primaryLabel } ?: sortedCells.first(),
                cells = sortedCells,
            )
        }
        .sortedWith(
            compareBy<ProductMergedCircularPlateGroup> { group -> group.cells.minOf { cell -> cell.topNorm } }
                .thenBy { group -> group.cells.minOf { cell -> cell.leftNorm } }
                .thenBy { group -> group.primary.plateId },
        )
    val mergedVisibleByPrimaryLabel = sortedGroups.mapIndexed { index, sortedGroup ->
        val displayLabel = "M${index + 1}"
        sortedGroup.primary.plateId to ProductVisibleCircularPlate(
            cell = sortedGroup.cells.toMergedVisibleCell(sortedGroup.primary, displayLabel),
            sourceLabels = sortedGroup.cells.map { cell -> cell.plateId }.toSet(),
            mergeKey = sortedGroup.mergeKey,
        )
    }.toMap()
    val hiddenMergedLabels = sortedGroups
        .flatMap { group -> group.cells.filterNot { cell -> cell.plateId == group.primary.plateId } }
        .map { cell -> cell.plateId }
        .toSet()

    return rawCells.mapNotNull { cell ->
        when {
            cell.plateId in hiddenMergedLabels -> null
            cell.plateId in mergedVisibleByPrimaryLabel -> mergedVisibleByPrimaryLabel.getValue(cell.plateId)
            else -> ProductVisibleCircularPlate(
                cell = cell,
                sourceLabels = setOf(cell.plateId),
                mergeKey = mergeKeyByLabel[cell.plateId],
            )
        }
    }
}

private fun ProductCustomCircularPlateLayout.mergeKeyByLabel(
    target: ProductLayoutTarget,
): Map<String, String> =
    plateRefs(target).mapNotNull { ref ->
        rows.getOrNull(ref.rowIndex)
            ?.plates
            ?.getOrNull(ref.plateIndex)
            ?.verticalMergeGroupKey
            ?.let { key -> ref.label to key }
    }.toMap()

private fun primaryLabelFromMergeKey(mergeKey: String): String? =
    mergeKey.substringAfter("m_primary:", missingDelimiterValue = "")
        .takeIf { value -> value.isNotBlank() }
        ?.substringBefore(":")

private fun List<RoofPlateCell>.toMergedVisibleCell(
    primary: RoofPlateCell,
    displayLabel: String,
): RoofPlateCell {
    val resolvedLeft = minOf { cell -> cell.leftNorm }
    val resolvedRight = maxOf { cell -> cell.rightNorm }
    val top = minOf { cell -> cell.topNorm }
    val bottom = maxOf { cell -> cell.bottomNorm }
    val rows = map { cell -> cell.rowNumber }.distinct().sorted()
    return primary.copy(
        mapLabel = displayLabel,
        selectionLabel = "Merged plate $displayLabel · from ${map { cell -> cell.plateId }.joinToString(" / ")} · Rows ${rows.joinToString("/")}",
        xNorm = (resolvedLeft + resolvedRight) / 2f,
        yNorm = (top + bottom) / 2f,
        labelXNorm = ((resolvedLeft + resolvedRight) / 2f).coerceIn(0.08f, 0.92f),
        labelYNorm = (top + bottom) / 2f,
        leftNorm = resolvedLeft,
        rightNorm = resolvedRight,
        topNorm = top,
        bottomNorm = bottom,
    )
}

private fun List<RoofPlateCell>.canRenderAsSingleMergedRectangle(): Boolean {
    if (size < 2) return false
    val left = minOf { cell -> cell.leftNorm }
    val right = maxOf { cell -> cell.rightNorm }
    val top = minOf { cell -> cell.topNorm }
    val bottom = maxOf { cell -> cell.bottomNorm }
    val unionArea = (right - left) * (bottom - top)
    val sourceArea = sumOf { cell ->
        ((cell.rightNorm - cell.leftNorm) * (cell.bottomNorm - cell.topNorm)).toDouble()
    }.toFloat()
    val hasSourceOverlap = indices.any { firstIndex ->
        ((firstIndex + 1) until size).any { secondIndex ->
            overlapArea(this[firstIndex], this[secondIndex]) > mergeRectangleAbsoluteAreaToleranceNorm
        }
    }
    val areaTolerance = max(
        mergeRectangleAbsoluteAreaToleranceNorm,
        unionArea * mergeRectangleRelativeAreaTolerance,
    )
    return !hasSourceOverlap && abs(sourceArea - unionArea) <= areaTolerance
}

private fun overlapArea(first: RoofPlateCell, second: RoofPlateCell): Float {
    val width = min(first.rightNorm, second.rightNorm) - max(first.leftNorm, second.leftNorm)
    val height = min(first.bottomNorm, second.bottomNorm) - max(first.topNorm, second.topNorm)
    return if (width > 0f && height > 0f) width * height else 0f
}

private fun verticalOverlap(first: RoofPlateCell, second: RoofPlateCell): Float =
    min(first.bottomNorm, second.bottomNorm) - max(first.topNorm, second.topNorm)

private fun sameHorizontalSpan(first: RoofPlateCell, second: RoofPlateCell): Boolean =
    abs(first.leftNorm - second.leftNorm) <= mergeAlignmentToleranceNorm &&
        abs(first.rightNorm - second.rightNorm) <= mergeAlignmentToleranceNorm

private fun sameVerticalSpan(first: RoofPlateCell, second: RoofPlateCell): Boolean =
    abs(first.topNorm - second.topNorm) <= mergeAlignmentToleranceNorm &&
        abs(first.bottomNorm - second.bottomNorm) <= mergeAlignmentToleranceNorm

private fun <T> List<T>.replace(index: Int, value: T): List<T> =
    mapIndexed { currentIndex, currentValue -> if (currentIndex == index) value else currentValue }

private fun splitSuffix(index: Int): String =
    ('a'.code + index.coerceAtLeast(0)).toChar().toString()

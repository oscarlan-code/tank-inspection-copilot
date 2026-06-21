package ai.laiq.tankinspection.presentation.v3product.common

import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.presentation.RoofPlateCell
import ai.laiq.tankinspection.presentation.buildRoofPlateCells
import ai.laiq.tankinspection.presentation.circularPlateRowCounts
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularPlate
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularPlateLayout
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularPlateRow
import ai.laiq.tankinspection.v3product.model.ProductLayoutSurface
import ai.laiq.tankinspection.v3product.model.ProductLayoutTarget

data class ProductCircularPlateRef(
    val label: String,
    val rowIndex: Int,
    val plateIndex: Int,
    val rowNumber: Int,
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
    val rows = normalizedLayout.rows.ifEmpty { return emptyList() }
    val labelsByRowAndPlate = normalizedLayout.plateRefs(target).associateBy { it.rowIndex to it.plateIndex }
    val generatedRows = buildRoofPlateCells(
        template = RoofTemplate.CIRCULAR_PLATE,
        rowCount = rowCount,
        widestRowPlateCount = widestRowPlateCount,
        ringCount = 0,
        sectorCount = 0,
    )
        .groupBy { cell -> cell.rowNumber }

    return rows.flatMapIndexed { rowIndex, row ->
        val rowNumber = rowIndex + 1
        val generatedCells = generatedRows[rowNumber].orEmpty()
            .sortedBy { cell -> cell.leftNorm }
        val rowLeft = generatedCells.minOfOrNull { cell -> cell.leftNorm } ?: 0.08f
        val rowRight = generatedCells.maxOfOrNull { cell -> cell.rightNorm } ?: 0.92f
        val topNorm = generatedCells.minOfOrNull { cell -> cell.topNorm } ?: 0.08f
        val bottomNorm = generatedCells.maxOfOrNull { cell -> cell.bottomNorm } ?: 0.92f
        val rowCenter = generatedCells.firstOrNull()?.yNorm ?: ((topNorm + bottomNorm) / 2f)
        val rowWidth = (rowRight - rowLeft).coerceAtLeast(0.06f)
        val totalWeight = row.plates.fold(0f) { total, plate -> total + plate.widthWeight.coerceAtLeast(0.2f) }
            .coerceAtLeast(1f)
        val nominalPlateWidth = rowWidth / row.plates.size.coerceAtLeast(1).toFloat()
        val maxShift = (nominalPlateWidth * 0.65f).coerceIn(0.012f, 0.08f)
        val clusterLeft = rowLeft + row.shiftRatio.coerceIn(-1f, 1f) * maxShift
        var cursor = clusterLeft

        row.plates.mapIndexed { plateIndex, plate ->
            val width = rowWidth * (plate.widthWeight.coerceAtLeast(0.2f) / totalWeight)
            val left = cursor
            val right = cursor + width
            cursor += width
            val label = labelsByRowAndPlate[rowIndex to plateIndex]?.label ?: "${rowNumber}.${plateIndex + 1}"
            RoofPlateCell(
                plateId = label,
                mapLabel = label,
                selectionLabel = "Plate $label · Row $rowNumber",
                rowNumber = rowNumber,
                xNorm = (left + right) / 2f,
                yNorm = rowCenter,
                labelXNorm = ((left + right) / 2f).coerceIn(0.08f, 0.92f),
                labelYNorm = rowCenter,
                leftNorm = left,
                rightNorm = right,
                topNorm = topNorm,
                bottomNorm = bottomNorm,
            )
        }
    }
}

fun ProductCustomCircularPlateLayout.plateRefs(target: ProductLayoutTarget): List<ProductCircularPlateRef> {
    val roofLike = target.surface == ProductLayoutSurface.ROOF
    var roofCounter = 1
    return buildList {
        rows.forEachIndexed { rowIndex, row ->
            var columnCounter = 1
            var plateIndex = 0
            while (plateIndex < row.plates.size) {
                val plate = row.plates[plateIndex]
                val splitKey = plate.splitGroupKey
                if (splitKey != null) {
                    val groupStart = plateIndex
                    var groupEnd = plateIndex
                    while (
                        groupEnd + 1 < row.plates.size &&
                        row.plates[groupEnd + 1].splitGroupKey == splitKey
                    ) {
                        groupEnd++
                    }
                    val base = if (roofLike) roofCounter.toString() else "${row.rowNumber}.$columnCounter"
                    for (groupIndex in groupStart..groupEnd) {
                        val groupPlate = row.plates[groupIndex]
                        val suffix = splitSuffix(groupPlate.splitPartIndex)
                        add(
                            ProductCircularPlateRef(
                                label = "$base$suffix",
                                rowIndex = rowIndex,
                                plateIndex = groupIndex,
                                rowNumber = row.rowNumber,
                            ),
                        )
                    }
                    roofCounter++
                    columnCounter++
                    plateIndex = groupEnd + 1
                } else {
                    val label = if (roofLike) roofCounter.toString() else "${row.rowNumber}.$columnCounter"
                    add(
                        ProductCircularPlateRef(
                            label = label,
                            rowIndex = rowIndex,
                            plateIndex = plateIndex,
                            rowNumber = row.rowNumber,
                        ),
                    )
                    roofCounter++
                    columnCounter++
                    plateIndex++
                }
            }
        }
    }
}

fun ProductCustomCircularPlateLayout.splitPlate(
    target: ProductLayoutTarget,
    plateLabel: String,
    parts: Int,
): ProductCustomCircularPlateLayout {
    val ref = plateRefs(target).firstOrNull { it.label == plateLabel } ?: return this
    val normalizedParts = parts.coerceIn(2, 3)
    val row = rows.getOrNull(ref.rowIndex) ?: return this
    val plate = row.plates.getOrNull(ref.plateIndex) ?: return this
    val groupKey = "r${row.rowNumber}p${ref.plateIndex}_${System.nanoTime()}"
    val newPlates = row.plates.toMutableList()
    newPlates.removeAt(ref.plateIndex)
    newPlates.addAll(
        ref.plateIndex,
        List(normalizedParts) { index ->
            ProductCustomCircularPlate(
                widthWeight = plate.widthWeight / normalizedParts.toFloat(),
                splitGroupKey = groupKey,
                splitPartIndex = index,
                splitPartCount = normalizedParts,
            )
        },
    )
    return copy(rows = rows.replace(ref.rowIndex, row.copy(plates = newPlates)))
}

fun ProductCustomCircularPlateLayout.mergePlate(
    target: ProductLayoutTarget,
    plateLabel: String,
    direction: Int,
): ProductCustomCircularPlateLayout {
    val ref = plateRefs(target).firstOrNull { it.label == plateLabel } ?: return this
    val row = rows.getOrNull(ref.rowIndex) ?: return this
    val adjacentIndex = (ref.plateIndex + direction.coerceIn(-1, 1)).takeIf { it != ref.plateIndex }
        ?: return this
    if (adjacentIndex !in row.plates.indices) return this
    val firstIndex = minOf(ref.plateIndex, adjacentIndex)
    val secondIndex = maxOf(ref.plateIndex, adjacentIndex)
    val first = row.plates[firstIndex]
    val second = row.plates[secondIndex]
    val newPlates = row.plates.toMutableList()
    newPlates[firstIndex] = ProductCustomCircularPlate(widthWeight = first.widthWeight + second.widthWeight)
    newPlates.removeAt(secondIndex)
    return copy(rows = rows.replace(ref.rowIndex, row.copy(plates = newPlates)))
}

fun ProductCustomCircularPlateLayout.withRowShift(
    rowNumber: Int,
    shiftRatio: Float,
): ProductCustomCircularPlateLayout =
    copy(
        rows = rows.map { row ->
            if (row.rowNumber == rowNumber) row.copy(shiftRatio = shiftRatio.coerceIn(-1f, 1f)) else row
        },
    )

fun ProductCustomCircularPlateLayout.withAnnularRotation(rotationDeg: Float): ProductCustomCircularPlateLayout =
    copy(annularRotationDeg = rotationDeg.coerceIn(-180f, 180f))

private fun <T> List<T>.replace(index: Int, value: T): List<T> =
    mapIndexed { currentIndex, currentValue -> if (currentIndex == index) value else currentValue }

private fun splitSuffix(index: Int): String =
    ('a'.code + index.coerceAtLeast(0)).toChar().toString()

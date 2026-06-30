package ai.laiq.tankinspection.presentation.v3product.common

import ai.laiq.tankinspection.presentation.RoofPlateCell
import ai.laiq.tankinspection.v3product.model.ProductLayoutTarget
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularPlate
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularPlateLayout
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularPlateRow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ProductCircularLayoutGeometryTest {
    @Test
    fun circularPlateRowsCoverWidestChordInsideTallRows() {
        val cells = generatedProductCircularPlateLayout(rowCount = 2, widestRowPlateCount = 6)
            .toRoofPlateCells(
                target = ProductLayoutTarget.EXTERNAL_ROOF,
                rowCount = 2,
                widestRowPlateCount = 6,
            )

        val topRow = cells.filter { cell -> cell.rowNumber == 1 }
        val bottomRow = cells.filter { cell -> cell.rowNumber == 2 }

        assertTrue(topRow.minOf { cell -> cell.leftNorm } <= 0.081f)
        assertTrue(topRow.maxOf { cell -> cell.rightNorm } >= 0.919f)
        assertTrue(bottomRow.minOf { cell -> cell.leftNorm } <= 0.081f)
        assertTrue(bottomRow.maxOf { cell -> cell.rightNorm } >= 0.919f)
    }

    @Test
    fun rowShiftTranslatesEveryPlateWithoutChangingPlateWidths() {
        val layout = generatedProductCircularPlateLayout(rowCount = 1, widestRowPlateCount = 4)
        val before = layout.toRoofPlateCells(
            target = ProductLayoutTarget.FLOOR,
            rowCount = 1,
            widestRowPlateCount = 4,
        ).sortedBy { cell -> cell.plateId }

        val after = layout
            .withRowShift(rowNumber = 1, shiftRatio = 0.5f)
            .toRoofPlateCells(
                target = ProductLayoutTarget.FLOOR,
                rowCount = 1,
                widestRowPlateCount = 4,
            )
            .sortedBy { cell -> cell.plateId }

        val expectedDelta = after.first().leftNorm - before.first().leftNorm
        before.zip(after).forEach { (beforeCell, afterCell) ->
            val beforeWidth = beforeCell.rightNorm - beforeCell.leftNorm
            val afterWidth = afterCell.rightNorm - afterCell.leftNorm
            assertEquals(beforeWidth, afterWidth, 0.001f)
            assertEquals(expectedDelta, afterCell.leftNorm - beforeCell.leftNorm, 0.001f)
            assertEquals(expectedDelta, afterCell.rightNorm - beforeCell.rightNorm, 0.001f)
        }
    }

    @Test
    fun rowShiftKeepsVisibleChordCoveredAtBothExtremes() {
        val base = generatedProductCircularPlateLayout(rowCount = 1, widestRowPlateCount = 4)
        listOf(-1f, 1f).forEach { shift ->
            val rowCells = base
                .withRowShift(rowNumber = 1, shiftRatio = shift)
                .toRoofPlateCells(
                    target = ProductLayoutTarget.FLOOR,
                    rowCount = 1,
                    widestRowPlateCount = 4,
                )

            assertTrue("left side should stay covered at shift $shift", rowCells.minOf { cell -> cell.leftNorm } <= 0.081f)
            assertTrue("right side should stay covered at shift $shift", rowCells.maxOf { cell -> cell.rightNorm } >= 0.919f)
        }
    }

    @Test
    fun rowHeightChangePreservesVerticalSeamPositions() {
        val layout = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    shiftRatio = -0.2f,
                    plates = listOf(
                        ProductCustomCircularPlate(widthWeight = 1f),
                        ProductCustomCircularPlate(widthWeight = 1.4f),
                        ProductCustomCircularPlate(widthWeight = 0.8f),
                        ProductCustomCircularPlate(widthWeight = 1.2f),
                    ),
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    shiftRatio = 0.35f,
                    plates = listOf(
                        ProductCustomCircularPlate(widthWeight = 1.2f),
                        ProductCustomCircularPlate(widthWeight = 0.9f),
                        ProductCustomCircularPlate(widthWeight = 1.1f),
                        ProductCustomCircularPlate(widthWeight = 0.8f),
                    ),
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 3,
                    shiftRatio = 0.1f,
                    plates = listOf(
                        ProductCustomCircularPlate(widthWeight = 1f),
                        ProductCustomCircularPlate(widthWeight = 1f),
                        ProductCustomCircularPlate(widthWeight = 1.5f),
                        ProductCustomCircularPlate(widthWeight = 0.7f),
                    ),
                ),
            ),
        )

        val before = layout.toRoofPlateCells(
            target = ProductLayoutTarget.FLOOR,
            rowCount = 3,
            widestRowPlateCount = 4,
        )
        val after = layout
            .withRowHeight(rowNumber = 2, heightWeight = 2.1f)
            .toRoofPlateCells(
                target = ProductLayoutTarget.FLOOR,
                rowCount = 3,
                widestRowPlateCount = 4,
            )

        listOf(1, 2, 3).forEach { rowNumber ->
            val beforeSeams = internalVerticalSeams(before, rowNumber)
            val afterSeams = internalVerticalSeams(after, rowNumber)

            assertEquals(beforeSeams.size, afterSeams.size)
            beforeSeams.zip(afterSeams).forEach { (beforeSeam, afterSeam) ->
                assertEquals(beforeSeam, afterSeam, 0.001f)
            }
        }
    }

    @Test
    fun rowHeightLimitDependsOnRemainingRows() {
        val twoRows = generatedProductCircularPlateLayout(rowCount = 2, widestRowPlateCount = 4)
        val fiveRows = generatedProductCircularPlateLayout(rowCount = 5, widestRowPlateCount = 4)

        val twoRowMax = twoRows.withRowHeight(rowNumber = 1, heightWeight = 99f).rows[0].heightWeight
        val fiveRowMax = fiveRows.withRowHeight(rowNumber = 1, heightWeight = 99f).rows[0].heightWeight
        val fiveRowMin = fiveRows.withRowHeight(rowNumber = 1, heightWeight = -99f).rows[0].heightWeight
        val fiveRowRange = fiveRows.rowHeightValueRange(rowNumber = 1)

        assertTrue(twoRowMax > fiveRowMax)
        assertEquals(fiveRowRange.endInclusive, fiveRowMax, 0.001f)
        assertEquals(fiveRowRange.start, fiveRowMin, 0.001f)
    }

    @Test
    fun rowHeightChangeDoesNotChangePhoneReproMergedPlateHorizontalBounds() {
        val layout = phoneMergedRoofLayout()
        val tall = layout
            .withRowHeight(rowNumber = 4, heightWeight = 1.79f)
            .toRoofPlateCells(
                target = ProductLayoutTarget.EXTERNAL_ROOF,
                rowCount = 4,
                widestRowPlateCount = 5,
            )
        val short = layout
            .withRowHeight(rowNumber = 4, heightWeight = 0.80f)
            .toRoofPlateCells(
                target = ProductLayoutTarget.EXTERNAL_ROOF,
                rowCount = 4,
                widestRowPlateCount = 5,
            )

        assertEquals(
            tall.first { cell -> cell.plateId == "18a" }.mapLabel,
            short.first { cell -> cell.plateId == "18a" }.mapLabel,
        )
        assertSameHorizontalBounds(
            tall.first { cell -> cell.plateId == "18a" },
            short.first { cell -> cell.plateId == "18a" },
        )
    }

    @Test
    fun splittingMergedShiftedPlateDoesNotMoveExistingSeams() {
        val shiftedMerged = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    shiftRatio = 0.82f,
                    plates = List(3) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
            ),
        ).mergePlate(
            target = ProductLayoutTarget.FLOOR,
            plateLabel = "1.2",
            direction = 1,
        )
        val before = shiftedMerged.toRoofPlateCells(
            target = ProductLayoutTarget.FLOOR,
            rowCount = 1,
            widestRowPlateCount = 3,
        )
        val after = shiftedMerged
            .splitPlate(
                target = ProductLayoutTarget.FLOOR,
                plateLabel = "1.2",
                parts = 2,
            )
            .toRoofPlateCells(
                target = ProductLayoutTarget.FLOOR,
                rowCount = 1,
                widestRowPlateCount = 3,
            )

        assertSameHorizontalBounds(
            before.first { cell -> cell.plateId == "1.1" },
            after.first { cell -> cell.plateId == "1.1" },
        )
    }

    @Test
    fun rowShiftAcrossCompleteHorizontalSeamMovesOnlySelectedRow() {
        val shifted = generatedProductCircularPlateLayout(rowCount = 2, widestRowPlateCount = 4)
            .withRowShift(rowNumber = 2, shiftRatio = 0.42f)

        assertEquals(setOf(1), shifted.rowGroupFor(1))
        assertEquals(setOf(2), shifted.rowGroupFor(2))
        assertEquals(0f, shifted.rows[0].shiftRatio, 0.001f)
        assertEquals(0.42f, shifted.rows[1].shiftRatio, 0.001f)
    }

    @Test
    fun rowShiftSnapsToAdjacentRowWhenDraggedClose() {
        val layout = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    shiftRatio = 0.42f,
                    plates = List(4) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    shiftRatio = 0f,
                    plates = List(4) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
            ),
        )

        val shifted = layout.withRowShift(rowNumber = 2, shiftRatio = 0.405f)

        assertEquals(0.42f, shifted.rows[1].shiftRatio, 0.001f)
    }

    @Test
    fun rowShiftDoesNotSnapWhenDraggedAwayFromAdjacentRow() {
        val layout = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    shiftRatio = 0.42f,
                    plates = List(4) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    shiftRatio = 0f,
                    plates = List(4) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
            ),
        )

        val shifted = layout.withRowShift(rowNumber = 2, shiftRatio = 0.31f)

        assertEquals(0.31f, shifted.rows[1].shiftRatio, 0.001f)
    }

    @Test
    fun crossRowMergeRejectsDifferentWidthPlatesWithoutAutoSplitting() {
        val layout = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    plates = List(3) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    plates = listOf(
                        ProductCustomCircularPlate(widthWeight = 1.5f),
                        ProductCustomCircularPlate(widthWeight = 0.5f),
                        ProductCustomCircularPlate(widthWeight = 1.5f),
                    ),
                ),
            ),
        )

        val merged = layout.mergePlateAcrossRows(
            target = ProductLayoutTarget.FLOOR,
            plateLabel = "1.2",
            direction = 1,
        )

        assertEquals(layout, merged)
        assertEquals(3, merged.rows[0].plates.size)
        assertEquals(3, merged.rows[1].plates.size)
        assertTrue(merged.rows.flatMap { row -> row.plates }.none { plate -> plate.verticalMergeGroupKey != null })
        assertEquals(null, layout.crossRowMergeTarget(ProductLayoutTarget.FLOOR, "1.2", 1))
    }

    @Test
    fun crossRowMergeRejectsSmallVisibleEdgeMismatch() {
        val layout = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    plates = List(3) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    plates = listOf(
                        ProductCustomCircularPlate(widthWeight = 1.01f),
                        ProductCustomCircularPlate(widthWeight = 0.99f),
                        ProductCustomCircularPlate(widthWeight = 1f),
                    ),
                ),
            ),
        )

        assertEquals(null, layout.crossRowMergeTarget(ProductLayoutTarget.FLOOR, "1.2", 1))
        assertEquals(
            layout,
            layout.mergePlateAcrossRows(
                target = ProductLayoutTarget.FLOOR,
                plateLabel = "1.2",
                direction = 1,
            ),
        )
    }

    @Test
    fun seamResizeSnapsToAdjacentRowWhenDraggedClose() {
        val layout = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    plates = List(3) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    plates = listOf(
                        ProductCustomCircularPlate(widthWeight = 1.02f),
                        ProductCustomCircularPlate(widthWeight = 0.98f),
                        ProductCustomCircularPlate(widthWeight = 1f),
                    ),
                ),
            ),
        )

        val snapped = layout.withAdjacentPlateBoundaryBias(
            target = ProductLayoutTarget.FLOOR,
            plateLabel = "2.2",
            direction = -1,
            bias = 0.02f,
        )

        assertEquals("2.2", snapped.crossRowMergeTarget(ProductLayoutTarget.FLOOR, "1.2", 1)?.label)
    }

    @Test
    fun crossRowMergeAllowsAlignedSameWidthPlatesWithoutSplitting() {
        val layout = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    plates = List(3) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    plates = List(3) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
            ),
        )

        val merged = layout.mergePlateAcrossRows(
            target = ProductLayoutTarget.FLOOR,
            plateLabel = "1.2",
            direction = 1,
        )

        assertEquals(setOf(1, 2), merged.rowGroupFor(1))
        assertEquals(setOf(1, 2), merged.rowGroupFor(2))
        assertEquals(3, merged.rows[0].plates.size)
        assertEquals(3, merged.rows[1].plates.size)
        assertEquals(setOf("1.2", "2.2"), merged.verticalMergeGroupLabels(ProductLayoutTarget.FLOOR, "1.2"))

        val cells = merged.toRoofPlateCells(
            target = ProductLayoutTarget.FLOOR,
            rowCount = 2,
            widestRowPlateCount = 3,
        )
        val mergedCell = cells.single { cell -> cell.plateId == "1.2" }

        assertEquals(5, cells.size)
        assertTrue(cells.none { cell -> cell.plateId == "2.2" })
        assertEquals("M1", mergedCell.mapLabel)
        assertTrue(mergedCell.selectionLabel.contains("Merged plate M1"))
        assertEquals("M1", merged.displayPlateLabelFor(ProductLayoutTarget.FLOOR, "1.2"))
        assertTrue(mergedCell.topNorm < 0.1f)
        assertTrue(mergedCell.bottomNorm > 0.9f)
        assertEquals(0.5f, mergedCell.xNorm, 0.001f)
    }

    @Test
    fun mergedVisiblePlatesCanMergeAgainWithoutReturningToRawRows() {
        val layout = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    plates = List(2) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    plates = List(2) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
            ),
        )

        val withTwoMergedColumns = layout
            .mergePlateAcrossRows(
                target = ProductLayoutTarget.FLOOR,
                plateLabel = "1.1",
                direction = 1,
            )
            .mergePlateAcrossRows(
                target = ProductLayoutTarget.FLOOR,
                plateLabel = "1.2",
                direction = 1,
            )

        val beforeCells = withTwoMergedColumns.toRoofPlateCells(
            target = ProductLayoutTarget.FLOOR,
            rowCount = 2,
            widestRowPlateCount = 2,
        )
        assertEquals(listOf("M1", "M2"), beforeCells.map { cell -> cell.mapLabel })

        val mergedAgain = withTwoMergedColumns.mergePlate(
            target = ProductLayoutTarget.FLOOR,
            plateLabel = "1.1",
            direction = 1,
        )
        val afterCells = mergedAgain.toRoofPlateCells(
            target = ProductLayoutTarget.FLOOR,
            rowCount = 2,
            widestRowPlateCount = 2,
        )
        val mergedCell = afterCells.single { cell -> cell.mapLabel == "M1" }

        assertEquals(1, afterCells.size)
        assertTrue(mergedCell.leftNorm <= 0.081f)
        assertTrue(mergedCell.rightNorm >= 0.919f)
        assertTrue(mergedCell.topNorm < 0.1f)
        assertTrue(mergedCell.bottomNorm > 0.9f)
    }

    @Test
    fun verticallyMergedPlateCannotMergeRightWithShortNeighbor() {
        val layout = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    plates = List(3) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    plates = List(3) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
            ),
        )

        val mergedDown = layout.mergePlateAcrossRows(
            target = ProductLayoutTarget.FLOOR,
            plateLabel = "1.2",
            direction = 1,
        )
        val attemptedRightMerge = mergedDown.mergePlate(
            target = ProductLayoutTarget.FLOOR,
            plateLabel = "1.2",
            direction = 1,
        )

        assertEquals(mergedDown, attemptedRightMerge)
        val cells = attemptedRightMerge.toRoofPlateCells(
            target = ProductLayoutTarget.FLOOR,
            rowCount = 2,
            widestRowPlateCount = 3,
        )

        assertTrue(cells.any { cell -> cell.plateId == "1.3" })
        assertTrue(cells.any { cell -> cell.plateId == "2.3" })
        assertNoVisibleRowOverlap(cells)
    }

    @Test
    fun verticallyMergedPlateCannotMergeLeftWithShortNeighbor() {
        val layout = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    plates = List(3) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    plates = List(3) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
            ),
        )

        val mergedDown = layout.mergePlateAcrossRows(
            target = ProductLayoutTarget.FLOOR,
            plateLabel = "1.2",
            direction = 1,
        )
        val attemptedLeftMerge = mergedDown.mergePlate(
            target = ProductLayoutTarget.FLOOR,
            plateLabel = "1.2",
            direction = -1,
        )

        assertEquals(mergedDown, attemptedLeftMerge)
        val cells = attemptedLeftMerge.toRoofPlateCells(
            target = ProductLayoutTarget.FLOOR,
            rowCount = 2,
            widestRowPlateCount = 3,
        )

        assertTrue(cells.any { cell -> cell.plateId == "1.1" })
        assertTrue(cells.any { cell -> cell.plateId == "2.1" })
        assertNoVisibleRowOverlap(cells)
    }

    @Test
    fun verticalMergedPlateSeamResizeUpdatesEverySourceRowSegment() {
        val merged = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    plates = List(3) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    plates = List(3) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
            ),
        ).mergePlateAcrossRows(
            target = ProductLayoutTarget.FLOOR,
            plateLabel = "1.2",
            direction = 1,
        )

        val adjusted = merged.withAdjacentPlateBoundaryBias(
            target = ProductLayoutTarget.FLOOR,
            plateLabel = "1.2",
            direction = 1,
            bias = 0.2f,
        )

        assertEquals(1.152f, adjusted.rows[0].plates[1].widthWeight, 0.001f)
        assertEquals(0.848f, adjusted.rows[0].plates[2].widthWeight, 0.001f)
        assertEquals(1.152f, adjusted.rows[1].plates[1].widthWeight, 0.001f)
        assertEquals(0.848f, adjusted.rows[1].plates[2].widthWeight, 0.001f)
        assertEquals(setOf("1.2", "2.2"), adjusted.verticalMergeGroupLabels(ProductLayoutTarget.FLOOR, "1.2"))
    }

    @Test
    fun verticalMergedPlateSeamResizeKeepsOneSharedAbsoluteBoundary() {
        val mergeKey = "merged-column"
        val layout = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    plates = listOf(
                        ProductCustomCircularPlate(widthWeight = 3f),
                        ProductCustomCircularPlate(widthWeight = 2f, verticalMergeGroupKey = mergeKey),
                        ProductCustomCircularPlate(widthWeight = 2f),
                        ProductCustomCircularPlate(widthWeight = 3f),
                    ),
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    plates = listOf(
                        ProductCustomCircularPlate(widthWeight = 3f),
                        ProductCustomCircularPlate(widthWeight = 2f, verticalMergeGroupKey = mergeKey),
                        ProductCustomCircularPlate(widthWeight = 3f),
                        ProductCustomCircularPlate(widthWeight = 2f),
                    ),
                ),
            ),
        )

        val adjusted = layout.withAdjacentPlateBoundaryBias(
            target = ProductLayoutTarget.FLOOR,
            plateLabel = "1.2",
            direction = 1,
            bias = 0.2f,
        )
        val cells = adjusted.toRoofPlateCells(
            target = ProductLayoutTarget.FLOOR,
            rowCount = 2,
            widestRowPlateCount = 4,
        )

        assertEquals(1, cells.count { cell -> cell.mapLabel == "M1" })
        assertTrue(cells.none { cell -> cell.plateId == "2.2" })
        assertNoVisibleAreaOverlap(cells)
    }

    @Test
    fun verticalMergedPlateCanSplitIntoSeparateMergedParts() {
        val merged = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    plates = List(3) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    plates = List(3) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
            ),
        ).mergePlateAcrossRows(
            target = ProductLayoutTarget.FLOOR,
            plateLabel = "1.2",
            direction = 1,
        )

        val split = merged.splitPlate(
            target = ProductLayoutTarget.FLOOR,
            plateLabel = "1.2",
            parts = 2,
        )

        assertEquals(4, split.rows[0].plates.size)
        assertEquals(4, split.rows[1].plates.size)
        assertEquals(setOf("1.2a", "2.2a"), split.verticalMergeGroupLabels(ProductLayoutTarget.FLOOR, "1.2a"))
        assertEquals(setOf("1.2b", "2.2b"), split.verticalMergeGroupLabels(ProductLayoutTarget.FLOOR, "1.2b"))

        val cells = split.toRoofPlateCells(
            target = ProductLayoutTarget.FLOOR,
            rowCount = 2,
            widestRowPlateCount = 3,
        )

        assertEquals(8, split.rows.sumOf { row -> row.plates.size })
        assertEquals(6, cells.size)
        assertEquals(listOf("M1", "M2"), cells.filter { cell -> cell.mapLabel.startsWith("M") }.map { cell -> cell.mapLabel })
        assertNoVisibleAreaOverlap(cells)
    }

    @Test
    fun sameRowMergedPlateCanSplitIntoCleanParts() {
        val merged = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    plates = List(3) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
            ),
        ).mergePlate(
            target = ProductLayoutTarget.FLOOR,
            plateLabel = "1.2",
            direction = 1,
        )

        val split = merged.splitPlate(
            target = ProductLayoutTarget.FLOOR,
            plateLabel = "1.2",
            parts = 2,
        )

        assertEquals(3, split.rows[0].plates.size)
        assertEquals(1f, split.rows[0].plates[1].widthWeight, 0.001f)
        assertEquals(1f, split.rows[0].plates[2].widthWeight, 0.001f)
        assertTrue(split.rows[0].plates.none { plate -> plate.verticalMergeGroupKey != null })

        val cells = split.toRoofPlateCells(
            target = ProductLayoutTarget.FLOOR,
            rowCount = 1,
            widestRowPlateCount = 3,
        )

        assertEquals(3, cells.size)
        assertTrue(cells.none { cell -> cell.mapLabel.startsWith("M") })
        assertNoVisibleAreaOverlap(cells)
    }

    @Test
    fun sameHeightMergedPlatesCanMergeHorizontally() {
        val layout = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    plates = List(2) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    plates = List(2) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
            ),
        )

        val cells = layout
            .mergePlateAcrossRows(
                target = ProductLayoutTarget.FLOOR,
                plateLabel = "1.1",
                direction = 1,
            )
            .mergePlateAcrossRows(
                target = ProductLayoutTarget.FLOOR,
                plateLabel = "1.2",
                direction = 1,
            )
            .mergePlate(
                target = ProductLayoutTarget.FLOOR,
                plateLabel = "1.1",
                direction = 1,
            )
            .toRoofPlateCells(
                target = ProductLayoutTarget.FLOOR,
                rowCount = 2,
                widestRowPlateCount = 2,
            )

        assertEquals(1, cells.size)
        assertTrue(cells.single().topNorm < 0.1f)
        assertTrue(cells.single().bottomNorm > 0.9f)
        assertTrue(cells.single().leftNorm <= 0.081f)
        assertTrue(cells.single().rightNorm >= 0.919f)
        assertNoVisibleRowOverlap(cells)
    }

    @Test
    fun partiallyAlignedVerticalMergeUsesSharedOverlapNotFullUnion() {
        val mergeKey = "m_primary:8:3_8_phone_repro"
        val layout = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    shiftRatio = -0.03719914f,
                    plates = listOf(
                        ProductCustomCircularPlate(widthWeight = 1f),
                        ProductCustomCircularPlate(widthWeight = 1f),
                        ProductCustomCircularPlate(widthWeight = 1f, verticalMergeGroupKey = mergeKey),
                        ProductCustomCircularPlate(widthWeight = 1f),
                        ProductCustomCircularPlate(widthWeight = 1f),
                    ),
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    shiftRatio = -0.03719914f,
                    heightWeight = 0.7118709f,
                    plates = listOf(
                        ProductCustomCircularPlate(widthWeight = 1f),
                        ProductCustomCircularPlate(widthWeight = 1f, verticalMergeGroupKey = "other"),
                        ProductCustomCircularPlate(widthWeight = 0.82360953f, verticalMergeGroupKey = "other"),
                        ProductCustomCircularPlate(widthWeight = 1.1991588f, verticalMergeGroupKey = mergeKey),
                        ProductCustomCircularPlate(widthWeight = 1.3290521f),
                        ProductCustomCircularPlate(widthWeight = 0.64817977f),
                    ),
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 3,
                    plates = List(5) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
            ),
        )

        val cells = layout.toRoofPlateCells(
            target = ProductLayoutTarget.EXTERNAL_ROOF,
            rowCount = 3,
            widestRowPlateCount = 5,
        )
        val mergedCell = cells.single { cell -> cell.mapLabel == "M1" }

        assertTrue(mergedCell.rightNorm <= cells.single { cell -> cell.plateId == "4" }.leftNorm + 0.001f)
        assertNoVisibleAreaOverlap(cells)
    }

    @Test
    fun invalidCrossRowMergeDoesNotRenderSyntheticUnionRectangle() {
        val mergeKey = "m_primary:8:9_8_13_14_phone_repro"
        val layout = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    plates = List(5) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    shiftRatio = 1f,
                    plates = listOf(
                        ProductCustomCircularPlate(widthWeight = 1f),
                        ProductCustomCircularPlate(widthWeight = 1f),
                        ProductCustomCircularPlate(widthWeight = 1f, verticalMergeGroupKey = mergeKey),
                        ProductCustomCircularPlate(widthWeight = 1f, verticalMergeGroupKey = mergeKey),
                        ProductCustomCircularPlate(widthWeight = 1f),
                        ProductCustomCircularPlate(widthWeight = 1f),
                    ),
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 3,
                    shiftRatio = 0.8838835f,
                    plates = listOf(
                        ProductCustomCircularPlate(widthWeight = 1.1306415f),
                        ProductCustomCircularPlate(widthWeight = 0.8534856f, verticalMergeGroupKey = mergeKey),
                        ProductCustomCircularPlate(widthWeight = 0.8534852f, verticalMergeGroupKey = mergeKey),
                        ProductCustomCircularPlate(widthWeight = 1.1623878f),
                        ProductCustomCircularPlate(widthWeight = 1f),
                    ),
                ),
            ),
        )

        val cells = layout.toRoofPlateCells(
            target = ProductLayoutTarget.EXTERNAL_ROOF,
            rowCount = 3,
            widestRowPlateCount = 5,
        )

        assertTrue(cells.none { cell -> cell.mapLabel == "M1" })
        assertNoVisibleAreaOverlap(cells)
    }

    @Test
    fun sameRowPlatesCanMergeHorizontally() {
        val layout = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    plates = List(3) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
            ),
        )

        val cells = layout
            .mergePlate(
                target = ProductLayoutTarget.FLOOR,
                plateLabel = "1.2",
                direction = 1,
            )
            .toRoofPlateCells(
                target = ProductLayoutTarget.FLOOR,
                rowCount = 1,
                widestRowPlateCount = 3,
            )

        assertEquals(2, cells.size)
        assertTrue(cells.none { cell -> cell.plateId == "1.3" })
        assertNoVisibleRowOverlap(cells)
    }

    @Test
    fun crossRowMergeLeavesUnalignedDifferentWidthRowsUnchanged() {
        val layout = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    plates = List(3) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    plates = listOf(
                        ProductCustomCircularPlate(widthWeight = 1.5f),
                        ProductCustomCircularPlate(widthWeight = 0.5f),
                        ProductCustomCircularPlate(widthWeight = 1.5f),
                    ),
                ),
            ),
        )

        val merged = layout.mergePlateAcrossRows(
            target = ProductLayoutTarget.FLOOR,
            plateLabel = "1.2",
            direction = 1,
        )

        assertEquals(layout, merged)
    }

    @Test
    fun rowShiftSplitsCrossRowMergedPlateAndKeepsOnlySelectedRowOffset() {
        val layout = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    plates = List(4) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    plates = List(4) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
            ),
        )
        val merged = layout
            .mergePlateAcrossRows(
                target = ProductLayoutTarget.FLOOR,
                plateLabel = "1.1",
                direction = 1,
            )

        val shifted = merged.withRowShift(rowNumber = 2, shiftRatio = 0.42f)

        assertEquals(setOf(1), shifted.rowGroupFor(1))
        assertEquals(setOf(2), shifted.rowGroupFor(2))
        assertTrue(shifted.rows.flatMap { row -> row.plates }.none { plate -> plate.verticalMergeGroupKey != null })
        assertEquals(0f, shifted.rows[0].shiftRatio, 0.001f)
        assertEquals(0.42f, shifted.rows[1].shiftRatio, 0.001f)
    }

    @Test
    fun rowShiftSplitsAlreadyOffsetMergedRowsWithoutMovingTheOtherRow() {
        val mergeKey = "merged-column"
        val layout = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    shiftRatio = 0.18f,
                    plates = listOf(ProductCustomCircularPlate(verticalMergeGroupKey = mergeKey)),
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    shiftRatio = -0.24f,
                    plates = listOf(ProductCustomCircularPlate(verticalMergeGroupKey = mergeKey)),
                ),
            ),
        )

        val shifted = layout.withRowShift(rowNumber = 2, shiftRatio = 0.37f)

        assertEquals(setOf(1), shifted.rowGroupFor(1))
        assertEquals(setOf(2), shifted.rowGroupFor(2))
        assertTrue(shifted.rows.flatMap { row -> row.plates }.none { plate -> plate.verticalMergeGroupKey != null })
        assertEquals(0.18f, shifted.rows[0].shiftRatio, 0.001f)
        assertEquals(0.37f, shifted.rows[1].shiftRatio, 0.001f)
    }

    @Test
    fun rowShiftOfDifferentWidthCrossMergedRowsSplitsMergeBeforeMovingSelectedRow() {
        val mergeKey = "merged-layer-anchor"
        val layout = ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    plates = List(7) { index ->
                        ProductCustomCircularPlate(
                            verticalMergeGroupKey = mergeKey.takeIf { index == 1 },
                        )
                    },
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    plates = List(4) { index ->
                        ProductCustomCircularPlate(
                            verticalMergeGroupKey = mergeKey.takeIf { index == 1 },
                        )
                    },
                ),
            ),
        )
        val before = layout.toRoofPlateCells(
            target = ProductLayoutTarget.FLOOR,
            rowCount = 2,
            widestRowPlateCount = 7,
        )

        val shifted = layout.withRowShift(rowNumber = 1, shiftRatio = -0.5f)
        val after = shifted.toRoofPlateCells(
            target = ProductLayoutTarget.FLOOR,
            rowCount = 2,
            widestRowPlateCount = 7,
        )

        val rowOneDelta = after.single { cell -> cell.plateId == "1.1" }.leftNorm -
            before.single { cell -> cell.plateId == "1.1" }.leftNorm
        val rowTwoDelta = after.single { cell -> cell.plateId == "2.1" }.leftNorm -
            before.single { cell -> cell.plateId == "2.1" }.leftNorm

        assertEquals(0f, rowTwoDelta, 0.001f)
        assertTrue(rowOneDelta < -0.001f)
        assertEquals(-0.5f, shifted.rows[0].shiftRatio, 0.001f)
        assertEquals(0f, shifted.rows[1].shiftRatio, 0.001f)
        assertTrue(shifted.rows.flatMap { row -> row.plates }.none { plate -> plate.verticalMergeGroupKey != null })
    }

    private fun assertNoVisibleRowOverlap(cells: List<RoofPlateCell>) {
        val cellsByRow = cells.groupBy { cell -> cell.rowNumber }
        cellsByRow.values.forEach { rowCells ->
            rowCells.sortedBy { cell -> cell.leftNorm }
                .zipWithNext()
                .forEach { (left, right) ->
                    assertTrue(
                        "${left.plateId} [${left.leftNorm}, ${left.rightNorm}] should not overlap " +
                            "${right.plateId} [${right.leftNorm}, ${right.rightNorm}]",
                        left.rightNorm <= right.leftNorm + 0.001f,
                    )
                }
        }
    }

    private fun internalVerticalSeams(cells: List<RoofPlateCell>, rowNumber: Int): List<Float> =
        cells
            .filter { cell -> cell.rowNumber == rowNumber }
            .sortedBy { cell -> cell.leftNorm }
            .dropLast(1)
            .map { cell -> cell.rightNorm }

    private fun assertSameHorizontalBounds(
        first: RoofPlateCell,
        second: RoofPlateCell,
    ) {
        assertEquals(first.leftNorm, second.leftNorm, 0.001f)
        assertEquals(first.rightNorm, second.rightNorm, 0.001f)
        assertEquals(first.xNorm, second.xNorm, 0.001f)
    }

    private fun assertNoVisibleAreaOverlap(cells: List<RoofPlateCell>) {
        val sortedCells = cells.sortedBy { cell -> cell.plateId }
        sortedCells
            .forEachIndexed { index, first ->
                sortedCells.drop(index + 1).forEach { second ->
                    val horizontalOverlap = minOf(first.rightNorm, second.rightNorm) -
                        maxOf(first.leftNorm, second.leftNorm)
                    val verticalOverlap = minOf(first.bottomNorm, second.bottomNorm) -
                        maxOf(first.topNorm, second.topNorm)
                    assertTrue(
                        "${first.plateId} [${first.leftNorm}, ${first.rightNorm}, ${first.topNorm}, ${first.bottomNorm}] " +
                            "should not overlap ${second.plateId} " +
                            "[${second.leftNorm}, ${second.rightNorm}, ${second.topNorm}, ${second.bottomNorm}]",
                        horizontalOverlap <= 0.001f || verticalOverlap <= 0.001f,
                    )
                }
            }
    }

    private fun phoneMergedRoofLayout(): ProductCustomCircularPlateLayout {
        val upperMergeKey = "m_primary:8:10_9_8_7_phone"
        val leftMergeKey = "m_primary:19:13_19_phone"
        val rightMergeKey = "m_primary:18a:14_18a_phone"
        return ProductCustomCircularPlateLayout(
            rows = listOf(
                ProductCustomCircularPlateRow(
                    rowNumber = 1,
                    heightWeight = 0.91559076f,
                    plates = List(5) { ProductCustomCircularPlate(widthWeight = 1f) },
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 2,
                    shiftRatio = -0.065645486f,
                    heightWeight = 0.77578497f,
                    plates = listOf(
                        ProductCustomCircularPlate(widthWeight = 1f),
                        ProductCustomCircularPlate(widthWeight = 1f, verticalMergeGroupKey = upperMergeKey),
                        ProductCustomCircularPlate(widthWeight = 1f, verticalMergeGroupKey = upperMergeKey),
                        ProductCustomCircularPlate(widthWeight = 1f, verticalMergeGroupKey = upperMergeKey),
                        ProductCustomCircularPlate(widthWeight = 1f, verticalMergeGroupKey = upperMergeKey),
                        ProductCustomCircularPlate(widthWeight = 1f),
                    ),
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 3,
                    shiftRatio = 1f,
                    heightWeight = 1f,
                    plates = listOf(
                        ProductCustomCircularPlate(widthWeight = 1f),
                        ProductCustomCircularPlate(widthWeight = 1f, verticalMergeGroupKey = leftMergeKey),
                        ProductCustomCircularPlate(widthWeight = 1.3298813f, verticalMergeGroupKey = rightMergeKey),
                        ProductCustomCircularPlate(widthWeight = 0.6701187f),
                        ProductCustomCircularPlate(widthWeight = 1f),
                    ),
                ),
                ProductCustomCircularPlateRow(
                    rowNumber = 4,
                    shiftRatio = 0.92376035f,
                    heightWeight = 0.80491924f,
                    plates = listOf(
                        ProductCustomCircularPlate(widthWeight = 0.663729f),
                        ProductCustomCircularPlate(widthWeight = 0.939882f, verticalMergeGroupKey = leftMergeKey),
                        ProductCustomCircularPlate(
                            widthWeight = 1.1253928f,
                            splitGroupKey = "r4p2_phone",
                            splitPartIndex = 0,
                            splitPartCount = 2,
                            verticalMergeGroupKey = rightMergeKey,
                        ),
                        ProductCustomCircularPlate(
                            widthWeight = 0.27099618f,
                            splitGroupKey = "r4p2_phone",
                            splitPartIndex = 1,
                            splitPartCount = 2,
                        ),
                        ProductCustomCircularPlate(widthWeight = 1f),
                    ),
                ),
            ),
        )
    }
}

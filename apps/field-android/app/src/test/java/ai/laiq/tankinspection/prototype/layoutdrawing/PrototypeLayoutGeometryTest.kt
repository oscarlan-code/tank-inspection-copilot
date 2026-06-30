package ai.laiq.tankinspection.prototype.layoutdrawing

import kotlin.math.abs
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PrototypeLayoutGeometryTest {
    @Test
    fun draftFromSketchUsesOneDrawnBoundaryToSplitRoofIntoTwoPlates() {
        val draft = PrototypeLayoutGeometry.draftFromSketch(
            input = PrototypeRecognitionInput(
                surface = PrototypeLayoutSurface.EXTERNAL_ROOF,
                sourceType = PrototypeLayoutSourceType.SKETCH,
                strokes = listOf(
                    boundaryStroke(
                        PrototypeNormalizedPoint(0.5f, 0f),
                        PrototypeNormalizedPoint(0.5f, 1f),
                    ),
                ),
            ),
        )

        assertEquals(2, draft.plates.size)
        assertTrue(draft.plates.all { plate -> plate.polygon.size >= 3 })
        assertTrue(draft.plates.all { plate -> plate.sourceConfidence == 0.88f })
        assertPlateAreaCloseToRoof(draft.plates, tolerance = 0.05f)
    }

    @Test
    fun draftFromSketchUsesIntersectingBoundariesToGenerateFourRoofPlates() {
        val draft = PrototypeLayoutGeometry.draftFromSketch(
            input = PrototypeRecognitionInput(
                surface = PrototypeLayoutSurface.EXTERNAL_ROOF,
                sourceType = PrototypeLayoutSourceType.SKETCH,
                strokes = listOf(
                    boundaryStroke(
                        PrototypeNormalizedPoint(0.5f, 0f),
                        PrototypeNormalizedPoint(0.5f, 1f),
                    ),
                    boundaryStroke(
                        PrototypeNormalizedPoint(0f, 0.5f),
                        PrototypeNormalizedPoint(1f, 0.5f),
                    ),
                ),
            ),
        )

        assertEquals(4, draft.plates.size)
        assertTrue(draft.plates.all { plate -> plate.polygon.size >= 3 })
        assertTrue(draft.plates.all { plate -> plate.sourceConfidence == 0.88f })
        assertPlateAreaCloseToRoof(draft.plates, tolerance = 0.05f)
    }

    @Test
    fun draftFromSketchPreservesCircleElementRadiusAsSizeLabel() {
        val draft = PrototypeLayoutGeometry.draftFromSketch(
            input = PrototypeRecognitionInput(
                surface = PrototypeLayoutSurface.EXTERNAL_ROOF,
                sourceType = PrototypeLayoutSourceType.SKETCH,
                strokes = listOf(
                    boundaryStroke(
                        PrototypeNormalizedPoint(0.5f, 0f),
                        PrototypeNormalizedPoint(0.5f, 1f),
                    ),
                    PrototypeSketchStroke(
                        kind = PrototypeSketchStrokeKind.ELEMENT,
                        points = listOf(
                            PrototypeNormalizedPoint(0.35f, 0.5f),
                            PrototypeNormalizedPoint(0.43f, 0.5f),
                        ),
                    ),
                ),
            ),
        )

        assertEquals(1, draft.elements.size)
        assertEquals("r=0.08", draft.elements.first().sizeLabel)
    }

    private fun boundaryStroke(
        start: PrototypeNormalizedPoint,
        end: PrototypeNormalizedPoint,
    ): PrototypeSketchStroke =
        PrototypeSketchStroke(
            kind = PrototypeSketchStrokeKind.BOUNDARY,
            points = listOf(start, end),
        )

    private fun assertPlateAreaCloseToRoof(
        plates: List<PrototypeLayoutPlate>,
        tolerance: Float,
    ) {
        val generatedArea = plates.sumOf { plate -> abs(polygonArea(plate.polygon)).toDouble() }.toFloat()
        val expectedArea = Math.PI.toFloat() * 0.5f * 0.5f
        assertTrue(
            "Expected plate area $generatedArea to be close to roof area $expectedArea",
            abs(generatedArea - expectedArea) <= tolerance,
        )
    }

    private fun polygonArea(points: List<PrototypeNormalizedPoint>): Float {
        if (points.size < 3) return 0f
        var sum = 0f
        points.forEachIndexed { index, point ->
            val next = points[(index + 1) % points.size]
            sum += point.x * next.y - next.x * point.y
        }
        return sum / 2f
    }
}

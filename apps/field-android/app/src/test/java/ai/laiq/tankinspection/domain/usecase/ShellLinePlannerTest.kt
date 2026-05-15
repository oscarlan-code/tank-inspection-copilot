package ai.laiq.tankinspection.domain.usecase

import ai.laiq.tankinspection.domain.model.ReferenceMode
import ai.laiq.tankinspection.domain.model.RotationDirection
import ai.laiq.tankinspection.presentation.StartReference
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ShellLinePlannerTest {
    @Test
    fun recommendedLineCount_usesMaxSpacingRule() {
        assertEquals(7, ShellLinePlanner.recommendedLineCount(20.0))
        assertEquals(4, ShellLinePlanner.recommendedLineCount(10.0))
        assertEquals(4, ShellLinePlanner.recommendedLineCount(5.0))
    }

    @Test
    fun createPlan_numbersLanesFromNorthAndRespectsRotation() {
        val plan = ShellLinePlanner.createPlan(
            diameterM = 20.0,
            explicitLineCount = 4,
            referenceMode = ReferenceMode.TRUE_NORTH,
            startReference = StartReference.E,
            startReferenceLabel = "True North",
            rotationDirection = RotationDirection.COUNTERCLOCKWISE,
            captureStartLaneId = "line-03",
        )

        assertEquals(4, plan.lineCount)
        assertEquals("True North", plan.startReference)
        assertEquals("line-03", plan.captureStartLaneId)
        assertEquals(RotationDirection.COUNTERCLOCKWISE, plan.rotationDirection)
        assertEquals(listOf("Lane 1", "Lane 2", "Lane 3", "Lane 4"), plan.lines.map { it.label })
        assertEquals(listOf(0.0, 270.0, 180.0, 90.0), plan.lines.map { it.azimuthDeg })
    }

    @Test
    fun createPlan_generatesLineIdsForAllLines() {
        val plan = ShellLinePlanner.createPlan(
            diameterM = 26.5,
            explicitLineCount = null,
            referenceMode = ReferenceMode.TRUE_NORTH,
            startReference = StartReference.N,
            startReferenceLabel = "True North",
            rotationDirection = RotationDirection.CLOCKWISE,
        )

        assertTrue(plan.lines.isNotEmpty())
        assertEquals(plan.lineCount, plan.lines.size)
        assertEquals("line-01", plan.lines.first().lineId)
    }

    @Test
    fun createPlan_keepsNorthAsLaneOneAnchorInLocalMode() {
        val plan = ShellLinePlanner.createPlan(
            diameterM = 20.0,
            explicitLineCount = 4,
            referenceMode = ReferenceMode.TANK_NORTH,
            startReference = StartReference.W,
            startReferenceLabel = "Tank North / Site Marker: Stairway centerline",
            rotationDirection = RotationDirection.CLOCKWISE,
        )

        assertEquals("Tank North / Site Marker: Stairway centerline", plan.startReference)
        assertEquals(listOf("Lane 1", "Lane 2", "Lane 3", "Lane 4"), plan.lines.map { it.label })
        assertEquals(listOf(0.0, 90.0, 180.0, 270.0), plan.lines.map { it.azimuthDeg })
    }
}

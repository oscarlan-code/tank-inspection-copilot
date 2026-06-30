package ai.laiq.tankinspection.prototype.layoutdrawing

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

object PrototypeLayoutGeometry {
    fun generateV3BaseDraft(
        surface: PrototypeLayoutSurface,
        grid: PrototypeGridSettings = PrototypeGridSettings(),
    ): PrototypeLayoutDraft {
        val plates = when (surface) {
            PrototypeLayoutSurface.SHELL -> generatedShellPlates(surface)
            PrototypeLayoutSurface.EXTERNAL_ROOF,
            PrototypeLayoutSurface.INTERNAL_ROOF,
            PrototypeLayoutSurface.FLOOR -> generatedCircularPlates(surface, sectorCount = 8)
        }
        return PrototypeLayoutDraft(
            surface = surface,
            sourceType = PrototypeLayoutSourceType.V3_BASE,
            grid = grid,
            plates = plates.withAdjacency(),
            elements = generatedElements(surface, plates),
        ).withValidation()
    }

    fun draftFromSketch(input: PrototypeRecognitionInput): PrototypeLayoutDraft {
        val refinedStrokes = input.strokes
        val plates = when (input.surface) {
            PrototypeLayoutSurface.SHELL -> platesFromShellSketch(input.surface, refinedStrokes)
            PrototypeLayoutSurface.EXTERNAL_ROOF,
            PrototypeLayoutSurface.INTERNAL_ROOF,
            PrototypeLayoutSurface.FLOOR -> generatedRoofPlatesFromBoundaryLines(input.surface, refinedStrokes)
        }
        return PrototypeLayoutDraft(
            surface = input.surface,
            sourceType = input.sourceType,
            sourceImageUri = input.sourceImageUri,
            grid = input.grid,
            plates = plates.withAdjacency(),
            elements = elementsFromSketch(input, plates),
        ).withValidation()
    }

    fun splitPlate(
        draft: PrototypeLayoutDraft,
        plateId: String,
        vertical: Boolean,
    ): PrototypeLayoutDraft {
        val plate = draft.plates.firstOrNull { it.id == plateId } ?: return draft
        val bounds = plate.bounds() ?: return draft
        val nextIndex = draft.plates.size + 1
        val replacement = if (vertical) {
            val midX = (bounds.left + bounds.right) / 2f
            listOf(
                plate.copy(
                    id = "${plate.id}A",
                    displayLabel = "${plate.displayLabel}A",
                    polygon = rectanglePolygon(bounds.left, bounds.top, midX, bounds.bottom),
                    center = PrototypeNormalizedPoint((bounds.left + midX) / 2f, (bounds.top + bounds.bottom) / 2f),
                    sourceConfidence = 0.95f,
                ),
                plate.copy(
                    id = "${plate.id}B",
                    displayLabel = "${plate.displayLabel}B",
                    columnNumber = plate.columnNumber?.plus(1) ?: nextIndex,
                    polygon = rectanglePolygon(midX, bounds.top, bounds.right, bounds.bottom),
                    center = PrototypeNormalizedPoint((midX + bounds.right) / 2f, (bounds.top + bounds.bottom) / 2f),
                    sourceConfidence = 0.95f,
                ),
            )
        } else {
            val midY = (bounds.top + bounds.bottom) / 2f
            listOf(
                plate.copy(
                    id = "${plate.id}U",
                    displayLabel = "${plate.displayLabel}U",
                    polygon = rectanglePolygon(bounds.left, bounds.top, bounds.right, midY),
                    center = PrototypeNormalizedPoint((bounds.left + bounds.right) / 2f, (bounds.top + midY) / 2f),
                    sourceConfidence = 0.95f,
                ),
                plate.copy(
                    id = "${plate.id}L",
                    displayLabel = "${plate.displayLabel}L",
                    rowNumber = plate.rowNumber?.plus(1) ?: nextIndex,
                    courseNumber = plate.courseNumber?.plus(1) ?: plate.courseNumber,
                    polygon = rectanglePolygon(bounds.left, midY, bounds.right, bounds.bottom),
                    center = PrototypeNormalizedPoint((bounds.left + bounds.right) / 2f, (midY + bounds.bottom) / 2f),
                    sourceConfidence = 0.95f,
                ),
            )
        }
        val nextPlates = draft.plates.flatMap { candidate ->
            if (candidate.id == plateId) replacement else listOf(candidate)
        }.withAdjacency()
        return draft.copy(plates = nextPlates).withValidation()
    }

    fun mergePlateWithFirstAdjacent(
        draft: PrototypeLayoutDraft,
        plateId: String,
    ): PrototypeLayoutDraft {
        val plate = draft.plates.firstOrNull { it.id == plateId } ?: return draft
        val adjacent = plate.adjacentPlateIds.firstNotNullOfOrNull { adjacentId ->
            draft.plates.firstOrNull { it.id == adjacentId }
        } ?: return draft
        val bounds = listOfNotNull(plate.bounds(), adjacent.bounds()).merged()
        val mergedPlate = plate.copy(
            id = "${plate.id}_${adjacent.id}",
            displayLabel = "${plate.displayLabel}+${adjacent.displayLabel}",
            polygon = rectanglePolygon(bounds.left, bounds.top, bounds.right, bounds.bottom),
            center = PrototypeNormalizedPoint(
                (bounds.left + bounds.right) / 2f,
                (bounds.top + bounds.bottom) / 2f,
            ),
            sourceConfidence = 0.93f,
        )
        val nextPlates = (draft.plates.filterNot { it.id == plate.id || it.id == adjacent.id } + mergedPlate)
            .withAdjacency()
        val nextElements = draft.elements.map { element ->
            if (element.attachedPlateId == plate.id || element.attachedPlateId == adjacent.id) {
                element.copy(attachedPlateId = mergedPlate.id)
            } else {
                element
            }
        }
        return draft.copy(plates = nextPlates, elements = nextElements).withValidation()
    }

    fun nudgePlateBoundary(
        draft: PrototypeLayoutDraft,
        plateId: String,
        dx: Float,
        dy: Float,
    ): PrototypeLayoutDraft {
        val nextPlates = draft.plates.map { plate ->
            if (plate.id != plateId) {
                plate
            } else {
                val nextPolygon = plate.polygon.map { point ->
                    PrototypeNormalizedPoint(point.x + dx, point.y + dy).clamped()
                }
                plate.copy(polygon = nextPolygon, center = nextPolygon.center())
            }
        }.withAdjacency()
        return draft.copy(plates = nextPlates).withValidation()
    }

    fun updatePlateIdentity(
        draft: PrototypeLayoutDraft,
        plateId: String,
        newId: String,
        newLabel: String,
    ): PrototypeLayoutDraft {
        if (newId.isBlank()) return draft
        val nextPlates = draft.plates.map { plate ->
            if (plate.id == plateId) {
                plate.copy(id = newId.trim(), displayLabel = newLabel.ifBlank { newId.trim() })
            } else {
                plate.copy(
                    adjacentPlateIds = plate.adjacentPlateIds.map { adjacentId ->
                        if (adjacentId == plateId) newId.trim() else adjacentId
                    },
                )
            }
        }.withAdjacency()
        val nextElements = draft.elements.map { element ->
            if (element.attachedPlateId == plateId) {
                element.copy(attachedPlateId = newId.trim())
            } else {
                element
            }
        }
        return draft.copy(plates = nextPlates, elements = nextElements).withValidation()
    }

    fun updateElement(
        draft: PrototypeLayoutDraft,
        elementId: String,
        type: PrototypeElementType,
        name: String,
        attachedPlateId: String?,
    ): PrototypeLayoutDraft {
        val nextElements = draft.elements.map { element ->
            if (element.id == elementId) {
                element.copy(
                    type = type,
                    name = name.ifBlank { element.name },
                    markerShape = if (type == PrototypeElementType.PATCH) {
                        PrototypeMarkerShape.SQUARE
                    } else {
                        PrototypeMarkerShape.CIRCLE
                    },
                    attachedPlateId = attachedPlateId?.takeIf { it.isNotBlank() },
                )
            } else {
                element
            }
        }
        return draft.copy(elements = nextElements).withValidation()
    }

    private fun generatedShellPlates(surface: PrototypeLayoutSurface): List<PrototypeLayoutPlate> {
        val courses = 3
        val columns = 6
        return (0 until courses).flatMap { course ->
            (0 until columns).map { column ->
                val left = column / columns.toFloat()
                val right = (column + 1) / columns.toFloat()
                val top = course / courses.toFloat()
                val bottom = (course + 1) / courses.toFloat()
                PrototypeLayoutPlate(
                    id = "C${course + 1}-P${column + 1}",
                    displayLabel = "C${course + 1} P${column + 1}",
                    surface = surface,
                    rowNumber = course + 1,
                    courseNumber = course + 1,
                    columnNumber = column + 1,
                    polygon = rectanglePolygon(left, top, right, bottom),
                    center = PrototypeNormalizedPoint((left + right) / 2f, (top + bottom) / 2f),
                    sourceConfidence = 0.96f,
                )
            }
        }
    }

    private fun generatedCircularPlates(
        surface: PrototypeLayoutSurface,
        sectorCount: Int,
    ): List<PrototypeLayoutPlate> {
        val prefix = when (surface) {
            PrototypeLayoutSurface.EXTERNAL_ROOF -> "ER"
            PrototypeLayoutSurface.INTERNAL_ROOF -> "IR"
            PrototypeLayoutSurface.FLOOR -> "F"
            PrototypeLayoutSurface.SHELL -> "S"
        }
        val centerRadius = 0.15f
        val outerRadius = 0.48f
        val centerPlate = PrototypeLayoutPlate(
            id = "$prefix-C",
            displayLabel = "$prefix Center",
            surface = surface,
            rowNumber = 0,
            polygon = (0 until sectorCount).map { index ->
                pointOnCircle(centerRadius, -90f + index * 360f / sectorCount)
            },
            center = PrototypeNormalizedPoint(0.5f, 0.5f),
            sourceConfidence = 0.94f,
        )
        val outerPlates = (0 until sectorCount).map { index ->
            val startAngle = -90f + index * 360f / sectorCount
            val endAngle = -90f + (index + 1) * 360f / sectorCount
            PrototypeLayoutPlate(
                id = "$prefix-${index + 1}",
                displayLabel = "$prefix ${index + 1}",
                surface = surface,
                rowNumber = 1,
                columnNumber = index + 1,
                polygon = listOf(
                    pointOnCircle(centerRadius, startAngle),
                    pointOnCircle(centerRadius, endAngle),
                    pointOnCircle(outerRadius, endAngle),
                    pointOnCircle(outerRadius, startAngle),
                ),
                center = pointOnCircle((centerRadius + outerRadius) / 2f, (startAngle + endAngle) / 2f),
                sourceConfidence = 0.92f,
            )
        }
        return listOf(centerPlate) + outerPlates
    }

    private fun generatedRoofPlatesFromBoundaryLines(
        surface: PrototypeLayoutSurface,
        strokes: List<PrototypeSketchStroke>,
    ): List<PrototypeLayoutPlate> {
        val lineSegments = strokes
            .filter { stroke -> stroke.kind == PrototypeSketchStrokeKind.BOUNDARY && stroke.points.size >= 2 }
            .mapNotNull { stroke -> stroke.toRoofSegment() }

        val faces = RoofPlateGraph(lineSegments).detectPlateFaces()
        val polygons = faces.ifEmpty {
            listOf((0 until CIRCLE_SAMPLE_COUNT).map { index ->
                pointOnCircle(ROOF_RADIUS, index * 360f / CIRCLE_SAMPLE_COUNT)
            })
        }

        return polygons
            .sortedWith(compareBy<List<PrototypeNormalizedPoint>> { polygon -> polygon.center().angleDeg() }
                .thenByDescending { polygon -> abs(polygonArea(polygon)) })
            .mapIndexed { index, polygon ->
                val center = polygon.centroid()
            PrototypeLayoutPlate(
                id = "ER-${index + 1}",
                displayLabel = "ER ${index + 1}",
                surface = surface,
                rowNumber = 1,
                columnNumber = index + 1,
                polygon = polygon,
                center = center,
                sourceConfidence = if (lineSegments.isEmpty()) 0.66f else 0.88f,
            )
        }
    }

    private fun PrototypeNormalizedPoint.angleDeg(): Float =
        normalizeAngle((atan2(y - 0.5f, x - 0.5f) * 180f / PI.toFloat()))

    private fun PrototypeNormalizedPoint.distanceFromCenter(): Float =
        hypot(x - 0.5f, y - 0.5f)

    private fun normalizeAngle(angle: Float): Float {
        var normalized = angle % 360f
        if (normalized < 0f) normalized += 360f
        return normalized
    }

    private fun positiveSweep(startAngle: Float, endAngle: Float): Float {
        val sweep = normalizeAngle(endAngle - startAngle)
        return if (sweep == 0f) 360f else sweep
    }

    private fun PrototypeSketchStroke.toRoofSegment(): RoofSegment? {
        val start = points.firstOrNull() ?: return null
        val end = points.lastOrNull() ?: return null
        return RoofSegment(start, end).clippedToCircle()
    }

    private class RoofPlateGraph(
        private val drawnSegments: List<RoofSegment>,
    ) {
        private val nodes = mutableListOf<PrototypeNormalizedPoint>()
        private val edges = mutableSetOf<RoofEdge>()

        fun detectPlateFaces(): List<List<PrototypeNormalizedPoint>> {
            addSplitDrawnSegments()
            addBoundaryEdges()
            val usableEdges = prunedEdges()
            if (usableEdges.isEmpty()) return emptyList()

            val adjacency = mutableMapOf<Int, MutableList<Int>>()
            usableEdges.forEach { edge ->
                adjacency.getOrPut(edge.a) { mutableListOf() } += edge.b
                adjacency.getOrPut(edge.b) { mutableListOf() } += edge.a
            }
            val orderedAdjacency = adjacency.mapValues { (nodeId, neighbors) ->
                neighbors.distinct().sortedBy { neighborId -> angleBetween(nodes[nodeId], nodes[neighborId]) }
            }
            val visited = mutableSetOf<RoofDirectedEdge>()
            val faces = mutableListOf<List<PrototypeNormalizedPoint>>()

            for (edge in usableEdges) {
                for ((startA, startB) in listOf(edge.a to edge.b, edge.b to edge.a)) {
                    val start = RoofDirectedEdge(startA, startB)
                    if (start in visited) continue
                    val faceNodeIds = mutableListOf<Int>()
                    var current = start
                    var closed = false
                    var guard = 0
                    while (guard < usableEdges.size * 4) {
                        guard += 1
                        if (current in visited) break
                        visited += current
                        faceNodeIds += current.a
                        val neighbors = orderedAdjacency[current.b].orEmpty()
                        val reverseIndex = neighbors.indexOf(current.a)
                        if (reverseIndex == -1 || neighbors.isEmpty()) break
                        val nextNeighbor = neighbors[(reverseIndex - 1 + neighbors.size) % neighbors.size]
                        current = RoofDirectedEdge(current.b, nextNeighbor)
                        if (current == start) {
                            closed = true
                            break
                        }
                    }
                    if (!closed || faceNodeIds.size < 3) continue
                    val polygon = faceNodeIds.map { nodeId -> nodes[nodeId] }.simplifiedPolygon()
                    val area = polygonArea(polygon)
                    val center = polygon.centroid()
                    if (
                        polygon.size >= 3 &&
                        area > FACE_AREA_EPSILON &&
                        center.distanceFromCenter() <= ROOF_RADIUS + NODE_MERGE_TOLERANCE &&
                        faces.none { existing -> existing.sameFaceAs(polygon) }
                    ) {
                        faces += polygon
                    }
                }
            }
            return faces.sortedByDescending { face -> polygonArea(face) }
        }

        private fun addSplitDrawnSegments() {
            if (drawnSegments.isEmpty()) return
            val splitParameters = drawnSegments.map { mutableListOf(0f, 1f) }
            for (i in drawnSegments.indices) {
                for (j in i + 1 until drawnSegments.size) {
                    val intersection = drawnSegments[i].intersectionWith(drawnSegments[j]) ?: continue
                    splitParameters[i] += intersection.t1
                    splitParameters[j] += intersection.t2
                }
            }

            drawnSegments.forEachIndexed { index, segment ->
                val parameters = splitParameters[index]
                    .map { parameter -> parameter.coerceIn(0f, 1f) }
                    .sorted()
                    .fold(emptyList<Float>()) { acc, parameter ->
                        if (acc.lastOrNull()?.let { last -> abs(last - parameter) < PARAMETER_MERGE_TOLERANCE } == true) {
                            acc
                        } else {
                            acc + parameter
                        }
                    }
                parameters.zipWithNext().forEach { (startT, endT) ->
                    if (endT - startT < PARAMETER_MERGE_TOLERANCE) return@forEach
                    addEdge(
                        a = addNode(segment.pointAt(startT)),
                        b = addNode(segment.pointAt(endT)),
                    )
                }
            }
        }

        private fun addBoundaryEdges() {
            repeat(CIRCLE_SAMPLE_COUNT) { index ->
                addNode(pointOnCircle(ROOF_RADIUS, index * 360f / CIRCLE_SAMPLE_COUNT))
            }
            val boundaryNodeIds = nodes.indices
                .filter { nodeId -> abs(nodes[nodeId].distanceFromCenter() - ROOF_RADIUS) <= BOUNDARY_NODE_TOLERANCE }
                .distinct()
                .sortedBy { nodeId -> nodes[nodeId].angleDeg() }
            if (boundaryNodeIds.size < 3) return
            boundaryNodeIds.forEachIndexed { index, nodeId ->
                val nextNodeId = boundaryNodeIds[(index + 1) % boundaryNodeIds.size]
                addEdge(nodeId, nextNodeId)
            }
        }

        private fun prunedEdges(): Set<RoofEdge> {
            val remaining = edges.toMutableSet()
            var changed: Boolean
            do {
                changed = false
                val degree = mutableMapOf<Int, Int>()
                remaining.forEach { edge ->
                    degree[edge.a] = (degree[edge.a] ?: 0) + 1
                    degree[edge.b] = (degree[edge.b] ?: 0) + 1
                }
                val danglingNodes = degree.filterValues { count -> count <= 1 }.keys
                if (danglingNodes.isNotEmpty()) {
                    changed = remaining.removeAll { edge -> edge.a in danglingNodes || edge.b in danglingNodes }
                }
            } while (changed)
            return remaining
        }

        private fun addNode(point: PrototypeNormalizedPoint): Int {
            val existingIndex = nodes.indexOfFirst { existing -> existing.distanceTo(point) <= NODE_MERGE_TOLERANCE }
            if (existingIndex != -1) return existingIndex
            nodes += point.clamped()
            return nodes.lastIndex
        }

        private fun addEdge(a: Int, b: Int) {
            if (a == b) return
            if (nodes[a].distanceTo(nodes[b]) <= NODE_MERGE_TOLERANCE) return
            edges += RoofEdge(min(a, b), max(a, b))
        }
    }

    private data class RoofSegment(
        val start: PrototypeNormalizedPoint,
        val end: PrototypeNormalizedPoint,
    ) {
        fun clippedToCircle(): RoofSegment? {
            val dx = end.x - start.x
            val dy = end.y - start.y
            val a = dx * dx + dy * dy
            if (a <= 0.000001f) return null
            val startX = start.x - 0.5f
            val startY = start.y - 0.5f
            val b = 2f * (startX * dx + startY * dy)
            val c = startX * startX + startY * startY - ROOF_RADIUS * ROOF_RADIUS
            val ts = mutableListOf<Float>()
            if (start.distanceFromCenter() <= ROOF_RADIUS + NODE_MERGE_TOLERANCE) ts += 0f
            if (end.distanceFromCenter() <= ROOF_RADIUS + NODE_MERGE_TOLERANCE) ts += 1f
            val discriminant = b * b - 4f * a * c
            if (discriminant >= 0f) {
                val sqrtDiscriminant = kotlin.math.sqrt(discriminant)
                ts += (-b - sqrtDiscriminant) / (2f * a)
                ts += (-b + sqrtDiscriminant) / (2f * a)
            }
            val parameters = ts
                .filter { parameter -> parameter in -PARAMETER_MERGE_TOLERANCE..(1f + PARAMETER_MERGE_TOLERANCE) }
                .map { parameter -> parameter.coerceIn(0f, 1f) }
                .sorted()
                .fold(emptyList<Float>()) { acc, parameter ->
                    if (acc.lastOrNull()?.let { last -> abs(last - parameter) < PARAMETER_MERGE_TOLERANCE } == true) {
                        acc
                    } else {
                        acc + parameter
                    }
                }
            if (parameters.size < 2) return null
            val clippedStart = pointAt(parameters.first())
            val clippedEnd = pointAt(parameters.last())
            return if (clippedStart.distanceTo(clippedEnd) > NODE_MERGE_TOLERANCE) {
                RoofSegment(clippedStart, clippedEnd)
            } else {
                null
            }
        }

        fun pointAt(t: Float): PrototypeNormalizedPoint =
            PrototypeNormalizedPoint(
                x = start.x + (end.x - start.x) * t,
                y = start.y + (end.y - start.y) * t,
            ).clamped()

        fun intersectionWith(other: RoofSegment): RoofIntersection? {
            val rX = end.x - start.x
            val rY = end.y - start.y
            val sX = other.end.x - other.start.x
            val sY = other.end.y - other.start.y
            val denominator = cross(rX, rY, sX, sY)
            if (abs(denominator) < INTERSECTION_EPSILON) return null
            val qMinusPX = other.start.x - start.x
            val qMinusPY = other.start.y - start.y
            val t = cross(qMinusPX, qMinusPY, sX, sY) / denominator
            val u = cross(qMinusPX, qMinusPY, rX, rY) / denominator
            return if (
                t in -PARAMETER_MERGE_TOLERANCE..(1f + PARAMETER_MERGE_TOLERANCE) &&
                u in -PARAMETER_MERGE_TOLERANCE..(1f + PARAMETER_MERGE_TOLERANCE)
            ) {
                RoofIntersection(t.coerceIn(0f, 1f), u.coerceIn(0f, 1f))
            } else {
                null
            }
        }
    }

    private data class RoofIntersection(
        val t1: Float,
        val t2: Float,
    )

    private data class RoofEdge(
        val a: Int,
        val b: Int,
    )

    private data class RoofDirectedEdge(
        val a: Int,
        val b: Int,
    )

    private data class PrototypeElementMarker(
        val center: PrototypeNormalizedPoint,
        val radius: Float?,
    )

    private fun platesFromShellSketch(
        surface: PrototypeLayoutSurface,
        strokes: List<PrototypeSketchStroke>,
    ): List<PrototypeLayoutPlate> {
        val boundaryStrokes = strokes.filter { stroke -> stroke.kind == PrototypeSketchStrokeKind.BOUNDARY }
        val xEdges = edgeValues(
            values = boundaryStrokes.mapNotNull { it.verticalLineX() },
            fallbackSegments = 4,
        )
        val yEdges = edgeValues(
            values = boundaryStrokes.mapNotNull { it.horizontalLineY() },
            fallbackSegments = 2,
        )
        return (0 until yEdges.lastIndex).flatMap { row ->
            (0 until xEdges.lastIndex).map { column ->
                val left = xEdges[column]
                val right = xEdges[column + 1]
                val top = yEdges[row]
                val bottom = yEdges[row + 1]
                PrototypeLayoutPlate(
                    id = "SK-C${row + 1}-P${column + 1}",
                    displayLabel = "SK C${row + 1} P${column + 1}",
                    surface = surface,
                    rowNumber = row + 1,
                    courseNumber = row + 1,
                    columnNumber = column + 1,
                    polygon = rectanglePolygon(left, top, right, bottom),
                    center = PrototypeNormalizedPoint((left + right) / 2f, (top + bottom) / 2f),
                    sourceConfidence = if (boundaryStrokes.isEmpty()) 0.62f else 0.78f,
                )
            }
        }
    }

    private fun elementsFromSketch(
        input: PrototypeRecognitionInput,
        plates: List<PrototypeLayoutPlate>,
    ): List<PrototypeLayoutElement> {
        val markerInputs = input.strokes
            .filter { stroke -> stroke.kind == PrototypeSketchStrokeKind.ELEMENT }
            .mapNotNull { stroke -> stroke.toElementMarker() }
        val importFallback = if (
            markerInputs.isEmpty() &&
            input.sourceType == PrototypeLayoutSourceType.IMAGE_IMPORT
        ) {
            listOf(
                PrototypeElementMarker(PrototypeNormalizedPoint(0.68f, 0.42f), null),
                PrototypeElementMarker(PrototypeNormalizedPoint(0.28f, 0.68f), null),
            )
        } else {
            emptyList()
        }
        return (markerInputs + importFallback).mapIndexed { index, marker ->
            val point = marker.center
            val label = input.labels.nearestLabelText(point) ?: when (index) {
                0 -> "MH-1"
                1 -> "N-1"
                else -> "E-${index + 1}"
            }
            val type = elementTypeForLabel(label, index)
            PrototypeLayoutElement(
                id = "EL-${index + 1}",
                type = type,
                name = label,
                markerShape = if (type == PrototypeElementType.PATCH) {
                    PrototypeMarkerShape.SQUARE
                } else {
                    PrototypeMarkerShape.CIRCLE
                },
                position = point,
                attachedPlateId = plates.minByOrNull { plate -> plate.center.distanceTo(point) }?.id,
                sizeLabel = marker.radius?.let { radius -> "r=${"%.2f".format(radius)}" }
                    ?: if (type == PrototypeElementType.NOZZLE) "6 in" else null,
                sourceConfidence = if (input.sourceType == PrototypeLayoutSourceType.IMAGE_IMPORT) 0.68f else 0.82f,
            )
        }
    }

    private fun PrototypeSketchStroke.toElementMarker(): PrototypeElementMarker? {
        val center = points.firstOrNull()?.clamped() ?: return null
        val radius = points.getOrNull(1)?.let { handle -> center.distanceTo(handle).coerceIn(0.02f, 0.25f) }
        return PrototypeElementMarker(center, radius)
    }

    private fun generatedElements(
        surface: PrototypeLayoutSurface,
        plates: List<PrototypeLayoutPlate>,
    ): List<PrototypeLayoutElement> {
        val points = when (surface) {
            PrototypeLayoutSurface.SHELL -> listOf(
                "MH-1" to PrototypeNormalizedPoint(0.18f, 0.62f),
                "N-1" to PrototypeNormalizedPoint(0.72f, 0.38f),
            )
            else -> listOf(
                "MH-1" to PrototypeNormalizedPoint(0.5f, 0.25f),
                "N-1" to PrototypeNormalizedPoint(0.72f, 0.55f),
            )
        }
        return points.mapIndexed { index, (label, point) ->
            val type = elementTypeForLabel(label, index)
            PrototypeLayoutElement(
                id = "EL-${index + 1}",
                type = type,
                name = label,
                markerShape = PrototypeMarkerShape.CIRCLE,
                position = point,
                attachedPlateId = plates.minByOrNull { plate -> plate.center.distanceTo(point) }?.id,
                sizeLabel = if (type == PrototypeElementType.NOZZLE) "6 in" else null,
                sourceConfidence = 0.86f,
            )
        }
    }

    private fun elementTypeForLabel(label: String, index: Int): PrototypeElementType =
        when {
            label.contains("mh", ignoreCase = true) || label.contains("manhole", ignoreCase = true) ->
                PrototypeElementType.MANHOLE
            label.contains("patch", ignoreCase = true) -> PrototypeElementType.PATCH
            label.contains("stair", ignoreCase = true) -> PrototypeElementType.STAIR
            label.contains("drain", ignoreCase = true) -> PrototypeElementType.DRAIN
            label.startsWith("n", ignoreCase = true) -> PrototypeElementType.NOZZLE
            else -> if (index == 0) PrototypeElementType.MANHOLE else PrototypeElementType.UNKNOWN
        }

    private fun PrototypeSketchStroke.snappedToGrid(grid: PrototypeGridSettings): PrototypeSketchStroke {
        if (!grid.snapEnabled || grid.gridSpacing <= 0f) return this
        return copy(
            points = points.map { point ->
                PrototypeNormalizedPoint(
                    x = snapValue(point.x, grid.gridSpacing),
                    y = snapValue(point.y, grid.gridSpacing),
                ).clamped()
            },
        )
    }

    private fun snapValue(value: Float, spacing: Float): Float =
        (value / spacing).toInt().let { floorIndex ->
            val lower = floorIndex * spacing
            val upper = (floorIndex + 1) * spacing
            if (abs(value - lower) <= abs(upper - value)) lower else upper
        }

    private fun edgeValues(values: List<Float>, fallbackSegments: Int): List<Float> {
        val cleaned = values
            .map { it.coerceIn(0.04f, 0.96f) }
            .sorted()
            .fold(emptyList<Float>()) { acc, value ->
                if (acc.lastOrNull()?.let { last -> abs(last - value) < 0.035f } == true) {
                    acc
                } else {
                    acc + value
                }
            }
        return if (cleaned.isEmpty()) {
            (0..fallbackSegments).map { index -> index / fallbackSegments.toFloat() }
        } else {
            (listOf(0f) + cleaned + listOf(1f)).distinct().sorted()
        }
    }

    private fun PrototypeSketchStroke.verticalLineX(): Float? {
        if (points.size < 2) return null
        val bounds = points.bounds()
        return if (bounds.height > bounds.width * 1.4f && bounds.height > 0.12f) {
            points.map { point -> point.x }.average().toFloat()
        } else {
            null
        }
    }

    private fun PrototypeSketchStroke.horizontalLineY(): Float? {
        if (points.size < 2) return null
        val bounds = points.bounds()
        return if (bounds.width > bounds.height * 1.4f && bounds.width > 0.12f) {
            points.map { point -> point.y }.average().toFloat()
        } else {
            null
        }
    }

    private fun List<PrototypeLayoutPlate>.withAdjacency(): List<PrototypeLayoutPlate> =
        map { plate ->
            plate.copy(
                adjacentPlateIds = filter { candidate ->
                    candidate.id != plate.id && plate.sharesEdgeWith(candidate)
                }.map { candidate -> candidate.id },
            )
        }

    private fun PrototypeLayoutPlate.sharesEdgeWith(other: PrototypeLayoutPlate): Boolean {
        val a = bounds() ?: return false
        val b = other.bounds() ?: return false
        val verticalTouch = abs(a.right - b.left) < EDGE_TOLERANCE || abs(b.right - a.left) < EDGE_TOLERANCE
        val horizontalOverlap = min(a.bottom, b.bottom) - max(a.top, b.top) > EDGE_TOLERANCE
        val horizontalTouch = abs(a.bottom - b.top) < EDGE_TOLERANCE || abs(b.bottom - a.top) < EDGE_TOLERANCE
        val verticalOverlap = min(a.right, b.right) - max(a.left, b.left) > EDGE_TOLERANCE
        if (verticalTouch && horizontalOverlap) return true
        if (horizontalTouch && verticalOverlap) return true
        if (rowNumber == 0 && other.rowNumber == 1) return true
        if (rowNumber == 1 && other.rowNumber == 0) return true
        return false
    }

    private fun List<PrototypeSketchLabel>.nearestLabelText(point: PrototypeNormalizedPoint): String? =
        minByOrNull { label -> label.position.distanceTo(point) }
            ?.takeIf { label -> label.position.distanceTo(point) < 0.18f }
            ?.text

    private fun PrototypeNormalizedPoint.distanceTo(other: PrototypeNormalizedPoint): Float =
        hypot(x - other.x, y - other.y)

    private fun cross(ax: Float, ay: Float, bx: Float, by: Float): Float =
        ax * by - ay * bx

    private fun angleBetween(
        start: PrototypeNormalizedPoint,
        end: PrototypeNormalizedPoint,
    ): Float =
        atan2(end.y - start.y, end.x - start.x)

    private fun polygonArea(points: List<PrototypeNormalizedPoint>): Float {
        if (points.size < 3) return 0f
        var sum = 0f
        points.forEachIndexed { index, point ->
            val next = points[(index + 1) % points.size]
            sum += point.x * next.y - next.x * point.y
        }
        return sum / 2f
    }

    private fun List<PrototypeNormalizedPoint>.centroid(): PrototypeNormalizedPoint {
        if (size < 3) return center()
        val signedArea = polygonArea(this)
        if (abs(signedArea) < FACE_AREA_EPSILON) return center()
        var centroidX = 0f
        var centroidY = 0f
        forEachIndexed { index, point ->
            val next = this[(index + 1) % size]
            val factor = point.x * next.y - next.x * point.y
            centroidX += (point.x + next.x) * factor
            centroidY += (point.y + next.y) * factor
        }
        val divisor = 6f * signedArea
        return PrototypeNormalizedPoint(
            x = centroidX / divisor,
            y = centroidY / divisor,
        ).clamped()
    }

    private fun List<PrototypeNormalizedPoint>.simplifiedPolygon(): List<PrototypeNormalizedPoint> {
        val deduped = fold(emptyList<PrototypeNormalizedPoint>()) { acc, point ->
            if (acc.lastOrNull()?.let { last -> last.distanceTo(point) <= NODE_MERGE_TOLERANCE } == true) {
                acc
            } else {
                acc + point
            }
        }.let { points ->
            if (points.size > 1 && points.first().distanceTo(points.last()) <= NODE_MERGE_TOLERANCE) {
                points.dropLast(1)
            } else {
                points
            }
        }
        if (deduped.size < 3) return deduped

        return deduped.filterIndexed { index, point ->
            val previous = deduped[(index - 1 + deduped.size) % deduped.size]
            val next = deduped[(index + 1) % deduped.size]
            val firstVectorX = point.x - previous.x
            val firstVectorY = point.y - previous.y
            val secondVectorX = next.x - point.x
            val secondVectorY = next.y - point.y
            abs(cross(firstVectorX, firstVectorY, secondVectorX, secondVectorY)) > 0.00001f ||
                point.distanceFromCenter() > ROOF_RADIUS - 0.02f
        }
    }

    private fun List<PrototypeNormalizedPoint>.sameFaceAs(other: List<PrototypeNormalizedPoint>): Boolean {
        val thisCenter = centroid()
        val otherCenter = other.centroid()
        return thisCenter.distanceTo(otherCenter) <= 0.01f &&
            abs(abs(polygonArea(this)) - abs(polygonArea(other))) <= 0.002f
    }

    private fun pointOnCircle(radius: Float, angleDeg: Float): PrototypeNormalizedPoint {
        val angle = angleDeg * PI.toFloat() / 180f
        return PrototypeNormalizedPoint(
            x = 0.5f + cos(angle) * radius,
            y = 0.5f + sin(angle) * radius,
        )
    }

    private fun List<PrototypeNormalizedPoint>.center(): PrototypeNormalizedPoint {
        if (isEmpty()) return PrototypeNormalizedPoint(0.5f, 0.5f)
        return PrototypeNormalizedPoint(
            x = map { point -> point.x }.average().toFloat(),
            y = map { point -> point.y }.average().toFloat(),
        ).clamped()
    }

    private fun List<PrototypeNormalizedPoint>.bounds(): PrototypeBounds =
        PrototypeBounds(
            left = minOf { point -> point.x },
            top = minOf { point -> point.y },
            right = maxOf { point -> point.x },
            bottom = maxOf { point -> point.y },
        )

    private fun PrototypeLayoutPlate.bounds(): PrototypeBounds? =
        if (polygon.isEmpty()) null else polygon.bounds()

    private fun List<PrototypeBounds>.merged(): PrototypeBounds =
        PrototypeBounds(
            left = minOf { it.left },
            top = minOf { it.top },
            right = maxOf { it.right },
            bottom = maxOf { it.bottom },
        )

    private fun rectanglePolygon(
        left: Float,
        top: Float,
        right: Float,
        bottom: Float,
    ): List<PrototypeNormalizedPoint> =
        listOf(
            PrototypeNormalizedPoint(left, top).clamped(),
            PrototypeNormalizedPoint(right, top).clamped(),
            PrototypeNormalizedPoint(right, bottom).clamped(),
            PrototypeNormalizedPoint(left, bottom).clamped(),
        )

    private data class PrototypeBounds(
        val left: Float,
        val top: Float,
        val right: Float,
        val bottom: Float,
    ) {
        val width: Float = right - left
        val height: Float = bottom - top
    }

    private const val EDGE_TOLERANCE = 0.012f
    private const val ROOF_RADIUS = 0.5f
    private const val CIRCLE_SAMPLE_COUNT = 96
    private const val NODE_MERGE_TOLERANCE = 0.004f
    private const val PARAMETER_MERGE_TOLERANCE = 0.001f
    private const val BOUNDARY_NODE_TOLERANCE = 0.008f
    private const val INTERSECTION_EPSILON = 0.000001f
    private const val FACE_AREA_EPSILON = 0.00035f
    private const val BOUNDARY_POINT_RADIUS = 0.36f
    private const val CENTER_POINT_RADIUS = 0.12f
    private const val ANGLE_MERGE_TOLERANCE_DEG = 4f
}

fun PrototypeNormalizedPoint.angleFromCenter(): Float {
    val radians = atan2(y - 0.5f, x - 0.5f)
    val degrees = radians * 180f / PI.toFloat()
    return if (degrees < 0f) degrees + 360f else degrees
}

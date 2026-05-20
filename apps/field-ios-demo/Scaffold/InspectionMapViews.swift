import SwiftUI
import FieldIOSDemoCore

private struct ShellLaneVisual: Identifiable {
    let id: Int
    let label: String
    let azimuthDeg: Int
    let isAnchor: Bool
    let isStart: Bool
}

private struct ShellCellPosition: Hashable {
    let lane: Int
    let course: Int
}

private struct ShellFindingMarker: Identifiable {
    let id: String
    let position: ShellCellPosition
    let label: String
    let isActive: Bool
}

private struct RoofPlateVisual: Identifiable {
    let id: String
    let label: String
    let innerRatio: CGFloat
    let outerRatio: CGFloat
    let startDeg: Double
    let endDeg: Double
    let isCaptured: Bool
    let isActive: Bool
}

private struct RoofMarkerVisual: Identifiable {
    let id: String
    let plateId: String
    let label: String
    let isActive: Bool
}

struct ShellMapPreview: View {
    let courseCount: Int
    let laneCount: Int
    let highlightLabel: String
    var referenceLabel: String = ""
    var activeEntryCount: Int = 0
    var findingCount: Int = 0

    private let sideLabelWidth: CGFloat = 42
    private let cellWidth: CGFloat = 78
    private let cellHeight: CGFloat = 34

    private var totalCells: Int {
        max(courseCount, 1) * max(laneCount, 1)
    }

    private var clampedEntryCount: Int {
        min(max(activeEntryCount, 0), totalCells)
    }

    private var activeCell: ShellCellPosition? {
        guard totalCells > 0 else { return nil }
        let activeIndex = min(clampedEntryCount, totalCells - 1)
        return shellPosition(for: activeIndex, laneCount: laneCount, courseCount: courseCount)
    }

    private var savedCells: Set<ShellCellPosition> {
        Set((0..<clampedEntryCount).map { index in
            shellPosition(for: index, laneCount: laneCount, courseCount: courseCount)
        })
    }

    private var shellMarkers: [ShellFindingMarker] {
        let candidatePositions = Array(savedCells).sorted { lhs, rhs in
            if lhs.course == rhs.course {
                return lhs.lane < rhs.lane
            }
            return lhs.course > rhs.course
        }

        let resolvedCount = min(max(findingCount, 0), max(candidatePositions.count, 1))
        guard resolvedCount > 0 else { return [] }

        if candidatePositions.isEmpty, let activeCell {
            return [
                ShellFindingMarker(
                    id: "finding-fallback",
                    position: activeCell,
                    label: "F1",
                    isActive: true
                )
            ]
        }

        let stride = max(candidatePositions.count / resolvedCount, 1)
        return (0..<resolvedCount).map { markerIndex in
            let positionIndex = min(markerIndex * stride, candidatePositions.count - 1)
            let position = candidatePositions[positionIndex]
            return ShellFindingMarker(
                id: "finding-\(markerIndex + 1)",
                position: position,
                label: "F\(markerIndex + 1)",
                isActive: markerIndex == resolvedCount - 1
            )
        }
    }

    private var lanes: [ShellLaneVisual] {
        let resolvedLaneCount = max(laneCount, 1)
        let step = 360.0 / Double(resolvedLaneCount)
        let startLane = activeCell?.lane ?? 1
        return (0..<resolvedLaneCount).map { index in
            let laneNumber = index + 1
            return ShellLaneVisual(
                id: laneNumber,
                label: "L\(laneNumber)",
                azimuthDeg: Int((Double(index) * step).rounded()),
                isAnchor: laneNumber == 1,
                isStart: laneNumber == startLane
            )
        }
    }

    private var gridWidth: CGFloat {
        CGFloat(max(laneCount, 1)) * cellWidth
    }

    private var contentWidth: CGFloat {
        sideLabelWidth + gridWidth
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Shell Layout Map")
                        .font(.headline)
                        .foregroundStyle(LaiqTheme.ink)
                    Text("Inspection lanes, strakes, and degree reference stay visible during capture.")
                        .font(.footnote)
                        .foregroundStyle(LaiqTheme.mutedText)
                }
                Spacer()
                if !highlightLabel.isEmpty {
                    LaiqStatusBadge(label: highlightLabel, tone: LaiqTheme.info)
                }
            }

            if !referenceLabel.isEmpty {
                Text("Lane 1 anchor: \(referenceLabel)")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(LaiqTheme.mutedText)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 8) {
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(LaiqTheme.panel)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                                        .stroke(LaiqTheme.panelBorder, lineWidth: 1)
                                )
                            ForEach([0, 90, 180, 270], id: \.self) { degree in
                                let fraction = CGFloat(degree) / 360
                                let xPosition = sideLabelWidth + fraction * gridWidth
                                VStack(spacing: 2) {
                                    Text("\(degree)\u{00B0}")
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(LaiqTheme.mutedText)
                                    Rectangle()
                                        .fill(LaiqTheme.panelBorder)
                                        .frame(width: 1, height: 12)
                                }
                                .position(x: xPosition, y: 16)
                            }
                        }
                    }
                    .frame(width: contentWidth, height: 32)

                    HStack(spacing: 0) {
                        Color.clear.frame(width: sideLabelWidth, height: 26)
                        ForEach(lanes) { lane in
                            VStack(spacing: 2) {
                                if lane.isAnchor {
                                    Text("Ref")
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(LaiqTheme.accentOrange)
                                } else if lane.isStart {
                                    Text("Start")
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(LaiqTheme.brandTeal)
                                } else {
                                    Text(" ")
                                        .font(.caption2)
                                }
                            }
                            .frame(width: cellWidth, height: 26)
                        }
                    }

                    HStack(spacing: 0) {
                        Text("Deg")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(LaiqTheme.mutedText)
                            .frame(width: sideLabelWidth, alignment: .leading)
                        ForEach(lanes) { lane in
                            VStack(spacing: 2) {
                                Text(lane.label)
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(LaiqTheme.ink)
                                Text("\(lane.azimuthDeg)\u{00B0}")
                                    .font(.caption2)
                                    .foregroundStyle(LaiqTheme.mutedText)
                            }
                            .frame(width: cellWidth, height: 34)
                        }
                    }

                    ForEach(Array((1...max(courseCount, 1)).reversed()), id: \.self) { course in
                        HStack(spacing: 0) {
                            Text("S\(course)")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(LaiqTheme.mutedText)
                                .frame(width: sideLabelWidth, alignment: .leading)

                            ForEach(lanes) { lane in
                                let position = ShellCellPosition(lane: lane.id, course: course)
                                let isSaved = savedCells.contains(position)
                                let isActive = activeCell == position
                                let markers = shellMarkers.filter { $0.position == position }

                                ZStack(alignment: .topLeading) {
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .fill(
                                            isActive
                                                ? Color(red: 0.82, green: 0.18, blue: 0.20).opacity(0.92)
                                                : isSaved
                                                    ? LaiqTheme.brandTeal.opacity(0.14)
                                                    : Color.white
                                        )
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                                .stroke(
                                                    isActive
                                                        ? Color(red: 0.82, green: 0.18, blue: 0.20)
                                                        : isSaved
                                                            ? LaiqTheme.brandTeal.opacity(0.45)
                                                            : LaiqTheme.panelBorder,
                                                    lineWidth: isActive ? 2 : 1
                                                )
                                        )

                                    if isSaved {
                                        Text("UT")
                                            .font(.caption2.weight(.semibold))
                                            .foregroundStyle(isActive ? Color.white : LaiqTheme.brandTeal)
                                            .padding(.leading, 8)
                                            .padding(.top, 8)
                                    }

                                    ForEach(Array(markers.enumerated()), id: \.element.id) { markerIndex, marker in
                                        HStack(spacing: 4) {
                                            Circle()
                                                .fill(marker.isActive ? LaiqTheme.accentOrange : LaiqTheme.warning)
                                                .frame(width: marker.isActive ? 10 : 8, height: marker.isActive ? 10 : 8)
                                            Text(marker.label)
                                                .font(.caption2.weight(.semibold))
                                                .foregroundStyle(LaiqTheme.brandTeal)
                                        }
                                        .offset(x: 8, y: CGFloat(6 + (markerIndex * 12)))
                                    }
                                }
                                .frame(width: cellWidth - 6, height: cellHeight)
                                .padding(.horizontal, 3)
                                .padding(.vertical, 2)
                            }
                        }
                    }
                }
                .frame(width: contentWidth, alignment: .leading)
            }
            .frame(maxWidth: .infinity)
            .frame(height: min(CGFloat(max(courseCount, 1)) * 40 + 112, 360))

            HStack(spacing: 10) {
                shellLegendSwatch(color: LaiqTheme.brandTeal.opacity(0.18), border: LaiqTheme.brandTeal, text: "Captured cell")
                shellLegendSwatch(color: Color(red: 0.82, green: 0.18, blue: 0.20).opacity(0.92), border: Color(red: 0.82, green: 0.18, blue: 0.20), text: "Active cell")
                shellLegendSwatch(color: LaiqTheme.warning, border: LaiqTheme.warning, text: "Finding link")
            }

            Text("Top courses are shown above lower courses. Lane labels follow the saved 0\u{00B0} reference, and highlighted cells represent recorded or active capture points just like the Android shell crawl view.")
                .font(.footnote)
                .foregroundStyle(LaiqTheme.mutedText)
        }
    }
}

struct RoofMapPreview: View {
    let itemCount: Int
    let label: String
    var referenceLabel: String = ""
    var findingCount: Int = 0

    private var ringDefinitions: [(inner: CGFloat, outer: CGFloat, count: Int)] {
        [
            (0.16, 0.34, 6),
            (0.34, 0.58, 8),
            (0.58, 0.88, 12),
        ]
    }

    private var centerPlateCount: Int {
        itemCount >= 8 ? 3 : 1
    }

    private var plates: [RoofPlateVisual] {
        var result: [RoofPlateVisual] = []
        var sequence = 1

        if centerPlateCount == 1 {
            result.append(
                RoofPlateVisual(
                    id: "plate-center",
                    label: "C1",
                    innerRatio: 0,
                    outerRatio: 0.16,
                    startDeg: 0,
                    endDeg: 360,
                    isCaptured: itemCount >= sequence,
                    isActive: itemCount == sequence - 1
                )
            )
            sequence += 1
        } else {
            let centerStep = 360.0 / Double(centerPlateCount)
            for index in 0..<centerPlateCount {
                let startDeg = Double(index) * centerStep
                let endDeg = startDeg + centerStep
                result.append(
                    RoofPlateVisual(
                        id: "plate-center-\(index + 1)",
                        label: "C\(index + 1)",
                        innerRatio: 0.02,
                        outerRatio: 0.16,
                        startDeg: startDeg,
                        endDeg: endDeg,
                        isCaptured: itemCount >= sequence,
                        isActive: itemCount == sequence - 1
                    )
                )
                sequence += 1
            }
        }

        for ring in ringDefinitions {
            let step = 360.0 / Double(ring.count)
            for index in 0..<ring.count {
                let startDeg = Double(index) * step
                let endDeg = startDeg + step
                result.append(
                    RoofPlateVisual(
                        id: "plate-\(sequence)",
                        label: String(sequence),
                        innerRatio: ring.inner,
                        outerRatio: ring.outer,
                        startDeg: startDeg,
                        endDeg: endDeg,
                        isCaptured: itemCount >= sequence,
                        isActive: itemCount == sequence - 1
                    )
                )
                sequence += 1
            }
        }

        return result
    }

    private var roofMarkers: [RoofMarkerVisual] {
        let captured = plates.filter(\.isCaptured)
        let resolvedCount = min(max(findingCount, 0), max(captured.count, 1))
        guard resolvedCount > 0 else { return [] }

        if captured.isEmpty, let firstPlate = plates.first {
            return [RoofMarkerVisual(id: "roof-fallback", plateId: firstPlate.id, label: "F1", isActive: true)]
        }

        let stride = max(captured.count / resolvedCount, 1)
        return (0..<resolvedCount).map { index in
            let plate = captured[min(index * stride, captured.count - 1)]
            return RoofMarkerVisual(
                id: "roof-marker-\(index + 1)",
                plateId: plate.id,
                label: "F\(index + 1)",
                isActive: index == resolvedCount - 1
            )
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Roof Layout Map")
                        .font(.headline)
                        .foregroundStyle(LaiqTheme.ink)
                    Text("Plate-style roof reference with clockwise numbering from the 0\u{00B0} line.")
                        .font(.footnote)
                        .foregroundStyle(LaiqTheme.mutedText)
                }
                Spacer()
                if !label.isEmpty {
                    LaiqStatusBadge(label: label, tone: LaiqTheme.warning)
                }
            }

            if !referenceLabel.isEmpty {
                Text("0\u{00B0} reference: \(referenceLabel)")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(LaiqTheme.mutedText)
            }

            GeometryReader { geometry in
                let size = min(geometry.size.width, geometry.size.height)
                let center = CGPoint(x: geometry.size.width / 2, y: geometry.size.height / 2)
                let radius = size * 0.44

                ZStack {
                    Circle()
                        .fill(LaiqTheme.warning.opacity(0.08))
                    Circle()
                        .stroke(LaiqTheme.panelBorder, lineWidth: 1.5)

                    ForEach(plates) { plate in
                        RingSectorShape(
                            innerRatio: plate.innerRatio,
                            outerRatio: plate.outerRatio,
                            startDeg: plate.startDeg,
                            endDeg: plate.endDeg
                        )
                        .fill(
                            plate.isActive
                                ? Color(red: 0.82, green: 0.18, blue: 0.20).opacity(0.88)
                                : plate.isCaptured
                                    ? LaiqTheme.brandTeal.opacity(0.16)
                                    : Color.white
                        )
                        .overlay(
                            RingSectorShape(
                                innerRatio: plate.innerRatio,
                                outerRatio: plate.outerRatio,
                                startDeg: plate.startDeg,
                                endDeg: plate.endDeg
                            )
                            .stroke(
                                plate.isActive
                                    ? Color(red: 0.82, green: 0.18, blue: 0.20)
                                    : plate.isCaptured
                                        ? LaiqTheme.brandTeal.opacity(0.42)
                                        : LaiqTheme.panelBorder,
                                lineWidth: plate.isActive ? 2 : 1
                            )
                        )

                        let labelPoint = roofLabelPoint(
                            center: center,
                            radius: radius,
                            innerRatio: plate.innerRatio,
                            outerRatio: plate.outerRatio,
                            startDeg: plate.startDeg,
                            endDeg: plate.endDeg
                        )

                        Text(plate.label)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(plate.isActive ? Color.white : LaiqTheme.ink)
                            .position(labelPoint)
                    }

                    Path { path in
                        path.move(to: center)
                        path.addLine(to: CGPoint(x: center.x, y: center.y - radius))
                    }
                    .stroke(LaiqTheme.accentOrange, style: StrokeStyle(lineWidth: 2, dash: [6, 4]))

                    Text("0\u{00B0}")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(LaiqTheme.accentOrange)
                        .position(x: center.x, y: center.y - radius - 18)

                    Text("90\u{00B0}")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(LaiqTheme.mutedText)
                        .position(x: center.x + radius + 18, y: center.y)

                    Text("180\u{00B0}")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(LaiqTheme.mutedText)
                        .position(x: center.x, y: center.y + radius + 18)

                    Text("270\u{00B0}")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(LaiqTheme.mutedText)
                        .position(x: center.x - radius - 18, y: center.y)

                    ForEach(roofMarkers) { marker in
                        if let plate = plates.first(where: { $0.id == marker.plateId }) {
                            let point = roofLabelPoint(
                                center: center,
                                radius: radius,
                                innerRatio: plate.innerRatio,
                                outerRatio: plate.outerRatio,
                                startDeg: plate.startDeg,
                                endDeg: plate.endDeg,
                                offsetRatio: 0.08
                            )
                            HStack(spacing: 4) {
                                Circle()
                                    .fill(marker.isActive ? LaiqTheme.accentOrange : LaiqTheme.warning)
                                    .frame(width: marker.isActive ? 10 : 8, height: marker.isActive ? 10 : 8)
                                Text(marker.label)
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(LaiqTheme.brandTeal)
                            }
                            .position(point)
                        }
                    }
                }
            }
            .frame(height: 290)

            HStack(spacing: 10) {
                shellLegendSwatch(color: LaiqTheme.brandTeal.opacity(0.18), border: LaiqTheme.brandTeal, text: "Captured plate")
                shellLegendSwatch(color: Color(red: 0.82, green: 0.18, blue: 0.20).opacity(0.88), border: Color(red: 0.82, green: 0.18, blue: 0.20), text: "Active plate")
                shellLegendSwatch(color: LaiqTheme.warning, border: LaiqTheme.warning, text: "Finding link")
            }

            Text("This map now behaves like an inspection plate reference instead of a generic placeholder, so roof UT, roof elements, and roof nozzle tasks all share the same visual language as Android.")
                .font(.footnote)
                .foregroundStyle(LaiqTheme.mutedText)
        }
    }
}

private struct RingSectorShape: Shape {
    let innerRatio: CGFloat
    let outerRatio: CGFloat
    let startDeg: Double
    let endDeg: Double

    func path(in rect: CGRect) -> Path {
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let radius = min(rect.width, rect.height) * 0.5
        let innerRadius = radius * innerRatio
        let outerRadius = radius * outerRatio
        let startAngle = Angle(degrees: startDeg - 90)
        let endAngle = Angle(degrees: endDeg - 90)

        var path = Path()
        path.addArc(
            center: center,
            radius: outerRadius,
            startAngle: startAngle,
            endAngle: endAngle,
            clockwise: false
        )
        path.addArc(
            center: center,
            radius: innerRadius,
            startAngle: endAngle,
            endAngle: startAngle,
            clockwise: true
        )
        path.closeSubpath()
        return path
    }
}

@ViewBuilder
private func shellLegendSwatch(color: Color, border: Color, text: String) -> some View {
    HStack(spacing: 6) {
        RoundedRectangle(cornerRadius: 6, style: .continuous)
            .fill(color)
            .overlay(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .stroke(border, lineWidth: 1)
            )
            .frame(width: 18, height: 18)
        Text(text)
            .font(.caption)
            .foregroundStyle(LaiqTheme.mutedText)
    }
}

private func shellPosition(for index: Int, laneCount: Int, courseCount: Int) -> ShellCellPosition {
    let resolvedLaneCount = max(laneCount, 1)
    let resolvedCourseCount = max(courseCount, 1)
    let courseOffset = index / resolvedLaneCount
    let course = max(resolvedCourseCount - courseOffset, 1)
    let lane = (index % resolvedLaneCount) + 1
    return ShellCellPosition(lane: lane, course: course)
}

private func roofLabelPoint(
    center: CGPoint,
    radius: CGFloat,
    innerRatio: CGFloat,
    outerRatio: CGFloat,
    startDeg: Double,
    endDeg: Double,
    offsetRatio: CGFloat = 0
) -> CGPoint {
    let angleDeg = (startDeg + endDeg) / 2
    let distance = radius * (((innerRatio + outerRatio) / 2) + offsetRatio)
    let angleRadians = Angle(degrees: angleDeg - 90).radians
    return CGPoint(
        x: center.x + CGFloat(cos(angleRadians)) * distance,
        y: center.y + CGFloat(sin(angleRadians)) * distance
    )
}

func suggestedLaneCount(from diameterText: String) -> Int {
    let diameter = Double(diameterText) ?? 0
    switch diameter {
    case ..<20:
        return 4
    case ..<40:
        return 6
    case ..<60:
        return 8
    default:
        return 10
    }
}

func shellCourseValue(from text: String) -> Int {
    max(Int(text) ?? 0, 1)
}

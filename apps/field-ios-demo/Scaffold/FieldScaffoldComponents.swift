import SwiftUI
import FieldIOSDemoCore

struct FieldScreenContainer<Content: View>: View {
    let title: String
    let content: Content

    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                content
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 28)
        }
        .background(LaiqTheme.background.ignoresSafeArea())
        .navigationTitle(title)
    }
}

struct LaiqSectionCard<Content: View>: View {
    let title: String
    let subtitle: String?
    let content: Content

    init(
        title: String,
        subtitle: String? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(LaiqTheme.ink)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.footnote)
                        .foregroundStyle(LaiqTheme.mutedText)
                }
            }
            content
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LaiqTheme.panel)
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(LaiqTheme.panelBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

struct LaiqPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(configuration.isPressed ? LaiqTheme.brandTeal.opacity(0.82) : LaiqTheme.brandTeal)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct LaiqSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(LaiqTheme.ink)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(configuration.isPressed ? LaiqTheme.panelBorder.opacity(0.45) : Color.white)
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(LaiqTheme.panelBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct LaiqStatChip: View {
    let label: String
    let value: String
    var tone: Color = LaiqTheme.brandTeal

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(LaiqTheme.mutedText)
            Text(value)
                .font(.headline.weight(.semibold))
                .foregroundStyle(LaiqTheme.ink)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tone.opacity(0.10))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(tone.opacity(0.20), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct LaiqLabeledValue: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(LaiqTheme.mutedText)
            Text(value)
                .font(.body.weight(.medium))
                .foregroundStyle(LaiqTheme.ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct LaiqStatusBadge: View {
    let label: String
    let tone: Color

    var body: some View {
        Text(label)
            .font(.caption.weight(.semibold))
            .foregroundStyle(tone)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(tone.opacity(0.12))
            .clipShape(Capsule())
    }
}

struct TaskSelectionCard: View {
    let task: InspectionTask
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(isSelected ? LaiqTheme.brandTeal : LaiqTheme.panelBorder)
                VStack(alignment: .leading, spacing: 4) {
                    Text(task.title)
                        .font(.headline)
                        .foregroundStyle(LaiqTheme.ink)
                    Text(task.subtitle)
                        .font(.footnote)
                        .foregroundStyle(LaiqTheme.mutedText)
                }
                Spacer()
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(isSelected ? LaiqTheme.brandTeal.opacity(0.08) : Color.white)
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(isSelected ? LaiqTheme.brandTeal.opacity(0.30) : LaiqTheme.panelBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct TaskBoardActionRow: View {
    let task: InspectionTask
    let snapshot: TaskSnapshot
    let action: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(task.title)
                        .font(.headline)
                        .foregroundStyle(LaiqTheme.ink)
                    Text(task.subtitle)
                        .font(.footnote)
                        .foregroundStyle(LaiqTheme.mutedText)
                }
                Spacer()
                LaiqStatusBadge(label: statusLabel(snapshot.status), tone: statusColor(snapshot.status))
            }
            HStack(spacing: 12) {
                LaiqLabeledValue(label: "Entries", value: "\(snapshot.entryCount)")
                LaiqLabeledValue(label: "Status", value: statusLabel(snapshot.status))
            }
            if let action {
                Button("Open \(task.title)", action: action)
                    .buttonStyle(LaiqPrimaryButtonStyle())
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(LaiqTheme.panelBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

func statusLabel(_ status: InspectionTaskStatus) -> String {
    switch status {
    case .notStarted: return "Not started"
    case .inProgress: return "In progress"
    case .ready: return "Ready"
    case .deferred: return "Deferred"
    }
}

func statusColor(_ status: InspectionTaskStatus) -> Color {
    switch status {
    case .notStarted: return LaiqTheme.panelBorder
    case .inProgress: return LaiqTheme.info
    case .ready: return LaiqTheme.success
    case .deferred: return LaiqTheme.warning
    }
}

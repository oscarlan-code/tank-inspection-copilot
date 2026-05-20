import SwiftUI
import FieldIOSDemoCore

struct TaskBoardView: View {
    @Bindable var viewModel: FieldDemoViewModel

    var body: some View {
        List {
            Section("Task Board") {
                ForEach(viewModel.visibleTasks, id: \.self) { task in
                    let snapshot = viewModel.snapshot(for: task)
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(task.title)
                                .font(.headline)
                            Spacer()
                            Text(statusLabel(snapshot.status))
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(statusColor(snapshot.status).opacity(0.14))
                                .clipShape(Capsule())
                        }
                        Text(task.subtitle)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Text("Entries: \(snapshot.entryCount)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 6)
                }
            }

            Section {
                Button("Open Review & Export") {
                    viewModel.openReview()
                }
                .buttonStyle(.borderedProminent)

                Button("Back") {
                    viewModel.goBack()
                }
            }
        }
        .navigationTitle("Task Board")
    }
}

private func statusLabel(_ status: InspectionTaskStatus) -> String {
    switch status {
    case .notStarted: return "Not started"
    case .inProgress: return "In progress"
    case .ready: return "Ready"
    case .deferred: return "Deferred"
    }
}

private func statusColor(_ status: InspectionTaskStatus) -> Color {
    switch status {
    case .notStarted: return LaiqTheme.panelBorder
    case .inProgress: return LaiqTheme.info
    case .ready: return LaiqTheme.success
    case .deferred: return LaiqTheme.warning
    }
}

import SwiftUI
import FieldIOSDemoCore

struct TaskBoardView: View {
    @Bindable var viewModel: FieldDemoViewModel

    var body: some View {
        FieldScreenContainer(title: "Task Board") {
            LaiqSectionCard(
                title: "Inspection Summary",
                subtitle: "Current local draft and progress across the active field tasks."
            ) {
                HStack(spacing: 10) {
                    LaiqStatChip(label: "Shell Rows", value: "\(viewModel.snapshot(for: .shellUT).entryCount)")
                    LaiqStatChip(label: "Roof Rows", value: "\(viewModel.snapshot(for: .roofUT).entryCount)")
                    LaiqStatChip(label: "Findings", value: "\(viewModel.draft.findings.findingCount)", tone: LaiqTheme.accentOrange)
                }

                HStack(spacing: 12) {
                    LaiqLabeledValue(label: "Client", value: blankFallback(viewModel.draft.setup.client))
                    LaiqLabeledValue(label: "Tank", value: blankFallback(viewModel.draft.setup.tankNumber))
                }

                HStack(spacing: 12) {
                    LaiqLabeledValue(label: "Reference", value: viewModel.draft.scope.referenceMode == .tankNorth ? "Tank North" : "True North")
                    LaiqLabeledValue(label: "Review", value: statusLabel(viewModel.snapshot(for: .reviewExport).status))
                }
            }

            LaiqSectionCard(
                title: "Active Tasks",
                subtitle: "Open each field task, capture entries, and keep review readiness in sync."
            ) {
                VStack(spacing: 10) {
                    ForEach(viewModel.visibleTasks, id: \.self) { task in
                        TaskBoardActionRow(
                            task: task,
                            snapshot: viewModel.snapshot(for: task),
                            action: { viewModel.openTask(task) }
                        )
                    }
                }
            }

            HStack(spacing: 12) {
                Button("Back") {
                    viewModel.goBack()
                }
                .buttonStyle(LaiqSecondaryButtonStyle())

                Button("Open Review & Export") {
                    viewModel.openReview()
                }
                .buttonStyle(LaiqPrimaryButtonStyle())
            }
        }
    }
}

private func blankFallback(_ value: String) -> String {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? "Not set" : trimmed
}

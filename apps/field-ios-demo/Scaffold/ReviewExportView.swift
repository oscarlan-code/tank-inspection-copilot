import SwiftUI
import FieldIOSDemoCore

struct ReviewExportView: View {
    @Bindable var viewModel: FieldDemoViewModel

    var body: some View {
        FieldScreenContainer(title: "Review & Export") {
            LaiqSectionCard(
                title: "Readiness",
                subtitle: "Use the same review gate concept as Android before handing data off for export or report generation."
            ) {
                HStack(spacing: 10) {
                    LaiqStatChip(
                        label: "Warnings",
                        value: "\(viewModel.draft.review.warningCount)",
                        tone: viewModel.draft.review.warningCount == 0 ? LaiqTheme.success : LaiqTheme.warning
                    )
                    LaiqStatChip(label: "Findings", value: "\(viewModel.draft.findings.findingCount)", tone: LaiqTheme.accentOrange)
                    LaiqStatChip(label: "Attachments", value: "\(viewModel.draft.findings.attachmentCount)", tone: LaiqTheme.info)
                }

                LaiqLabeledValue(
                    label: "Export Status",
                    value: viewModel.draft.review.readyForExport ? "Ready for export" : "Review required"
                )

                if let packageId = viewModel.draft.review.lastPreparedPackageId,
                   let preparedAt = viewModel.draft.review.lastPreparedAtIso {
                    LaiqLabeledValue(
                        label: "Last Prepared",
                        value: "\(packageId) · \(preparedAt)"
                    )
                }
            }

            LaiqSectionCard(
                title: "Task Status",
                subtitle: "Each selected task should have at least one saved capture row before the iOS handoff continues."
            ) {
                VStack(spacing: 10) {
                    ForEach(viewModel.visibleTasks, id: \.self) { task in
                        TaskBoardActionRow(
                            task: task,
                            snapshot: viewModel.snapshot(for: task),
                            action: task == .reviewExport ? nil : { viewModel.openTask(task) }
                        )
                    }
                }
            }

            LaiqSectionCard(
                title: "Warnings",
                subtitle: "These are the current blockers before the handoff package can be prepared."
            ) {
                if viewModel.reviewWarnings.isEmpty {
                    Text("No warnings. The aligned iOS demo is ready to continue into export handoff.")
                        .font(.body)
                        .foregroundStyle(LaiqTheme.ink)
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(viewModel.reviewWarnings, id: \.self) { warning in
                            Text("\u{2022} \(warning)")
                                .font(.body)
                                .foregroundStyle(LaiqTheme.warning)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }

            HStack(spacing: 12) {
                Button("Continue to Export") {
                    viewModel.openExportHandoff()
                }
                .buttonStyle(LaiqPrimaryButtonStyle())
                .disabled(!viewModel.draft.review.readyForExport)

                Button("Back") {
                    viewModel.goBack()
                }
                .buttonStyle(LaiqSecondaryButtonStyle())
            }
        }
    }
}

struct ExportHandoffView: View {
    @Bindable var viewModel: FieldDemoViewModel

    var body: some View {
        FieldScreenContainer(title: "Export Handoff") {
            LaiqSectionCard(
                title: "Handoff Package",
                subtitle: "This iOS branch keeps storage and packaging implementation lightweight, but the visible operator step matches Android."
            ) {
                LaiqLabeledValue(
                    label: "Package ID",
                    value: viewModel.draft.review.lastPreparedPackageId ?? "Not prepared"
                )
                LaiqLabeledValue(
                    label: "Prepared At",
                    value: viewModel.draft.review.lastPreparedAtIso ?? "Not prepared"
                )
                HStack(spacing: 12) {
                    LaiqLabeledValue(label: "Client", value: blankFallback(viewModel.draft.setup.client))
                    LaiqLabeledValue(label: "Tank", value: blankFallback(viewModel.draft.setup.tankNumber))
                }
                HStack(spacing: 12) {
                    LaiqLabeledValue(label: "Tasks", value: "\(viewModel.visibleTasks.count)")
                    LaiqLabeledValue(label: "Findings", value: "\(viewModel.draft.findings.findingCount)")
                }
            }

            LaiqSectionCard(
                title: "Current Direction",
                subtitle: "What this stage means for the demo."
            ) {
                Text("The operator flow has now reached the same checkpoint as Android: field capture is reviewed, a package identity is prepared, and this inspection is ready to pass into report-generation or backend-specific export plumbing.")
                    .font(.body)
                    .foregroundStyle(LaiqTheme.ink)
            }

            HStack(spacing: 12) {
                Button("Back to Review") {
                    viewModel.goBack()
                }
                .buttonStyle(LaiqSecondaryButtonStyle())

                Button("Return to Task Board") {
                    viewModel.returnToTaskBoard()
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

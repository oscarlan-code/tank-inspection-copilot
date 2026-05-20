import SwiftUI
import FieldIOSDemoCore

struct ReviewExportView: View {
    @Bindable var viewModel: FieldDemoViewModel

    var body: some View {
        List {
            Section("Readiness") {
                LabeledContent("Warnings", value: "\(viewModel.draft.review.warningCount)")
                LabeledContent("Findings", value: "\(viewModel.draft.findings.findingCount)")
                LabeledContent("Attachments", value: "\(viewModel.draft.findings.attachmentCount)")
                LabeledContent(
                    "Export Status",
                    value: viewModel.draft.review.readyForExport ? "Ready for export" : "Review required"
                )
            }

            Section("Visible Tasks") {
                ForEach(viewModel.visibleTasks, id: \.self) { task in
                    let snapshot = viewModel.snapshot(for: task)
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(task.title)
                            Text(task.subtitle)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text("\(snapshot.entryCount)")
                            .font(.caption.weight(.semibold))
                    }
                }
            }

            Section("Current Demo Limitation") {
                Text("Export, sharing, and report generation stay outside the iOS demo scaffold for now.")
                    .foregroundStyle(.secondary)
            }

            Section {
                Button("Back") {
                    viewModel.goBack()
                }
            }
        }
        .navigationTitle("Review & Export")
    }
}

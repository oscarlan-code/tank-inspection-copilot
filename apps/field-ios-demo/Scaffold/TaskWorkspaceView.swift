import SwiftUI
import FieldIOSDemoCore

struct TaskWorkspaceView: View {
    @Bindable var viewModel: FieldDemoViewModel
    let task: InspectionTask

    var snapshot: TaskSnapshot {
        viewModel.snapshot(for: task)
    }

    var body: some View {
        FieldScreenContainer(title: task.title) {
            LaiqSectionCard(
                title: task.title,
                subtitle: task.subtitle
            ) {
                HStack(spacing: 10) {
                    LaiqStatChip(label: "Status", value: statusLabel(snapshot.status), tone: statusColor(snapshot.status))
                    LaiqStatChip(label: "Entries", value: "\(snapshot.entryCount)", tone: LaiqTheme.info)
                    LaiqStatChip(label: "Linked Findings", value: "\(viewModel.linkedFindingCount(for: task))", tone: LaiqTheme.accentOrange)
                }
                Text(viewModel.instructions(for: task))
                    .font(.body)
                    .foregroundStyle(LaiqTheme.ink)
            }

            if usesShellMap(task) {
                LaiqSectionCard(
                    title: "Capture Map",
                    subtitle: "Use the shell map to orient course bands, active capture rows, and linked findings."
                ) {
                    ShellMapPreview(
                        courseCount: shellCourseValue(from: viewModel.draft.setup.shellCourseCount),
                        laneCount: suggestedLaneCount(from: viewModel.draft.setup.diameterM),
                        highlightLabel: task == .shellUT ? "Active Shell Flow" : "Shell Reference",
                        referenceLabel: shellReferenceLabel(viewModel.draft),
                        activeEntryCount: snapshot.entryCount,
                        findingCount: viewModel.linkedFindingCount(for: task)
                    )
                }
            }

            if usesRoofMap(task) {
                LaiqSectionCard(
                    title: "Capture Map",
                    subtitle: "Use the roof map to locate active plates, roof elements, and linked findings."
                ) {
                    RoofMapPreview(
                        itemCount: max(snapshot.entryCount, 1),
                        label: task == .roofElements ? "Roof Registry" : "Roof Reference",
                        referenceLabel: shellReferenceLabel(viewModel.draft),
                        findingCount: viewModel.linkedFindingCount(for: task)
                    )
                }
            }

            LaiqSectionCard(
                title: "Captured Rows",
                subtitle: "Pick the active row first, then attach findings and attachments to that row."
            ) {
                if snapshot.entries.isEmpty {
                    Text("No captured rows yet. Add a row first, then findings will stay linked to that active measurement context.")
                        .font(.body)
                        .foregroundStyle(LaiqTheme.mutedText)
                } else {
                    VStack(spacing: 10) {
                        ForEach(snapshot.entries) { entry in
                            Button {
                                viewModel.selectEntry(entry.id, for: task)
                            } label: {
                                HStack(spacing: 12) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(entry.label)
                                            .font(.headline)
                                            .foregroundStyle(LaiqTheme.ink)
                                        Text("Findings \(entry.findingCount) · Attachments \(entry.attachmentCount)")
                                            .font(.footnote)
                                            .foregroundStyle(LaiqTheme.mutedText)
                                    }
                                    Spacer()
                                    if viewModel.activeEntry(for: task)?.id == entry.id {
                                        LaiqStatusBadge(label: "Active", tone: LaiqTheme.brandTeal)
                                    }
                                }
                                .padding(14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(
                                    (viewModel.activeEntry(for: task)?.id == entry.id)
                                        ? LaiqTheme.brandTeal.opacity(0.10)
                                        : Color.white
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                                        .stroke(
                                            (viewModel.activeEntry(for: task)?.id == entry.id)
                                                ? LaiqTheme.brandTeal.opacity(0.30)
                                                : LaiqTheme.panelBorder,
                                            lineWidth: 1
                                        )
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }

            LaiqSectionCard(
                title: "Capture Actions",
                subtitle: "These buttons now follow Android-style task logic instead of only incrementing global counters."
            ) {
                HStack(spacing: 12) {
                    Button(viewModel.addEntryLabel(for: task)) {
                        viewModel.adjustEntries(for: task, delta: 1)
                    }
                    .buttonStyle(LaiqPrimaryButtonStyle())

                    Button(viewModel.removeEntryLabel(for: task)) {
                        viewModel.adjustEntries(for: task, delta: -1)
                    }
                    .buttonStyle(LaiqSecondaryButtonStyle())
                    .disabled(snapshot.entryCount == 0)
                }

                HStack(spacing: 12) {
                    Button("Add Linked Finding") {
                        viewModel.addLinkedFinding(for: task)
                    }
                    .buttonStyle(LaiqSecondaryButtonStyle())
                    .disabled(!viewModel.canAddLinkedFinding(for: task))

                    Button("Add Attachment") {
                        viewModel.addAttachment(for: task)
                    }
                    .buttonStyle(LaiqSecondaryButtonStyle())
                    .disabled(!viewModel.canAddAttachment(for: task))
                }
            }

            LaiqSectionCard(
                title: "Current Capture State",
                subtitle: "The active measurement context and the review gate stay aligned with Android semantics."
            ) {
                HStack(spacing: 12) {
                    LaiqLabeledValue(label: "Active Entry", value: viewModel.currentEntryLabel(for: task))
                    LaiqLabeledValue(label: "Warnings", value: "\(viewModel.reviewWarnings.count)")
                }
                HStack(spacing: 12) {
                    LaiqLabeledValue(label: "Task Findings", value: "\(viewModel.linkedFindingCount(for: task))")
                    LaiqLabeledValue(label: "Task Attachments", value: "\(viewModel.linkedAttachmentCount(for: task))")
                }
                HStack(spacing: 12) {
                    LaiqLabeledValue(label: "Global Findings", value: "\(viewModel.draft.findings.findingCount)")
                    LaiqLabeledValue(label: "Global Attachments", value: "\(viewModel.draft.findings.attachmentCount)")
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

private func usesShellMap(_ task: InspectionTask) -> Bool {
    switch task {
    case .shellUT, .shellSettlement, .roundnessSurvey, .plumbnessSurvey, .shellNozzleUT:
        return true
    default:
        return false
    }
}

private func usesRoofMap(_ task: InspectionTask) -> Bool {
    switch task {
    case .roofElements, .roofUT, .roofNozzleUT:
        return true
    default:
        return false
    }
}

private func shellReferenceLabel(_ draft: InspectionDraft) -> String {
    if draft.scope.referenceMode == .trueNorth {
        return "True North"
    }
    let remark = draft.setup.referenceRemark.trimmingCharacters(in: .whitespacesAndNewlines)
    return remark.isEmpty ? "Tank North" : remark
}

import SwiftUI
import FieldIOSDemoCore

struct InspectionSetupView: View {
    @Bindable var viewModel: FieldDemoViewModel

    var body: some View {
        FieldScreenContainer(title: "Inspection Setup") {
            LaiqSectionCard(
                title: "Tank Setup",
                subtitle: "Minimum tank data for the local-first inspection package."
            ) {
                HStack(spacing: 10) {
                    LaiqStatChip(label: "Draft", value: "Local Only")
                    LaiqStatChip(label: "Target", value: "iPhone Demo")
                }
                Text("Complete the tank identity and geometry first. Shell lane planning and the roof layout preview both follow this baseline, just like the Android setup flow.")
                    .font(.body)
                    .foregroundStyle(LaiqTheme.ink)

                VStack(alignment: .leading, spacing: 10) {
                    Text("Sample Data Set")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(LaiqTheme.mutedText)
                    Picker("Sample", selection: $viewModel.selectedScenarioId) {
                        ForEach(viewModel.scenarios) { scenario in
                            Text(scenario.title).tag(scenario.id)
                        }
                    }
                    .pickerStyle(.menu)
                    Text(viewModel.scenarios.first(where: { $0.id == viewModel.selectedScenarioId })?.summary ?? "")
                        .font(.footnote)
                        .foregroundStyle(LaiqTheme.mutedText)
                }

                HStack(spacing: 12) {
                    Button("Load Sample Data") {
                        viewModel.loadSelectedScenario()
                    }
                    .buttonStyle(LaiqPrimaryButtonStyle())

                    Button("Start New Inspection") {
                        viewModel.startNewInspection()
                    }
                    .buttonStyle(LaiqSecondaryButtonStyle())
                }
            }

            LaiqSectionCard(
                title: "Inspection Identity",
                subtitle: "Who, where, and which tank."
            ) {
                setupTextField("Client", text: $viewModel.draft.setup.client)
                setupTextField("Site", text: $viewModel.draft.setup.site)
                setupTextField("Tank Number", text: $viewModel.draft.setup.tankNumber)
                setupTextField("Inspector", text: $viewModel.draft.setup.inspector)
            }

            LaiqSectionCard(
                title: "Shell Layout Baseline",
                subtitle: "Set the shell geometry, 0° reference, and lane plan in the same place."
            ) {
                setupTextField("Diameter (m)", text: $viewModel.draft.setup.diameterM, keyboard: .decimalPad)
                setupTextField("Height (m)", text: $viewModel.draft.setup.heightM, keyboard: .decimalPad)
                setupTextField("Shell Course Count", text: $viewModel.draft.setup.shellCourseCount, keyboard: .numberPad)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Reference Mode")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(LaiqTheme.mutedText)
                    Picker("Reference Mode", selection: $viewModel.draft.scope.referenceMode) {
                        Text("Tank North / Site Marker").tag(InspectionReferenceMode.tankNorth)
                        Text("True North").tag(InspectionReferenceMode.trueNorth)
                    }
                    .pickerStyle(.segmented)
                }

                setupTextField(
                    "Tank North / Site Marker",
                    text: $viewModel.draft.setup.referenceRemark
                )

                HStack(spacing: 10) {
                    LaiqStatChip(label: "Recommended Lanes", value: "\(viewModel.recommendedLaneCount)", tone: LaiqTheme.info)
                    LaiqStatChip(label: "Shell Courses", value: "\(viewModel.shellCourseCount)", tone: LaiqTheme.brandTeal)
                }

                ShellMapPreview(
                    courseCount: viewModel.shellCourseCount,
                    laneCount: viewModel.recommendedLaneCount,
                    highlightLabel: viewModel.draft.scope.referenceMode == .tankNorth ? "Tank North" : "True North"
                )
            }

            LaiqSectionCard(
                title: "Roof Layout Preview",
                subtitle: "Keep a roof reference map visible even though the iOS storage model stays lightweight."
            ) {
                RoofMapPreview(
                    itemCount: max(viewModel.snapshot(for: .roofElements).entryCount, 4),
                    label: "Preview"
                )
            }

            if !viewModel.setupValidationErrors.isEmpty {
                LaiqSectionCard(
                    title: "Required Before Continue",
                    subtitle: "Match the Android guardrails before moving into task scope."
                ) {
                    ForEach(viewModel.setupValidationErrors, id: \.self) { error in
                        Text(error)
                            .font(.body)
                            .foregroundStyle(LaiqTheme.warning)
                    }
                }
            }

            Button("Continue to Task Scope") {
                viewModel.continueToScope()
            }
            .buttonStyle(LaiqPrimaryButtonStyle())
            .disabled(!viewModel.setupValidationErrors.isEmpty)
        }
    }
}

private func setupTextField(_ title: String, text: Binding<String>, keyboard: UIKeyboardType = .default) -> some View {
    VStack(alignment: .leading, spacing: 8) {
        Text(title)
            .font(.footnote.weight(.semibold))
            .foregroundStyle(LaiqTheme.mutedText)
        TextField(title, text: text)
            .textInputAutocapitalization(.words)
            .keyboardType(keyboard)
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
            .background(Color.white)
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(LaiqTheme.panelBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

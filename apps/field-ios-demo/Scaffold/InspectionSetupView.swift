import SwiftUI
import FieldIOSDemoCore

struct InspectionSetupView: View {
    @Bindable var viewModel: FieldDemoViewModel

    var body: some View {
        Form {
            Section("Demo Scenarios") {
                Picker("Sample", selection: $viewModel.selectedScenarioId) {
                    ForEach(viewModel.scenarios) { scenario in
                        Text(scenario.title).tag(scenario.id)
                    }
                }
                Text(viewModel.scenarios.first(where: { $0.id == viewModel.selectedScenarioId })?.summary ?? "")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Button("Load Sample Data") {
                    viewModel.loadSelectedScenario()
                }
                .buttonStyle(.borderedProminent)
                Button("Start New Inspection") {
                    viewModel.startNewInspection()
                }
            }

            Section("Setup Baseline") {
                TextField("Client", text: $viewModel.draft.setup.client)
                TextField("Site", text: $viewModel.draft.setup.site)
                TextField("Tank Number", text: $viewModel.draft.setup.tankNumber)
                TextField("Inspector", text: $viewModel.draft.setup.inspector)
                TextField("Diameter (m)", text: $viewModel.draft.setup.diameterM)
                TextField("Height (m)", text: $viewModel.draft.setup.heightM)
                TextField("Shell Course Count", text: $viewModel.draft.setup.shellCourseCount)
                TextField("Tank North / Site Marker", text: $viewModel.draft.setup.referenceRemark)
            }

            if !viewModel.setupValidationErrors.isEmpty {
                Section("Required Before Continue") {
                    ForEach(viewModel.setupValidationErrors, id: \.self) { error in
                        Text(error)
                            .foregroundStyle(.orange)
                    }
                }
            }

            Section {
                Button("Continue to Task Scope") {
                    viewModel.continueToScope()
                }
                .buttonStyle(.borderedProminent)
                .disabled(!viewModel.setupValidationErrors.isEmpty)
            }
        }
        .navigationTitle("Inspection Setup")
    }
}

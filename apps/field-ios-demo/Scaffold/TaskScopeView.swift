import SwiftUI
import FieldIOSDemoCore

struct TaskScopeView: View {
    @Bindable var viewModel: FieldDemoViewModel

    var body: some View {
        Form {
            Section("Active Tasks") {
                ForEach(selectableTasks(), id: \.self) { task in
                    Toggle(
                        isOn: Binding(
                            get: { viewModel.draft.scope.selectedTasks.contains(task) },
                            set: { _ in viewModel.toggleTask(task) }
                        )
                    ) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(task.title)
                            Text(task.subtitle)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }

            if !viewModel.canContinueFromScope {
                Section {
                    Text("Select at least one active task before continuing.")
                        .foregroundStyle(.orange)
                }
            }

            Section {
                Button("Continue") {
                    viewModel.continueToTaskBoard()
                }
                .buttonStyle(.borderedProminent)
                .disabled(!viewModel.canContinueFromScope)

                Button("Back") {
                    viewModel.goBack()
                }
            }
        }
        .navigationTitle("Task Scope")
    }
}

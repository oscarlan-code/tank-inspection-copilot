import SwiftUI
import FieldIOSDemoCore

struct TaskScopeView: View {
    @Bindable var viewModel: FieldDemoViewModel

    var body: some View {
        FieldScreenContainer(title: "Task Scope") {
            LaiqSectionCard(
                title: "Task Scope",
                subtitle: "Choose the active capture modules needed for this inspection."
            ) {
                Text("Geometry, shell layout, and orientation are already set. If the baseline changes, go back to setup before capturing real field data.")
                    .font(.body)
                    .foregroundStyle(LaiqTheme.ink)
            }

            LaiqSectionCard(
                title: "Active Tasks",
                subtitle: "Select the measurement lanes required for this inspection package. Findings are added from inside each task flow."
            ) {
                VStack(spacing: 10) {
                    ForEach(selectableTasks(), id: \.self) { task in
                        TaskSelectionCard(
                            task: task,
                            isSelected: viewModel.draft.scope.selectedTasks.contains(task),
                            action: { viewModel.toggleTask(task) }
                        )
                    }
                    if !viewModel.canContinueFromScope {
                        Text("Select at least one active task before continuing.")
                            .font(.body)
                            .foregroundStyle(LaiqTheme.warning)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }

            HStack(spacing: 12) {
                Button("Back") {
                    viewModel.goBack()
                }
                .buttonStyle(LaiqSecondaryButtonStyle())

                Button("Continue") {
                    viewModel.continueToTaskBoard()
                }
                .buttonStyle(LaiqPrimaryButtonStyle())
                .disabled(!viewModel.canContinueFromScope)
            }
        }
    }
}

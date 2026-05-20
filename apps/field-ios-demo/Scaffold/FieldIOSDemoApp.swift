import SwiftUI
import FieldIOSDemoCore

@main
struct FieldIOSDemoApp: App {
    @State private var viewModel = FieldDemoViewModel()

    var body: some Scene {
        WindowGroup {
            FieldRootView(viewModel: viewModel)
        }
    }
}

struct FieldRootView: View {
    @Bindable var viewModel: FieldDemoViewModel

    var body: some View {
        NavigationStack {
            switch viewModel.screen {
            case .setup:
                InspectionSetupView(viewModel: viewModel)
            case .scope:
                TaskScopeView(viewModel: viewModel)
            case .taskBoard:
                TaskBoardView(viewModel: viewModel)
            case let .task(task):
                TaskWorkspaceView(viewModel: viewModel, task: task)
            case .review:
                ReviewExportView(viewModel: viewModel)
            case .exportHandoff:
                ExportHandoffView(viewModel: viewModel)
            }
        }
        .tint(LaiqTheme.brandTeal)
    }
}

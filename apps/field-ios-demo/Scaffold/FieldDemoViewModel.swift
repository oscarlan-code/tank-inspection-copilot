import Observation
import FieldIOSDemoCore

@Observable
final class FieldDemoViewModel {
    enum Screen {
        case setup
        case scope
        case taskBoard
        case review
    }

    var screen: Screen = .setup
    var selectedScenarioId: String
    var draft: InspectionDraft
    private let store: DemoSessionStore

    init(store: DemoSessionStore = try! .bootstrap()) {
        self.store = store
        self.selectedScenarioId = store.scenarios.first?.id ?? ""
        self.draft = store.reopenCurrent()
    }

    var scenarios: [DemoInspectionScenario] {
        store.scenarios
    }

    var setupValidationErrors: [String] {
        validationErrors(for: draft)
    }

    var canContinueFromScope: Bool {
        draft.scope.selectedTasks.contains(where: \.isCaptureTask)
    }

    var visibleTasks: [InspectionTask] {
        visibleSelectedTasks(draft.scope.selectedTasks)
    }

    func loadSelectedScenario() {
        guard let loaded = store.loadScenario(id: selectedScenarioId) else { return }
        draft = loaded
        screen = .setup
    }

    func startNewInspection() {
        draft = store.startNewInspection()
        screen = .setup
    }

    func continueToScope() {
        guard setupValidationErrors.isEmpty else { return }
        screen = .scope
    }

    func continueToTaskBoard() {
        guard canContinueFromScope else { return }
        screen = .taskBoard
    }

    func openReview() {
        screen = .review
    }

    func goBack() {
        switch screen {
        case .scope:
            screen = .setup
        case .taskBoard:
            screen = .scope
        case .review:
            screen = .taskBoard
        case .setup:
            break
        }
    }

    func toggleTask(_ task: InspectionTask) {
        guard task != .reviewExport, task != .findings else { return }
        if draft.scope.selectedTasks.contains(task) {
            draft.scope.selectedTasks.removeAll { $0 == task }
        } else {
            draft.scope.selectedTasks.append(task)
        }
    }

    func snapshot(for task: InspectionTask) -> TaskSnapshot {
        taskSnapshot(for: task, in: draft)
    }
}

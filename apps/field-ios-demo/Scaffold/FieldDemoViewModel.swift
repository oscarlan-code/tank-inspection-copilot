import Foundation
import Observation
import FieldIOSDemoCore

@Observable
final class FieldDemoViewModel {
    enum Screen: Equatable {
        case setup
        case scope
        case taskBoard
        case task(InspectionTask)
        case review
        case exportHandoff
    }

    var screen: Screen
    var selectedScenarioId: String
    var draft: InspectionDraft

    private let store: DemoSessionStore
    private let isoFormatter = ISO8601DateFormatter()
    private var navigationHistory: [Screen] = []

    init(store: DemoSessionStore = try! .bootstrap()) {
        self.store = store
        let session = store.reopenCurrentSession()
        self.selectedScenarioId = session.selectedScenarioId
        self.draft = session.activeDraft
        self.screen = Self.screen(from: session.currentScreenId, draft: session.activeDraft)
        normalizeDraft(persist: false)
        normalizeScreenIfNeeded()
        persistSession()
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

    var reviewWarnings: [String] {
        FieldIOSDemoCore.reviewWarnings(for: draft)
    }

    var recommendedLaneCount: Int {
        suggestedLaneCount(from: draft.setup.diameterM)
    }

    var shellCourseCount: Int {
        shellCourseValue(from: draft.setup.shellCourseCount)
    }

    func loadSelectedScenario() {
        guard let loaded = store.loadScenario(id: selectedScenarioId) else { return }
        draft = loaded
        navigationHistory.removeAll()
        screen = .setup
        normalizeDraft()
    }

    func startNewInspection() {
        draft = store.startNewInspection()
        navigationHistory.removeAll()
        screen = .setup
        normalizeDraft()
    }

    func continueToScope() {
        guard setupValidationErrors.isEmpty else { return }
        transition(to: .scope)
    }

    func continueToTaskBoard() {
        guard canContinueFromScope else { return }
        transition(to: .taskBoard)
    }

    func openReview() {
        transition(to: .review)
    }

    func openExportHandoff() {
        guard draft.review.readyForExport else { return }
        applyDraftMutation { draft in
            draft.review.lastPreparedPackageId = preparedPackageId(for: draft)
            draft.review.lastPreparedAtIso = isoFormatter.string(from: Date())
        }
        transition(to: .exportHandoff)
    }

    func returnToTaskBoard() {
        transition(to: .taskBoard, resetHistory: true)
    }

    func openTask(_ task: InspectionTask) {
        if task == .reviewExport {
            openReview()
        } else {
            transition(to: .task(task))
        }
    }

    func goBack() {
        if let previousScreen = navigationHistory.popLast() {
            screen = previousScreen
        } else {
            switch screen {
            case .scope:
                screen = .setup
            case .taskBoard:
                screen = .scope
            case .task, .review, .exportHandoff:
                screen = .taskBoard
            case .setup:
                break
            }
        }
        normalizeScreenIfNeeded()
        persistSession()
    }

    func toggleTask(_ task: InspectionTask) {
        guard task != .reviewExport, task != .findings else { return }
        if draft.scope.selectedTasks.contains(task) {
            draft.scope.selectedTasks.removeAll { $0 == task }
        } else {
            draft.scope.selectedTasks.append(task)
        }
        normalizeDraft()
    }

    func snapshot(for task: InspectionTask) -> TaskSnapshot {
        taskSnapshot(for: task, in: draft)
    }

    func entries(for task: InspectionTask) -> [TaskCaptureEntry] {
        snapshot(for: task).entries
    }

    func activeEntry(for task: InspectionTask) -> TaskCaptureEntry? {
        snapshot(for: task).activeEntry
    }

    func currentEntryLabel(for task: InspectionTask) -> String {
        activeEntry(for: task)?.label ?? "No active capture row"
    }

    func linkedFindingCount(for task: InspectionTask) -> Int {
        snapshot(for: task).linkedFindingCount
    }

    func linkedAttachmentCount(for task: InspectionTask) -> Int {
        snapshot(for: task).linkedAttachmentCount
    }

    func canAddLinkedFinding(for task: InspectionTask) -> Bool {
        activeEntry(for: task) != nil
    }

    func canAddAttachment(for task: InspectionTask) -> Bool {
        (activeEntry(for: task)?.findingCount ?? 0) > 0
    }

    func selectEntry(_ entryId: String, for task: InspectionTask) {
        applyDraftMutation { draft in
            var snapshot = taskSnapshot(for: task, in: draft)
            guard snapshot.entries.contains(where: { $0.id == entryId }) else { return }
            snapshot.activeEntryId = entryId
            upsertSnapshot(snapshot, in: &draft)
        }
    }

    func adjustEntries(for task: InspectionTask, delta: Int) {
        guard task.isCaptureTask, delta != 0 else { return }
        applyDraftMutation { draft in
            var snapshot = taskSnapshot(for: task, in: draft)
            var entries = snapshot.entries
            var activeEntryId = snapshot.activeEntryId

            if delta > 0 {
                for _ in 0..<delta {
                    let ordinal = entries.count + 1
                    let nextEntry = TaskCaptureEntry(
                        id: "\(task.rawValue)-\(UUID().uuidString)",
                        label: captureEntryLabel(for: task, ordinal: ordinal)
                    )
                    entries.append(nextEntry)
                    activeEntryId = nextEntry.id
                }
            } else {
                for _ in 0..<abs(delta) {
                    guard !entries.isEmpty else { break }
                    let removalIndex = entries.firstIndex(where: { $0.id == activeEntryId }) ?? (entries.count - 1)
                    let removedEntry = entries.remove(at: removalIndex)
                    draft.findings.findingCount = max(draft.findings.findingCount - removedEntry.findingCount, 0)
                    draft.findings.attachmentCount = max(draft.findings.attachmentCount - removedEntry.attachmentCount, 0)
                    activeEntryId = entries.last?.id
                }
            }

            snapshot = TaskSnapshot(
                task: task,
                status: status(for: task, entryCount: entries.count),
                entryCount: entries.count,
                blocksExport: true,
                entries: entries,
                activeEntryId: activeEntryId
            )
            upsertSnapshot(snapshot, in: &draft)
        }
    }

    func addLinkedFinding(for task: InspectionTask) {
        applyDraftMutation { draft in
            var snapshot = taskSnapshot(for: task, in: draft)
            guard let activeEntryId = snapshot.activeEntry?.id,
                  let entryIndex = snapshot.entries.firstIndex(where: { $0.id == activeEntryId }) else {
                return
            }

            snapshot.entries[entryIndex].findingCount += 1
            snapshot.activeEntryId = activeEntryId
            snapshot.entryCount = snapshot.entries.count
            snapshot.status = status(for: task, entryCount: snapshot.entryCount)
            draft.findings.findingCount += 1
            upsertSnapshot(snapshot, in: &draft)
        }
    }

    func addAttachment(for task: InspectionTask) {
        applyDraftMutation { draft in
            var snapshot = taskSnapshot(for: task, in: draft)
            guard let activeEntryId = snapshot.activeEntry?.id,
                  let entryIndex = snapshot.entries.firstIndex(where: { $0.id == activeEntryId }),
                  snapshot.entries[entryIndex].findingCount > 0 else {
                return
            }

            snapshot.entries[entryIndex].attachmentCount += 1
            snapshot.activeEntryId = activeEntryId
            snapshot.entryCount = snapshot.entries.count
            snapshot.status = status(for: task, entryCount: snapshot.entryCount)
            draft.findings.attachmentCount += 1
            upsertSnapshot(snapshot, in: &draft)
        }
    }

    func addEntryLabel(for task: InspectionTask) -> String {
        switch task {
        case .roofElements:
            return "Add Roof Element"
        case .shellUT, .roofUT:
            return "Capture Reading"
        case .shellSettlement, .roundnessSurvey, .plumbnessSurvey:
            return "Add Survey Point"
        case .shellNozzleUT, .roofNozzleUT:
            return "Add Nozzle Row"
        case .findings:
            return "Add Finding"
        case .reviewExport:
            return "Open Review"
        }
    }

    func removeEntryLabel(for task: InspectionTask) -> String {
        switch task {
        case .roofElements:
            return "Remove Roof Element"
        case .shellUT, .roofUT:
            return "Remove Reading"
        case .shellSettlement, .roundnessSurvey, .plumbnessSurvey:
            return "Remove Survey Point"
        case .shellNozzleUT, .roofNozzleUT:
            return "Remove Nozzle Row"
        case .findings:
            return "Remove Finding"
        case .reviewExport:
            return "Back"
        }
    }

    func instructions(for task: InspectionTask) -> String {
        switch task {
        case .roofElements:
            return "Register roof fittings first so the roof map becomes the reference surface for UT points and findings."
        case .shellUT:
            return "Capture shell readings lane by lane. Findings should stay linked to the active shell row."
        case .shellSettlement:
            return "Add settlement stations around the shell perimeter and keep the same orientation reference used in setup."
        case .roundnessSurvey:
            return "Enter roundness offsets by band while keeping the active capture band selected."
        case .plumbnessSurvey:
            return "Capture plumbness offsets against the shell map so station placement stays consistent."
        case .roofUT:
            return "Capture roof plate readings with the roof map visible, then attach findings to the active roof row."
        case .shellNozzleUT:
            return "Register shell nozzles and keep findings attached to the active nozzle row."
        case .roofNozzleUT:
            return "Register roof nozzles and keep findings attached to the active roof nozzle row."
        case .findings:
            return "Findings are created from inside each capture task in this demo, matching the Android workflow direction."
        case .reviewExport:
            return "Review readiness reflects Android-style task presence checks and then continues into the export handoff screen."
        }
    }

    private func applyDraftMutation(_ update: (inout InspectionDraft) -> Void) {
        var nextDraft = draft
        update(&nextDraft)
        draft = nextDraft
        normalizeDraft()
    }

    private func normalizeDraft(persist: Bool = true) {
        draft.scope.selectedTasks = normalizedSelectedTasks(draft.scope.selectedTasks)
        draft.taskSnapshots = draft.taskSnapshots
            .filter(\.task.isCaptureTask)
            .map { snapshot in
                TaskSnapshot(
                    task: snapshot.task,
                    status: status(for: snapshot.task, entryCount: snapshot.entries.count),
                    entryCount: snapshot.entries.count,
                    blocksExport: snapshot.blocksExport,
                    entries: snapshot.entries,
                    activeEntryId: snapshot.activeEntryId
                )
            }

        draft.findings.findingCount = max(draft.findings.findingCount, 0)
        draft.findings.attachmentCount = max(draft.findings.attachmentCount, 0)
        draft.review.warningCount = FieldIOSDemoCore.reviewWarnings(for: draft).count
        draft.review.readyForExport = draft.review.warningCount == 0

        normalizeScreenIfNeeded()
        if persist {
            persistSession()
        }
    }

    private func normalizeScreenIfNeeded() {
        if case let .task(task) = screen, !draft.scope.selectedTasks.contains(task) {
            screen = .taskBoard
        }
    }

    private func persistSession() {
        store.saveSession(
            DemoSessionState(
                selectedScenarioId: selectedScenarioId,
                activeDraft: draft,
                currentScreenId: screenPersistenceID(for: screen)
            )
        )
    }

    private func transition(to newScreen: Screen, resetHistory: Bool = false) {
        if resetHistory {
            navigationHistory.removeAll()
        } else if screen != newScreen {
            navigationHistory.append(screen)
        }
        screen = newScreen
        normalizeScreenIfNeeded()
        persistSession()
    }

    private func upsertSnapshot(_ snapshot: TaskSnapshot, in draft: inout InspectionDraft) {
        if let index = draft.taskSnapshots.firstIndex(where: { $0.task == snapshot.task }) {
            if snapshot.entryCount == 0 {
                draft.taskSnapshots.remove(at: index)
            } else {
                draft.taskSnapshots[index] = snapshot
            }
        } else if snapshot.entryCount > 0 {
            draft.taskSnapshots.append(snapshot)
        }
    }

    private func status(for task: InspectionTask, entryCount: Int) -> InspectionTaskStatus {
        guard task.isCaptureTask else { return .ready }
        return entryCount == 0 ? .notStarted : .ready
    }

    private func normalizedSelectedTasks(_ selectedTasks: [InspectionTask]) -> [InspectionTask] {
        var seen = Set<InspectionTask>()
        var normalized: [InspectionTask] = []

        for task in selectedTasks where task != .findings {
            if seen.insert(task).inserted {
                normalized.append(task)
            }
        }

        if !normalized.contains(.reviewExport) {
            normalized.append(.reviewExport)
        }

        return normalized
    }

    private func preparedPackageId(for draft: InspectionDraft) -> String {
        let tankToken = draft.setup.tankNumber
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: " ", with: "-")
        let prefix = tankToken.isEmpty ? "inspection" : tankToken
        let suffix = draft.draftId.replacingOccurrences(of: "-", with: "").prefix(8)
        return "\(prefix)-\(suffix)"
    }

    private func screenPersistenceID(for screen: Screen) -> String {
        switch screen {
        case .setup:
            return "setup"
        case .scope:
            return "scope"
        case .taskBoard:
            return "taskBoard"
        case let .task(task):
            return "task:\(task.rawValue)"
        case .review:
            return "review"
        case .exportHandoff:
            return "exportHandoff"
        }
    }

    private static func screen(from persistenceID: String, draft: InspectionDraft) -> Screen {
        switch persistenceID {
        case "scope":
            return .scope
        case "taskBoard":
            return .taskBoard
        case "review":
            return .review
        case "exportHandoff":
            return .exportHandoff
        default:
            if persistenceID.hasPrefix("task:") {
                let rawTask = String(persistenceID.dropFirst("task:".count))
                if let task = InspectionTask(rawValue: rawTask), draft.scope.selectedTasks.contains(task) {
                    return .task(task)
                }
                return .taskBoard
            }
            return .setup
        }
    }
}

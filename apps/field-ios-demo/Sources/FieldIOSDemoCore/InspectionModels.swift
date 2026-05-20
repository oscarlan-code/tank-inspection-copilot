import Foundation

public enum InspectionReferenceMode: String, Codable, CaseIterable, Sendable {
    case tankNorth
    case trueNorth
}

public enum InspectionTaskStatus: String, Codable, Sendable {
    case notStarted
    case inProgress
    case ready
    case deferred
}

public enum InspectionTask: String, Codable, CaseIterable, Hashable, Sendable {
    case roofElements
    case shellUT
    case shellSettlement
    case roundnessSurvey
    case plumbnessSurvey
    case roofUT
    case shellNozzleUT
    case roofNozzleUT
    case findings
    case reviewExport

    public var title: String {
        switch self {
        case .roofElements: return "Roof Elements"
        case .shellUT: return "Shell UT"
        case .shellSettlement: return "Shell Settlement"
        case .roundnessSurvey: return "Roundness Survey"
        case .plumbnessSurvey: return "Plumbness Survey"
        case .roofUT: return "Roof UT"
        case .shellNozzleUT: return "Shell Nozzles"
        case .roofNozzleUT: return "Roof Nozzles"
        case .findings: return "Findings"
        case .reviewExport: return "Review & Export"
        }
    }

    public var subtitle: String {
        switch self {
        case .roofElements: return "Register roof fittings and locate them on the roof map."
        case .shellUT: return "Capture shell thickness readings."
        case .shellSettlement: return "Capture settlement survey elevations."
        case .roundnessSurvey: return "Capture roundness band offsets."
        case .plumbnessSurvey: return "Capture plumbness station offsets."
        case .roofUT: return "Capture roof plate thickness readings."
        case .shellNozzleUT: return "Register shell nozzles and capture readings."
        case .roofNozzleUT: return "Register roof nozzles and capture readings."
        case .findings: return "Review findings linked from capture flows."
        case .reviewExport: return "Check readiness before export."
        }
    }

    public var isCaptureTask: Bool {
        switch self {
        case .findings, .reviewExport:
            return false
        default:
            return true
        }
    }
}

public struct InspectionSetup: Codable, Equatable, Sendable {
    public var client: String
    public var site: String
    public var tankNumber: String
    public var inspector: String
    public var diameterM: String
    public var heightM: String
    public var shellCourseCount: String
    public var referenceRemark: String

    public init(
        client: String = "",
        site: String = "",
        tankNumber: String = "",
        inspector: String = "Field Engineer",
        diameterM: String = "",
        heightM: String = "",
        shellCourseCount: String = "",
        referenceRemark: String = ""
    ) {
        self.client = client
        self.site = site
        self.tankNumber = tankNumber
        self.inspector = inspector
        self.diameterM = diameterM
        self.heightM = heightM
        self.shellCourseCount = shellCourseCount
        self.referenceRemark = referenceRemark
    }
}

public struct InspectionScope: Codable, Equatable, Sendable {
    public var referenceMode: InspectionReferenceMode
    public var selectedTasks: [InspectionTask]

    public init(
        referenceMode: InspectionReferenceMode = .tankNorth,
        selectedTasks: [InspectionTask] = defaultFieldTasks()
    ) {
        self.referenceMode = referenceMode
        self.selectedTasks = selectedTasks
    }
}

public struct TaskCaptureEntry: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var label: String
    public var findingCount: Int
    public var attachmentCount: Int

    public init(
        id: String,
        label: String,
        findingCount: Int = 0,
        attachmentCount: Int = 0
    ) {
        self.id = id
        self.label = label
        self.findingCount = findingCount
        self.attachmentCount = attachmentCount
    }
}

public struct TaskSnapshot: Codable, Equatable, Sendable {
    public var task: InspectionTask
    public var status: InspectionTaskStatus
    public var entryCount: Int
    public var blocksExport: Bool
    public var entries: [TaskCaptureEntry]
    public var activeEntryId: String?

    public var linkedFindingCount: Int {
        entries.reduce(0) { partial, entry in
            partial + entry.findingCount
        }
    }

    public var linkedAttachmentCount: Int {
        entries.reduce(0) { partial, entry in
            partial + entry.attachmentCount
        }
    }

    public var activeEntry: TaskCaptureEntry? {
        guard let activeEntryId else { return entries.last }
        return entries.first(where: { $0.id == activeEntryId }) ?? entries.last
    }

    public init(
        task: InspectionTask,
        status: InspectionTaskStatus,
        entryCount: Int,
        blocksExport: Bool = true,
        entries: [TaskCaptureEntry] = [],
        activeEntryId: String? = nil
    ) {
        let resolvedEntries = entries.isEmpty
            ? defaultCaptureEntries(for: task, count: entryCount)
            : entries
        self.task = task
        self.status = status
        self.entryCount = resolvedEntries.isEmpty ? entryCount : resolvedEntries.count
        self.blocksExport = blocksExport
        self.entries = resolvedEntries
        self.activeEntryId = resolvedEntries.isEmpty ? nil : (activeEntryId ?? resolvedEntries.last?.id)
    }

    private enum CodingKeys: String, CodingKey {
        case task
        case status
        case entryCount
        case blocksExport
        case entries
        case activeEntryId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let task = try container.decode(InspectionTask.self, forKey: .task)
        let status = try container.decodeIfPresent(InspectionTaskStatus.self, forKey: .status) ?? .notStarted
        let entryCount = try container.decodeIfPresent(Int.self, forKey: .entryCount) ?? 0
        let blocksExport = try container.decodeIfPresent(Bool.self, forKey: .blocksExport) ?? true
        let decodedEntries = try container.decodeIfPresent([TaskCaptureEntry].self, forKey: .entries) ?? []
        let activeEntryId = try container.decodeIfPresent(String.self, forKey: .activeEntryId)

        let resolvedEntries = decodedEntries.isEmpty
            ? defaultCaptureEntries(for: task, count: entryCount)
            : decodedEntries

        self.task = task
        self.status = status
        self.entryCount = resolvedEntries.isEmpty ? entryCount : resolvedEntries.count
        self.blocksExport = blocksExport
        self.entries = resolvedEntries
        self.activeEntryId = resolvedEntries.isEmpty ? nil : (activeEntryId ?? resolvedEntries.last?.id)
    }
}

public struct FindingSummary: Codable, Equatable, Sendable {
    public var findingCount: Int
    public var attachmentCount: Int

    public init(findingCount: Int = 0, attachmentCount: Int = 0) {
        self.findingCount = findingCount
        self.attachmentCount = attachmentCount
    }
}

public struct ReviewSummary: Codable, Equatable, Sendable {
    public var warningCount: Int
    public var readyForExport: Bool
    public var lastPreparedPackageId: String?
    public var lastPreparedAtIso: String?

    public init(
        warningCount: Int = 0,
        readyForExport: Bool = false,
        lastPreparedPackageId: String? = nil,
        lastPreparedAtIso: String? = nil
    ) {
        self.warningCount = warningCount
        self.readyForExport = readyForExport
        self.lastPreparedPackageId = lastPreparedPackageId
        self.lastPreparedAtIso = lastPreparedAtIso
    }
}

public struct InspectionDraft: Codable, Equatable, Sendable {
    public var draftId: String
    public var title: String
    public var setup: InspectionSetup
    public var scope: InspectionScope
    public var taskSnapshots: [TaskSnapshot]
    public var findings: FindingSummary
    public var review: ReviewSummary

    public init(
        draftId: String = UUID().uuidString,
        title: String = "New Inspection",
        setup: InspectionSetup = InspectionSetup(),
        scope: InspectionScope = InspectionScope(),
        taskSnapshots: [TaskSnapshot] = [],
        findings: FindingSummary = FindingSummary(),
        review: ReviewSummary = ReviewSummary()
    ) {
        self.draftId = draftId
        self.title = title
        self.setup = setup
        self.scope = scope
        self.taskSnapshots = taskSnapshots
        self.findings = findings
        self.review = review
    }
}

public struct DemoInspectionScenario: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var title: String
    public var summary: String
    public var draft: InspectionDraft
}

public func defaultFieldTasks() -> [InspectionTask] {
    [
        .roofElements,
        .shellUT,
        .shellSettlement,
        .roundnessSurvey,
        .plumbnessSurvey,
        .roofUT,
        .shellNozzleUT,
        .roofNozzleUT,
        .reviewExport,
    ]
}

public func selectableTasks() -> [InspectionTask] {
    InspectionTask.allCases.filter { task in
        task != .findings && task != .reviewExport
    }
}

public func visibleSelectedTasks(_ selectedTasks: [InspectionTask]) -> [InspectionTask] {
    var visible = selectedTasks.filter { task in
        task != .findings && task != .reviewExport
    }
    if !visible.contains(.reviewExport) {
        visible.append(.reviewExport)
    }
    return visible
}

public func validationErrors(for draft: InspectionDraft) -> [String] {
    var errors: [String] = []
    if draft.setup.client.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        errors.append("Client is required.")
    }
    if draft.setup.site.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        errors.append("Site is required.")
    }
    if draft.setup.tankNumber.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        errors.append("Tank number is required.")
    }
    if (Double(draft.setup.diameterM) ?? 0) <= 0 {
        errors.append("Diameter must be a positive number.")
    }
    if (Double(draft.setup.heightM) ?? 0) <= 0 {
        errors.append("Height must be a positive number.")
    }
    if (Int(draft.setup.shellCourseCount) ?? 0) <= 0 {
        errors.append("Shell course count must be a positive integer.")
    }
    if draft.scope.referenceMode == .tankNorth &&
        draft.setup.referenceRemark.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        errors.append("Enter the tank north / site marker remark.")
    }
    if !draft.scope.selectedTasks.contains(where: { $0.isCaptureTask }) {
        errors.append("Select at least one active task.")
    }
    return errors
}

public func reviewWarnings(for draft: InspectionDraft) -> [String] {
    var warnings = validationErrors(for: draft)

    if draft.scope.selectedTasks.contains(.roofElements) && taskSnapshot(for: .roofElements, in: draft).entryCount == 0 {
        warnings.append("Register at least one roof element.")
    }
    if draft.scope.selectedTasks.contains(.shellUT) && taskSnapshot(for: .shellUT, in: draft).entryCount == 0 {
        warnings.append("Add at least one shell UT row.")
    }
    if draft.scope.selectedTasks.contains(.shellSettlement) && taskSnapshot(for: .shellSettlement, in: draft).entryCount == 0 {
        warnings.append("Add at least one shell settlement station.")
    }
    if draft.scope.selectedTasks.contains(.roundnessSurvey) && taskSnapshot(for: .roundnessSurvey, in: draft).entryCount == 0 {
        warnings.append("Add at least one roundness survey band.")
    }
    if draft.scope.selectedTasks.contains(.plumbnessSurvey) && taskSnapshot(for: .plumbnessSurvey, in: draft).entryCount == 0 {
        warnings.append("Add at least one plumbness survey station.")
    }
    if draft.scope.selectedTasks.contains(.roofUT) && taskSnapshot(for: .roofUT, in: draft).entryCount == 0 {
        warnings.append("Add at least one roof UT row.")
    }
    if draft.scope.selectedTasks.contains(.shellNozzleUT) && taskSnapshot(for: .shellNozzleUT, in: draft).entryCount == 0 {
        warnings.append("Register at least one shell nozzle.")
    }
    if draft.scope.selectedTasks.contains(.roofNozzleUT) && taskSnapshot(for: .roofNozzleUT, in: draft).entryCount == 0 {
        warnings.append("Register at least one roof nozzle.")
    }

    var seen = Set<String>()
    return warnings.filter { warning in
        seen.insert(warning).inserted
    }
}

public func taskSnapshot(for task: InspectionTask, in draft: InspectionDraft) -> TaskSnapshot {
    if task == .reviewExport {
        return TaskSnapshot(
            task: .reviewExport,
            status: draft.review.readyForExport ? .ready : .inProgress,
            entryCount: draft.review.warningCount,
            blocksExport: true
        )
    }

    if task == .findings {
        return TaskSnapshot(
            task: .findings,
            status: .ready,
            entryCount: draft.findings.findingCount,
            blocksExport: false
        )
    }

    return draft.taskSnapshots.first(where: { $0.task == task })
        ?? TaskSnapshot(task: task, status: .notStarted, entryCount: 0)
}

private func defaultCaptureEntries(for task: InspectionTask, count: Int) -> [TaskCaptureEntry] {
    guard task.isCaptureTask, count > 0 else { return [] }
    return (1...count).map { index in
        TaskCaptureEntry(
            id: "\(task.rawValue)-entry-\(index)",
            label: captureEntryLabel(for: task, ordinal: index)
        )
    }
}

public func captureEntryLabel(for task: InspectionTask, ordinal: Int) -> String {
    switch task {
    case .roofElements:
        return "Roof Element \(ordinal)"
    case .shellUT:
        return "Shell Row \(ordinal)"
    case .shellSettlement:
        return "Settlement Station \(ordinal)"
    case .roundnessSurvey:
        return "Roundness Band \(ordinal)"
    case .plumbnessSurvey:
        return "Plumbness Station \(ordinal)"
    case .roofUT:
        return "Roof Row \(ordinal)"
    case .shellNozzleUT:
        return "Shell Nozzle \(ordinal)"
    case .roofNozzleUT:
        return "Roof Nozzle \(ordinal)"
    case .findings:
        return "Finding \(ordinal)"
    case .reviewExport:
        return "Review Item \(ordinal)"
    }
}

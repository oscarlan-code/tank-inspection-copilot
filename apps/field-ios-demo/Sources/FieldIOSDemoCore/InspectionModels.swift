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

public struct TaskSnapshot: Codable, Equatable, Sendable {
    public var task: InspectionTask
    public var status: InspectionTaskStatus
    public var entryCount: Int
    public var blocksExport: Bool

    public init(
        task: InspectionTask,
        status: InspectionTaskStatus,
        entryCount: Int,
        blocksExport: Bool = true
    ) {
        self.task = task
        self.status = status
        self.entryCount = entryCount
        self.blocksExport = blocksExport
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

    public init(warningCount: Int = 0, readyForExport: Bool = false) {
        self.warningCount = warningCount
        self.readyForExport = readyForExport
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

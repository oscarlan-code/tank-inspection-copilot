import Foundation

public enum DemoSeedLoader {
    public static func loadScenarios(bundle: Bundle) throws -> [DemoInspectionScenario] {
        guard let url = bundle.url(forResource: "demo_scenarios", withExtension: "json") else {
            throw CocoaError(.fileNoSuchFile)
        }
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode([DemoInspectionScenario].self, from: data)
    }

    public static func loadScenarios() throws -> [DemoInspectionScenario] {
        try loadScenarios(bundle: .module)
    }
}

public final class DemoSessionStore {
    public let scenarios: [DemoInspectionScenario]
    public private(set) var activeDraft: InspectionDraft

    public init(scenarios: [DemoInspectionScenario]) {
        self.scenarios = scenarios
        self.activeDraft = scenarios.first?.draft ?? InspectionDraft()
    }

    public static func bootstrap(bundle: Bundle) throws -> DemoSessionStore {
        DemoSessionStore(scenarios: try DemoSeedLoader.loadScenarios(bundle: bundle))
    }

    public static func bootstrap() throws -> DemoSessionStore {
        try bootstrap(bundle: .module)
    }

    @discardableResult
    public func loadScenario(id: String) -> InspectionDraft? {
        guard let scenario = scenarios.first(where: { $0.id == id }) else {
            return nil
        }
        activeDraft = scenario.draft
        return scenario.draft
    }

    @discardableResult
    public func startNewInspection() -> InspectionDraft {
        let freshDraft = InspectionDraft()
        activeDraft = freshDraft
        return freshDraft
    }

    public func reopenCurrent() -> InspectionDraft {
        activeDraft
    }
}

import Foundation

private final class DemoResourceBundleLocator {}

public struct DemoSessionState: Codable, Equatable, Sendable {
    public var selectedScenarioId: String
    public var activeDraft: InspectionDraft
    public var currentScreenId: String

    public init(
        selectedScenarioId: String,
        activeDraft: InspectionDraft,
        currentScreenId: String = "setup"
    ) {
        self.selectedScenarioId = selectedScenarioId
        self.activeDraft = activeDraft
        self.currentScreenId = currentScreenId
    }
}

public enum DemoSeedLoader {
    public static func defaultBundle() -> Bundle {
        #if SWIFT_PACKAGE
        return .module
        #else
        return Bundle(for: DemoResourceBundleLocator.self)
        #endif
    }

    public static func loadScenarios(bundle: Bundle) throws -> [DemoInspectionScenario] {
        guard let url = bundle.url(forResource: "demo_scenarios", withExtension: "json") else {
            throw CocoaError(.fileNoSuchFile)
        }
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode([DemoInspectionScenario].self, from: data)
    }

    public static func loadScenarios() throws -> [DemoInspectionScenario] {
        try loadScenarios(bundle: defaultBundle())
    }
}

public final class DemoSessionStore {
    public let scenarios: [DemoInspectionScenario]
    public private(set) var sessionState: DemoSessionState

    private let persistenceURL: URL?
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    public var activeDraft: InspectionDraft {
        sessionState.activeDraft
    }

    public init(
        scenarios: [DemoInspectionScenario],
        persistedSessionURL: URL? = nil
    ) {
        self.scenarios = scenarios
        self.persistenceURL = persistedSessionURL
        self.encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

        let defaultScenarioId = scenarios.first?.id ?? ""
        let defaultDraft = scenarios.first?.draft ?? InspectionDraft()
        let fallback = DemoSessionState(
            selectedScenarioId: defaultScenarioId,
            activeDraft: defaultDraft,
            currentScreenId: "setup"
        )

        if
            let persistedSessionURL,
            let persisted = Self.loadSession(from: persistedSessionURL, using: decoder)
        {
            self.sessionState = Self.sanitized(
                persisted,
                scenarios: scenarios,
                fallback: fallback
            )
        } else {
            self.sessionState = fallback
        }
    }

    public static func bootstrap(bundle: Bundle) throws -> DemoSessionStore {
        DemoSessionStore(
            scenarios: try DemoSeedLoader.loadScenarios(bundle: bundle),
            persistedSessionURL: defaultPersistenceURL()
        )
    }

    public static func bootstrap() throws -> DemoSessionStore {
        try bootstrap(bundle: DemoSeedLoader.defaultBundle())
    }

    public func reopenCurrentSession() -> DemoSessionState {
        sessionState
    }

    public func reopenCurrent() -> InspectionDraft {
        sessionState.activeDraft
    }

    public func saveSession(_ sessionState: DemoSessionState) {
        self.sessionState = Self.sanitized(
            sessionState,
            scenarios: scenarios,
            fallback: self.sessionState
        )
        persist()
    }

    @discardableResult
    public func loadScenario(id: String) -> InspectionDraft? {
        guard let scenario = scenarios.first(where: { $0.id == id }) else {
            return nil
        }
        sessionState.selectedScenarioId = id
        sessionState.activeDraft = scenario.draft
        sessionState.currentScreenId = "setup"
        persist()
        return scenario.draft
    }

    @discardableResult
    public func startNewInspection() -> InspectionDraft {
        let freshDraft = InspectionDraft()
        sessionState.activeDraft = freshDraft
        sessionState.currentScreenId = "setup"
        persist()
        return freshDraft
    }

    private func persist() {
        guard let persistenceURL else { return }
        do {
            let directoryURL = persistenceURL.deletingLastPathComponent()
            try FileManager.default.createDirectory(
                at: directoryURL,
                withIntermediateDirectories: true
            )
            let data = try encoder.encode(sessionState)
            try data.write(to: persistenceURL, options: .atomic)
        } catch {
            assertionFailure("Failed to persist demo session: \(error)")
        }
    }

    private static func defaultPersistenceURL() -> URL? {
        guard let applicationSupportURL = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first else {
            return nil
        }
        return applicationSupportURL
            .appendingPathComponent("FieldIOSDemo", isDirectory: true)
            .appendingPathComponent("demo-session.json")
    }

    private static func loadSession(
        from url: URL,
        using decoder: JSONDecoder
    ) -> DemoSessionState? {
        guard FileManager.default.fileExists(atPath: url.path) else {
            return nil
        }
        do {
            let data = try Data(contentsOf: url)
            return try decoder.decode(DemoSessionState.self, from: data)
        } catch {
            return nil
        }
    }

    private static func sanitized(
        _ sessionState: DemoSessionState,
        scenarios: [DemoInspectionScenario],
        fallback: DemoSessionState
    ) -> DemoSessionState {
        let resolvedScenarioId = scenarios.contains(where: { $0.id == sessionState.selectedScenarioId })
            ? sessionState.selectedScenarioId
            : fallback.selectedScenarioId
        let resolvedScreenId = sessionState.currentScreenId.isEmpty ? "setup" : sessionState.currentScreenId
        return DemoSessionState(
            selectedScenarioId: resolvedScenarioId,
            activeDraft: sessionState.activeDraft,
            currentScreenId: resolvedScreenId
        )
    }
}

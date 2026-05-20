import Foundation
import Testing
@testable import FieldIOSDemoCore

@Test
func demoScenariosLoadAndMatchExpectedIds() throws {
    let scenarios = try DemoSeedLoader.loadScenarios()

    #expect(scenarios.count == 3)
    #expect(scenarios.map(\.id) == [
        "pacific-energy-tk-13",
        "tjs-tk-465",
        "full-coverage-sample",
    ])
}

@Test
func visibleTasksAlwaysKeepReviewExportAtTheEnd() {
    let visible = visibleSelectedTasks([.shellUT, .reviewExport, .findings])

    #expect(visible == [.shellUT, .reviewExport])
}

@Test
func validationRequiresAtLeastOneActiveCaptureTask() {
    let draft = InspectionDraft(
        setup: InspectionSetup(
            client: "Client",
            site: "Site",
            tankNumber: "TK-1",
            inspector: "Inspector",
            diameterM: "10",
            heightM: "12",
            shellCourseCount: "4",
            referenceRemark: "Tank North"
        ),
        scope: InspectionScope(
            referenceMode: .tankNorth,
            selectedTasks: [.reviewExport]
        )
    )

    #expect(validationErrors(for: draft).contains("Select at least one active task."))
}

@Test
func reviewWarningsRequireSelectedTaskCapturePresence() {
    let draft = InspectionDraft(
        setup: InspectionSetup(
            client: "Client",
            site: "Site",
            tankNumber: "TK-1",
            inspector: "Inspector",
            diameterM: "10",
            heightM: "12",
            shellCourseCount: "4",
            referenceRemark: "Tank North"
        ),
        scope: InspectionScope(
            referenceMode: .tankNorth,
            selectedTasks: [.shellUT, .reviewExport]
        )
    )

    #expect(reviewWarnings(for: draft).contains("Add at least one shell UT row."))
}

@Test
func taskSnapshotDecodingBuildsPlaceholderEntriesFromSavedCounts() throws {
    let json = """
    {
      "task": "shellUT",
      "status": "ready",
      "entryCount": 3,
      "blocksExport": true
    }
    """

    let snapshot = try JSONDecoder().decode(TaskSnapshot.self, from: Data(json.utf8))

    #expect(snapshot.entryCount == 3)
    #expect(snapshot.entries.count == 3)
    #expect(snapshot.activeEntry?.label == "Shell Row 3")
}

@Test
func demoSessionStorePersistsSavedSessionState() throws {
    let scenarios = try DemoSeedLoader.loadScenarios()
    let persistenceURL = FileManager.default.temporaryDirectory
        .appendingPathComponent(UUID().uuidString)
        .appendingPathComponent("demo-session.json")

    var draft = scenarios[0].draft
    draft.setup.client = "Persisted Client"
    let savedSession = DemoSessionState(
        selectedScenarioId: scenarios[0].id,
        activeDraft: draft,
        currentScreenId: "task:shellUT"
    )

    let firstStore = DemoSessionStore(
        scenarios: scenarios,
        persistedSessionURL: persistenceURL
    )
    firstStore.saveSession(savedSession)

    let secondStore = DemoSessionStore(
        scenarios: scenarios,
        persistedSessionURL: persistenceURL
    )
    let reopened = secondStore.reopenCurrentSession()

    #expect(reopened.selectedScenarioId == scenarios[0].id)
    #expect(reopened.currentScreenId == "task:shellUT")
    #expect(reopened.activeDraft.setup.client == "Persisted Client")

    try? FileManager.default.removeItem(at: persistenceURL.deletingLastPathComponent())
}

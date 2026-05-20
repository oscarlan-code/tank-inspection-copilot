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

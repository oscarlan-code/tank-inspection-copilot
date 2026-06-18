package ai.laiq.tankinspection.v2product.preview

import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.domain.model.RotationDirection
import ai.laiq.tankinspection.v2product.model.V2ChecklistRating
import ai.laiq.tankinspection.v2product.model.V2DraftState
import ai.laiq.tankinspection.v2product.model.V2ElementPlacementState
import ai.laiq.tankinspection.v2product.model.V2ElementSetup
import ai.laiq.tankinspection.v2product.model.V2ElementType
import ai.laiq.tankinspection.v2product.model.V2FindingPhoto
import ai.laiq.tankinspection.v2product.model.V2FindingRecord
import ai.laiq.tankinspection.v2product.model.V2FindingState
import ai.laiq.tankinspection.v2product.model.V2FloorTemplate
import ai.laiq.tankinspection.v2product.model.V2GeneralTankInfo
import ai.laiq.tankinspection.v2product.model.V2InspectionChecklistCatalog
import ai.laiq.tankinspection.v2product.model.V2InspectionChecklistState
import ai.laiq.tankinspection.v2product.model.V2LayoutMapSetup
import ai.laiq.tankinspection.v2product.model.V2LayoutScope
import ai.laiq.tankinspection.v2product.model.V2LayoutSurface
import ai.laiq.tankinspection.v2product.model.V2LayoutTarget
import ai.laiq.tankinspection.v2product.model.V2PlacedElement
import ai.laiq.tankinspection.v2product.model.V2ReferenceMode
import ai.laiq.tankinspection.v2product.model.V2ShellOffsetStartRow
import ai.laiq.tankinspection.v2product.model.V2UtItemKind
import ai.laiq.tankinspection.v2product.model.V2UtMeasurementEntry
import ai.laiq.tankinspection.v2product.model.V2UtMeasurementState
import ai.laiq.tankinspection.v2product.model.V2UtSetup
import ai.laiq.tankinspection.v2product.storage.V2WorkflowScreen

internal data class V2MockTaskSeed(
    val state: V2DraftState,
    val workflowScreen: V2WorkflowScreen,
)

internal fun v2ProductMockTaskSeeds(): List<V2MockTaskSeed> = listOf(
    utInProgressSeed(),
    checklistInProgressSeed(),
    exportReadySeed(),
)

internal fun v2ProductApiStandardV10Seed(): V2MockTaskSeed = exportReadySeed()

private fun checklistInProgressSeed(): V2MockTaskSeed =
    V2MockTaskSeed(
        state = v10ReportAlignedBaseState().copy(
            utMeasurements = v10UtMeasurementsCompleted(),
            inspectionChecklist = v10ChecklistInProgressState(),
            findingState = v10FindingStateReady(),
        ),
        workflowScreen = V2WorkflowScreen.CHECKLIST,
    )

private fun exportReadySeed(): V2MockTaskSeed =
    V2MockTaskSeed(
        state = v10ReportAlignedBaseState().copy(
            utMeasurements = v10UtMeasurementsCompleted(),
            inspectionChecklist = v10ChecklistCompletedState(),
            findingState = v10FindingStateReady(),
        ),
        workflowScreen = V2WorkflowScreen.CHECKLIST,
    )

private fun utInProgressSeed(): V2MockTaskSeed =
    V2MockTaskSeed(
        state = v10ReportAlignedBaseState().copy(
            utMeasurements = v10UtMeasurementsInProgress(),
            inspectionChecklist = V2InspectionChecklistState(selectedSectionKey = "fixed_roof_cone_dome"),
            findingState = v10FindingStateInProgress(),
        ),
        workflowScreen = V2WorkflowScreen.UT_MEASUREMENT,
    )

private fun v10ReportAlignedBaseState(): V2DraftState =
    V2DraftState(
        generalTankInfo = v10GeneralInfo(),
        layoutScope = V2LayoutScope(
            externalRoof = true,
            internalRoof = false,
            shell = true,
            floor = true,
        ),
        layoutMapSetup = V2LayoutMapSetup(
            selectedTarget = V2LayoutTarget.SHELL,
            selectedSurface = V2LayoutSurface.SHELL,
            referenceMode = V2ReferenceMode.TANK_NORTH,
            referenceNote = "0° reference taken from nozzle N2 centerline, matching the V10 report sketch convention.",
            rotationDirection = RotationDirection.CLOCKWISE,
            roofPattern = RoofTemplate.CIRCULAR_PLATE,
            roofRowCount = "6",
            roofWidestRowPlateCount = "11",
            roofHasCenterOpening = false,
            roofCenterOpeningPlateCount = "0",
            roofHasAnnularRing = false,
            roofAnnularSectionCount = "0",
            shellCourseCount = "8",
            shellPlatesPerCourse = "9",
            shellLaneCount = "4",
            shellPlateOffset = "half_plate",
            shellOffsetStartRow = V2ShellOffsetStartRow.EVEN,
            floorTemplate = V2FloorTemplate.CIRCULAR_PLATE,
            floorPlateCount = "35",
            floorAnnularSectionCount = "0",
            floorPatternCountX = "6",
            floorPatternCountY = "6",
            approvedTargets = setOf(
                V2LayoutTarget.EXTERNAL_ROOF,
                V2LayoutTarget.SHELL,
                V2LayoutTarget.FLOOR,
            ),
        ),
        elementSetup = V2ElementSetup(
            externalRoof = true,
            internalRoof = false,
            shell = true,
            floor = true,
        ),
        elementPlacement = V2ElementPlacementState(
            selectedTarget = V2LayoutTarget.SHELL,
            selectedElementType = V2ElementType.STAIR,
            placementsByTarget = mapOf(
                V2LayoutTarget.EXTERNAL_ROOF to v10RoofPlacements(),
                V2LayoutTarget.SHELL to v10ShellPlacements(),
                V2LayoutTarget.FLOOR to v10FloorPlacements(),
            ),
            approvedTargets = setOf(
                V2LayoutTarget.EXTERNAL_ROOF,
                V2LayoutTarget.SHELL,
                V2LayoutTarget.FLOOR,
            ),
        ),
        utSetup = V2UtSetup(
            externalRoof = true,
            internalRoof = false,
            shell = true,
            floor = true,
        ),
    )

private fun v10RoofPlacements(): List<V2PlacedElement> =
    listOf(
        V2PlacedElement(
            id = "external_roof_manhole_1",
            label = "MH-1",
            type = V2ElementType.MANHOLE,
            normalizedX = 0.50f,
            normalizedY = 0.18f,
        ),
        V2PlacedElement(
            id = "external_roof_nozzle_r1",
            label = "R1",
            type = V2ElementType.NOZZLE,
            normalizedX = 0.50f,
            normalizedY = 0.28f,
        ),
        V2PlacedElement(
            id = "external_roof_nozzle_r2",
            label = "R2",
            type = V2ElementType.NOZZLE,
            normalizedX = 0.64f,
            normalizedY = 0.31f,
        ),
        V2PlacedElement(
            id = "external_roof_nozzle_r3",
            label = "R3",
            type = V2ElementType.NOZZLE,
            normalizedX = 0.74f,
            normalizedY = 0.43f,
        ),
        V2PlacedElement(
            id = "external_roof_nozzle_r4",
            label = "R4",
            type = V2ElementType.NOZZLE,
            normalizedX = 0.72f,
            normalizedY = 0.59f,
        ),
        V2PlacedElement(
            id = "external_roof_nozzle_r5",
            label = "R5",
            type = V2ElementType.NOZZLE,
            normalizedX = 0.60f,
            normalizedY = 0.72f,
        ),
        V2PlacedElement(
            id = "external_roof_nozzle_r6",
            label = "R6",
            type = V2ElementType.NOZZLE,
            normalizedX = 0.44f,
            normalizedY = 0.74f,
        ),
        V2PlacedElement(
            id = "external_roof_nozzle_r7",
            label = "R7",
            type = V2ElementType.NOZZLE,
            normalizedX = 0.31f,
            normalizedY = 0.63f,
        ),
        V2PlacedElement(
            id = "external_roof_nozzle_r8",
            label = "R8",
            type = V2ElementType.NOZZLE,
            normalizedX = 0.27f,
            normalizedY = 0.45f,
        ),
        V2PlacedElement(
            id = "external_roof_nozzle_r9",
            label = "R9",
            type = V2ElementType.NOZZLE,
            normalizedX = 0.38f,
            normalizedY = 0.31f,
        ),
        V2PlacedElement(
            id = "external_roof_vent_1",
            label = "VT-1",
            type = V2ElementType.VENT,
            normalizedX = 0.50f,
            normalizedY = 0.50f,
        ),
    )

private fun v10ShellPlacements(): List<V2PlacedElement> =
    listOf(
        V2PlacedElement(
            id = "shell_stair_origin",
            label = "ST-O",
            type = V2ElementType.STAIR,
            normalizedX = 0.12f,
            normalizedY = 0.70f,
        ),
        V2PlacedElement(
            id = "shell_stair_termination",
            label = "ST-T",
            type = V2ElementType.STAIR,
            normalizedX = 0.18f,
            normalizedY = 0.24f,
        ),
        V2PlacedElement(
            id = "shell_platform_1",
            label = "PF-1",
            type = V2ElementType.PLATFORM,
            normalizedX = 0.20f,
            normalizedY = 0.22f,
        ),
        V2PlacedElement(
            id = "shell_nozzle_s1",
            label = "S1",
            type = V2ElementType.NOZZLE,
            normalizedX = 0.08f,
            normalizedY = 0.82f,
        ),
        V2PlacedElement(
            id = "shell_nozzle_s2",
            label = "S2",
            type = V2ElementType.NOZZLE,
            normalizedX = 0.21f,
            normalizedY = 0.72f,
        ),
        V2PlacedElement(
            id = "shell_nozzle_s3",
            label = "S3",
            type = V2ElementType.NOZZLE,
            normalizedX = 0.34f,
            normalizedY = 0.76f,
        ),
        V2PlacedElement(
            id = "shell_nozzle_s4",
            label = "S4",
            type = V2ElementType.NOZZLE,
            normalizedX = 0.47f,
            normalizedY = 0.70f,
        ),
        V2PlacedElement(
            id = "shell_nozzle_s5",
            label = "S5",
            type = V2ElementType.NOZZLE,
            normalizedX = 0.60f,
            normalizedY = 0.74f,
        ),
        V2PlacedElement(
            id = "shell_nozzle_s6",
            label = "S6",
            type = V2ElementType.NOZZLE,
            normalizedX = 0.73f,
            normalizedY = 0.68f,
        ),
        V2PlacedElement(
            id = "shell_nozzle_s7",
            label = "S7",
            type = V2ElementType.NOZZLE,
            normalizedX = 0.86f,
            normalizedY = 0.82f,
        ),
    )

private fun v10FloorPlacements(): List<V2PlacedElement> =
    listOf(
        V2PlacedElement(
            id = "floor_sump_1",
            label = "SU-1",
            type = V2ElementType.SUMP,
            normalizedX = 0.50f,
            normalizedY = 0.52f,
        ),
        V2PlacedElement(
            id = "floor_datum_1",
            label = "RF-1",
            type = V2ElementType.DATUM,
            normalizedX = 0.78f,
            normalizedY = 0.50f,
        ),
    )

private fun v10GeneralInfo(): V2GeneralTankInfo =
    V2GeneralTankInfo(
        client = "Pacific Energy SWP Ltd",
        clientRepresentative = "Howard Ah Sam",
        jobNo = "22PE1-4",
        tankNumber = "V10",
        dateCompleted = "2022-07-22",
        inspector = "Syed A. R. Balkhi",
        location = "Vuda, Fiji",
        fieldLeaseName = "Vuda Terminal",
        yearBuilt = "1977",
        originalManufacturer = "Not Provided",
        originalConstructionStd = "Not Provided",
        materialSpec = "Carbon Steel Unknown Grade",
        drawingRef = "Previous Reports",
        shellConstruction = "butt",
        roofType = "Fixed Dome Roof",
        externalRoofType = "yes",
        internalRoofType = "no",
        height = "14.535",
        serviceHeight = "14.22",
        diameter = "19.52",
        productStored = "PULP",
        specificGravity = "0.7313",
        designTemp = "Not Provided",
        internalPressure = "Not Provided",
        courseNumber = "8",
        floorPlateNumber = "35",
        roofPlateNumber = "59",
        floorPlateThickness = "10 mm",
        windGirder = "No",
        annularPlateNumber = "Nil",
        insulated = "no",
        annularPlateThickness = "10 mm",
        stiffener = "No",
        previousExternal = "A13P58-1-2 / 15th Nov 2013; 03B3-12 / 20th Aug 2003",
        previousInternal = "A13P58-1-2 / 15th Nov 2013; 03B3-12 / 20th Aug 2003",
        previousBottom = "A13P58-1-2 / 15th Nov 2013; 03B3-12 / 20th Aug 2003",
    )

private fun v10UtMeasurementsInProgress(): V2UtMeasurementState =
    v10UtMeasurementsCompleted().copy(
        approvedTargets = setOf(V2LayoutTarget.EXTERNAL_ROOF),
        selectedTarget = V2LayoutTarget.SHELL,
    )

private fun v10UtMeasurementsCompleted(): V2UtMeasurementState =
    V2UtMeasurementState(
        selectedTarget = V2LayoutTarget.SHELL,
        entriesByItemKey = (
            v10RoofPlateUtEntries() +
                v10RoofNozzleUtEntries() +
                v10ShellNozzleUtEntries() +
                v10ShellStrakeUtEntries() +
                v10FloorUtEntries()
            ).toMap(),
        approvedTargets = setOf(
            V2LayoutTarget.EXTERNAL_ROOF,
            V2LayoutTarget.SHELL,
            V2LayoutTarget.FLOOR,
        ),
    )

private fun v10RoofPlateUtEntries(): List<Pair<String, V2UtMeasurementEntry>> =
    listOf(
        "1" to listOf("4.40", "4.52", "4.56", "4.48", "4.06"),
        "2" to listOf("4.86", "4.07", "4.40", "3.97", "4.11"),
        "3" to listOf("3.97", "4.78", "4.56", "4.04", "4.56"),
        "4" to listOf("3.64", "3.81", "3.77", "4.77", "4.76"),
        "5" to listOf("3.58", "4.74", "3.82", "4.43", "4.82"),
        "6" to listOf("4.42", "3.95", "4.57", "3.56", "4.74"),
        "7" to listOf("4.09", "4.73", "4.16", "3.74", "4.35"),
        "8" to listOf("4.26", "4.78", "4.13", "4.23", "4.32"),
        "9" to listOf("3.76", "4.61", "3.83", "4.52", "4.72"),
        "10" to listOf("4.41", "3.97", "3.65", "3.93", "3.99"),
        "11" to listOf("3.66", "4.24", "3.63", "4.48", "3.92"),
        "12" to listOf("4.34", "3.98", "3.91", "3.84", "4.46"),
        "13" to listOf("4.47", "4.10", "4.80", "3.85", "3.93"),
        "14" to listOf("3.76", "3.74", "4.86", "4.22", "4.63"),
        "15" to listOf("4.69", "3.89", "4.06", "4.78", "4.19"),
        "16" to listOf("4.57", "4.07", "4.69", "4.15", "4.15"),
        "17" to listOf("4.12", "4.76", "4.76", "3.78", "3.59"),
        "18" to listOf("4.58", "4.26", "4.58", "4.34", "3.95"),
        "19" to listOf("4.80", "4.39", "3.92", "3.84", "3.82"),
        "20" to listOf("4.61", "3.57", "4.73", "3.91", "3.94"),
        "21" to listOf("4.65", "4.82", "3.77", "4.62", "4.35"),
        "22" to listOf("4.37", "3.57", "3.86", "3.72", "3.72"),
        "23" to listOf("3.83", "4.07", "3.94", "4.34", "4.59"),
        "24" to listOf("3.89", "4.85", "4.11", "3.63", "3.99"),
        "25" to listOf("3.83", "3.57", "4.79", "4.62", "4.29"),
        "26" to listOf("4.59", "4.21", "4.30", "4.64", "4.05"),
        "27" to listOf("3.97", "3.96", "4.65", "4.70", "3.99"),
        "28" to listOf("4.85", "4.65", "4.19", "4.07", "4.04"),
        "29" to listOf("3.69", "3.57", "4.62", "4.39", "4.89"),
        "30" to listOf("4.11", "3.90", "3.58", "3.54", "4.43"),
        "31" to listOf("4.06", "4.46", "3.72", "3.61", "4.68"),
        "32" to listOf("4.15", "4.15", "4.32", "4.33", "4.51"),
        "33" to listOf("4.67", "4.61", "4.08", "4.53", "4.39"),
        "34" to listOf("4.24", "4.22", "3.95", "4.65", "4.70"),
        "35" to listOf("4.12", "4.15", "4.88", "4.76", "4.53"),
        "36" to listOf("4.49", "4.69", "4.82", "3.89", "3.73"),
        "37" to listOf("4.73", "4.14", "3.71", "4.42", "4.31"),
        "38" to listOf("4.38", "4.44", "4.43", "4.22", "4.27"),
        "39" to listOf("3.69", "3.69", "4.20", "4.64", "4.68"),
        "40" to listOf("3.75", "4.48", "3.79", "4.50", "3.79"),
        "41" to listOf("4.49", "4.23", "4.39", "3.53", "4.74"),
        "42" to listOf("3.63", "4.63", "3.80", "3.53", "4.63"),
        "43" to listOf("3.74", "4.32", "4.25", "4.08", "3.79"),
        "44" to listOf("4.87", "4.40", "4.46", "4.89", "4.90"),
        "45" to listOf("3.83", "4.54", "4.01", "4.50", "4.88"),
        "46" to listOf("4.09", "4.87", "4.91", "4.67", "4.78"),
        "47" to listOf("4.20", "4.42", "4.30", "3.82", "4.84"),
        "48" to listOf("4.27", "4.69", "4.21", "3.64", "3.84"),
        "49" to listOf("4.18", "3.94", "3.54", "4.79", "4.33"),
        "50" to listOf("4.57", "4.00", "4.07", "4.46", "4.29"),
        "51" to listOf("3.71", "4.31", "4.64", "3.74", "4.44"),
        "52" to listOf("3.97", "4.16", "4.51", "4.85", "3.89"),
        "53" to listOf("3.75", "4.52", "4.53", "3.63", "4.47"),
        "54" to listOf("4.80", "4.31", "4.04", "4.63", "4.74"),
        "55" to listOf("4.03", "4.45", "4.22", "4.53", "3.69"),
        "56" to listOf("4.54", "4.75", "3.74", "4.08", "4.66"),
        "57" to listOf("3.80", "3.98", "4.60", "3.70", "3.68"),
        "58" to listOf("3.89", "4.01", "4.73", "4.22", "3.99"),
        "59" to listOf("4.90", "4.78", "3.77", "4.46", "4.64"),
    ).map { (plate, readings) ->
        measuredRegionEntry(V2LayoutTarget.EXTERNAL_ROOF, plate, readings)
    }

private fun v10RoofNozzleUtEntries(): List<Pair<String, V2UtMeasurementEntry>> =
    listOf(
        roofNozzleEntry("r1", "R1", "4 in", listOf("6.77", "6.65", "6.31", "6.46"), "6.73"),
        roofNozzleEntry("r2", "R2", "24 in", listOf("6.22", "6.18", "6.09", "6.16")),
        roofNozzleEntry("r3", "R3", "4 in", listOf("5.72", "5.81", "5.66", "5.60"), "6.53"),
        roofNozzleEntry("r4", "R4", "6 in", listOf("6.60", "6.82", "6.81", "6.72"), "6.24"),
        roofNozzleEntry("r5", "R5", "4 in", listOf("4.32", "4.26", "4.12", "4.33"), "4.08"),
        roofNozzleEntry("r6", "R6", "6 in", listOf("6.43", "6.62", "6.72", "6.55"), "6.07"),
        roofNozzleEntry("r7", "R7", "24 in", listOf("6.04", "6.11", "6.08", "6.14")),
        roofNozzleEntry("r8", "R8", "4 in", listOf("6.12", "5.75", "6.02", "5.89"), "5.81"),
        roofNozzleEntry("r9", "R9", "4 in", listOf("6.05", "6.12", "6.04", "6.09"), "6.75"),
    )

private fun roofNozzleEntry(
    idSuffix: String,
    label: String,
    nozzleSize: String,
    readings: List<String>,
    reinforcementPadReading: String = "",
): Pair<String, V2UtMeasurementEntry> =
    measuredElementEntry(
        target = V2LayoutTarget.EXTERNAL_ROOF,
        itemKey = "external_roof:element:external_roof_nozzle_$idSuffix",
        itemLabel = label,
        elementType = V2ElementType.NOZZLE,
        nozzleSize = nozzleSize,
        reinforcementPadReading = reinforcementPadReading,
        readings = readings,
    )

private fun v10ShellNozzleUtEntries(): List<Pair<String, V2UtMeasurementEntry>> =
    listOf(
        shellNozzleEntry("s1", "S1", "24 in", listOf("12.30", "12.15", "10.80", "11.26"), "13.91"),
        shellNozzleEntry("s2", "S2", "1.5 in", listOf("3.45", "3.33", "3.02", "3.25")),
        shellNozzleEntry("s3", "S3", "4 in", listOf("6.01", "6.33", "6.45", "6.24"), "13.64"),
        shellNozzleEntry("s4", "S4", "6 in", listOf("7.34", "7.11", "6.89", "7.26"), "13.32"),
        shellNozzleEntry("s5", "S5", "8 in", listOf("", "", "", "7.41"), "13.41"),
        shellNozzleEntry("s6", "S6", "24 in", listOf("13.89", "13.92", "13.24", "13.96"), "13.85"),
    )

private fun shellNozzleEntry(
    idSuffix: String,
    label: String,
    nozzleSize: String,
    readings: List<String>,
    reinforcementPadReading: String = "",
): Pair<String, V2UtMeasurementEntry> =
    measuredElementEntry(
        target = V2LayoutTarget.SHELL,
        itemKey = "shell:element:shell_nozzle_$idSuffix",
        itemLabel = label,
        elementType = V2ElementType.NOZZLE,
        nozzleSize = nozzleSize,
        reinforcementPadReading = reinforcementPadReading,
        readings = readings,
    )

private fun v10ShellStrakeUtEntries(): List<Pair<String, V2UtMeasurementEntry>> {
    fun entry(
        strake: Int,
        directionLane: Int,
        readings: List<String>,
    ): Pair<String, V2UtMeasurementEntry> =
        measuredRegionEntry(
            target = V2LayoutTarget.SHELL,
            itemLabel = "L$directionLane-C$strake",
            readings = readings,
        )

    // L1-L4 map to the report's N/E/S/W shell UT directions.
    return listOf(
        entry(1, 1, listOf("12.33", "12.34", "12.27", "12.19", "12.32")),
        entry(1, 2, listOf("12.29", "12.31", "12.36", "12.24", "12.19")),
        entry(1, 3, listOf("12.25", "12.46", "12.53", "12.47", "12.55")),
        entry(1, 4, listOf("12.24", "12.28", "12.32", "12.39", "12.22")),
        entry(2, 1, listOf("12.21", "12.02", "12.22", "12.30", "12.31")),
        entry(2, 2, listOf("12.42", "12.38", "12.30", "12.26", "12.34")),
        entry(2, 3, listOf("12.54", "12.33", "12.36", "12.25", "12.22")),
        entry(2, 4, listOf("12.18", "12.24", "12.27", "12.25", "12.25")),
        entry(3, 1, listOf("8.94", "9.12", "9.10", "9.13", "9.12")),
        entry(3, 2, listOf("9.14", "8.88", "8.94", "8.76", "8.65")),
        entry(3, 3, listOf("9.11", "8.83", "8.62", "8.74", "8.32")),
        entry(3, 4, listOf("9.08", "8.64", "8.61", "9.04", "8.71")),
        entry(4, 1, listOf("7.33", "7.42", "7.32", "7.33", "7.41")),
        entry(4, 2, listOf("7.24", "7.12", "7.41", "7.28", "7.36")),
        entry(4, 3, listOf("6.67", "7.32", "7.26", "7.38", "6.74")),
        entry(4, 4, listOf("7.40", "7.51", "7.40", "7.32", "7.38")),
        entry(5, 1, listOf("5.66", "5.46", "5.44", "5.61", "5.34")),
        entry(5, 2, listOf("5.40", "5.42", "5.65", "5.48", "5.44")),
        entry(5, 3, listOf("4.53", "4.65", "4.52", "4.81", "4.82")),
        entry(5, 4, listOf("5.43", "5.46", "5.21", "5.34", "5.33")),
        entry(6, 1, listOf("5.56", "5.28", "5.55", "5.51", "5.42")),
        entry(6, 2, listOf("5.46", "5.32", "5.33", "5.41", "5.32")),
        entry(6, 3, listOf("3.50", "3.81", "4.53", "4.82", "5.12")),
        entry(6, 4, listOf("5.57", "5.54", "5.45", "5.43", "5.59")),
        entry(7, 1, listOf("5.53", "5.54", "5.62", "5.43", "5.45")),
        entry(7, 2, listOf("5.91", "5.96", "5.88", "5.43", "5.98")),
        entry(7, 3, listOf("4.03", "4.45", "4.91", "4.95", "5.12")),
        entry(7, 4, listOf("5.96", "5.92", "5.89", "5.98", "5.95")),
        entry(8, 1, listOf("5.84", "5.84", "5.91", "5.94", "5.78")),
        entry(8, 2, listOf("5.88", "5.91", "5.76", "5.98", "5.77")),
        entry(8, 3, listOf("5.52", "5.34", "5.31", "5.45", "5.54")),
        entry(8, 4, listOf("5.78", "5.95", "5.95", "5.98", "5.99")),
    )
}

private fun v10FloorUtEntries(): List<Pair<String, V2UtMeasurementEntry>> =
    listOf(
        "1" to listOf("9.80", "9.65", "9.72", "9.91", "10.05"),
        "2" to listOf("9.44", "9.32", "9.58", "9.41", "9.36"),
        "3" to listOf("8.92", "8.84", "9.10", "8.76", "8.98"),
        "4" to listOf("9.78", "9.70", "9.84", "9.61", "9.73"),
        "5" to listOf("8.63", "8.50", "8.71", "8.42", "8.59"),
        "6" to listOf("7.96", "8.10", "8.04", "7.88", "8.16"),
        "7" to listOf("8.75", "8.62", "8.81", "8.56", "8.69"),
        "8" to listOf("9.22", "9.18", "9.34", "9.05", "9.27"),
        "9" to listOf("8.34", "8.20", "8.42", "8.11", "8.36"),
        "10" to listOf("7.74", "7.82", "7.69", "7.91", "7.86"),
        "11" to listOf("8.42", "8.31", "8.52", "8.27", "8.45"),
        "12" to listOf("9.04", "9.12", "8.97", "9.18", "9.08"),
        "13" to listOf("7.28", "7.40", "7.19", "7.55", "7.36"),
        "14" to listOf("8.91", "8.86", "8.77", "8.98", "8.83"),
        "15" to listOf("9.55", "9.48", "9.63", "9.39", "9.51"),
        "16" to listOf("6.61", "6.84", "6.72", "6.95", "6.78"),
        "17" to listOf("8.05", "7.96", "8.18", "7.89", "8.10"),
        "18" to listOf("7.90", "8.02", "8.11", "7.84", "7.99"),
        "19" to listOf("9.31", "9.24", "9.40", "9.17", "9.35"),
        "20" to listOf("8.68", "8.54", "8.72", "8.49", "8.61"),
        "21" to listOf("7.42", "7.58", "7.36", "7.65", "7.50"),
        "22" to listOf("8.21", "8.10", "8.35", "8.03", "8.18"),
        "23" to listOf("9.02", "8.94", "9.11", "8.87", "9.05"),
        "24" to listOf("5.28", "5.62", "5.90", "6.25", "5.74"),
        "25" to listOf("6.08", "6.00", "6.18", "5.94", "6.12"),
        "26" to listOf("7.79", "7.92", "7.85", "8.02", "7.88"),
        "27" to listOf("8.77", "8.69", "8.91", "8.61", "8.82"),
        "28" to listOf("9.45", "9.31", "9.56", "9.22", "9.38"),
        "29" to listOf("8.32", "8.45", "8.38", "8.50", "8.41"),
        "30" to listOf("7.19", "7.45", "7.82", "8.10", "8.50"),
        "31" to listOf("9.84", "9.75", "9.96", "9.68", "9.90"),
        "32" to listOf("8.80", "8.91", "8.76", "8.98", "8.86"),
        "33" to listOf("7.76", "7.94", "8.22", "8.59", "8.83"),
        "34" to listOf("9.12", "9.04", "9.21", "8.97", "9.08"),
        "35" to listOf("8.59", "8.84", "9.12", "10.83", "10.10"),
    ).map { (plate, readings) ->
        measuredRegionEntry(V2LayoutTarget.FLOOR, plate, readings)
    }

private fun v10FindingStateInProgress(): V2FindingState =
    V2FindingState(
        findingsByItemKey = buildMap {
            val measurements = v10UtMeasurementsCompleted().entriesByItemKey
            listOf(
                findingEntry(
                    measurements.getValue("shell:region:L3-C6"),
                    "Area 1 south-southwest shell buckling zone at the 5th/6th course weld. External UT scan recorded localized thinning with minimum thickness around 2.28 mm; internal inspection confirmed MPI indications and repair marking.",
                    "Photo 7 - Area 1 external buckling and patch plates",
                    "Photo 13 - Area 1 UT scanning low-thickness zone",
                ),
                findingEntry(
                    measurements.getValue("external_roof:region:53"),
                    "Roof-to-curb angle adjacent to roof sketch plate 53 had coating failure and corrosion initiation after coating removal. No leak was detected at this location during the inspection.",
                    "Photo 28 - Roof-to-curb coating failure near plate 53",
                ),
            ).forEach { finding ->
                putAll(listOf(finding))
            }
        },
    )

private fun v10FindingStateReady(): V2FindingState =
    V2FindingState(
        findingsByItemKey = buildMap {
            val measurements = v10UtMeasurementsCompleted().entriesByItemKey
            listOf(
                findingEntry(
                    measurements.getValue("shell:region:L3-C6"),
                    "Area 1 south-southwest shell buckling zone at the 5th/6th course weld. External UT scan recorded average remaining thickness of about 5.45 mm on Strake 5 and 5.65 mm on Strake 6, with localized minimum thickness around 2.28 mm. Internal visual inspection detected two approximately 30 mm MPI-confirmed linear indications and the area was marked for weld build-up or patch repair.",
                    "Photo 7 - Area 1 buckling and non-code overlapping patch",
                    "Photo 13 - Area 1 external UT scan low-thickness area",
                    "Photo 14 - Internal pitting confirmed and marked for weld fill",
                ),
                findingEntry(
                    measurements.getValue("shell:region:L4-C6"),
                    "Area 2 west-southwest shell buckling zone at the 5th/6th course weld. Visual inspection found two approximately 50 mm paint cracks near soft-patched leak locations and a separate approximately 5 mm through-hole about 500 mm from the temporarily sealed pinhole. External UT scan recorded minimum thickness around 4.79 mm; MPI on the opened external weld band did not detect linear indications.",
                    "Photo 8 - Area 2 external buckling zone",
                    "Photo 9 - Paint cracking near soft patch",
                    "Photo 44 - Internal through-hole near previous pinhole",
                ),
                findingEntry(
                    measurements.getValue("shell:region:L3-C5"),
                    "Area 3 shell internal horizontal weld between the 4th and 5th courses contained significant localized metal loss up to approximately 4 mm. Continuous linear indications approximately 2 m long were confirmed by MPI, and scattered pitting up to approximately 3.5 mm was observed. External UT scan recorded minimum thickness around 3.76 mm.",
                    "Photo 45 - Area 3 MPI indication at horizontal weld",
                    "Photo 46 - Area 3 metal loss along weld band",
                    "Photo 47 - Area 3 scattered pitting up to 3.5 mm",
                ),
                findingEntry(
                    measurements.getValue("shell:region:L4-C5"),
                    "Area 4 shell internal horizontal weld between the 4th and 5th courses contained significant localized metal loss up to approximately 4 mm. Continuous MPI-confirmed indications extended approximately 2 m along the weld, with scattered pitting up to approximately 3 mm. External UT scan recorded minimum thickness around 3.72 mm.",
                    "Photo 48 - Area 4 continuous MPI indication",
                    "Photo 49 - Area 4 scattered pitting up to 3 mm",
                ),
                findingEntry(
                    measurements.getValue("shell:region:L4-C3"),
                    "Area 5 shell internal horizontal weld between the 2nd and 3rd courses showed slight metal loss. No cracks were detected during MPI, and external UT scan recorded minimum thickness around 5.00 mm.",
                    "Photo 50 - Area 5 slight metal loss, no cracks detected",
                ),
                findingEntry(
                    measurements.getValue("external_roof:region:53"),
                    "Coating failure with subsequent corrosion was detected along the roof-to-curb angle weld at the south sector adjacent to roof sketch plate 53. Coating removal showed corrosion initiation at the shell-to-curb angle joint, but no leak was detected during inspection.",
                    "Photo 28 - Roof-to-curb corrosion adjacent to plate 53",
                    "Photo 17 - Vapor-space coating bubbling at shell-to-curb angle",
                ),
                findingEntry(
                    measurements.getValue("external_roof:element:external_roof_nozzle_r1"),
                    "Roof nozzle R1 has complete N/E/S/W UT readings and reinforcement pad thickness recorded from the report table. General roof nozzle condition was satisfactory, with only minor coating failures and surface corrosion reported on some roof nozzles.",
                    "Photo 38 - Roof nozzle coating failure and surface corrosion",
                ),
                findingEntry(
                    measurements.getValue("shell:element:shell_nozzle_s1"),
                    "Shell nozzle S1 has 12/3/6/9 o'clock UT readings and reinforcement pad thickness captured from the report table. Shell nozzles were generally satisfactory, but all reinforcement pads were reported without tell-tale holes.",
                    "Photo 18 - Shell nozzle general condition",
                    "Photo 19 - Shell nozzle reinforcement pad without tell-tale hole",
                ),
                findingEntry(
                    measurements.getValue("shell:element:shell_nozzle_s5"),
                    "Shell nozzle S5 has patched readings on three clock positions and a 9 o'clock reading of 7.41 mm. Reinforcement pad thickness was recorded as 13.41 mm; absence of tell-tale holes remains a report recommendation item.",
                    "Photo 19 - Shell nozzle reinforcement pad without tell-tale hole",
                ),
                findingEntry(
                    measurements.getValue("floor:region:24"),
                    "Floor coating bubbling and historical weld-filled pitting were noted in accessible bottom plate areas. MFL indications of 40 percent and above were mainly attributed to remnant welds, weld fills, existing topside corrosion, and some underside corrosion. UT backup on high indications included bottom plate readings in the 5.28 mm to 6.25 mm range.",
                    "Photo 54 - Floor coating bubbling with light corrosion",
                    "Photo 55 - Weld-filled topside pitting on floor plates",
                ),
                findingEntry(
                    measurements.getValue("floor:region:30"),
                    "Floor plate 30 represents an MFL/UT backup area with localized underside corrosion indication. The exported UT readings capture the report-aligned lower band of bottom plate measurements while the final repair disposition remains report-side.",
                    "Photo 56 - Existing coated pit depth range with no active corrosion",
                ),
                findingEntry(
                    findingOnlyElementEntry(
                        target = V2LayoutTarget.EXTERNAL_ROOF,
                        itemKey = "external_roof:element:external_roof_manhole_1",
                        itemLabel = "MH-1",
                        elementType = V2ElementType.MANHOLE,
                    ),
                    "Roof manhole did not contain a reinforcement plate as recommended by API 650. Final recommendation is to add reinforcement around the roof manhole in accordance with API 650 clause 5.8.4.",
                    "Photo 37 - Roof manhole without reinforcement plate",
                ),
                findingEntry(
                    findingOnlyElementEntry(
                        target = V2LayoutTarget.EXTERNAL_ROOF,
                        itemKey = "external_roof:element:external_roof_vent_1",
                        itemLabel = "VT-1",
                        elementType = V2ElementType.VENT,
                    ),
                    "Roof venting nozzles were not trimmed flush as recommended by API 650 Figures 5-19 and 5-20. Future vent installations should be trimmed flush during repair or replacement.",
                    "Photo 41 - Roof venting nozzle not trimmed flush",
                ),
                findingEntry(
                    findingOnlyElementEntry(
                        target = V2LayoutTarget.SHELL,
                        itemKey = "shell:element:shell_stair_origin",
                        itemLabel = "ST-O",
                        elementType = V2ElementType.STAIR,
                    ),
                    "Several shell-mounted stairway treads were welded within shell plate butt-welded joints, contrary to API 650 attachment spacing guidance. Coating condition was generally satisfactory with minor failures on stringers and handrails.",
                    "Photo 23 - Stairway tread welded within shell butt joint",
                ),
                findingEntry(
                    findingOnlyElementEntry(
                    target = V2LayoutTarget.FLOOR,
                    itemKey = "floor:element:floor_sump_1",
                    itemLabel = "SU-1",
                    elementType = V2ElementType.SUMP,
                    ),
                    "Centre sump was visually satisfactory. UT scanning recorded lip thickness 7.75 mm to 10.89 mm, wall thickness 8.59 mm to 10.83 mm, and bottom thickness 7.76 mm to 11.13 mm.",
                    "Photo 57 - Centre sump visually satisfactory",
                ),
            ).forEach { finding ->
                putAll(listOf(finding))
            }
        },
    )

private fun v10ChecklistInProgressState(): V2InspectionChecklistState {
    val completedRatings = v10ChecklistRatings()
    val partialRatings = completedRatings.filterKeys { itemNumber ->
        itemNumber <= 96 || itemNumber in setOf(144, 145, 147, 152, 166, 167, 174, 175, 181, 194, 195)
    }
    return V2InspectionChecklistState(
        selectedSectionKey = "fixed_roof_internal",
        ratingsByItemNumber = partialRatings,
        sectionComments = v10ChecklistSectionComments(),
    )
}

private fun v10ChecklistCompletedState(): V2InspectionChecklistState =
    V2InspectionChecklistState(
        selectedSectionKey = "shell_internal",
        ratingsByItemNumber = v10ChecklistRatings(),
        sectionComments = v10ChecklistSectionComments(),
    )

private fun v10ChecklistRatings(): Map<Int, V2ChecklistRating> {
    val ratings = V2InspectionChecklistCatalog.sections
        .flatMap { section -> section.items }
        .associate { item -> item.number to V2ChecklistRating.GOOD }
        .toMutableMap()

    val overrides = mapOf(
        6 to V2ChecklistRating.SATISFACTORY,
        10 to V2ChecklistRating.SATISFACTORY,
        12 to V2ChecklistRating.SATISFACTORY,
        15 to V2ChecklistRating.SATISFACTORY,
        18 to V2ChecklistRating.SATISFACTORY,
        21 to V2ChecklistRating.SATISFACTORY,
        22 to V2ChecklistRating.NOT_APPLICABLE,
        23 to V2ChecklistRating.REQUIRES_REPAIR,
        24 to V2ChecklistRating.IMMEDIATE_ATTENTION,
        25 to V2ChecklistRating.SATISFACTORY,
        26 to V2ChecklistRating.NOT_TO_CODE,
        27 to V2ChecklistRating.REQUIRES_REPAIR,
        30 to V2ChecklistRating.NOT_APPLICABLE,
        31 to V2ChecklistRating.NOT_APPLICABLE,
        32 to V2ChecklistRating.SATISFACTORY,
        38 to V2ChecklistRating.NOT_TO_CODE,
        41 to V2ChecklistRating.SATISFACTORY,
        42 to V2ChecklistRating.NOT_TO_CODE,
        47 to V2ChecklistRating.SATISFACTORY,
        50 to V2ChecklistRating.SATISFACTORY,
        52 to V2ChecklistRating.NOT_APPLICABLE,
        53 to V2ChecklistRating.NOT_APPLICABLE,
        61 to V2ChecklistRating.NOT_APPLICABLE,
        63 to V2ChecklistRating.NOT_APPLICABLE,
        67 to V2ChecklistRating.NOT_TO_CODE,
        68 to V2ChecklistRating.SATISFACTORY,
        69 to V2ChecklistRating.SATISFACTORY,
        71 to V2ChecklistRating.SATISFACTORY,
        73 to V2ChecklistRating.NOT_TO_CODE,
        74 to V2ChecklistRating.SATISFACTORY,
        75 to V2ChecklistRating.SATISFACTORY,
        76 to V2ChecklistRating.SATISFACTORY,
        78 to V2ChecklistRating.SATISFACTORY,
        79 to V2ChecklistRating.SATISFACTORY,
        80 to V2ChecklistRating.SATISFACTORY,
        83 to V2ChecklistRating.SATISFACTORY,
        85 to V2ChecklistRating.NOT_TO_CODE,
        86 to V2ChecklistRating.NOT_TO_CODE,
        88 to V2ChecklistRating.SATISFACTORY,
        90 to V2ChecklistRating.SATISFACTORY,
        91 to V2ChecklistRating.SATISFACTORY,
        93 to V2ChecklistRating.NOT_APPLICABLE,
        94 to V2ChecklistRating.SATISFACTORY,
        96 to V2ChecklistRating.NOT_TO_CODE,
        144 to V2ChecklistRating.SATISFACTORY,
        145 to V2ChecklistRating.SATISFACTORY,
        147 to V2ChecklistRating.SATISFACTORY,
        152 to V2ChecklistRating.NOT_TO_CODE,
        166 to V2ChecklistRating.SATISFACTORY,
        167 to V2ChecklistRating.REQUIRES_REPAIR,
        168 to V2ChecklistRating.SATISFACTORY,
        173 to V2ChecklistRating.NOT_APPLICABLE,
        174 to V2ChecklistRating.REQUIRES_REPAIR,
        175 to V2ChecklistRating.SATISFACTORY,
        177 to V2ChecklistRating.SATISFACTORY,
        181 to V2ChecklistRating.SATISFACTORY,
        189 to V2ChecklistRating.SATISFACTORY,
        191 to V2ChecklistRating.SATISFACTORY,
        194 to V2ChecklistRating.SATISFACTORY,
        195 to V2ChecklistRating.REQUIRES_REPAIR,
    )
    ratings.putAll(overrides)
    (97..143).forEach { itemNumber ->
        ratings[itemNumber] = V2ChecklistRating.NOT_APPLICABLE
    }
    (153..165).forEach { itemNumber ->
        ratings[itemNumber] = V2ChecklistRating.NOT_APPLICABLE
    }
    return ratings
}

private fun v10ChecklistSectionComments(): Map<String, String> =
    mapOf(
        "diked_area" to "Pipework and supports were satisfactory overall, with localized coating failure and light surface corrosion on some pipework.",
        "tank_foundation" to "Tar edge sealant at the floor projection has extensively deteriorated and may allow water ingress beneath the floor edge.",
        "shell_external" to "The shell coating is weathered with isolated failures. Two significant buckling zones were observed on the south-southwest and west-southwest sectors along Courses 5 and 6.",
        "shell_appurtenances" to "Shell nozzles were satisfactory overall. Reinforcement pads were present, but tell-tale holes were not found on the pads.",
        "access_structure" to "The spiral stairway remains serviceable overall, but several treads are welded over shell butt joints and no safety drop bar or chain was present at the roof landing.",
        "fixed_roof_cone_dome" to "The fixed dome roof contains slight waviness. Coating failure with corrosion initiation was observed near roof sketch plate 53 and the curb angle joint is not frangible.",
        "roof_appurtenances" to "Roof manhole reinforcement was not provided as recommended by API. Roof nozzles were satisfactory overall with localized coating failure.",
        "roof_external_floater" to "Not applicable for V10 because the tank is recorded as a fixed dome roof.",
        "roof_external_floater_cont" to "Not applicable for V10 because the tank is recorded as a fixed dome roof.",
        "fixed_roof_internal" to "The roof underside is uncoated with general surface corrosion and scaling. Roof venting nozzles were not trimmed flush.",
        "roof_internal_floater" to "Not applicable for V10 because no internal floating roof is recorded.",
        "shell_internal" to "Only the first shell strake is coated internally. General corrosion, heavy scaling, and MPI-confirmed indications were observed in selected shell areas.",
        "floor_internal" to "The floor is cone-down and fully coated. Bubbling, historic weld-filled pitting, and localized underside corrosion indications were observed in accessible areas.",
    )

private fun measuredRegionEntry(
    target: V2LayoutTarget,
    itemLabel: String,
    readings: List<String>,
): Pair<String, V2UtMeasurementEntry> =
    "${target.key}:region:$itemLabel" to V2UtMeasurementEntry(
        itemKey = "${target.key}:region:$itemLabel",
        target = target,
        itemLabel = itemLabel,
        kind = V2UtItemKind.LAYOUT_REGION,
        readings = readings,
        confirmed = true,
    )

private fun measuredElementEntry(
    target: V2LayoutTarget,
    itemKey: String,
    itemLabel: String,
    elementType: V2ElementType,
    nozzleSize: String,
    reinforcementPadReading: String = "",
    readings: List<String>,
): Pair<String, V2UtMeasurementEntry> =
    itemKey to V2UtMeasurementEntry(
        itemKey = itemKey,
        target = target,
        itemLabel = itemLabel,
        kind = V2UtItemKind.ELEMENT,
        elementType = elementType,
        nozzleSize = nozzleSize,
        reinforcementPadReading = reinforcementPadReading,
        readings = readings,
        confirmed = true,
    )

private fun findingOnlyElementEntry(
    target: V2LayoutTarget,
    itemKey: String,
    itemLabel: String,
    elementType: V2ElementType,
): V2UtMeasurementEntry =
    V2UtMeasurementEntry(
        itemKey = itemKey,
        target = target,
        itemLabel = itemLabel,
        kind = V2UtItemKind.ELEMENT,
        elementType = elementType,
        nozzleSize = "N.A.",
        readings = emptyList(),
        confirmed = false,
    )

private fun findingEntry(
    entry: V2UtMeasurementEntry,
    note: String,
    vararg photoCaptions: String,
): Pair<String, V2FindingRecord> =
    photoCaptions.mapIndexed { index, caption ->
        mockFindingPhoto(entry.itemKey, index + 1, caption)
    }.let { photos ->
        entry.itemKey to V2FindingRecord(
            itemKey = entry.itemKey,
            target = entry.target,
            itemLabel = entry.itemLabel,
            itemKind = entry.kind,
            elementType = entry.elementType,
            note = note,
            photos = photos,
            selectedPhotoId = photos.firstOrNull()?.id,
        )
    }

private fun mockFindingPhoto(
    itemKey: String,
    index: Int,
    caption: String,
): V2FindingPhoto {
    val safeKey = itemKey.lowercase()
        .replace(Regex("[^a-z0-9]+"), "-")
        .trim('-')
    val id = "mock-$safeKey-$index"
    return V2FindingPhoto(
        id = id,
        relativePath = "v2-findings/mock/$id.png",
        displayName = caption,
    )
}

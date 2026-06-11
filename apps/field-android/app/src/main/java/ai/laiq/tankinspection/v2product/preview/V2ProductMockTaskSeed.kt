package ai.laiq.tankinspection.v2product.preview

import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.domain.model.RotationDirection
import ai.laiq.tankinspection.v2product.model.V2ChecklistRating
import ai.laiq.tankinspection.v2product.model.V2DraftState
import ai.laiq.tankinspection.v2product.model.V2ElementPlacementState
import ai.laiq.tankinspection.v2product.model.V2ElementSetup
import ai.laiq.tankinspection.v2product.model.V2ElementType
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
        state = V2DraftState(
            generalTankInfo = baseGeneralInfo(
                client = "Pacific Energy SWP Ltd",
                tankNumber = "TK-13",
                inspector = "Syed A. R. Balkhi",
                location = "Utulei Terminal, Pago Pago",
                height = "8.53",
                diameter = "24.384",
                courseNumber = "3",
                fieldLeaseName = "Pacific Energy Tank Program",
                productStored = "Diesel",
            ),
            layoutScope = V2LayoutScope(
                externalRoof = true,
                internalRoof = false,
                shell = true,
                floor = false,
            ),
            layoutMapSetup = V2LayoutMapSetup(
                selectedTarget = V2LayoutTarget.EXTERNAL_ROOF,
                selectedSurface = V2LayoutSurface.ROOF,
                referenceMode = V2ReferenceMode.TANK_NORTH,
                referenceNote = "Stair landing used as 0 degree reference.",
                rotationDirection = RotationDirection.CLOCKWISE,
                roofPattern = RoofTemplate.CONE_RADIAL,
                roofRingCount = "3",
                roofSectorCount = "20",
                shellCourseCount = "3",
                shellPlatesPerCourse = "12",
                shellLaneCount = "4",
                shellPlateOffset = "half_plate",
                shellOffsetStartRow = V2ShellOffsetStartRow.EVEN,
                approvedTargets = setOf(
                    V2LayoutTarget.EXTERNAL_ROOF,
                    V2LayoutTarget.SHELL,
                ),
            ),
            elementSetup = V2ElementSetup(
                externalRoof = true,
                internalRoof = false,
                shell = true,
                floor = false,
            ),
            elementPlacement = V2ElementPlacementState(
                selectedTarget = V2LayoutTarget.EXTERNAL_ROOF,
                selectedElementType = V2ElementType.NOZZLE,
                placementsByTarget = mapOf(
                    V2LayoutTarget.EXTERNAL_ROOF to listOf(
                        V2PlacedElement(
                            id = "external_roof_nozzle_1",
                            label = "NZ-1",
                            type = V2ElementType.NOZZLE,
                            normalizedX = 0.52f,
                            normalizedY = 0.26f,
                        ),
                        V2PlacedElement(
                            id = "external_roof_vent_1",
                            label = "VT-1",
                            type = V2ElementType.VENT,
                            normalizedX = 0.68f,
                            normalizedY = 0.44f,
                        ),
                    ),
                    V2LayoutTarget.SHELL to listOf(
                        V2PlacedElement(
                            id = "shell_stair_1",
                            label = "ST-1",
                            type = V2ElementType.STAIR,
                            normalizedX = 0.14f,
                            normalizedY = 0.60f,
                        ),
                    ),
                ),
                approvedTargets = setOf(
                    V2LayoutTarget.EXTERNAL_ROOF,
                    V2LayoutTarget.SHELL,
                ),
            ),
            utSetup = V2UtSetup(
                externalRoof = true,
                internalRoof = false,
                shell = true,
                floor = false,
            ),
            utMeasurements = V2UtMeasurementState(
                selectedTarget = V2LayoutTarget.EXTERNAL_ROOF,
                entriesByItemKey = mapOf(
                    regionEntry(
                        target = V2LayoutTarget.EXTERNAL_ROOF,
                        itemKey = "external_roof:region:R1-P03",
                        itemLabel = "Roof Plate R1-P03",
                        readings = listOf("6.2", "6.1", "6.1", "6.0", "6.0"),
                    ),
                    regionEntry(
                        target = V2LayoutTarget.EXTERNAL_ROOF,
                        itemKey = "external_roof:region:R2-P08",
                        itemLabel = "Roof Plate R2-P08",
                        readings = listOf("6.0", "6.0", "5.9", "5.9", "5.8"),
                    ),
                    elementEntry(
                        target = V2LayoutTarget.EXTERNAL_ROOF,
                        itemKey = "external_roof:element:external_roof_nozzle_1",
                        itemLabel = "NZ-1",
                        elementType = V2ElementType.NOZZLE,
                        nozzleSize = "8 in",
                        readings = listOf("6.4", "6.4", "6.3", "6.3"),
                    ),
                    regionEntry(
                        target = V2LayoutTarget.SHELL,
                        itemKey = "shell:region:C2-L03",
                        itemLabel = "Course 2 / Lane 3",
                        readings = listOf("7.1", "7.1", "7.0", "7.0", "6.9"),
                    ),
                ),
                approvedTargets = setOf(
                    V2LayoutTarget.EXTERNAL_ROOF,
                    V2LayoutTarget.SHELL,
                ),
            ),
            inspectionChecklist = partialChecklistState(),
        ),
        workflowScreen = V2WorkflowScreen.CHECKLIST,
    )

private fun exportReadySeed(): V2MockTaskSeed =
    V2MockTaskSeed(
        state = V2DraftState(
            generalTankInfo = baseGeneralInfo(
                client = "Pacific Energy SWP Ltd",
                tankNumber = "V10",
                inspector = "Syed A. R. Balkhi",
                location = "Vuda Terminal, Fiji",
                height = "14.535",
                diameter = "19.52",
                courseNumber = "8",
                fieldLeaseName = "Vuda Terminal",
                productStored = "PULP",
            ).copy(
                clientRepresentative = "Howard Ah Sam",
                jobNo = "22PE1-4",
                dateCompleted = "2022-07-22",
                yearBuilt = "1977",
                originalConstructionStd = "API 650",
                drawingRef = "22PE1-4-TK-V10",
                roofType = "Fixed Dome Roof",
                serviceHeight = "14.22",
                specificGravity = "1.00",
                floorPlateNumber = "35",
                roofPlateNumber = "59",
                windGirder = "0",
                annularPlateNumber = "0",
                stiffener = "no",
                previousExternal = "Pending confirmation",
                previousInternal = "Pending confirmation",
                previousBottom = "Pending confirmation",
            ),
            layoutScope = V2LayoutScope(
                externalRoof = false,
                internalRoof = false,
                shell = true,
                floor = false,
            ),
            layoutMapSetup = V2LayoutMapSetup(
                selectedTarget = V2LayoutTarget.SHELL,
                selectedSurface = V2LayoutSurface.SHELL,
                referenceMode = V2ReferenceMode.TANK_NORTH,
                referenceNote = "Nozzle N2 centerline marks tank north.",
                rotationDirection = RotationDirection.CLOCKWISE,
                roofPattern = RoofTemplate.CONE_RADIAL,
                roofRingCount = "4",
                roofSectorCount = "18",
                shellCourseCount = "8",
                shellPlatesPerCourse = "14",
                shellLaneCount = "1",
                shellPlateOffset = "half_plate",
                shellOffsetStartRow = V2ShellOffsetStartRow.EVEN,
                approvedTargets = setOf(
                    V2LayoutTarget.SHELL,
                ),
            ),
            elementSetup = V2ElementSetup(
                externalRoof = false,
                internalRoof = false,
                shell = true,
                floor = false,
            ),
            elementPlacement = V2ElementPlacementState(
                selectedTarget = V2LayoutTarget.SHELL,
                selectedElementType = V2ElementType.STAIR,
                placementsByTarget = mapOf(
                    V2LayoutTarget.SHELL to listOf(
                        V2PlacedElement(
                            id = "shell_stair_1",
                            label = "ST-1",
                            type = V2ElementType.STAIR,
                            normalizedX = 0.11f,
                            normalizedY = 0.66f,
                        ),
                        V2PlacedElement(
                            id = "shell_nozzle_2",
                            label = "N2",
                            type = V2ElementType.NOZZLE,
                            normalizedX = 0.73f,
                            normalizedY = 0.58f,
                        ),
                    ),
                ),
                approvedTargets = setOf(V2LayoutTarget.SHELL),
            ),
            utSetup = V2UtSetup(
                externalRoof = false,
                internalRoof = false,
                shell = true,
                floor = false,
            ),
            utMeasurements = V2UtMeasurementState(
                selectedTarget = V2LayoutTarget.SHELL,
                entriesByItemKey = mapOf(
                    regionEntry(
                        target = V2LayoutTarget.SHELL,
                        itemKey = "shell:region:C8-L01",
                        itemLabel = "Course 8 / Plate 1",
                        readings = listOf("2.4", "2.5", "2.6", "2.4", "2.5"),
                    ),
                    regionEntry(
                        target = V2LayoutTarget.SHELL,
                        itemKey = "shell:region:C7-L02",
                        itemLabel = "Course 7 / Plate 2",
                        readings = listOf("2.4", "2.5", "2.6", "2.5", "2.5"),
                    ),
                    regionEntry(
                        target = V2LayoutTarget.SHELL,
                        itemKey = "shell:region:C6-L07",
                        itemLabel = "Course 6 / Plate 7",
                        readings = listOf("2.5", "2.5", "2.7", "2.6", "2.5"),
                    ),
                    regionEntry(
                        target = V2LayoutTarget.SHELL,
                        itemKey = "shell:region:C5-L14",
                        itemLabel = "Course 5 / Plate 14",
                        readings = listOf("2.5", "2.6", "2.6", "2.6", "2.7"),
                    ),
                    regionEntry(
                        target = V2LayoutTarget.SHELL,
                        itemKey = "shell:region:C4-L11",
                        itemLabel = "Course 4 / Plate 11",
                        readings = listOf("4.5", "4.6", "4.7", "4.5", "4.6"),
                    ),
                ),
                approvedTargets = setOf(
                    V2LayoutTarget.SHELL,
                ),
            ),
            inspectionChecklist = completedChecklistState(
                sectionComments = mapOf(
                    "fixed_roof_cone_dome" to "Localized corrosion was observed on the underside of the roof near the curb angle.",
                    "shell_external" to "Product staining was observed externally at shell-to-curb angle weld locations.",
                ),
            ),
        ),
        workflowScreen = V2WorkflowScreen.CHECKLIST,
    )

private fun utInProgressSeed(): V2MockTaskSeed =
    V2MockTaskSeed(
        state = V2DraftState(
            generalTankInfo = baseGeneralInfo(
                client = "LAIQ Demo Tenant",
                tankNumber = "TK-204",
                inspector = "Field Reviewer",
                location = "Kerteh Terminal",
                height = "12.1",
                diameter = "31.5",
                courseNumber = "6",
                fieldLeaseName = "Coverage Sample",
                productStored = "Slops",
            ),
            layoutScope = V2LayoutScope(
                externalRoof = true,
                internalRoof = false,
                shell = true,
                floor = true,
            ),
            layoutMapSetup = V2LayoutMapSetup(
                selectedTarget = V2LayoutTarget.FLOOR,
                selectedSurface = V2LayoutSurface.FLOOR,
                referenceMode = V2ReferenceMode.TANK_NORTH,
                referenceNote = "Temporary datum set from shell stair support.",
                rotationDirection = RotationDirection.CLOCKWISE,
                roofPattern = RoofTemplate.CONE_RADIAL,
                roofRingCount = "4",
                roofSectorCount = "20",
                shellCourseCount = "6",
                shellPlatesPerCourse = "16",
                shellLaneCount = "4",
                shellPlateOffset = "half_plate",
                floorPlateCount = "20",
                floorAnnularSectionCount = "16",
                approvedTargets = setOf(
                    V2LayoutTarget.EXTERNAL_ROOF,
                    V2LayoutTarget.SHELL,
                    V2LayoutTarget.FLOOR,
                ),
            ),
            elementSetup = V2ElementSetup(
                externalRoof = true,
                internalRoof = false,
                shell = false,
                floor = false,
            ),
            elementPlacement = V2ElementPlacementState(
                selectedTarget = V2LayoutTarget.EXTERNAL_ROOF,
                selectedElementType = V2ElementType.MANHOLE,
                placementsByTarget = mapOf(
                    V2LayoutTarget.EXTERNAL_ROOF to listOf(
                        V2PlacedElement(
                            id = "external_roof_manhole_1",
                            label = "MH-1",
                            type = V2ElementType.MANHOLE,
                            normalizedX = 0.48f,
                            normalizedY = 0.18f,
                        ),
                    ),
                ),
                approvedTargets = setOf(V2LayoutTarget.EXTERNAL_ROOF),
            ),
            utSetup = V2UtSetup(
                externalRoof = true,
                internalRoof = false,
                shell = true,
                floor = true,
            ),
            utMeasurements = V2UtMeasurementState(
                selectedTarget = V2LayoutTarget.FLOOR,
                entriesByItemKey = mapOf(
                    regionEntry(
                        target = V2LayoutTarget.EXTERNAL_ROOF,
                        itemKey = "external_roof:region:R2-P04",
                        itemLabel = "Roof Plate R2-P04",
                        readings = listOf("6.0", "6.0", "5.9", "5.9", "5.9"),
                    ),
                    regionEntry(
                        target = V2LayoutTarget.SHELL,
                        itemKey = "shell:region:C4-L08",
                        itemLabel = "Course 4 / Lane 8",
                        readings = listOf("7.4", "7.3", "7.3", "7.2", "7.2"),
                    ),
                ),
                approvedTargets = setOf(V2LayoutTarget.EXTERNAL_ROOF),
            ),
            inspectionChecklist = V2InspectionChecklistState(),
        ),
        workflowScreen = V2WorkflowScreen.UT_MEASUREMENT,
    )

private fun baseGeneralInfo(
    client: String,
    tankNumber: String,
    inspector: String,
    location: String,
    height: String,
    diameter: String,
    courseNumber: String,
    fieldLeaseName: String,
    productStored: String,
): V2GeneralTankInfo =
    V2GeneralTankInfo(
        client = client,
        tankNumber = tankNumber,
        inspector = inspector,
        location = location,
        height = height,
        diameter = diameter,
        courseNumber = courseNumber,
        fieldLeaseName = fieldLeaseName,
        productStored = productStored,
        clientRepresentative = "Operations Team",
        jobNo = "MOCK-${tankNumber}",
        dateCompleted = "2026-06-10",
        yearBuilt = "2010",
        originalManufacturer = "LAIQ Mock Shop",
        originalConstructionStd = "API 650",
        materialSpec = "Carbon Steel",
        drawingRef = "DWG-$tankNumber",
        roofType = "Cone Roof",
        externalRoofType = "yes",
        internalRoofType = "no",
        serviceHeight = height,
        specificGravity = "0.88",
        designTemp = "65 C",
        internalPressure = "Atmospheric",
        floorPlateNumber = "18",
        roofPlateNumber = "20",
        floorPlateThickness = "6 mm",
        windGirder = "2",
        annularPlateNumber = "14",
        insulated = "no",
        annularPlateThickness = "8 mm",
        stiffener = "yes",
    )

private fun regionEntry(
    target: V2LayoutTarget,
    itemKey: String,
    itemLabel: String,
    readings: List<String>,
): Pair<String, V2UtMeasurementEntry> =
    itemKey to V2UtMeasurementEntry(
        itemKey = itemKey,
        target = target,
        itemLabel = itemLabel,
        kind = V2UtItemKind.LAYOUT_REGION,
        readings = readings,
        confirmed = true,
    )

private fun elementEntry(
    target: V2LayoutTarget,
    itemKey: String,
    itemLabel: String,
    elementType: V2ElementType,
    nozzleSize: String,
    readings: List<String>,
): Pair<String, V2UtMeasurementEntry> =
    itemKey to V2UtMeasurementEntry(
        itemKey = itemKey,
        target = target,
        itemLabel = itemLabel,
        kind = V2UtItemKind.ELEMENT,
        elementType = elementType,
        nozzleSize = nozzleSize,
        readings = readings,
        confirmed = true,
    )

private fun partialChecklistState(): V2InspectionChecklistState {
    val orderedItems = V2InspectionChecklistCatalog.sections.flatMap { section -> section.items.map { item -> item.number } }
    val seededRatings = orderedItems.take(14).associateWith { itemNumber ->
        when {
            itemNumber % 7 == 0 -> V2ChecklistRating.SATISFACTORY
            itemNumber % 5 == 0 -> V2ChecklistRating.NOT_TO_CODE
            else -> V2ChecklistRating.GOOD
        }
    }
    return V2InspectionChecklistState(
        selectedSectionKey = "diked_area",
        ratingsByItemNumber = seededRatings,
        sectionComments = mapOf(
            "diked_area" to "Early mock data seeded for checklist review and spacing checks.",
            "tank_foundation" to "Foundation items not fully rated yet.",
        ),
    )
}

private fun completedChecklistState(
    sectionComments: Map<String, String>,
): V2InspectionChecklistState {
    val seededRatings = V2InspectionChecklistCatalog.sections
        .flatMap { section -> section.items }
        .associate { item ->
            val rating = when {
                item.number % 29 == 0 -> V2ChecklistRating.REQUIRES_REPAIR
                item.number % 13 == 0 -> V2ChecklistRating.SATISFACTORY
                item.number % 17 == 0 -> V2ChecklistRating.NOT_TO_CODE
                else -> V2ChecklistRating.GOOD
            }
            item.number to rating
        }
    return V2InspectionChecklistState(
        selectedSectionKey = "fixed_roof_cone_dome",
        ratingsByItemNumber = seededRatings,
        sectionComments = sectionComments,
    )
}

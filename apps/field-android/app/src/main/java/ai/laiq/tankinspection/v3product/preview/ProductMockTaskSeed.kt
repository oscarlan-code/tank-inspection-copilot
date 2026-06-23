package ai.laiq.tankinspection.v3product.preview

import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.domain.model.RotationDirection
import ai.laiq.tankinspection.v3product.model.ProductChecklistRating
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularPlate
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularPlateLayout
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularPlateRow
import ai.laiq.tankinspection.v3product.model.ProductDraftState
import ai.laiq.tankinspection.v3product.model.ProductElementPlacementState
import ai.laiq.tankinspection.v3product.model.ProductElementSetup
import ai.laiq.tankinspection.v3product.model.ProductElementType
import ai.laiq.tankinspection.v3product.model.ProductFindingPhoto
import ai.laiq.tankinspection.v3product.model.ProductFindingRecord
import ai.laiq.tankinspection.v3product.model.ProductFindingState
import ai.laiq.tankinspection.v3product.model.ProductFloorTemplate
import ai.laiq.tankinspection.v3product.model.ProductGeneralTankInfo
import ai.laiq.tankinspection.v3product.model.ProductInspectionChecklistCatalog
import ai.laiq.tankinspection.v3product.model.ProductInspectionChecklistState
import ai.laiq.tankinspection.v3product.model.ProductLayoutMapSetup
import ai.laiq.tankinspection.v3product.model.ProductLayoutScope
import ai.laiq.tankinspection.v3product.model.ProductLayoutSurface
import ai.laiq.tankinspection.v3product.model.ProductLayoutTarget
import ai.laiq.tankinspection.v3product.model.ProductPlacedElement
import ai.laiq.tankinspection.v3product.model.ProductReferenceMode
import ai.laiq.tankinspection.v3product.model.ProductShellOffsetStartRow
import ai.laiq.tankinspection.v3product.model.ProductShellThirdOffsetStart
import ai.laiq.tankinspection.v3product.model.ProductUtItemKind
import ai.laiq.tankinspection.v3product.model.ProductUtMeasurementEntry
import ai.laiq.tankinspection.v3product.model.ProductUtMeasurementState
import ai.laiq.tankinspection.v3product.model.ProductUtSetup
import ai.laiq.tankinspection.v3product.model.ProductVoiceNote
import ai.laiq.tankinspection.v3product.storage.ProductWorkflowScreen

internal data class ProductMockTaskSeed(
    val state: ProductDraftState,
    val workflowScreen: ProductWorkflowScreen,
)

internal fun productMockTaskSeeds(): List<ProductMockTaskSeed> = listOf(
    elementPlacementReviewSeed(),
    utInProgressSeed(),
    checklistInProgressSeed(),
    exportReadySeed(),
)

internal fun productApiStandardV10Seed(): ProductMockTaskSeed = exportReadySeed()

private fun elementPlacementReviewSeed(): ProductMockTaskSeed {
    val baseState = v10ReportAlignedBaseState()
    return ProductMockTaskSeed(
        state = baseState.copy(
            elementPlacement = baseState.elementPlacement.copy(
                selectedTarget = ProductLayoutTarget.SHELL,
                // Roof is already confirmed; shell is placed for user review before UT starts.
                approvedTargets = setOf(ProductLayoutTarget.EXTERNAL_ROOF),
            ),
        ),
        workflowScreen = ProductWorkflowScreen.ELEMENT_PLACEMENT,
    )
}

private fun checklistInProgressSeed(): ProductMockTaskSeed =
    ProductMockTaskSeed(
        state = v10ReportAlignedBaseState().copy(
            utMeasurements = v10UtMeasurementsCompleted(),
            inspectionChecklist = v10ChecklistInProgressState(),
            findingState = v10FindingStateReady(),
        ),
        workflowScreen = ProductWorkflowScreen.CHECKLIST,
    )

private fun exportReadySeed(): ProductMockTaskSeed =
    ProductMockTaskSeed(
        state = v10ReportAlignedBaseState().copy(
            utMeasurements = v10UtMeasurementsCompleted(),
            inspectionChecklist = v10ChecklistCompletedState(),
            findingState = v10FindingStateReady(),
        ),
        workflowScreen = ProductWorkflowScreen.CHECKLIST,
    )

private fun utInProgressSeed(): ProductMockTaskSeed =
    ProductMockTaskSeed(
        state = v10ReportAlignedBaseState().copy(
            utMeasurements = v10UtMeasurementsInProgress(),
            inspectionChecklist = ProductInspectionChecklistState(selectedSectionKey = "fixed_roof_cone_dome"),
            findingState = v10FindingStateInProgress(),
        ),
        workflowScreen = ProductWorkflowScreen.UT_MEASUREMENT,
    )

private fun v10ReportAlignedBaseState(): ProductDraftState =
    ProductDraftState(
        generalTankInfo = v10GeneralInfo(),
        layoutScope = ProductLayoutScope(
            externalRoof = true,
            internalRoof = false,
            shell = true,
            floor = false,
        ),
        layoutMapSetup = ProductLayoutMapSetup(
            selectedTarget = ProductLayoutTarget.SHELL,
            selectedSurface = ProductLayoutSurface.SHELL,
            referenceMode = ProductReferenceMode.TANK_NORTH,
            referenceNote = "0° reference taken from nozzle N2 centerline, matching the approved training sketch convention.",
            rotationDirection = RotationDirection.CLOCKWISE,
            roofPattern = RoofTemplate.CIRCULAR_PLATE,
            roofRowCount = "13",
            roofWidestRowPlateCount = "7",
            roofHasCenterOpening = false,
            roofCenterOpeningPlateCount = "0",
            roofHasAnnularRing = false,
            roofAnnularSectionCount = "0",
            shellCourseCount = "8",
            shellPlatesPerCourse = "9",
            shellLaneCount = "4",
            shellPlateOffset = "third_plate",
            shellOffsetStartRow = ProductShellOffsetStartRow.EVEN,
            shellThirdOffsetStart = ProductShellThirdOffsetStart.FULL,
            floorTemplate = ProductFloorTemplate.CIRCULAR_PLATE,
            floorPlateCount = "35",
            floorAnnularSectionCount = "0",
            floorPatternCountX = "6",
            floorPatternCountY = "6",
            approvedTargets = setOf(
                ProductLayoutTarget.EXTERNAL_ROOF,
                ProductLayoutTarget.SHELL,
            ),
            customCircularLayoutsByTarget = mapOf(
                ProductLayoutTarget.EXTERNAL_ROOF to v10RoofReportCircularLayout(),
            ),
        ),
        elementSetup = ProductElementSetup(
            externalRoof = true,
            internalRoof = false,
            shell = true,
            floor = false,
        ),
        elementPlacement = ProductElementPlacementState(
            selectedTarget = ProductLayoutTarget.SHELL,
            selectedElementType = ProductElementType.STAIR,
            placementsByTarget = mapOf(
                ProductLayoutTarget.EXTERNAL_ROOF to v10RoofPlacements(),
                ProductLayoutTarget.SHELL to v10ShellPlacements(),
            ),
            approvedTargets = setOf(
                ProductLayoutTarget.EXTERNAL_ROOF,
                ProductLayoutTarget.SHELL,
            ),
        ),
        utSetup = ProductUtSetup(
            externalRoof = true,
            internalRoof = false,
            shell = true,
            floor = false,
        ),
        voiceNotes = v10VoiceNotes(),
    )

private fun v10RoofReportCircularLayout(): ProductCustomCircularPlateLayout =
    ProductCustomCircularPlateLayout(
        rows = listOf(
            v10RoofReportRow(1, 1f, 1f, 1f, 1f, 0.82f, 1f, 1f),
            v10RoofReportRow(2, 0.74f, 1.28f, 1.76f, 0.74f),
            v10RoofReportRow(3, 0.95f, 1.45f, 0.95f),
            v10RoofReportRow(4, 0.78f, 1.35f, 1.35f, 0.78f),
            v10RoofReportRow(5, 0.68f, 1.08f, 1.72f, 1.08f, 0.68f),
            v10RoofReportRow(6, 0.72f, 1.48f, 1.14f, 0.82f),
            v10RoofReportRow(7, 1.08f, 1.16f, 0.42f, 1.34f, 1.02f),
            v10RoofReportRow(8, 0.78f, 1.35f, 1.35f, 0.78f),
            v10RoofReportRow(9, 0.58f, 1.28f, 1.46f, 1.24f, 0.58f),
            v10RoofReportRow(10, 0.9f, 1.22f, 1.5f, 0.82f),
            v10RoofReportRow(11, 0.98f, 1.36f, 0.98f),
            v10RoofReportRow(12, 0.58f, 1.32f, 1.48f, 0.72f),
            v10RoofReportRow(13, 0.62f, 0.88f, 1f, 1f, 1f, 1f, 0.62f),
        ),
    )

private fun v10RoofReportRow(
    rowNumber: Int,
    vararg widthWeights: Float,
): ProductCustomCircularPlateRow =
    ProductCustomCircularPlateRow(
        rowNumber = rowNumber,
        plates = widthWeights.map { widthWeight ->
            ProductCustomCircularPlate(widthWeight = widthWeight)
        },
    )

private fun v10RoofPlacements(): List<ProductPlacedElement> =
    listOf(
        ProductPlacedElement(
            id = "external_roof_manhole_1",
            label = "MH-1",
            type = ProductElementType.MANHOLE,
            normalizedX = 0.50f,
            normalizedY = 0.18f,
        ),
        ProductPlacedElement(
            id = "external_roof_nozzle_r1",
            label = "R1",
            type = ProductElementType.NOZZLE,
            normalizedX = 0.56f,
            normalizedY = 0.11f,
        ),
        ProductPlacedElement(
            id = "external_roof_nozzle_r2",
            label = "R2",
            type = ProductElementType.NOZZLE,
            normalizedX = 0.25f,
            normalizedY = 0.37f,
        ),
        ProductPlacedElement(
            id = "external_roof_nozzle_r3",
            label = "R3",
            type = ProductElementType.NOZZLE,
            normalizedX = 0.14f,
            normalizedY = 0.44f,
        ),
        ProductPlacedElement(
            id = "external_roof_nozzle_r4",
            label = "R4",
            type = ProductElementType.NOZZLE,
            normalizedX = 0.48f,
            normalizedY = 0.44f,
        ),
        ProductPlacedElement(
            id = "external_roof_nozzle_r5",
            label = "R5",
            type = ProductElementType.NOZZLE,
            normalizedX = 0.50f,
            normalizedY = 0.50f,
        ),
        ProductPlacedElement(
            id = "external_roof_nozzle_r6",
            label = "R6",
            type = ProductElementType.NOZZLE,
            normalizedX = 0.53f,
            normalizedY = 0.57f,
        ),
        ProductPlacedElement(
            id = "external_roof_nozzle_r7",
            label = "R7",
            type = ProductElementType.NOZZLE,
            normalizedX = 0.78f,
            normalizedY = 0.63f,
        ),
        ProductPlacedElement(
            id = "external_roof_nozzle_r8",
            label = "R8",
            type = ProductElementType.NOZZLE,
            normalizedX = 0.45f,
            normalizedY = 0.90f,
        ),
        ProductPlacedElement(
            id = "external_roof_nozzle_r9",
            label = "R9",
            type = ProductElementType.NOZZLE,
            normalizedX = 0.58f,
            normalizedY = 0.18f,
        ),
        ProductPlacedElement(
            id = "external_roof_vent_1",
            label = "VT-1",
            type = ProductElementType.VENT,
            normalizedX = 0.50f,
            normalizedY = 0.50f,
        ),
    )

private fun v10ShellPlacements(): List<ProductPlacedElement> =
    listOf(
        ProductPlacedElement(
            id = "shell_stair_origin",
            label = "ST-O",
            type = ProductElementType.STAIR,
            normalizedX = 0.19f,
            normalizedY = 0.83f,
        ),
        ProductPlacedElement(
            id = "shell_stair_termination",
            label = "ST-T",
            type = ProductElementType.STAIR,
            normalizedX = 0.89f,
            normalizedY = 0.22f,
        ),
        ProductPlacedElement(
            id = "shell_nozzle_s1",
            label = "S1",
            type = ProductElementType.NOZZLE,
            normalizedX = 0.5326044f,
            normalizedY = 0.94f,
        ),
        ProductPlacedElement(
            id = "shell_nozzle_s2",
            label = "S2",
            type = ProductElementType.NOZZLE,
            normalizedX = 0.27807635f,
            normalizedY = 0.91787046f,
        ),
        ProductPlacedElement(
            id = "shell_nozzle_s3",
            label = "S3",
            type = ProductElementType.NOZZLE,
            normalizedX = 0.16708927f,
            normalizedY = 0.9223659f,
        ),
        ProductPlacedElement(
            id = "shell_nozzle_s4",
            label = "S4",
            type = ProductElementType.NOZZLE,
            normalizedX = 0.19699466f,
            normalizedY = 0.8938691f,
        ),
        ProductPlacedElement(
            id = "shell_nozzle_s5",
            label = "S5",
            type = ProductElementType.NOZZLE,
            normalizedX = 0.2119757f,
            normalizedY = 0.92107546f,
        ),
        ProductPlacedElement(
            id = "shell_nozzle_s6",
            label = "S6",
            type = ProductElementType.NOZZLE,
            normalizedX = 0.19604945f,
            normalizedY = 0.94f,
        ),
        ProductPlacedElement(
            id = "shell_nozzle_s7",
            label = "S7",
            type = ProductElementType.NOZZLE,
            normalizedX = 0.94f,
            normalizedY = 0.93008655f,
        ),
    )

private fun v10FloorPlacements(): List<ProductPlacedElement> =
    listOf(
        ProductPlacedElement(
            id = "floor_sump_1",
            label = "SU-1",
            type = ProductElementType.SUMP,
            normalizedX = 0.50f,
            normalizedY = 0.52f,
        ),
        ProductPlacedElement(
            id = "floor_datum_1",
            label = "RF-1",
            type = ProductElementType.DATUM,
            normalizedX = 0.78f,
            normalizedY = 0.50f,
        ),
    )

private fun v10GeneralInfo(): ProductGeneralTankInfo =
    ProductGeneralTankInfo(
        client = "Demo Energy Storage Ltd",
        clientRepresentative = "Demo Operations Representative",
        jobNo = "DEMO-API653-001",
        tankNumber = "D10",
        dateCompleted = "2022-07-22",
        inspector = "Demo Inspector",
        location = "North Coast Training Yard",
        fieldLeaseName = "Training Terminal A",
        yearBuilt = "1977",
        originalManufacturer = "Not Provided",
        originalConstructionStd = "Not Provided",
        materialSpec = "Carbon Steel Unknown Grade",
        drawingRef = "Training Drawing Pack",
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
        previousExternal = "Synthetic history reference for training only",
        previousInternal = "Synthetic history reference for training only",
        previousBottom = "Synthetic history reference for training only",
    )

private fun v10VoiceNotes(): List<ProductVoiceNote> =
    listOf(
        v10VoiceNote(
            idSuffix = "site-start",
            screen = ProductWorkflowScreen.GENERAL_INFO,
            capturedAtIso = "2022-07-18T08:35:00+12:00",
            durationMs = 34_000,
            transcript = v10Transcript(
                "Starting field capture for Demo Energy Storage tank D10 at Training Terminal A.",
                "I am treating this as an internal and external inspection with roof, shell, floor, nozzle, appurtenance, and selected MPI checks.",
                "Tank is a fixed dome roof unit, eight shell courses, cone down floor, and the main concern today is to keep the roof and shell observations tied to the exact plate and element locations.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "dike-foundation-walkdown",
            screen = ProductWorkflowScreen.CHECKLIST,
            cardKey = "checklist_item",
            fieldKey = "checklist_item_note",
            itemKey = "checklist:1",
            itemLabel = "Dike and foundation walkdown",
            capturedAtIso = "2022-07-18T08:48:00+12:00",
            durationMs = 39_000,
            transcript = v10Transcript(
                "Dike wall and grassed area look generally satisfactory from the walkdown.",
                "The drain has debris and standing water, so I am marking drainage and housekeeping for cleanup.",
                "Foundation shoulder concrete is generally sound with minor cracking, but the tar seal at the floor edge projection has deteriorated and may allow water ingress under the tank bottom.",
                "Shell-to-floor weld coating was not removed here, so MPI cannot be completed on that weld at this stage.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "layout-map",
            screen = ProductWorkflowScreen.LAYOUT_MAP_SETUP,
            cardKey = "roof_layout_map",
            fieldKey = "layout_note",
            target = ProductLayoutTarget.EXTERNAL_ROOF,
            capturedAtIso = "2022-07-18T09:05:00+12:00",
            durationMs = 42_000,
            transcript = v10Transcript(
                "I have set the north reference and laid out the roof plates row by row before starting readings.",
                "There are fifty-nine roof plates in this map, with small edge plates at the top and bottom and the nozzle markers placed against the plate numbers.",
                "For the shell unwrap I am using eight courses and nine plates per course, with the offset adjusted so the south, east, north, west, and south references line up with the field orientation.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "roof-elements",
            screen = ProductWorkflowScreen.ELEMENT_PLACEMENT,
            cardKey = "element_edit",
            fieldKey = "element_note",
            target = ProductLayoutTarget.EXTERNAL_ROOF,
            capturedAtIso = "2022-07-18T09:32:00+12:00",
            durationMs = 43_000,
            transcript = v10Transcript(
                "Roof appurtenances are now positioned on the plate map.",
                "R1 and R9 sit near the upper roof sector, R2 is near plate 20, R3 near plate 27, R4 near the plate 26 and 30 boundary, R5 at plate 30, R6 near plate 34, R7 near plates 40 to 41, and R8 near plate 55.",
                "I am also marking the visible welded patch plates as square patch markers so they stay traceable during review.",
                "The roof manhole needs a separate finding because I do not see a reinforcement plate around it.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "shell-elements",
            screen = ProductWorkflowScreen.ELEMENT_PLACEMENT,
            cardKey = "element_edit",
            fieldKey = "element_note",
            target = ProductLayoutTarget.SHELL,
            capturedAtIso = "2022-07-18T10:02:00+12:00",
            durationMs = 41_000,
            transcript = v10Transcript(
                "Shell appurtenances are mostly on the lower course, with the small nozzles near the stair origin and the larger nozzles spaced along the shell.",
                "S1 is the twenty-four inch nozzle near the lower middle of the shell map, S7 is the twenty-four inch nozzle near the far right, and S2 through S6 are grouped toward the stair origin side.",
                "I am keeping S7 on the map as a placed field element even though the UT set I am entering today is focused on S1 through S6.",
                "All shell nozzle pads need attention for missing tell-tale holes.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "access-structure",
            screen = ProductWorkflowScreen.CHECKLIST,
            cardKey = "checklist_item",
            fieldKey = "checklist_item_note",
            target = ProductLayoutTarget.SHELL,
            itemKey = "checklist:64",
            itemLabel = "Access structure",
            capturedAtIso = "2022-07-18T10:18:00+12:00",
            durationMs = 37_000,
            transcript = v10Transcript(
                "Access to the roof is by the spiral stairway at the southeast shell sector.",
                "The stairway steel is generally satisfactory, with minor coating failure on the stringers and handrails.",
                "Some shell mounted treads are welded close to or within shell butt-welded joint areas, so I am marking that as a code-spacing concern.",
                "No safety drop bar or chain is present at the top landing, so that needs to be captured for personnel protection.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "roof-ut-overview",
            screen = ProductWorkflowScreen.UT_MEASUREMENT,
            cardKey = "ut_measurement_card",
            fieldKey = "ut_note",
            target = ProductLayoutTarget.EXTERNAL_ROOF,
            capturedAtIso = "2022-07-19T08:55:00+12:00",
            durationMs = 44_000,
            transcript = v10Transcript(
                "Roof UT spot readings are being taken at five positions per plate using the A through E pattern.",
                "The low roof readings I am seeing are around three point five three millimetres at the weaker spots, while most readings are in the four millimetre range.",
                "The coating is generally intact but there are spot coating failures, early corrosion, and several existing welded patches that need to stay visible on the plate map.",
                "No obvious active leak is seen on the roof surface during this pass.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "roof-r1-ut",
            screen = ProductWorkflowScreen.UT_MEASUREMENT,
            cardKey = "ut_measurement_card",
            fieldKey = "ut_note",
            target = ProductLayoutTarget.EXTERNAL_ROOF,
            itemKey = "external_roof:element:external_roof_nozzle_r1",
            itemLabel = "R1",
            capturedAtIso = "2022-07-19T09:18:00+12:00",
            durationMs = 30_000,
            transcript = v10Transcript(
                "R1 is a four inch roof nozzle and I have completed the four clock-position UT readings.",
                "Readings are six point seven seven, six point six five, six point three one, and six point four six millimetres.",
                "The reinforcement pad reading is six point seven three millimetres.",
                "General condition is acceptable, with only minor coating breakdown starting around some roof nozzle areas.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "roof-plate-53",
            screen = ProductWorkflowScreen.FINDINGS,
            cardKey = "finding_capture",
            fieldKey = "finding_note",
            target = ProductLayoutTarget.EXTERNAL_ROOF,
            itemKey = "external_roof:region:53",
            itemLabel = "Roof plate 53",
            capturedAtIso = "2022-07-19T10:04:00+12:00",
            durationMs = 35_000,
            transcript = v10Transcript(
                "At roof plate 53 on the south sector, I can see coating failure and corrosion starting along the roof-to-curb angle weld.",
                "No leak was detected during the inspection.",
                "I am taking a close photo and marking this as a roof-to-curb corrosion finding.",
                "The curb angle weld is heavy and this joint should also be considered when checking the tank breathing and emergency venting condition.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "roof-manhole",
            screen = ProductWorkflowScreen.FINDINGS,
            cardKey = "finding_capture",
            fieldKey = "finding_note",
            target = ProductLayoutTarget.EXTERNAL_ROOF,
            itemKey = "external_roof:element:external_roof_manhole_1",
            itemLabel = "MH-1",
            capturedAtIso = "2022-07-19T10:22:00+12:00",
            durationMs = 27_000,
            transcript = v10Transcript(
                "Roof manhole cover is removed for inspection and I do not see a reinforcement plate around the manhole opening.",
                "I am flagging this as a finding against the roof appurtenance check.",
                "This is not a thickness reading issue; it needs to be carried as a reinforcement and code compliance item.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "roof-internal",
            screen = ProductWorkflowScreen.CHECKLIST,
            cardKey = "checklist_item",
            fieldKey = "checklist_item_note",
            target = ProductLayoutTarget.INTERNAL_ROOF,
            itemKey = "checklist:144",
            itemLabel = "Fixed roof internal",
            capturedAtIso = "2022-07-19T11:10:00+12:00",
            durationMs = 36_000,
            transcript = v10Transcript(
                "Roof underside is being observed from the tank bottom.",
                "The underside appears uncoated with general surface corrosion and some scaling.",
                "Roof rafters also show surface corrosion and scaling in places.",
                "The roof venting nozzles are not trimmed flush, so I am marking that under the fixed roof internal checklist.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "shell-ut-overview",
            screen = ProductWorkflowScreen.UT_MEASUREMENT,
            cardKey = "ut_measurement_card",
            fieldKey = "ut_note",
            target = ProductLayoutTarget.SHELL,
            capturedAtIso = "2022-07-20T08:40:00+12:00",
            durationMs = 48_000,
            transcript = v10Transcript(
                "Shell UT crawler readings are being captured by course and compass direction.",
                "The main thickness concern is the south side on the fifth and sixth courses, especially around the horizontal weld band.",
                "Course five south is down around four point five two millimetres at the minimum, and course six south has a local minimum around three point five zero millimetres.",
                "Other shell directions are generally higher, but I am keeping the south sector marked for repair review and closer inspection.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "shell-area-1",
            screen = ProductWorkflowScreen.FINDINGS,
            cardKey = "finding_capture",
            fieldKey = "finding_note",
            target = ProductLayoutTarget.SHELL,
            itemKey = "shell:region:L3-C6",
            itemLabel = "Shell L3-C6",
            capturedAtIso = "2022-07-20T09:15:00+12:00",
            durationMs = 46_000,
            transcript = v10Transcript(
                "Area 1 at the south-southwest shell is visibly buckled along the fifth and sixth course horizontal weld band.",
                "There are welded patch plates in this area and the patches overlap, so I am marking this as not to code.",
                "External continuous scan found a very low local thickness, about two point two eight millimetres at the minimum in the scanned area.",
                "From the inside, there are two short linear indications near the weld, about thirty millimetres each, and I am marking this location for weld repair.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "shell-area-2",
            screen = ProductWorkflowScreen.FINDINGS,
            cardKey = "finding_capture",
            fieldKey = "finding_note",
            target = ProductLayoutTarget.SHELL,
            itemKey = "shell:region:L4-C6",
            itemLabel = "Shell L4-C6",
            capturedAtIso = "2022-07-20T09:46:00+12:00",
            durationMs = 43_000,
            transcript = v10Transcript(
                "Area 2 at the west-southwest shell also shows buckling around the fifth and sixth course weld band.",
                "I can see linear paint cracking near the previous soft-patched leak location.",
                "After removing coating on the selected weld length, MPI did not show a linear indication on the external weld surface.",
                "From the internal side there is a through-hole about five millimetres diameter, roughly five hundred millimetres away from the temporarily sealed pinhole, so this still needs repair attention.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "shell-area-3",
            screen = ProductWorkflowScreen.FINDINGS,
            cardKey = "finding_capture",
            fieldKey = "finding_note",
            target = ProductLayoutTarget.SHELL,
            itemKey = "shell:region:L3-C5",
            itemLabel = "Shell L3-C5",
            capturedAtIso = "2022-07-20T10:18:00+12:00",
            durationMs = 42_000,
            transcript = v10Transcript(
                "Area 3 is at the internal horizontal weld between the fourth and fifth courses.",
                "After scale removal, there is significant metal loss and a continuous linear indication around two metres long.",
                "Scattered pitting is present around this location, with pits up to about three point five millimetres deep.",
                "External scan minimum is around three point seven six millimetres, so I am tying this field note to both the UT scan and MPI confirmation.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "shell-area-4",
            screen = ProductWorkflowScreen.FINDINGS,
            cardKey = "finding_capture",
            fieldKey = "finding_note",
            target = ProductLayoutTarget.SHELL,
            itemKey = "shell:region:L4-C5",
            itemLabel = "Shell L4-C5",
            capturedAtIso = "2022-07-20T10:36:00+12:00",
            durationMs = 37_000,
            transcript = v10Transcript(
                "Area 4 is another internal horizontal weld location between the fourth and fifth courses.",
                "The surface has significant metal loss after blasting, and MPI confirms a continuous indication about two metres long.",
                "Pitting is scattered around the weld area, generally up to about three millimetres deep.",
                "External scan minimum is around three point seven two millimetres, so I am marking this for weld build-up and follow-up inspection.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "shell-area-5",
            screen = ProductWorkflowScreen.FINDINGS,
            cardKey = "finding_capture",
            fieldKey = "finding_note",
            target = ProductLayoutTarget.SHELL,
            itemKey = "shell:region:L5-C3",
            itemLabel = "Shell L5-C3",
            capturedAtIso = "2022-07-20T10:48:00+12:00",
            durationMs = 29_000,
            transcript = v10Transcript(
                "Area 5 is around the horizontal weld between the second and third courses.",
                "There is slight metal loss here but I do not see cracking at this location.",
                "The external scan minimum is about five point zero zero millimetres, so I am recording this as a monitored area rather than the main repair priority.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "shell-s1-ut",
            screen = ProductWorkflowScreen.UT_MEASUREMENT,
            cardKey = "ut_measurement_card",
            fieldKey = "ut_note",
            target = ProductLayoutTarget.SHELL,
            itemKey = "shell:element:shell_nozzle_s1",
            itemLabel = "S1",
            capturedAtIso = "2022-07-20T11:05:00+12:00",
            durationMs = 31_000,
            transcript = v10Transcript(
                "S1 is the twenty-four inch shell nozzle.",
                "Clock position readings are twelve point three zero, twelve point one five, ten point eight zero, and eleven point two six millimetres.",
                "The reinforcement pad reads thirteen point nine one millimetres.",
                "Pad is fitted, but I do not see a tell-tale hole, same as the other shell nozzle pads.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "shell-s5-ut",
            screen = ProductWorkflowScreen.UT_MEASUREMENT,
            cardKey = "ut_measurement_card",
            fieldKey = "ut_note",
            target = ProductLayoutTarget.SHELL,
            itemKey = "shell:element:shell_nozzle_s5",
            itemLabel = "S5",
            capturedAtIso = "2022-07-20T11:21:00+12:00",
            durationMs = 33_000,
            transcript = v10Transcript(
                "S5 is an eight inch shell nozzle.",
                "The twelve, three, and six o'clock positions are patched, so I am not entering them as normal numeric readings.",
                "The nine o'clock reading is seven point four one millimetres and the reinforcement pad reads thirteen point four one millimetres.",
                "I am keeping the patched status in the note so the blank positions are not treated as missed readings.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "floor-internal-context",
            screen = ProductWorkflowScreen.CHECKLIST,
            cardKey = "checklist_item",
            fieldKey = "checklist_item_note",
            target = ProductLayoutTarget.FLOOR,
            itemKey = "checklist:175",
            itemLabel = "Floor internal context",
            capturedAtIso = "2022-07-21T13:40:00+12:00",
            durationMs = 42_000,
            transcript = v10Transcript(
                "Floor is cone down with bottom plates, annular plates, and centre sump.",
                "The floor coating is thick, around four millimetres, but there are coating bubbles and light corrosion at some locations.",
                "Existing topside pits and weld fills are visible, mostly coated with no active corrosion seen at the time of inspection.",
                "The dip plate was not removed, so the area underneath remains inaccessible for visual and UT checks.",
                "Shell-to-bottom weld MPI is also limited because the welds were not blasted.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "shell-internal-close-visual",
            screen = ProductWorkflowScreen.FINDINGS,
            cardKey = "finding_capture",
            fieldKey = "finding_note",
            target = ProductLayoutTarget.SHELL,
            itemKey = "shell:internal:selected-areas",
            itemLabel = "Shell internal selected areas",
            capturedAtIso = "2022-07-21T14:18:00+12:00",
            durationMs = 45_000,
            transcript = v10Transcript(
                "Internal shell coating is only present on the first strake.",
                "From the second strake upward there is general surface corrosion, with heavy scaling along welds and other shell plate locations.",
                "Only selected locations are accessible with scaffold today, so I am treating the confirmed areas as representative risk points, not as a complete internal shell condition survey.",
                "Areas with heavy scale and linear indications have been marked on site for weld build-up, weld fill, or patch repair.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "repair-closeout",
            screen = ProductWorkflowScreen.CHECKLIST,
            cardKey = "checklist_item",
            fieldKey = "checklist_item_note",
            capturedAtIso = "2022-07-21T14:45:00+12:00",
            durationMs = 46_000,
            transcript = v10Transcript(
                "Main repair flags from the field are shell internal weld build-up, patch repair at the two buckled shell areas, and weld fills where pitting exceeds about two point five millimetres.",
                "The fifth and sixth course south sector should be monitored closely because this is where the low shell readings and buckling are concentrated.",
                "Recoat corroded or coating-failed areas on shell, roof, stairway, piping, supports, and nozzles.",
                "Install tell-tale holes for reinforced pads, add roof manhole reinforcement, and address emergency venting because the roof joint is not behaving as a frangible joint.",
            ),
        ),
        v10VoiceNote(
            idSuffix = "checklist-closeout",
            screen = ProductWorkflowScreen.CHECKLIST,
            cardKey = "checklist_item",
            fieldKey = "checklist_item_note",
            target = ProductLayoutTarget.SHELL,
            capturedAtIso = "2022-07-21T15:10:00+12:00",
            durationMs = 44_000,
            transcript = v10Transcript(
                "Checklist closeout: dike and walls are mostly satisfactory, but drainage debris and standing water need housekeeping.",
                "Foundation edge seal is deteriorated and needs a mastic-type plinth seal to reduce water ingress under the floor projection.",
                "Shell lap patches, shell deformation, missing nozzle tell-tale holes, missing nameplate, missing top safety chain, roof manhole reinforcement, and roof vent trimming are the key nonconformance or action items.",
                "Record access limitations separately, especially coating not removed for some MPI areas, dip plate not removed, and shell internal access limited to selected scaffold locations.",
            ),
        ),
    )

private fun v10VoiceNote(
    idSuffix: String,
    screen: ProductWorkflowScreen,
    transcript: String,
    capturedAtIso: String,
    durationMs: Long,
    cardKey: String = "screen",
    fieldKey: String = "voice_note",
    target: ProductLayoutTarget? = null,
    itemKey: String? = null,
    itemLabel: String? = null,
): ProductVoiceNote =
    ProductVoiceNote(
        id = "voice-v10-$idSuffix",
        relativePath = "v3-voice-notes/mock/voice-v10-$idSuffix.m4a",
        displayName = "Prepared inspector voice - ${screen.label}",
        screenKey = screen.key,
        screenLabel = screen.label,
        cardKey = cardKey,
        fieldKey = fieldKey,
        targetKey = target?.key,
        targetLabel = target?.label,
        itemKey = itemKey,
        itemLabel = itemLabel,
        transcriptStatus = "transcribed_mock",
        transcriptText = transcript,
        durationMs = durationMs,
        capturedAtIso = capturedAtIso,
    )

private fun v10Transcript(vararg sentences: String): String =
    sentences.joinToString(" ")

private fun v10UtMeasurementsInProgress(): ProductUtMeasurementState =
    v10UtMeasurementsCompleted().copy(
        approvedTargets = setOf(ProductLayoutTarget.EXTERNAL_ROOF),
        selectedTarget = ProductLayoutTarget.SHELL,
    )

private fun v10UtMeasurementsCompleted(): ProductUtMeasurementState =
    ProductUtMeasurementState(
        selectedTarget = ProductLayoutTarget.SHELL,
        entriesByItemKey = (
            v10RoofPlateUtEntries() +
                v10RoofNozzleUtEntries() +
                v10ShellNozzleUtEntries() +
                v10ShellStrakeUtEntries()
            ).toMap(),
        approvedTargets = setOf(
            ProductLayoutTarget.EXTERNAL_ROOF,
            ProductLayoutTarget.SHELL,
        ),
    )

private fun v10RoofPlateUtEntries(): List<Pair<String, ProductUtMeasurementEntry>> =
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
        measuredRegionEntry(ProductLayoutTarget.EXTERNAL_ROOF, plate, readings)
    }

private fun v10RoofNozzleUtEntries(): List<Pair<String, ProductUtMeasurementEntry>> =
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
): Pair<String, ProductUtMeasurementEntry> =
    measuredElementEntry(
        target = ProductLayoutTarget.EXTERNAL_ROOF,
        itemKey = "external_roof:element:external_roof_nozzle_$idSuffix",
        itemLabel = label,
        elementType = ProductElementType.NOZZLE,
        nozzleSize = nozzleSize,
        reinforcementPadReading = reinforcementPadReading,
        readings = readings,
    )

private fun v10ShellNozzleUtEntries(): List<Pair<String, ProductUtMeasurementEntry>> =
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
): Pair<String, ProductUtMeasurementEntry> =
    measuredElementEntry(
        target = ProductLayoutTarget.SHELL,
        itemKey = "shell:element:shell_nozzle_$idSuffix",
        itemLabel = label,
        elementType = ProductElementType.NOZZLE,
        nozzleSize = nozzleSize,
        reinforcementPadReading = reinforcementPadReading,
        readings = readings,
    )

private fun v10ShellStrakeUtEntries(): List<Pair<String, ProductUtMeasurementEntry>> {
    fun entry(
        strake: Int,
        directionLane: Int,
        readings: List<String>,
    ): Pair<String, ProductUtMeasurementEntry> =
        measuredRegionEntry(
            target = ProductLayoutTarget.SHELL,
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

private fun v10FloorUtEntries(): List<Pair<String, ProductUtMeasurementEntry>> =
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
        measuredRegionEntry(ProductLayoutTarget.FLOOR, plate, readings)
    }

private fun v10FindingStateInProgress(): ProductFindingState =
    ProductFindingState(
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

private fun v10FindingStateReady(): ProductFindingState =
    ProductFindingState(
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
                    findingOnlyElementEntry(
                        target = ProductLayoutTarget.EXTERNAL_ROOF,
                        itemKey = "external_roof:element:external_roof_manhole_1",
                        itemLabel = "MH-1",
                        elementType = ProductElementType.MANHOLE,
                    ),
                    "Roof manhole did not contain a reinforcement plate as recommended by API 650. Final recommendation is to add reinforcement around the roof manhole in accordance with API 650 clause 5.8.4.",
                    "Photo 37 - Roof manhole without reinforcement plate",
                ),
                findingEntry(
                    findingOnlyElementEntry(
                        target = ProductLayoutTarget.EXTERNAL_ROOF,
                        itemKey = "external_roof:element:external_roof_vent_1",
                        itemLabel = "VT-1",
                        elementType = ProductElementType.VENT,
                    ),
                    "Roof venting nozzles were not trimmed flush as recommended by API 650 Figures 5-19 and 5-20. Future vent installations should be trimmed flush during repair or replacement.",
                    "Photo 41 - Roof venting nozzle not trimmed flush",
                ),
                findingEntry(
                    findingOnlyElementEntry(
                        target = ProductLayoutTarget.SHELL,
                        itemKey = "shell:element:shell_stair_origin",
                        itemLabel = "ST-O",
                        elementType = ProductElementType.STAIR,
                    ),
                    "Several shell-mounted stairway treads were welded within shell plate butt-welded joints, contrary to API 650 attachment spacing guidance. Coating condition was generally satisfactory with minor failures on stringers and handrails.",
                    "Photo 23 - Stairway tread welded within shell butt joint",
                ),
            ).forEach { finding ->
                putAll(listOf(finding))
            }
        },
    )

private fun v10ChecklistInProgressState(): ProductInspectionChecklistState {
    val completedRatings = v10ChecklistRatings()
    val partialRatings = completedRatings.filterKeys { itemNumber ->
        itemNumber <= 96 || itemNumber in setOf(144, 145, 147, 152, 166, 167, 174, 175, 181, 194, 195)
    }
    return ProductInspectionChecklistState(
        selectedSectionKey = "fixed_roof_internal",
        ratingsByItemNumber = partialRatings,
        sectionComments = v10ChecklistSectionComments(),
    )
}

private fun v10ChecklistCompletedState(): ProductInspectionChecklistState =
    ProductInspectionChecklistState(
        selectedSectionKey = "shell_internal",
        ratingsByItemNumber = v10ChecklistRatings(),
        sectionComments = v10ChecklistSectionComments(),
    )

private fun v10ChecklistRatings(): Map<Int, ProductChecklistRating> {
    val ratings = ProductInspectionChecklistCatalog.sections
        .flatMap { section -> section.items }
        .associate { item -> item.number to ProductChecklistRating.GOOD }
        .toMutableMap()

    val overrides = mapOf(
        6 to ProductChecklistRating.SATISFACTORY,
        10 to ProductChecklistRating.SATISFACTORY,
        12 to ProductChecklistRating.SATISFACTORY,
        15 to ProductChecklistRating.SATISFACTORY,
        18 to ProductChecklistRating.SATISFACTORY,
        21 to ProductChecklistRating.SATISFACTORY,
        22 to ProductChecklistRating.NOT_APPLICABLE,
        23 to ProductChecklistRating.REQUIRES_REPAIR,
        24 to ProductChecklistRating.IMMEDIATE_ATTENTION,
        25 to ProductChecklistRating.SATISFACTORY,
        26 to ProductChecklistRating.NOT_TO_CODE,
        27 to ProductChecklistRating.REQUIRES_REPAIR,
        30 to ProductChecklistRating.NOT_APPLICABLE,
        31 to ProductChecklistRating.NOT_APPLICABLE,
        32 to ProductChecklistRating.SATISFACTORY,
        38 to ProductChecklistRating.NOT_TO_CODE,
        41 to ProductChecklistRating.SATISFACTORY,
        42 to ProductChecklistRating.NOT_TO_CODE,
        47 to ProductChecklistRating.SATISFACTORY,
        50 to ProductChecklistRating.SATISFACTORY,
        52 to ProductChecklistRating.NOT_APPLICABLE,
        53 to ProductChecklistRating.NOT_APPLICABLE,
        61 to ProductChecklistRating.NOT_APPLICABLE,
        63 to ProductChecklistRating.NOT_APPLICABLE,
        67 to ProductChecklistRating.NOT_TO_CODE,
        68 to ProductChecklistRating.SATISFACTORY,
        69 to ProductChecklistRating.SATISFACTORY,
        71 to ProductChecklistRating.SATISFACTORY,
        73 to ProductChecklistRating.NOT_TO_CODE,
        74 to ProductChecklistRating.SATISFACTORY,
        75 to ProductChecklistRating.SATISFACTORY,
        76 to ProductChecklistRating.SATISFACTORY,
        78 to ProductChecklistRating.SATISFACTORY,
        79 to ProductChecklistRating.SATISFACTORY,
        80 to ProductChecklistRating.SATISFACTORY,
        83 to ProductChecklistRating.SATISFACTORY,
        85 to ProductChecklistRating.NOT_TO_CODE,
        86 to ProductChecklistRating.NOT_TO_CODE,
        88 to ProductChecklistRating.SATISFACTORY,
        90 to ProductChecklistRating.SATISFACTORY,
        91 to ProductChecklistRating.SATISFACTORY,
        93 to ProductChecklistRating.NOT_APPLICABLE,
        94 to ProductChecklistRating.SATISFACTORY,
        96 to ProductChecklistRating.NOT_TO_CODE,
        144 to ProductChecklistRating.SATISFACTORY,
        145 to ProductChecklistRating.SATISFACTORY,
        147 to ProductChecklistRating.SATISFACTORY,
        152 to ProductChecklistRating.NOT_TO_CODE,
        166 to ProductChecklistRating.SATISFACTORY,
        167 to ProductChecklistRating.REQUIRES_REPAIR,
        168 to ProductChecklistRating.SATISFACTORY,
        173 to ProductChecklistRating.NOT_APPLICABLE,
        174 to ProductChecklistRating.REQUIRES_REPAIR,
        175 to ProductChecklistRating.SATISFACTORY,
        177 to ProductChecklistRating.SATISFACTORY,
        181 to ProductChecklistRating.SATISFACTORY,
        189 to ProductChecklistRating.SATISFACTORY,
        191 to ProductChecklistRating.SATISFACTORY,
        194 to ProductChecklistRating.SATISFACTORY,
        195 to ProductChecklistRating.REQUIRES_REPAIR,
    )
    ratings.putAll(overrides)
    (97..143).forEach { itemNumber ->
        ratings[itemNumber] = ProductChecklistRating.NOT_APPLICABLE
    }
    (153..165).forEach { itemNumber ->
        ratings[itemNumber] = ProductChecklistRating.NOT_APPLICABLE
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
    target: ProductLayoutTarget,
    itemLabel: String,
    readings: List<String>,
): Pair<String, ProductUtMeasurementEntry> =
    "${target.key}:region:$itemLabel" to ProductUtMeasurementEntry(
        itemKey = "${target.key}:region:$itemLabel",
        target = target,
        itemLabel = itemLabel,
        kind = ProductUtItemKind.LAYOUT_REGION,
        readings = readings,
        confirmed = true,
    )

private fun measuredElementEntry(
    target: ProductLayoutTarget,
    itemKey: String,
    itemLabel: String,
    elementType: ProductElementType,
    nozzleSize: String,
    reinforcementPadReading: String = "",
    readings: List<String>,
): Pair<String, ProductUtMeasurementEntry> =
    itemKey to ProductUtMeasurementEntry(
        itemKey = itemKey,
        target = target,
        itemLabel = itemLabel,
        kind = ProductUtItemKind.ELEMENT,
        elementType = elementType,
        nozzleSize = nozzleSize,
        reinforcementPadReading = reinforcementPadReading,
        readings = readings,
        confirmed = true,
    )

private fun findingOnlyElementEntry(
    target: ProductLayoutTarget,
    itemKey: String,
    itemLabel: String,
    elementType: ProductElementType,
): ProductUtMeasurementEntry =
    ProductUtMeasurementEntry(
        itemKey = itemKey,
        target = target,
        itemLabel = itemLabel,
        kind = ProductUtItemKind.ELEMENT,
        elementType = elementType,
        nozzleSize = "N.A.",
        readings = emptyList(),
        confirmed = false,
    )

private fun findingEntry(
    entry: ProductUtMeasurementEntry,
    note: String,
    vararg photoCaptions: String,
): Pair<String, ProductFindingRecord> =
    photoCaptions.mapIndexed { index, caption ->
        mockFindingPhoto(entry.itemKey, index + 1, caption)
    }.let { photos ->
        entry.itemKey to ProductFindingRecord(
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
): ProductFindingPhoto {
    val safeKey = itemKey.lowercase()
        .replace(Regex("[^a-z0-9]+"), "-")
        .trim('-')
    val id = "mock-$safeKey-$index"
    return ProductFindingPhoto(
        id = id,
        relativePath = "v3-findings/mock/$id.png",
        displayName = caption,
    )
}

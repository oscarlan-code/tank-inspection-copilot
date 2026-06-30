package ai.laiq.tankinspection.v3product.preview

import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.domain.model.RotationDirection
import ai.laiq.tankinspection.v3product.model.ProductDraftState
import ai.laiq.tankinspection.v3product.model.ProductElementPlacementState
import ai.laiq.tankinspection.v3product.model.ProductElementSetup
import ai.laiq.tankinspection.v3product.model.ProductElementType
import ai.laiq.tankinspection.v3product.model.ProductFloorTemplate
import ai.laiq.tankinspection.v3product.model.ProductAnnotationPoint
import ai.laiq.tankinspection.v3product.model.ProductAnnotationStroke
import ai.laiq.tankinspection.v3product.model.ProductChecklistRating
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularPlate
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularPlateLayout
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularPlateRow
import ai.laiq.tankinspection.v3product.model.ProductCustomCircularRowGroup
import ai.laiq.tankinspection.v3product.model.ProductFindingPhoto
import ai.laiq.tankinspection.v3product.model.ProductFindingRecord
import ai.laiq.tankinspection.v3product.model.ProductFindingState
import ai.laiq.tankinspection.v3product.model.ProductGeneralTankInfo
import ai.laiq.tankinspection.v3product.model.ProductInspectionChecklistCatalog
import ai.laiq.tankinspection.v3product.model.ProductInspectionChecklistState
import ai.laiq.tankinspection.v3product.model.ProductLayoutMapSetup
import ai.laiq.tankinspection.v3product.model.ProductLayoutScope
import ai.laiq.tankinspection.v3product.model.ProductLayoutSurface
import ai.laiq.tankinspection.v3product.model.ProductLayoutTarget
import ai.laiq.tankinspection.v3product.model.ProductPlacedElement
import ai.laiq.tankinspection.v3product.model.ProductReferenceMode
import ai.laiq.tankinspection.v3product.model.ProductRoofLayoutMap
import ai.laiq.tankinspection.v3product.model.ProductRoofScope
import ai.laiq.tankinspection.v3product.model.ProductShellOffsetStartRow
import ai.laiq.tankinspection.v3product.model.ProductShellThirdOffsetStart
import ai.laiq.tankinspection.v3product.model.ProductUtItemKind
import ai.laiq.tankinspection.v3product.model.ProductUtMeasurementEntry
import ai.laiq.tankinspection.v3product.model.ProductUtMeasurementState
import ai.laiq.tankinspection.v3product.model.ProductUtSetup
import ai.laiq.tankinspection.v3product.model.ProductVoiceNote
import ai.laiq.tankinspection.v3product.model.defaultProductPreviewDraftState
import ai.laiq.tankinspection.v3product.model.normalizedRoofPresence
import ai.laiq.tankinspection.v3product.model.withReconciledGeneralTankInfo
import org.json.JSONArray
import org.json.JSONObject

object ProductDraftJsonCodec {
    fun encode(state: ProductDraftState): String =
        JSONObject()
            .put("version", 1)
            .put("generalTankInfo", state.generalTankInfo.toJson())
            .put("layoutScope", state.layoutScope.toJson())
            .put("layoutMapSetup", state.layoutMapSetup.toJson())
            .put("elementSetup", state.elementSetup.toJson())
            .put("elementPlacement", state.elementPlacement.toJson())
            .put("utSetup", state.utSetup.toJson())
            .put("utMeasurements", state.utMeasurements.toJson())
            .put("inspectionChecklist", state.inspectionChecklist.toJson())
            .put("findingState", state.findingState.toJson())
            .put("roofLayoutMap", state.roofLayoutMap.toJson())
            .put("voiceNotes", JSONArray().apply { state.voiceNotes.forEach { note -> put(note.toJson()) } })
            .toString()

    fun decode(raw: String): ProductDraftState {
        val json = JSONObject(raw)
        val defaults = defaultProductPreviewDraftState()
        val decoded = defaults.copy(
            generalTankInfo = json.optJSONObject("generalTankInfo")?.toGeneralTankInfo(defaults.generalTankInfo)
                ?.normalizedRoofPresence()
                ?: defaults.generalTankInfo,
            layoutScope = json.optJSONObject("layoutScope")?.toLayoutScope(defaults.layoutScope)
                ?: defaults.layoutScope,
            layoutMapSetup = json.optJSONObject("layoutMapSetup")?.toLayoutMapSetup(defaults.layoutMapSetup)
                ?: defaults.layoutMapSetup,
            elementSetup = json.optJSONObject("elementSetup")?.toElementSetup(defaults.elementSetup)
                ?: defaults.elementSetup,
            elementPlacement = json.optJSONObject("elementPlacement")?.toElementPlacement(defaults.elementPlacement)
                ?: defaults.elementPlacement,
            utSetup = json.optJSONObject("utSetup")?.toUtSetup(defaults.utSetup)
                ?: defaults.utSetup,
            utMeasurements = json.optJSONObject("utMeasurements")?.toUtMeasurements(defaults.utMeasurements)
                ?: defaults.utMeasurements,
            inspectionChecklist = json.optJSONObject("inspectionChecklist")
                ?.toInspectionChecklist(defaults.inspectionChecklist)
                ?: defaults.inspectionChecklist,
            findingState = json.optJSONObject("findingState")?.toFindingState(defaults.findingState)
                ?: defaults.findingState,
            roofLayoutMap = json.optJSONObject("roofLayoutMap")?.toRoofLayoutMap(defaults.roofLayoutMap)
                ?: defaults.roofLayoutMap,
            voiceNotes = json.optJSONArray("voiceNotes")?.toVoiceNotes() ?: defaults.voiceNotes,
        )
        return decoded.withReconciledGeneralTankInfo(decoded.generalTankInfo)
    }

    private fun ProductGeneralTankInfo.toJson(): JSONObject =
        JSONObject()
            .put("client", client)
            .put("clientRepresentative", clientRepresentative)
            .put("jobNo", jobNo)
            .put("tankNumber", tankNumber)
            .put("dateCompleted", dateCompleted)
            .put("inspector", inspector)
            .put("location", location)
            .put("fieldLeaseName", fieldLeaseName)
            .put("yearBuilt", yearBuilt)
            .put("originalManufacturer", originalManufacturer)
            .put("originalConstructionStd", originalConstructionStd)
            .put("materialSpec", materialSpec)
            .put("drawingRef", drawingRef)
            .put("shellConstruction", shellConstruction)
            .put("roofType", roofType)
            .put("externalRoofType", externalRoofType)
            .put("internalRoofType", internalRoofType)
            .put("height", height)
            .put("serviceHeight", serviceHeight)
            .put("diameter", diameter)
            .put("productStored", productStored)
            .put("specificGravity", specificGravity)
            .put("designTemp", designTemp)
            .put("internalPressure", internalPressure)
            .put("courseNumber", courseNumber)
            .put("floorPlateNumber", floorPlateNumber)
            .put("roofPlateNumber", roofPlateNumber)
            .put("floorPlateThickness", floorPlateThickness)
            .put("windGirder", windGirder)
            .put("annularPlateNumber", annularPlateNumber)
            .put("insulated", insulated)
            .put("insulationDistance", insulationDistance)
            .put("annularPlateThickness", annularPlateThickness)
            .put("stiffener", stiffener)
            .put("previousExternal", previousExternal)
            .put("previousInternal", previousInternal)
            .put("previousBottom", previousBottom)

    private fun JSONObject.toGeneralTankInfo(defaults: ProductGeneralTankInfo): ProductGeneralTankInfo =
        ProductGeneralTankInfo(
            client = optString("client", defaults.client),
            clientRepresentative = optString("clientRepresentative", defaults.clientRepresentative),
            jobNo = optString("jobNo", defaults.jobNo),
            tankNumber = optString("tankNumber", defaults.tankNumber),
            dateCompleted = optString("dateCompleted", defaults.dateCompleted),
            inspector = optString("inspector", defaults.inspector),
            location = optString("location", defaults.location),
            fieldLeaseName = optString("fieldLeaseName", defaults.fieldLeaseName),
            yearBuilt = optString("yearBuilt", defaults.yearBuilt),
            originalManufacturer = optString("originalManufacturer", defaults.originalManufacturer),
            originalConstructionStd = optString("originalConstructionStd", defaults.originalConstructionStd),
            materialSpec = optString("materialSpec", defaults.materialSpec),
            drawingRef = optString("drawingRef", defaults.drawingRef),
            shellConstruction = optString("shellConstruction", defaults.shellConstruction),
            roofType = optString("roofType", defaults.roofType),
            externalRoofType = optString("externalRoofType", defaults.externalRoofType),
            internalRoofType = optString("internalRoofType", defaults.internalRoofType),
            height = optString("height", defaults.height),
            serviceHeight = optString("serviceHeight", defaults.serviceHeight),
            diameter = optString("diameter", defaults.diameter),
            productStored = optString("productStored", defaults.productStored),
            specificGravity = optString("specificGravity", defaults.specificGravity),
            designTemp = optString("designTemp", defaults.designTemp),
            internalPressure = optString("internalPressure", defaults.internalPressure),
            courseNumber = optString("courseNumber", defaults.courseNumber),
            floorPlateNumber = optString("floorPlateNumber", defaults.floorPlateNumber),
            roofPlateNumber = optString("roofPlateNumber", defaults.roofPlateNumber),
            floorPlateThickness = optString("floorPlateThickness", defaults.floorPlateThickness),
            windGirder = optString("windGirder", defaults.windGirder),
            annularPlateNumber = optString("annularPlateNumber", defaults.annularPlateNumber),
            insulated = optString("insulated", defaults.insulated),
            insulationDistance = optString("insulationDistance", defaults.insulationDistance),
            annularPlateThickness = optString("annularPlateThickness", defaults.annularPlateThickness),
            stiffener = optString("stiffener", defaults.stiffener),
            previousExternal = optString("previousExternal", defaults.previousExternal),
            previousInternal = optString("previousInternal", defaults.previousInternal),
            previousBottom = optString("previousBottom", defaults.previousBottom),
        )

    private fun ProductLayoutScope.toJson(): JSONObject =
        JSONObject()
            .put("externalRoof", externalRoof)
            .put("internalRoof", internalRoof)
            .put("shell", shell)
            .put("floor", floor)

    private fun JSONObject.toLayoutScope(defaults: ProductLayoutScope): ProductLayoutScope =
        ProductLayoutScope(
            externalRoof = optBoolean("externalRoof", defaults.externalRoof),
            internalRoof = optBoolean("internalRoof", defaults.internalRoof),
            shell = optBoolean("shell", defaults.shell),
            floor = optBoolean("floor", defaults.floor),
        )

    private fun ProductElementSetup.toJson(): JSONObject =
        JSONObject()
            .put("externalRoof", externalRoof)
            .put("internalRoof", internalRoof)
            .put("shell", shell)
            .put("floor", floor)

    private fun JSONObject.toElementSetup(defaults: ProductElementSetup): ProductElementSetup =
        ProductElementSetup(
            externalRoof = optBoolean("externalRoof", defaults.externalRoof),
            internalRoof = optBoolean("internalRoof", defaults.internalRoof),
            shell = optBoolean("shell", defaults.shell),
            floor = optBoolean("floor", defaults.floor),
        )

    private fun ProductUtSetup.toJson(): JSONObject =
        JSONObject()
            .put("externalRoof", externalRoof)
            .put("internalRoof", internalRoof)
            .put("shell", shell)
            .put("floor", floor)

    private fun JSONObject.toUtSetup(defaults: ProductUtSetup): ProductUtSetup =
        ProductUtSetup(
            externalRoof = optBoolean("externalRoof", defaults.externalRoof),
            internalRoof = optBoolean("internalRoof", defaults.internalRoof),
            shell = optBoolean("shell", defaults.shell),
            floor = optBoolean("floor", defaults.floor),
        )

    private fun ProductLayoutMapSetup.toJson(): JSONObject =
        JSONObject()
            .put("selectedTarget", selectedTarget.key)
            .put("selectedSurface", selectedSurface.key)
            .put("roofScope", roofScope.key)
            .put("referenceMode", referenceMode.key)
            .put("referenceNote", referenceNote)
            .put("rotationDirection", rotationDirection.name)
            .put("roofPattern", roofPattern.name)
            .put("roofRingCount", roofRingCount)
            .put("roofSectorCount", roofSectorCount)
            .put("roofRowCount", roofRowCount)
            .put("roofWidestRowPlateCount", roofWidestRowPlateCount)
            .put("roofHasCenterOpening", roofHasCenterOpening)
            .put("roofCenterOpeningPlateCount", roofCenterOpeningPlateCount)
            .put("roofHasAnnularRing", roofHasAnnularRing)
            .put("roofAnnularSectionCount", roofAnnularSectionCount)
            .put("shellCourseCount", shellCourseCount)
            .put("shellPlatesPerCourse", shellPlatesPerCourse)
            .put("shellLaneCount", shellLaneCount)
            .put("shellPlateOffset", shellPlateOffset)
            .put("shellOffsetStartRow", shellOffsetStartRow.key)
            .put("shellThirdOffsetStart", shellThirdOffsetStart.key)
            .putNullable("selectedShellLaneIndex", selectedShellLaneIndex)
            .putNullable("selectedShellPlateId", selectedShellPlateId)
            .put("floorTemplate", floorTemplate.key)
            .put("floorPlateCount", floorPlateCount)
            .put("floorAnnularSectionCount", floorAnnularSectionCount)
            .put("floorPatternCountX", floorPatternCountX)
            .put("floorPatternCountY", floorPatternCountY)
            .put("customCircularLayoutsByTarget", customCircularLayoutsByTarget.toCustomCircularLayoutsJson())
            .put("approvedTargets", approvedTargets.toTargetArray())

    private fun JSONObject.toLayoutMapSetup(defaults: ProductLayoutMapSetup): ProductLayoutMapSetup =
        ProductLayoutMapSetup(
            selectedTarget = optTarget("selectedTarget", defaults.selectedTarget) ?: defaults.selectedTarget,
            selectedSurface = optSurface("selectedSurface", defaults.selectedSurface),
            roofScope = optRoofScope("roofScope", defaults.roofScope),
            referenceMode = optReferenceMode("referenceMode", defaults.referenceMode),
            referenceNote = optString("referenceNote", defaults.referenceNote),
            rotationDirection = optRotationDirection("rotationDirection", defaults.rotationDirection),
            roofPattern = optRoofTemplate("roofPattern", defaults.roofPattern),
            roofRingCount = optString("roofRingCount", defaults.roofRingCount),
            roofSectorCount = optString("roofSectorCount", defaults.roofSectorCount),
            roofRowCount = optString("roofRowCount", defaults.roofRowCount),
            roofWidestRowPlateCount = optString("roofWidestRowPlateCount", defaults.roofWidestRowPlateCount),
            roofHasCenterOpening = optBoolean("roofHasCenterOpening", defaults.roofHasCenterOpening),
            roofCenterOpeningPlateCount = optString("roofCenterOpeningPlateCount", defaults.roofCenterOpeningPlateCount),
            roofHasAnnularRing = optBoolean("roofHasAnnularRing", defaults.roofHasAnnularRing),
            roofAnnularSectionCount = optString("roofAnnularSectionCount", defaults.roofAnnularSectionCount),
            shellCourseCount = optString("shellCourseCount", defaults.shellCourseCount),
            shellPlatesPerCourse = optString("shellPlatesPerCourse", defaults.shellPlatesPerCourse),
            shellLaneCount = optString("shellLaneCount", defaults.shellLaneCount),
            shellPlateOffset = optString("shellPlateOffset", defaults.shellPlateOffset),
            shellOffsetStartRow = optShellOffsetStartRow("shellOffsetStartRow", defaults.shellOffsetStartRow),
            shellThirdOffsetStart = optShellThirdOffsetStart("shellThirdOffsetStart", defaults.shellThirdOffsetStart),
            selectedShellLaneIndex = optNullableInt("selectedShellLaneIndex"),
            selectedShellPlateId = optNullableString("selectedShellPlateId"),
            floorTemplate = optFloorTemplate("floorTemplate", defaults.floorTemplate),
            floorPlateCount = optString("floorPlateCount", defaults.floorPlateCount),
            floorAnnularSectionCount = optString("floorAnnularSectionCount", defaults.floorAnnularSectionCount),
            floorPatternCountX = optString("floorPatternCountX", defaults.floorPatternCountX),
            floorPatternCountY = optString("floorPatternCountY", defaults.floorPatternCountY),
            customCircularLayoutsByTarget = optCustomCircularLayoutMap(
                "customCircularLayoutsByTarget",
                defaults.customCircularLayoutsByTarget,
            ),
            approvedTargets = optTargetSet("approvedTargets", defaults.approvedTargets),
        )

    private fun ProductElementPlacementState.toJson(): JSONObject =
        JSONObject()
            .put("selectedTarget", selectedTarget.key)
            .put("selectedElementType", selectedElementType.key)
            .putNullable("selectedElementId", selectedElementId)
            .put("placementsByTarget", JSONObject().apply {
                placementsByTarget.forEach { (target, placements) ->
                    put(target.key, JSONArray().apply {
                        placements.forEach { element ->
                            put(
                                JSONObject()
                                    .put("id", element.id)
                                    .put("label", element.label)
                                    .put("type", element.type.key)
                                    .put("normalizedX", element.normalizedX.toDouble())
                                    .put("normalizedY", element.normalizedY.toDouble()),
                            )
                        }
                    })
                }
            })
            .put("approvedTargets", approvedTargets.toTargetArray())
            .put("nextElementIndexByTargetAndType", JSONObject().apply {
                nextElementIndexByTargetAndType.forEach { (key, value) -> put(key, value) }
            })

    private fun JSONObject.toElementPlacement(defaults: ProductElementPlacementState): ProductElementPlacementState {
        val placementsJson = optJSONObject("placementsByTarget")
        val placementsByTarget = buildMap {
            if (placementsJson != null) {
                placementsJson.keys().forEach { targetKey ->
                    val target = targetByKey(targetKey) ?: return@forEach
                    val array = placementsJson.optJSONArray(targetKey) ?: JSONArray()
                    put(
                        target,
                        buildList {
                            repeat(array.length()) { index ->
                                val json = array.optJSONObject(index) ?: return@repeat
                                val type = elementTypeByKey(json.optString("type")) ?: return@repeat
                                add(
                                    ProductPlacedElement(
                                        id = json.optString("id"),
                                        label = json.optString("label"),
                                        type = type,
                                        normalizedX = json.optDouble("normalizedX", 0.5).toFloat(),
                                        normalizedY = json.optDouble("normalizedY", 0.5).toFloat(),
                                    ),
                                )
                            }
                        },
                    )
                }
            }
        }
        return ProductElementPlacementState(
            selectedTarget = optTarget("selectedTarget", defaults.selectedTarget) ?: defaults.selectedTarget,
            selectedElementType = optElementType("selectedElementType", defaults.selectedElementType),
            selectedElementId = optNullableString("selectedElementId"),
            placementsByTarget = placementsByTarget.ifEmpty { defaults.placementsByTarget },
            approvedTargets = optTargetSet("approvedTargets", defaults.approvedTargets),
            nextElementIndexByTargetAndType = optJSONObject("nextElementIndexByTargetAndType")?.toIntMap()
                ?: defaults.nextElementIndexByTargetAndType,
        )
    }

    private fun ProductUtMeasurementState.toJson(): JSONObject =
        JSONObject()
            .put("selectedTarget", selectedTarget.key)
            .putNullable("activeItemKey", activeItemKey)
            .put("entriesByItemKey", JSONObject().apply {
                entriesByItemKey.forEach { (key, entry) -> put(key, entry.toJson()) }
            })
            .put("approvedTargets", approvedTargets.toTargetArray())

    private fun ProductUtMeasurementEntry.toJson(): JSONObject =
        JSONObject()
            .put("itemKey", itemKey)
            .put("target", target.key)
            .put("itemLabel", itemLabel)
            .put("kind", kind.name)
            .putNullable("elementType", elementType?.key)
            .put("nozzleSize", nozzleSize)
            .put("reinforcementPadReading", reinforcementPadReading)
            .put("readings", JSONArray().apply { readings.forEach(::put) })
            .put("confirmed", confirmed)

    private fun JSONObject.toUtMeasurements(defaults: ProductUtMeasurementState): ProductUtMeasurementState {
        val entries = optJSONObject("entriesByItemKey")?.let { entriesJson ->
            buildMap {
                entriesJson.keys().forEach { key ->
                    entriesJson.optJSONObject(key)?.toUtEntry()?.let { entry ->
                        put(key, entry)
                    }
                }
            }
        } ?: defaults.entriesByItemKey
        return ProductUtMeasurementState(
            selectedTarget = optTarget("selectedTarget", defaults.selectedTarget) ?: defaults.selectedTarget,
            activeItemKey = optNullableString("activeItemKey"),
            entriesByItemKey = entries,
            approvedTargets = optTargetSet("approvedTargets", defaults.approvedTargets),
        )
    }

    private fun JSONObject.toUtEntry(): ProductUtMeasurementEntry? {
        val target = optTarget("target", null) ?: return null
        val kind = optEnumName<ProductUtItemKind>("kind", null) ?: return null
        val itemKey = optString("itemKey").ifBlank { return null }
        return ProductUtMeasurementEntry(
            itemKey = itemKey,
            target = target,
            itemLabel = optString("itemLabel"),
            kind = kind,
            elementType = optNullableString("elementType")?.let(::elementTypeByKey),
            nozzleSize = optString("nozzleSize", "6 in"),
            reinforcementPadReading = optString("reinforcementPadReading", ""),
            readings = optJSONArray("readings")?.toStringList() ?: emptyList(),
            confirmed = optBoolean("confirmed", false),
        )
    }

    private fun ProductInspectionChecklistState.toJson(): JSONObject =
        JSONObject()
            .put("selectedSectionKey", selectedSectionKey)
            .put("ratingsByItemNumber", JSONObject().apply {
                ratingsByItemNumber.forEach { (itemNumber, rating) ->
                    put(itemNumber.toString(), rating.key)
                }
            })
            .put("itemNotesByItemNumber", JSONObject().apply {
                itemNotesByItemNumber.forEach { (itemNumber, note) ->
                    put(itemNumber.toString(), note)
                }
            })
            .put("sectionComments", JSONObject().apply {
                sectionComments.forEach { (sectionKey, comment) -> put(sectionKey, comment) }
            })

    private fun JSONObject.toInspectionChecklist(
        defaults: ProductInspectionChecklistState,
    ): ProductInspectionChecklistState {
        val ratingsByItemNumber = optJSONObject("ratingsByItemNumber")?.let { ratingsJson ->
            buildMap {
                ratingsJson.keys().forEach { key ->
                    val itemNumber = key.toIntOrNull() ?: return@forEach
                    if (itemNumber !in ProductInspectionChecklistCatalog.itemNumbers) return@forEach
                    val rating = ProductChecklistRating.fromKey(ratingsJson.optString(key)) ?: return@forEach
                    put(itemNumber, rating)
                }
            }
        } ?: defaults.ratingsByItemNumber
        val itemNotesByItemNumber = optJSONObject("itemNotesByItemNumber")?.let { notesJson ->
            buildMap {
                notesJson.keys().forEach { key ->
                    val itemNumber = key.toIntOrNull() ?: return@forEach
                    if (itemNumber !in ProductInspectionChecklistCatalog.itemNumbers) return@forEach
                    val value = notesJson.optString(key).trim()
                    if (value.isNotBlank()) put(itemNumber, value)
                }
            }
        } ?: defaults.itemNotesByItemNumber
        val sectionComments = optJSONObject("sectionComments")?.let { commentsJson ->
            buildMap {
                commentsJson.keys().forEach { key ->
                    val value = commentsJson.optString(key).trim()
                    if (value.isNotBlank()) put(key, value)
                }
            }
        } ?: defaults.sectionComments
        val selectedSectionKey = optString("selectedSectionKey", defaults.selectedSectionKey)
            .takeIf { key -> ProductInspectionChecklistCatalog.sections.any { section -> section.key == key } }
            ?: defaults.selectedSectionKey
        return ProductInspectionChecklistState(
            selectedSectionKey = selectedSectionKey,
            ratingsByItemNumber = ratingsByItemNumber,
            itemNotesByItemNumber = itemNotesByItemNumber,
            sectionComments = sectionComments,
        )
    }

    private fun ProductFindingState.toJson(): JSONObject =
        JSONObject()
            .putNullable("activeItemKey", activeItemKey)
            .put("findingsByItemKey", JSONObject().apply {
                findingsByItemKey.forEach { (key, finding) -> put(key, finding.toJson()) }
            })

    private fun ProductFindingRecord.toJson(): JSONObject =
        JSONObject()
            .put("itemKey", itemKey)
            .put("target", target.key)
            .put("itemLabel", itemLabel)
            .put("itemKind", itemKind.name)
            .putNullable("elementType", elementType?.key)
            .put("note", note)
            .putNullable("selectedPhotoId", selectedPhotoId)
            .put("photos", JSONArray().apply { photos.forEach { photo -> put(photo.toJson()) } })

    private fun ProductFindingPhoto.toJson(): JSONObject =
        JSONObject()
            .put("id", id)
            .put("relativePath", relativePath)
            .put("displayName", displayName)
            .put("annotationStrokes", JSONArray().apply {
                annotationStrokes.forEach { stroke ->
                    put(
                        JSONArray().apply {
                            stroke.points.forEach { point ->
                                put(JSONObject().put("x", point.x.toDouble()).put("y", point.y.toDouble()))
                            }
                        },
                    )
                }
            })

    private fun JSONObject.toFindingState(defaults: ProductFindingState): ProductFindingState {
        val findings = optJSONObject("findingsByItemKey")?.let { findingsJson ->
            buildMap {
                findingsJson.keys().forEach { key ->
                    findingsJson.optJSONObject(key)?.toFindingRecord()?.let { finding ->
                        put(key, finding)
                    }
                }
            }
        } ?: defaults.findingsByItemKey
        return ProductFindingState(
            activeItemKey = optNullableString("activeItemKey"),
            findingsByItemKey = findings,
        )
    }

    private fun JSONObject.toFindingRecord(): ProductFindingRecord? {
        val target = optTarget("target", null) ?: return null
        val itemKind = optEnumName<ProductUtItemKind>("itemKind", null) ?: return null
        val itemKey = optString("itemKey").ifBlank { return null }
        return ProductFindingRecord(
            itemKey = itemKey,
            target = target,
            itemLabel = optString("itemLabel"),
            itemKind = itemKind,
            elementType = optNullableString("elementType")?.let(::elementTypeByKey),
            note = optString("note"),
            photos = optJSONArray("photos")?.toFindingPhotos() ?: emptyList(),
            selectedPhotoId = optNullableString("selectedPhotoId"),
        )
    }

    private fun JSONArray.toFindingPhotos(): List<ProductFindingPhoto> =
        buildList {
            repeat(length()) { index ->
                val json = optJSONObject(index) ?: return@repeat
                val id = json.optString("id").ifBlank { return@repeat }
                add(
                    ProductFindingPhoto(
                        id = id,
                        relativePath = json.optString("relativePath"),
                        displayName = json.optString("displayName"),
                        annotationStrokes = json.optJSONArray("annotationStrokes")?.toAnnotationStrokes()
                            ?: emptyList(),
                    ),
                )
            }
        }

    private fun JSONArray.toAnnotationStrokes(): List<ProductAnnotationStroke> =
        buildList {
            for (strokeIndex in 0 until length()) {
                val pointsArray = optJSONArray(strokeIndex) ?: continue
                val points = buildList {
                    for (pointIndex in 0 until pointsArray.length()) {
                        val pointJson = pointsArray.optJSONObject(pointIndex) ?: continue
                        add(
                            ProductAnnotationPoint(
                                x = pointJson.optDouble("x", 0.0).toFloat(),
                                y = pointJson.optDouble("y", 0.0).toFloat(),
                            ),
                        )
                    }
                }
                if (points.isNotEmpty()) add(ProductAnnotationStroke(points))
            }
        }

    private fun ProductVoiceNote.toJson(): JSONObject =
        JSONObject()
            .put("id", id)
            .put("relativePath", relativePath)
            .put("displayName", displayName)
            .put("screenKey", screenKey)
            .put("screenLabel", screenLabel)
            .put("cardKey", cardKey)
            .put("fieldKey", fieldKey)
            .putNullable("targetKey", targetKey)
            .putNullable("targetLabel", targetLabel)
            .putNullable("itemKey", itemKey)
            .putNullable("itemLabel", itemLabel)
            .put("transcriptStatus", transcriptStatus)
            .put("transcriptText", transcriptText)
            .putNullable("durationMs", durationMs)
            .put("capturedAtIso", capturedAtIso)

    private fun JSONArray.toVoiceNotes(): List<ProductVoiceNote> =
        buildList {
            repeat(length()) { index ->
                val json = optJSONObject(index) ?: return@repeat
                val id = json.optString("id").ifBlank { return@repeat }
                val capturedAtIso = json.optString("capturedAtIso").ifBlank { return@repeat }
                add(
                    ProductVoiceNote(
                        id = id,
                        relativePath = json.optString("relativePath"),
                        displayName = json.optString("displayName"),
                        screenKey = json.optString("screenKey"),
                        screenLabel = json.optString("screenLabel"),
                        cardKey = json.optString("cardKey"),
                        fieldKey = json.optString("fieldKey"),
                        targetKey = json.optNullableString("targetKey"),
                        targetLabel = json.optNullableString("targetLabel"),
                        itemKey = json.optNullableString("itemKey"),
                        itemLabel = json.optNullableString("itemLabel"),
                        transcriptStatus = json.optString("transcriptStatus", "pending_server"),
                        transcriptText = json.optString("transcriptText"),
                        durationMs = json.optNullableLong("durationMs"),
                        capturedAtIso = capturedAtIso,
                    ),
                )
            }
        }

    private fun ProductRoofLayoutMap.toJson(): JSONObject =
        JSONObject()
            .put("roofScope", roofScope.key)
            .put("referenceMode", referenceMode.key)
            .put("rotationDirection", rotationDirection.name)
            .put("template", template.name)
            .put("rowCount", rowCount)
            .put("widestRowPlateCount", widestRowPlateCount)
            .put("ringCount", ringCount)
            .put("sectorCount", sectorCount)
            .put("hasCenterOpening", hasCenterOpening)
            .put("centerOpeningPlateCount", centerOpeningPlateCount)
            .put("hasAnnularRing", hasAnnularRing)
            .put("annularSectionCount", annularSectionCount)

    private fun JSONObject.toRoofLayoutMap(defaults: ProductRoofLayoutMap): ProductRoofLayoutMap =
        ProductRoofLayoutMap(
            roofScope = optRoofScope("roofScope", defaults.roofScope),
            referenceMode = optReferenceMode("referenceMode", defaults.referenceMode),
            rotationDirection = optRotationDirection("rotationDirection", defaults.rotationDirection),
            template = optRoofTemplate("template", defaults.template),
            rowCount = optString("rowCount", defaults.rowCount),
            widestRowPlateCount = optString("widestRowPlateCount", defaults.widestRowPlateCount),
            ringCount = optString("ringCount", defaults.ringCount),
            sectorCount = optString("sectorCount", defaults.sectorCount),
            hasCenterOpening = optBoolean("hasCenterOpening", defaults.hasCenterOpening),
            centerOpeningPlateCount = optString("centerOpeningPlateCount", defaults.centerOpeningPlateCount),
            hasAnnularRing = optBoolean("hasAnnularRing", defaults.hasAnnularRing),
            annularSectionCount = optString("annularSectionCount", defaults.annularSectionCount),
        )

    private fun Map<ProductLayoutTarget, ProductCustomCircularPlateLayout>.toCustomCircularLayoutsJson(): JSONObject =
        JSONObject().apply {
            forEach { (target, layout) -> put(target.key, layout.toJson()) }
        }

    private fun ProductCustomCircularPlateLayout.toJson(): JSONObject =
        JSONObject()
            .put("annularRotationDeg", annularRotationDeg)
            .put("rowGroups", JSONArray().apply { rowGroups.forEach { group -> put(group.toJson()) } })
            .put("rows", JSONArray().apply { rows.forEach { row -> put(row.toJson()) } })

    private fun ProductCustomCircularRowGroup.toJson(): JSONObject =
        JSONObject()
            .put("groupId", groupId)
            .put("rowNumbers", JSONArray().apply { rowNumbers.sorted().forEach { rowNumber -> put(rowNumber) } })

    private fun ProductCustomCircularPlateRow.toJson(): JSONObject =
        JSONObject()
            .put("rowNumber", rowNumber)
            .put("shiftRatio", shiftRatio)
            .put("heightWeight", heightWeight)
            .put("plates", JSONArray().apply { plates.forEach { plate -> put(plate.toJson()) } })

    private fun ProductCustomCircularPlate.toJson(): JSONObject =
        JSONObject()
            .put("widthWeight", widthWeight)
            .putNullable("splitGroupKey", splitGroupKey)
            .put("splitPartIndex", splitPartIndex)
            .put("splitPartCount", splitPartCount)
            .putNullable("verticalMergeGroupKey", verticalMergeGroupKey)

    private fun JSONObject.optCustomCircularLayoutMap(
        key: String,
        defaults: Map<ProductLayoutTarget, ProductCustomCircularPlateLayout>,
    ): Map<ProductLayoutTarget, ProductCustomCircularPlateLayout> {
        val json = optJSONObject(key) ?: return defaults
        return buildMap {
            json.keys().forEach { targetKey ->
                val target = targetByKey(targetKey) ?: return@forEach
                val layout = json.optJSONObject(targetKey)?.toCustomCircularPlateLayout() ?: return@forEach
                put(target, layout)
            }
        }
    }

    private fun JSONObject.toCustomCircularPlateLayout(): ProductCustomCircularPlateLayout =
        ProductCustomCircularPlateLayout(
            annularRotationDeg = optDouble("annularRotationDeg", 0.0).toFloat(),
            rowGroups = optJSONArray("rowGroups")?.let { groups ->
                buildList {
                    repeat(groups.length()) { index ->
                        groups.optJSONObject(index)?.toCustomCircularRowGroup()?.let { group ->
                            add(group)
                        }
                    }
                }
            }.orEmpty(),
            rows = optJSONArray("rows")?.let { rows ->
                buildList {
                    repeat(rows.length()) { index ->
                        rows.optJSONObject(index)?.toCustomCircularPlateRow()?.let { row ->
                            add(row)
                        }
                    }
                }
            }.orEmpty(),
        )

    private fun JSONObject.toCustomCircularRowGroup(): ProductCustomCircularRowGroup =
        ProductCustomCircularRowGroup(
            groupId = optString("groupId", ""),
            rowNumbers = optJSONArray("rowNumbers")?.let { rowNumbers ->
                buildSet {
                    repeat(rowNumbers.length()) { index ->
                        val rowNumber = rowNumbers.optInt(index, 0)
                        if (rowNumber > 0) add(rowNumber)
                    }
                }
            }.orEmpty(),
        )

    private fun JSONObject.toCustomCircularPlateRow(): ProductCustomCircularPlateRow =
        ProductCustomCircularPlateRow(
            rowNumber = optInt("rowNumber", 1),
            shiftRatio = optDouble("shiftRatio", 0.0).toFloat(),
            heightWeight = optDouble("heightWeight", 1.0).toFloat(),
            plates = optJSONArray("plates")?.let { plates ->
                buildList {
                    repeat(plates.length()) { index ->
                        plates.optJSONObject(index)?.toCustomCircularPlate()?.let { plate ->
                            add(plate)
                        }
                    }
                }
            }.orEmpty(),
        )

    private fun JSONObject.toCustomCircularPlate(): ProductCustomCircularPlate =
        ProductCustomCircularPlate(
            widthWeight = optDouble("widthWeight", 1.0).toFloat(),
            splitGroupKey = optNullableString("splitGroupKey"),
            splitPartIndex = optInt("splitPartIndex", 0),
            splitPartCount = optInt("splitPartCount", 1),
            verticalMergeGroupKey = optNullableString("verticalMergeGroupKey"),
        )

    private fun JSONObject.putNullable(key: String, value: Any?): JSONObject =
        put(key, value ?: JSONObject.NULL)

    private fun JSONArray.toStringList(): List<String> =
        buildList {
            repeat(length()) { index -> add(optString(index)) }
        }

    private fun JSONObject.toIntMap(): Map<String, Int> =
        buildMap {
            keys().forEach { key -> put(key, optInt(key)) }
        }

    private fun Set<ProductLayoutTarget>.toTargetArray(): JSONArray =
        JSONArray().apply { forEach { target -> put(target.key) } }

    private fun JSONObject.optTargetSet(key: String, defaults: Set<ProductLayoutTarget>): Set<ProductLayoutTarget> {
        val array = optJSONArray(key) ?: return defaults
        return buildSet {
            repeat(array.length()) { index ->
                targetByKey(array.optString(index))?.let(::add)
            }
        }
    }

    private fun JSONObject.optNullableString(key: String): String? =
        if (!has(key) || isNull(key)) null else optString(key)

    private fun JSONObject.optNullableInt(key: String): Int? =
        if (!has(key) || isNull(key)) null else optInt(key)

    private fun JSONObject.optNullableLong(key: String): Long? =
        if (!has(key) || isNull(key)) null else optLong(key)

    private fun JSONObject.optTarget(key: String, default: ProductLayoutTarget?): ProductLayoutTarget? =
        targetByKey(optString(key)) ?: default

    private fun JSONObject.optSurface(key: String, default: ProductLayoutSurface): ProductLayoutSurface =
        ProductLayoutSurface.entries.firstOrNull { it.key == optString(key) } ?: default

    private fun JSONObject.optRoofScope(key: String, default: ProductRoofScope): ProductRoofScope =
        ProductRoofScope.entries.firstOrNull { it.key == optString(key) } ?: default

    private fun JSONObject.optReferenceMode(key: String, default: ProductReferenceMode): ProductReferenceMode =
        ProductReferenceMode.entries.firstOrNull { it.key == optString(key) } ?: default

    private fun JSONObject.optFloorTemplate(key: String, default: ProductFloorTemplate): ProductFloorTemplate =
        ProductFloorTemplate.entries.firstOrNull { it.key == optString(key) } ?: default

    private fun JSONObject.optShellOffsetStartRow(
        key: String,
        default: ProductShellOffsetStartRow,
    ): ProductShellOffsetStartRow =
        ProductShellOffsetStartRow.entries.firstOrNull { it.key == optString(key) } ?: default

    private fun JSONObject.optShellThirdOffsetStart(
        key: String,
        default: ProductShellThirdOffsetStart,
    ): ProductShellThirdOffsetStart =
        ProductShellThirdOffsetStart.entries.firstOrNull { it.key == optString(key) } ?: default

    private fun JSONObject.optElementType(key: String, default: ProductElementType): ProductElementType =
        elementTypeByKey(optString(key)) ?: default

    private fun JSONObject.optRotationDirection(key: String, default: RotationDirection): RotationDirection =
        optEnumName(key, default) ?: default

    private fun JSONObject.optRoofTemplate(key: String, default: RoofTemplate): RoofTemplate =
        optEnumName(key, default) ?: default

    private inline fun <reified T : Enum<T>> JSONObject.optEnumName(key: String, default: T?): T? =
        runCatching { enumValueOf<T>(optString(key)) }.getOrNull() ?: default

    private fun targetByKey(key: String): ProductLayoutTarget? =
        ProductLayoutTarget.entries.firstOrNull { it.key == key }

    private fun elementTypeByKey(key: String): ProductElementType? =
        ProductElementType.entries.firstOrNull { it.key == key }
}

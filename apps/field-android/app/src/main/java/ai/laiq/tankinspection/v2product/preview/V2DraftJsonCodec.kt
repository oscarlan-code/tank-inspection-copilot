package ai.laiq.tankinspection.v2product.preview

import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.domain.model.RotationDirection
import ai.laiq.tankinspection.v2product.model.V2DraftState
import ai.laiq.tankinspection.v2product.model.V2ElementPlacementState
import ai.laiq.tankinspection.v2product.model.V2ElementSetup
import ai.laiq.tankinspection.v2product.model.V2ElementType
import ai.laiq.tankinspection.v2product.model.V2FloorTemplate
import ai.laiq.tankinspection.v2product.model.V2AnnotationPoint
import ai.laiq.tankinspection.v2product.model.V2AnnotationStroke
import ai.laiq.tankinspection.v2product.model.V2ChecklistRating
import ai.laiq.tankinspection.v2product.model.V2FindingPhoto
import ai.laiq.tankinspection.v2product.model.V2FindingRecord
import ai.laiq.tankinspection.v2product.model.V2FindingState
import ai.laiq.tankinspection.v2product.model.V2GeneralTankInfo
import ai.laiq.tankinspection.v2product.model.V2InspectionChecklistCatalog
import ai.laiq.tankinspection.v2product.model.V2InspectionChecklistState
import ai.laiq.tankinspection.v2product.model.V2LayoutMapSetup
import ai.laiq.tankinspection.v2product.model.V2LayoutScope
import ai.laiq.tankinspection.v2product.model.V2LayoutSurface
import ai.laiq.tankinspection.v2product.model.V2LayoutTarget
import ai.laiq.tankinspection.v2product.model.V2PlacedElement
import ai.laiq.tankinspection.v2product.model.V2ReferenceMode
import ai.laiq.tankinspection.v2product.model.V2RoofLayoutMap
import ai.laiq.tankinspection.v2product.model.V2RoofScope
import ai.laiq.tankinspection.v2product.model.V2ShellOffsetStartRow
import ai.laiq.tankinspection.v2product.model.V2ShellThirdOffsetStart
import ai.laiq.tankinspection.v2product.model.V2UtItemKind
import ai.laiq.tankinspection.v2product.model.V2UtMeasurementEntry
import ai.laiq.tankinspection.v2product.model.V2UtMeasurementState
import ai.laiq.tankinspection.v2product.model.V2UtSetup
import ai.laiq.tankinspection.v2product.model.defaultV2PreviewDraftState
import ai.laiq.tankinspection.v2product.model.normalizedRoofPresence
import ai.laiq.tankinspection.v2product.model.withReconciledGeneralTankInfo
import org.json.JSONArray
import org.json.JSONObject

object V2DraftJsonCodec {
    fun encode(state: V2DraftState): String =
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
            .toString()

    fun decode(raw: String): V2DraftState {
        val json = JSONObject(raw)
        val defaults = defaultV2PreviewDraftState()
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
        )
        return decoded.withReconciledGeneralTankInfo(decoded.generalTankInfo)
    }

    private fun V2GeneralTankInfo.toJson(): JSONObject =
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

    private fun JSONObject.toGeneralTankInfo(defaults: V2GeneralTankInfo): V2GeneralTankInfo =
        V2GeneralTankInfo(
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

    private fun V2LayoutScope.toJson(): JSONObject =
        JSONObject()
            .put("externalRoof", externalRoof)
            .put("internalRoof", internalRoof)
            .put("shell", shell)
            .put("floor", floor)

    private fun JSONObject.toLayoutScope(defaults: V2LayoutScope): V2LayoutScope =
        V2LayoutScope(
            externalRoof = optBoolean("externalRoof", defaults.externalRoof),
            internalRoof = optBoolean("internalRoof", defaults.internalRoof),
            shell = optBoolean("shell", defaults.shell),
            floor = optBoolean("floor", defaults.floor),
        )

    private fun V2ElementSetup.toJson(): JSONObject =
        JSONObject()
            .put("externalRoof", externalRoof)
            .put("internalRoof", internalRoof)
            .put("shell", shell)
            .put("floor", floor)

    private fun JSONObject.toElementSetup(defaults: V2ElementSetup): V2ElementSetup =
        V2ElementSetup(
            externalRoof = optBoolean("externalRoof", defaults.externalRoof),
            internalRoof = optBoolean("internalRoof", defaults.internalRoof),
            shell = optBoolean("shell", defaults.shell),
            floor = optBoolean("floor", defaults.floor),
        )

    private fun V2UtSetup.toJson(): JSONObject =
        JSONObject()
            .put("externalRoof", externalRoof)
            .put("internalRoof", internalRoof)
            .put("shell", shell)
            .put("floor", floor)

    private fun JSONObject.toUtSetup(defaults: V2UtSetup): V2UtSetup =
        V2UtSetup(
            externalRoof = optBoolean("externalRoof", defaults.externalRoof),
            internalRoof = optBoolean("internalRoof", defaults.internalRoof),
            shell = optBoolean("shell", defaults.shell),
            floor = optBoolean("floor", defaults.floor),
        )

    private fun V2LayoutMapSetup.toJson(): JSONObject =
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
            .put("approvedTargets", approvedTargets.toTargetArray())

    private fun JSONObject.toLayoutMapSetup(defaults: V2LayoutMapSetup): V2LayoutMapSetup =
        V2LayoutMapSetup(
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
            approvedTargets = optTargetSet("approvedTargets", defaults.approvedTargets),
        )

    private fun V2ElementPlacementState.toJson(): JSONObject =
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

    private fun JSONObject.toElementPlacement(defaults: V2ElementPlacementState): V2ElementPlacementState {
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
                                    V2PlacedElement(
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
        return V2ElementPlacementState(
            selectedTarget = optTarget("selectedTarget", defaults.selectedTarget) ?: defaults.selectedTarget,
            selectedElementType = optElementType("selectedElementType", defaults.selectedElementType),
            selectedElementId = optNullableString("selectedElementId"),
            placementsByTarget = placementsByTarget.ifEmpty { defaults.placementsByTarget },
            approvedTargets = optTargetSet("approvedTargets", defaults.approvedTargets),
            nextElementIndexByTargetAndType = optJSONObject("nextElementIndexByTargetAndType")?.toIntMap()
                ?: defaults.nextElementIndexByTargetAndType,
        )
    }

    private fun V2UtMeasurementState.toJson(): JSONObject =
        JSONObject()
            .put("selectedTarget", selectedTarget.key)
            .putNullable("activeItemKey", activeItemKey)
            .put("entriesByItemKey", JSONObject().apply {
                entriesByItemKey.forEach { (key, entry) -> put(key, entry.toJson()) }
            })
            .put("approvedTargets", approvedTargets.toTargetArray())

    private fun V2UtMeasurementEntry.toJson(): JSONObject =
        JSONObject()
            .put("itemKey", itemKey)
            .put("target", target.key)
            .put("itemLabel", itemLabel)
            .put("kind", kind.name)
            .putNullable("elementType", elementType?.key)
            .put("nozzleSize", nozzleSize)
            .put("readings", JSONArray().apply { readings.forEach(::put) })
            .put("confirmed", confirmed)

    private fun JSONObject.toUtMeasurements(defaults: V2UtMeasurementState): V2UtMeasurementState {
        val entries = optJSONObject("entriesByItemKey")?.let { entriesJson ->
            buildMap {
                entriesJson.keys().forEach { key ->
                    entriesJson.optJSONObject(key)?.toUtEntry()?.let { entry ->
                        put(key, entry)
                    }
                }
            }
        } ?: defaults.entriesByItemKey
        return V2UtMeasurementState(
            selectedTarget = optTarget("selectedTarget", defaults.selectedTarget) ?: defaults.selectedTarget,
            activeItemKey = optNullableString("activeItemKey"),
            entriesByItemKey = entries,
            approvedTargets = optTargetSet("approvedTargets", defaults.approvedTargets),
        )
    }

    private fun JSONObject.toUtEntry(): V2UtMeasurementEntry? {
        val target = optTarget("target", null) ?: return null
        val kind = optEnumName<V2UtItemKind>("kind", null) ?: return null
        val itemKey = optString("itemKey").ifBlank { return null }
        return V2UtMeasurementEntry(
            itemKey = itemKey,
            target = target,
            itemLabel = optString("itemLabel"),
            kind = kind,
            elementType = optNullableString("elementType")?.let(::elementTypeByKey),
            nozzleSize = optString("nozzleSize", "6 in"),
            readings = optJSONArray("readings")?.toStringList() ?: emptyList(),
            confirmed = optBoolean("confirmed", false),
        )
    }

    private fun V2InspectionChecklistState.toJson(): JSONObject =
        JSONObject()
            .put("selectedSectionKey", selectedSectionKey)
            .put("ratingsByItemNumber", JSONObject().apply {
                ratingsByItemNumber.forEach { (itemNumber, rating) ->
                    put(itemNumber.toString(), rating.key)
                }
            })
            .put("sectionComments", JSONObject().apply {
                sectionComments.forEach { (sectionKey, comment) -> put(sectionKey, comment) }
            })

    private fun JSONObject.toInspectionChecklist(
        defaults: V2InspectionChecklistState,
    ): V2InspectionChecklistState {
        val ratingsByItemNumber = optJSONObject("ratingsByItemNumber")?.let { ratingsJson ->
            buildMap {
                ratingsJson.keys().forEach { key ->
                    val itemNumber = key.toIntOrNull() ?: return@forEach
                    if (itemNumber !in V2InspectionChecklistCatalog.itemNumbers) return@forEach
                    val rating = V2ChecklistRating.fromKey(ratingsJson.optString(key)) ?: return@forEach
                    put(itemNumber, rating)
                }
            }
        } ?: defaults.ratingsByItemNumber
        val sectionComments = optJSONObject("sectionComments")?.let { commentsJson ->
            buildMap {
                commentsJson.keys().forEach { key ->
                    val value = commentsJson.optString(key).trim()
                    if (value.isNotBlank()) put(key, value)
                }
            }
        } ?: defaults.sectionComments
        val selectedSectionKey = optString("selectedSectionKey", defaults.selectedSectionKey)
            .takeIf { key -> V2InspectionChecklistCatalog.sections.any { section -> section.key == key } }
            ?: defaults.selectedSectionKey
        return V2InspectionChecklistState(
            selectedSectionKey = selectedSectionKey,
            ratingsByItemNumber = ratingsByItemNumber,
            sectionComments = sectionComments,
        )
    }

    private fun V2FindingState.toJson(): JSONObject =
        JSONObject()
            .putNullable("activeItemKey", activeItemKey)
            .put("findingsByItemKey", JSONObject().apply {
                findingsByItemKey.forEach { (key, finding) -> put(key, finding.toJson()) }
            })

    private fun V2FindingRecord.toJson(): JSONObject =
        JSONObject()
            .put("itemKey", itemKey)
            .put("target", target.key)
            .put("itemLabel", itemLabel)
            .put("itemKind", itemKind.name)
            .putNullable("elementType", elementType?.key)
            .put("note", note)
            .putNullable("selectedPhotoId", selectedPhotoId)
            .put("photos", JSONArray().apply { photos.forEach { photo -> put(photo.toJson()) } })

    private fun V2FindingPhoto.toJson(): JSONObject =
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

    private fun JSONObject.toFindingState(defaults: V2FindingState): V2FindingState {
        val findings = optJSONObject("findingsByItemKey")?.let { findingsJson ->
            buildMap {
                findingsJson.keys().forEach { key ->
                    findingsJson.optJSONObject(key)?.toFindingRecord()?.let { finding ->
                        put(key, finding)
                    }
                }
            }
        } ?: defaults.findingsByItemKey
        return V2FindingState(
            activeItemKey = optNullableString("activeItemKey"),
            findingsByItemKey = findings,
        )
    }

    private fun JSONObject.toFindingRecord(): V2FindingRecord? {
        val target = optTarget("target", null) ?: return null
        val itemKind = optEnumName<V2UtItemKind>("itemKind", null) ?: return null
        val itemKey = optString("itemKey").ifBlank { return null }
        return V2FindingRecord(
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

    private fun JSONArray.toFindingPhotos(): List<V2FindingPhoto> =
        buildList {
            repeat(length()) { index ->
                val json = optJSONObject(index) ?: return@repeat
                val id = json.optString("id").ifBlank { return@repeat }
                add(
                    V2FindingPhoto(
                        id = id,
                        relativePath = json.optString("relativePath"),
                        displayName = json.optString("displayName"),
                        annotationStrokes = json.optJSONArray("annotationStrokes")?.toAnnotationStrokes()
                            ?: emptyList(),
                    ),
                )
            }
        }

    private fun JSONArray.toAnnotationStrokes(): List<V2AnnotationStroke> =
        buildList {
            for (strokeIndex in 0 until length()) {
                val pointsArray = optJSONArray(strokeIndex) ?: continue
                val points = buildList {
                    for (pointIndex in 0 until pointsArray.length()) {
                        val pointJson = pointsArray.optJSONObject(pointIndex) ?: continue
                        add(
                            V2AnnotationPoint(
                                x = pointJson.optDouble("x", 0.0).toFloat(),
                                y = pointJson.optDouble("y", 0.0).toFloat(),
                            ),
                        )
                    }
                }
                if (points.isNotEmpty()) add(V2AnnotationStroke(points))
            }
        }

    private fun V2RoofLayoutMap.toJson(): JSONObject =
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

    private fun JSONObject.toRoofLayoutMap(defaults: V2RoofLayoutMap): V2RoofLayoutMap =
        V2RoofLayoutMap(
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

    private fun Set<V2LayoutTarget>.toTargetArray(): JSONArray =
        JSONArray().apply { forEach { target -> put(target.key) } }

    private fun JSONObject.optTargetSet(key: String, defaults: Set<V2LayoutTarget>): Set<V2LayoutTarget> {
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

    private fun JSONObject.optTarget(key: String, default: V2LayoutTarget?): V2LayoutTarget? =
        targetByKey(optString(key)) ?: default

    private fun JSONObject.optSurface(key: String, default: V2LayoutSurface): V2LayoutSurface =
        V2LayoutSurface.entries.firstOrNull { it.key == optString(key) } ?: default

    private fun JSONObject.optRoofScope(key: String, default: V2RoofScope): V2RoofScope =
        V2RoofScope.entries.firstOrNull { it.key == optString(key) } ?: default

    private fun JSONObject.optReferenceMode(key: String, default: V2ReferenceMode): V2ReferenceMode =
        V2ReferenceMode.entries.firstOrNull { it.key == optString(key) } ?: default

    private fun JSONObject.optFloorTemplate(key: String, default: V2FloorTemplate): V2FloorTemplate =
        V2FloorTemplate.entries.firstOrNull { it.key == optString(key) } ?: default

    private fun JSONObject.optShellOffsetStartRow(
        key: String,
        default: V2ShellOffsetStartRow,
    ): V2ShellOffsetStartRow =
        V2ShellOffsetStartRow.entries.firstOrNull { it.key == optString(key) } ?: default

    private fun JSONObject.optShellThirdOffsetStart(
        key: String,
        default: V2ShellThirdOffsetStart,
    ): V2ShellThirdOffsetStart =
        V2ShellThirdOffsetStart.entries.firstOrNull { it.key == optString(key) } ?: default

    private fun JSONObject.optElementType(key: String, default: V2ElementType): V2ElementType =
        elementTypeByKey(optString(key)) ?: default

    private fun JSONObject.optRotationDirection(key: String, default: RotationDirection): RotationDirection =
        optEnumName(key, default) ?: default

    private fun JSONObject.optRoofTemplate(key: String, default: RoofTemplate): RoofTemplate =
        optEnumName(key, default) ?: default

    private inline fun <reified T : Enum<T>> JSONObject.optEnumName(key: String, default: T?): T? =
        runCatching { enumValueOf<T>(optString(key)) }.getOrNull() ?: default

    private fun targetByKey(key: String): V2LayoutTarget? =
        V2LayoutTarget.entries.firstOrNull { it.key == key }

    private fun elementTypeByKey(key: String): V2ElementType? =
        V2ElementType.entries.firstOrNull { it.key == key }
}

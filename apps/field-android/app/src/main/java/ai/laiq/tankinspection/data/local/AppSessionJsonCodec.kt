package ai.laiq.tankinspection.data.local

import ai.laiq.tankinspection.domain.model.AttachmentRecord
import ai.laiq.tankinspection.domain.model.FindingRecord
import ai.laiq.tankinspection.domain.model.MeasurementCaptureState
import ai.laiq.tankinspection.domain.model.MeasurementUnit
import ai.laiq.tankinspection.domain.model.NozzleDefinition
import ai.laiq.tankinspection.domain.model.NozzleSizeUnit
import ai.laiq.tankinspection.domain.model.NozzleUtRow
import ai.laiq.tankinspection.domain.model.PlumbnessSurvey
import ai.laiq.tankinspection.domain.model.PlumbnessSurveyStation
import ai.laiq.tankinspection.domain.model.ReferenceMode
import ai.laiq.tankinspection.domain.model.RoundnessSurvey
import ai.laiq.tankinspection.domain.model.RoundnessSurveyBand
import ai.laiq.tankinspection.domain.model.RoundnessSurveyStation
import ai.laiq.tankinspection.domain.model.RoofFeature
import ai.laiq.tankinspection.domain.model.RoofTemplate
import ai.laiq.tankinspection.domain.model.RoofUtRow
import ai.laiq.tankinspection.domain.model.RotationDirection
import ai.laiq.tankinspection.domain.model.ShellSettlementStation
import ai.laiq.tankinspection.domain.model.ShellSettlementSurvey
import ai.laiq.tankinspection.domain.model.ShellUtRow
import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.FieldTask
import ai.laiq.tankinspection.presentation.FindingDraftInput
import ai.laiq.tankinspection.presentation.MflImportDraftInput
import ai.laiq.tankinspection.presentation.NozzleUtDraftInput
import ai.laiq.tankinspection.presentation.PlumbnessSurveyDraftInput
import ai.laiq.tankinspection.presentation.PlumbnessSurveyStationDraftInput
import ai.laiq.tankinspection.presentation.ProductScreen
import ai.laiq.tankinspection.presentation.ROOF_SURFACE_FIXED
import ai.laiq.tankinspection.presentation.ROOF_SURFACE_FLOATING
import ai.laiq.tankinspection.presentation.RoofFeatureDraftInput
import ai.laiq.tankinspection.presentation.buildRoofLayoutFromDraftOrNull
import ai.laiq.tankinspection.presentation.currentShellPlanKey
import ai.laiq.tankinspection.presentation.defaultShellSettlementStationDrafts
import ai.laiq.tankinspection.presentation.isReadyForInspection
import ai.laiq.tankinspection.presentation.normalizedReferenceMode
import ai.laiq.tankinspection.presentation.referenceAzimuthDeg
import ai.laiq.tankinspection.presentation.RoofLayoutDraftInput
import ai.laiq.tankinspection.presentation.RoofNozzleDraftInput
import ai.laiq.tankinspection.presentation.RoofUtDraftInput
import ai.laiq.tankinspection.presentation.ScopeFormState
import ai.laiq.tankinspection.presentation.SetupFormState
import ai.laiq.tankinspection.presentation.RoundnessSurveyDraftInput
import ai.laiq.tankinspection.presentation.RoundnessSurveyStationDraftInput
import ai.laiq.tankinspection.presentation.ShellSettlementDraftInput
import ai.laiq.tankinspection.presentation.ShellSettlementStationDraftInput
import ai.laiq.tankinspection.presentation.ShellNozzleDraftInput
import ai.laiq.tankinspection.presentation.ShellUtDraftInput
import ai.laiq.tankinspection.presentation.StartReference
import ai.laiq.tankinspection.presentation.availableRoofSurfaces
import ai.laiq.tankinspection.presentation.defaultPlumbnessSurveyStationDrafts
import ai.laiq.tankinspection.presentation.defaultRoundnessSurveyStationDrafts
import ai.laiq.tankinspection.presentation.roofSystemLabel
import org.json.JSONArray
import org.json.JSONObject

object AppSessionJsonCodec {
    fun encode(session: SavedAppSession): String {
        val root = JSONObject()
        root.put("currentScreen", session.currentScreen.name)
        root.put("draftState", encodeDraftState(session.draftState))
        return root.toString()
    }

    fun decode(raw: String): SavedAppSession {
        val root = JSONObject(raw)
        return SavedAppSession(
            currentScreen = enumValueOf(root.getString("currentScreen")),
            draftState = decodeDraftState(root.getJSONObject("draftState")),
        )
    }

    fun parseObject(raw: String): JSONObject = JSONObject(raw)

    fun encodeDraftState(state: FieldDraftState): JSONObject = JSONObject().apply {
        put("startedAtIso", state.startedAtIso)
        put("persistedInspectionId", state.persistedInspectionId)
        put("persistedPackageId", state.persistedPackageId)
        put("setup", JSONObject().apply {
            put("client", state.setup.client)
            put("site", state.setup.site)
            put("tankNumber", state.setup.tankNumber)
            put("diameterM", state.setup.diameterM)
            put("heightM", state.setup.heightM)
            put("shellCourseCount", state.setup.shellCourseCount)
            put("roofType", state.setup.roofSystemLabel())
            put("fixedRoofType", state.setup.fixedRoofType)
            put("floatingRoofType", state.setup.floatingRoofType)
            put("inspector", state.setup.inspector)
            put("thicknessUnit", state.setup.thicknessUnit.name)
            put("settlementUnit", state.setup.settlementUnit.name)
            put("nozzleSizeUnit", state.setup.nozzleSizeUnit.name)
        })
        put("scope", JSONObject().apply {
            put("referenceMode", state.scope.referenceMode.name)
            put("startReference", state.scope.startReference.name)
            put("referenceRemark", state.scope.referenceRemark)
            put("rotationDirection", state.scope.rotationDirection.name)
            put("selectedTasks", JSONArray(state.scope.selectedTasks.map { it.name }))
        })
        put("savedReferenceBaselineKey", state.savedReferenceBaselineKey)
        put("savedSetupBaseline", state.savedSetupBaseline?.let { savedSetup ->
            JSONObject().apply {
                put("client", savedSetup.client)
                put("site", savedSetup.site)
                put("tankNumber", savedSetup.tankNumber)
                put("diameterM", savedSetup.diameterM)
                put("heightM", savedSetup.heightM)
                put("shellCourseCount", savedSetup.shellCourseCount)
                put("roofType", savedSetup.roofSystemLabel())
                put("fixedRoofType", savedSetup.fixedRoofType)
                put("floatingRoofType", savedSetup.floatingRoofType)
                put("inspector", savedSetup.inspector)
                put("thicknessUnit", savedSetup.thicknessUnit.name)
                put("settlementUnit", savedSetup.settlementUnit.name)
                put("nozzleSizeUnit", savedSetup.nozzleSizeUnit.name)
            }
        })
        put("savedScopeBaseline", state.savedScopeBaseline?.let { savedScope ->
            JSONObject().apply {
                put("referenceMode", savedScope.referenceMode.name)
                put("startReference", savedScope.startReference.name)
                put("referenceRemark", savedScope.referenceRemark)
                put("rotationDirection", savedScope.rotationDirection.name)
                put("selectedTasks", JSONArray(savedScope.selectedTasks.map { it.name }))
            }
        })
        put("shellLineCountOverride", state.shellLineCountOverride)
        put("savedShellLineCountOverride", state.savedShellLineCountOverride)
        put("shellCaptureStartLaneId", state.shellCaptureStartLaneId)
        put("savedShellCaptureStartLaneId", state.savedShellCaptureStartLaneId)
        put("savedShellPlanKey", state.savedShellPlanKey)
        put("shellUtDraft", JSONObject().apply {
            put("editingRowId", state.shellUtDraft.editingRowId)
            put("selectedLineId", state.shellUtDraft.selectedLineId)
            put("course", state.shellUtDraft.course)
            put("captureState", state.shellUtDraft.captureState.name)
            put("readings", JSONArray(state.shellUtDraft.readings))
            put("note", state.shellUtDraft.note)
        })
        put("shellUtRows", encodeShellUtRows(state.shellUtRows))
        put("shellSettlementDraft", JSONObject().apply {
            put("stationCount", state.shellSettlementDraft.stationCount)
            put("stations", JSONArray(state.shellSettlementDraft.stations.map { station ->
                JSONObject().apply {
                    put("stationId", station.stationId)
                    put("angleDeg", station.angleDeg)
                    put("elevation", station.elevation)
                    put("captureState", station.captureState.name)
                    put("note", station.note)
                }
            }))
        })
        put("savedShellSettlementSurvey", state.savedShellSettlementSurvey?.let { survey ->
            JSONObject().apply {
                put("stationCount", survey.stationCount)
                put("stations", JSONArray(survey.stations.map { station ->
                    JSONObject().apply {
                        put("stationId", station.stationId)
                        put("angleDeg", station.angleDeg)
                        put("elevation", station.elevation)
                        put("captureState", station.captureState.name)
                        put("note", station.note)
                    }
                }))
            }
        })
        put("roundnessSurveyDraft", JSONObject().apply {
            put("editingSurveyId", state.roundnessSurveyDraft.editingSurveyId)
            put("surveyLabel", state.roundnessSurveyDraft.surveyLabel)
            put("heightReference", state.roundnessSurveyDraft.heightReference)
            put("stationCount", state.roundnessSurveyDraft.stationCount)
            put("stations", JSONArray(state.roundnessSurveyDraft.stations.map { station ->
                JSONObject().apply {
                    put("stationId", station.stationId)
                    put("angleDeg", station.angleDeg)
                    put("easting", station.easting)
                    put("northing", station.northing)
                    put("captureState", station.captureState.name)
                    put("note", station.note)
                }
            }))
        })
        put("savedRoundnessSurvey", state.savedRoundnessSurvey?.let { survey ->
            JSONObject().apply {
                put("surveys", JSONArray(survey.surveys.map { band ->
                    JSONObject().apply {
                        put("surveyId", band.surveyId)
                        put("label", band.label)
                        put("heightReference", band.heightReference)
                        put("stationCount", band.stationCount)
                        put("stations", JSONArray(band.stations.map { station ->
                            JSONObject().apply {
                                put("stationId", station.stationId)
                                put("angleDeg", station.angleDeg)
                                put("easting", station.easting)
                                put("northing", station.northing)
                                put("captureState", station.captureState.name)
                                put("note", station.note)
                            }
                        }))
                    }
                }))
            }
        })
        put("plumbnessSurveyDraft", JSONObject().apply {
            put("stationCount", state.plumbnessSurveyDraft.stationCount)
            put("stations", JSONArray(state.plumbnessSurveyDraft.stations.map { station ->
                JSONObject().apply {
                    put("stationId", station.stationId)
                    put("angleDeg", station.angleDeg)
                    put("plumbness", station.plumbness)
                    put("captureState", station.captureState.name)
                    put("note", station.note)
                }
            }))
        })
        put("savedPlumbnessSurvey", state.savedPlumbnessSurvey?.let { survey ->
            JSONObject().apply {
                put("stationCount", survey.stationCount)
                put("stations", JSONArray(survey.stations.map { station ->
                    JSONObject().apply {
                        put("stationId", station.stationId)
                        put("angleDeg", station.angleDeg)
                        put("plumbness", station.plumbness)
                        put("captureState", station.captureState.name)
                        put("note", station.note)
                    }
                }))
            }
        })
        put("fixedRoofLayoutDraft", encodeRoofLayoutDraft(state.fixedRoofLayoutDraft))
        put("savedFixedRoofLayoutDraft", state.savedFixedRoofLayoutDraft?.let(::encodeRoofLayoutDraft))
        put("floatingRoofLayoutDraft", encodeRoofLayoutDraft(state.floatingRoofLayoutDraft))
        put("savedFloatingRoofLayoutDraft", state.savedFloatingRoofLayoutDraft?.let(::encodeRoofLayoutDraft))
        put("activeRoofSurfaceId", state.activeRoofSurfaceId)
        put("roofFeatureDraft", JSONObject().apply {
            put("roofSurfaceId", state.roofFeatureDraft.roofSurfaceId)
            put("editingFeatureId", state.roofFeatureDraft.editingFeatureId)
            put("type", state.roofFeatureDraft.type)
            put("quantity", state.roofFeatureDraft.quantity)
            put("linkedPlateIds", JSONArray(state.roofFeatureDraft.linkedPlateIds))
            put("azimuthDegrees", JSONArray(state.roofFeatureDraft.azimuthDegrees))
            put("radiusRatios", JSONArray(state.roofFeatureDraft.radiusRatios))
            put("label", state.roofFeatureDraft.label)
            put("placementMode", state.roofFeatureDraft.placementMode)
            put("plateId", state.roofFeatureDraft.plateId)
            put("azimuthDeg", state.roofFeatureDraft.azimuthDeg)
            put("radiusRatio", state.roofFeatureDraft.radiusRatio)
        })
        put("roofFeatures", encodeRoofFeatures(state.roofFeatures))
        put("roofUtDraft", JSONObject().apply {
            put("roofSurfaceId", state.roofUtDraft.roofSurfaceId)
            put("editingRowId", state.roofUtDraft.editingRowId)
            put("plateId", state.roofUtDraft.plateId)
            put("captureState", state.roofUtDraft.captureState.name)
            put("readings", JSONArray(state.roofUtDraft.readings))
            put("note", state.roofUtDraft.note)
        })
        put("roofUtRows", encodeRoofUtRows(state.roofUtRows))
        put("shellNozzleDraft", JSONObject().apply {
            put("nozzleId", state.shellNozzleDraft.nozzleId)
            put("size", state.shellNozzleDraft.size)
            put("course", state.shellNozzleDraft.course)
            put("azimuthDeg", state.shellNozzleDraft.azimuthDeg)
            put("placementMode", state.shellNozzleDraft.placementMode)
        })
        put("shellNozzles", encodeNozzleDefinitions(state.shellNozzles))
        put("shellNozzleUtDraft", JSONObject().apply {
            put("editingRowId", state.shellNozzleUtDraft.editingRowId)
            put("nozzleId", state.shellNozzleUtDraft.nozzleId)
            put("captureState", state.shellNozzleUtDraft.captureState.name)
            put("readings", JSONArray(state.shellNozzleUtDraft.readings))
            put("note", state.shellNozzleUtDraft.note)
        })
        put("shellNozzleUtRows", encodeNozzleUtRows(state.shellNozzleUtRows))
        put("roofNozzleDraft", JSONObject().apply {
            put("roofSurfaceId", state.roofNozzleDraft.roofSurfaceId)
            put("nozzleId", state.roofNozzleDraft.nozzleId)
            put("size", state.roofNozzleDraft.size)
            put("plateId", state.roofNozzleDraft.plateId)
            put("azimuthDeg", state.roofNozzleDraft.azimuthDeg)
            put("placementMode", state.roofNozzleDraft.placementMode)
        })
        put("roofNozzles", encodeNozzleDefinitions(state.roofNozzles))
        put("roofNozzleUtDraft", JSONObject().apply {
            put("roofSurfaceId", state.roofNozzleUtDraft.roofSurfaceId)
            put("editingRowId", state.roofNozzleUtDraft.editingRowId)
            put("nozzleId", state.roofNozzleUtDraft.nozzleId)
            put("captureState", state.roofNozzleUtDraft.captureState.name)
            put("readings", JSONArray(state.roofNozzleUtDraft.readings))
            put("note", state.roofNozzleUtDraft.note)
        })
        put("roofNozzleUtRows", encodeNozzleUtRows(state.roofNozzleUtRows))
            put("findingDraft", JSONObject().apply {
                put("editingFindingId", state.findingDraft.editingFindingId)
                put("surface", state.findingDraft.surface)
                put("type", state.findingDraft.type)
                put("severity", state.findingDraft.severity)
                put("note", state.findingDraft.note)
                put("linkedMeasurementId", state.findingDraft.linkedMeasurementId)
                put("locationSummary", state.findingDraft.locationSummary)
                put("preciseLineId", state.findingDraft.preciseLineId)
                put("preciseCourse", state.findingDraft.preciseCourse)
                put("preciseOffsetPercent", state.findingDraft.preciseOffsetPercent)
                put("photoCaption", state.findingDraft.photoCaption)
                put("photoRelativePath", state.findingDraft.photoRelativePath)
            })
        put("findings", encodeFindings(state.findings))
        put("attachments", encodeAttachments(state.attachments))
        put("mflImportDraft", JSONObject().apply {
            put("contractor", state.mflImportDraft.contractor)
            put("reportReference", state.mflImportDraft.reportReference)
            put("reportDate", state.mflImportDraft.reportDate)
            put("severity", state.mflImportDraft.severity)
            put("pdfRelativePath", state.mflImportDraft.pdfRelativePath)
            put("pdfCaption", state.mflImportDraft.pdfCaption)
            put("attachmentId", state.mflImportDraft.attachmentId)
        })
    }

    fun decodeDraftState(json: JSONObject): FieldDraftState {
        val setupJson = json.getJSONObject("setup")
        val scopeJson = json.getJSONObject("scope")
        val savedSetupJson = json.optJSONObject("savedSetupBaseline")
        val savedScopeJson = json.optJSONObject("savedScopeBaseline")
        val shellUtDraftJson = json.optJSONObject("shellUtDraft") ?: JSONObject()
        val shellSettlementDraftJson = json.optJSONObject("shellSettlementDraft") ?: JSONObject()
        val savedShellSettlementJson = json.optJSONObject("savedShellSettlementSurvey")
        val roundnessSurveyDraftJson = json.optJSONObject("roundnessSurveyDraft") ?: JSONObject()
        val savedRoundnessSurveyJson = json.optJSONObject("savedRoundnessSurvey")
        val plumbnessSurveyDraftJson = json.optJSONObject("plumbnessSurveyDraft") ?: JSONObject()
        val savedPlumbnessSurveyJson = json.optJSONObject("savedPlumbnessSurvey")
        val fixedRoofLayoutDraftJson = json.optJSONObject("fixedRoofLayoutDraft")
        val savedFixedRoofLayoutDraftJson = json.optJSONObject("savedFixedRoofLayoutDraft")
        val floatingRoofLayoutDraftJson = json.optJSONObject("floatingRoofLayoutDraft")
        val savedFloatingRoofLayoutDraftJson = json.optJSONObject("savedFloatingRoofLayoutDraft")
        val legacyRoofLayoutDraftJson = json.optJSONObject("roofLayoutDraft")
        val legacySavedRoofLayoutDraftJson = json.optJSONObject("savedRoofLayoutDraft")
        val roofFeatureDraftJson = json.optJSONObject("roofFeatureDraft") ?: JSONObject()
        val roofUtDraftJson = json.optJSONObject("roofUtDraft") ?: JSONObject()
        val shellNozzleDraftJson = json.optJSONObject("shellNozzleDraft") ?: JSONObject()
        val shellNozzleUtDraftJson = json.optJSONObject("shellNozzleUtDraft") ?: JSONObject()
        val roofNozzleDraftJson = json.optJSONObject("roofNozzleDraft") ?: JSONObject()
        val roofNozzleUtDraftJson = json.optJSONObject("roofNozzleUtDraft") ?: JSONObject()
        val findingDraftJson = json.optJSONObject("findingDraft") ?: JSONObject()
        val mflImportDraftJson = json.optJSONObject("mflImportDraft") ?: JSONObject()

        val setupState = decodeSetupFormState(setupJson)
        val savedSetupState = savedSetupJson?.let(::decodeSetupFormState)
        val fixedRoofLayoutDraft = decodeRoofLayoutDraft(
            fixedRoofLayoutDraftJson ?: legacyRoofLayoutDraftJson,
            defaultTemplate = buildRoofLayoutDefaultTemplate(setupState, ROOF_SURFACE_FIXED),
            defaultHasPontoonDeck = false,
        )
        val floatingRoofLayoutDraft = decodeRoofLayoutDraft(
            floatingRoofLayoutDraftJson ?: legacyRoofLayoutDraftJson,
            defaultTemplate = buildRoofLayoutDefaultTemplate(setupState, ROOF_SURFACE_FLOATING),
            defaultHasPontoonDeck = setupState.floatingRoofType == "external",
        )
        val savedFixedRoofLayoutDraft = decodeOptionalRoofLayoutDraft(
            savedFixedRoofLayoutDraftJson ?: legacySavedRoofLayoutDraftJson,
            fallbackTemplate = fixedRoofLayoutDraft.template,
        ) ?: fixedRoofLayoutDraft.takeIf { draft -> buildRoofLayoutFromDraftOrNull(draft).isReadyForInspection() }
        val savedFloatingRoofLayoutDraft = decodeOptionalRoofLayoutDraft(
            savedFloatingRoofLayoutDraftJson ?: legacySavedRoofLayoutDraftJson,
            fallbackTemplate = floatingRoofLayoutDraft.template,
        ) ?: floatingRoofLayoutDraft.takeIf { draft -> buildRoofLayoutFromDraftOrNull(draft).isReadyForInspection() }
        val activeRoofSurfaceId = json.optString("activeRoofSurfaceId").ifBlank {
            setupState.availableRoofSurfaces().firstOrNull()?.roofSurfaceId ?: ROOF_SURFACE_FIXED
        }

        return FieldDraftState(
            startedAtIso = json.optString("startedAtIso").ifBlank { java.time.Instant.now().toString() },
            persistedInspectionId = json.optString("persistedInspectionId").ifBlank { null },
            persistedPackageId = json.optString("persistedPackageId").ifBlank { null },
            setup = setupState,
            scope = ScopeFormState(
                referenceMode = decodeReferenceMode(scopeJson.optString("referenceMode", ReferenceMode.TANK_NORTH.name)),
                startReference = enumValueOf(scopeJson.optString("startReference", StartReference.N.name)),
                referenceRemark = scopeJson.optString("referenceRemark"),
                rotationDirection = enumValueOf(
                    scopeJson.optString("rotationDirection", RotationDirection.CLOCKWISE.name),
                ),
                selectedTasks = decodeTaskSet(scopeJson.optJSONArray("selectedTasks")),
            ),
            savedReferenceBaselineKey = json.optString("savedReferenceBaselineKey").ifBlank { null },
            savedSetupBaseline = savedSetupState,
            savedScopeBaseline = savedScopeJson?.let { baselineJson ->
                ScopeFormState(
                    referenceMode = decodeReferenceMode(
                        baselineJson.optString("referenceMode", ReferenceMode.TANK_NORTH.name),
                    ),
                    startReference = enumValueOf(
                        baselineJson.optString("startReference", StartReference.N.name),
                    ),
                    referenceRemark = baselineJson.optString("referenceRemark"),
                    rotationDirection = enumValueOf(
                        baselineJson.optString("rotationDirection", RotationDirection.CLOCKWISE.name),
                    ),
                    selectedTasks = decodeTaskSet(baselineJson.optJSONArray("selectedTasks")),
                )
            },
            shellLineCountOverride = json.optString("shellLineCountOverride"),
            savedShellLineCountOverride = json.optString("savedShellLineCountOverride"),
            shellCaptureStartLaneId = json.optString("shellCaptureStartLaneId"),
            savedShellCaptureStartLaneId = json.optString("savedShellCaptureStartLaneId"),
            savedShellPlanKey = json.optString("savedShellPlanKey").ifBlank { null },
            shellUtDraft = ShellUtDraftInput(
                editingRowId = shellUtDraftJson.optString("editingRowId").ifBlank { null },
                selectedLineId = shellUtDraftJson.optString("selectedLineId"),
                course = shellUtDraftJson.optString("course"),
                captureState = decodeMeasurementCaptureState(
                    shellUtDraftJson.optString("captureState", MeasurementCaptureState.CAPTURED.name),
                ),
                readings = decodeStringList(shellUtDraftJson.optJSONArray("readings"), expectedSize = 5),
                note = shellUtDraftJson.optString("note"),
            ),
            shellUtRows = decodeShellUtRows(json.optJSONArray("shellUtRows")),
            shellSettlementDraft = decodeShellSettlementDraft(
                shellSettlementDraftJson = shellSettlementDraftJson,
                scope = ScopeFormState(
                    referenceMode = decodeReferenceMode(scopeJson.optString("referenceMode", ReferenceMode.TANK_NORTH.name)),
                    startReference = enumValueOf(scopeJson.optString("startReference", StartReference.N.name)),
                    referenceRemark = scopeJson.optString("referenceRemark"),
                    rotationDirection = enumValueOf(
                        scopeJson.optString("rotationDirection", RotationDirection.CLOCKWISE.name),
                    ),
                    selectedTasks = decodeTaskSet(scopeJson.optJSONArray("selectedTasks")),
                ),
            ),
            savedShellSettlementSurvey = decodeShellSettlementSurvey(savedShellSettlementJson),
            roundnessSurveyDraft = decodeRoundnessSurveyDraft(
                roundnessSurveyDraftJson = roundnessSurveyDraftJson,
                scope = ScopeFormState(
                    referenceMode = decodeReferenceMode(scopeJson.optString("referenceMode", ReferenceMode.TANK_NORTH.name)),
                    startReference = enumValueOf(scopeJson.optString("startReference", StartReference.N.name)),
                    referenceRemark = scopeJson.optString("referenceRemark"),
                    rotationDirection = enumValueOf(
                        scopeJson.optString("rotationDirection", RotationDirection.CLOCKWISE.name),
                    ),
                    selectedTasks = decodeTaskSet(scopeJson.optJSONArray("selectedTasks")),
                ),
            ),
            savedRoundnessSurvey = decodeRoundnessSurvey(savedRoundnessSurveyJson),
            plumbnessSurveyDraft = decodePlumbnessSurveyDraft(
                plumbnessSurveyDraftJson = plumbnessSurveyDraftJson,
                scope = ScopeFormState(
                    referenceMode = decodeReferenceMode(scopeJson.optString("referenceMode", ReferenceMode.TANK_NORTH.name)),
                    startReference = enumValueOf(scopeJson.optString("startReference", StartReference.N.name)),
                    referenceRemark = scopeJson.optString("referenceRemark"),
                    rotationDirection = enumValueOf(
                        scopeJson.optString("rotationDirection", RotationDirection.CLOCKWISE.name),
                    ),
                    selectedTasks = decodeTaskSet(scopeJson.optJSONArray("selectedTasks")),
                ),
            ),
            savedPlumbnessSurvey = decodePlumbnessSurvey(savedPlumbnessSurveyJson),
            fixedRoofLayoutDraft = fixedRoofLayoutDraft,
            savedFixedRoofLayoutDraft = savedFixedRoofLayoutDraft,
            floatingRoofLayoutDraft = floatingRoofLayoutDraft,
            savedFloatingRoofLayoutDraft = savedFloatingRoofLayoutDraft,
            activeRoofSurfaceId = activeRoofSurfaceId,
            roofFeatureDraft = RoofFeatureDraftInput(
                roofSurfaceId = roofFeatureDraftJson.optString("roofSurfaceId").ifBlank { activeRoofSurfaceId },
                editingFeatureId = roofFeatureDraftJson.optString("editingFeatureId").ifBlank { null },
                type = roofFeatureDraftJson.optString("type", "manhole"),
                quantity = roofFeatureDraftJson.optString("quantity", "1"),
                linkedPlateIds = decodeStringList(roofFeatureDraftJson.optJSONArray("linkedPlateIds"), expectedSize = null)
                    .ifEmpty { listOf("") },
                azimuthDegrees = decodeStringList(roofFeatureDraftJson.optJSONArray("azimuthDegrees"), expectedSize = null)
                    .ifEmpty { listOf("") },
                radiusRatios = decodeStringList(roofFeatureDraftJson.optJSONArray("radiusRatios"), expectedSize = null)
                    .ifEmpty { listOf("") },
                label = roofFeatureDraftJson.optString("label"),
                placementMode = roofFeatureDraftJson.optString("placementMode", "plate_linked"),
                plateId = roofFeatureDraftJson.optString("plateId"),
                azimuthDeg = roofFeatureDraftJson.optString("azimuthDeg"),
                radiusRatio = roofFeatureDraftJson.optString("radiusRatio"),
            ),
            roofFeatures = decodeRoofFeatures(json.optJSONArray("roofFeatures")),
            roofUtDraft = RoofUtDraftInput(
                roofSurfaceId = roofUtDraftJson.optString("roofSurfaceId").ifBlank { activeRoofSurfaceId },
                editingRowId = roofUtDraftJson.optString("editingRowId").ifBlank { null },
                plateId = roofUtDraftJson.optString("plateId"),
                captureState = decodeMeasurementCaptureState(
                    roofUtDraftJson.optString("captureState", MeasurementCaptureState.CAPTURED.name),
                ),
                readings = decodeStringList(roofUtDraftJson.optJSONArray("readings"), expectedSize = 5),
                note = roofUtDraftJson.optString("note"),
            ),
            roofUtRows = decodeRoofUtRows(json.optJSONArray("roofUtRows")),
            shellNozzleDraft = ShellNozzleDraftInput(
                nozzleId = shellNozzleDraftJson.optString("nozzleId"),
                size = shellNozzleDraftJson.optString("size"),
                course = shellNozzleDraftJson.optString("course"),
                azimuthDeg = shellNozzleDraftJson.optString("azimuthDeg"),
                placementMode = shellNozzleDraftJson.optString("placementMode", "line_linked"),
            ),
            shellNozzles = decodeNozzleDefinitions(json.optJSONArray("shellNozzles")),
            shellNozzleUtDraft = NozzleUtDraftInput(
                editingRowId = shellNozzleUtDraftJson.optString("editingRowId").ifBlank { null },
                nozzleId = shellNozzleUtDraftJson.optString("nozzleId"),
                captureState = decodeMeasurementCaptureState(
                    shellNozzleUtDraftJson.optString("captureState", MeasurementCaptureState.CAPTURED.name),
                ),
                readings = decodeStringList(shellNozzleUtDraftJson.optJSONArray("readings"), expectedSize = 5),
                note = shellNozzleUtDraftJson.optString("note"),
            ),
            shellNozzleUtRows = decodeNozzleUtRows(json.optJSONArray("shellNozzleUtRows")),
            roofNozzleDraft = RoofNozzleDraftInput(
                roofSurfaceId = roofNozzleDraftJson.optString("roofSurfaceId").ifBlank { activeRoofSurfaceId },
                nozzleId = roofNozzleDraftJson.optString("nozzleId"),
                size = roofNozzleDraftJson.optString("size"),
                plateId = roofNozzleDraftJson.optString("plateId"),
                azimuthDeg = roofNozzleDraftJson.optString("azimuthDeg"),
                placementMode = roofNozzleDraftJson.optString("placementMode", "plate_linked"),
            ),
            roofNozzles = decodeNozzleDefinitions(json.optJSONArray("roofNozzles"), defaultRoofSurfaceId = ROOF_SURFACE_FIXED),
            roofNozzleUtDraft = NozzleUtDraftInput(
                roofSurfaceId = roofNozzleUtDraftJson.optString("roofSurfaceId").ifBlank { activeRoofSurfaceId },
                editingRowId = roofNozzleUtDraftJson.optString("editingRowId").ifBlank { null },
                nozzleId = roofNozzleUtDraftJson.optString("nozzleId"),
                captureState = decodeMeasurementCaptureState(
                    roofNozzleUtDraftJson.optString("captureState", MeasurementCaptureState.CAPTURED.name),
                ),
                readings = decodeStringList(roofNozzleUtDraftJson.optJSONArray("readings"), expectedSize = 5),
                note = roofNozzleUtDraftJson.optString("note"),
            ),
            roofNozzleUtRows = decodeNozzleUtRows(json.optJSONArray("roofNozzleUtRows"), defaultRoofSurfaceId = ROOF_SURFACE_FIXED),
            findingDraft = FindingDraftInput(
                editingFindingId = findingDraftJson.optString("editingFindingId").ifBlank { null },
                surface = findingDraftJson.optString("surface", "shell"),
                type = findingDraftJson.optString("type", "corrosion"),
                severity = findingDraftJson.optString("severity", "medium"),
                note = findingDraftJson.optString("note"),
                linkedMeasurementId = findingDraftJson.optString("linkedMeasurementId"),
                locationSummary = findingDraftJson.optString("locationSummary"),
                preciseLineId = findingDraftJson.optString("preciseLineId"),
                preciseCourse = findingDraftJson.optString("preciseCourse"),
                preciseOffsetPercent = findingDraftJson.optString("preciseOffsetPercent"),
                photoCaption = findingDraftJson.optString("photoCaption"),
                photoRelativePath = findingDraftJson.optString("photoRelativePath"),
            ),
            findings = decodeFindings(json.optJSONArray("findings")),
            attachments = decodeAttachments(json.optJSONArray("attachments")),
            mflImportDraft = MflImportDraftInput(
                contractor = mflImportDraftJson.optString("contractor"),
                reportReference = mflImportDraftJson.optString("reportReference"),
                reportDate = mflImportDraftJson.optString("reportDate"),
                severity = mflImportDraftJson.optString("severity", "medium"),
                pdfRelativePath = mflImportDraftJson.optString("pdfRelativePath"),
                pdfCaption = mflImportDraftJson.optString("pdfCaption"),
                attachmentId = mflImportDraftJson.optString("attachmentId").ifBlank { null },
            ),
        )
            .let { state ->
                val withShellPlan = if (state.savedShellPlanKey.isNullOrBlank()) {
                    state.copy(savedShellPlanKey = state.currentShellPlanKey())
                } else {
                    state
                }
                withShellPlan.copy(
                    shellCaptureStartLaneId = withShellPlan.shellCaptureStartLaneId.ifBlank {
                        withShellPlan.savedShellCaptureStartLaneId
                    },
                    savedSetupBaseline = withShellPlan.savedSetupBaseline
                        ?: withShellPlan.setup.takeIf { !withShellPlan.savedReferenceBaselineKey.isNullOrBlank() },
                    savedScopeBaseline = withShellPlan.savedScopeBaseline
                        ?: withShellPlan.scope.takeIf { !withShellPlan.savedReferenceBaselineKey.isNullOrBlank() },
                    savedShellLineCountOverride = withShellPlan.savedShellLineCountOverride.ifBlank {
                        withShellPlan.shellLineCountOverride.takeIf { !withShellPlan.savedShellPlanKey.isNullOrBlank() }.orEmpty()
                    },
                    savedShellCaptureStartLaneId = withShellPlan.savedShellCaptureStartLaneId.ifBlank {
                        withShellPlan.shellCaptureStartLaneId.takeIf { !withShellPlan.savedShellPlanKey.isNullOrBlank() }.orEmpty()
                    },
                )
            }
    }

    private fun decodeTaskSet(jsonArray: JSONArray?): Set<FieldTask> {
        if (jsonArray == null) return linkedSetOf(
            FieldTask.SHELL_UT,
            FieldTask.SHELL_SETTLEMENT,
            FieldTask.ROUNDNESS_SURVEY,
            FieldTask.PLUMBNESS_SURVEY,
            FieldTask.ROOF_UT,
            FieldTask.SHELL_NOZZLE_UT,
            FieldTask.ROOF_NOZZLE_UT,
            FieldTask.FINDINGS,
            FieldTask.MFL_IMPORT,
            FieldTask.REVIEW_EXPORT,
        )
        return buildSet {
            repeat(jsonArray.length()) { index ->
                val raw = jsonArray.optString(index)
                runCatching { add(enumValueOf<FieldTask>(raw)) }
            }
        }
    }

    private fun decodeReferenceMode(raw: String): ReferenceMode = when (raw) {
        ReferenceMode.TRUE_NORTH.name -> ReferenceMode.TRUE_NORTH
        ReferenceMode.SITE_MARKER.name -> ReferenceMode.TANK_NORTH
        else -> ReferenceMode.TANK_NORTH
    }

    private fun decodeMeasurementUnit(raw: String): MeasurementUnit = when (raw) {
        MeasurementUnit.INCH.name -> MeasurementUnit.INCH
        else -> MeasurementUnit.MM
    }

    private fun decodeNozzleSizeUnit(raw: String): NozzleSizeUnit = when (raw) {
        NozzleSizeUnit.MM.name -> NozzleSizeUnit.MM
        NozzleSizeUnit.MIXED_TEXT.name -> NozzleSizeUnit.MIXED_TEXT
        else -> NozzleSizeUnit.INCH
    }

    private fun decodeMeasurementCaptureState(raw: String): MeasurementCaptureState = when (raw) {
        MeasurementCaptureState.NOT_APPLICABLE.name -> MeasurementCaptureState.NOT_APPLICABLE
        MeasurementCaptureState.NOT_ACCESSIBLE.name -> MeasurementCaptureState.NOT_ACCESSIBLE
        MeasurementCaptureState.COATED_NOT_EXPOSED.name -> MeasurementCaptureState.COATED_NOT_EXPOSED
        MeasurementCaptureState.SKIPPED.name -> MeasurementCaptureState.SKIPPED
        else -> MeasurementCaptureState.CAPTURED
    }

    private fun encodeRoofLayoutDraft(draft: RoofLayoutDraftInput): JSONObject =
        JSONObject().apply {
            put("template", draft.template.name)
            put("rowCount", draft.rowCount)
            put("widestRowPlateCount", draft.widestRowPlateCount)
            put("ringCount", draft.ringCount)
            put("sectorCount", draft.sectorCount)
            put("centerOpeningRatio", draft.centerOpeningRatio)
            put("hasAnnularRing", draft.hasAnnularRing)
            put("annularSectionCount", draft.annularSectionCount)
            put("hasPontoonDeck", draft.hasPontoonDeck)
        }

    private fun decodeSetupFormState(json: JSONObject): SetupFormState {
        val legacyRoofType = json.optString("roofType")
        val fixedRoofType = json.optString("fixedRoofType").ifBlank {
            when (legacyRoofType) {
                "fixed_dome" -> "dome"
                "umbrella" -> "umbrella"
                "geodesic" -> "geodesic"
                "external_floating" -> "none"
                else -> "cone"
            }
        }
        val floatingRoofType = json.optString("floatingRoofType").ifBlank {
            when (legacyRoofType) {
                "external_floating", "double_deck_floating" -> "external"
                "internal_floating" -> "internal"
                else -> "none"
            }
        }
        return SetupFormState(
            client = json.optString("client"),
            site = json.optString("site"),
            tankNumber = json.optString("tankNumber"),
            diameterM = json.optString("diameterM"),
            heightM = json.optString("heightM"),
            shellCourseCount = json.optString("shellCourseCount"),
            fixedRoofType = fixedRoofType,
            floatingRoofType = floatingRoofType,
            inspector = json.optString("inspector", "Field Engineer"),
            thicknessUnit = decodeMeasurementUnit(json.optString("thicknessUnit", MeasurementUnit.MM.name)),
            settlementUnit = decodeMeasurementUnit(json.optString("settlementUnit", MeasurementUnit.MM.name)),
            nozzleSizeUnit = decodeNozzleSizeUnit(json.optString("nozzleSizeUnit", NozzleSizeUnit.INCH.name)),
        )
    }

    private fun buildRoofLayoutDefaultTemplate(
        setup: SetupFormState,
        roofSurfaceId: String,
    ): RoofTemplate = when (roofSurfaceId) {
        ROOF_SURFACE_FLOATING -> RoofTemplate.CIRCULAR_PLATE
        else -> when (setup.fixedRoofType) {
            "umbrella" -> RoofTemplate.UMBRELLA_RADIAL
            else -> RoofTemplate.CIRCULAR_PLATE
        }
    }

    private fun decodeRoofLayoutDraft(
        json: JSONObject?,
        defaultTemplate: RoofTemplate,
        defaultHasPontoonDeck: Boolean,
    ): RoofLayoutDraftInput {
        val source = json ?: JSONObject()
        return RoofLayoutDraftInput(
            template = enumValueOf(source.optString("template", defaultTemplate.name)),
            rowCount = source.optString("rowCount"),
            widestRowPlateCount = source.optString("widestRowPlateCount"),
            ringCount = source.optString("ringCount"),
            sectorCount = source.optString("sectorCount"),
            centerOpeningRatio = source.optString("centerOpeningRatio"),
            hasAnnularRing = source.optBoolean("hasAnnularRing", false),
            annularSectionCount = source.optString("annularSectionCount"),
            hasPontoonDeck = source.optBoolean("hasPontoonDeck", defaultHasPontoonDeck),
        )
    }

    private fun decodeOptionalRoofLayoutDraft(
        json: JSONObject?,
        fallbackTemplate: RoofTemplate,
    ): RoofLayoutDraftInput? {
        json ?: return null
        return RoofLayoutDraftInput(
            template = enumValueOf(json.optString("template", fallbackTemplate.name)),
            rowCount = json.optString("rowCount"),
            widestRowPlateCount = json.optString("widestRowPlateCount"),
            ringCount = json.optString("ringCount"),
            sectorCount = json.optString("sectorCount"),
            centerOpeningRatio = json.optString("centerOpeningRatio"),
            hasAnnularRing = json.optBoolean("hasAnnularRing", false),
            annularSectionCount = json.optString("annularSectionCount"),
            hasPontoonDeck = json.optBoolean("hasPontoonDeck", false),
        )
    }

    private fun decodeStringList(jsonArray: JSONArray?, expectedSize: Int?): List<String> {
        if (jsonArray == null) return if ((expectedSize ?: 0) > 0) List(expectedSize ?: 0) { "" } else emptyList()
        val values = mutableListOf<String>()
        repeat(jsonArray.length()) { index ->
            values += jsonArray.optString(index)
        }
        val requiredSize = expectedSize ?: return values
        if (requiredSize <= 0) return values
        while (values.size < requiredSize) values += ""
        return values.take(requiredSize)
    }

    private fun decodeShellSettlementDraft(
        shellSettlementDraftJson: JSONObject,
        scope: ScopeFormState,
    ): ShellSettlementDraftInput {
        val stationCount = shellSettlementDraftJson.optString("stationCount", "8")
        val parsedCount = stationCount.toIntOrNull()?.coerceAtLeast(1) ?: 8
        val templateStations = defaultShellSettlementStationDrafts(
            stationCount = parsedCount,
            startAngleDeg = scope.referenceAzimuthDeg(),
            rotationDirection = scope.rotationDirection,
        )
        val savedStations = decodeShellSettlementDraftStations(shellSettlementDraftJson.optJSONArray("stations"))
        val mergedStations = templateStations.mapIndexed { index, template ->
            val existing = savedStations.getOrNull(index)
            template.copy(
                elevation = existing?.elevation.orEmpty(),
                captureState = existing?.captureState ?: MeasurementCaptureState.CAPTURED,
                note = existing?.note.orEmpty(),
            )
        }
        return ShellSettlementDraftInput(
            stationCount = stationCount,
            stations = mergedStations,
        )
    }

    private fun decodeRoundnessSurveyDraft(
        roundnessSurveyDraftJson: JSONObject,
        scope: ScopeFormState,
    ): RoundnessSurveyDraftInput {
        val stationCount = roundnessSurveyDraftJson.optString("stationCount", "26")
        val parsedCount = stationCount.toIntOrNull()?.coerceAtLeast(1) ?: 26
        val templateStations = defaultRoundnessSurveyStationDrafts(
            stationCount = parsedCount,
            startAngleDeg = scope.referenceAzimuthDeg(),
            rotationDirection = scope.rotationDirection,
        )
        val savedStations = decodeRoundnessSurveyDraftStations(roundnessSurveyDraftJson.optJSONArray("stations"))
        val mergedStations = templateStations.mapIndexed { index, template ->
            val existing = savedStations.getOrNull(index)
            template.copy(
                easting = existing?.easting.orEmpty(),
                northing = existing?.northing.orEmpty(),
                captureState = existing?.captureState ?: MeasurementCaptureState.CAPTURED,
                note = existing?.note.orEmpty(),
            )
        }
        return RoundnessSurveyDraftInput(
            editingSurveyId = roundnessSurveyDraftJson.optString("editingSurveyId").ifBlank { null },
            surveyLabel = roundnessSurveyDraftJson.optString("surveyLabel", "Ring 1"),
            heightReference = roundnessSurveyDraftJson.optString("heightReference"),
            stationCount = stationCount,
            stations = mergedStations,
        )
    }

    private fun decodePlumbnessSurveyDraft(
        plumbnessSurveyDraftJson: JSONObject,
        scope: ScopeFormState,
    ): PlumbnessSurveyDraftInput {
        val stationCount = plumbnessSurveyDraftJson.optString("stationCount", "26")
        val parsedCount = stationCount.toIntOrNull()?.coerceAtLeast(1) ?: 26
        val templateStations = defaultPlumbnessSurveyStationDrafts(
            stationCount = parsedCount,
            startAngleDeg = scope.referenceAzimuthDeg(),
            rotationDirection = scope.rotationDirection,
        )
        val savedStations = decodePlumbnessSurveyDraftStations(plumbnessSurveyDraftJson.optJSONArray("stations"))
        val mergedStations = templateStations.mapIndexed { index, template ->
            val existing = savedStations.getOrNull(index)
            template.copy(
                plumbness = existing?.plumbness.orEmpty(),
                captureState = existing?.captureState ?: MeasurementCaptureState.CAPTURED,
                note = existing?.note.orEmpty(),
            )
        }
        return PlumbnessSurveyDraftInput(
            stationCount = stationCount,
            stations = mergedStations,
        )
    }

    private fun decodeShellSettlementDraftStations(jsonArray: JSONArray?): List<ShellSettlementStationDraftInput> {
        if (jsonArray == null) return emptyList()
        return buildList {
            repeat(jsonArray.length()) { index ->
                val json = jsonArray.optJSONObject(index) ?: return@repeat
                add(
                    ShellSettlementStationDraftInput(
                        stationId = json.optString("stationId", "${index + 1}"),
                        angleDeg = json.optDouble("angleDeg", Double.NaN).takeIf { !it.isNaN() } ?: 0.0,
                        elevation = json.optString("elevation"),
                        captureState = decodeMeasurementCaptureState(
                            json.optString("captureState", MeasurementCaptureState.CAPTURED.name),
                        ),
                        note = json.optString("note"),
                    ),
                )
            }
        }
    }

    private fun decodeRoundnessSurveyDraftStations(jsonArray: JSONArray?): List<RoundnessSurveyStationDraftInput> {
        if (jsonArray == null) return emptyList()
        return buildList {
            repeat(jsonArray.length()) { index ->
                val json = jsonArray.optJSONObject(index) ?: return@repeat
                add(
                    RoundnessSurveyStationDraftInput(
                        stationId = json.optString("stationId", "${index + 1}"),
                        angleDeg = json.optDouble("angleDeg", Double.NaN).takeIf { !it.isNaN() } ?: 0.0,
                        easting = json.optString("easting"),
                        northing = json.optString("northing"),
                        captureState = decodeMeasurementCaptureState(
                            json.optString("captureState", MeasurementCaptureState.CAPTURED.name),
                        ),
                        note = json.optString("note"),
                    ),
                )
            }
        }
    }

    private fun decodePlumbnessSurveyDraftStations(jsonArray: JSONArray?): List<PlumbnessSurveyStationDraftInput> {
        if (jsonArray == null) return emptyList()
        return buildList {
            repeat(jsonArray.length()) { index ->
                val json = jsonArray.optJSONObject(index) ?: return@repeat
                add(
                    PlumbnessSurveyStationDraftInput(
                        stationId = json.optString("stationId", "${index + 1}"),
                        angleDeg = json.optDouble("angleDeg", Double.NaN).takeIf { !it.isNaN() } ?: 0.0,
                        plumbness = json.optString("plumbness"),
                        captureState = decodeMeasurementCaptureState(
                            json.optString("captureState", MeasurementCaptureState.CAPTURED.name),
                        ),
                        note = json.optString("note"),
                    ),
                )
            }
        }
    }

    private fun decodeShellSettlementSurvey(json: JSONObject?): ShellSettlementSurvey? {
        json ?: return null
        val stationCount = json.optInt("stationCount").takeIf { it > 0 } ?: return null
        val stations = buildList {
            val jsonArray = json.optJSONArray("stations") ?: JSONArray()
            repeat(jsonArray.length()) { index ->
                val stationJson = jsonArray.optJSONObject(index) ?: return@repeat
                add(
                    ShellSettlementStation(
                        stationId = stationJson.optString("stationId", "${index + 1}"),
                        angleDeg = stationJson.optDouble("angleDeg", Double.NaN).takeIf { !it.isNaN() } ?: 0.0,
                        elevation = stationJson.optDouble("elevation", Double.NaN).takeIf { !it.isNaN() },
                        captureState = decodeMeasurementCaptureState(
                            stationJson.optString("captureState", MeasurementCaptureState.CAPTURED.name),
                        ),
                        note = stationJson.optString("note").ifBlank { null },
                    ),
                )
            }
        }
        return ShellSettlementSurvey(
            stationCount = stationCount,
            stations = stations,
        )
    }

    private fun decodeRoundnessSurvey(json: JSONObject?): RoundnessSurvey? {
        json ?: return null
        val surveysArray = json.optJSONArray("surveys") ?: return null
        val surveys = buildList {
            repeat(surveysArray.length()) outer@{ index ->
                val bandJson = surveysArray.optJSONObject(index) ?: return@outer
                val stationsArray = bandJson.optJSONArray("stations") ?: JSONArray()
                val stations = buildList {
                    repeat(stationsArray.length()) inner@{ stationIndex ->
                        val stationJson = stationsArray.optJSONObject(stationIndex) ?: return@inner
                        add(
                            RoundnessSurveyStation(
                                stationId = stationJson.optString("stationId", "${stationIndex + 1}"),
                                angleDeg = stationJson.optDouble("angleDeg", 0.0),
                                easting = stationJson.optDouble("easting", Double.NaN).takeIf { !it.isNaN() },
                                northing = stationJson.optDouble("northing", Double.NaN).takeIf { !it.isNaN() },
                                captureState = decodeMeasurementCaptureState(
                                    stationJson.optString("captureState", MeasurementCaptureState.CAPTURED.name),
                                ),
                                note = stationJson.optString("note").ifBlank { null },
                            ),
                        )
                    }
                }
                add(
                    RoundnessSurveyBand(
                        surveyId = bandJson.optString("surveyId", "roundness-${index + 1}"),
                        label = bandJson.optString("label", "Ring ${index + 1}"),
                        heightReference = bandJson.optString("heightReference").ifBlank { null },
                        stationCount = bandJson.optInt("stationCount", stations.size),
                        stations = stations,
                    ),
                )
            }
        }
        return surveys.takeIf { it.isNotEmpty() }?.let(::RoundnessSurvey)
    }

    private fun decodePlumbnessSurvey(json: JSONObject?): PlumbnessSurvey? {
        json ?: return null
        val stationCount = json.optInt("stationCount").takeIf { it > 0 } ?: return null
        val stations = buildList {
            val jsonArray = json.optJSONArray("stations") ?: JSONArray()
            repeat(jsonArray.length()) { index ->
                val stationJson = jsonArray.optJSONObject(index) ?: return@repeat
                add(
                    PlumbnessSurveyStation(
                        stationId = stationJson.optString("stationId", "${index + 1}"),
                        angleDeg = stationJson.optDouble("angleDeg", 0.0),
                        plumbness = stationJson.optDouble("plumbness", Double.NaN).takeIf { !it.isNaN() },
                        captureState = decodeMeasurementCaptureState(
                            stationJson.optString("captureState", MeasurementCaptureState.CAPTURED.name),
                        ),
                        note = stationJson.optString("note").ifBlank { null },
                    ),
                )
            }
        }
        return PlumbnessSurvey(
            stationCount = stationCount,
            stations = stations,
        )
    }

    private fun encodeShellUtRows(rows: List<ShellUtRow>): JSONArray =
        JSONArray(rows.map { row ->
            JSONObject().apply {
                put("rowId", row.rowId)
                put("lineId", row.lineId)
                put("course", row.course)
                put("readings", JSONArray(row.readings))
                put("captureState", row.captureState.name)
                put("note", row.note)
            }
        })

    private fun decodeShellUtRows(jsonArray: JSONArray?): List<ShellUtRow> {
        if (jsonArray == null) return emptyList()
        return buildList {
            repeat(jsonArray.length()) { index ->
                val json = jsonArray.optJSONObject(index) ?: return@repeat
                add(
                    ShellUtRow(
                        rowId = json.optString("rowId"),
                        lineId = json.optString("lineId"),
                        course = json.optInt("course"),
                        readings = decodeDoubleList(json.optJSONArray("readings") ?: json.optJSONArray("readingsMm")),
                        captureState = decodeMeasurementCaptureState(
                            json.optString("captureState", MeasurementCaptureState.CAPTURED.name),
                        ),
                        note = json.optString("note").ifBlank { null },
                    ),
                )
            }
        }
    }

    private fun encodeRoofUtRows(rows: List<RoofUtRow>): JSONArray =
        JSONArray(rows.map { row ->
            JSONObject().apply {
                put("rowId", row.rowId)
                put("roofSurfaceId", row.roofSurfaceId)
                put("plateId", row.plateId)
                put("readings", JSONArray(row.readings))
                put("captureState", row.captureState.name)
                put("note", row.note)
            }
        })

    private fun decodeRoofUtRows(jsonArray: JSONArray?): List<RoofUtRow> {
        if (jsonArray == null) return emptyList()
        return buildList {
            repeat(jsonArray.length()) { index ->
                val json = jsonArray.optJSONObject(index) ?: return@repeat
                add(
                    RoofUtRow(
                        rowId = json.optString("rowId"),
                        roofSurfaceId = json.optString("roofSurfaceId").ifBlank { ROOF_SURFACE_FIXED },
                        plateId = json.optString("plateId"),
                        readings = decodeDoubleList(json.optJSONArray("readings") ?: json.optJSONArray("readingsMm")),
                        captureState = decodeMeasurementCaptureState(
                            json.optString("captureState", MeasurementCaptureState.CAPTURED.name),
                        ),
                        note = json.optString("note").ifBlank { null },
                    ),
                )
            }
        }
    }

    private fun encodeRoofFeatures(features: List<RoofFeature>): JSONArray =
        JSONArray(features.map { feature ->
            JSONObject().apply {
                put("featureId", feature.featureId)
                put("roofSurfaceId", feature.roofSurfaceId)
                put("type", feature.type)
                put("label", feature.label)
                put("placementMode", feature.placementMode)
                put("plateId", feature.plateId)
                put("azimuthDeg", feature.azimuthDeg)
                put("radiusRatio", feature.radiusRatio)
            }
        })

    private fun decodeRoofFeatures(jsonArray: JSONArray?): List<RoofFeature> {
        if (jsonArray == null) return emptyList()
        return buildList {
            repeat(jsonArray.length()) { index ->
                val json = jsonArray.optJSONObject(index) ?: return@repeat
                add(
                    RoofFeature(
                        featureId = json.optString("featureId"),
                        roofSurfaceId = json.optString("roofSurfaceId").ifBlank { ROOF_SURFACE_FIXED },
                        type = json.optString("type"),
                        label = json.optString("label").ifBlank { null },
                        placementMode = json.optString("placementMode").ifBlank { null },
                        plateId = json.optString("plateId").ifBlank { null },
                        azimuthDeg = json.optDouble("azimuthDeg").takeIf { !it.isNaN() },
                        radiusRatio = json.optDouble("radiusRatio").takeIf { !it.isNaN() },
                    ),
                )
            }
        }
    }

    private fun encodeNozzleDefinitions(definitions: List<NozzleDefinition>): JSONArray =
        JSONArray(definitions.map { nozzle ->
            JSONObject().apply {
                put("nozzleId", nozzle.nozzleId)
                put("surface", nozzle.surface)
                put("roofSurfaceId", nozzle.roofSurfaceId)
                put("size", nozzle.size)
                put("hasReinforcementPad", nozzle.hasReinforcementPad)
                put("placementMode", nozzle.placementMode)
                put("course", nozzle.course)
                put("azimuthDeg", nozzle.azimuthDeg)
                put("radiusRatio", nozzle.radiusRatio)
                put("courseOffsetRatio", nozzle.courseOffsetRatio)
                put("plateId", nozzle.plateId)
            }
        })

    private fun decodeNozzleDefinitions(
        jsonArray: JSONArray?,
        defaultRoofSurfaceId: String? = null,
    ): List<NozzleDefinition> {
        if (jsonArray == null) return emptyList()
        return buildList {
            repeat(jsonArray.length()) { index ->
                val json = jsonArray.optJSONObject(index) ?: return@repeat
                val surface = json.optString("surface")
                add(
                    NozzleDefinition(
                        nozzleId = json.optString("nozzleId"),
                        surface = surface,
                        roofSurfaceId = json.optString("roofSurfaceId").ifBlank {
                            if (surface == "roof") defaultRoofSurfaceId else null
                        },
                        size = json.optString("size"),
                        hasReinforcementPad = json.optBoolean("hasReinforcementPad", true),
                        placementMode = json.optString("placementMode").ifBlank { null },
                        course = json.optInt("course").takeIf { it > 0 },
                        azimuthDeg = json.optDouble("azimuthDeg").takeIf { !it.isNaN() },
                        radiusRatio = json.optDouble("radiusRatio").takeIf { !it.isNaN() },
                        courseOffsetRatio = json.optDouble("courseOffsetRatio").takeIf { !it.isNaN() },
                        plateId = json.optString("plateId").ifBlank { null },
                    ),
                )
            }
        }
    }

    private fun encodeNozzleUtRows(rows: List<NozzleUtRow>): JSONArray =
        JSONArray(rows.map { row ->
            JSONObject().apply {
                put("rowId", row.rowId)
                put("nozzleId", row.nozzleId)
                put("roofSurfaceId", row.roofSurfaceId)
                put("bodyReadings", JSONArray(row.bodyReadings))
                put("reinforcementPadReading", row.reinforcementPadReading)
                put("captureState", row.captureState.name)
                put("note", row.note)
            }
        })

    private fun decodeNozzleUtRows(
        jsonArray: JSONArray?,
        defaultRoofSurfaceId: String? = null,
    ): List<NozzleUtRow> {
        if (jsonArray == null) return emptyList()
        return buildList {
            repeat(jsonArray.length()) { index ->
                val json = jsonArray.optJSONObject(index) ?: return@repeat
                add(
                    NozzleUtRow(
                        rowId = json.optString("rowId"),
                        nozzleId = json.optString("nozzleId"),
                        roofSurfaceId = json.optString("roofSurfaceId").ifBlank { defaultRoofSurfaceId },
                        bodyReadings = decodeDoubleList(
                            json.optJSONArray("bodyReadings")
                                ?: json.optJSONArray("readings")
                                ?: json.optJSONArray("readingsMm"),
                        ).take(4),
                        reinforcementPadReading = when {
                            json.has("reinforcementPadReading") -> json.optDouble("reinforcementPadReading", Double.NaN).takeIf { !it.isNaN() }
                            else -> decodeDoubleList(json.optJSONArray("readingsMm")).getOrNull(4)
                        },
                        captureState = decodeMeasurementCaptureState(
                            json.optString("captureState", MeasurementCaptureState.CAPTURED.name),
                        ),
                        note = json.optString("note").ifBlank { null },
                    ),
                )
            }
        }
    }

    private fun encodeFindings(findings: List<FindingRecord>): JSONArray =
        JSONArray(findings.map { finding ->
            JSONObject().apply {
                put("findingId", finding.findingId)
                put("surface", finding.surface)
                put("type", finding.type)
                put("severity", finding.severity)
                put("note", finding.note)
                put("linkedMeasurementId", finding.linkedMeasurementId)
                put("locationSummary", finding.locationSummary)
                put("preciseLineId", finding.preciseLineId)
                put("preciseCourse", finding.preciseCourse)
                put("attachmentIds", JSONArray(finding.attachmentIds))
            }
        })

    private fun decodeFindings(jsonArray: JSONArray?): List<FindingRecord> {
        if (jsonArray == null) return emptyList()
        return buildList {
            repeat(jsonArray.length()) { index ->
                val json = jsonArray.optJSONObject(index) ?: return@repeat
                add(
                    FindingRecord(
                        findingId = json.optString("findingId"),
                        surface = json.optString("surface"),
                        type = json.optString("type"),
                        severity = json.optString("severity"),
                        note = json.optString("note").ifBlank { null },
                        linkedMeasurementId = json.optString("linkedMeasurementId").ifBlank { null },
                        locationSummary = json.optString("locationSummary").ifBlank { null },
                        preciseLineId = json.optString("preciseLineId").ifBlank { null },
                        preciseCourse = json.optInt("preciseCourse").takeIf { it > 0 },
                        attachmentIds = decodeStringList(json.optJSONArray("attachmentIds"), expectedSize = 0),
                    ),
                )
            }
        }
    }

    private fun encodeAttachments(attachments: List<AttachmentRecord>): JSONArray =
        JSONArray(attachments.map { attachment ->
            JSONObject().apply {
                put("attachmentId", attachment.attachmentId)
                put("kind", attachment.kind)
                put("relativePath", attachment.relativePath)
                put("caption", attachment.caption)
            }
        })

    private fun decodeAttachments(jsonArray: JSONArray?): List<AttachmentRecord> {
        if (jsonArray == null) return emptyList()
        return buildList {
            repeat(jsonArray.length()) { index ->
                val json = jsonArray.optJSONObject(index) ?: return@repeat
                add(
                    AttachmentRecord(
                        attachmentId = json.optString("attachmentId"),
                        kind = json.optString("kind"),
                        relativePath = json.optString("relativePath"),
                        caption = json.optString("caption").ifBlank { null },
                    ),
                )
            }
        }
    }

    private fun decodeDoubleList(jsonArray: JSONArray?): List<Double> {
        if (jsonArray == null) return emptyList()
        return buildList {
            repeat(jsonArray.length()) { index ->
                val value = jsonArray.optDouble(index, Double.NaN)
                if (!value.isNaN()) add(value)
            }
        }
    }
}

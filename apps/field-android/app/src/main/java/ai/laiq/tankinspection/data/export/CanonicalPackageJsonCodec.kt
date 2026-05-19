package ai.laiq.tankinspection.data.export

import ai.laiq.tankinspection.domain.model.CanonicalInspectionPackage
import ai.laiq.tankinspection.domain.model.ReviewState
import org.json.JSONArray
import org.json.JSONObject

object CanonicalPackageJsonCodec {
    fun encode(pkg: CanonicalInspectionPackage): String {
        return JSONObject().apply {
            put("schemaVersion", pkg.schemaVersion)
            put("packageId", pkg.packageId)
            put("inspection", JSONObject().apply {
                put("inspectionId", pkg.inspection.inspectionId)
                put("client", pkg.inspection.client)
                put("site", pkg.inspection.site)
                put("tankNumber", pkg.inspection.tankNumber)
                put("inspectionType", pkg.inspection.inspectionType)
                put("startedAt", pkg.inspection.startedAt)
                put("completedAt", pkg.inspection.completedAt)
                put("inspector", pkg.inspection.inspector)
                put("deviceId", pkg.inspection.deviceId)
            })
            put("tankMaster", JSONObject().apply {
                put("diameterM", pkg.tankMaster.diameterM)
                put("heightM", pkg.tankMaster.heightM)
                put("roofType", pkg.tankMaster.roofType)
                put("fixedRoofType", pkg.tankMaster.fixedRoofType)
                put("floatingRoofType", pkg.tankMaster.floatingRoofType)
                put("shellCourseCount", pkg.tankMaster.shellCourseCount)
                put("referenceMode", pkg.tankMaster.referenceMode.name.lowercase())
                put("startReference", pkg.tankMaster.startReference)
            })
            put("unitProfile", JSONObject().apply {
                put("thicknessUnit", pkg.unitProfile.thicknessUnit.name.lowercase())
                put("settlementUnit", pkg.unitProfile.settlementUnit.name.lowercase())
                put("nozzleSizeUnit", pkg.unitProfile.nozzleSizeUnit.name.lowercase())
            })
            put("shellLinePlan", JSONObject().apply {
                put("lineCount", pkg.shellLinePlan.lineCount)
                put("recommendedLineCount", pkg.shellLinePlan.recommendedLineCount)
                put("startReference", pkg.shellLinePlan.startReference)
                put("captureStartLaneId", pkg.shellLinePlan.captureStartLaneId)
                put("rotationDirection", rotationDirectionJson(pkg.shellLinePlan.rotationDirection.name))
                put(
                    "lines",
                    JSONArray(
                        pkg.shellLinePlan.lines.map { line ->
                            JSONObject().apply {
                                put("lineId", line.lineId)
                                put("label", line.label)
                                put("azimuthDeg", line.azimuthDeg)
                            }
                        },
                    ),
                )
            })
            put("roofLayout", pkg.roofLayout?.let { layout ->
                JSONObject().apply {
                    put("template", roofTemplateJson(layout.template.name))
                    put("rowCount", layout.rowCount)
                    put("widestRowPlateCount", layout.widestRowPlateCount)
                    put("ringCount", layout.ringCount)
                    put("sectorCount", layout.sectorCount)
                    put("centerOpeningRatio", layout.centerOpeningRatio)
                    put("hasAnnularRing", layout.hasAnnularRing)
                    put("annularSectionCount", layout.annularSectionCount)
                    put("hasPontoonDeck", layout.hasPontoonDeck)
                    put(
                        "features",
                        JSONArray(
                            layout.features.map { feature ->
                                JSONObject().apply {
                                    put("featureId", feature.featureId)
                                    put("type", feature.type)
                                    put("label", feature.label)
                                    put("placementMode", feature.placementMode)
                                    put("plateId", feature.plateId)
                                    put("azimuthDeg", feature.azimuthDeg)
                                    put("radiusRatio", feature.radiusRatio)
                                }
                            },
                        ),
                    )
                }
            })
            put("roofSurfaceLayouts", JSONArray(pkg.roofSurfaceLayouts.map { surface ->
                JSONObject().apply {
                    put("roofSurfaceId", surface.roofSurfaceId)
                    put("surfaceKind", surface.surfaceKind)
                    put("layout", JSONObject().apply {
                        put("template", roofTemplateJson(surface.layout.template.name))
                        put("rowCount", surface.layout.rowCount)
                        put("widestRowPlateCount", surface.layout.widestRowPlateCount)
                        put("ringCount", surface.layout.ringCount)
                        put("sectorCount", surface.layout.sectorCount)
                        put("centerOpeningRatio", surface.layout.centerOpeningRatio)
                        put("hasAnnularRing", surface.layout.hasAnnularRing)
                        put("annularSectionCount", surface.layout.annularSectionCount)
                        put("hasPontoonDeck", surface.layout.hasPontoonDeck)
                        put("features", JSONArray(surface.layout.features.map { feature ->
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
                        }))
                    })
                }
            }))
            put("nozzleRegistries", pkg.nozzleRegistries?.let { registries ->
                JSONObject().apply {
                    put("shell", JSONArray(registries.shell.map { nozzle ->
                        JSONObject().apply {
                            put("nozzleId", nozzle.nozzleId)
                            put("surface", nozzle.surface)
                            put("size", nozzle.size)
                            put("hasReinforcementPad", nozzle.hasReinforcementPad)
                            put("placementMode", nozzle.placementMode)
                            put("course", nozzle.course)
                            put("azimuthDeg", nozzle.azimuthDeg)
                            put("radiusRatio", nozzle.radiusRatio)
                            put("courseOffsetRatio", nozzle.courseOffsetRatio)
                            put("plateId", nozzle.plateId)
                        }
                    }))
                    put("roof", JSONArray(registries.roof.map { nozzle ->
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
                    }))
                }
            })
            put("measurements", JSONObject().apply {
                put("shellUtRows", JSONArray(pkg.measurements.shellUtRows.map { row ->
                    JSONObject().apply {
                        put("rowId", row.rowId)
                        put("lineId", row.lineId)
                        put("course", row.course)
                        put("readings", JSONArray(row.readings))
                        put("captureState", row.captureState.name.lowercase())
                        put("note", row.note)
                    }
                }))
                put("roofUtRows", JSONArray(pkg.measurements.roofUtRows.map { row ->
                    JSONObject().apply {
                        put("rowId", row.rowId)
                        put("roofSurfaceId", row.roofSurfaceId)
                        put("plateId", row.plateId)
                        put("readings", JSONArray(row.readings))
                        put("captureState", row.captureState.name.lowercase())
                        put("note", row.note)
                    }
                }))
                put("shellNozzleUtRows", JSONArray(pkg.measurements.shellNozzleUtRows.map { row ->
                    JSONObject().apply {
                        put("rowId", row.rowId)
                        put("nozzleId", row.nozzleId)
                        put("bodyReadings", JSONArray(row.bodyReadings))
                        put("reinforcementPadReading", row.reinforcementPadReading)
                        put("captureState", row.captureState.name.lowercase())
                        put("note", row.note)
                    }
                }))
                put("roofNozzleUtRows", JSONArray(pkg.measurements.roofNozzleUtRows.map { row ->
                    JSONObject().apply {
                        put("rowId", row.rowId)
                        put("nozzleId", row.nozzleId)
                        put("roofSurfaceId", row.roofSurfaceId)
                        put("bodyReadings", JSONArray(row.bodyReadings))
                        put("reinforcementPadReading", row.reinforcementPadReading)
                        put("captureState", row.captureState.name.lowercase())
                        put("note", row.note)
                    }
                }))
            })
            put("shellSettlementSurvey", pkg.shellSettlementSurvey?.let { survey ->
                JSONObject().apply {
                    put("stationCount", survey.stationCount)
                    put("stations", JSONArray(survey.stations.map { station ->
                        JSONObject().apply {
                            put("stationId", station.stationId)
                            put("angleDeg", station.angleDeg)
                            put("elevation", station.elevation)
                            put("captureState", station.captureState.name.lowercase())
                            put("note", station.note)
                        }
                    }))
                }
            })
            put("roundnessSurvey", pkg.roundnessSurvey?.let { survey ->
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
                                    put("captureState", station.captureState.name.lowercase())
                                    put("note", station.note)
                                }
                            }))
                        }
                    }))
                }
            })
            put("plumbnessSurvey", pkg.plumbnessSurvey?.let { survey ->
                JSONObject().apply {
                    put("stationCount", survey.stationCount)
                    put("stations", JSONArray(survey.stations.map { station ->
                        JSONObject().apply {
                            put("stationId", station.stationId)
                            put("angleDeg", station.angleDeg)
                            put("plumbness", station.plumbness)
                            put("captureState", station.captureState.name.lowercase())
                            put("note", station.note)
                        }
                    }))
                }
            })
            put("findings", JSONArray(pkg.findings.map { finding ->
                JSONObject().apply {
                    put("findingId", finding.findingId)
                    put("surface", finding.surface)
                    put("type", finding.type)
                    put("severity", finding.severity)
                    put("note", finding.note)
                    put("linkedMeasurementId", finding.linkedMeasurementId)
                    put("locationSummary", finding.locationSummary)
                    put("attachmentIds", JSONArray(finding.attachmentIds))
                }
            }))
            put("attachments", JSONArray(pkg.attachments.map { attachment ->
                JSONObject().apply {
                    put("attachmentId", attachment.attachmentId)
                    put("kind", attachment.kind)
                    put("relativePath", attachment.relativePath)
                    put("caption", attachment.caption)
                }
            }))
            put("mflImport", pkg.mflImport?.let { mfl ->
                JSONObject().apply {
                    put("contractor", mfl.contractor)
                    put("reportReference", mfl.reportReference)
                    put("reportDate", mfl.reportDate)
                    put("severity", mfl.severity)
                    put("attachmentId", mfl.attachmentId)
                }
            })
            put("reviewStatus", JSONObject().apply {
                put("status", reviewStateJson(pkg.reviewStatus.status))
                put("warnings", JSONArray(pkg.reviewStatus.warnings))
            })
        }.toString(2)
    }

    private fun roofTemplateJson(templateName: String): String = when (templateName) {
        "CIRCULAR_PLATE" -> "circular_plate"
        "CIRCULAR_CENTER_OPENING" -> "circular_center_opening"
        "UMBRELLA_RADIAL" -> "umbrella_radial"
        else -> templateName.lowercase()
    }

    private fun rotationDirectionJson(raw: String): String = when (raw) {
        "CLOCKWISE" -> "clockwise"
        "COUNTERCLOCKWISE" -> "counterclockwise"
        else -> raw.lowercase()
    }

    private fun reviewStateJson(state: ReviewState): String = when (state) {
        ReviewState.DRAFT -> "draft"
        ReviewState.READY_FOR_UPLOAD -> "ready_for_upload"
        ReviewState.UPLOADED -> "uploaded"
        ReviewState.REVIEWED -> "reviewed"
    }
}

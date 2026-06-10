package ai.laiq.tankinspection.v2product.model

enum class V2ChecklistRating(
    val key: String,
    val shortLabel: String,
    val label: String,
) {
    GOOD("1", "1", "Good Condition"),
    SATISFACTORY("2", "2", "Satisfactory Condition"),
    NOT_TO_CODE("NC", "NC", "Not to Code"),
    REQUIRES_REPAIR("3", "3", "Requires Repair/Action"),
    IMMEDIATE_ATTENTION("4", "4", "Poor, Requires Immediate Attention"),
    INACCESSIBLE("IA", "IA", "In-accessible"),
    NONE_EVIDENT("NE", "NE", "None Evident"),
    NOT_APPLICABLE("N/A", "N/A", "Not applicable"),
    ;

    companion object {
        fun fromKey(key: String?): V2ChecklistRating? =
            entries.firstOrNull { rating -> rating.key == key }
    }
}

data class V2ChecklistItemDefinition(
    val number: Int,
    val prompt: String,
)

data class V2ChecklistSectionDefinition(
    val key: String,
    val title: String,
    val items: List<V2ChecklistItemDefinition>,
    val commentsHint: String? = null,
)

data class V2InspectionChecklistState(
    val selectedSectionKey: String = V2InspectionChecklistCatalog.sections.first().key,
    val ratingsByItemNumber: Map<Int, V2ChecklistRating> = emptyMap(),
    val sectionComments: Map<String, String> = emptyMap(),
)

object V2InspectionChecklistCatalog {
    // The fixed-roof Pacific Energy sample field sheet intentionally jumps from 96 -> 144
    // and 152 -> 166 because the floating-roof-only sections are omitted in that PDF variant.
    // Keep the original item numbers so the mobile checklist matches the source document.
    val sections: List<V2ChecklistSectionDefinition> = listOf(
        V2ChecklistSectionDefinition(
            key = "diked_area",
            title = "Diked Area",
            items = listOf(
                1 to "Diked area condition (vegetation, debris, erosion):",
                2 to "Dike wall condition (erosion, cracks):",
                3 to "Flammable materials within the diked area (wood, product):",
                4 to "Site drainage:",
                5 to "Standing water:",
                6 to "Pipe work (corrosion, paint):",
                7 to "Pipe supports functioning:",
                8 to "Pipe sealed through dike wall:",
            ).toChecklistItems(),
            commentsHint = "Use suffix notes like 8a/8b if extra checklist items need to be captured.",
        ),
        V2ChecklistSectionDefinition(
            key = "tank_foundation",
            title = "Tank Foundation",
            items = listOf(
                9 to "Level survey required (base on visual planar tilt) (C.1.1 & C.1.1.1(e)):",
                10 to "Ring beam (cracks, breaks, spalling):",
                11 to "Bitumen cover (cracks, washouts, erosion):",
                12 to "Plinth seal (deterioration, peeling):",
                13 to "Foundation (erosion, leaks, cond.) (API 650 7.5.5) (API 653 4.5.1):",
                14 to "Condition of pad (i.e. washout reveal crushed rock under bottom):",
                15 to "Water ingress/egress/vegetation against bottom (C.1.1.1(c)):",
                16 to "Indications of bottom leaks:",
                17 to "Floor plate extension cond. (API 650 5.4.2, 5.5.2) (API 653 4.4.5.7):",
                18 to "Floor plate extension welds (pitting, corrosion, undercut):",
                19 to "Earth grounding cables and connectors cond. (API 575 7.2.5):",
                20 to "Tank settlement into pad (C.1.1.2):",
            ).toChecklistItems(),
        ),
        V2ChecklistSectionDefinition(
            key = "shell_external",
            title = "Shell External",
            items = listOf(
                21 to "Coating or painting on shell plates (blisters, peeling, stains):",
                22 to "Insulation (cracks, leaks, moisture retention):",
                23 to "Shell pitted or corroded (API 653 4.3):",
                24 to "Deformation of shell, banding, peaking (API 650 7.5.4) (API 653 10.5.4, 10.5.5):",
                25 to "Bottom course deformation:",
                26 to "Shell lap patches (API 653 9.3):",
                27 to "Indication of shell leaks:",
                28 to "Shell misalignment (API 650 7.2.3):",
                29 to "Weld reinforcement (API 650 8.1.3.4, for RT) (API 653 10.4.2.6):",
                30 to "Riveted joint condition (worn, corroded):",
                31 to "Riveted vertical joints full fillet lap welded (C.1.2.3(d)):",
                32 to "Seam weld condition:",
                33 to "Tank plumb (API 650 7.5.2) (API 653 10.5.2):",
                34 to "Tank roundness (API 650 7.5.3) (API 653 10.5.3):",
                35 to "Seam weld undercut (API 650 7.2.1.4, 7.3.2.1, 8.5.1(b)):",
                36 to "Remnant welds (API 650 5.8.1.2(c)) (API 652 4.3):",
                37 to "Shell vertical seam weld spacing (API 650 5.1.5.2(b)):",
                38 to "Name plate attachment (API 650 10.1, API 653. 13.1):",
                39 to "Check overflow slots for corrosion and screening:",
                40 to "Check overflow does not drain over valves or equipment:",
            ).toChecklistItems(),
        ),
        V2ChecklistSectionDefinition(
            key = "shell_appurtenances",
            title = "Shell Appurtenances",
            items = listOf(
                41 to "Leakage around reinforcement plate welds:",
                42 to "Reinforcement tell tale holes (API 650 5.7.5.1, 5.7.6.1.b):",
                43 to "Reinforcement plate spacing (API 650 5.7.3):",
                44 to "Reinforcement plate size/thickness (API 650 5.7.2):",
                45 to "Reinforcement plates overlapping seam welds (API 650 5.7.3.4):",
                46 to "Nozzles > 2 in require reinforcement (API 650 5.7.2.1, Fig. 5-8 Note 3):",
                47 to "Nozzle weld corrosion/undercut (API 650 8.5.1(b)):",
                48 to "Excessive dimpling of shell plate or bowing of piping:",
                49 to "Indications of leakage around manifolds, flanges, or valves (C.1.3.2):",
                50 to "Indications of leakage around manways and nozzles:",
                51 to "Indications of leakage around flange bolts and welds:",
                52 to "Tank mixer mounting base (weld failure, damage):",
                53 to "Leakage around mixer shaft seal:",
                54 to "Condition of welds on davit clips (valve, mixers, cleanouts):",
                55 to "Wind girder, supports, handrails (corrosion, weld failure):",
                56 to "Wind girder (debris buildup, paint failure):",
                57 to "Shell attachments (API 650 5.8):",
                58 to "Leaks at sample connection (C.1.3.4):",
                59 to "Visual of fire equipment (C.1.3.2(b)):",
                60 to "Inspect condition of power lines for mixer, instruments, etc.:",
                61 to "Heater (mounted in shell manway) check drain for product leaks (C.1.3.5):",
                62 to "Emergency overflow screens clean and free of debris:",
                63 to "Anchor bolt condition (if present):",
            ).toChecklistItems(),
        ),
        V2ChecklistSectionDefinition(
            key = "access_structure",
            title = "Access Structure",
            items = listOf(
                64 to "Ladder attachments to concrete base (corrosion, broken):",
                65 to "Bolts and fasteners on stairways and ladder stringers (corrosion):",
                66 to "Welds on stairways and ladder stringers (corrosion, broken):",
                67 to "Welds on spiral stairway to shell supports (corrosion, broken):",
                68 to "Stairways and ladders (corrosion, broken):",
                69 to "Stairways and ladders (coating or paint failure):",
                70 to "Attachment welds of handrails to stairways (corrosion, broken):",
                71 to "Tubular / solid bar stairway handrails (corrosion, pitting, paint failure):",
                72 to "Tread attachments to stringers (corrosion, broken):",
                73 to "Safety drop bar or safety chain provides adequate protection:",
                74 to "Gauger platform frame and supports (corrosion, broken):",
                75 to "Gauger platform deck (corrosion, thinning, weld failure):",
                76 to "Gauger walkway for thinning and slots:",
                77 to "Inspect all deck plate gratings for corrosion and thinning:",
            ).toChecklistItems(),
        ),
        V2ChecklistSectionDefinition(
            key = "fixed_roof_cone_dome",
            title = "Fixed Roof - Cone / Dome",
            items = listOf(
                78 to "Roof plate distortions:",
                79 to "Roof plates (corrosion, pitting, holes) (API 653 4.2.1.2):",
                80 to "Roof plates (coating or paint failure):",
                81 to "Remnant welds (API 650 5.8.1.2(c)) (API 652 4.3):",
                82 to "Roof plate lap joints (API 650 5.1.3.4, 5.1.3.5):",
                83 to "Indications of product staining:",
                84 to "External rafter (corrosion, paint failure, spacing) (API 650 5.10.4.4):",
                85 to "Frangible joint (API 650 5.1.5.9(b), 5.10.2.6):",
                86 to "Curb angle size (API 650 5.1.5.9(e)):",
                87 to "UT thickness survey for internal corrosion before accessing roof (C.1.4.1):",
                88 to "Rain water standing, sag of roof (rafter may be broken) (C.1.4.3):",
                89 to "UT thickness survey:",
            ).toChecklistItems(),
            commentsHint = "Identify and mark any roof area below API 653 minimum thickness of 0.09 inch in a 100 sq inch area.",
        ),
        V2ChecklistSectionDefinition(
            key = "roof_appurtenances",
            title = "Roof Appurtenances",
            items = listOf(
                90 to "Manway covers secured in place, condition:",
                91 to "Vacuum-pressure vent pallet assembly:",
                92 to "Vacuum-pressure vent screens (clean and free of debris):",
                93 to "Flame arrester (mechanical integrity):",
                94 to "Dip hatch (clean, operates freely, seals properly):",
                95 to "Nozzles >= 6 in require reinforcement (API 650 Table 5-14):",
                96 to "Roof manholes/rectangular opening reinforcement (API 650 5.8.4, 5.8.6):",
            ).toChecklistItems(),
        ),
        V2ChecklistSectionDefinition(
            key = "fixed_roof_internal",
            title = "Fixed Roof Internal",
            items = listOf(
                144 to "Structural/mechanical integrity:",
                145 to "Underside of roof:",
                146 to "Roof plate lap joints (API 650 5.1.3.4, 5.1.3.5):",
                147 to "Roof support rafters condition:",
                148 to "Rafter spacing (API 650 5.10.4.4):",
                149 to "Rafter attachment to shell (API 650 5.10.4.6):",
                150 to "Shell clips/brackets condition:",
                151 to "Column support verticality:",
                152 to "Roof venting nozzles trimmed flush (API 650 Fig. 5-19 and 20):",
            ).toChecklistItems(),
        ),
        V2ChecklistSectionDefinition(
            key = "shell_internal",
            title = "Shell Internal",
            items = listOf(
                166 to "Structural/mechanical integrity:",
                167 to "Shell corrosion (API 653 4.3):",
                168 to "Weld seam undercut (API 653 10.4.2.5):",
                169 to "Remnant welds (API 650 5.8.1.2(c)) (API 652 4.3):",
                170 to "Gauge well (corrosion, pitting):",
                171 to "Gauge well attach to shell (weld corrosion, crack):",
                172 to "Gauge well bracket attachment weld. (corrosion, crack):",
                173 to "Grooving due to rise/fall of floating roof rubbing on shell (C.1.2.2):",
                174 to "Weld cap corrosion of shell-to-bottom joint (C.2.3):",
            ).toChecklistItems(),
        ),
        V2ChecklistSectionDefinition(
            key = "floor_internal",
            title = "Floor Internal (Cone Up or Down)",
            items = listOf(
                175 to "Floor condition (corrosion, pitting):",
                176 to "Remnant welds (API 650 5.8.1.2(c)) (API 652 4.3, 4.4):",
                177 to "Bulges/depressions (API 653 B3.3):",
                178 to "Weld profile:",
                179 to "Standing water:",
                180 to "Dip plate condition:",
                181 to "Protective coating deterioration:",
                182 to "Bottom lap weld joints (API 650 5.1.3.4, 5.1.3.5):",
                183 to "Edge settlement (API 653 B.2.3, B.2.4, B.3.4):",
                184 to "Three way joint spacing (API 650 5.1.5.4):",
                185 to "Floor/shell joggle joints (API 650 5.1.5.4):",
                186 to "Annular bottom width (API 650 5.5):",
                187 to "Floor plate critical zone patches (API 653 9.10.1.2):",
                188 to "Floor plate joints from shell vertical joints (API 653 Fig. 9-1):",
                189 to "Shell-to-bottom fillet weld (API 650 5.1.5.7):",
                190 to "Shell-to-bottom HAZ:",
                191 to "Sump condition:",
                192 to "UT thickness reading if practicable:",
                193 to "Identify bottom slack plate and mark approximate boundary (C.2.3(h)):",
                194 to "Condition of floor coating extend up to the shell:",
                195 to "Condition of shell internal coating (if fully coated):",
            ).toChecklistItems(),
            commentsHint = "If the bottom is flat, record it as flat in the section comments.",
        ),
    )

    val totalItemCount: Int = sections.sumOf { section -> section.items.size }
    val itemNumbers: Set<Int> = sections.flatMap { section -> section.items.map { item -> item.number } }.toSet()

    fun sectionByKey(key: String): V2ChecklistSectionDefinition =
        sections.firstOrNull { section -> section.key == key } ?: sections.first()
}

fun V2InspectionChecklistState.withSelectedSection(sectionKey: String): V2InspectionChecklistState =
    copy(selectedSectionKey = sectionKey)

fun V2InspectionChecklistState.withRating(
    itemNumber: Int,
    rating: V2ChecklistRating,
): V2InspectionChecklistState =
    copy(ratingsByItemNumber = ratingsByItemNumber + (itemNumber to rating))

fun V2InspectionChecklistState.withSectionComment(
    sectionKey: String,
    comment: String,
): V2InspectionChecklistState =
    copy(
        sectionComments = if (comment.isBlank()) {
            sectionComments - sectionKey
        } else {
            sectionComments + (sectionKey to comment)
        },
    )

fun V2InspectionChecklistState.completedItemCount(): Int =
    ratingsByItemNumber.keys.count { itemNumber -> itemNumber in V2InspectionChecklistCatalog.itemNumbers }

fun V2InspectionChecklistState.missingItemCount(): Int =
    V2InspectionChecklistCatalog.totalItemCount - completedItemCount()

fun V2InspectionChecklistState.isComplete(): Boolean =
    missingItemCount() == 0

private fun List<Pair<Int, String>>.toChecklistItems(): List<V2ChecklistItemDefinition> =
    map { (number, prompt) -> V2ChecklistItemDefinition(number = number, prompt = prompt) }

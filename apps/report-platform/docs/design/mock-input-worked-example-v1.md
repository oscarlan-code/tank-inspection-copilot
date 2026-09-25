# Worked mock inspection input example v1

Status: **source-assisted mock inspection specification, revision 2, 18 September 2026**.
The user's photo rule requires real report photographs for findings. Structured
values and most voice scripts are synthetic; the floor/shell photo-supported
condition descriptions are aligned to the selected report photos. This document
is a preparation brief and proposed answer key, not an app export. Expected labels
are **review pending**. It is not a real inspection or an independent field benchmark.
SYN-025 and its location labels are evaluation aliases.

Parent specification: [25-section mock input matrix](mock-input-matrix-v1.md).
Destinations use [generic outline revision 3](generic-report-outline-v1.md) and
its existing [section formats](generic-section-formats-v1.md).

Before the positive export test, apply the matrix's
[pre-export completeness standard](mock-input-matrix-v1.md#pre-export-completeness-standard):
review required app inputs against the selected report outline and supply a
supported response to every checklist item. The materialized revision-2 draft
has 62/195 responses and remains an incomplete-input diagnostic. A new complete
revision is required for the normal export/import evaluation; the current
diagnostic must not be relabelled as that successful case.

The subsequent [revision-3 preparation and export review](../reviews/2026-09-18-syn025-complete-export.md)
supplies all 195 responses and exercises the normal native exporter. Its
expanded synthetic scope, eleven voice scripts and per-item observations are
versioned separately; they do not alter this revision-2 brief. Report readiness
and downstream dependencies remain separately reviewed.

## Case and selected scope

| Field | Preparation value |
| --- | --- |
| Case / revision | `synthetic-inspection-025`, revision `2`; mixed synthetic inputs and report-derived photographs |
| Asset / inspection | `SYN-025`; `syn025-inspection-20260918` |
| Client / location / inspector | Synthetic Evaluation Client; Synthetic Yard; Synthetic Inspector 01 |
| Inspection time / evidence cutoff | 18 September 2026; `2026-09-18T09:00:00+08:00` to `2026-09-18T17:00:00+08:00` |
| Configuration | Vertical tank; external fixed roof; no internal floating roof; diameter 10 m; height 12 m; six shell courses and four measurement lanes. Record units explicitly and use matching layout configuration. |
| Scope | Visual examination of accessible roof surface, external shell and floor; spot UT at identified locations. Floor plate F14 is inaccessible under temporary equipment. |
| Not commissioned | MFL, B-scan, dimensional/settlement survey, calculations, engineering assessment, calibration, repair consultation and post-repair verification. |
| Phase | Current inspection before any proposed repairs; no repair completion is asserted. |
| Core selected modules | `identity`, `scope`, `findings`, `recommendations`, `methods`, `checklist`, `thickness`, `layout`, `photos`. |
| Template/reference modules | Select `regime` with an applicable approved template; select `references` when a document is actually used. Missing required template remains pending. |
| Composition extension | Explicitly select `summary` as a candidate profile extension to test concise cross-references. Do not assume every vertical-inspection profile includes it. |
| Evaluation only | No learning, policy update or promotion; no same-case final-report input. |

Revision 1 was an independent synthetic design. Revision 2 uses verified real
report photos as directed by the user; the associated condition wording retains
that source lineage. Photo sourcing is separate from optional prior-asset history:
these photos are not historical evidence for a real asset named SYN-025. The nine
core modules can be evaluated as drafts while missing dependencies remain explicit.

## App inputs to materialize

| Source ID | Data preparation instruction | Expected treatment |
| --- | --- | --- |
| A01 | Enter the identity/configuration/inspection fields above in the app. Leave unknown design data and previous inspection fields empty in the base case. | Keep input values distinct from metadata creation/export timestamps. Record any captured fields lost during serialization. |
| G01 | Create external-roof, shell and floor layouts in the app. Include roof region R03, shell region L1-C1, floor plates F12/F14 and nozzle N1. Use IDs actually emitted by the app; freeze the alias mapping in the case manifest. | No internal-roof figure for an absent internal roof. Preserve geometry, orientation and all location links. |
| U01 | Floor F12 five-point UT: UT1 6.2, UT2 6.1, UT3 6.0, UT4 6.2, UT5 6.1 mm. Enter through native UT controls. | Preserve ordered values and explicit unit provenance. No corrosion rate or acceptance conclusion is supplied. |
| U02 | Shell nozzle N1: 12 o'clock 7.1, 3 o'clock 7.0, 6 o'clock 7.2, 9 o'clock 7.1 mm; pad 8.0 mm, if supported by the selected app component configuration. | Preserve nozzle/pad identity and actual native column mapping. Do not treat this as a shell-plate row. Unused reading cells are not zeros. |
| O01 | Create floor F12 finding: coated surface pitting. Link the finding to U01 and the exact app map entity. | Condition supported by source Photo 27; F12 is a declared evaluation alias, not an established original photo location. Recorded synthetic point readings are not measured pit depths from the photo. |
| O02 | Create external-shell L1-C1 finding: coating damage along a horizontal seam. | Condition supported by source Photo 7; L1-C1 is an evaluation alias. Preserve external shell versus floor identity. |
| C01 | Use actual app checklist item IDs: select the supported response for observed floor condition and record F14 as not examined with the access reason. Prepare remaining applicable responses from additional explicit synthetic observations, consistent with this brief; retain the definition and legend. | Do not invent a checklist number/rating key or blanket-fill pass/N/A. Normal export requires the complete checklist. Until responses are genuinely prepared, this remains a blocked draft. Freeze exact selections after native capture. |
| P01 / P02 | Extract real report Photo 27 (floor, page 42) and Photo 7 (external shell, page 39) from the 18PE1-3 TK SU4 report. Preserve the actual images and finding links; record source PDF hash, page, photo number and extracted-image hash. | No generated image replacement. Do not infer dimensions, pit depth, exact original plate ID or repair completion from the photos. Missing/unmatched photos stay pending. |
| T01 | Select an existing approved standard regime template only if its applicability is established; record ID, revision/hash and declared placeholders. | No new regime wording is authored here. Missing T01 stays pending and receives no AI fallback. |

Human labels F12, F14, R03 and N1 are case aliases. They do not imply a new native
ID schema. The generated app IDs, `targetKey`, `itemKey`, `linkedUtItemKey` and
finding/photo relationships must agree across all records. Avoid editing a mock
JSON into a shape the real exporter cannot produce.

Complete the app's actual validation and layout/element/UT scope approvals before
calling a materialized package a native export. This brief specifies selected
records for the worked mapping; it is not a complete checklist or a claim that
the current draft passes those gates. An unanswered-checklist variant is a
separate pre-export rejection test, not one of the exported A/B/C variants below.

For the current serializer, preserve `itemKind: "LAYOUT_REGION"` or `"ELEMENT"`
as actually exported. Shell region IDs use forms such as `shell:region:L1-C1`;
an element uses `shell:element:<elementId>`. Current finding storage uses its
native item key for both `findingId` and `linkedUtItemKey`; photo `findingId`
must point to that same key, while retaining its own `attachmentId`. Preparation
aliases O01/P01 must not replace these native identifiers in the app payload.

## Generator-visible voice scripts

Record these through the appropriate app controls when materializing the case.
Retain native screen/card/item context as emitted; the capture suggestions below
are not new screen keys or section labels. Script IDs V01–V08 are preparation
aliases mapped to actual `voiceNoteId` values after capture. Each numbered
sentence is a stable source span for this text-only example; use actual text
offsets/audio spans when those artifacts exist.

| Script | Capture context | Spoken content |
| --- | --- | --- |
| V01 | General information or scope context; no fabricated item anchor | [1] “This is the current inspection of SYN-025 at Synthetic Yard.” [2] “The agreed work is visual inspection of the accessible roof, external shell and floor, plus spot UT at the marked locations.” [3] “MFL and settlement survey are not included in this job.” |
| V02 | UT screen; retain the actual active item if one is selected | [1] “For this inspection, all the spot UT readings I have entered are in millimetres.” [2] “I used ultrasonic thickness gauge SYN-UT-01 for spot measurements at the marked points.” [3] “These readings cover those points only; I have not scanned the whole plates.” |
| V03 | Floor F12 finding/item | [1] “On floor plate F12, I can see coated surface pitting.” [2] “I recommend repairing the affected area before the tank returns to service.” [3] “The five readings entered for F12 are spot measurements; I have not established the deepest pit.” |
| V04 | Floor F14 location or relevant checklist item | [1] “I could not examine floor plate F14 because temporary equipment covers it.” [2] “Its condition is not assessed.” |
| V05 | External-shell L1-C1 finding/item | [1] “There is coating damage along a horizontal seam in shell region L1-C1 on the outside.” [2] “I recommend restoring the coating at that location.” [3] “I have not assigned a completion date.” |
| V06 | External-roof R03 location or relevant checklist item | [1] “At roof region R03, no visible corrosion was observed on the accessible upper surface.” [2] “I did not inspect the underside.” |
| V07 | Shell nozzle N1 UT card | [1] “These readings are for shell nozzle N1 and its reinforcement pad.” [2] “Use the clock positions shown on the measurement card.” [3] “I am not making an acceptance assessment from these readings.” |
| V08 | Inspection closeout/general context | [1] “The observations I want highlighted are the floor pitting at F12 and the external coating damage at L1-C1.” [2] “F14 remains unexamined.” [3] “The recommendations are still proposed work; I have not verified any completed repairs.” |

Equipment ID SYN-UT-01 is a fictional instrument identifier, not a calibration
certificate. If an applicable methodology block requires procedure or calibration
details that these inputs do not provide, record that dependency as missing.
Do not invent it from an older report.

V02's explicit inspection-wide unit statement can support a reviewed unit
normalization for U01/U02, retaining V02 as its source. It does not erase the
exporter's missing native unit metadata. Test native unit preservation and
voice-assisted normalization as separate outcomes. V07 preserves position
semantics; normalizer mappings must still match the actual measurement card.

## Evaluator-only proposed claim/placement labels

Keep this table out of generator input. Each row is an independently inspectable
expected-use proposal authored from the scripts, **not output of the classifier**.
All rows carry source revision `2`, asset `SYN-025`, phase `current_inspection`,
availability `captured_in_script`, applicability `selected`, and review status
`pending_independent_review`. It becomes captured audio only after recording.

Roles below are exactly `required_narrative`, `required_structured`, `supporting`
and `cross_reference`. Representations such as “concise reference” do not create
new roles. Each non-supporting row/destination is a required placement in this
proposed answer key; a cross-reference obligation requires a resolved link to
the canonical detail, without duplicating that detail.

Resolve each table destination into an explicit section instance before scoring:

| Instance ID | Module / instance dimensions |
| --- | --- |
| scope-report / summary-report | `scope` / `summary`; report-wide current inspection. |
| findings-floor | `findings`; floor, internal, current inspection. |
| findings-shell | `findings`; shell, external, current inspection. |
| findings-roof | `findings`; external roof, accessible upper surface, current inspection; underside exclusion is a limitation of this instance. |
| recommendations-floor / recommendations-shell | `recommendations`; respectively floor/internal and shell/external, current proposed actions. |
| thickness-floor | `thickness`; floor plate, internal, spot UT, current inspection. |
| thickness-nozzle | `thickness`; shell nozzle/reinforcement pad N1, external, spot UT, current inspection. |
| checklist-floor | `checklist`; floor, internal, current inspection. |
| methods-ut | `methods`; spot UT, current inspection. |

Use IDs have the form `claimId:sectionInstanceId:slotId`, for example
`E04:recommendations-floor:actions`. E11's unit statement explicitly has two uses:
`E11:thickness-floor:basis` and `E11:thickness-nozzle:basis`. E03/E04/E06 bind
floor instances, E07/E08 shell instances, E09/E10 roof instances; E05 uses
thickness-floor/findings-floor and E14/E15 thickness-nozzle. E13's thickness
reference applies to both thickness instances. Report-wide and method uses bind
their named instances. No alternative placement is accepted silently: record it
as a reviewed change to the expected-use manifest before scoring.

| Claim ID / source span | Meaning and instance | Expected destination(s) and role | Output representation / protected meaning |
| --- | --- | --- | --- |
| E01 / V01[2] | Agreed current inspection scope; report-level | `scope.tasks`: required_narrative; `findings.extent`: cross_reference in each of the three findings instances; `summary.scope`: required_narrative | Numbered scope plus concise summary; retain accessible surfaces and spot UT extent. |
| E02 / V01[3] | Excluded tests; report-level | `scope.limits`: required_narrative | No MFL or settlement-survey results may be inferred from mentioning the methods. |
| E03 / V03[1] | Floor/internal F12, coated surface pitting | `findings.condition`: required_narrative; `recommendations.basis`: supporting; `summary.results`: required_narrative | Component finding paragraph and concise source-linked summary; retain photo-derived condition lineage and avoid an invented pit depth. F12 is an evaluation location alias. |
| E04 / V03[2] | Floor F12, explicit inspector recommendation | `recommendations.actions`: required_narrative; `recommendations.priority`: required_structured; `summary.actions`: required_narrative | Numbered action and concise summary; preserve “before return to service” as timing. Do not turn the recommendation into completed work or select an unstated repair technique. |
| E05 / V03[3] | Floor F12, measured points versus deepest pit | `thickness.limits`: required_narrative; `findings.limits`: cross_reference | Preserve the limitation; minimum of five spot readings is not asserted to be the deepest pit. |
| E06 / V04[1–2] | Floor/internal F14, inaccessible and not assessed | `scope.limits`: required_narrative; `findings.limits`: cross_reference; `checklist.notes`: supporting; `summary.results`: required_narrative | Preserve the access cause and unknown condition; summary is concise. Checklist response derives from C01, not automatically from prose. |
| E07 / V05[1] | Shell/external L1-C1, coating damage along horizontal seam | `findings.condition`: required_narrative; `recommendations.basis`: supporting; `summary.results`: required_narrative | Retain external side, horizontal seam and photo-derived lineage; no severity or corrosion depth added. L1-C1 is an evaluation location alias. |
| E08 / V05[2–3] | Shell/external L1-C1, coating action without date | `recommendations.actions`: required_narrative; `summary.actions`: required_narrative | Numbered action and concise summary; priority/date remains not provided. Do not borrow F12's timing. |
| E09 / V06[1] | External roof R03, accessible upper surface, negative observation | `findings.condition`: required_narrative | Preserve “no visible corrosion observed” and surface/coverage; not a whole-roof condition claim. |
| E10 / V06[2] | External roof R03 underside, not examined | `scope.limits`: required_narrative; `findings.limits`: cross_reference | Do not map roof underside to an internal floating roof, which this asset does not have. |
| E11 / V02[1] | Inspection-wide explicit UT units | `thickness.basis`: required_structured in both thickness instances | mm; trace unit binding to the actual transcript and review. Never guess from numeric magnitude. |
| E12 / V02[2] | Performed spot UT and current instrument | `methods.method`: required_narrative; `methods.equipment`: required_structured | Method metadata with SYN-UT-01; no invented procedure revision or calibration validity. |
| E13 / V02[3] | Spot-only coverage | `methods.coverage`: required_narrative; `methods.limits`: cross_reference; `thickness.limits`: cross_reference in both thickness instances | Point coverage is preserved once in method text, with resolved references in the other blocks; no scan-coverage percentage. |
| E14 / V07[1–2] | Shell nozzle N1 / pad, measurement semantics | `thickness.location`: cross_reference; `thickness.basis`: supporting | Bind U02 to nozzle/pad and actual clock-position columns, not a shell-plate table. |
| E15 / V07[3] | N1, no acceptance assessment supplied | `thickness.limits`: required_narrative | Do not create an engineering acceptance conclusion. |
| E16 / V08[1–3] | Closeout confirmation linked to E03/E04/E06/E07/E08 | `summary.results`: supporting; `summary.actions`: supporting | Consolidate repeated same-entity statements with source links; no extra recall credit or required duplicate sentences. Preserve proposed versus completed work. |

V01[1] corroborates A01 and is identity metadata, not an extra finding obligation.
All script spans are thereby assigned a use, supporting/metadata role, or an
explicit consolidation decision. Missing/contradictory spans in actual recordings
would require a new source/expectation revision; the script cannot overwrite them.

Native expected content is assessed separately: A01 label–value fields; G01
faithful figures and orientation/aliases; U01/U02 exact native tables and units;
C01 selections and legend; O01/O02 relationships; P01/P02 photo sheets once the
files actually exist; T01 unchanged approved standard text once selected. These
are preparation obligations, not evidence that those artifacts have been built.

Required source relationships include E04→E03, E08→E07, O01→U01/G01/P01 and
O02→G01/P02. One source may support several sections. A finding may be summarized
without repeating all readings or attaching the raw voice transcript to the report.

## Three controlled variants

| Variant | Generator-visible input change | Evaluator expectation |
| --- | --- | --- |
| A: rich current evidence, no history | A01/G01/U01/U02/O01/O02/C01 and V01–V08; real media/template only once prepared. No prior-asset KB source. | Generate supported current content. Optional history omitted. No corrosion-rate, past-repair or remaining-life claim. Record actual missing media/template/procedure dependencies separately. |
| B: same current evidence plus applicable history | A unchanged. Add separately authored synthetic prior source H01 below, with matching asset identity and earlier date. | Add dated history and cite H01. Current observations and actions stay unchanged. Prior recommendation is not proof of completed repair. |
| C: sparse/ambiguous voice, no history | Start from A; remove V03[2], V05[2–3] and V08. Add V09: “That area needs attention,” with no trustworthy item anchor. Keep all structured findings/readings unchanged. | E04/E08 are unavailable input, excluded from action-recovery recall. V09 stays unresolved for location and specific action. Preserve available findings/UT; do not reconstruct withheld recommendations from the answer key. |

H01 is a **synthetic prior-source script to materialize separately**, not an
existing KB record: source ID `syn025-history-20240918`, issued 18 September 2024,
asset SYN-025 at Synthetic Yard, source page 1: “External visual inspection
recorded coating damage at the lower edge of shell region L1-C1. Coating repair
was recommended. Repair completion was not recorded.” Retain a source hash only
after the actual artifact exists. Review the source's component correspondence.

For B, add evaluator-only uses `identity.history` (required structured dated
entry for this variant) and `references.references` (required structured source
reference). Historical context may support `recommendations.basis`; it must not
become a second current finding. H01 contains no prior UT readings, so B still
cannot establish a corrosion rate. Neither H01 nor the voice scripts originate
from a hidden final report. Any source match/date conflict stays unresolved.

The three variants are one case, not three independent inspections. Record
omission reasons and keep evaluator-only withheld spans separate. Compare A/B
for historical contribution and A/C for capture/classification behaviour; do not
attribute their different available content to a generator improvement.

## What this example can establish next

Once materialized and independently labelled, check input/export preservation,
claim extraction, qualified/negative statement integrity, multi-section placement,
missing-input detection and formatted generation separately. A classifier drop
must not remove an expected captured claim from the denominator. Unknown units,
misrouted nozzle readings or absent roof figures are distinct handoff failures.

The document currently supports review of the preparation design and label
proposals only. It provides no ASR, native-import parity, generation-quality or
export-rendering score. Specialist sections from the matrix require their own
appropriately scoped cases and source artifacts.

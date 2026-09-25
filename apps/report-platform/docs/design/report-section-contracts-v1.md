# Report section contracts — vertical AST profile v1

Status: legacy evaluation-only compatibility outline, 17 September 2026. No
product/framework promotion is authorized. This document records one historical
vertical-AST report profile and the old outline experiment. It is useful input to
the historical KB, but it is not the structure authority for the rebuilt pipeline.
The Report Structure Agent will instead create a reviewed ReportPlan from all
compatible historical blueprints, the actual job scope, and the pinned applicable
standard obligations. Approved historical captures and saved evaluation results
have not been rewritten.

This is now explicitly the **32-section compatibility preset**, not a generic
all-report outline. The [all-KB consolidation](generic-report-outline-v1.md)
defines a separate offline candidate with 25 reusable templates and nine report
profiles, grounded in all 166 current KB entries. Its family/instance selection
is not yet integrated into this runtime planner. Original-page visual checks
and human template approval remain pending despite the broader extracted
structure review.

The legacy executable catalog is `server/section-contracts.mjs`
(`section_contract_v2`) and the legacy evaluation planner is
`server/section-planner.mjs` (`section_planning_v1`).
The **Evaluation Lab → Outline experiment** review panel supports multiple report uses, explicit
unit/entity resolutions and section applicability. Required captured content
cannot be hidden by a not-applicable decision; missing applicable blocks keep
approval blocked. A catalog slot for a specialized test or assessment does not
mean its native capture adapter or engineering calculation is implemented.

Each executable outline contains ordered block titles and purposes, accepted
evidence kinds by role, matching rules, presentation schema and missing-data
behavior. The planner matches normalized native context against these rules;
it does not choose one exclusive section label for an entire source record.
The complete catalogue is hash-pinned with the candidate plan. Reviewers can
inspect every destination of a record and add, update/move or remove one
`useId` independently, including several uses within the same section. The
last removal retains an unassigned review item instead of deleting evidence.
Candidate generation is explicit, produces standalone evaluation results and never
writes a product draft or updates learning/promotion state. The previous normal
generation path is legacy comparison/read support only. The rebuilt pipeline does
not fall back to it.

An outline entry is not an implemented Section Generation Agent. Under the target
architecture, every applicable section/profile instance must also bind to an exact
agent release in its `SectionPlan`. Only General Tank Information v1 has that
release today, and it remains evaluation-only. The other 31 compatibility entries
describe planning structure for later work; they do not claim working agents.

## Profile boundary and ownership

The initial profile ID is `api653-vertical-ast-v1`, scoped to the existing
`api653-internal-external` vertical AST family. Preserve the 32 IDs and sequence in
[`server/report-toc.mjs`](../../server/report-toc.mjs). Its fixed historical page
numbers and coarse `kind` values are not section obligations, applicability
rules, or rendering rules. Pagination comes from the assembled document. A
different tank/report family requires an explicit reviewed profile; it must not
inherit these requirements merely because a keyword matches.

The profile selects a section ID; the server-owned registry resolves that pair to
an immutable agent ID, version, and manifest hash. Repeated instances may share an
agent family only when their full contracts are identical. No plan may resolve
`latest`, take an agent version from app data, or continue after an unknown mapping.

This is a report organization contract, not an assertion that a technical
standard requires every section, table, calculation, or conclusion below.
Applicable procedures, editions, acceptance criteria, calculation methods, and
engineering decisions need separately reviewed sources and authorized review.

The inspection app owns capture records and their native context. The backend
owns classification and report section labels. Never write report-section IDs
back into the immutable app export. Preserve source section labels for historical
sources separately from target sections. One physical observation may have
several typed uses: a finding in the narrative, a row in a detailed inspection
table, a map marker, and a link beside a reviewed repair recommendation.

No section may contain a generated raw-evidence appendix, unassigned-note dump,
flattened table text, or an inventory of imported records. The designated UT,
checklist, photograph, drawing, MFL, and assessment sections remain legitimate
report content when selected and applicable. Existing Appendix A is a reviewed
engineering summary, not a place to dump supporting evidence.

## Shared content and readiness contract

Every section entry below inherits these rules. They make the behavior explicit
without repeating the same rules in all 32 entries.

### Evidence and output roles

Normalize native records into `EvidenceRecord` objects with immutable source
record/cell pointers, component and location identity, value/unit or statement,
capture/review status, and source revision. The categories below include native
evidence, derived/reviewed records, and separately scoped guidance. Guidance
stays in its own context lane; it is not current-inspection `EvidenceRecord`
truth. These are design categories, not a claim that the current export already
contains those object types:

| Evidence category | Meaning |
| --- | --- |
| identity / scope / history | Tank identity, inspection extent and dates, declared configuration, confirmed operating or maintenance history. |
| observation | A captured finding, condition note, or explicit checklist observation bound to its component/location; retains negation and uncertainty. |
| voice claim | A bounded, source-linked span from a routed transcript. Compound notes can yield several claims with different uses. |
| measurement | Ordered native measurement cells with unit, point/row/component identity, measured status, and validity. |
| checklist response | Exact prompt, selected response and meaning, item/section identity, and any notes. |
| geometry / artifact | App layout, element, drawing, photo, scan, or deterministic figure with source hash and host identities. |
| test / survey | Recorded method, extent, instrument/procedure metadata, locations, observations, and results. Dedicated records may need a versioned handoff extension or report-side input. |
| calculation result | Output of a separately versioned, reviewed deterministic calculator, bound to all inputs, units, method/edition and review state. |
| assessment / recommendation | Explicitly captured or report-side reviewed professional conclusion/action. A model suggestion remains a proposal until confirmed. |
| manual confirmation | A versioned report-side input with actor, timestamp, reason, and evidence links. It never silently overwrites an app record. |
| controlled guidance | Approved procedure/vendor/standards guidance. It cannot supply current inspection facts. |

Each `EvidenceUse` has one of these roles for its specific destination:

- `required_narrative`: the observation/conclusion must appear as a supported
  statement in the named block; equivalent professional wording is acceptable.
- `required_structured`: the designated cell, field, figure, response, or
  protected value must appear in its specified deterministic block.
- `supporting`: available to justify a statement or calculation; reproduction is
  not an output requirement and omission is not a recovery failure.
- `cross_reference`: a typed link to another selected section/artifact; it must
  resolve and must not introduce a second uncontrolled copy of its values.

An `OutputObligation` names the section/block, triggering condition, evidence
uses, component identity and checks. Freeze the obligation set with the
`SectionPlan` before generation and evaluation. Do not derive it from every
captured record or reduce it after seeing poor recovery. Distinguish the
available required-output denominator from the missing-input obligations that
prevent approval; both remain visible. Unresolved critical classification goes
to the review inbox and remains a planning blocker, rather than silently
disappearing from either list.

### Applicability, voice, and missing data

Each section/block is explicitly `applicable`, `not_applicable`, or `unconfirmed`
in the reviewed report plan. Unconfirmed applicability is unresolved work. A
`not_applicable` decision needs a captured or reviewed reason (for example an
absent roof configuration or a test excluded from the agreed scope). No records
is `unresolved`, not proof of no defects, no repairs, no test, or satisfactory
condition. A not-inspected statement is distinct from a satisfactory result.

Optional subsection shells are omitted when the reviewed profile says they are
not applicable. A required section may retain a short approved scope exclusion
if the customer's chosen report format needs it. An applicable but incomplete
block retains its specific missing-input issue in the review UI. Do not emit
empty tables, unfinished bullets, or fabricated boilerplate to make it look
complete. Final export requires resolution or an explicitly approved qualified
statement allowed by the section contract; a qualification cannot bypass
required measurement integrity, engineering review, or applicable approval
gates.

The LLM is invoked only for confidently routed voice evidence, according to the
shared governed generation rule. It writes bounded prose slots, with protected
values supplied by the compiler. Without voice, valid native observations,
confirmed manual statements and measurements still compile into useful ordered
report blocks through deterministic templates. The absence of voice cannot
erase native report content. Free text that lacks enough component or statement
structure for a faithful deterministic representation is retained in review
until classified; it is never appended wholesale. Model failure follows the
same rule, leaving only the unresolved prose slot pending.

### Dependencies and provenance

Every required block inherits the source export revision, evidence IDs and
source pointers, mapping/section-contract version, manual-input revision where
used, compiler/renderer version, and applicable calculation/artifact revision.
The following section entries add the specific dependencies. A change to an
input invalidates dependent summaries, figures, approvals, and export snapshots.
Browser preview and document export consume the same typed `ReportDocument`
blocks and table cells. Provenance belongs in the review interface and audit
manifest, except for reader-useful report references/captions selected by the
format; it does not become an evidence appendix.

## Verified app fields and routing boundaries

The paths below were checked against the native V3 exporter
[`ProductStore.kt`](../../../field-android/app/src/main/java/ai/laiq/tankinspection/v3product/storage/ProductStore.kt)
(`buildExportPackageJson` and entity serializers), not inferred solely from a
report fixture. This is code-contract verification; a real-device export still
needs the end-to-end acceptance trace. The
[upload handoff](../contracts/platform/ANDROID_V3_OBJECT_UPLOAD_HANDOFF.md) remains authoritative
for authentication, immutable import and object verification.

| Export path | Canonical evidence / section use | Boundary or unresolved gap |
| --- | --- | --- |
| `inspectionRecord.client`, `tankNumber`, `location`, `fieldLeaseName`, `inspector` | Identity fields: 3; selected identity context: 1, 4, and figure title blocks. | Conflicts with duplicated `task` identity values require review; task/UI metadata must not silently win. |
| `inspectionRecord.externalRoofType`, `internalRoofType`, `diameterM`, `heightM`, `shellCourseCount`, `shellLaneCount` | Configuration/geometry: 3; applicability and relevant map/measurement context. | Preserve null as unknown. Suffix `M` declares metres for those two dimensions only. Do not invent service, design pressure, build year, or inspection date. |
| `inspectionRecord.referenceMode`, `referenceNote`; `layoutConfigs[]` | Orientation and app geometry: 9, 13, 28 and their dependent maps. | A reviewed coordinate transform must preserve the app datum; the writer never chooses a new north reference. |
| `taskSnapshots[].taskKey`, `inScope`, status; `layoutTargets[].targetKey`, `surfaceKey`, scope/approval fields | Capture scope proposals and readiness inputs for the section plan. | App task complete/approved does not mean report section approved or technical acceptability established. |
| `utMeasurements[].targetKey`, `itemKey`, `itemKind`, `plateId`, `elementId`, `laneId`, `course`, `elementTypeKey`, `nozzleSize` | Typed measurement row and host identity: 8, 10, 12, 24; selected area/floor tests only with an explicit relevant method/location classification. | Do not route every `shell` row to internal and external assessments. Do not infer nozzle units from a display string. |
| `utMeasurements[].value1` … `value5`, `reinforcementPadReading`, `confirmed`, `measured` | Ordered measurement cells and recorded state. | Export has no explicit `unitCode` or per-cell validity object. Use an independently verified, versioned adapter declaration for a documented native field unit; otherwise flag unresolved units. Do not guess from report context, turn null into zero, or turn one text table into one numeric reading. |
| `inspectionChecklistItems[].sectionKey`, `itemNumber`, `itemPrompt`, `ratingKey`, `ratingLabel`, `itemNote` | Exact checklist rows: 7; explicit observations: 4 and relevant specialist blocks. | `ratingKey` is not a universal severity code. Preserve the prompt and response meaning from the versioned checklist definition. |
| `inspectionChecklistSectionNotes[].sectionKey`, `sectionTitle`, `note` | Classified condition/limitation claims: 4; linked notes: 7. | A compound note may need several uses; never copy the whole note into every matching section. |
| `findings[].findingId`, `targetKey`, `itemLabel`, `itemKind`, `elementTypeKey`, `linkedUtItemKey`, `note` | Observation with stable finding identity; resolve related measurement/location: 4, relevant detailed NDT section, map marker and 27. | Current export does not directly expose every desired predicate/severity/inspection-side field. Preserve raw note and use reviewed extraction, not invented structured values. `targetKey:"shell"` alone does not establish internal vs external. |
| `voiceNotes[].voiceNoteId`, `screenKey`, `cardKey`, `fieldKey`, `targetKey`, `itemKey`, labels, `capturedAtIso`, transcript fields | Source-linked voice claims routed by backend to appropriate block(s). | Capture timestamp is not automatically the whole inspection window. Untranscribed/uncertain notes remain pending. Screen context alone cannot distinguish findings, recommendations and measurement commentary. |
| `layoutConfigs[]`, `layoutFigures[]`, `elements[]` (`elementId`, `targetKey`, coordinates/type) | Immutable geometry/artifacts: 9, 13, 28 and dependent detailed maps. | Valid app geometry must not be replaced by a historical report drawing. Figure and normalized geometry revisions must agree. |
| `attachments[].attachmentId`, `findingId`, `kind`, `relativePath`, `displayName`, media/availability fields | Verified photo/attachment objects linked to observations: 27 and selected detailed blocks. | Caption text is not an image finding. Missing binary is not satisfied by `fileExists` metadata alone; use finalized object verification. |
| Export envelope, profile, validation results, device/user/export timestamps | Import provenance and data QA. | Not narrative requirements and never an authority to grant access, set approvers, or substitute export date for inspection date. |

The app's original canonical model already records `unitProfile` with MM/INCH
thickness choices. The ordinary V3 Product serializer does not currently export
that profile. The new planner accepts explicit native row units or an exported
`unitProfile.thicknessUnit`; otherwise it retains the row and requires a unit
resolution. It does not infer millimetres from the fact that a reading is UT.

The ordinary native exporter does **not** emit a generic `structuredTables[]`
array, synthetic `captureFacts[]`, dedicated settlement stations, NDT area IDs,
calculation outputs, signed engineering assessments, or MFL plate-map PDFs.
Some fixture/scenario paths have extra structures. They are not proof of a real
capture capability. Define versioned adapters/extensions or explicit report-side
inputs for those needs. MFL files enter the report workspace separately under
the existing product boundary. Never claim native parity by preserving those
objects only in a synthetic capture manifest.

## Section specifications

The sequence in each **Blocks** field is the reader-facing order. A required
item applies only when its triggering section/block is applicable. “Supporting”
below means the `supporting` role, while references use `cross_reference`.

### 1. `scope-of-inspection` — Scope of Inspection

- **Blocks:** heading → tank/site and confirmed inspection window → purpose and
  inspection extent → included methods/components → access/coverage limitations
  and exclusions → confirmed reference procedures where required.
- **Eligible:** identity, scope, classified scope voice claims, manual
  confirmations, controlled procedure references. **Required:** agreed scope and
  material limitations; identity/date fields selected by the report profile.
  **Supporting:** task status/counts, detailed test results and measurements.
- **Availability:** no voice uses the confirmed scope fields directly. Missing
  inspection dates, agreed extent or required procedure selection stay pending;
  export timestamps cannot fill them. An entire scope section is normally
  applicable for this profile; exclusions need explicit confirmation.
- **Dependencies:** reviewed report-family/scope selection; actual method and
  component applicability used by every following section.

### 2. `inspection-maintenance-regime` — Inspection and Maintenance Regime

- **Blocks:** heading → confirmed previous inspection/maintenance history →
  current inspection basis → reviewed future inspection/maintenance requirements
  with conditions and responsibility when supplied.
- **Eligible:** history, scope, reviewed assessment/recommendation, manual
  confirmation, controlled guidance. **Required:** known relevant history and
  any confirmed schedule/limitations selected in the plan. **Supporting:** raw
  present measurements and historical report narrative.
- **Availability:** deterministic confirmed history/schedule works without
  voice. Unknown history remains unknown. No automatic interval or next-due
  date from generic standard text; a future schedule needs approved inputs and
  a reviewed basis. Not applicable only by explicit report-plan decision.
- **Dependencies:** history source dates; approved assessment/calculation or
  customer requirement supporting each proposed interval.

### 3. `general-tank-information` — General Tank Information

- **Blocks:** heading → identity/site table → configuration/dimensions table →
  design/service/history fields selected by profile → inspection personnel/dates
  or reference details where supplied.
- **Eligible:** identity, configuration, history, scope, manual confirmation.
  **Required:** profile-selected labelled values and units with one authoritative
  value per field. **Supporting:** voice explanations, device/export metadata.
- **Availability:** deterministic regardless of voice. Missing mandatory fields
  block approval; optional unknown fields can be omitted or explicitly marked
  unrecorded according to format. Do not infer build year, service or materials.
- **Dependencies:** resolved identity conflicts and field-unit contract;
  subsequent calculations must use the same versioned dimensions.

### 4. `inspection-report` — Inspection Report

- **Blocks:** heading → short inspection extent/limitations where needed →
  applicable component subsections in the order below → conditional reviewed
  assessment/calculation summaries → concise overall limitation/implication
  statement when actually supported. No imported-record count paragraph.
- **Eligible:** component-bound observations, checklist-derived observations,
  routed voice claims, selected measurement summaries, test summaries,
  calculation results, reviewed assessments, manual confirmations, references
  to figures/photos/detailed sections. **Required:** all reviewed in-scope
  material findings and negative observations selected as narrative obligations,
  their locations, uncertainty/limitations and associated protected values when
  needed to state the finding. **Supporting:** full UT rows, checklist grids,
  scan profiles, photo binaries and worksheet inputs, unless a specified summary
  block explicitly requires a value. No blanket requirement for every number.
- **Availability:** valid structured findings/checklist observations compile
  into complete deterministic sentences when no voice is present. Unknown
  condition is not “satisfactory.” Missing applicability or critical context
  remains a planning issue. Missing engineering implication is not repaired by
  copying a historical conclusion; omit an optional conclusion or await the
  required professional input. Profile-inapplicable component headings disappear.
- **Dependencies:** approved component/inspection-side mapping; relevant test,
  measurement and geometry revisions; approved calculation/assessment records.
  References to a detailed section not included in the export must be resolved
  to an included artifact or removed through a reviewed plan change.

#### Ordered component blocks for Section 4

Each active component block contains, in order: the component heading, supported
condition/findings with locations, material limitations, concise selected
quantitative/test result if needed, and reader-useful cross-references. Do not
force every component to have all five items.

| Order / stable block key | Expected content and boundaries |
| --- | --- |
| `inspection-extent` | Internal/external extent, inspection circumstances and material access restrictions only where needed to interpret the findings. Does not repeat all Section 1. |
| `diked-area` | Containment/diked area and related observed conditions. Piping/support conditions go here only where their captured context belongs to this block; detailed UT remains in its approved test/measurement destination. |
| `foundation` | Foundation/support/drainage observations and relevant observed settlement effects. Survey numbers and plots are detailed in 25–26; include a confirmed summary only if part of the finding. |
| `shell-external` | External coating/corrosion/deformation/weld observations with component/location identity. Selected NDT findings may be summarized with exact supported values; full scans remain in 14–20. |
| `shell-appurtenances` | Nozzles, manways and shell fittings condition observations. Nozzle/pad cell tables belong to 24. Do not turn an element count into a condition assessment. |
| `access-structures` | Captured stair, platform, ladder, handrail and related access conditions and restrictions. Only applicable structures appear. |
| `roof-external` | Roof-configuration-specific external plate/coating/weld observations. Heading derives from confirmed roof configuration, not a fixed “dome” label. Roof UT details belong to 8. |
| `roof-appurtenances` | Captured roof openings, nozzles, vents and associated fittings. Tables belong to 10; element geometry remains in 9. |
| `roof-internal` | Underside/internal roof/support observations when inspected and applicable. Do not infer internal condition from external roof UT or notes. Floating-roof-specific blocks require the applicable reviewed profile extension and confirmed configuration. |
| `shell-internal` | Internal shell/weld/coating observations and selected internal examination findings. External shell evidence cannot be relabelled here solely because it shares a course/plate. Details in 21–23 remain linked. |
| `floor-internal` | Floor/annular/sump/shell-to-floor observations, measured projection/clearance where captured, corrosion and test coverage limitations. Floor form such as cone-down requires confirmed data. MFL and scans support the findings; full sheets belong to 31. |
| `assessment-summaries` | Conditional summaries described below, positioned under the relevant component when that makes the source relationship clearer. Stable calculation IDs prevent duplicate competing values. |
| `inspection-implication` | A recorded or reviewed synthesis of material findings/limitations. Repair detail remains in 5/23, with a reference when useful. No automatic fitness-for-service or compliance verdict. |

#### Conditional assessment and calculation summaries in Section 4

The 5452 source review established that the original Inspection Report contains
genuine calculation content. Therefore “calculation” is not an exclusion rule.
Activate the following blocks only where the reviewed report plan requires the
summary and the needed source/calculation is available:

| Summary type | Required in the selected summary | Supporting / detailed destination |
| --- | --- | --- |
| Component thickness condition | Component/location, the selected measured minimum/range or other explicitly defined statistic, unit and population/coverage qualification. | Full ordered UT cells in 8/10/12/24 or a reviewed applicable test table. A global minimum across different surfaces is invalid. |
| Minimum required thickness comparison | Component, reviewed calculated requirement, relevant measured comparison and exact approved interpretation/limitations. | Inputs, method/edition, equations and full results in 11; assessment decision in Appendix A when selected. |
| Corrosion rate / remaining life | Component, selected reviewed result, unit, input dates/time basis and material assumptions/limitations necessary to understand it. | Versioned calculation record and detailed approved assessment/worksheet in Appendix A or a separately defined profile block. No default historical rate, design thickness or previous reading. |
| Floor scanning / test coverage | Confirmed method/extent, access or scanner clearance restriction where measured, and selected finding/result. | Scan/test records and approved map references in 6, 28–31. No inference of “no corrosion” from absent sheets. |
| Settlement / other reviewed assessment | Confirmed assessment result and scope/qualification, only when signed off by the responsible reviewer. | Native station table and graph in 25–26; reviewed assessment in Appendix A. A plotted line is not an acceptance decision. |

Calculators are deterministic, versioned and separately reviewed. This document
does not validate existing formula code or prescribe technical acceptance
thresholds. Missing inputs prevent the calculation and its dependent claim;
the LLM must not supply them. A source-review-only historical calculation can
be evaluator reference without being available to the generation package.

### 5. `repair-recommendations` — Repair Recommendations / API 653 Assessment

- **Blocks:** heading → reviewed recommendations grouped by component/finding →
  action, location and any confirmed priority/timing → relevant assessment basis
  and limitations → references to detail/figures.
- **Eligible:** observations supporting reviewed recommendations, manual
  assessments, controlled guidance and reviewed calculation results. **Required:**
  confirmed actions and their finding/location links; supplied conditions and
  timing must be preserved. **Supporting:** raw measurements and precedent
  condition-to-action examples. A suggested action is not a confirmed requirement.
- **Availability:** deterministic reviewed actions work without voice. No action
  recorded does not mean no repair needed. Missing technical decision stays
  pending; an explicit reviewed “none required” is a distinct supported statement.
- **Dependencies:** versioned responsible reviewer decision; applicable basis;
  Section 4 findings and 23 details must agree without circular generation.

### 6. `test-information` — Test Information

- **Blocks:** heading → test/method inventory selected for reporting → method,
  procedure/instrument and inspection extent fields → concise result/limitation
  table → detailed result references.
- **Eligible:** test/survey records, scope, manual method confirmations, verified
  instrument/procedure artifacts. **Required:** profile-selected method/extent
  and traceability fields for each performed test. **Supporting:** complete scan
  traces, generic vendor literature and detailed cell tables.
- **Availability:** deterministic without voice. Missing dedicated app test
  fields require an explicit report-side record/extension. Never infer a test
  was performed from a template heading; explicit exclusions may be recorded.
- **Dependencies:** confirmed test identity, dates/methods and linked detailed
  sections. Missing required calibration/procedure references remain pending
  only where the reviewed method contract requires them.

### 7. `tank-inspection-checklist` — Tank Inspection Checklist

- **Blocks:** heading → response legend from the actual checklist version →
  sections in checklist order → exact prompt/response/note rows.
- **Eligible:** checklist responses and linked classified notes. **Required:**
  every selected in-scope prompt/response with item identity, including explicit
  not-inspected/not-applicable responses. **Supporting:** photos/voice and raw UT.
- **Availability:** fully deterministic without voice. Unanswered is unanswered,
  not a default good condition. Preserve optional notes; resolve contradictory
  response/note combinations before approval. Do not renumber away item identity.
- **Dependencies:** checklist-definition version and response meaning; native
  section/item keys; selected scope. Section 4 uses only designated observations.

### 8. `roof-plate-thickness-measurements` — Roof Plate Thickness Measurements

- **Blocks:** heading → roof/reading unit and measurement basis → ordered
  plate/point table → optional declared statistic → layout reference.
- **Eligible:** roof plate measurement cells and host geometry; manual method
  confirmation. **Required:** selected measured plate rows and ordered cells,
  units, recorded missing/not-measured state. **Supporting:** nozzle/pad rows,
  voice and conditions; nozzle rows are assigned to 10.
- **Availability:** deterministic without voice. Unknown units/host or incomplete
  required cells stay pending. No applicable roof UT requires an explicit scope
  decision, not an empty table.
- **Dependencies:** 9 host IDs/datum; verified native field-unit adapter; any
  displayed statistic pins its exact row/cell population.

### 9. `roof-plate-layout` — Roof Plate Layout

- **Blocks:** heading → verified roof layout figure → datum/legend → caption and
  selected measurement/finding markers with resolvable references.
- **Eligible:** app roof geometry/figure, elements, linked roof measurements and
  findings. **Required:** approved geometry/plate IDs, orientation and selected
  markers. **Supporting:** raw UT lists and voice.
- **Availability:** deterministic without voice; missing/ambiguous geometry or
  datum blocks the figure. No default invented roof or plate numbering. Omit
  only after explicit applicability decision.
- **Dependencies:** app geometry fingerprint, figure renderer, 8/10 row IDs;
  report-side approved overrides preserve source lineage.

### 10. `roof-nozzle-reinforcement-pad-thickness-measurements` — Roof Nozzle & Reinforcement Pad Thickness Measurements

- **Blocks:** heading → measurement unit/basis → roof nozzle/manway row table
  with actual element identity and size where captured → ordered readings and
  separate pad reading/state → roof layout reference.
- **Eligible:** roof element measurement cells, element records and manual
  method confirmation. **Required:** selected nozzle/pad rows with correctly
  bound ordered cells and units. **Supporting:** plate readings and narrative.
- **Availability:** deterministic without voice. Distinguish absent pad,
  unmeasured pad, missing reading and recorded value; null cannot decide which.
  Unsupported size/unit remains pending. Explicitly out-of-scope elements omit.
- **Dependencies:** element-to-UT key resolution and 9 geometry; pad data must
  never be substituted for a nozzle wall cell.

### 11. `minimum-shell-thickness-calculations` — Minimum Shell Thickness Calculations

- **Blocks:** heading → calculation basis/method and scope → input table with
  provenance/units → ordered component/course result table → reviewed comparison
  and limitations where selected.
- **Eligible:** reviewed calculator inputs/results, tank geometry, relevant
  measurements and manual engineering input. **Required:** all reported result
  rows with method/version and traceable input set; any selected interpretation
  must be reviewed. **Supporting:** remaining shell UT cells and prior prose.
- **Availability:** deterministic without voice. Missing material/design/service
  assumptions stop the dependent calculation. No inferred code edition or
  auto-approved conclusion. Explicitly excluded calculations remain out of scope.
- **Dependencies:** separately validated calculator and input review; 3/12
  versions; selected summaries in 4/Appendix A must reference this same result.

### 12. `shell-plate-thickness-measurements` — Shell Plate Thickness Measurements

- **Blocks:** heading → shell datum/units/measurement basis → course/lane/plate
  table in declared order → optional per-component statistic → layout reference.
- **Eligible:** shell region/plate measurement cells and resolved identities.
  **Required:** selected native cells and course/lane/plate identity and state.
  **Supporting:** element/nozzle rows, scanner text and condition narratives.
- **Availability:** deterministic without voice. Unresolved course/point/unit
  prevents a falsely complete row. Not-measured retains that status; no zero fill.
- **Dependencies:** 13 host/datum, unit adapter, row schema; 11 inputs and 4
  summaries reference exact cells rather than matching numbers globally.

### 13. `shell-plate-layout` — Shell Plate Layout

- **Blocks:** heading → app shell development/layout figure → course/plate or
  lane labels and datum → selected markers/legend → caption/references.
- **Eligible:** shell geometry/elements and linked observations/measurements.
  **Required:** geometry, identity and selected marker placement. **Supporting:**
  unselected measurements, raw scan records and voice.
- **Availability:** deterministic without voice. Missing orientation/geometry
  remains pending; a generic grid cannot stand in for the captured layout.
- **Dependencies:** app layout revision, 12/24 row identities; area/MPI figures
  below reuse the same host geometry instead of creating independent shells.

### 14. `shell-external-additional-ndt-selected-areas` — Shell External Additional NDT On Selected Areas

- **Blocks:** heading → confirmed external NDT extent/method → area/location
  register → concise result/limitation per area → detail references.
- **Eligible:** external-shell test records, area definitions, observations,
  reviewed result summaries and relevant geometry. **Required:** each selected
  area identity, location/method/coverage and material finding/limitation.
  **Supporting:** full profiles/cells in 15–19 and instrument records in 6.
- **Availability:** deterministic recorded results without voice. `shell` target
  or a numbered mention is insufficient to create an external area. Missing
  side/area classification stays pending; no performed additional NDT is not
  assumed from the presence of ordinary shell UT.
- **Dependencies:** explicit stable area identity and inspected side; shared
  shell host; method and detailed result revisions.

### 15. `shell-external-area-1-ut-scanning-findings` — Shell External Area 1: UT Scanning & Findings

- **Blocks:** heading/confirmed Area 1 location → annotated host figure →
  declared UT scan result table/profile → supported finding and limitation →
  photo/detail references.
- **Eligible:** explicitly mapped external Area 1 test/measurement, observations,
  geometry, verified scan/photo artifacts. **Required:** selected area identity,
  result cells/artifact and material finding with units and extent. **Supporting:**
  other areas, complete instrument logs and unrelated shell rows.
- **Availability:** deterministic result and finding blocks without voice. No
  Area 1 data does not authorize populating from the first available finding.
  Missing required scan/area mapping remains pending; explicit exclusion omits.
- **Dependencies:** area register in 14, host in 13, source scan/test revision.

### 16. `shell-external-area-2-ut-scanning-findings` — Shell External Area 2: UT Scanning & Findings

- **Blocks:** heading/confirmed Area 2 location → annotated host figure →
  declared UT scan result table/profile → supported finding and limitation →
  photo/detail references.
- **Eligible:** explicitly mapped external Area 2 test/measurement, observations,
  geometry and verified scan/photo artifacts. **Required:** Area 2 identity,
  selected result cells/artifact and material finding. **Supporting:** every
  other area's records and unrelated shell cells.
- **Availability:** deterministic without voice; unresolved Area 2 identity or
  result blocks its required content. No row-order inference; omit on explicit
  exclusion, not on a missing record alone.
- **Dependencies:** 14 area register, 13 host, exact Area 2 test/artifact revision.

### 17. `shell-external-area-3-ut-scanning-findings` — Shell External Area 3: UT Scanning & Findings

- **Blocks:** heading/confirmed Area 3 location → annotated host figure →
  declared UT scan result table/profile → supported finding and limitation →
  photo/detail references.
- **Eligible:** explicitly mapped external Area 3 test/measurement, observations,
  geometry and verified scan/photo artifacts. **Required:** Area 3 identity,
  selected result cells/artifact and material finding. **Supporting:** other
  area records, unrelated shell cells and instrument logs.
- **Availability:** deterministic without voice; missing identity/result remains
  pending. Do not generate Area 3 because the template contains a heading.
  Explicit exclusion omits this section.
- **Dependencies:** 14 area register, 13 host, exact Area 3 test/artifact revision.

### 18. `shell-external-area-4-ut-scanning-findings` — Shell External Area 4: UT Scanning & Findings

- **Blocks:** heading/confirmed Area 4 location → annotated host figure →
  declared UT scan result table/profile → supported finding and limitation →
  photo/detail references.
- **Eligible:** explicitly mapped external Area 4 test/measurement, observations,
  geometry and verified scan/photo artifacts. **Required:** Area 4 identity,
  selected result cells/artifact and material finding. **Supporting:** other
  area records, unrelated shell cells and instrument logs.
- **Availability:** deterministic without voice; missing identity/result remains
  pending. Explicit exclusion omits it; earlier areas cannot fill its gaps.
- **Dependencies:** 14 area register, 13 host, exact Area 4 test/artifact revision.

### 19. `shell-external-area-5-ut-scanning-findings` — Shell External Area 5: UT Scanning & Findings

- **Blocks:** heading/confirmed Area 5 location → annotated host figure →
  declared UT scan result table/profile → supported finding and limitation →
  photo/detail references.
- **Eligible:** explicitly mapped external Area 5 test/measurement, observations,
  geometry and verified scan/photo artifacts. **Required:** Area 5 identity,
  selected result cells/artifact and material finding. **Supporting:** other
  area records, unrelated shell cells and instrument logs.
- **Availability:** deterministic without voice; missing identity/result remains
  pending; explicit exclusion omits it. More than five areas require a reviewed
  profile extension, not packing several areas into Area 5.
- **Dependencies:** 14 area register, 13 host, exact Area 5 test/artifact revision.

### 20. `shell-external-mpi-selected-areas` — Shell External MPI On Selected Areas

- **Blocks:** heading → external MPI extent/location register → marked host
  figure → supported observations/results and limitations → selected references.
- **Eligible:** explicitly external MPI tests/observations and geometry/artifacts.
  **Required:** selected location, method/extent and supported result/status.
  **Supporting:** ordinary UT, internal MPI and method documentation in 6.
- **Availability:** deterministic without voice. No indication, not examined and
  no record are separate states; never infer one from another. Missing method/
  side mapping remains pending; explicit no-test scope allows omission.
- **Dependencies:** test identity/method, 13 host, finding/photo links.

### 21. `shell-internal-mpi-selected-areas` — Shell Internal MPI On Selected Areas

- **Blocks:** heading → internal MPI extent/location register → marked host
  figure → examination coverage/limitations → detailed findings reference.
- **Eligible:** explicitly internal MPI tests/locations and geometry. **Required:**
  examined locations and actual extent/status. **Supporting:** finding detail in
  22, external MPI, ordinary UT and raw instrument metadata.
- **Availability:** deterministic without voice. Unresolved inspection side or
  location blocks mapping; no record is not a clear result. Omit only on an
  explicit scope decision.
- **Dependencies:** method/test identity, 13 host, 22 location/finding mapping.

### 22. `shell-internal-mpi-findings` — Shell Internal MPI Findings

- **Blocks:** heading → findings grouped by confirmed internal test area →
  annotated figure/photo where selected → result/indication table and limitations
  → reviewed interpretation only when supplied.
- **Eligible:** internal MPI observations/results and linked artifacts; reviewed
  interpretations. **Required:** selected findings or explicit recorded no-
  indication results with location and method scope. **Supporting:** proposed
  repair detail in 23, exterior findings and full calibration records.
- **Availability:** deterministic recorded results without voice. Missing
  interpretation cannot become automatic acceptance; unknown result stays
  pending. Explicitly excluded tests omit the section.
- **Dependencies:** 21 test/area IDs, observation negation/uncertainty, linked
  artifact version; any interpretation has responsible reviewer provenance.

### 23. `shell-internal-recommended-repairs` — Shell Internal Recommended Repairs

- **Blocks:** heading → confirmed repair-location register → annotated shell
  figure → reviewed action/specification per finding → conditions/references.
- **Eligible:** reviewed internal-shell recommendations, findings, manual
  engineering instructions and host geometry. **Required:** confirmed action
  and location, supplied dimensions/limitations and finding links. **Supporting:**
  raw MPI/UT results and precedent repair examples.
- **Availability:** deterministic confirmed actions without voice. No confirmed
  action is a pending decision, not “no repairs.” Omit or state none only with
  an explicit reviewed applicability/assessment decision.
- **Dependencies:** common recommendation IDs with 5, internal finding IDs
  from 4/22, 13 host geometry and technical review version.

### 24. `shell-nozzle-reinforcement-pad-thickness-measurements` — Shell Nozzle & Reinforcement Pad Thickness Measurements

- **Blocks:** heading → method/units → shell nozzle/manway identity/size and
  location table → ordered readings and separate pad reading/state → map reference.
- **Eligible:** shell element UT cells and resolved element identities.
  **Required:** selected nozzle/pad cells with location/unit and recorded state.
  **Supporting:** shell plate readings and narrative condition text.
- **Availability:** deterministic without voice. Pad absent, unmeasured and
  missing are distinct; null does not prove absence. Missing element/unit
  mapping remains pending; out-of-scope rows omit through reviewed selection.
- **Dependencies:** 13 element map, native element-to-item keys and unit adapter;
  measurement identities must distinguish wall readings from pad readings.

### 25. `shell-settlement-survey-results-external` — Shell Settlement Survey Results (External)

- **Blocks:** heading → confirmed survey date/method and datum → ordered station
  table with position, raw level and declared derived values → limitations →
  graph/assessment references.
- **Eligible:** survey station records, manual survey input, verified geometry
  and separately reviewed derived results. **Required:** selected station IDs,
  order, datum, values/units and derivation where displayed. **Supporting:**
  general foundation notes and historical station tables.
- **Availability:** deterministic without voice. Dedicated native survey records
  are not present in the ordinary exporter; require an explicit input source.
  Missing datum/units or required stations remains pending; never interpolate
  absent readings unless a separately reviewed method explicitly permits it.
- **Dependencies:** station identity/datum revision; calculator revision for
  derived columns; selected result set also drives 26.

### 26. `shell-settlement-survey-graphs` — Shell Settlement Survey Graphs

- **Blocks:** heading → graph(s) with station/location axis and value/unit axis
  → legend/datum/caption → reviewed interpretation only if supplied.
- **Eligible:** the exact survey dataset used in 25 and deterministic chart
  specifications; reviewed assessment. **Required:** correctly plotted selected
  points, units/order and traceable series. **Supporting:** unrelated UT and
  generic threshold curves.
- **Availability:** deterministic without voice. No valid survey dataset means
  no graph, not an empty or fabricated curve. Acceptance envelopes require
  separately reviewed calculation/standard inputs. Explicit no-survey scope omits.
- **Dependencies:** 25 dataset hash and deterministic chart version; graph
  generation cannot independently infer an engineering acceptance conclusion.

### 27. `photographs` — Photographs

- **Blocks:** heading → selected photos in reviewed order → reader-facing photo
  number and caption → component/location and finding references where required.
- **Eligible:** verified photo artifacts and captured/reviewed caption fields
  linked to observations. **Required:** selected image, correct finding/host and
  approved caption meaning. **Supporting:** unselected photos, EXIF/device data
  and attachment inventories.
- **Availability:** deterministic captions from confirmed fields without voice.
  Missing image/caption linkage remains pending; placeholders cannot count as
  the original. No condition inferred from filename or automatically from pixels.
  Explicit no-photo scope/selection can omit the section.
- **Dependencies:** source object checksum, approved crop/annotation revision,
  centralized figure numbering and surviving cross-references from other sections.

### 28. `floor-plate-layout-platemaps-numbering-system` — Floor Plate Layout With Platemaps Numbering System

- **Blocks:** heading → app floor layout figure → plate/annular IDs and datum →
  numbering legend → approved scan-name aliases where relevant.
- **Eligible:** app floor geometry/figure/elements; reviewed plate alias mapping.
  **Required:** immutable host plate geometry, IDs and orientation. **Supporting:**
  scan pixels, full UT cells and floor narrative.
- **Availability:** deterministic without voice. Missing geometry/alias mapping
  remains pending. A legacy report-side source drawing is permitted only under
  the reviewed legacy path when valid app geometry is absent; no substitution
  of a finished historical corrosion map.
- **Dependencies:** app geometry fingerprint; approved alias revision used by
  30/31. Floor map is not generated from MFL page order.

### 29. `guidelines-interpretation-tru-flux-data-sheets` — Guidelines for the Interpretation of the Tru-Flux Data Sheets

- **Blocks:** heading → applicable approved method/vendor interpretation guide
  → symbols/bands/units legend → limitations and document reference.
- **Eligible:** controlled method/vendor guidance matching the supplied scan
  system and approved manual clarification. **Required:** selected interpretation
  legend and relevant limitations. **Supporting:** current findings, unrelated
  vendor guidance and hidden report prose.
- **Availability:** deterministic controlled content without voice. This section
  applies only to the actual selected method; a different system cannot silently
  reuse Tru-Flux guidance. Missing approved guidance stays pending if required.
- **Dependencies:** scan method/vendor/version identity and permission to use the
  controlled material; the guide never supplies current corrosion findings.

### 30. `floor-plate-corrosion-plan` — Floor Plate Corrosion Plan

- **Blocks:** heading → immutable floor figure with reviewed overlays →
  applicable corrosion legend/coverage → caption and scan references.
- **Eligible:** 28 geometry, report-side MFL scans and approved mappings,
  extraction outputs and placement transforms; relevant reviewed findings.
  **Required:** approved matched plate overlays, correct band/legend and coverage
  qualification. **Supporting:** raw scan grids/axes and historical completed maps.
- **Availability:** deterministic without voice. Unmatched/duplicate plate IDs,
  missing coverage, unreviewed orientation or unresolved bands block affected
  composition under the existing MFL workflow. Approved partial coverage must be
  explicit; absent overlay never means no corrosion.
- **Dependencies:** 28 geometry fingerprint, source scans, extraction version,
  plate alias and placement/scale/rotation approval; preserve source layout.

### 31. `magnetic-flux-leakage-platemaps` — Magnetic Flux Leakage Platemaps

- **Blocks:** heading → reviewed scan coverage/index → source plate-map sheets
  in declared plate order with readable identity → method/legend references and
  material missing-coverage statement if explicitly approved.
- **Eligible:** verified report-side MFL artifacts, reviewed plate identity and
  scan metadata. **Required:** selected original sheets or approved renderings
  with correct IDs and readability. **Supporting:** duplicates, unrelated scans,
  extracted pixels used only by 30 and source import logs.
- **Availability:** deterministic without voice. Missing or ambiguous plates
  remain pending; never match by page order or fabricate sheets. Explicit
  no-MFL inspection scope omits this section and its dependent blocks.
- **Dependencies:** scan object hash, 28 numbering/alias map, method identity and
  reviewed coverage; these are designated report attachments, not a text dump.

### Appendix A. `appendix-a-engineering-assessment-summary` — Engineering Assessment - Summary

- **Blocks:** heading → assessment scope/basis → selected reviewed calculation
  and assessment summary table → assumptions/limitations → confirmed conclusions
  and required actions → responsible review/reference fields.
- **Eligible:** reviewed engineering assessments, versioned calculation results,
  manual engineering inputs and evidence references. **Required:** selected
  conclusions and their actual basis/limits; precise component-bound result
  values where specified. **Supporting:** unrelated capture records, raw voice
  transcripts and whole historical worksheets.
- **Availability:** deterministic reviewed results without voice. Missing
  professional decision, required inputs or calculator validation leaves the
  affected assessment pending. No autonomous fitness-for-service statement.
  Explicitly excluded assessment scope can omit the appendix; it cannot be a
  fallback destination for unclassified facts.
- **Dependencies:** responsible reviewer/assessment revision; 11 and other
  reviewed calculation records; consistency with 2, 4 and 5 summaries/actions.

## Acceptance examples for the section contract

These are the contract acceptance examples. The planner audit now covers the
native/no-voice, multi-use, unit, mixed-note, repeated-observation, legacy
quarantine and scope-review mechanisms. Specialist calculation/MFL cases still
need their complete adapter/artifact traces; the list is not a claim that every
end-to-end example has passed:

1. A roof UT cell has `required_structured` use in 8 and `supporting` use in 4.
   A selected deterministic roof minimum has a separate `required_narrative`
   summary obligation in 4. Omitting all raw rows from 4 is correct; changing
   the minimum or binding it to the shell is a factual error.
2. A shell observation captured on a UT screen routes to the relevant Section 4
   component block only after component/side/claim classification. The screen
   name does not force it into a thickness table, nor does `shell` alone assign
   it to both internal and external blocks.
3. A compound voice note “floor coating damaged; recommend repair” yields two
   linked claims. The observed condition is required in 4. The recommendation
   proposal is pending review for 5 and cannot become an approved action merely
   because its source was a voice note.
4. Valid structured findings plus UT rows and zero voice notes yield nonempty
   deterministic finding blocks and correct designated tables. LLM invocation
   count is zero. Model fallback produces no raw-evidence appendix.
5. Sump depth is supporting context unless a reviewed finding/summary requires
   it. Its omission then is not a protected-value alteration. If printed, its
   value, unit, entity and meaning must still be correct.
6. A genuine reviewed corrosion/remaining-life result can appear in 4 and
   Appendix A through typed summary/reference uses; its result provenance is
   shared. Missing prior readings or an unvalidated calculator prevents both
   dependent claims, without removing the missing-input issue.
7. An unanswered checklist question and absent photo cannot be converted to a
   satisfactory result. An explicit not-inspected item remains visible in the
   applicable checklist and narrative limitation when required by the plan.
8. A floor MFL source with an ambiguous plate match produces a review item and
   blocks the affected overlay; it does not change the app floor geometry or
   create a good-condition finding for the unmatched plate.

## Assumptions and remaining verification

All 32 current IDs are retained for compatibility, but this profile does not
assume that every inspection has five external scan areas, MFL, settlement,
the same roof configuration, or an engineering appendix. Those blocks are
conditional. The fixed five area IDs are a known profile limit requiring an
explicit extension when a report needs more areas or different grouping.

Section 4 ordering takes the current report profile and confirmed 5452 section
boundary finding as a starting point. It is not a completed source-by-source
review of every historical report. Before publishing a benchmark, review 5452,
a different report layout, and a real native app package against these exact
blocks; preserve the resulting source spans, native row/cell identities,
applicability and output obligations as new immutable versions.

Native field-unit meanings, test/survey capture extensions, compound note
classification, internal/external shell identity, report-side assessment input
schemas and calculator validation still need explicit verification. They must
be visible implementation work, not silently filled from old report text.
The shared generation and document/DOCX path now consume section plans. This
does not supply a corrected 5452 recovery percentage or establish full benchmark
quality. New requirements-only runs remain planning diagnostics until independent
source review establishes the expected obligations.

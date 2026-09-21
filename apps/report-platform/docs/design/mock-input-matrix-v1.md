# Mock input preparation matrix v1

Status: **evaluation-only preparation specification, 18 September 2026**. This
defines what to prepare and how to assess its classification. It does not create
an app export, rebuild the existing dataset, change generation or promote a model.

The matrix covers the **25 reusable templates and all 89 outline blocks** in
[generic outline revision 3](generic-report-outline-v1.md). Each case selects
applicable section instances; it does not have to contain all 25 templates.
Existing [section formats](generic-section-formats-v1.md) remain the presentation
contract. The [mock evaluation contract](mock-evaluation-contract-v2.md) governs
source provenance and independent expected outputs.

Photo rule confirmed on 18 September 2026: **use real source-report photographs
for mock findings, never generated illustrations or fabricated photographs**.
Verify the condition shown, record report/page/photo identity and preserve the
image content. A source-derived photo is labelled as such; synthetic asset/location
aliases do not establish its original physical location. Cases using these photos
are source-assisted diagnostics, not independent field-observation benchmarks.

Read the [worked inspection example](mock-input-worked-example-v1.md) alongside
this matrix for actual voice scripts, expected destinations and three variants.

Narrative preparation rule, 18 September 2026: preserve original structured
values, but rewrite source-derived narrative as practical inspector notes. Do
not copy report sentences into voice, findings or task text. Preserve facts,
limitations and proposed actions while changing wording and capture grouping.
Follow the [inspector-note contract](mock-evaluation-contract-v2.md#required-inspector-note-preparation-rule-18-september-2026).

## Pre-export completeness standard

User clarification, 18 September 2026: review the entire proposed export against
the selected report outline **before export**. Completing the inspection
checklist is one part of this review. Every checklist item must have an answer.
This is an evaluation/mock-preparation requirement; no new app gate is
implemented by this document.

1. Select applicable section instances and required blocks from the 25-template
   library using the agreed inspection scope and asset configuration. All 25
   templates are not mandatory for every inspection. Record why a section or
   block is not applicable; do not remove it just because its input is missing.
2. For each required block, list its expected inputs and source owner: app field,
   inspector voice, map/media, report-side input, controlled template/KB or an
   applicable historical source. Review whether the app draft contains each
   app-owned input, in the form required by the section format.
3. Complete every item in the actual checklist definition: **195/195 responses
   for the current app**. Each response must agree with the prepared inspection
   observations and configuration. Explicit N/A is an answer when justified;
   blank is not. A finding or voice note does not itself select a checklist
   response. Do not use `NE` (None Evident) to mean not examined, or blanket-fill
   pass/N/A to satisfy the count. Unsupported missing-state handling is an app
   contract gap to resolve, not permission to invent a result.
4. Check required values/units, entity and location links, full in-scope map
   geometry, actual media files and factual agreement across fields, checklist,
   findings and voice. For example, a UT row without its unit is incomplete for
   a thickness table even if the app's existing export validator passes.
5. Record every gap, the affected block and who must supply it. Missing required
   app capture prevents calling the case ready for a complete export evaluation.
   Optional history may be absent. Required inputs intended for the platform
   remain visible dependencies; they do not become missing app fields.
6. After native export succeeds, compare the actual package with the reviewed
   draft and its required inputs. A local record omitted during serialization
   is an export defect. Backend preprocessing then classifies imported claims
   against the outline and reviews their potentially multiple section uses.

The preparation review records section/block, required input, source owner,
source record/file reference, completeness state, gap/reason and next action.
Keep this review separate from the immutable app payload and generator inputs;
it is not a section label supplied by the mobile app or an independently
approved answer key.

| Result to record | Meaning |
| --- | --- |
| App capture complete for selected outline | All required app-owned inputs are present and consistent, including every checklist response. |
| Native export successful | The app created its normal package; inspected serialization preserves the reviewed inputs. Report this separately from capture completeness. |
| Report inputs complete | Required platform files/templates and applicable dependencies are also available. Optional absent history does not fail this check. |

Preserve the current SYN-025 draft with 62/195 responses as an incomplete-input
diagnostic. It does not satisfy the positive, complete-export case. Prepare a
new revision with complete supported answers and an outline-based input review
before repeating the normal export/import evaluation.

## How to read the matrix

“Prepare” describes an input requirement for a mock case that selects the section.
It is not a claim that the input exists in every current export. Example values
and statements are fictional preparation examples, not engineering instructions.

| Source | Meaning |
| --- | --- |
| App fields | Existing structured capture: asset information, checklist, UT and findings. |
| App maps/media | Roof, internal-roof, shell and floor geometry, elements, photos and captured audio. |
| Inspector voice | Inspector-authored scope, methods, observations, recommendations, limitations or judgement, with native screen/item context. |
| Prior-asset KB | Optional earlier records for the same asset, with dated sources and verified applicability. |
| Controlled KB/template | Applicable procedures, standards, method guidance and approved standard sections. |
| Report-side file/input | Specialist datasets, drawings, scan files, calibration records or explicit inspector inputs supplied to the platform. |
| Derived result | A deterministic plot, overlay or separately verified calculation with source dependencies. |

Destination labels below are **backend/evaluator labels**, written as
`moduleId.slotId`. Do not add them to the immutable app export or dictate section
headings into mock voice to make classification easier. Existing native context
and the content of each claim determine its possible uses. One source can have
several independently justified destinations.

## The 25-section matrix

| # / Section | Mock input to prepare when applicable | Source/capture route | Expected outline labels | Missing-input behaviour / integration work |
| --- | --- | --- | --- | --- |
| 1. Asset and inspection information | Consistent tank/client/site IDs; dimensions with units; configuration; inspector/date; dated previous inspections only if known. Example: fictitious tank SYN-025, diameter 10 m. | App fields and general-information voice; optional prior-asset KB. | `identity.asset`, `identity.configuration`, `identity.inspection`, `identity.history` | Export all locally captured fields. Omit optional history if absent; retain missing required identity/configuration as pending. Resolve conflicting asset identities before using history. |
| 2. Scope and limitations | Agreed tasks, components/sides, extent, excluded tasks, inaccessible areas and any applicable procedure references. Example: inspect external shell and accessible floor; no MFL examination commissioned. | App task/target context plus inspector voice; controlled references when used. | `scope.tasks`, `scope.limits`, `scope.basis` | An unmentioned task is not performed work. Missing required scope needs clarification; distinguish exclusion from access limitation. |
| 3. Inspection and maintenance regime | Applicable approved standard section, version/hash, asset applicability and values for its declared placeholders. | Controlled template plus confirmed app/report fields. | `regime.basis`, `regime.activities`, `regime.limits` | **No AI drafting or rewriting.** Missing template selection stays pending. No invented intervals or extra subheadings; preserve the selected standard layout. |
| 4. Inspection findings | Positive and negative observations with component, location, side and phase; actual coverage and limitations; reviewed survey/assessment summaries only when supplied. Example: local pitting on floor plate F12. | Findings, checklist, photos, UT links and inspector voice; supplied verified summaries. | `findings.extent`, `findings.condition`, `findings.overview`, `findings.assessment`, `findings.limits` | Preserve uncertainty and negation. Missing observations do not mean satisfactory condition. Ambiguous location stays unresolved; omit optional summaries when absent. |
| 5. Recommendations | Inspector's explicit action, affected entity, stated timing/priority and condition; finding reference; responsibility/status only when recorded. Example: inspector recommends repairing the affected F12 area before return to service. | Inspector voice or explicit report-side recommendation; source finding links. | `recommendations.actions`, `recommendations.basis`, `recommendations.priority`, `recommendations.ownership` | An observation alone does not establish an action. Accept explicit voice intent as captured inspector input, subject to normal report review; retain “consider/may” qualifiers. Do not invent owner or deadline. |
| 6. Test information and methodology | Methods actually performed, procedure ID/revision if used, instrument ID, examiner, coverage and method limitations. Include a method merely discussed as a negative classification case. | Inspector voice; app context; controlled procedure and genuine equipment records if required. | `methods.method`, `methods.equipment`, `methods.coverage`, `methods.limits` | Separate performed, planned and excluded tests. Missing equipment/procedure facts stay pending where required; historical equipment details cannot fill current metadata. |
| 7. Inspection checklist | Real checklist definition and legend; one explicit supported response for every item (currently 195), item IDs, notes and applicability. Record unexamined areas and reasons without misusing rating codes; unanswered items form a pre-export negative case. | App checklist plus item-linked voice. | `checklist.legend`, `checklist.responses`, `checklist.notes` | Normal export blocks an incomplete checklist; serialization emits answered rows. Retain definitions to detect omissions, but do not claim an incomplete checklist passed native export. Never fill pass/N/A merely to bypass the gate. |
| 8. Thickness measurements | Native rows and component IDs, point labels/order, units, numeric readings, unmeasured statuses and location links. Example: five floor points 6.2, 6.1, 6.0, 6.2, 6.1 mm. | App UT and maps; explicit unit/limitation voice where actually captured. | `thickness.basis`, `thickness.readings`, `thickness.location`, `thickness.limits` | Fix export preservation of units/point semantics and uppercase item-kind routing. Unknown units remain unresolved. Preserve raw status/precision; no table reconstruction from a prose summary. |
| 9. Component layout and locations | All applicable roof/internal-roof/shell/floor geometry, orientation, component/plate IDs, element positions and aliases to other source records. | App maps/elements; approved external drawing only when used. | `layout.figure`, `layout.legend`, `layout.correspondence` | Geometry capture already exists across targets; faithful figure export needs completion beyond floor. Missing geometry is not replaced by an AI drawing. Unmatched source aliases remain unresolved. |
| 10. Calculations | Named method/applicability, complete unit-bearing inputs, verified outputs and review/assumptions. Earlier readings/design values only with dated applicability. | App values; optional prior-asset KB; explicit calculation inputs and separately verified calculation result. | `calculations.basis`, `calculations.inputs`, `calculations.results`, `calculations.review` | Missing prior readings affect only calculations requiring them. Incomplete method/inputs/result stay pending; numeric examples in old reports are not a calculator. |
| 11. NDT examination results | Method-specific actual test records, areas, coverage, procedure, findings/results and limitations; disposition when supplied. Repeat by area and phase without a fixed area count. | Inspector voice and app locations/photos; genuine report-side test records or clearly labelled synthetic equivalents for a synthetic case. | `ndt.location`, `ndt.method`, `ndt.results`, `ndt.disposition`, `ndt.limits` | Voice can supply results, but cannot replace a required instrument trace. Missing current test results remain pending; a procedure description is not evidence a test occurred. |
| 12. Survey results | Survey type, datum, method, station IDs/coordinates, readings with units, limitations and reviewed interpretation if provided. | App location context; inspector-recorded readings or specialist survey dataset. | `survey.basis`, `survey.stations`, `survey.readings`, `survey.assessment`, `survey.limits` | A native station-reading table/import is needed. Spoken readings require source-bound transcription and verification. Missing stations/units/datum stay explicit; no interpolation unless separately authorised and identified. |
| 13. Survey graphs | Complete source series or verified plot, station order, axes, units, legend and optional reviewed interpretation. | Survey dataset plus deterministic plotting, or verified supplied graph. | `graphs.plots`, `graphs.legend`, `graphs.interpretation` | Missing source data prevents a new plot. Do not convert “survey satisfactory” into a graph or count an empty figure heading as coverage. |
| 14. Photographs | Actual image files, finding/component links, capture phase, annotations and factual caption context. Include a missing-file case. | App photos/annotations and inspector notes/voice. | `photos.images`, `photos.captions` | Preserve binaries and annotation geometry. Missing file remains missing even if metadata exists. Select relevant images; captions describe supported content. |
| 15. Method interpretation guidance | Selected method/equipment, applicable controlled guidance, symbols/units and stated limitations. | Controlled KB or supplied manufacturer/procedure document. | `method-guidance.guidance`, `method-guidance.legend`, `method-guidance.limits` | Use only applicable, identified guidance. Missing guidance stays pending if selected and required; avoid importing vendor text solely because another report used it. |
| 16. Floor corrosion plan | Floor geometry, located observations/readings or actual scan results, verified overlay, plate correspondence, legend and coverage limits. | App floor map/findings/UT plus reviewed overlay; specialist scan input where applicable. | `corrosion-plan.layout`, `corrosion-plan.overlay`, `corrosion-plan.legend`, `corrosion-plan.limits` | An observed-location marker must not imply scanned area or quantified metal loss. Require real positional/scan support for the claimed overlay; preserve base geometry. |
| 17. MFL plate maps | Actual plate-map images/results, map index, plate IDs, orientation, coverage and limitations. | Report-side MFL files plus correspondence to app floor plates. | `platemaps.index`, `platemaps.maps`, `platemaps.limits` | Missing scans or plate matches stay pending. Existing maps from another inspection are dated history, not current scan results. |
| 18. Engineering assessment | Inspector/engineer-authored basis, conclusion, assumptions and limits, linked current results and any required verified calculation. | Inspector voice/report-side assessment; current evidence; applicable standards/history; verified calculations. | `assessment.basis`, `assessment.results`, `assessment.conclusion`, `assessment.limits` | Preserve professional judgement and its stated scope. Missing supporting calculations/basis remain visible; no inferred fitness-for-service or remaining-life conclusion. |
| 19. B-scan and local scan profiles | Actual trace files, location/area IDs, scan metadata, axes/units, current results and limitations. | Specialist files plus app map links and inspector interpretation. | `scan-profiles.location`, `scan-profiles.profiles`, `scan-profiles.findings`, `scan-profiles.limits` | Voice about a scan is not the scan artifact. Missing trace or uncertain location is pending; no invented waveform. |
| 20. 3D and dimensional assessment results | Current stations/coverage, verified geometry views/heat maps, native dimensional results, units, limitations and reviewed interpretation. | Specialist scan/survey files; app context and inspector voice. | `dimensional.stations`, `dimensional.views`, `dimensional.results`, `dimensional.interpretation`, `dimensional.limits` | App layout is supporting context, not a measured 3D dataset. Missing required views, readings or interpretation stay pending when selected and applicable. |
| 21. Post-repair inspection | Repair IDs/work/dates/locations, verification examinations and results, after-repair observations, outstanding items and limitations. | App findings/photos/UT and voice; current repair records; optional prior-asset KB for earlier condition. | `repair-verification.work`, `repair-verification.verification`, `repair-verification.condition`, `repair-verification.limits` | A recommendation does not prove repair completion. Keep before/after/follow-up separate; missing verification does not become a passed repair. |
| 22. Repair consultation and review | Requested consultation, proposed work, supporting drawing/evidence, professional comments and any separate explicit action. | Inspector/engineer voice or report-side input; applicable current and historical sources. | `consultation.request`, `consultation.proposal`, `consultation.review` | Preserve proposed versus agreed/completed work. Missing proposal or required drawing stays pending; link recommendations through their own justified uses. |
| 23. Tank calibration table | Actual calibration record: tank/configuration, datum, units, level-volume rows, date/basis and applicability limitations. | Supplied calibration file or applicable prior-asset KB record. | `calibration.basis`, `calibration.table`, `calibration.limits` | Confirm historical table applicability. Tank dimensions or voice alone do not establish the native calibration table. |
| 24. References | Source IDs, titles, revisions/editions, dates and relevant pages for documents actually used. | Controlled KB, permitted historical sources and report-side attachments. | `references.references` | Include only used sources. Missing identifiers remain unresolved; no automatic bibliography of the whole KB. |
| 25. Summary and conclusions | Confirmed scope, principal reviewed findings/results and inspector-authored actions, with links to canonical detail. | Already supported section evidence and inspector conclusions; source-linked composition. | `summary.scope`, `summary.results`, `summary.actions` | Select this module explicitly. Missing reviewed result stays pending when required; no new technical conclusion or repeated full measurement tables. |

## Voice preparation and classification

Prepare natural notes at the screen/item where an inspector would record them.
Preserve `voiceNoteId`, `screenKey`, `cardKey`, `fieldKey`, `targetKey`, `itemKey`,
labels, capture time, transcript status, original text and actual media metadata.
Leave genuinely absent context null. Never fabricate a recording duration, file
checksum or successful transcription for a script that has no audio file.

Voice is an input channel. Its proposed claim categories are:

| Claim category | Meaning to preserve |
| --- | --- |
| identity / configuration / inspection metadata | Asset facts, dimension units, inspector and current inspection date. |
| confirmed scope / coverage | Agreed and actually performed work, component/side and extent. |
| limitation | Inaccessible, excluded, not examined or method-limited work, with the correct distinction. |
| observation / checklist observation | Condition, location, polarity, uncertainty and phase. |
| recommendation / repair proposal | Inspector's action or proposal, modality, timing and responsibility only if stated. |
| method / equipment / test result | Performed method, equipment metadata or actual result; separate from planned tests. |
| repair record / verification | Work actually completed and examinations actually performed, each dated. |
| assessment / consultation | Attributed professional judgement, basis and limits; normal report review applies. |
| historical statement | Explicit prior event and date; not silently relabelled current. |

These categories are preparation vocabulary, not newly implemented API enums.
Map them to the catalogue's accepted source kinds after transcription and claim
extraction. A compound note is split into source-linked claims, retaining exact
text spans. Each use has its own role: required narrative, required structured
content, supporting evidence or cross-reference. Do not turn all input detail
into required repeated prose.

Use several realistic phrasings, short notes and complete sentences, including
negative observations and qualified proposals. Rich notes should add information
inspectors can know at capture time. Do not paraphrase the finished target report
into voice or make every note recite a section outline.

## Optional history and missing inputs

The base case can have **no historical KB at all**. Distinguish these conditions:

| Preparation state | Expected behaviour |
| --- | --- |
| Not provided / no applicable source found | Omit optional history; current supported sections can proceed. |
| Intentionally withheld for a variant | Record omission in evaluator metadata only; generation does not see withheld facts. |
| Inaccessible source | Record access limitation; do not report that no history exists. |
| Uncertain asset/component match | Keep historical claims unresolved until correspondence is established. |
| Conflicting dates/revisions/values | Retain conflict and provenance; do not silently select a convenient value. |
| Not applicable to selected scope | Omit the section/block; exclude it from required-content recall. |
| Required dependency unavailable | Keep the affected comparison/calculation/block pending; do not block unrelated current evidence. |

Earlier same-asset reports can contribute dated inspection/repair history and
confirmed applicable design information. Verify asset, component, observation
date, revision, source/page and the case's evidence cutoff. A prior action does
not prove completed work. Earlier condition is not current condition.

This is the operational-history evaluation track. It is distinct from the
same-case final report or hidden answer, which remains evaluator-only. The
existing mock contract's historical-answer exclusion must not be interpreted
as excluding all eligible prior-asset history. Precedent/style sources and
standards are separately labelled and cannot silently supply current facts.

## Expected-label record and evaluation

Prepare expected labels from the supplied input evidence before running the
classifier. Store them separately from generator-visible inputs. Their status
remains **review pending** until a separate review is recorded. Do not derive the
answer key by copying the classifier's proposed assignments.

For each proposed expected use, record:

- Expected-use ID; source/claim ID and revision; exact source span or native record path.
- Module/slot and section-instance dimensions: asset, component, side, method,
  location/area and phase as applicable.
- Role and intended representation under the existing section format.
- Applicability, availability, uncertainty, omission reason and allowed alternative placements.
- Review status and reviewer decision; critical values, units, polarity and qualifiers.

A required captured claim lost by routing remains in the expected denominator.
A fact deliberately absent from the input is a capture gap, not a generator
recall obligation. Required missing-input detection is evaluated separately.
Count unique claims for report-level recovery and required uses for placement;
show both counts. Supporting/cross-reference uses do not demand repetition.

Report capture completeness, extraction, routing, required-output recovery,
critical-fact preservation and format separately. Missing checks are unavailable,
not 100%. All variants of one underlying case stay together and are aggregated
as one case. These preparation documents establish no measured quality score.

## Preparation order and deliverable boundary

1. Start with the worked current-inspection case: real app structure and richer
   voice, no history. Complete the outline-based pre-export review above and all
   checklist responses. Prepare the matching optional-history and sparse-voice variants.
2. Materialize that specification through the app's normal capture/export path;
   use actual synthetic media when testing upload/transcription. Until then the
   worked example is a design fixture, not an importable package or ASR test.
3. Compare locally captured and serialized records. Track omitted fields, units,
   labels, enum differences and map/media preservation as export defects.
4. Independently review expected claim/slot assignments; then assess preprocessing
   and generation with pinned source, catalogue, routing and rendering versions.
5. Expand coverage with separately scoped NDT/MFL/B-scan, survey/3D/calculation,
   repair/consultation and calibration cases. Use genuine source files or clearly
   labelled synthetic files, and preserve their provenance.

No raw-evidence appendix is required. The 25-template catalogue remains an offline
evaluation candidate; the existing 32-section experiment is a legacy evaluation
compatibility preset. The rebuilt runtime will use a reviewed ReportPlan, not either
catalogue directly. Export fixes, historical-fact retrieval and broader voice
classification are tracked work, not capabilities implemented by this matrix.

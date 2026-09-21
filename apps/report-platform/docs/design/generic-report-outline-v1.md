# Generic report outline candidate — all-KB consolidation

Status: **evaluation candidate; not promoted to the production profile**. The selected 12-module evaluation now uses the shared formatter.

Guideline revision 4, 18 September 2026: [report-facing titles, outlines and formats](generic-report-presentation-v2.md) separate the 89 evidence-routing blocks from visible report headings. [Revised machine-readable catalogue](../reviews/data/generic-report-outline-v2.json).

Guideline revision 3, 18 September 2026: all 25 outlines now have [section-specific format specifications](generic-section-formats-v1.md). Inspection and Maintenance Regime retains its approved standard template with **no AI generation or rewriting**.

This replaces the assumption that one fixed 32-section outline is a generic report structure. The existing 32-section runtime experiment remains a compatibility preset. This candidate consolidates the **extracted structures of all 166 current KB entries, representing 162 distinct source files**, into **25 reusable section templates and nine report profiles**. Different files/revisions can concern the same report or asset; 162 is not a claim of 162 independent reports.

The review covers 6,633 extracted sections and 14,393 chunks. It inventories every document, examines TOCs/headings/table shapes, and uses selected body text to check ambiguous labels. It is **not an every-page visual PDF review**, nor proof that the parsed headings or layouts are correct. Four rejected, flattened RTFs remain extraction-limited; one DOCX has no page provenance. These limits are visible in the source inventory.

- [Corpus findings and all-document inventory](../reviews/2026-09-17-kb-outline-consolidation.md)
- [Machine-readable catalogue](../reviews/data/generic-report-outline-v1.json)
- [Source review with document/chunk/page citations](../reviews/data/kb-outline-source-review-2026-09-17.json)
- [Deduplicated support and exposure audit](../reviews/data/kb-outline-audit-2026-09-17.json)
- [Offline catalogue definition](../../server/experiments/generic-outline-catalog.mjs)
- [Mock input preparation matrix: all 25 templates and 89 blocks](mock-input-matrix-v1.md)
- [Worked synthetic inspection inputs and proposed section labels](mock-input-worked-example-v1.md)

## What makes this generic

A **section template** defines ordered content blocks, acceptable evidence types, presentation and missing-input behavior. A **report profile** selects and orders applicable templates. A **section instance** binds a template to the current asset, component, side, method, area and inspection phase. Displayed section numbers and page numbers are assigned when the document is assembled.

The library has 25 template types; this does not mean that every report has 25 sections. A short consultation can use identity, consultation and recommendations. A comprehensive inspection can instantiate separate roof, shell, nozzle, pad, sump and end-cap measurement sections, with any number of examination areas. Profile orders below are candidate defaults, not replicas of every source TOC or standard-mandated lists. Customer grouping and appendix placement remain presentation choices.

The template library preserves component distinctions without baking one asset's layout into the schema. In particular:

- Thickness tables preserve each component's native row IDs, point labels, column grouping and units. Three, four, five or eight readings are not interchangeable fixed schemas.
- Roof, pontoon, deck manhole, roof-leg sleeve (inner/outer), shell, nozzle, reinforcement pad, floor, annular plate, sump, end cap and floor-edge projection are possible measured components/subcomponents, only when present and in scope.
- NDT repeats by method, component, side, native area ID and phase. There is no Area 1–5 ceiling. MPI, penetrant, vacuum-box, UT/PAUT and MFL do not share an invented universal results table.
- Roundness, plumbness, shell/floor/edge settlement, roof cross-sections and deformation have distinct survey instances, station groups and verified interpretations.
- Before-repair, after-repair and follow-up observations remain separate even at the same location.
- Technical calculations and acceptance criteria need independently approved methods and review. Their presence in a historical report does not authorize a formula, threshold, service interval or fitness-for-service conclusion.
- Branded scan guidance is a method/equipment variant. “Appendix A” has no universal meaning.
- No raw-evidence appendix, unassigned-note dump or automatic repetition of all imported records is generated. Selected photographs, drawings, scan maps and measurement tables remain legitimate report sections.

## Report profiles

All listed modules are available choices. Selection depends on the current agreed scope and asset configuration. Required selected content stays pending when its inputs are missing; absence must never be replaced by historical boilerplate. A profile suggestion derived from this review is not an approved classification of the underlying KB record.

| Profile | Distinct source files | Candidate section order |
| --- | ---: | --- |
| Vertical tank inspection | 80 | Scope and limitations → Inspection and maintenance regime → Asset and inspection information → Inspection findings → Recommendations → Test information and methodology → Inspection checklist → Thickness measurements → Component layout and locations → Calculations → NDT examination results → B-scan and local scan profiles → Survey results → Survey graphs → Photographs → Method interpretation guidance → Floor corrosion plan → MFL plate maps → Engineering assessment → Post-repair inspection → References |
| Horizontal tank inspection | 16 | Scope and limitations → References → Inspection and maintenance regime → Asset and inspection information → Inspection findings → Recommendations → Test information and methodology → Inspection checklist → Calculations → Thickness measurements → Component layout and locations → NDT examination results → Photographs → Engineering assessment |
| Tank dimensional survey | 30 | Scope and limitations → Inspection and maintenance regime → Asset and inspection information → Test information and methodology → Inspection findings → Recommendations → Component layout and locations → Survey results → Survey graphs → 3D and dimensional assessment results → Calculations → Photographs → Engineering assessment → References |
| 3D profile or floor assessment | 9 (4 extraction-limited entries) | Summary and conclusions → Scope and limitations → Test information and methodology → Asset and inspection information → 3D and dimensional assessment results → Survey results → Survey graphs → Calculations → Engineering assessment → Recommendations → Component layout and locations → References → Photographs |
| Floor MFL assessment | 2 | Scope and limitations → Inspection and maintenance regime → Asset and inspection information → Test information and methodology → Inspection findings → Inspection checklist → Thickness measurements → B-scan and local scan profiles → Component layout and locations → Method interpretation guidance → Floor corrosion plan → MFL plate maps → Calculations → Engineering assessment → Recommendations → Photographs → References |
| Post-repair inspection and verification | 11 | Scope and limitations → Inspection and maintenance regime → Asset and inspection information → Post-repair inspection → NDT examination results → Thickness measurements → Photographs → Component layout and locations → Recommendations → Engineering assessment → References |
| Standalone NDT examination | 12 (3 test fixtures) | Asset and inspection information → Scope and limitations → Test information and methodology → NDT examination results → B-scan and local scan profiles → Photographs → Component layout and locations → Method interpretation guidance → Engineering assessment → References |
| Repair consultation | 1 | Asset and inspection information → Repair consultation and review → Recommendations → References |
| Tank calibration | 1 | Asset and inspection information → Scope and limitations → Test information and methodology → Tank calibration table → References |

Combined inspection/repair work may select the repair-verification module inside the inspection profile. Standalone pipeline/weld, pressure-vessel and test-plate examinations remain explicit asset scopes in the NDT profile; their headings do not establish normal tank inspection requirements. The MFL floor profile is for actual tank-floor work; test fixtures do not select it by default.

## Evidence labelling after app import

The candidate workflow is:

```text
Current agreed scope + asset configuration
  → choose report profile and instantiate applicable sections
Immutable app export + explicit report-side inputs
  → normalize source IDs, units, component/location, method and phase
  → classify each record/atomic claim against the selected outline slots
  → review ambiguous, missing and conflicting uses
  → freeze section plan and independently reviewed output obligations
  → compile protected tables/figures + draft supported narrative
  → render using the section template
  → evaluate routing, required-content recovery, fact integrity and export layout
```

The **Inspection and Maintenance Regime** section bypasses the AI wording step.
It inserts the applicable approved standard section, preserves its layout and
fills only declared placeholders from confirmed report-specific fields. This is
the section's normal generation mode, not an AI fallback.

One record keeps one source identity and may have several destination uses:

| Current source record | Destination use | Role and condition |
| --- | --- | --- |
| Shell thickness reading | Thickness → measurements | Required structured value in its canonical row, with exact identity and unit. |
| Same reading | Calculations → inputs | Supporting or required input only when a reviewed calculation explicitly selects it. It does not create a calculation by itself. |
| Same verified result | Findings → assessment summary | Cross-reference to reviewed results; do not repeat the entire measurement grid. |
| Captured floor observation | Findings → observed condition | Required narrative if in scope and reviewer-confirmed as required output. |
| Same observation | Recommendations → basis | Supporting evidence for a separately confirmed action. The observation alone cannot establish that action. |
| Asset identity | Identity → asset; scope → context | Required structured identity plus a separate supporting use where needed. |

Each use records `useId`, `evidenceId`, `sectionInstanceId`, `moduleId`, `slotId`, `role`, `projection`, `ruleId`, `reviewStatus` and `sourceRevision`. Matching uses native context plus the slot's accepted evidence types, not a report title alone. A compound voice note can yield distinct source-linked claims with different destinations. Never copy the target section label back into immutable app data.

Required structured/narrative uses determine what must appear in output. Supporting and cross-reference uses do not require every source sentence or value to be repeated. These distinctions prevent the earlier recovery denominator from penalizing appropriate non-repetition. Missing, not provided, inaccessible, not examined and not applicable must remain different states.

## The 25 section templates

Blocks below are in presentation order. Evidence categories define the proposed input contract, not a claim that the current app export or native adapter already supplies every category. A block is required only after its section and block applicability are established. Optional blocks may be omitted when no input is provided; required applicable inputs remain pending.

Support counts below deduplicate exact source hashes and exclude rejected/extraction-limited entries. They are detected historical structural support, not frequencies proving mandatory content. Source citations and source-specific aliases are in the linked JSON. Revisions and asset families may still be correlated.

### 1. Asset and inspection information (`identity`)

**Format:** [Grouped label–value sheet](generic-section-formats-v1.md#1-asset-and-inspection-information).

Identify the current asset, configuration, inspection and available history.

Repeat by: one instance per report. Detected usable support: 146 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Asset identity | labelled fields | identity | when selected and applicable |
| Configuration and dimensions | labelled fields with units | configuration, measurement | when selected and applicable |
| Inspection details | labelled fields | inspection_metadata | when selected and applicable |
| Available inspection and maintenance history | dated entries | confirmed_history | when provided |

### 2. Scope and limitations (`scope`)

**Format:** [Numbered scope with short limitation paragraphs](generic-section-formats-v1.md#2-scope-and-limitations).

State agreed tasks, examined components, exclusions and access limitations.

Repeat by: one instance per report. Detected usable support: 138 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Inspection tasks and extent | ordered list | confirmed_scope | when selected and applicable |
| Access, coverage and limitations | concise prose | scope_limitation | when selected and applicable |
| Applicable references | reference list | approved_reference | when provided |

### 3. Inspection and maintenance regime (`regime`)

**Format:** [Approved standard section, preserved layout](generic-section-formats-v1.md#3-inspection-and-maintenance-regime).

Insert the applicable approved standard section without AI generation or rewriting.

**Generation rule: standard template; AI disabled.** Reuse approved wording and
its layout. Only explicitly declared report-specific placeholders are populated
from confirmed inputs. Any other change is an explicit manual edit or selection
of a reviewed template variant. No AI call is used to draft, paraphrase, polish
or adapt this section. If an applicable template has not been selected, keep it
pending rather than generating replacement text. Record the template ID,
revision and content hash, field sources and manual edits.

Repeat by: one instance per report. Detected usable support: 139 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Regime basis | approved template layout | approved_regime_template | when selected and applicable |
| Activities, intervals and responsibilities | approved template layout | approved_regime_template, confirmed_regime_fields | when selected and applicable |
| Applicability and limitations | approved template layout | approved_regime_template, confirmed_regime_fields | when selected and applicable |

### 4. Inspection findings (`findings`)

**Format:** [Component headings with concise findings](generic-section-formats-v1.md#4-inspection-findings).

Report captured condition by applicable component, location and inspection phase.

Repeat by: component, side, phase. Detected usable support: 147 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Inspection extent | concise prose | confirmed_scope, test_coverage | when selected and applicable |
| Observed condition | component subheadings and prose | observation, voice_claim, checklist_observation | when selected and applicable |
| Survey overview | verified summary table | verified_survey_summary | when provided |
| Reviewed assessment summary | concise prose with cross references | reviewed_assessment | when provided |
| Inspection limitations | concise prose | scope_limitation | when selected and applicable |

### 5. Recommendations (`recommendations`)

**Format:** [Numbered actions grouped by component or confirmed priority](generic-section-formats-v1.md#5-recommendations).

Record confirmed actions and their basis without turning a finding into an unapproved action.

Repeat by: component, phase. Detected usable support: 115 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Recommended actions | numbered actions or table | confirmed_recommendation | when selected and applicable |
| Finding and assessment references | cross references | evidence_link | when selected and applicable |
| Priority or timing | labelled fields | confirmed_recommendation | when provided |
| Responsibility and verification status | labelled fields | confirmed_recommendation, confirmed_repair_record | when provided |

### 6. Test information and methodology (`methods`)

**Format:** [Method metadata with coverage description](generic-section-formats-v1.md#6-test-information-and-methodology).

Describe methods actually used, instruments, coverage and limitations.

Repeat by: method, phase. Detected usable support: 103 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Method and procedure | labelled fields and prose | test_metadata, approved_procedure | when selected and applicable |
| Equipment and personnel | table | instrument_metadata, examiner_metadata | when selected and applicable |
| Examination extent | table or prose | test_coverage | when selected and applicable |
| Method limitations | concise prose | test_limitation, approved_guidance | when selected and applicable |

### 7. Inspection checklist (`checklist`)

**Format:** [Category-grouped response grid](generic-section-formats-v1.md#7-inspection-checklist).

Preserve the applicable checklist, response meanings and captured selections.

Repeat by: component, side, phase. Detected usable support: 92 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Response legend | legend | checklist_definition | when selected and applicable |
| Inspection responses | native checklist grid | checklist_response | when selected and applicable |
| Item notes | row linked notes | checklist_observation | when provided |

### 8. Thickness measurements (`thickness`)

**Format:** [Component-specific measurement grid](generic-section-formats-v1.md#8-thickness-measurements).

Render native rows, point labels and units for each measured component or subcomponent.

Repeat by: component, subcomponent, side, phase. Detected usable support: 57 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Measurement basis and units | labelled fields | measurement_metadata | when selected and applicable |
| Measurements | native measurement grid | measurement | when selected and applicable |
| Point and layout correspondence | cross references | geometry_link | when selected and applicable |
| Unmeasured points and limitations | row status and notes | measurement_status, test_limitation | when selected and applicable |

### 9. Component layout and locations (`layout`)

**Format:** [Drawing page with legend and correspondence](generic-section-formats-v1.md#9-component-layout-and-locations).

Present source geometry and preserve correspondence with measurements, findings and test areas.

Repeat by: component, purpose, phase. Detected usable support: 120 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Layout | figure | geometry, approved_drawing | when selected and applicable |
| Legend and orientation | legend | geometry_metadata | when selected and applicable |
| Source item correspondence | mapping table | entity_alias | when needed |

### 10. Calculations (`calculations`)

**Format:** [Method statement, inputs, verified results and review](generic-section-formats-v1.md#10-calculations).

Present separately verified calculations; headings in historical reports do not authorize a formula or criterion.

Repeat by: calculationType, component, subcomponent, phase. Detected usable support: 101 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Method and applicability | labelled fields | approved_calculation_method | when selected and applicable |
| Inputs and units | protected input table | measurement, confirmed_calculation_input | when selected and applicable |
| Calculated results | deterministic result table | verified_calculation_result | when selected and applicable |
| Interpretation and review | concise prose | reviewed_assessment | when selected and applicable |

### 11. NDT examination results (`ndt`)

**Format:** [Method-specific examination form](generic-section-formats-v1.md#11-ndt-examination-results).

Report an examination by method, asset/component, area and phase; repeat for any number of areas.

Repeat by: assetKind, component, side, method, areaId, phase. Detected usable support: 19 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Test location and extent | labelled fields and figure | test_coverage, geometry | when selected and applicable |
| Procedure and examination details | labelled fields | test_metadata, approved_procedure | when selected and applicable |
| Indications and results | method specific table | test_result | when selected and applicable |
| Reviewed disposition | concise prose | reviewed_assessment | when provided |
| Limitations | concise prose | test_limitation | when selected and applicable |

### 12. Survey results (`survey`)

**Format:** [Datum, stations and survey-specific reading tables](generic-section-formats-v1.md#12-survey-results).

Support settlement, edge/floor settlement, roundness, plumbness and other commissioned geometry surveys.

Repeat by: surveyType, component, stationGroup, phase. Detected usable support: 62 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Survey datum and method | labelled fields | survey_metadata | when selected and applicable |
| Station and coordinate locations | station table and figure | survey_station, geometry | when selected and applicable |
| Survey readings | native survey grid | survey_reading | when selected and applicable |
| Reviewed interpretation | concise prose with cross references | reviewed_assessment | when provided |
| Survey limitations | concise prose | test_limitation, scope_limitation | when selected and applicable |

### 13. Survey graphs (`graphs`)

**Format:** [Survey plots with legends and concise interpretation](generic-section-formats-v1.md#13-survey-graphs).

Render verified plots from the current survey with units, axes and station correspondence.

Repeat by: surveyType, component, stationGroup, phase. Detected usable support: 58 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Graphs | deterministic chart or verified artifact | survey_reading, verified_graph | when selected and applicable |
| Axes, units and legend | legend | survey_metadata | when selected and applicable |
| Reviewed interpretation | concise prose | reviewed_assessment | when provided |

### 14. Photographs (`photos`)

**Format:** [Captioned photograph sheet](generic-section-formats-v1.md#14-photographs).

Present selected photographs with factual captions and component/location links.

Repeat by: component, phase. Detected usable support: 71 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Selected photographs | captioned figure grid | photo | when selected and applicable |
| Captions and finding links | captions | photo_metadata, evidence_link | when selected and applicable |

### 15. Method interpretation guidance (`method-guidance`)

**Format:** [Controlled method text and symbol legend](generic-section-formats-v1.md#15-method-interpretation-guidance).

Include approved interpretation guidance only for the selected method or equipment.

Repeat by: method, equipmentVariant. Detected usable support: 69 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Interpretation guidance | controlled prose | approved_guidance | when selected and applicable |
| Symbols and units | legend | approved_guidance | when selected and applicable |
| Applicability and limitations | concise prose | approved_guidance | when selected and applicable |

### 16. Floor corrosion plan (`corrosion-plan`)

**Format:** [Floor drawing with verified corrosion overlay](generic-section-formats-v1.md#16-floor-corrosion-plan).

Overlay verified findings on an immutable floor layout with explicit correspondence.

Repeat by: component, phase. Detected usable support: 47 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Floor layout | figure | geometry | when selected and applicable |
| Verified corrosion overlay | verified overlay | verified_corrosion_map | when selected and applicable |
| Legend and plate correspondence | legend and mapping | entity_alias, scan_metadata | when selected and applicable |
| Coverage limitations | concise prose | test_limitation | when selected and applicable |

### 17. MFL plate maps (`platemaps`)

**Format:** [Index followed by individual plate-map sheets](generic-section-formats-v1.md#17-mfl-plate-maps).

Present verified maps and their source-to-app plate correspondence.

Repeat by: component, phase. Detected usable support: 65 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Plate map index | table | plate_map_index | when selected and applicable |
| Plate maps | verified figure sequence | verified_plate_map | when selected and applicable |
| Coverage and interpretation limitations | concise prose | test_limitation | when selected and applicable |

### 18. Engineering assessment (`assessment`)

**Format:** [Structured engineering assessment narrative](generic-section-formats-v1.md#18-engineering-assessment).

Present an explicitly reviewed assessment backed by current facts and verified calculations.

Repeat by: assessmentType, component, phase. Detected usable support: 2 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Assessment basis and scope | concise prose | approved_assessment_method, confirmed_scope | when selected and applicable |
| Results and calculation references | table and cross references | verified_calculation_result, evidence_link | when selected and applicable |
| Reviewed conclusion | concise prose | reviewed_assessment | when selected and applicable |
| Assumptions and limitations | concise prose | confirmed_assumption, scope_limitation | when selected and applicable |

### 19. B-scan and local scan profiles (`scan-profiles`)

**Format:** [Location diagram followed by labelled profile traces](generic-section-formats-v1.md#19-b-scan-and-local-scan-profiles).

Keep profile traces, locations and interpretation linked to the examined area.

Repeat by: component, method, areaId, phase. Detected usable support: 32 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Profile locations | figure and labels | geometry_link, scan_metadata | when selected and applicable |
| Scan profiles | verified figure sequence | verified_scan_profile | when selected and applicable |
| Profile findings | table or prose | test_result, reviewed_assessment | when selected and applicable |
| Profile coverage and limitations | concise prose | test_limitation | when selected and applicable |

### 20. 3D and dimensional assessment results (`dimensional`)

**Format:** [Scan-location diagram, geometry views and dimensional results](generic-section-formats-v1.md#20-3d-and-dimensional-assessment-results).

Present current scan stations, deformation views, heat maps and reviewed geometry results.

Repeat by: component, surveyType, areaId, phase. Detected usable support: 7 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Scan station locations and coverage | figure and table | scan_station, test_coverage | when selected and applicable |
| Geometry views and heat maps | verified figure sequence | verified_3d_artifact, verified_dimensional_figure | when selected and applicable |
| Dimensional results | native result grid | survey_reading, verified_dimension_result | when selected and applicable |
| Reviewed interpretation | concise prose | reviewed_assessment | when selected and applicable |
| Scan coverage and limitations | concise prose | test_limitation, scope_limitation | when selected and applicable |

### 21. Post-repair inspection (`repair-verification`)

**Format:** [Repair register with linked verification and condition](generic-section-formats-v1.md#21-post-repair-inspection).

Trace each inspected repair to the original location and the verification performed.

Repeat by: component, repairId, phase. Detected usable support: 10 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Repair work and locations | repair register | confirmed_repair_record | when selected and applicable |
| Verification examinations | table and cross references | test_result, evidence_link | when selected and applicable |
| Post-repair condition and outstanding items | concise prose | observation, voice_claim, reviewed_assessment | when selected and applicable |
| Verification limitations | concise prose | scope_limitation | when selected and applicable |

### 22. Repair consultation and review (`consultation`)

**Format:** [Three-part consultation narrative](generic-section-formats-v1.md#22-repair-consultation-and-review).

Keep the requested review, proposed work and professional conclusions distinct.

Repeat by: component, phase. Detected usable support: 1 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Consultation scope | concise prose | confirmed_scope | when selected and applicable |
| Proposed work and available basis | prose and references | confirmed_repair_proposal, evidence_link | when selected and applicable |
| Review comments | concise prose | reviewed_assessment | when selected and applicable |

### 23. Tank calibration table (`calibration`)

**Format:** [Calibration metadata and native calibration grid](generic-section-formats-v1.md#23-tank-calibration-table).

Present supplied or separately verified calibration records with their units and datum.

Repeat by: one instance per report. Detected usable support: 1 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Asset, datum and calibration basis | labelled fields | identity, calibration_metadata | when selected and applicable |
| Calibration data | native calibration grid | verified_calibration_record | when selected and applicable |
| Applicability and limitations | concise prose | calibration_metadata | when selected and applicable |

### 24. References (`references`)

**Format:** [Consistently numbered reference list](generic-section-formats-v1.md#24-references).

List only references and attachments actually used by the selected report.

Repeat by: one instance per report. Detected usable support: 17 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Referenced documents and editions | reference list | approved_reference, approved_attachment | when selected and applicable |

### 25. Summary and conclusions (`summary`)

**Format:** [Concise summary with references to detail](generic-section-formats-v1.md#25-summary-and-conclusions).

Summarize reviewed results with links to detail; never manufacture a new assessment.

Repeat by: one instance per report. Detected usable support: 2 source files.

| Block | Presentation | Accepted current evidence | Applicability |
| --- | --- | --- | --- |
| Scope overview | concise prose | confirmed_scope | when selected and applicable |
| Principal reviewed results | concise prose with cross references | reviewed_assessment, evidence_link | when selected and applicable |
| Confirmed actions | concise prose with cross references | confirmed_recommendation | when provided |

## Evaluation boundary and remaining validation

Implemented now: all-KB structural inventory, source citations, nine candidate compositions, 25 detailed template definitions, explicit multi-use evidence design and a reproducible offline consolidation/validation script. **These are design artefacts, not the active classifier or renderer.** The live Evaluation Lab still runs the original 32-section preset. This catalogue has no production or generation imports, and no KB labels, dataset splits, mock captures, gold answers, drafts, policies or models were changed.

Before running this as the next generation experiment: validate representative original-page layouts for each profile; implement and check profile/instance selection plus missing native adapters; label independent per-slot obligations; then compare the same app evidence across the existing and generic candidates. Measure routing precision/recall, required-output recovery, critical value/entity preservation, length and export layout separately. Do not interpret template coverage as generation quality.

All 166 KB entries were structurally exposed during design, including validation/hidden-test sources. Two exact-source duplicate groups already span training and hidden-test labels. Preserve that audit trail and do not describe these sources as untouched structural holdouts. A later independent generalization claim needs newly held-out reports or an explicit evaluation design that accounts for this exposure. This review does not establish whether historical runtime retrieval ever consumed those copies.

The original [32-section design](report-section-contracts-v1.md) remains the compatibility reference until this candidate is deliberately integrated and evaluated. No product or model promotion is part of that step.

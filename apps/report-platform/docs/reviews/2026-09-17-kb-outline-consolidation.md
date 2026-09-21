# All-KB section-outline consolidation — 17 September 2026

Status: agent-reviewed structural synthesis; evaluation-only candidate, not human approval or a production change.

## Coverage and method

The review covers **all 166 current KB entries**, **162 distinct source-file hashes**, **6,633 extracted sections** and **14,393 chunks**. Four entries are exact duplicate source files. The corpus registry contains 199 rows, a different population that includes items outside the loaded KB; this audit does not claim to have reviewed 199 KB reports.

Inventory and source support are grounded in a read-only KB snapshot. TOCs, extracted headings and table shapes were enumerated; ambiguous labels were checked against selected body chunks. Every entry has a candidate family/composition and module citations or an explicit extraction limitation. This is not an every-page original-PDF layout inspection. A heading's absence from extraction is not proof that the report lacks that content. Presence of a history section often means “Not Provided,” not captured historical information.

- [Consolidated generic outline and detailed templates](../design/generic-report-outline-v1.md)
- [Complete source review and citations](data/kb-outline-source-review-2026-09-17.json)
- [Counts, deduplication, source exposure and profile mapping](data/kb-outline-audit-2026-09-17.json)
- [Machine-readable catalogue](data/generic-report-outline-v1.json)

## What changed after reviewing the whole KB

| Evidence from the reports | Consequence for the outline |
| --- | --- |
| The fixed 32-section sequence follows TK V10 (22PE1-4), including five named scanning areas. In the 120 inspection/survey sources reviewed together, those dedicated area/MPI/repair-map/engineering-appendix headings occur in one source. | Keep it as a compatibility preset. Use optional area/method/phase instances instead of mandatory Area 1–5 slots. |
| B-scan profiles detected in 32 inspection/survey sources; roundness and plumbness in 23 each; shell settlement results in 48. | Add scan and survey modules missing or underrepresented in the fixed outline. |
| Shell, roof, nozzle, reinforcement-pad, floor, sump, end-cap, floating-roof and sleeve tables differ. A horizontal shell table uses three readings while its end-cap table uses five. | Preserve native component-specific row/column shapes and units. No universal R1–R5 table. |
| Post-repair, consultation, calibration and standalone NDT reports have much shorter or different structures. | Compose by report purpose, configuration and methods rather than forcing every report into a full inspection TOC. |
| 3D reports include station locations, deformation views, heat maps and separate assessment outputs. | Add dimensional templates; do not treat them as generic free-text inspection findings. |
| Some sources concern pipeline welds, pressure vessels or test plates. | Keep their specialist method structures separate from default tank-report scope. |

These are corpus observations and design decisions. They are not assertions that a technical standard requires a section or approves a method.

## Data-quality and independence findings

- **Four rejected RTF entries** are flattened with no useful section/table or page structure. Retained in coverage; excluded from usable template support. Corresponding PDF/revision sources may be correlated, so distinct hashes are not independent-report counts.
- **Five entries have no page provenance**, including those four RTFs and one DOCX. Chunk IDs are retained; native rendering is needed for visual verification.
- **Three MFL sources are test fixtures/mock-ups**, counted separately from field-report defaults. One older floor report is partial.
- **67 of the 120 inspection/survey entries** contain stale VU6 cover text. Other specialist entries also show cover residue. Family choices must use current configuration/body evidence, not that heading.
- **11 horizontal inspection reports** were stored under broad inspection labels; dedicated end-cap/horizontal-thickness sections establish a different configuration. Eleven “MFL testing” headings in these reports were mislabelled as plate maps in extraction; that false support was removed in this review.
- Original split labels are **132 training, 20 validation and 14 hidden-test entries**. All informed structure design. Two exact-source duplicate groups span training/hidden-test labels. These counts describe source exposure and do not establish historical answer leakage through runtime retrieval.
- All source-specific annotations are audit metadata only. They do not change KB family labels, approvals, splits, app exports, mock preparation, gold answers or deployed policy.

## Candidate profile coverage

| Candidate profile | KB entries | Distinct source files | Caveat |
| --- | ---: | ---: | --- |
| Vertical tank inspection | 80 | 80 | Agent composition proposal; human review pending |
| Horizontal tank inspection | 17 | 16 | Agent composition proposal; human review pending |
| Tank dimensional survey | 31 | 30 | Agent composition proposal; human review pending |
| 3D profile or floor assessment | 10 | 9 | 4 extraction-limited |
| Floor MFL assessment | 2 | 2 | Agent composition proposal; human review pending |
| Post-repair inspection and verification | 11 | 11 | Agent composition proposal; human review pending |
| Standalone NDT examination | 13 | 12 | 3 test fixtures |
| Repair consultation | 1 | 1 | Agent composition proposal; human review pending |
| Tank calibration | 1 | 1 | Agent composition proposal; human review pending |

## Representative source evidence

| Source | Pages / structure | Design implication |
| --- | --- | --- |
| 22PE1-4 TK V10 internal/external | pp. 37–47: area-specific UT/MPI; pp. 111–113: engineering summary | Optional repeatable examination and assessment modules. |
| 15RS1-9 TK 4710 survey | p. 10 roundness; p. 18 plumbness; pp. 19–22 graphs | Survey readings, stations and graphs need explicit templates. |
| 19PE1-3 TK VU8 | p. 19 minimum horizontal thickness; p. 22 end-cap calculations | Horizontal configuration changes applicable sections. |
| 23PE1-3 TK FU48 | p. 22 shell/end-cap tables with three/five readings | Native component-specific table topology. |
| 22PE3-1 TK V10 3D profile | pp. 7–22 main structure, pp. 23–122 specialist appendices | Short main assessment plus selected detailed geometry sections. |
| TK 147 in-service floating roof | pp. 34–40 pontoon/deck/leg-sleeve measurements | Repeat by physical subcomponent and inner/outer context. |
| TK T5540 roof settlement | pp. 12–16 cross-section survey tables | Survey direction, reference datum and design slope belong to each instance. |

Exact source filenames, document IDs, chunk IDs and page lists are retained in the source-review JSON; the short names above are navigation aids.

## Reproduce and verify

The offline builder takes a read-only KB snapshot with `documents`, `sections`, `chunks`, `registry` and `reviewedAt`, plus the saved per-source review. It verifies complete document coverage, unchanged source hashes and every cited chunk/page, deduplicates support, and writes the audit/catalogue. It does not connect to or mutate PostgreSQL, call an LLM or run generation.

```bash
node --env-file=.env server/scripts/export-kb-outline-snapshot.mjs --output /tmp/laiq-kb-outline-corpus.json
node server/scripts/build-generic-outline-review.mjs --snapshot /tmp/laiq-kb-outline-corpus.json
```

Run from `apps/report-platform`. The exporter uses a PostgreSQL read-only repeatable-read transaction. Keep its source-content snapshot outside tracked/runtime generation assets. To reproduce the exact audited version, preserve the original snapshot; a new export records a new timestamp and may include later KB changes that require fresh review.

The snapshot and input review SHA256 hashes are in the audit. Saved citations allow decisions to be revisited; classifications are agent judgements, not mechanically guaranteed truth. The original DB source remains the authority for source content.

Validation completed: full report-platform standard guardrails; KB inventory, precedent, ingestion (nine tests), review and recommendation audits; exact catalogue reproduction; complete source/chunk/page validation. The builder also correctly rejects an omitted document, changed source hash and invalid citation page. The reusable read-only exporter returned the same 166-entry / 6,633-section / 14,393-chunk inventory. These checks validate isolation and provenance, not report-generation quality or visual PDF fidelity.

## Every reviewed KB entry

The following list accounts for every source entry, including duplicates and extraction-limited sources. Module support uses exact-hash deduplication, whereas this inventory deliberately retains all entries.

### 1. 15RS1-9 - TK 4710  Survey Inspection Report (RS).pdf

`canonical_kba_000a95e7f4e757eabb01` · stored `tank_survey` → candidate `dimensional-survey` / `tank_dimensional_survey` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations, shell-layout, roundness, plumbness, plumbness-graphs, settlement-results, settlement-graphs.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 2. 22PE4-2 TK V3 Post Repair Inspection Report (Follow Up).pdf

`canonical_kba_0071ba6b021efdcfc4e4` · stored `post_repair` → candidate `post-repair` / `post_repair_full` · training · KB approved

Detected structures: history-regime, asset-information, inspection-findings, ndt-examination, photographs, post-repair-verification.

Review notes: Post-repair summary with separate MPI and vacuum-box test records, tested-location drawings and photos. Cover contains repeated VU6/horizontal/template text; family inferred from body structure, not cover residue.

### 3. 18PE2-1 TK SU 2 Post Repair Inspection Report.pdf

`canonical_kba_0b994bfd6cc36fd51f49` · stored `post_repair` → candidate `post-repair` / `post_repair_full` · training · KB approved

Detected structures: history-regime, asset-information, inspection-findings, ndt-examination, photographs, component-layout, post-repair-verification.

Review notes: Post-repair summary, MPI examination, photos and floor layout. Cover contains repeated VU6/horizontal/template text; family inferred from body structure, not cover residue.

### 4. 19PE2-2 TK BE 2 Internal Inspection Report.pdf

`canonical_kba_0e54211ed6f252597f91` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · hidden_test · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, recommendations, test-information, checklist, photos, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 5. 15RS3-2 - TK 662 Survey Inspection Report.pdf

`canonical_kba_0e6c64fb7f5790eca27c` · stored `tank_survey` → candidate `dimensional-survey` / `tank_dimensional_survey` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations, shell-layout, roundness, plumbness, plumbness-graphs, settlement-results, settlement-graphs.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 6. 19PE1-5 TK BE 1 Internal & External Inspection Report.pdf

`canonical_kba_0f6547b25147ac1a61e9` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, photos, floor-layout.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 7. 15SE3-1 Shell Bukom TK 3905 Internal Inspection Report.pdf

`canonical_kba_0fb1fa553dadfa1128ee` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · hidden_test · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 8. NDE-RP-22-2508_Pacific Energy Weld Inspection Report.pdf

`canonical_kba_1031799c2efd923dc997` · stored `other_inspection_report` → candidate `ndt-examination` / `paut_weld_specialist` · training · KB approved

Detected structures: assessment-summary, scope-purpose, method-equipment, ndt-examination.

Review notes: PAUT weld examination: signatory, summary, scope, equipment/settings, weld/scan configuration, individual results and scan images. Non-tank asset scope.

### 9. 19ROT1-1 Shell Bukom TK 145 Floor & Edge Settlement Survey Report Rev.1.pdf

`canonical_kba_1139ca8207121a7282b9` · stored `settlement_survey` → candidate `dimensional-survey` / `settlement_floor_edge` · training · KB approved

Detected structures: scope-purpose, history-regime, asset-information, inspection-findings, survey-readings, calculation-assessment, survey-graphs-locations, component-layout.

Review notes: Floor and edge settlement data, actual shell heights, assessments/allowable limits, graphs and station locations; EEMUA assessment appendix. Some section headings are merged/concatenated; use cited body chunks and original pages before final template approval. Embedded code extracts are reference material, not observed inspection work or newly authorized guidance.

### 10. bukom tank143-report.rtf

`canonical_kba_127dce3bfdeedda412c1` · stored `floor_3d_scan` → candidate `three-dimensional-assessment` / `floor_scan_software_export` · validation · KB rejected

Detected structures: scan-metadata, survey-readings, station-profile.

Review notes: Flattened software-generated bottom-settlement report; metadata, coordinate units/reference, station-elevation grid and per-station profiles. KB page references unavailable; retain chunk identity and require native rendering before visual template verification.

### 11. 23PE1-1 TK FU 1 External Inspection Report.pdf

`canonical_kba_1283efabdef358f2e3df` · stored `external_inspection` → candidate `vertical-inspection` / `vertical_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, photos.

### 12. 16PP1-1 Port Vila TK 5 Internal & External Inspection with Post Repair Inspection Report.pdf

`canonical_kba_135d9098c8c6f35729c5` · stored `post_repair` → candidate `vertical-inspection` / `combined_inspection_post_repair` · validation · KB approved

Detected structures: scope-purpose, history-regime, asset-information, inspection-findings, calculation-assessment, recommendations, method-equipment, checklist, ndt-examination, thickness-measurements, component-layout, survey-readings, survey-graphs-locations, photographs, mfl-guidance, mfl-layout-platemaps, post-repair-verification.

Review notes: Full inspection plus post-repair phase, dye-penetrant before/after repair, separately numbered nozzle and reinforcement-pad UT, shell settlement and MFL.

### 13. 19SE1-1 Shell Bukom V1302A Internal & External Inspection Report.pdf

`canonical_kba_13b7a2325b56f86ddef7` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, shell-minimum-thickness, shell-ut, shell-layout, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 14. 15RS1-5 - TK 611  Survey Inspection Report (RS).pdf

`canonical_kba_1450b0f3e1dcdd4eaa82` · stored `tank_survey` → candidate `dimensional-survey` / `tank_dimensional_survey` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations, shell-layout, roundness, plumbness, plumbness-graphs, settlement-results, settlement-graphs.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 15. 19PE1-1 TK VU1 Internal & External Inspection Report.pdf

`canonical_kba_1a0033370bc405066e41` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, photos, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 16. 18PE1-4 TK SU3 Internal & External Inspection Report.pdf

`canonical_kba_1b3d3164e19e0657eda8` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, photos, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 17. 14PE1-1 - TK NU 6 Post Repair Inspection Report.pdf

`canonical_kba_1c65164df3fd82c8160f` · stored `post_repair` → candidate `post-repair` / `post_repair_full` · training · KB approved

Detected structures: history-regime, asset-information, inspection-findings, ndt-examination, component-layout, post-repair-verification.

Review notes: Post-repair inspection plus MPI examination and shell/floor layouts.

### 18. 15PP3-1 Port Vila TK VI 2 Internal & External Inspection Report.pdf

`canonical_kba_1fc71fc0c0448d810492` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, settlement-locations, photos, floor-layout, mfl-guidance, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 19. 15RS1-8 - TK 5540  Survey Inspection Report (RS).pdf

`canonical_kba_202392761071d9a4841e` · stored `tank_survey` → candidate `dimensional-survey` / `tank_dimensional_survey` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations, shell-layout, roundness, plumbness, plumbness-graphs, settlement-results, settlement-graphs.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 20. 15RS1-7 - TK 5470  Survey Inspection Report (RS).pdf

`canonical_kba_2026fb2c06b75b820a98` · stored `tank_survey` → candidate `dimensional-survey` / `tank_dimensional_survey` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations, shell-layout, settlement-results, settlement-graphs.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 21. 17RS1-1 - TK T5540 Survey Inspection Report.pdf

`canonical_kba_218ce592bc652b7c143d` · stored `tank_survey` → candidate `dimensional-survey` / `tank_dimensional_survey` · validation · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations, shell-layout, roundness, plumbness, plumbness-graphs, settlement-results, settlement-graphs.

### 22. 17SE2-1 Shell Bukom TK 156 Internal Inspection Report.pdf

`canonical_kba_22a9147ff950292c5e01` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, annular-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 23. 19PE1-3 TK VU8 Internal & External Inspection Report.pdf

`canonical_kba_25766c0a4afa8009d480` · stored `internal_external_api653` → candidate `horizontal-inspection` / `horizontal_inspection` · training · KB approved

Detected structures: scope, codes-and-references, regime, identity, history, inspection-findings, recommendations, test-information, checklist, horizontal-minimum-thickness, shell-corrosion-rate, end-cap-assessment, shell-ut, nozzle-ut, sump-ut, photos.

Review notes: Dedicated minimum horizontal thickness/end-cap assessment body headings establish horizontal configuration; stale cover header alone ignored. Stale VU6 cover heading excluded from family evidence.

### 24. 15PP2-2 Port Vila TK 2 Internal & External Inspection Report.pdf

`canonical_kba_25a1a23ecb040afb7753` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, settlement-locations, photos, floor-layout, mfl-guidance, mfl-platemaps.

### 25. 22PE2-MPI-1 TK V10 Shell Repairs.pdf

`canonical_kba_264e2965dfe7a6415373` · stored `mpi_repair` → candidate `ndt-examination` / `ndt_record_mpi` · training · KB approved

Detected structures: ndt-examination, photographs.

Review notes: Repeated MPI test sheets by examination item/area; identification, size, result and disposition columns, examiner and photos.

### 26. 17SE8-1 Shell Bukom TK 4614 Internal Inspection Report.pdf

`canonical_kba_279b9993290f46b2d554` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, annular-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, mfl-guidance, mfl-platemaps.

### 27. 17RS2-1 - TK T5540 Roof Settlement Survey Report.pdf

`canonical_kba_2ab2abe50d7f5470f648` · stored `settlement_survey` → candidate `dimensional-survey` / `settlement_roof` · training · KB approved

Detected structures: scope-purpose, history-regime, asset-information, inspection-findings, survey-readings, survey-graphs-locations.

Review notes: Roof settlement represented by repeatable directional cross-sections and point-location diagram; not shell settlement only. Some section headings are merged/concatenated; use cited body chunks and original pages before final template approval. Embedded code extracts are reference material, not observed inspection work or newly authorized guidance.

### 28. 23PE1-7 TK FU 47 Calibration Report.pdf

`canonical_kba_2b780ec0040aa5308d4b` · stored `calibration` → candidate `calibration` / `calibration` · training · KB approved

Detected structures: calibration-table.

Review notes: Tank calibration metadata followed by dip/ullage/net-volume conversion tables.

### 29. 16SE7-1 Shell Bukom TK 95 Internal Inspection Report.pdf

`canonical_kba_2be4a51e1a377f233ab1` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · validation · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, annular-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 30. 15RS1-2 - TK 250  Survey Inspection Report (RS).pdf

`canonical_kba_2c59a96496d2e57fe4e6` · stored `tank_survey` → candidate `dimensional-survey` / `tank_dimensional_survey` · hidden_test · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations, shell-layout, roundness, plumbness, plumbness-graphs, settlement-results, settlement-graphs.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 31. 18SE4-2 Shell Bukom TK 2171 Internal & External Inspection Report.pdf

`canonical_kba_2e8f5a3d3a270ddcb451` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · validation · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, shell-minimum-thickness, shell-ut, shell-layout, roundness, plumbness, plumbness-graphs, settlement-results, settlement-graphs, edge-settlement, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 32. 16SE1-1 Shell Bukom TK 84 Internal Inspection Report.pdf

`canonical_kba_2ea35ae49f40eb8ef712` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, annular-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 33. 15PE3-1 TK 16 Internal & External Inspection Report.pdf

`canonical_kba_32da9596a8f3651f92a6` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, nozzle-ut, settlement-results, settlement-graphs, photos, floor-layout, mfl-guidance, mfl-platemaps.

### 34. 18PE2-3 TK 4 Internal & External Inspection Report.docx.pdf

`canonical_kba_3349a2b6d4993bbbac72` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · validation · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, test-information, checklist, roof-ut, roof-nozzle-ut, roof-layout, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, floor-ut, sump-ut, floor-layout, photos.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 35. 15SE4-1 Rev.1 Shell Bukom TK 714 Internal Inspection Report.pdf

`canonical_kba_362a4ae7395d37f55ed9` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, annular-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 36. 15RS2-1 Rev.1 - TK 444  Shell Deformation Measurement Report.pdf

`canonical_kba_3866243158693b51ccde` · stored `profile_3d_scan` → candidate `dimensional-survey` / `shell_deformation_grid` · training · KB approved

Detected structures: dimensional-profile, scope-purpose, history-regime, asset-information, inspection-findings, recommendations, method-equipment, calculation-assessment.

Review notes: Shell deformation method, optimum-center determination, maximum deformation graphs and four area-grid attachments. Cover contains repeated VU6/horizontal/template text; family inferred from body structure, not cover residue. Some section headings are merged/concatenated; use cited body chunks and original pages before final template approval.

### 37. 17SE5-1 Shell Bukom TK 39801 Internal Inspection Report.pdf

`canonical_kba_38e356d0d0f2540bd164` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · validation · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, annular-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 38. 15PP3-2 TK 2 - Post Repair Inspection Report.pdf

`canonical_kba_38ec0c0908b24490a435` · stored `post_repair` → candidate `post-repair` / `post_repair_full` · hidden_test · KB approved

Detected structures: history-regime, asset-information, inspection-findings, ndt-examination, component-layout, post-repair-verification.

Review notes: Post-repair summary, MPI examination and floor layout. Cover contains repeated VU6/horizontal/template text; family inferred from body structure, not cover residue. Some section headings are merged/concatenated; use cited body chunks and original pages before final template approval.

### 39. 19PE1-2 TK VU7 Internal & External Inspection Report.pdf

`canonical_kba_3aa37ef76e0cd3b8a11a` · stored `internal_external_api653` → candidate `horizontal-inspection` / `horizontal_inspection` · validation · KB approved

Detected structures: scope, codes-and-references, regime, identity, history, inspection-findings, recommendations, test-information, checklist, horizontal-minimum-thickness, shell-corrosion-rate, end-cap-assessment, shell-ut, nozzle-ut, sump-ut, photos.

Review notes: Dedicated minimum horizontal thickness/end-cap assessment body headings establish horizontal configuration; stale cover header alone ignored. Stale VU6 cover heading excluded from family evidence.

### 40. 22PE1-2 TK V7 Internal & External Inspection Report.pdf

`canonical_kba_3b69413240a2b62f3e91` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, photos, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 41. 14PE2-2 - TK NU 4 Internal Inspection Report.pdf

`canonical_kba_3bb0f560207f0a459bfe` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · validation · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, recommendations, test-information, checklist, photos, floor-layout, mfl-guidance, mfl-platemaps.

### 42. 15RS1-11 - TK 4700  Survey Inspection Report (RS).pdf

`canonical_kba_3c7018467f57f4505558` · stored `tank_survey` → candidate `dimensional-survey` / `tank_dimensional_survey` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations, shell-layout, roundness, plumbness, plumbness-graphs, settlement-results, settlement-graphs.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 43. 17SE6-2 Shell Bukom TK 215 Follow Up Floor Visual Inspection Report.pdf

`canonical_kba_3f606bd9ce2da4df8726` · stored `other_inspection_report` → candidate `post-repair` / `follow_up_floor_visual` · training · KB approved

Detected structures: scope-purpose, history-regime, asset-information, inspection-findings, recommendations.

Review notes: Focused follow-up after floor blasting: scope, regime, asset information, floor visual findings/clarification and recommendations. Cover contains repeated VU6/horizontal/template text; family inferred from body structure, not cover residue. Some section headings are merged/concatenated; use cited body chunks and original pages before final template approval.

### 44. 15SE1-1 Rev.1 Shell Bukom TK 4608 Int & Ext Inspection Report.pdf

`canonical_kba_423da42a9cb1b35a26bc` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, annular-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, shell-minimum-thickness, shell-ut, shell-layout, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 45. 21SE1-1 Shell Bukom TK 78 Internal Inspection Report.pdf

`canonical_kba_4296b144ab242fa03215` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, recommendations, test-information, checklist, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 46. 16SE2-1 Shell Bukom V1305 MFL Inspection Report.pdf

`canonical_kba_439f1215505896f833c9` · stored `mfl_floor_scan` → candidate `ndt-examination` / `mfl_pressure_vessel` · training · KB approved

Detected structures: scope-purpose, asset-information, history-regime, inspection-findings, method-equipment, component-layout, mfl-guidance, mfl-layout-platemaps.

Review notes: MFL examination of a pressure-vessel floor: scope, vessel information, findings, test information, A-scans, floor layout, guidance, corrosion plan and platemaps.

### 47. 15PE2-1 TK NU 4 Post Repair Inspection Report.pdf

`canonical_kba_44fc49dd590c71b7d61a` · stored `post_repair` → candidate `post-repair` / `post_repair_full` · training · KB approved

Detected structures: history-regime, asset-information, inspection-findings, ndt-examination, photographs, post-repair-verification.

Review notes: Post-repair summary, MPI examination and photographs.

### 48. 22PE2-MPI-1 TK V10 Shell Repairs.pdf

`canonical_kba_45001deff9b99c773d8f` · stored `mpi_repair` → candidate `ndt-examination` / `ndt_record_mpi` · training · KB approved

Detected structures: ndt-examination, photographs.

Review notes: Duplicate source hash of the MPI shell-repair test-sheet report.

### 49. 20SE1-1 Shell Bukom TK 28 Internal Inspection Report.pdf

`canonical_kba_463290630deb5d9005e3` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, recommendations, test-information, checklist, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps, bscan-profiles.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 50. 16TJS4 -1 TK 465 Internal & External Inspection Report.pdf

`canonical_kba_46d82c5ba5edfba6a0b0` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · validation · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, photos, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 51. VI4 internal and external MPI Report.docx

`canonical_kba_48bfd2d8ffbd202b9e0a` · stored `mpi_repair` → candidate `ndt-examination` / `ndt_record_mpi` · training · KB approved

Detected structures: ndt-examination.

Review notes: DOCX MPI examination form: description/method, tested area, results and examiner. KB page references unavailable; retain chunk identity and require native rendering before visual template verification.

### 52. 17SE7-1 Shell Bukom TK 77 Internal Inspection Report.pdf

`canonical_kba_494fc27d931a7764caed` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, annular-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, floor-corrosion-plan.

### 53. 23PE1-2 TK FU 47 Internal & External Inspection Report.pdf

`canonical_kba_4cf7ea5995deb73d352c` · stored `horizontal_internal_external` → candidate `horizontal-inspection` / `horizontal_inspection` · training · KB approved

Detected structures: scope-purpose, technical-references, history-regime, asset-information, inspection-findings, recommendations, method-equipment, checklist, calculation-assessment, thickness-measurements, component-layout, photographs.

Review notes: Horizontal-specific references/calculation, shell and end-cap corrosion, shell/end-cap/nozzle/pad/sump readings, layout, repair drawing and photos. Cover contains repeated VU6/horizontal/template text; family inferred from body structure, not cover residue. NDT/MFL names in codes-and-standards reference section do not establish those methods were performed.

### 54. 18PE1-5 TK SU 2 Internal & External Inspection Report.pdf

`canonical_kba_4db109b23dde507aff73` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, photos, floor-layout.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 55. 18SE1-1 Shell Bukom TK 3961 Internal Inspection Report.pdf

`canonical_kba_523fb5f318adf79b0609` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, annular-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 56. 22PE1-7 TK V3 Post Repair Inspection Report.pdf

`canonical_kba_56aff7fbc53fd757ad8d` · stored `post_repair` → candidate `post-repair` / `post_repair_full` · training · KB approved

Detected structures: history-regime, asset-information, inspection-findings, ndt-examination, photographs, post-repair-verification.

Review notes: Post-repair summary, MPI test record, floor tested-location drawing and photos. Cover contains repeated VU6/horizontal/template text; family inferred from body structure, not cover residue.

### 57. 16SE4-1 Shell Bukom TK 157 Internal Inspection Report.pdf

`canonical_kba_59714396dc95e6a10b71` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · validation · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, annular-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 58. 15RS1-10 - TK 4670  Survey Inspection Report (RS).pdf

`canonical_kba_5c543e012f6add9cf0ea` · stored `tank_survey` → candidate `dimensional-survey` / `tank_dimensional_survey` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations, shell-layout, roundness, plumbness, plumbness-graphs, settlement-results, settlement-graphs.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 59. 15RS1-4 - TK 560  Survey Inspection Report (RS).pdf

`canonical_kba_5edcccfa5211c01d7aca` · stored `tank_survey` → candidate `dimensional-survey` / `tank_dimensional_survey` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations, shell-layout, roundness, plumbness, plumbness-graphs, settlement-results, settlement-graphs.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 60. 22PE1-3 TK V9 Internal & External Inspection Report.pdf

`canonical_kba_69678bb4aea01f8b110a` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, photos, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 61. 15RS1-1 - TK 445  Survey Inspection Report (RS).pdf

`canonical_kba_699723cd262a651bbb8e` · stored `tank_survey` → candidate `dimensional-survey` / `tank_dimensional_survey` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations, shell-layout, roundness, plumbness, plumbness-graphs, settlement-results, settlement-graphs.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 62. 17SE6-1 Shell Bukom TK 215 Internal Inspection Report.pdf

`canonical_kba_6a6c84fb452cf4c66d5e` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, annular-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 63. 23PE1-3 TK FU 48 Internal & External Inspection Report.pdf

`canonical_kba_6df890164b93a8f00009` · stored `horizontal_internal_external` → candidate `horizontal-inspection` / `horizontal_inspection` · training · KB approved

Detected structures: scope-purpose, technical-references, history-regime, asset-information, inspection-findings, recommendations, method-equipment, checklist, calculation-assessment, thickness-measurements, component-layout, photographs.

Review notes: Horizontal-specific references/calculation, shell and end-cap corrosion, shell/end-cap/nozzle/pad/sump readings, layout, repair drawing and photos. Cover contains repeated VU6/horizontal/template text; family inferred from body structure, not cover residue. NDT/MFL names in codes-and-standards reference section do not establish those methods were performed.

### 64. 22PE2-1 TK V10 Shell Internal Inspection Report (Post Blast).pdf

`canonical_kba_735f598458b6e4f2960b` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations, photos.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 65. 23PE1-4 TK FU 49 Internal & External Inspection Report.pdf

`canonical_kba_74e4193fa722125d5cd6` · stored `horizontal_internal_external` → candidate `horizontal-inspection` / `horizontal_inspection` · training · KB approved

Detected structures: scope-purpose, technical-references, history-regime, asset-information, inspection-findings, recommendations, method-equipment, checklist, calculation-assessment, thickness-measurements, component-layout, photographs.

Review notes: Horizontal-specific references/calculation, shell and end-cap corrosion, shell/end-cap/nozzle/pad/sump readings, layout, repair drawing and photos. Cover contains repeated VU6/horizontal/template text; family inferred from body structure, not cover residue. NDT/MFL names in codes-and-standards reference section do not establish those methods were performed.

### 66. 15PP2-1 Port Vila TK VI 5 Internal & External Inspection Report.pdf

`canonical_kba_770e1877a9b6539277c4` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · validation · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, settlement-locations, photos, floor-layout, mfl-guidance, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 67. 19SE4-1 Shell Bukom TK 77 Internal Inspection Report.pdf

`canonical_kba_7814fec84ff198910308` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, annular-corrosion-rate, floor-corrosion-rate, recommendations, test-information, bscan-profiles, floor-layout, mfl-guidance, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 68. 15PE1-5 TK FU 48 External Inspection Report.pdf

`canonical_kba_7d55e9dcd9f2cd6a47f5` · stored `external_inspection` → candidate `horizontal-inspection` / `horizontal_inspection` · training · KB approved

Detected structures: scope, codes-and-references, regime, identity, history, inspection-findings, recommendations, test-information, checklist, horizontal-minimum-thickness, shell-corrosion-rate, end-cap-assessment, shell-ut, nozzle-ut, sump-ut, shell-layout, photos.

Review notes: Dedicated minimum horizontal thickness/end-cap assessment body headings establish horizontal configuration; stale cover header alone ignored. Stale VU6 cover heading excluded from family evidence.

### 69. 19SE5-1 Shell Bukom TK 201 Internal Inspection Report.pdf

`canonical_kba_80bc861e0049d10eccfb` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · validation · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, annular-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps, bscan-profiles.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 70. 16RS1-2 - TK 4680 Survey Inspection Report (Ria Report Format).pdf

`canonical_kba_844adac7a2bf7dd44b2c` · stored `tank_survey` → candidate `dimensional-survey` / `tank_dimensional_survey` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations, shell-layout, roundness, plumbness, plumbness-graphs, settlement-results, settlement-graphs.

### 71. 19SE6-1 Rev.1 Shell Bukom TK 53 Floor & Edge Settlement Survey Report.pdf

`canonical_kba_8507786664f187c83a5e` · stored `settlement_survey` → candidate `dimensional-survey` / `settlement_floor_edge` · validation · KB approved

Detected structures: scope-purpose, history-regime, asset-information, inspection-findings, survey-readings, calculation-assessment, recommendations, survey-graphs-locations.

Review notes: Floor/edge settlement with separate API653 and EEMUA assessments/allowable-limit sections and an explicit assessment-adjustment/limitation block. Cover contains repeated VU6/horizontal/template text; family inferred from body structure, not cover residue. Some section headings are merged/concatenated; use cited body chunks and original pages before final template approval. Embedded code extracts are reference material, not observed inspection work or newly authorized guidance.

### 72. 23PE1-6 TK FU 51 Internal & External Inspection Report.pdf

`canonical_kba_855ae5f496ace58c5769` · stored `horizontal_internal_external` → candidate `horizontal-inspection` / `horizontal_inspection` · training · KB approved

Detected structures: scope-purpose, technical-references, history-regime, asset-information, inspection-findings, recommendations, method-equipment, checklist, calculation-assessment, thickness-measurements, component-layout, photographs.

Review notes: Horizontal-specific references/calculation, shell and end-cap corrosion, shell/end-cap/nozzle/pad/sump readings, layout, repair drawing and photos. Cover contains repeated VU6/horizontal/template text; family inferred from body structure, not cover residue. NDT/MFL names in codes-and-standards reference section do not establish those methods were performed.

### 73. 22PE1-1 TK V3 Internal & External Inspection Report.pdf

`canonical_kba_8615bab937fa2d8fd54b` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · hidden_test · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, photos, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 74. 19PE2-1 TK BE 1 Internal Inspection Report.pdf

`canonical_kba_87f42d41eb80ef6abe68` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations, test-information, checklist, photos, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 75. 16RS1-1 - TK 5541 Survey Inspection Report (Ria Report Format).pdf

`canonical_kba_8ecfb95fcc763ace6ba0` · stored `tank_survey` → candidate `dimensional-survey` / `tank_dimensional_survey` · validation · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations, shell-layout, roundness, plumbness, plumbness-graphs, settlement-results, settlement-graphs.

### 76. 19PE1-4 TK VU4 Internal & External Inspection Report.pdf

`canonical_kba_8f8cb546c8ba363532a0` · stored `internal_external_api653` → candidate `horizontal-inspection` / `horizontal_inspection` · training · KB approved

Detected structures: scope, codes-and-references, regime, identity, history, inspection-findings, recommendations, test-information, checklist, horizontal-minimum-thickness, shell-corrosion-rate, end-cap-assessment, nozzle-ut, photos.

Review notes: Dedicated minimum horizontal thickness/end-cap assessment body headings establish horizontal configuration; stale cover header alone ignored. Stale VU6 cover heading excluded from family evidence.

### 77. 15PE1-7 TK FU 50 External Inspection Report.pdf

`canonical_kba_95b1ee001adba1e754ed` · stored `external_inspection` → candidate `horizontal-inspection` / `horizontal_inspection` · training · KB approved

Detected structures: scope, codes-and-references, regime, identity, history, inspection-findings, recommendations, test-information, checklist, horizontal-minimum-thickness, shell-corrosion-rate, end-cap-assessment, shell-ut, nozzle-ut, sump-ut, photos.

Review notes: Dedicated minimum horizontal thickness/end-cap assessment body headings establish horizontal configuration; stale cover header alone ignored. Stale VU6 cover heading excluded from family evidence.

### 78. 18SE4-1 Shell Bukom TK 2351 Internal & External Inspection Report.pdf

`canonical_kba_96e34a200752a5cbb9bd` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, shell-minimum-thickness, shell-ut, shell-layout, roundness, plumbness, plumbness-graphs, settlement-results, settlement-graphs, edge-settlement, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 79. 15RS1-3 - TK 251  Survey Inspection Report (RS).pdf

`canonical_kba_9c9bc5351936b7be8cc3` · stored `tank_survey` → candidate `dimensional-survey` / `tank_dimensional_survey` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations, shell-layout, roundness, plumbness, plumbness-graphs, settlement-results, settlement-graphs.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 80. 18PE2-4 TK 5 Internal & External Inspection Report.pdf

`canonical_kba_9d30a1dd1d5e969d1c84` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, test-information, checklist, roof-ut, roof-nozzle-ut, roof-layout, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, floor-ut, sump-ut, floor-layout, photos.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 81. 17SE1-1 Shell Bukom TK 148 Internal Inspection Report.pdf

`canonical_kba_9f2690a00527783d92b4` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, annular-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, mfl-guidance, mfl-platemaps.

### 82. 19SE3-1 Shell Bukom TK 147 In-Service Inspection Report.pdf

`canonical_kba_a2389064446b2358517e` · stored `in_service_inspection` → candidate `vertical-inspection` / `in_service_floating_roof` · training · KB approved

Detected structures: scope-purpose, survey-readings, history-regime, asset-information, inspection-findings, calculation-assessment, recommendations, method-equipment, checklist, thickness-measurements, component-layout, dimensional-profile, survey-graphs-locations.

Review notes: Floating-roof in-service inspection with deck/pontoon/manhole/leg-sleeve inner-outer UT, roof/shell layouts, roundness/plumbness, settlement and floor-edge projection UT. Cover contains repeated VU6/horizontal/template text; family inferred from body structure, not cover residue. Some section headings are merged/concatenated; use cited body chunks and original pages before final template approval. Embedded code extracts are reference material, not observed inspection work or newly authorized guidance.

### 83. 22PE1-6 TK V10 Post Repair Inspection Report.pdf

`canonical_kba_a29b6b211cf9f924b80e` · stored `post_repair` → candidate `post-repair` / `post_repair_full` · training · KB approved

Detected structures: history-regime, asset-information, inspection-findings, ndt-examination, photographs, post-repair-verification.

Review notes: Post-repair summary, MPI test record, internal-shell tested-location drawing and photos. Cover contains repeated VU6/horizontal/template text; family inferred from body structure, not cover residue.

### 84. 15PE4-1 - TK NU 7 Internal Inspection & Post Inspection Report.pdf

`canonical_kba_a8400bdb06eb510d3fae` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, recommendations, test-information, checklist, photos, mfl-guidance, mfl-platemaps.

### 85. 18PE2-6 TK VU 3 External Inspection Report.pdf

`canonical_kba_aa9f77af4409877325d0` · stored `external_inspection` → candidate `horizontal-inspection` / `horizontal_inspection` · training · KB approved

Detected structures: scope, codes-and-references, regime, identity, history, inspection-findings, recommendations, test-information, checklist, horizontal-minimum-thickness, shell-corrosion-rate, end-cap-assessment, photos.

Review notes: Dedicated minimum horizontal thickness/end-cap assessment body headings establish horizontal configuration; stale cover header alone ignored.

### 86. 22PE3-1 TK V10 Profile Assessment (3D Scan).pdf

`canonical_kba_ac4417a9577b96be4230` · stored `profile_3d_scan` → candidate `three-dimensional-assessment` / `profile_3d_containment` · training · KB approved

Detected structures: assessment-summary, scope-purpose, method-equipment, dimensional-profile, calculation-assessment, secondary-containment, component-layout, asset-information, history-regime, inspection-findings, recommendations, survey-graphs-locations.

Review notes: 3D profile/secondary containment report: assessment summary, introduction, scope, methodology, metadata, results/discussion and conclusions; deformation, verticality, roundness, settlement, containment and station appendices. Cover contains repeated VU6/horizontal/template text; family inferred from body structure, not cover residue. Some section headings are merged/concatenated; use cited body chunks and original pages before final template approval.

### 87. 19SE2-1 Shell Bukom TK 5452 Internal & External Inspection Report.pdf

`canonical_kba_ae941a71373872c0c0b6` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-nozzle-ut, roof-layout, shell-minimum-thickness, shell-ut, nozzle-ut, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 88. 15PP1-2 Port Vila TK VI 1 External Shell MPI Report.pdf

`canonical_kba_b2fba243cf8a0e70bbdf` · stored `mpi_repair` → candidate `ndt-examination` / `ndt_record_mpi` · validation · KB approved

Detected structures: scope-purpose, history-regime, asset-information, ndt-examination, component-layout, photographs.

Review notes: MPI specialist report using normal report front matter, scope and tank metadata, then tested area, results, shell layout and photos. Cover contains repeated VU6/horizontal/template text; family inferred from body structure, not cover residue. Some section headings are merged/concatenated; use cited body chunks and original pages before final template approval.

### 89. 18PE1-2 TK V4 Internal & External Inspection Report.pdf

`canonical_kba_b34ab927d6545293005c` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, photos, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 90. 16TJS3 -1 TK 10 Internal & External Inspection Report.pdf

`canonical_kba_b59ef8f4e988bb9abea9` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, photos, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 91. 15PIE1-2 TK RA 2 External Inspection Report.pdf

`canonical_kba_b62c8abe80ceba7be60f` · stored `external_inspection` → candidate `vertical-inspection` / `vertical_external` · hidden_test · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-nozzle-ut, shell-minimum-thickness, shell-ut, nozzle-ut, settlement-results, settlement-graphs, settlement-locations, photos.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 92. 19SE7-1 Shell Bukom TK 201 Floor & Edge Settlement Survey Report.pdf

`canonical_kba_b9e6026951b20341e53e` · stored `settlement_survey` → candidate `dimensional-survey` / `settlement_floor_edge` · training · KB approved

Detected structures: scope-purpose, history-regime, asset-information, inspection-findings, survey-readings, calculation-assessment, survey-graphs-locations.

Review notes: Floor/edge settlement with readings, actual shell heights, separately named API653/EEMUA assessments and allowable limits, graphs and station locations. Cover contains repeated VU6/horizontal/template text; family inferred from body structure, not cover residue. Some section headings are merged/concatenated; use cited body chunks and original pages before final template approval. Embedded code extracts are reference material, not observed inspection work or newly authorized guidance.

### 93. 16UE1-1 Shell Bukom TK 4613 Internal Inspection Report.pdf

`canonical_kba_bb52aa2e239d74364eba` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, annular-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 94. 16SE3-1 Shell Bukom TK 203 Internal Inspection Report Rev.1.pdf

`canonical_kba_bbe96964c672074aa1c7` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, annular-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 95. 18PE2-2 TK 3 Internal & External Inspection Report.pdf

`canonical_kba_c10938661241fed4aa60` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, test-information, checklist, roof-ut, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, floor-ut, floor-layout, photos.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 96. 18PE1-3 TK SU4 Internal & External Inspection Report.pdf

`canonical_kba_c11230cea789b79c7a60` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, annular-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, photos, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 97. 14BT1-1 TK T5103A Tank Survey.pdf

`canonical_kba_c1bf8b7d19e184e57030` · stored `tank_survey` → candidate `dimensional-survey` / `tank_dimensional_survey` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, settlement-results, settlement-graphs, settlement-locations, roundness, plumbness, plumbness-graphs, floor-settlement.

### 98. 15SE2-1 Shell Bukom TK 151 Internal Inspection Report.pdf

`canonical_kba_c669992cc1f9bddefe54` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 99. 21PE1-1 TK V10 Consultation & Review on Repairs.pdf

`canonical_kba_cab797f7e2e800c94589` · stored `repair_consultation` → candidate `repair-consultation` / `repair_consultation` · training · KB approved

Detected structures: asset-information, history-regime, repair-consultation, recommendations, attached-procedure, technical-references.

Review notes: Tank metadata, consultation/review by repair location and comments/recommendations, followed by an attached vacuum-box procedure/blank record. Attached procedure does not prove testing occurred. Vacuum-box procedure and blank test form are appended reference material; do not label as a performed examination.

### 100. Shell Bukom Test Plate Report - 18Dec2012.pdf

`canonical_kba_cb5769098d0cc0b05e08` · stored `mfl_floor_scan` → candidate `ndt-examination` / `mfl_test_plate` · training · KB approved

Detected structures: inspection-findings, component-layout, mfl-layout-platemaps, mfl-guidance.

Review notes: MFL test-plate demonstration with examination summary, test-plate numbering/layout and interpretation guidance; not a normal inspected-tank report.

### 101. Shell Bukom TK 27-report.rtf

`canonical_kba_cbb3b18037e2a2f42c25` · stored `floor_3d_scan` → candidate `three-dimensional-assessment` / `floor_scan_software_export` · training · KB rejected

Detected structures: scan-metadata, survey-readings, station-profile.

Review notes: Flattened software-generated bottom-settlement report; metadata, coordinate units/reference, station-elevation grid and per-station profiles. KB page references unavailable; retain chunk identity and require native rendering before visual template verification.

### 102. 16SE6-1 Shell Bukom TK 4612 Internal Inspection Report.pdf

`canonical_kba_cd85ace45e2ea22f6ae3` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, annular-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 103. 15PE1-4 TK FU 47 External Inspection Report.pdf

`canonical_kba_cda247a67283e8bb371c` · stored `external_inspection` → candidate `horizontal-inspection` / `horizontal_inspection` · training · KB approved

Detected structures: scope, codes-and-references, regime, identity, history, inspection-findings, recommendations, test-information, checklist, horizontal-minimum-thickness, shell-corrosion-rate, end-cap-assessment, shell-ut, nozzle-ut, sump-ut, shell-layout, photos.

Review notes: Dedicated minimum horizontal thickness/end-cap assessment body headings establish horizontal configuration; stale cover header alone ignored. Stale VU6 cover heading excluded from family evidence.

### 104. 22PE4-1 TK V3 Floor Internal Inspection Report (Follow Up).pdf

`canonical_kba_cef58b7e98b101113aff` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations, test-information, floor-layout.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 105. 17SE4-1 Shell Bukom TK 132 Tank Survey Report.pdf

`canonical_kba_cf6bc0f716505979962d` · stored `tank_survey` → candidate `dimensional-survey` / `tank_dimensional_survey` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, edge-settlement, floor-settlement.

### 106. bukom tank 73-report-Final Adjusted.rtf

`canonical_kba_cf7473b979fc519f54c8` · stored `floor_3d_scan` → candidate `three-dimensional-assessment` / `floor_scan_software_export` · training · KB rejected

Detected structures: scan-metadata, survey-readings, station-profile.

Review notes: Flattened software-generated bottom-settlement report including an elevation datum; metadata, station-elevation grid and per-station profiles. KB page references unavailable; retain chunk identity and require native rendering before visual template verification.

### 107. 15PP1-1 Port Vila TK VI 4 Internal & External Inspection Report.pdf

`canonical_kba_d38b84c1d0a9f258a9ce` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, settlement-locations, photos, floor-layout, mfl-guidance, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 108. Tank 79 - report-Final Adjusted.rtf

`canonical_kba_d3ab214f410fbeecc0f7` · stored `floor_3d_scan` → candidate `three-dimensional-assessment` / `floor_scan_software_export` · training · KB rejected

Detected structures: scan-metadata, survey-readings, station-profile.

Review notes: Flattened software-generated bottom-settlement report including an elevation datum; metadata, station-elevation grid and per-station profiles. KB page references unavailable; retain chunk identity and require native rendering before visual template verification.

### 109. 23PE1-5 TK FU 50 Internal & External Inspection Report.pdf

`canonical_kba_d863ca3a55d799127b2b` · stored `horizontal_internal_external` → candidate `horizontal-inspection` / `horizontal_inspection` · training · KB approved

Detected structures: scope-purpose, technical-references, history-regime, asset-information, inspection-findings, recommendations, method-equipment, checklist, calculation-assessment, thickness-measurements, component-layout, photographs.

Review notes: Horizontal-specific references/calculation, shell and end-cap corrosion, shell/end-cap/nozzle/pad/sump readings, layout, repair drawing and photos. Cover contains repeated VU6/horizontal/template text; family inferred from body structure, not cover residue. NDT/MFL names in codes-and-standards reference section do not establish those methods were performed.

### 110. 14PE2-3 - TK NU 3 Post Repair Inspection Report.pdf

`canonical_kba_d8973897188b686160c1` · stored `post_repair` → candidate `post-repair` / `post_repair_full` · training · KB approved

Detected structures: history-regime, asset-information, inspection-findings, ndt-examination, photographs, component-layout, post-repair-verification.

Review notes: Post-repair summary, MPI examination, photographs and roof/floor layouts.

### 111. 16SE5-1 Shell Bukom TK 301 Internal Inspection Report.pdf

`canonical_kba_d910b22ecff8cf8de00d` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · hidden_test · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, annular-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 112. 19PE1-6 TK BE 2 Internal & External Inspection Report.pdf

`canonical_kba_d94b40fdeb1edc0c02fc` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · hidden_test · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, photos, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 113. 24PE1-2 TK 13 Internal & External Inspection Report.pdf

`canonical_kba_dbece820d4d194e087f1` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · hidden_test · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, photos, floor-layout, floor-corrosion-plan, mfl-guidance, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 114. 15PIE1-3 TK RA 3 Internal & External Inspection Report.pdf

`canonical_kba_de2e9bab596f06155c7f` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · hidden_test · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, nozzle-ut, settlement-results, settlement-graphs, photos, floor-layout, mfl-guidance, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 115. 15PE1-6 TK FU 49 External Inspection Report.pdf

`canonical_kba_df34bbc8a102985294ed` · stored `external_inspection` → candidate `horizontal-inspection` / `horizontal_inspection` · validation · KB approved

Detected structures: scope, codes-and-references, regime, identity, history, inspection-findings, recommendations, test-information, checklist, horizontal-minimum-thickness, shell-corrosion-rate, end-cap-assessment, shell-ut, nozzle-ut, sump-ut, photos.

Review notes: Dedicated minimum horizontal thickness/end-cap assessment body headings establish horizontal configuration; stale cover header alone ignored. Stale VU6 cover heading excluded from family evidence.

### 116. 22PE1-4 TK V10 Internal & External Inspection Report.pdf

`canonical_kba_df471743f44ae750d003` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, additional-ndt, area-scan, shell-external-mpi, shell-internal-mpi, shell-repairs, nozzle-ut, settlement-results, settlement-graphs, photos, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps, engineering-summary.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 117. 15RS3-1 - TK 661 Survey Inspection Report.pdf

`canonical_kba_e14d2237198b02be1d55` · stored `tank_survey` → candidate `dimensional-survey` / `tank_dimensional_survey` · hidden_test · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations, shell-layout, roundness, plumbness, plumbness-graphs, settlement-results, settlement-graphs.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 118. IRS 2002 inspection report.pdf

`canonical_kba_e501276011a1fecbc775` · stored `other_inspection_report` → candidate `floor-mfl` / `partial_floor_mfl_assessment` · training · KB approved

Detected structures: inspection-findings, recommendations, calculation-assessment.

Review notes: Short historical floor report/excerpt: inspection, repair recommendations, visual examination and floor/annular corrosion-life calculations; insufficient full-report structure.

### 119. 17TJS12 -1 TK 461 Internal & External Inspection Report.pdf

`canonical_kba_e62ac15b858a74d3e9f0` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, photos, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 120. 18PE2-5 TK SU1 Internal & External Inspection Report.pdf

`canonical_kba_e7ee36a4eadf20581058` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, settlement-results, settlement-graphs, photos, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 121. 18SE3-1 Shell Bukom TK 24 Internal Inspection Report.pdf

`canonical_kba_e9a1cb5c1db52e08a753` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, annular-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 122. 19PE2-4 TK SV5 Internal & External Inspection Report.pdf

`canonical_kba_e9acd1a03b99cc191ff5` · stored `internal_external_api653` → candidate `horizontal-inspection` / `horizontal_inspection` · training · KB approved

Detected structures: scope, codes-and-references, regime, identity, history, inspection-findings, recommendations, test-information, checklist, horizontal-minimum-thickness, shell-corrosion-rate, end-cap-assessment, shell-ut, nozzle-ut, sump-ut, photos.

Review notes: Dedicated minimum horizontal thickness/end-cap assessment body headings establish horizontal configuration; stale cover header alone ignored. Stale VU6 cover heading excluded from family evidence.

### 123. 18SE2-1 Shell Bukom TK 720A Internal Inspection Report.pdf

`canonical_kba_eabc2f5189ccece915e3` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, annular-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 124. 15PE1-3 TK FU 1 External Inspection Report.pdf

`canonical_kba_ead77c92cb62b640f9fa` · stored `external_inspection` → candidate `vertical-inspection` / `vertical_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, settlement-locations, photos.

### 125. 15RS1-6 - TK 612  Survey Inspection Report (RS).pdf

`canonical_kba_eb3921989162216b38e6` · stored `tank_survey` → candidate `dimensional-survey` / `tank_dimensional_survey` · validation · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations, shell-layout, roundness, plumbness, plumbness-graphs, settlement-results, settlement-graphs.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 126. TK NU7 MPI Report.pdf

`canonical_kba_ed3ac4389088f6294d7f` · stored `mpi_repair` → candidate `ndt-examination` / `ndt_record_mpi` · training · KB approved

Detected structures: ndt-examination.

Review notes: Single-page MPI form: examination description/method, tested area, results and examiner.

### 127. 14PE3-1 - Vatukoula TK 2 Internal & External Inspection Report.pdf

`canonical_kba_eeb198ec95341e580a8a` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, settlement-locations, photos, floor-layout, mfl-guidance, mfl-platemaps.

### 128. 15PE1-8 TK FU 51 External Inspection Report.pdf

`canonical_kba_ef67230cec339d10c157` · stored `external_inspection` → candidate `horizontal-inspection` / `horizontal_inspection` · training · KB approved

Detected structures: scope, codes-and-references, regime, identity, history, inspection-findings, recommendations, test-information, checklist, horizontal-minimum-thickness, shell-corrosion-rate, end-cap-assessment, shell-ut, nozzle-ut, sump-ut, shell-layout, photos.

Review notes: Dedicated minimum horizontal thickness/end-cap assessment body headings establish horizontal configuration; stale cover header alone ignored. Stale VU6 cover heading excluded from family evidence.

### 129. 18PE1-1 TK V41 Internal & External Inspection Report.pdf

`canonical_kba_efe0076af2d26918a7df` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, photos, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 130. 19PE2-3 TK BE 51 Internal Inspection Report.pdf

`canonical_kba_f360ac86e91cfc0d496b` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, recommendations, test-information, checklist, photos, floor-layout.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 131. 15PE1-1 Vatukoula TK 2 Post Repair Inspection Report.pdf

`canonical_kba_f5fd0a67ac07b8a4cf93` · stored `post_repair` → candidate `post-repair` / `post_repair_full` · hidden_test · KB approved

Detected structures: history-regime, asset-information, inspection-findings, ndt-examination, photographs, component-layout, post-repair-verification.

Review notes: Post-repair summary, MPI examination, photos and roof/shell/floor layouts. Cover contains repeated VU6/horizontal/template text; family inferred from body structure, not cover residue.

### 132. 14AT1-1 Rev.1- Tank Survey Report (With AT Logo).pdf

`canonical_kba_f777495f700f7b29e20d` · stored `tank_survey` → candidate `dimensional-survey` / `tank_dimensional_survey` · training · KB approved

Detected structures: scope, identity, history, inspection-findings, settlement-results, settlement-graphs, settlement-locations, roundness, plumbness, plumbness-graphs, edge-settlement, floor-settlement.

### 133. 15PIE1-1 TK RA 1 Internal & External Inspection Report.pdf

`canonical_kba_f7f9869dbac6d4c3237e` · stored `internal_external_api653` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, settlement-locations, photos, floor-layout, mfl-guidance, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 134. 15PC1-1 Rev.1 - TK 5470 Survey Inspection Report.pdf

`canonical_kba_fad64ff59121cc01a68c` · stored `tank_survey` → candidate `dimensional-survey` / `tank_dimensional_survey` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations, shell-layout, roundness, plumbness, plumbness-graphs.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 135. 14PE2-1 - TK NU 3 Internal Inspection Report.pdf

`canonical_kba_fb54beaaab00cc8f2c99` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, recommendations, test-information, checklist, photos, floor-layout, mfl-guidance, mfl-platemaps.

### 136. 22PE1-5 TK SU7 Internal Inspection Report Rev.1.pdf

`canonical_kba_fcb72b729286ee79ab1c` · stored `internal_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, recommendations, test-information, checklist, photos, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 137. 18PE2-7 TK VU 5 External Inspection Report.pdf

`canonical_kba_ff366fd189d89910d66f` · stored `external_inspection` → candidate `horizontal-inspection` / `horizontal_inspection` · validation · KB approved

Detected structures: scope, codes-and-references, regime, identity, history, inspection-findings, recommendations, test-information, checklist, horizontal-minimum-thickness, shell-corrosion-rate, end-cap-assessment, photos.

Review notes: Dedicated minimum horizontal thickness/end-cap assessment body headings establish horizontal configuration; stale cover header alone ignored.

### 138. 15PE1-2 Vatukoula TK 1 External Inspection Report.pdf

`canonical_kba_ffe000f2481b65d68847` · stored `external_inspection` → candidate `vertical-inspection` / `vertical_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, roof-corrosion-rate, recommendations, test-information, checklist, roof-ut, roof-layout, roof-nozzle-ut, shell-minimum-thickness, shell-ut, shell-layout, nozzle-ut, settlement-results, settlement-graphs, settlement-locations, photos.

### 139. 17SE4-1 Shell Bukom TK 132 Tank Survey Report.pdf

`doc-heldout-17se4-1-tk132` · stored `settlement_survey` → candidate `dimensional-survey` / `settlement_floor_edge` · hidden_test · KB approved

Detected structures: scope-purpose, history-regime, asset-information, inspection-findings, survey-readings, calculation-assessment, survey-graphs-locations.

Review notes: Floor/edge settlement with station readings, assessment/allowable limits, repeated station graphs, floor profiles and location drawing. Embedded code extracts are reference material, not observed inspection work or newly authorized guidance.

### 140. 23PE1-3 TK FU 48 Internal & External Inspection Report.pdf

`doc-heldout-23pe1-3-fu48` · stored `horizontal_internal_external` → candidate `horizontal-inspection` / `horizontal_inspection` · hidden_test · KB approved

Detected structures: scope-purpose, technical-references, history-regime, asset-information, inspection-findings, recommendations, method-equipment, checklist, calculation-assessment, thickness-measurements, component-layout, photographs.

Review notes: Duplicate source hash of the FU48 horizontal inspection report; also present as a held-out-labelled KB entry. Cover contains repeated VU6/horizontal/template text; family inferred from body structure, not cover residue. NDT/MFL names in codes-and-standards reference section do not establish those methods were performed.

### 141. 22PE3-1 TK V10 Profile Assessment (3D Scan).pdf

`doc_03b990c5ac2e9a7e7123` · stored `profile_3d_scan` → candidate `three-dimensional-assessment` / `profile_3d_containment` · training · KB approved

Detected structures: assessment-summary, scope-purpose, method-equipment, dimensional-profile, calculation-assessment, secondary-containment, component-layout, asset-information, history-regime, inspection-findings, recommendations, survey-graphs-locations.

Review notes: Duplicate source hash of the 3D profile/secondary containment report. Cover contains repeated VU6/horizontal/template text; family inferred from body structure, not cover residue. Some section headings are merged/concatenated; use cited body chunks and original pages before final template approval.

### 142. 714_200805   08S1-2(13).pdf

`governed_corpus_report_090125bb6e9a25c5` · stored `api653_tank_inspection` → candidate `vertical-inspection` / `vertical_external` · training · KB approved

Detected structures: scope, shell-layout, regime, identity, history, inspection-findings, shell-corrosion-rate, test-information, shell-minimum-thickness, shell-ut.

Review notes: Scope/body confirm shell UT and external visual; filename alone lacks scope.

### 143. Shell Bukom Truflux MFL Mock Test on GRP Test Plates Rev.1 - 30th Oct 2014.pdf

`governed_corpus_report_0ba0a1aa261aa14f` · stored `mfl_floor_assessment` → candidate `ndt-examination` / `mfl_test_plate` · training · KB approved

Detected structures: scope-purpose, inspection-findings, component-layout, mfl-layout-platemaps, mfl-guidance.

Review notes: MFL mock-up report with test-plate layout, mapping layout, result-tabulation summary and interpretation guide.

### 144. 14AT1-1 - Tank Survey Report.pdf

`governed_corpus_report_114a6f56416bb0ea` · stored `api653_tank_inspection` → candidate `dimensional-survey` / `tank_dimensional_survey` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, settlement-results, settlement-graphs, settlement-locations, roundness, plumbness, plumbness-graphs, edge-settlement, floor-settlement.

### 145. 15RS2-1 - TK444  Shell Deformation Measurement Report.pdf

`governed_corpus_report_1345bd270eb6f487` · stored `api653_tank_inspection` → candidate `dimensional-survey` / `shell_deformation_survey` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, recommendations.

Review notes: Filename and survey headings identify specialist geometry survey. Stale VU6 cover heading excluded from family evidence.

### 146. 22PE1-MPI-2 TK V3 Floor Internal Plates.pdf

`governed_corpus_report_1705ff49e483fffe` · stored `post_repair_verification` → candidate `ndt-examination` / `ndt_record_mpi` · training · KB approved

Detected structures: ndt-examination, photographs.

Review notes: MPI test record, floor repaired-location drawing and photos; not a complete inspection report.

### 147. 19SE6-1 Shell Bukom TK 53 Floor & Edge Settlement Survey Report.pdf

`governed_corpus_report_2e4e7b384f3414e5` · stored `api653_tank_inspection` → candidate `dimensional-survey` / `floor_edge_settlement` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, edge-settlement, floor-settlement.

Review notes: Filename and body survey headings identify specialist settlement survey. Stale VU6 cover heading excluded from family evidence.

### 148. 6508_201107   11S1-19(6).pdf

`governed_corpus_report_509d3ca5e8f39729` · stored `api653_tank_inspection` → candidate `vertical-inspection` / `vertical_external` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-corrosion-rate, recommendations, test-information, checklist, shell-minimum-thickness, shell-ut, shell-layout.

Review notes: Scope/body confirm shell UT and external visual; filename alone lacks scope.

### 149. 23SE1-2 Shell Bukom TK 79 Floor 3D Scan.pdf

`governed_corpus_report_50feada001082ce3` · stored `api653_tank_inspection` → candidate `three-dimensional-assessment` / `floor_3d_survey` · training · KB approved

Detected structures: scope, identity, history, inspection-findings, 3d-floor, test-information, edge-settlement, floor-settlement.

Review notes: Floor 3D/heat-map and settlement body headings override broad stored API653 family. Stale VU6 cover heading excluded from family evidence.

### 150. 84_200805   08S1-2(9).pdf

`governed_corpus_report_59e8ed1fb0f4a95f` · stored `api653_tank_inspection` → candidate `vertical-inspection` / `vertical_external` · training · KB approved

Detected structures: scope, shell-layout, regime, identity, history, inspection-findings, shell-corrosion-rate, test-information, shell-minimum-thickness, shell-ut.

Review notes: Scope/body confirm shell UT and external visual; filename alone lacks scope.

### 151. 15SE4-1 Shell Bukom TK 714 Internal Inspection Report.pdf

`governed_corpus_report_5d54b537da549d3e` · stored `api653_tank_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, annular-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 152. Shell Bukom Truflux MFL Mock Test on GRP Test Plates - 30th Oct 2014.pdf

`governed_corpus_report_798fb6e907f98aa4` · stored `mfl_floor_assessment` → candidate `ndt-examination` / `mfl_test_plate` · training · KB approved

Detected structures: scope-purpose, inspection-findings, component-layout, mfl-layout-platemaps, mfl-guidance.

Review notes: Earlier MFL mock-up version with test-plate and mapping layouts and interpretation guide; lacks the separately numbered tabulation added in revision.

### 153. 23SE1-1 Shell Bukom TK 73 Floor 3D Scan.pdf

`governed_corpus_report_7cb0560ae4bf0322` · stored `api653_tank_inspection` → candidate `three-dimensional-assessment` / `floor_3d_survey` · training · KB approved

Detected structures: scope, identity, history, inspection-findings, 3d-floor, test-information, edge-settlement, floor-settlement.

Review notes: Floor 3D/heat-map and settlement body headings override broad stored API653 family. Stale VU6 cover heading excluded from family evidence.

### 154. 16SE3-1 Shell Bukom TK 203 Internal Inspection Report.pdf

`governed_corpus_report_8462bc32ac3e0fc7` · stored `api653_tank_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, annular-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, mfl-guidance, mfl-platemaps.

### 155. 15PC1-1 - TK 5470 Survey Inspection Report.pdf

`governed_corpus_report_92dad00ef6829bd2` · stored `api653_tank_inspection` → candidate `dimensional-survey` / `tank_dimensional_survey` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, shell-layout, roundness, plumbness, plumbness-graphs.

### 156. 4613_200904   09S1-6 .pdf

`governed_corpus_report_9a1a8200e73b1e36` · stored `api653_tank_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, annular-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, mfl-guidance.

Review notes: Scope/body confirm floor MFL, peripheral scan and general visual inspection.

### 157. 22PE4-MPI-1 TK V3 Floor Internal Plates.pdf

`governed_corpus_report_9f9ee6663436a4e1` · stored `post_repair_verification` → candidate `ndt-examination` / `ndt_record_mpi` · training · KB approved

Detected structures: ndt-examination, photographs.

Review notes: MPI test record, floor location drawing and photos; not a complete inspection report.

### 158. 15SE1-1 Shell Bukom TK 4608 Int & Ext Inspection Report.pdf

`governed_corpus_report_ae7264e171ca3b00` · stored `api653_tank_inspection` → candidate `vertical-inspection` / `vertical_internal_external` · training · KB approved

Detected structures: scope, regime, identity, history, shell-corrosion-rate, roof-corrosion-rate, floor-corrosion-rate, annular-corrosion-rate, checklist, roof-ut, roof-layout, shell-minimum-thickness, shell-ut, shell-layout, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

### 159. 146_201011   10S1-22 mfl.pdf

`governed_corpus_report_b04d86c4e618ba19` · stored `api653_tank_inspection` → candidate `floor-mfl` / `mfl_floor_inspection` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, annular-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, mfl-guidance.

Review notes: Filename and floor/MFL body structure identify floor-focused scope.

### 160. 23SE1-3 Shell Bukom TK 143 Floor 3D Scan.pdf

`governed_corpus_report_cafd3b7c16990e2c` · stored `api653_tank_inspection` → candidate `three-dimensional-assessment` / `floor_3d_survey` · training · KB approved

Detected structures: scope, identity, history, inspection-findings, 3d-floor, test-information, edge-settlement, floor-settlement.

Review notes: Floor 3D/heat-map and settlement body headings override broad stored API653 family. Stale VU6 cover heading excluded from family evidence.

### 161. 22PE1-MPI-1 TK V10 Shell Plates Internal.pdf

`governed_corpus_report_cca740206f8dc577` · stored `post_repair_verification` → candidate `ndt-examination` / `ndt_record_mpi` · validation · KB approved

Detected structures: ndt-examination, photographs.

Review notes: MPI test record, shell location drawing and photos; not a complete inspection report.

### 162. 23SE1-4 Shell Bukom TK 27 Floor 3D Scan.pdf

`governed_corpus_report_d4669077bf6a58fc` · stored `api653_tank_inspection` → candidate `three-dimensional-assessment` / `floor_3d_survey` · training · KB approved

Detected structures: scope, identity, history, inspection-findings, 3d-floor, test-information, edge-settlement, floor-settlement.

Review notes: Floor 3D/heat-map and settlement body headings override broad stored API653 family. Stale VU6 cover heading excluded from family evidence.

### 163. 14PE2-3 TK NU 3 Post Repair Inspection Report.pdf

`governed_corpus_report_dbc1decaa473f350` · stored `api653_tank_inspection` → candidate `post-repair` / `post_repair` · training · KB approved

Detected structures: regime, identity, history, inspection-findings, photos, roof-layout, floor-layout.

Review notes: Filename identifies post-repair report; verify lifecycle in body.

### 164. 22PE1-5 TK SU7 Internal Inspection Report.pdf

`governed_corpus_report_e13ccd22761998bb` · stored `api653_tank_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, floor-corrosion-rate, recommendations, test-information, checklist, photos, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

Review notes: Stale VU6 cover heading excluded from family evidence.

### 165. 14AT1-1 - Tank Survey Report (With AT Logo).pdf

`governed_corpus_report_e82d8b05d747d916` · stored `api653_tank_inspection` → candidate `dimensional-survey` / `tank_dimensional_survey` · training · KB approved

Detected structures: scope, identity, history, inspection-findings, settlement-results, settlement-graphs, settlement-locations, roundness, plumbness, plumbness-graphs, edge-settlement, floor-settlement.

### 166. 15SE4-1 Shell Bukom TK 714 Internal Inspection Report.pdf

`governed_corpus_report_ebc9254e039123eb` · stored `api653_tank_inspection` → candidate `vertical-inspection` / `vertical_internal` · training · KB approved

Detected structures: scope, regime, identity, history, inspection-findings, annular-corrosion-rate, floor-corrosion-rate, recommendations, test-information, checklist, bscan-profiles, floor-layout, mfl-guidance, floor-corrosion-plan, mfl-platemaps.

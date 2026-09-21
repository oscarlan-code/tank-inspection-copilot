# Vertical tank inspection report profile v1

Status: source-reviewed development profile; evaluation only; no product route is
enabled.

Profile ID: `vertical_tank_inspection_v1`

## Decision

Development starts with the seven-section opening spine shared by the reviewed
vertical-tank reports. Technical sections remain conditional because their presence
depends mainly on internal/external inspection scope and performed methods.

The TK5452 21-section table of contents remains an integrated evaluation case. It
is not the universal V1 template.

## Source review

The canonical inspection corpus contained 80 broadly labelled inspection records.
Structural screening excluded 11 horizontal-tank reports, leaving 69 unique
vertical-tank reports:

- 33 combined internal and external inspections;
- 32 internal inspections;
- 4 external inspections.

Six combined, six internal, and all four external reports were then checked as a
representative cross-section. All 16 contain the same seven-section opening spine.
The normalized full-corpus extraction gives the following support:

| Common section | Detected reports | Share of 69 |
| --- | ---: | ---: |
| SCOPE OF INSPECTION | 69 | 100.0% |
| INSPECTION AND MAINTENANCE REGIME | 69 | 100.0% |
| GENERAL TANK INFORMATION | 69 | 100.0% |
| INSPECTION REPORT | 68 | 98.6% |
| REPAIR RECOMMENDATIONS / API 653 ASSESSMENT | 65 | 94.2% |
| TEST INFORMATION | 68 | 98.6% |
| TANK INSPECTION CHECKLIST | 66 | 95.7% |

A missing parsed heading is not evidence that the report obligation is absent.
Legacy spelling, OCR and document-format exceptions remain review items.

## V1 common core

These are the first section releases to complete. Their order and report-facing
titles follow the reviewed reports.

| Order | Report-facing title | Output mode | Current status |
| ---: | --- | --- | --- |
| 1 | SCOPE OF INSPECTION | Evidence-bound narrative and scope list | Planned |
| 2 | INSPECTION AND MAINTENANCE REGIME | Approved controlled template; AI disabled | Planned |
| 3 | GENERAL TANK INFORMATION | Deterministic labelled fields | Frozen, evaluation-only |
| 4 | INSPECTION REPORT | Evidence-bound component findings | Planned |
| 5 | REPAIR RECOMMENDATIONS / API 653 ASSESSMENT | Inspector-approved actions; KB may propose candidates | Planned |
| 6 | TEST INFORMATION | Deterministic test records with bounded wording | Planned |
| 7 | TANK INSPECTION CHECKLIST | Deterministic native checklist grid | Planned |

“Common core” defines implementation priority. It does not allow export of an
incomplete report. The ReportPlan must still include every applicable technical
section required by the commissioned work and available records.

## High-frequency technical modules

The technical pattern changes by inspection scope. The percentages below are
presence in that report family after title variants were normalized.

### Combined internal and external inspection — 33 reports

| Module | Support |
| --- | ---: |
| Roof plate thickness measurements | 33/33 — 100% |
| Minimum shell thickness calculations | 33/33 — 100% |
| Floor plate layout | 33/33 — 100% |
| Shell plate thickness measurements | 32/33 — 97% |
| Shell plate layout | 31/33 — 94% |
| Roof nozzle/pad thickness measurements | 29/33 — 88% |
| Roof plate layout | 28/33 — 85% |
| Shell nozzle/pad thickness measurements | 28/33 — 85% |
| Photographs | 28/33 — 85% |
| Tru-Flux interpretation guidelines | 28/33 — 85% |
| MFL plate maps | 27/33 — 82% |
| Shell settlement results/graphs | 24/33 — 73% |
| Floor corrosion plan | 20/33 — 61% |

### Internal inspection — 32 reports

| Module | Support |
| --- | ---: |
| Tru-Flux interpretation guidelines | 28/32 — 88% |
| MFL plate maps | 28/32 — 88% |
| Floor plate layout | 27/32 — 84% |
| Floor corrosion plan | 23/32 — 72% |
| B-scan profiles | 22/32 — 69% |

### External inspection — 4 reports

All four contain roof thickness, roof nozzle/pad thickness, minimum shell
thickness calculations, shell thickness, shell layout, shell nozzle/pad thickness,
shell settlement results/graphs, and photographs. Only two contain a roof layout.
This cohort is too small to treat frequency alone as a promotion gate.

## V1 implementation waves

1. Complete and evaluate the seven common-core releases. General Tank Information
   remains frozen while the other six are developed. Their uniform agent, KB and
   harness specifications live in
   `server/section-agents/specs/vertical-tank-v1/`.
2. Implement the combined/external measurement and layout modules with the strongest
   historical support and matching app/API evidence.
3. Implement the internal floor/MFL group: floor layout, controlled Tru-Flux
   guidance, floor corrosion plan, and external MFL plate maps.
4. Add settlement, B-scan, MPI, post-inspection, area-specific NDT, piping, annotated
   repair layouts, and engineering appendices only when their native inputs and
   renderer contracts are qualified.

Each section has its own immutable release, input contract, outline, format,
prompt when applicable, pinned KB subset, validators and renderer. Later releases
cannot change a frozen earlier release.

## TK5452 integrated reference sequence

The current evaluation report uses this exact 21-section sequence:

1. SCOPE OF INSPECTION
2. INSPECTION AND MAINTENANCE REGIME
3. GENERAL TANK INFORMATION
4. INSPECTION REPORT
5. REPAIR RECOMMENDATIONS / API 653 ASSESSMENT
6. TEST INFORMATION
7. TANK INSPECTION CHECKLIST
8. ROOF PLATE THICKNESS MEASUREMENTS
9. ROOF NOZZLE & REINFORCEMENT PAD THICKNESS MEASUREMENTS
10. ROOF PLATE LAYOUT
11. MINIMUM SHELL THICKNESS CALCULATIONS
12. SHELL PLATE THICKNESS MEASUREMENTS
13. SHELL NOZZLE & REINFORCEMENT PAD THICKNESS MEASUREMENTS
14. SHELL PLATE LAYOUT
15. TANK PIPING SPOT THICKNESS MEASUREMENTS
16. TANK PIPING LAYOUT
17. B-SCAN PROFILES
18. FLOOR PLATE LAYOUT WITH PLATE NUMBERING SYSTEM
19. GUIDELINES FOR THE INTERPRETATION OF THE TRU-FLUX DATA SHEETS
20. FLOOR PLATE CORROSION PLAN
21. FLOOR PLATE INDIVIDUAL PLATEMAPS

The piping sections occur in only one of the 69 extracted vertical reports, so they
remain supported TK5452 modules rather than common-core sections.

## Structure-agent rules

The Report Structure Agent must verify orientation, inspection scope and performed
methods before selecting sections. It starts from the seven-section common spine,
then adds only applicable source-observed technical modules with sufficient current
evidence, a qualified release, and a supported renderer. Final section numbers are
assigned after review; empty conditional sections are not emitted.

Historical reports provide structure and formatting patterns only. Current facts
come from the pinned app export or confirmed report-side inputs. The legacy
32-section profile and generic template-family list cannot become the final table of
contents.

## MFL handling

MFL remains a report module. The inspector uploads the source PDF directly to the
authenticated report workspace. The platform verifies file identity, plate mapping,
page selection and approval, then assembles the approved pages without AI
rewriting. The floor corrosion plan is a separate deterministic overlay on the
verified current floor layout.

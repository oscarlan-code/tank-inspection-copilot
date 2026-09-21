# Report-facing presentation candidate, revision 2

Evaluation only. This refines the existing 25 reusable modules and 89 semantic
outline blocks; it does not change the production profile or promote a model.

The previous candidate printed internal catalogue names and every routing slot
as report headings. Consequently GENERAL TANK INFORMATION became ASSET AND
INSPECTION INFORMATION, with unnecessary Field/Value tables and repeated prose.
The revised contract separates module ID, evidence-routing slots, report title,
physical presentation and selected-profile numbering.

The whole-KB review supports the report families and conventions. The two existing
comparison reports corroborate the first five titles and their order. Their
later numbers differ because their included technical sections differ. Source
headings are structural guidance; no source inspection facts enter generation.
See [source review](../reviews/data/outline-report-presentation-review-2026-09-18.json).

| Internal module | Report-facing heading | Presentation |
| --- | --- | --- |
| identity | GENERAL TANK INFORMATION | One borderless paired field form; captured units; no redundant identity prose |
| scope | SCOPE OF INSPECTION | Scope bullets followed by captured limitations |
| regime | INSPECTION AND MAINTENANCE REGIME | Approved standard text only; no AI; pending if not supplied |
| findings | INSPECTION REPORT | Component headings, conditions and access qualifications together |
| recommendations | REPAIR RECOMMENDATIONS | Numbered captured proposed actions; preserve status and timing |
| methods | TEST INFORMATION | Captured method/equipment information and limitations; exact repeated uses appear once |
| checklist | TANK INSPECTION CHECKLIST | Compact response legend and native category grids |
| thickness | Component-specific PLATE / NOZZLE THICKNESS MEASUREMENTS | Native measurement rows and independently captured point headings |
| layout | Component-specific PLATE LAYOUTS | Verified original geometry, orientation and readable correspondence |
| calculations | CALCULATIONS | Verified calculation inputs/results; no inferred method |
| ndt | NON-DESTRUCTIVE EXAMINATION | Method-specific native examination forms |
| survey | DIMENSIONAL SURVEY | Datum, stations and survey-specific tables |
| graphs | SURVEY GRAPHS | Verified plots, scales and legends |
| photos | PHOTOGRAPHS | Real photographs and factual captions |
| method-guidance | INSPECTION METHOD AND INTERPRETATION | Approved guidance and symbol meanings |
| corrosion-plan | FLOOR CORROSION PLAN | Immutable floor drawing with verified overlay |
| platemaps | FLOOR PLATE MAPS | Native plate index and individual maps |
| assessment | ENGINEERING ASSESSMENT | Reviewed basis, results and qualified conclusion |
| scan-profiles | SCAN PROFILES | Verified scan plots with positions and scales |
| dimensional | DIMENSIONAL MEASUREMENTS | Native dimensional records and units |
| repair-verification | REPAIR VERIFICATION | Actual completed-work evidence and verification status |
| consultation | TECHNICAL CONSULTATION | Supplied question, reviewed advice and limitations |
| calibration | TANK CALIBRATION TABLE | Supplied tank calibration data, units and datum |
| references | REFERENCES | Supplied citations only |
| summary | SUMMARY AND CONCLUSIONS | Supported scope/results/proposed actions |

The selected vertical-tank evaluation profile orders the core sections as scope,
regime, identity, findings, recommendations, methods, checklist. With all seven
selected, identity is section **3**. Generic technical modules can contain several
component sections. Their final assembled numbering is not copied from either
historical report. References and summary have no standalone equivalent in the
two comparison originals; the UI continues to disclose this.

Routing retains multi-section reuse. Within one section, an exact evidence ID has
one canonical required use; other semantic labels remain supporting uses in the
ledger. Whole identity sentences become supporting only when every field is
explicitly corroborated by native values. Changed numbers, extra qualifications,
missing values and conflicting statements remain required evidence.

`generic-report-presentation.mjs` owns candidate titles and slot presentation.
`generic-outline-evaluation.mjs` applies candidate routing and records decisions.
The shared `planned-generation.mjs` and `report-document.mjs` compile and preserve
the versioned representation consumed by the existing Evaluation Lab. This is
not a viewer-only rename. Legacy plans without the opt-in presentation contract
retain their previous output.

Current limits: the 12-module evaluation does not establish final paginated export
parity. Photos/maps remain separately verified companion artifacts in the existing
review UI. Some captured notes still repeat similar facts across distinct records;
approximate matching does not silently delete them. Missing standard text,
calibration/procedure records and native structured units remain review items.

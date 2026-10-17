# Archived Report Evidence Routing Agent

Status: historical evaluation compatibility only. Do not use this subsystem for new
runs or new section agents.

`report-evidence-router` was the first shared preprocessing experiment between an
immutable Android export and per-section generation agents. It created atomic
evidence records, section/block uses, and one projection per selected section.

The router never writes report prose. Structured fields, checklist responses,
measurements and layout data follow deterministic rules. A model may propose voice
terminology and destinations, but the proposal cannot change source wording or enter
generation until it is reviewed. Unresolved evidence stays visible and blocks the
affected section.

The current workflow is owned by `../contents-classification-agent/`. Its exact
`contents-classification-evaluation-v1` release applies the input leakage guard,
Evidence Atomizer v5, closed-book classification, classification guard, authorized
human review, and isolated `section_evidence_package_v1` projection. Future section
generators must consume that package contract.

The immutable historical releases remain at [`releases/v1`](releases/v1/README.md)
and [`releases/v2`](releases/v2/README.md). Their paths and bytes remain unchanged so
saved TK5452 evaluations and manifest hashes can be reproduced. Registry resolution
rejects them by default; the saved historical workflow opts in with
`allowArchived: true`. Neither release is enabled for product traffic.

Android V3 now supplies the inspection-wide UT thickness unit at
`/unitProfile/thicknessUnit`. The planner resolves an explicit row `unitCode` or
`unit` first, then the package profile. Missing or conflicting declarations remain
blocked; `schemaVersion: 3` alone is not a unit declaration because earlier V3
packages may lack the field.

Run the focused archive-integrity audits with
`npm run report-evidence-router:v1:audit` and
`npm run report-evidence-router:v2:audit`. Passing them proves reproducibility only;
it does not reactivate this pipeline.

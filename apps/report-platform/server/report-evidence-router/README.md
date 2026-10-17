# Report Evidence Routing Agent

`report-evidence-router` is the shared preprocessing agent between an immutable
Android export and the per-section generation agents. It creates traceable atomic
evidence records, assigns zero or more reviewed section/block uses, and freezes one
projection per selected report section.

The router never writes report prose. Structured fields, checklist responses,
measurements and layout data follow deterministic rules. A model may propose voice
terminology and destinations, but the proposal cannot change source wording or enter
generation until it is reviewed. Unresolved evidence stays visible and blocks the
affected section.

The immutable first candidate remains at [`releases/v1`](releases/v1/README.md).
[`releases/v2`](releases/v2/README.md) is its evaluation successor and fixes
section-projection use isolation and routing-only readiness terminology. Exact
release identities are listed in [`release-registry.json`](release-registry.json);
neither release is enabled for product traffic.

Android V3 now supplies the inspection-wide UT thickness unit at
`/unitProfile/thicknessUnit`. The planner resolves an explicit row `unitCode` or
`unit` first, then the package profile. Missing or conflicting declarations remain
blocked; `schemaVersion: 3` alone is not a unit declaration because earlier V3
packages may lack the field.

Run the focused audits with `npm run report-evidence-router:v1:audit` and
`npm run report-evidence-router:v2:audit`.

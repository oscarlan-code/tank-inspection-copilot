# Report Evidence Routing Agent v2

Status: evaluation candidate. Product routing is disabled.

## Inputs

- one immutable canonical Android V3 export;
- authenticated report scope and exact ReportPlan section IDs;
- optional report-side confirmations;
- reviewed routing decisions created from the router review queue.

Historical reports and target gold are not runtime inputs. The approved terminology
and section-contract packs may help interpret voice wording, but cannot supply a
current fact.

## Outputs

- `evidence-ledger.json`: atomic evidence, source pointers, quality state and uses;
- `section-evidence-projections/<section-id>.json`: the only evidence supplied to a
  section generator;
- `routing-review.json`: unresolved records, explicit exclusions and section gates;
- `routing-manifest.json`: input/output hashes and exact release identity.

The executable wraps the existing canonical section planner and adds an immutable
release boundary, explicit dispositions, per-section projections and output hashes.
It does not alter the imported package. Voice media attachments are retained as
source provenance and excluded from report content because their transcript records
carry the routable evidence.

Android V3 exports the inspection-wide UT thickness unit at JSON Pointer
`/unitProfile/thicknessUnit`; the current app value is `mm`. Unit resolution is
explicit row `utMeasurements[].unitCode` or `utMeasurements[].unit` first, then
`unitProfile.thicknessUnit`. A missing or conflicting declaration remains a routing
blocker. The router never infers a unit from `schemaVersion`, numeric magnitude,
general-information text or report history.

Every projected evidence record contains only the `uses` for that projection's
section. The complete multi-section use list remains available in the evidence
ledger.

## Gate

A section projection is `routing_ready` only when its required uses contain no
unresolved classification issue. `routing_ready` describes the evidence-routing
stage only. It does not mean a SectionPlan is frozen, a section generator exists, a
draft passed pre-display review, or content is approved. Whole-job routing is ready
only when every retained record is routed or explicitly excluded and every selected
section is `routing_ready`. An unresolved unit, component, transcript,
recommendation or destination fails closed.

# Report Evidence Routing Agent v1

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

## Gate

A section projection is `ready` only when its required uses contain no unresolved
classification issue. Whole-job routing is ready only when every retained record is
routed or explicitly excluded and all selected sections are ready. An unresolved
unit, component, transcript, recommendation or destination fails closed.

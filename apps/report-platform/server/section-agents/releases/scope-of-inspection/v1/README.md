# Scope of Inspection v1

Status: `evaluation_candidate`; product disabled.

This release owns `1 SCOPE OF INSPECTION` for the
`vertical_tank_inspection_v1` profile. It converts a reviewed, structured scope
confirmation into the arrow-bullet layout used by the historical report corpus.
It never treats completed app tasks as proof of the commissioned scope.

The release is deterministic. It makes no model call and performs no runtime KB
retrieval. Historical reports were used offline to review the section shape,
ordering and wording pattern. They cannot add a current inspection activity.

## Control files

- `agent-instructions.md` — reviewer-readable operating rules.
- `agent-spec.json` — exact evidence and output contract.
- `section-pattern-pack.json` — frozen aggregate pattern metadata from the
  approved training split; it contains no current facts or copied report prose.
- `kb-policy.json` — explicit runtime retrieval boundary.
- `standard-obligation-pack.json` — scope-reporting boundary; standards cannot
  define the client-agreed scope.
- `harness.json` — contract tests and historical evaluation gates.
- `manifest.json` — hashes every release-owned file.

The upstream preprocessing step retains the practical inspector note, maps it to
structured scope claims, and requires confirmation. The agent sees those confirmed
claims. Historical gold sections remain evaluator-only and open after generation.

Run `npm run section-agent:scope:v1:audit` from `apps/report-platform`.

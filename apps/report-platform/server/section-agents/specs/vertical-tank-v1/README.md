# Vertical tank V1 common-core agent specifications

These seven folders define the same control surface for report sections 1–7. They
are reviewable specifications, not executable releases. Each folder contains:

- `agent-spec.json`: inputs, ordered output blocks, format, blockers, prohibited
  behavior, and generation mode;
- `kb-policy.json`: the section-owned historical/controlled knowledge lane and
  retrieval restrictions;
- `harness.json`: dataset separation, required tests, metrics, freeze gates, and
  product-promotion prohibition;
- `README.md`: a short guide to that section.

The folder number is the report section number. It is different from development
order. `03-general-tank-information` was the first section agent implemented; its
actual frozen evaluation release remains under
`server/section-agents/releases/general-tank-information/generator/v1/` and is not modified
by these specifications.

## Agent folders

| Report section | Folder | Status |
| ---: | --- | --- |
| 1 | `01-scope-of-inspection/` | Planned |
| 2 | `02-inspection-maintenance-regime/` | Planned; AI disabled |
| 3 | `03-general-tank-information/` | Frozen evaluation candidate reference |
| 4 | `04-inspection-report/` | Planned |
| 5 | `05-repair-recommendations/` | Planned |
| 6 | `06-test-information/` | Planned |
| 7 | `07-tank-inspection-checklist/` | Planned; AI disabled |

## KB split

The governed KB already stores historical sections by canonical `section_key`.
Each agent policy selects exactly its own key and requires a separately frozen pack
ID and hash. Scope, Inspection Report, Recommendations and Test Information may use
reviewed section patterns within their declared limits. Regime, General Information
and Checklist use controlled templates/definitions or explicit no-retrieval packs;
they never retrieve historical current values or responses.

The candidate inventory command writes private metadata-only pack manifests under
`.local/section-pattern-packs/`; it contains source IDs and hashes, not report text.
It is for source review only. A release pack must later be built from the governed
training index after vertical orientation review, with validation/hidden reports,
target lineage and near-duplicates excluded.

```bash
npm --prefix apps/report-platform run kb:common-core:split
npm --prefix apps/report-platform run section-agent:common-core:audit
```

## Harness control

Every harness freezes current inputs before generation, keeps expected report
content evaluator-only, checks the exact agent/KB/standard/renderer hashes, and
returns an unapproved draft. It evaluates current-evidence fidelity, historical
format alignment and standard obligations separately. Product eligibility is a
separate server-owned routing decision and is false for all seven specifications.

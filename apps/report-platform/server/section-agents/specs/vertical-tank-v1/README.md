# Vertical tank V1 common-core agent specifications

These seven folders define separate agent families for report sections 1–7. They
share lifecycle infrastructure, but they do not share prompts, output contracts or
section knowledge. Each folder contains:

- `agent-spec.json`: inputs, ordered output blocks, format, blockers, prohibited
  behavior, and generation mode;
- `generator-instructions.md`: the section-specific prompt or, for deterministic
  sections, an explicit instruction that no model call is allowed;
- `format-contract.json`: the exact block order and presentation family;
- `kb-policy.json`: the section-owned historical/controlled knowledge lane and
  retrieval restrictions;
- `reviewer-spec.json`: the pre-display guard, which cannot see gold output;
- `evaluator-spec.json`: the post-generation comparison against sealed gold;
- `harness.json`: dataset separation, required tests, metrics, freeze gates, and
  product-promotion prohibition;
- `README.md`: a short guide to that section.

`scaffold-registry.json` is the top-level inventory. It records development order,
generation strategy and whether a package-bound candidate exists. A scaffold is a
reviewable design; it is not executable until a candidate is created under
`server/section-agents/sandbox/candidates/<section-id>/candidate-*`.

See `WORKFLOW.md` for the classified-evidence generation example, atomic and
whole-section evaluation, and sandbox-to-release lifecycle. The machine-readable
rules are in `development-protocol.json`.

The folder number is the report section number. It is different from development
order. `03-general-tank-information` was the first section agent implemented; its
actual frozen evaluation release remains under
`server/section-agents/releases/general-tank-information/generator/v1/` and is not modified
by these specifications.

## Agent folders

| Report section | Folder | Status |
| ---: | --- | --- |
| 1 | `01-scope-of-inspection/` | Scaffold ready; package-bound candidate pending |
| 2 | `02-inspection-maintenance-regime/` | Scaffold ready; AI disabled |
| 3 | `03-general-tank-information/` | Package-bound Candidate A implemented in sandbox |
| 4 | `04-inspection-report/` | Scaffold ready; section-specific LLM prompt |
| 5 | `05-repair-recommendations/` | Scaffold ready; section-specific LLM prompt |
| 6 | `06-test-information/` | Scaffold ready; bounded wording prompt |
| 7 | `07-tank-inspection-checklist/` | Scaffold ready; AI disabled |

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

Development is sequential: create Candidate A for one section, run development,
validation, held-out and rendered human review, then freeze its exact bytes. Work
on the next section cannot mutate the frozen prompt, KB pack, renderer, reviewer or
evaluator of an earlier section.

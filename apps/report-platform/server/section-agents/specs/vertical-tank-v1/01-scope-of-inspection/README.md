# 1. Scope of Inspection agent

Status: scaffold ready; package-bound candidate pending; product disabled.

This agent compiles confirmed commissioned scope deterministically. The older V1
evaluation release remains immutable historical evidence, but it is not the active
candidate for the new `section_evidence_package_v1` handoff.

| File | Purpose |
| --- | --- |
| `agent-spec.json` | Input boundary, output blocks and blockers |
| `generator-instructions.md` | Section-specific deterministic generation instructions |
| `format-contract.json` | Scope bullet and optional-block layout |
| `kb-policy.json` | Section 1 historical-pattern boundary |
| `reviewer-spec.json` | Pre-display checks without gold access |
| `evaluator-spec.json` | Post-generation scope-obligation comparison |
| `harness.json` | Dataset, robustness and freeze gates |

Next step: build Candidate A against reviewed Scope packages, then run development,
validation, held-out and rendered human review before freezing a release.

# 5. Repair Recommendations / API 653 Assessment agent

Status: scaffold ready; product disabled.

This agent composes wording only after an action is linked to a current observation
and approved by the inspector. Historical cases are precedents with applicability
conditions; they cannot approve or justify the current action by themselves.

| File | Purpose |
| --- | --- |
| `agent-spec.json` | Approved-action input and blocker contract |
| `generator-instructions.md` | Section 5 action-composition prompt |
| `format-contract.json` | Component-action and basis layout |
| `kb-policy.json` | Historical recommendation-case boundary |
| `reviewer-spec.json` | Pre-display action and applicability checks |
| `evaluator-spec.json` | Observation-action pair evaluation |
| `harness.json` | Dataset and freeze gates |

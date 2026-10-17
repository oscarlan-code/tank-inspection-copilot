# 2. Inspection and Maintenance Regime agent

Status: scaffold ready; product disabled.

This is a controlled-template agent. AI is disabled. It verifies the approved
template revision and renders only declared, supported substitutions.

| File | Purpose |
| --- | --- |
| `agent-spec.json` | Input boundary, template blocks and blockers |
| `generator-instructions.md` | Deterministic template instructions |
| `format-contract.json` | Controlled paragraph and substitution layout |
| `kb-policy.json` | Approved template-pack boundary |
| `reviewer-spec.json` | Template-integrity pre-display checks |
| `evaluator-spec.json` | Post-generation template and field comparison |
| `harness.json` | Dataset and freeze gates |

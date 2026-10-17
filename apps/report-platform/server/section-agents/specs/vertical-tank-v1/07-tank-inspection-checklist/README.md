# 7. Tank Inspection Checklist agent

Status: scaffold ready; product disabled.

This deterministic agent renders the exact app-owned checklist definition and
responses. AI is disabled.

| File | Purpose |
| --- | --- |
| `agent-spec.json` | Checklist inputs, blocks and blockers |
| `generator-instructions.md` | Deterministic grid instructions |
| `format-contract.json` | Native category and item layout |
| `kb-policy.json` | Checklist-definition pack boundary |
| `reviewer-spec.json` | Pre-display completeness and integrity checks |
| `evaluator-spec.json` | Item-level response comparison |
| `harness.json` | Dataset and freeze gates |

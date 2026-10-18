# 3. General Tank Information agent

Status: package-bound Candidate B implemented in sandbox; not qualified or promoted.

This deterministic agent is the first implementation on the current
`section_evidence_package_v1` handoff. Older V1–V3 releases remain immutable
historical evidence and are not active in the rebuilt workflow.

| File | Purpose |
| --- | --- |
| `agent-spec.json` | Input boundary, field blocks and blockers |
| `generator-instructions.md` | Section-specific deterministic instructions |
| `format-contract.json` | 31 body fields, header metadata and support fields |
| `kb-policy.json` | Frozen structure-only knowledge boundary |
| `reviewer-spec.json` | Pre-display field and unit checks |
| `evaluator-spec.json` | Post-generation atomic and whole-section comparison |
| `harness.json` | 10+1 and held-out qualification gates |

Executable candidate: `../../../sandbox/candidates/general-tank-information/candidate-b/`.

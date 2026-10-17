# 4. Inspection Report agent

Status: scaffold ready; product disabled.

This agent writes component findings. Deterministic code owns block selection,
ordering, values and units; a version-pinned LLM may compose evidence-bound prose.

| File | Purpose |
| --- | --- |
| `agent-spec.json` | Component blocks, inputs and prohibited behavior |
| `generator-instructions.md` | Section 4 evidence-bound prompt |
| `format-contract.json` | Component-block layout and order |
| `kb-policy.json` | Multi-report structure and terminology knowledge boundary |
| `reviewer-spec.json` | Pre-display claim and integrity checks |
| `evaluator-spec.json` | Atomic-finding comparison and robustness metrics |
| `harness.json` | Two-track evaluation and bounded iteration controls |

Generation remains blocked until the disjoint knowledge bundle, reviewed source
inventory, complete mock export and target-blind SectionPlan pass qualification.

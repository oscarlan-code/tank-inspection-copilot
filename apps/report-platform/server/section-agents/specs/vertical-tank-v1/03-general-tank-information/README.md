# 3. General Tank Information agent

Status: `frozen_evaluation_candidate`; product disabled.

This was the first section agent implemented, although it is report section 3. The
folder gives it the same specification view as the other common-core agents without
changing the frozen release.

## Specification view

- [agent-spec.json](agent-spec.json): deterministic 31-field output contract.
- [kb-policy.json](kb-policy.json): frozen no-retrieval policy.
- [harness.json](harness.json): required behavior, isolation and freeze gates.

## Executable release controls

- [frozen manifest](../../../releases/general-tank-information/v1/manifest.json): entry point, status, dependency versions and hashes.
- [frozen KB policy](../../../releases/general-tank-information/v1/kb-policy.json): no runtime retrieval and no historical current facts.
- [qualification receipt](../../../releases/general-tank-information/v1/validation-summary.json): 10 development reports plus one previously held-out report.
- [behavior audit](../../../../scripts/audit-general-information-agent.mjs): missing/conflicting facts, units, history, markup, hidden-reference invariance and approval blocking.
- [release-isolation audit](../../../../scripts/audit-section-agent-release.mjs): manifest hash, dependency graph, tamper rejection, version routing and cross-agent isolation.
- [evaluation runner](../../../../scripts/run-general-information-evaluation.mjs): freezes inputs, runs generation before opening expected content, scores fields and renders DOCX.
- [evaluation evidence](../../../../../docs/reviews/data/general-tank-information-v1/): cohort, frozen inputs, evaluator-only expected data, results and rendered exports.

A new serving-capable successor must use the new ReportPlan/SectionPlan interface and
prove parity. The existing frozen files remain unchanged.

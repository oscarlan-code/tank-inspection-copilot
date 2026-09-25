# General Tank Information v2

Status: `evaluation_candidate`; product disabled.

This is the first release using the rebuilt ReportPlan and exact registry route. It
renders the report's `3 GENERAL TANK INFORMATION` section as 31 ordered labelled
fields. The compiler is deterministic: it makes no model call and performs no
runtime KB retrieval.

## Review the agent

- [agent-instructions.md](agent-instructions.md) — executable behavior and safety rules in reviewer-readable form.
- [agent-spec.json](agent-spec.json) — input, field order, layout and output contract.
- [kb-policy.json](kb-policy.json) — explicit no-retrieval policy and historical-data boundary.
- [standard-obligation-pack.json](standard-obligation-pack.json) — explicit statement that this identity section has no technical acceptance-rule generation.
- [harness.json](harness.json) — contract checks, historical qualification method and freeze gates.
- [manifest.json](manifest.json) — exact entry point and SHA-256 pins for every release-owned file.

The platform binding is implemented by the
[minimum ReportPlan](../../../../report-plans/minimum-report-plan.mjs) and the
[exact release registry](../../../index.mjs).

The runtime entry point receives only a frozen `section_agent_execution_v1`
envelope. Historical report pages and expected ledgers are evaluator-only and open
after generation. Outputs are always unapproved and require inspector review.

Qualification uses ten historical development reports followed by one separately
held-out report. Private source-derived comparisons live under
`docs/reviews/data/general-tank-information-v2-historical/` and remain outside Git.
The repository keeps one small generic fixture only for contract and blocker tests;
it is not presented as report-quality validation.

## What the KB does here

Historical reports informed the reviewed 31-field order and paired-row report
format during development. They are not queried at runtime and cannot fill a fact
about the current tank. Confirmed same-asset history may enter only through the
report-side evidence lane with matching client, tank number and location.

Run `npm run section-agent:general-info:v2:audit` from `apps/report-platform`.

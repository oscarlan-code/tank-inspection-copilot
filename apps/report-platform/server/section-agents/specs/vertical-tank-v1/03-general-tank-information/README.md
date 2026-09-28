# 3. General Tank Information agent

Status: `frozen_evaluation_candidate`; product disabled. V2 is the current candidate;
V1 remains immutable qualification evidence.

This was the first section agent implemented, although it is report section 3. The
folder gives it the same specification view as the other common-core agents without
changing the frozen release.

## Specification view

- [agent-spec.json](agent-spec.json): deterministic 31-field output contract and V2 release reference.
- [kb-policy.json](kb-policy.json): frozen no-runtime-retrieval policy.
- [harness.json](harness.json): required behavior, historical split and freeze gates.

## Executable release controls

- [V2 release](../../../releases/general-tank-information/generator/v2/README.md): instructions, spec, KB, standard-pack decision and harness.
- [V2 manifest](../../../releases/general-tank-information/generator/v2/manifest.json): exact entry point and file hashes.
- [V2 contract audit](../../../../scripts/audit-general-information-v2.mjs): ReportPlan/SectionPlan binding, blockers, isolation and v1 regression.
- [V2 historical audit](../../../../scripts/audit-general-information-v2-historical.mjs): ten development reports followed by one frozen held-out report.
- [V1 release](../../../releases/general-tank-information/generator/v1/manifest.json): earlier 10+1 qualification evidence; never modify it.

V2 now uses the minimum ReportPlan/SectionPlan interface. Product use still requires
durable plan storage, promotion routing, persistence, integration and canary review.

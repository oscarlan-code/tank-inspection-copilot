# 1. Scope of Inspection agent

Status: `frozen_evaluation_candidate`; product disabled.

This specification view points to the executable v1 release. It is no longer a
planned prompt/retrieval design.

## Files to review

| File | Control |
| --- | --- |
| [agent-spec.json](agent-spec.json) | Authorized evidence, ordered output blocks, report format, blockers and prohibited claims |
| [kb-policy.json](kb-policy.json) | Exact `scope-of-inspection` KB lane, allowed pattern uses and leakage exclusions |
| [harness.json](harness.json) | Dataset isolation, required tests, metrics and freeze gates |
| [private pack candidate](../../../../../.local/section-pattern-packs/vertical-tank-common-core-v1/01-scope-of-inspection/pack-candidate.json) | Metadata-only candidate membership for source review; not a runtime pack |

## Executable release controls

- [V1 release](../../../releases/scope-of-inspection/v1/README.md): instructions,
  spec, historical-pattern boundary, standard boundary and harness.
- [V1 manifest](../../../releases/scope-of-inspection/v1/manifest.json): exact entry
  point and file hashes.
- [Contract audit](../../../../scripts/audit-scope-of-inspection-v1.mjs): plan
  binding, input boundary, blockers, isolation and General Information regression.
- [Historical audit](../../../../scripts/audit-scope-of-inspection-v1-historical.mjs):
  ten development reports followed by one validation-split report.

## What the agent will produce

1. the exact section heading;
2. compact confirmed inspection context selected by the profile;
3. one arrow bullet for each commissioned activity, component and coverage rule;
4. confirmed methods and deliverables;
5. access, safety, surface, coverage limitations and explicit exclusions;
6. approved procedure references when required.

Findings, acceptance decisions and repair recommendations are blocked from this
section. Historical examples may guide structure, cadence, terminology and format;
they cannot supply the current scope.

## Harness control

```text
frozen current evidence + reviewed SectionPlan
  -> exact agent/version resolution
  -> frozen offline pattern metadata with lineage/gold exclusions
  -> deterministic block compiler
  -> claim, obligation, identity, leakage and format validators
  -> unapproved SectionDocument
  -> open evaluator-only expected content
  -> held-out metrics + rendered review
  -> freeze code/prompt/KB/standard/renderer hashes
```

The harness rejects the run for the wrong section/version, production execution,
missing agreed scope, unsupported scope claims, target-lineage retrieval, changed KB
or dependency hashes, or any attempt to approve/promote its own output.

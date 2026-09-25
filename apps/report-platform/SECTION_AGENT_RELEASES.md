# Section Generation Agent releases

## Status

Every generated section uses one explicit immutable release. Only **General Tank
Information** has an implemented evaluation candidate. All other section agents,
the new serving interface, and product routing remain future work.

The previous shared generator is legacy and is never a fallback or extension point.

The reviewable common-core specifications for report sections 1–7 live under
`server/section-agents/specs/vertical-tank-v1/`. Every folder has the same
`agent-spec.json`, `kb-policy.json`, and `harness.json` control files. These files
define planned releases; only the General Tank Information release is executable.

## Release contract

A release owns or hash-pins:

- agent ID/version, supported report profiles and section instances;
- input schema, evidence/entity vocabulary, applicability, and missing-input rules;
- outline, ordered blocks, format, output obligations, and protected fields;
- deterministic compilers/tools and optional bounded prompt/model;
- historical `SectionPatternPack` and applicable `StandardObligationPack`;
- fact, relationship, structure, standard, leakage, and export validators;
- formatter/renderer interfaces and complete dependency hashes;
- qualification cohort/splits, metrics, inspector/render review, limitations, and
  manifest hash.

Gold and evaluator labels are never runtime inputs. No mutable global prompt, KB,
standard pack, dependency, or `latest` release is allowed.

## Execution

The Report Structure Agent binds every selected section instance to an exact
release in the ReportPlan. The release receives its frozen SectionPlan, authorized
current evidence/confirmed inputs, historical pattern pack, standard-obligation
subset, and declared tools. It returns a typed SectionDocument, validations, trace,
and unapproved draft.

Agents do not use another agent's prose as evidence. Cross-section content uses
original evidence or approved typed outputs.

Each release must pass independently:

- **current-evidence fidelity**;
- **historical-report alignment** for compatible structure and presentation;
- **technical-standard alignment** for the pinned applicable edition.

Historical practice cannot override the standard or supply current facts. Standards
cannot supply missing inspection evidence.

## Immutability and isolation

- Never edit `releases/<section>/<version>/` after freeze.
- Any behavior, prompt, pack, standard, outline, format, validator, dependency, or
  compatibility change creates a new version.
- Shared dependencies are release-local or content-addressed and hash-pinned.
- Registry resolution is exact; unknown or unavailable bindings fail closed.
- Repeated instances may share an agent family only when the full contract matches,
  and each binding remains explicit.
- A later agent or shared-library change cannot alter an earlier release.

## Lifecycle

```text
development -> frozen_candidate -> qualified_candidate
            -> product_canary -> product_active -> retired
```

R&D and product run the same frozen bytes. R&D writes evaluation artifacts after
opening sealed expectations. Product saves an unapproved draft. Promotion creates
an audited server-owned routing record to an already-qualified manifest hash;
rollback changes that pointer and preserves drafts/traces.

## General Tank Information v1

| Item | Frozen result |
| --- | --- |
| Title/output | `3 GENERAL TANK INFORMATION`; 31 labelled fields and optional previous history |
| Inputs | Seven native fields plus up to 24 confirmed source-referenced report-side fields |
| Generation | Deterministic; no model or runtime retrieval |
| Qualification | 310/310 development fields, 31/31 previously held-out fields, 16 behavior checks |
| Safety | Missing stays missing; conflicts/critical gaps block; output remains unapproved |
| Status | Frozen evaluation candidate; product disabled |

The current v1 wrapper still enters through the legacy entry point and lacks the new
structured standard pack. Keep it immutable as evidence. Build a successor on the
new ReportPlan/SectionPlan interface and prove identical output before extending it.

## Adding the next agent

1. Confirm the ReportPlan section and supported report families.
2. Review all compatible historical sections and freeze a pattern pack.
3. Review the applicable standard/edition and freeze a separate obligation pack.
4. Define evidence, entities, outline, format, tools, narrative slots, blockers, and
   validators before writing prompts.
5. Implement portable synthetic tests and authorized source-reviewed cases.
6. Freeze, then evaluate unchanged on validation and held-out lineage groups.
7. Record all three gates, unsupported claims, rendered output, inspector review,
   hashes, and limitations.
8. Add exact registry routing and rerun prior-agent regressions.
9. Keep evaluation-only until separate product qualification and canary approval.

Finishing one agent does not authorize incomplete full-report generation. Missing
agents keep their sections blocked.

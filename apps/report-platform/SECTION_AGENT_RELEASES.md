# Section Generation Agent releases

## Status

Every generated section uses one explicit immutable release. **Scope of Inspection
and General Tank Information** now have implemented agent families. Scope v1 and
General Information v3 are historical routed ReportPlan evaluation candidates;
General Information v1 is frozen qualification evidence. They predate the current
`section_evidence_package_v1` input. All future generator releases must bind that
reviewed package contract. All other section agents, durable plan storage, report
integration, and product routing remain future work.

The previous shared generator is legacy and is never a fallback or extension point.

The two existing frozen families were qualified before the shared
`SectionKnowledgeBundle` projection contract was introduced. Keep their historical
releases immutable. They are not proof that structure planning, mock preparation,
generation, pre-display review, and gold evaluation all use the new bundle. Adopting
that contract requires a new release version and fresh qualification; Section 4 is
the first planned trial.

The reviewable common-core specifications for report sections 1–7 live under
`server/section-agents/specs/vertical-tank-v1/`. Every folder has the same
`agent-spec.json`, `kb-policy.json`, and `harness.json` control files. These files
define planned releases; Scope of Inspection and General Tank Information are
executable.

## Release contract

Every agent role also produces one immutable execution-configuration snapshot. It records the exact release manifest, Git commit, model provider/ID/version and settings hash, prompt ID/version/content hash, knowledge snapshots, schema bindings and evaluator rubric. Deterministic roles record model and prompt as explicitly disabled. Changing any item creates a new configuration hash and experiment candidate.

A release owns or hash-pins:

- agent ID/version, supported report profiles and section instances;
- input schema, evidence/entity vocabulary, applicability, and missing-input rules;
- outline, ordered blocks, format, output obligations, and protected fields;
- deterministic compilers/tools and optional bounded prompt/model;
- one multi-report `SectionKnowledgeBundle` that pins the historical `SectionPatternPack` and role projections, plus an applicable `StandardObligationPack`;
- fact, relationship, structure, standard, leakage, and export validators;
- formatter/renderer interfaces and complete dependency hashes;
- qualification cohort/splits, metrics, inspector/render review, limitations, and
  manifest hash.

Gold and evaluator labels are never runtime inputs. Planning, mock preparation,
generation, pre-display review, and post-generation evaluation use role-specific
projections from the same SectionKnowledgeBundle ID and hash. The target report and
its exact structure are excluded from planning, mock preparation, generation, and
pre-display review. No mutable global prompt, KB, standard pack, dependency, or
`latest` release is allowed. Every generator release
must resolve to one exact immutable pre-display reviewer release before its draft can
be shown. The reviewer receives current evidence and generated output but no gold;
passing permits review and never grants approval.

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
- **historical-report alignment** measured as generic KB pattern conformance for
  compatible structure, accepted variation and presentation;
- **target-report recovery** as a separate post-generation evaluation dimension;
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

## General Tank Information v1–v3

| Item | Frozen result |
| --- | --- |
| Title/output | `3 GENERAL TANK INFORMATION`; 31 labelled fields and optional previous history |
| Inputs | Seven native fields plus up to 24 confirmed source-referenced report-side fields |
| Generation | Deterministic; no model or runtime retrieval |
| Qualification | 310/310 development fields, 31/31 previously held-out fields, 16 behavior checks |
| Safety | Missing stays missing; conflicts/critical gaps block; output remains unapproved |
| Status | Frozen evaluation candidate; product disabled |

Keep v1 immutable as evidence. V2 adds the minimum reviewed ReportPlan, frozen
SectionPlan, exact registry binding, explicit standard-pack decision, visible agent
instructions and a lean contract harness. Qualification used ten historical
development reports before freezing the
development decision, followed by one different held-out report. V2 preserved
341/341 fields and matched the required title, order and paired-field structure in
11/11 cases. The original sections were evaluator-only. Actual-device and independent
inspector validation remain open gates. V2 remains evaluation-only; this is not
product promotion.

V3 consumes the reviewed router-v2 section projection and explicitly dispositions
all 43 projected records in the TK5452 case: 31 rendered, three corroborating, and
nine delegated. It has exact reviewer-v2 and evaluator-v2 bindings and is retained
for historical evaluation compatibility after the router archive. It must not be
copied as the input architecture for a new generator release. It remains
evaluation-only.

## Scope of Inspection v1

| Item | Frozen result |
| --- | --- |
| Title/output | `1 SCOPE OF INSPECTION`; one reviewed arrow bullet per confirmed activity/deliverable, followed by explicit limitations/exclusions |
| Inputs | Android V3 package plus a confirmed, source-referenced `scope_confirmation_v1` record |
| Generation | Deterministic; no model or runtime retrieval |
| Historical basis | 52 approved training sections, 32 normalized shapes, three report families; content excluded from runtime |
| 10+1 evaluation | 81/81 confirmed claims and 52/52 protected concepts recovered; 11/11 format-aligned |
| Safety | Completed tasks, historical frequency, and standards cannot silently create current scope |
| Status | Frozen evaluation candidate; product disabled |

The 10+1 cases reconstruct practical inspector notes and structured confirmations
from ten training reports, then one validation-split report. Original report text is
opened only after generation. This validates the section compiler after confirmed
classification. It does not yet validate automated note-to-claim preprocessing,
actual-device export, rendered inspector acceptance, or product behavior.

## Adding the next agent

1. Confirm the ReportPlan section and supported report families.
2. Review all compatible historical sections and freeze a pattern pack.
3. Review the applicable standard/edition and freeze a separate obligation pack.
4. Define evidence, entities, outline, format, tools, narrative slots, blockers, and
   validators before writing prompts.
5. Implement minimal contract tests and authorized source-reviewed historical cases.
6. Freeze, then evaluate unchanged on validation and held-out lineage groups.
7. Record all three gates, unsupported claims, rendered output, inspector review,
   hashes, and limitations.
8. Add exact generator, pre-display reviewer and post-generation gold-evaluator
   registry routing; rerun prior-agent regressions.
9. Verify that blocked reviews hide the user-facing draft and that the sealed gold
   opens only after generation.
10. Record router, plan, generator, reviewer, evaluator, evidence-accountability,
    and control-boundary spans through the shared all-agent monitoring contract.
11. Keep evaluation-only until separate product qualification and canary approval.

Finishing one agent does not authorize incomplete full-report generation. Missing
agents keep their sections blocked.

# Report generation agent architecture

## Authority and current status

This document defines the new report-generation agent hierarchy. It replaces the
previous design based on one shared generator and a collection of loosely named
agent roles. The previous generator is legacy and is not the implementation base or
fallback for this architecture.

Only **General Tank Information** has a frozen section-agent implementation today.
It remains an evaluation candidate. The Report Structure Agent, the new end-to-end
orchestrator, product routing, and every other section agent still need to be built.

Use these companion contracts:

- `REPORT_COMPILER_WORKFLOW.md` for the end-to-end data and generation pipeline;
- `SECTION_AGENT_RELEASES.md` for immutable section releases and promotion;
- `PRECEDENT_KB_ARCHITECTURE.md` for historical-report knowledge;
- `EVAL_SYSTEM.md` for R&D evaluation and product qualification.

## Agent hierarchy

```text
Report Structure Agent
  -> selects the report blueprint and applicable standard obligation pack
  -> creates the ordered table of contents and ReportPlan
  -> binds every section instance to an explicit section-agent release
       -> General Tank Information Agent
       -> Scope Agent                         [future]
       -> Inspection Report Agent             [future]
       -> Measurement / layout agents         [future]
       -> Recommendation / assessment agents  [future]
       -> other applicable section agents     [future]
  -> Report Integrator validates cross-section completeness and references
  -> inspector reviews and approves
  -> deterministic renderers create the selected report artifact
```

The hierarchy has one planning agent and many bounded section agents. It is not a
network of autonomous chatbots. An agent is a versioned compiler/configuration
bundle; deterministic sections do not call an LLM.

## 1. Report Structure Agent

The Report Structure Agent owns the report's main structure. It does not write
section content and cannot invent current-inspection facts.

Inputs:

- authenticated report job and immutable app-export revision;
- confirmed inspection scope, asset configuration, and report-side inputs;
- evidence inventory and unresolved applicability;
- approved historical `ReportBlueprintPack` from the report KB;
- pinned applicable API/technical-standard `StandardObligationPack`;
- available section-agent registry with exact release hashes.

Output: an immutable `ReportPlan` containing:

- report family/profile and blueprint version;
- governing standard and edition or an explicit unresolved-standard blocker;
- ordered section instances, numbers, titles, and table of contents;
- applicability decision and basis for every selected or omitted section;
- exact section-agent ID, version, and manifest hash for every selected section;
- section dependencies, cross-references, repeated instances, and output order;
- required inputs, standard obligations, missing information, and review issues;
- historical blueprint, standard-pack, registry, and planning hashes.

The agent may use bounded model assistance to compare report families or explain an
ambiguous scope. Deterministic rules validate the final plan. An inspector must
confirm material ambiguity. A missing required section agent blocks that section;
the system does not call the legacy generator.

### Structure decision order

1. Verify identity, inspection type, asset configuration, agreed scope, and code
   basis from current evidence or confirmed report-side input.
2. Retrieve compatible historical report blueprints and section-frequency/layout
   patterns. Historical frequency is evidence of reporting practice, not a code
   requirement.
3. Load the applicable API-standard obligations for the pinned edition. A standard
   obligation overrides a conflicting historical omission or obsolete pattern.
4. Select a reviewed report blueprint and instantiate applicable, repeated, and
   conditional sections.
5. Confirm that every section has a qualified agent release and all required input
   adapters. Otherwise mark the plan blocked or incomplete.
6. Persist the plan for review before content generation.

## 2. Evidence preparation services

These are shared deterministic platform services, not section agents:

- validate and pin the app export;
- normalize fields, measurements, checklists, geometry, findings, photos, audio,
  attachments, and report-side confirmations without flattening them;
- transcribe voice while preserving audio and raw wording;
- resolve component/entity identity and retain uncertainty;
- classify one evidence record into one or more justified section uses;
- expose ambiguous or unassigned evidence for inspector review;
- create a content-addressed evidence snapshot and one `SectionPlan` per section.

The app owns capture context. The backend owns report-section assignment. A section
agent receives only its authorized plan, evidence, knowledge packs, and tools.

## 3. Section Generation Agents

Each selected section instance resolves to one explicit immutable release. A
release owns or pins:

- supported section IDs, profiles, and instance parameters;
- required/current evidence and missing-input behavior;
- section outline, output obligations, and presentation format;
- deterministic compilers and optional constrained narrative prompt;
- historical `SectionPatternPack` and terminology/case policy;
- applicable `StandardObligationPack` subset;
- validators, formatter/renderer contracts, and dependency hashes.

The output is a typed `SectionDocument`, not arbitrary HTML:

- deterministic protected fields, tables, calculations, figures, and references;
- bounded narrative segments linked to source evidence;
- fulfilled/unfulfilled historical-format and standard obligations;
- unsupported-claim, conflict, missing-input, and human-review issues;
- a complete generation trace and an unapproved draft.

Repeated section instances may share an agent family only when their contracts are
identical. Their section/instance bindings remain explicit. Agents never read one
another's prose as source truth; cross-section summaries use original evidence or
approved typed outputs.

## 4. Knowledge and standard contracts

Every agent must satisfy three separate authorities:

| Authority | What it controls | What it cannot do |
| --- | --- | --- |
| Current inspection evidence | Asset facts, observations, measurements, scope, photos, and inspector confirmations | Cannot be replaced by precedent or a standard example |
| Historical report KB | Report family, section order, section structures, terminology, formatting, and conditional precedent patterns | Cannot supply current facts, prove technical acceptability, or expose same-case gold |
| API/technical standard pack | Applicable obligations, methods, calculation rules, acceptance-review prompts, clause/edition provenance | Cannot invent evidence, assert compliance from missing inputs, or silently choose an edition |

If historical practice conflicts with the pinned standard, the standard obligation
wins and the historical blueprint is flagged for review. If current evidence is
missing, the output stays incomplete; neither KB fills the gap.

Historical and standards retrieval are separate. Each returns structured,
source-linked packs with approved summaries and minimum necessary passages. Raw PDFs
and unrestricted search results are never sent to a section agent.

## 5. Report Integrator

The Report Integrator is a deterministic report-wide validator and assembler. It:

- verifies each selected section matches the ReportPlan and release hash;
- checks table-of-contents order, numbering, headings, dependencies, and references;
- checks that applicable standard obligations are fulfilled or visibly unresolved;
- detects duplicated/conflicting protected facts across sections;
- composes one semantic `ReportDocument` from typed section documents;
- keeps evidence/provenance in the review UI rather than appending a raw evidence
  appendix to the customer report;
- permits export only from the exact selected, approved document snapshot.

The integrator does not rewrite technical content. A conflict returns to the owning
section agent or inspector.

## 6. Product and R&D execution

Product and R&D use the same Report Structure Agent release, section-agent releases,
knowledge snapshots, evidence adapters, validators, integrator, and renderers.

```text
shared generation pipeline
  -> R&D sink: sealed gold becomes visible, metrics and comparison UI only
  -> Product sink: unapproved draft, inspector edit/approval, selected export
```

Evaluation cannot write product drafts or promotion state. Product cannot read gold.
Promotion points a server-owned routing record at an already-qualified release hash;
it never edits or rebuilds the evaluated artifact.

## 7. Deterministic and AI boundaries

Deterministic code owns identity, values, units, relationships, calculations, table
cells, maps, photographs, section numbering, provenance, validation, approval, and
rendering. LLM use is limited to:

- proposing a report-family/structure choice when deterministic classification is
  ambiguous, subject to validation and confirmation;
- interpreting varied inspector wording while preserving the original span;
- drafting evidence-bound narrative slots;
- proposing recommendations with precedent applicability and missing-information
  statements, subject to inspector/engineering review.

The LLM cannot create measurements, change component identity, select a standard
edition, declare compliance, approve content, select a product release, or modify a
frozen KB/release.

## 8. Rebuild sequence

1. Freeze the previous generator: no new section logic, prompts, or product features.
   Retain it only for historical comparisons until cutover evidence permits removal.
2. Define schemas for `ReportBlueprintPack`, `StandardObligationPack`, `ReportPlan`,
   `SectionPlan`, `SectionDocument`, and generation traces.
3. Build the Report Structure Agent and review UI with no content generation.
4. Port General Tank Information to the new interface without changing its verified
   output; create a new release and demonstrate parity with the frozen v1 candidate.
5. Implement later section agents one at a time, using section-specific historical
   and standard packs and held-out evaluation.
6. Build the Report Integrator and browser/DOCX renderers over typed documents.
7. Run complete report shadow evaluations, inspector review, security/load checks,
   product canary, and rollback tests.
8. Cut product routing to the new pipeline and remove the previous generator only
   after historical drafts remain readable and rollback artifacts are preserved.

No legacy-generator fallback is allowed in the new pipeline. An unavailable agent,
input, standard pack, or renderer produces a clear blocked state.

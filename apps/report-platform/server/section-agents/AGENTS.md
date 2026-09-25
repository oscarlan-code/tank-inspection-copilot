# Runtime Section Generation Agents

This directory contains deployable Section Generation Agent artifacts. These are
runtime components, distinct from Codex development roles in `docs/agents/`.
Follow the parent `apps/report-platform/AGENTS.md` and
`apps/report-platform/SECTION_AGENT_RELEASES.md` first.

## One section, one explicit release

Every generated section ID resolves through the server-owned registry to one exact
agent version. Repeated section instances may share an agent family only when their
input, output, prompt, KB, validation, and presentation contracts are identical;
the mapping must still be explicit for every section ID and report profile.

Never use an implicit default, fuzzy section match, or `latest` alias. Unknown
section/version/profile combinations fail closed.

The previous shared generator is not a fallback. Do not add releases by adding
branches, prompts, templates, or retrieval behavior to `server/generation.mjs`.

## Release ownership

A release owns or hash-pins:

- supported section IDs and report profiles
- input schema, evidence roles, applicability, and missing-input rules
- outline, output obligations, section format, and protected structured fields
- deterministic compilers and optional bounded narrative prompt
- section-specific terminology and KB policy/snapshot, including an explicit
  no-retrieval policy when history is unnecessary
- approved historical SectionPatternPack and pinned applicable
  StandardObligationPack subset, with separate provenance and conflict handling
- output validators, model/provider constraints, and dependency versions
- release manifest, content hashes, qualification summary, and compatibility

The platform owns authorization, tenant/workspace scope, immutable imports,
evidence classification, registry selection, persistence, approval, rollout,
rollback, and report-wide assembly. A release must not read an arbitrary global KB,
choose its own version, persist approval, or enable itself for product traffic.

## Product and R&D parity

Evaluation and product call the same registry and frozen artifact. Evaluation uses
a sealed case, records metrics after generation, and cannot write product drafts or
promotion state. Product uses an authenticated report job and persists an unapproved
draft for inspector review. Hidden gold and evaluator labels never enter either
agent input.

Promotion is a separate server-owned routing decision referring to the already
evaluated release hash. Do not modify a release manifest to promote it. Rollback
changes the product routing pointer and preserves prior drafts and audit history.

The `general_tank_information_v1` manifest predates the ReportPlan execution route
and remains immutable qualification evidence. `general_tank_information_v2` is its
ReportPlan-bound evaluation successor. It is still product-disabled; product use
requires the separate promotion registry and canary controls.

## Adding or refining an agent

1. Define the section contract, evidence availability, outline, format, required
   outputs, applicability, and missing-input behavior before authoring a prompt.
2. Confirm the owning ReportPlan section definition, historical-report pattern pack,
   applicable API/technical standard edition, and standard obligations.
3. Reuse new-pipeline interfaces. Copy or content-address/hash-pin every dependency
   needed for release isolation; a future edit to shared code must not alter an
   earlier release.
4. Pin a section-specific KB snapshot or an explicit no-retrieval policy. Preserve
   original notes and normalized terminology. Never use historical prose as current
   facts or expose same-case/near-duplicate gold.
5. Run development cases, freeze the complete artifact, then evaluate unchanged on
   validation and genuinely held-out lineage groups. Keep gold outside generation.
6. Add an explicit registry entry and compatibility tests. Rerun regression tests
   for every already-frozen release.
7. Record fact preservation, semantic coverage, historical pattern alignment,
   applicable standard-obligation coverage, unsupported claims, format/export
   readiness, inspector review, hashes, and known limits separately.
8. Leave the release as a candidate until a distinct promotion review authorizes a
   product routing record. Do not enable product traffic from app-supplied flags.

Never edit an existing `releases/<section>/<version>/` directory. Corrections create
a new version. Shared platform improvements may be adopted only by a new release or
by an already-pinned content-addressed dependency with the same verified hash.

## Required checks

Each agent needs a minimal public contract test plus authorized historical replay
where applicable. Contract tests must cover wrong section/version, production eligibility,
missing and conflicting evidence, protected fact preservation, KB isolation,
dependency tampering, hidden-gold exclusion, unapproved output, and cross-agent
regression. Narrative agents also need varied inspector-language and unsupported-
claim tests. Formatting changes require actual rendered export review.

Run the section's audit and the standard report-platform guardrails. Do not report a
legacy 32-section aggregate score as the new section agent's result.

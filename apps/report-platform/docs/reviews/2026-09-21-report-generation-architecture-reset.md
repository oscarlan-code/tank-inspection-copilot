# Report-generation architecture reset review

Date: 21 September 2026
Status: architecture review and cleanup decision; no product promotion

## Decision

Rebuild report generation around one reviewed ReportPlan and independent immutable
Section Generation Agents. Do not extend or fall back to the previous shared
generator.

```text
immutable app import
  -> canonical evidence and entities
  -> historical ReportBlueprintPack + applicable StandardObligationPack
  -> Report Structure Agent
  -> reviewed immutable ReportPlan and table of contents
  -> evidence classification and frozen SectionPlans
  -> exact section-agent releases
  -> evidence / historical-pattern / standard validation
  -> deterministic Report Integrator
  -> inspector review and approved export
```

Historical reports and technical standards serve different purposes. Historical
reports establish compatible reporting practice. The applicable standard and
edition establish technical/reporting obligations. Neither supplies current
inspection facts.

## Main correction

`API_STANDARD_REPORT_TOC` and the related 32-section outline are derived from one
historical vertical-AST report family. API 653 does not prescribe that exact table
of contents. The profile remains useful for legacy comparison and historical KB
evidence, but it is not the structure authority for the rebuilt pipeline.

The all-KB review found 25 reusable template candidates across nine report profiles.
Those candidates are broader historical evidence, not one mandatory outline and not
25 implemented agents. The Report Structure Agent must select and instantiate a
job-specific structure after applying current scope and applicable standard
obligations.

## Keep and carry into the rebuild

| Capability | Treatment |
| --- | --- |
| Authentication, tenancy, authorization, PostgreSQL, S3 and immutable imports | Reuse as platform services. |
| Canonical app evidence, entity identity, measurements, checklist rows, maps, findings/photos and voice metadata | Reuse and strengthen as immutable SectionPlan inputs. |
| Controlled editing, versioning, approval and rollback | Reuse after binding drafts to ReportPlan, SectionPlan and release hashes. |
| Semantic ReportDocument, deterministic tables/maps and DOCX renderer | Reuse behind the new integrator after parity review. |
| Historical report source corpus and sound extractions | Preserve. Build reviewed, versioned blueprint and section-pattern packs from it. |
| Standards source corpus | Preserve separately. Build edition-pinned, reviewed standard-obligation packs. |
| Three-column evaluation UI and sealed reference comparison | Reuse as an evaluation sink for the new releases. |
| General Tank Information v1 | Preserve immutably as qualification evidence; port behavior into a new-interface release and prove parity. |
| Leakage, authorization, entity, document and export audits | Reuse and extend for ReportPlan/pack/release hashes. |

The raw historical corpus does not need a destructive rebuild. Derived indexes and
packs should be created as new revisions after source-fidelity, family, edition,
lineage, and review checks. Keep original sources and prior indexes for
reproducibility.

## Preserve as historical or comparison-only

| Surface | Reason |
| --- | --- |
| `server/generation.mjs` shared generator | Reproduces old drafts and comparisons; prohibited as a new-pipeline fallback or extension point. |
| `API_STANDARD_REPORT_TOC` and 32-section planner/catalogue | One compatibility profile, not a universal or API-mandated structure. |
| Generic 12-section and previous full-report comparisons | Useful research evidence; they do not prove implemented agents or promotion readiness. |
| Previous global KB/retrieval and system-policy experiments | Preserve results; do not let mutable global policy choose new-agent behavior. |
| Old topology and implementation-plan documents | Historical reasoning only. |
| Temporary next-session marker | Reduced to a pointer to the active contracts. |

These surfaces should remain read-only during the rebuild. Delete them only after
saved evaluations/drafts remain reproducible, the new pipeline is active, rollback
requirements are met, and a separate removal review identifies every dependency.

## Current implementation truth

- The Report Structure Agent is designed but not implemented.
- ReportBlueprintPack, StandardObligationPack and ReportPlan stores/schemas are not
  implemented.
- Only General Tank Information has a frozen evaluation candidate.
- That candidate is deterministic, uses no model or runtime retrieval, passed 16
  behavior checks, preserved 310/310 development fields and 31/31 previously
  held-out fields, and is not product-enabled.
- The first candidate still enters through a legacy wrapper and lacks the new
  structured standard-obligation binding.
- No other outline/template entry is an implemented Section Generation Agent.
- The product promotion registry and new Report Integrator route are not
  implemented.

## Required implementation order

1. Define and persist immutable ReportBlueprintPack, StandardObligationPack,
   ReportPlan, revised SectionPlan, typed SectionDocument, trace, release registry,
   and promotion registry contracts.
2. Implement the Report Structure Agent as a schema-constrained planner with a
   human review/freeze step. It must never author section content.
3. Port General Tank Information into the new interface without editing v1; add its
   standard pack and prove complete output parity.
4. Implement the next section agent only after its all-KB pattern review, applicable
   standard review, input contract, format, validators, and evaluation cohort are
   frozen.
5. Build the deterministic Report Integrator and browser/DOCX/PDF parity around one
   semantic ReportDocument.
6. Qualify multiple report families and standards editions with grouped holdouts,
   varied inspector notes, source/near-duplicate exclusions, rendered review,
   security/load tests, canary routing, and rollback.
7. Cut product traffic to the new registry only after required sections have
   qualified agents. Remove the old generator in a later controlled decommission.

## Validation completed for this cleanup

- JSON design artifacts parse successfully.
- `git diff --check -- apps/report-platform` passed.
- `npm run architecture:audit` passed with explicit checks for the Report Structure
  Agent, separate historical/standard packs, immutable section releases, and no
  legacy fallback.
- `npm run section-agent:general-info:audit` passed all behavior, isolation, tamper,
  private-review, and production-disabled checks.
- `apps/report-platform/scripts/report-platform-guardrails.sh --standard` passed,
  including build, architecture, logic, PostgreSQL storage, object upload, durable
  artifacts, leakage, and API hardening.

No product route, model, KB policy, report profile, or section agent was promoted.

## Documentation cleanup completed

The report-platform root previously contained 33 Markdown files and 11,355 lines,
mixing active contracts with superseded plans and session notes. It now contains
eight active Markdown files and 920 lines:

- `README.md`
- `SYSTEM_ARCHITECTURE.md`
- `REPORT_COMPILER_WORKFLOW.md`
- `SECTION_AGENT_RELEASES.md`
- `EVAL_SYSTEM.md`
- `PRODUCT_TERMINOLOGY.md`
- `DOCUMENTATION_INDEX.md`
- `AGENTS.md`

Active subsystem detail moved to `docs/contracts/`. Superseded architecture,
consolidated generation designs, source-specific research, and session markers moved
to `docs/archive/`. Dated evaluation evidence remains under `docs/reviews/`.

The architecture audit now enforces the exact eight-file root set, verifies the
contract/archive inventory, and checks the Report Structure Agent, dual knowledge
authorities, immutable releases, and no-legacy-fallback rules. No runtime source,
historical report, standard source, saved evaluation, or frozen release was deleted.

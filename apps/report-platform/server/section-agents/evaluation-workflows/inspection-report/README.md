# Inspection Report evaluation workflow

Status: calibration knowledge bundle frozen; the new 12-report Android V3 mock
corpus is source-verified and fully indexed; complete Android exports and independent
mock reviews are not yet frozen; generation remains blocked.

This workflow evaluates Section 4 without letting one target report define the
generic outline or writing style. Compatible historical reports first produce one
reviewed, immutable `SectionKnowledgeBundle`. The mock preparation lane is open-book:
it reads the complete target report to build and verify the app-shaped capture. The
generation lane is closed-book: the target report is withheld from structure
planning, section generation and pre-display review, then reopened for evaluation.

"Learn from the KB" means every role consumes a reviewed projection of the same
bundle ID and content hash. It does not mean fine-tuning a model or giving agents raw
historical sections at runtime.

## One bundle, five controlled projections

| Role | Historical knowledge it receives | What it must not receive |
| --- | --- | --- |
| Report Structure Agent | Canonical blocks, order constraints, applicability rules, accepted headings and format families | Target report structure or text |
| Mock Preparation Agent | Complete target report and source inventory, plus block coverage taxonomy, component/terminology patterns, practical capture patterns and app capability mapping | Copying target report prose into app notes; exporting target facts as reusable KB knowledge |
| Section Generator | Selected structure/format, terminology, reviewed narrative patterns and cross-reference patterns | Raw historical sections, target report or gold |
| Pre-display Reviewer | Accepted structure, format, terminology and variation boundaries | Target report or gold |
| Post-generation Evaluator | Generic conformance rubric plus the sealed target truth opened after generation | Gold before generation completes |

Standards remain a separate authority. Historical frequency cannot create a current
inspection fact, recommendation or scope decision.

## Pipeline

1. **Consolidate historical knowledge.** Use at least ten compatible, independent
   knowledge-reference lineages, exclude all evaluation lineages, review coverage
   saturation, then freeze the bundle and its five projections.
2. **Build a complete report-wide Android capture case, open-book.** The mock builder
   reads every page, parsed block, table, layout, photo and appendix in one historical
   report. Give every source unit a reviewed
   disposition, reconstruct the source layouts, use real report photos, complete all
   source-supported V3 fields and checklist items, and create six realistic voice
   variants from one inspection truth.
3. **Round-trip and independently review the case.** Import each draft through the
   debug Android harness and export through Room and `ProductStore`. A separate mock
   reviewer compares the exports with the complete original report. Freeze only after
   source coverage, layout, media, lineage, checklist, truth-parity and leakage gates
   pass.
4. **Close the source and project frozen evidence into this section.** From this point,
   structure planning, generation and pre-display review cannot read the target
   original, source inventory or mock-review findings. Classify each evidence record for
   zero, one or several report sections without duplicating or changing the evidence.
   The post-generation evaluator may reopen the original only after generation.

Generic techniques may be reused across the two lanes: terminology aliases,
component normalization, evidence relationships, note interpretation and completeness
checks. Target facts, sentences, headings, gold labels and same-lineage examples may
not cross into generator inputs.
5. **Qualify interpretation.** Each capture variant must recover the same entities,
   relationships, polarity, uncertainty, values and units, or ask the expected
   clarification.
6. **Create a target-blind ReportPlan.** The structure agent uses the verified current
   evidence and structure projection. Every canonical block gets an evidence-based
   include/exclude decision. Included blocks use accepted headings, formats and order.
7. **Generate.** Every candidate receives the same verified observations, frozen
   ReportPlan, generation projection and applicable standard pack.
8. **Run pre-display review.** The independent reviewer checks evidence fidelity,
   supported claims, structure, format, terminology, deterministic content and
   leakage without seeing gold.
9. **Open sealed gold and evaluate.** Score current-evidence fidelity, generic KB
   conformance, target meaning recovery and target format similarity separately.
   Record accepted non-target variation because reports need not be identical.

## Required artifacts

- `knowledge-bundle-contract.json`: corpus, knowledge categories and projection rules.
- `workflow.json`: stage order, cohort, reset rules and hard gates.
- Android `tools/report-mock-corpus/`: active report-wide mock cohort, Android round
  trip, independent completeness review and explicit freeze contract.
- `mock-data-contract.json`: retained section-calibration reference; it no longer
  authorizes section-only mock creation.
- `app-capture-capability-contract.json`: app channels and the real-photo-only media rule.
- `inventory.mjs`: creates a draft target source-obligation inventory and sealed
  target structure reference.
- `build-knowledge-bundle-candidate.mjs`: builds a non-generative statistical
  candidate from the private canonical KB. It excludes raw narrative from output.
- `audit.mjs`: validates contracts and, when all five case artifacts are supplied,
  verifies the bundle, inventory, plan, truth case and mock export together.

Build a local candidate for human review:

```bash
npm run section-agent:inspection-report:kb:candidate -- \
  --source <private-canonical-kb-root> \
  --output <ignored-local-candidate.json> \
  --exclusions <frozen-evaluation-exclusions.json>
```

Audit the contracts:

```bash
npm run section-agent:inspection-report:eval:audit
```

Audit a prepared case:

```bash
npm run section-agent:inspection-report:eval:audit -- \
  --knowledge-bundle <frozen-bundle.json> \
  --inventory <reviewed-inventory.json> \
  --report-plan <target-blind-report-plan.json> \
  --truth-case <reviewed-truth-case.json> \
  --mock-export <complete-mock-export.json>
```

Do not run a generator experiment until the knowledge bundle has target/validation/
held-out exclusions, the selected report-wide Android case is frozen, the section
projection and ReportPlan are target-blind, and interpretation coverage passes at
100%. Retrieval must exclude the frozen case's source SHA and asset lineage.

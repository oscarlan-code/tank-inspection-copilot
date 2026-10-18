# General Tank Information — Candidate B

Candidate B is the first Section Generation Agent rebuilt on the current classified
evidence handoff. It is a sandbox candidate, not a release.

```text
reviewed section_evidence_package_v1
-> package-bound ReportPlan and SectionPlan
-> deterministic completeness gate
-> generator
-> independent pre-display reviewer (no gold)
-> optional sealed-gold evaluator (after generation)
```

The section is structured, so the model and prompt are explicitly disabled. The
historical corpus contributes only the reviewed title, field order, paired-field
layout and accepted missing-value behavior. It cannot supply a current tank fact.

The body renders 31 fields. Job number, completion date and inspector are preserved
as report-header metadata. Roof-presence flags and insulation distance remain
traceable applicability/support data; they are not printed as invented tank
descriptions. Every input record receives a disposition.

Candidate B adds explicit atomic and whole-section automated evaluation plus a post-review artifact-integrity check. Qualification still requires the frozen lineage split, 10+1 current ProductStore replay,
rendered comparison and inspector review. Product routing remains disabled.


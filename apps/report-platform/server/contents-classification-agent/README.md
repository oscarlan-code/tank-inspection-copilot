# Contents Classification Agent

Status: qualified immutable evaluation release v1. Product use is disabled.

This subsystem converts one authenticated Android ProductStore export into reviewed,
section-scoped evidence packages. It classifies evidence; it does not write report
prose, choose a final table of contents, approve content, or promote itself.

```text
Frozen vertical outline profile
  -> Android ProductStore export
  -> Evaluation Input Leakage Guard
  -> Evidence Atomizer
  -> Contents Classification Agent
  -> Classification Guard
  -> Section Evidence Packages
```

`outline-profiles/vertical-api653-v6/` is the qualified release label space. It supplies
25 allowed section labels and their block labels. The Report Structure Agent later
selects which conditional sections belong in a specific report. One evidence atom may
serve multiple sections.

The runtime path is closed book. It cannot access the target original report, target
gold labels, evaluator feedback, or raw historical passages. Structured API paths use
deterministic mappings. An LLM may propose labels only for narrative evidence.
Ambiguous proposals stay unresolved and never enter a section package.

The independent evaluator is R&D-only. It opens human-reviewed original-report text
units and gold section labels only after runtime output is sealed. Its results cannot
change that run or become generator input.

## Active files

- `outline-profiles/vertical-api653-v6/`: frozen 25-section evaluation vocabulary.
- `outline-profiles/registry.json`: v6 is the only active evaluation profile; v1–v5 are retained historical artifacts.
- `input-guards/evaluation-leakage/v1/`: deterministic pre-runtime leakage boundary.
- `atomizers/evidence-atomizer/v5/`: exact atoms plus same-note context for referent resolution.
- `sandbox/candidates/contents-classification-v10/`: retained qualified source candidate.
- `sandbox/candidate-registry.json`: v1–v9 are superseded experiments and v10 is retained only as the promoted release source.
- `releases/evaluation/v1/`: immutable evaluation release.
- `release-registry.json` and `release-registry.mjs`: exact server-owned release binding and execution interface.
- `evaluation-pathway.mjs`: Android export guard, v5 atomization, exact release execution, authorized review sealing, and section-package projection.
- `evaluation-pathway-contract.json`: the evaluation-only stage and gate contract.
- `../evals/contents-classification/section-first-v1/`: independent development, validation and hidden qualification.

Reviewed section packages may feed section-agent evaluation. They remain explicitly
ineligible for product generation. This pathway supersedes `report-evidence-router`
for all new work; that subsystem is archived in place for historical evaluation
reproduction. Product routing remains off.

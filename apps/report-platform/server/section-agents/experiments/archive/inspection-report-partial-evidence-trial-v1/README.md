# Archived Inspection Report partial-evidence trial v1

Status: archived and invalid for full-section fidelity; no release and no product
route. The active replacement is
`server/section-agents/evaluation-workflows/inspection-report/`.

The first baseline used selected findings rather than a complete mock app export.
It covered 44 of approximately 197 in-scope source findings across the four
development reports (22.3%). Its deterministic pass applies only to those selected
records. It must not be treated as a Section 4 pass or used to create Candidate B.
The evaluator also omitted exact component-heading and order gates. The mock export
and evaluator must be rebuilt before generation resumes.

This trial uses six `4 INSPECTION REPORT` source lineages: four development
(66.7%), one validation (16.7%) and one sealed held-out report (16.7%). The
cohort includes combined, internal-only and external-only inspections. Each report
has six practical note variants, giving 36 interpretation cases. It is a small pilot,
not a qualification result for the complete section.

Review these source files:

1. `README.md` — workflow and review boundary.
2. `controls.json` — fixed variables, the single allowed candidate variable, metrics
   and hard gates.
3. `cohort.json` — exact lineages, split assignment, evidence files and pinned
   evaluator-gold hashes.
4. `evidence-*.json` — six report-derived app evidence packages, each containing
   structured observations and six independently worded field-note variants.
5. `candidate-a-prompt.md` — exact baseline generator instruction.
6. `run.mjs` — request construction, leakage checks, deterministic review and
   feedback routing.

Generated request previews and results are written under
`.local/section-agent-experiments/inspection-report-rsi-trial-v1/` and are not
committed. Original selected report passages are stored only in the ignored
`evaluator-only/` directory. The generator never receives that material.

## Trial loop

```text
A baseline -> B/C/D development refinements -> E validation candidate
-> F only if validation exposes a reviewed failure -> freeze final candidate
-> open held-out once -> inspector review
```

Candidates B–F are deliberately absent at preparation time. Each is created only
from reviewed feedback on its parent candidate and receives a new prompt hash. The
only permitted candidate variable in this trial is the prompt. Evidence, model,
reasoning effort, KB mode, output schema, renderer, reviewer and metrics stay fixed.
Candidate E is the first validation candidate. Candidate F is allowed only if the
validation failure is reviewed and the complete development set is rerun. Held-out
gold opens once after the final candidate has been frozen and never creates another
candidate in this experiment.

The interpretation track compares each of the six note variants with the same
expected structured observations. All variants from one report remain in one split.
The generation track starts from those verified observations so prompt quality is
not confused with interpretation quality.

The generator receives current structured evidence only. Historical source
sentences, expected wording, validation examples and held-out material do not enter
the development requests. The deterministic reviewer checks exact evidence IDs,
component-block placement, protected terms, unsupported claims and the section
title. It does not judge writing style; a human comparison and the sealed-gold
evaluator cover that dimension.

The former npm commands were removed. This runner remains only as an archived
diagnostic record and must not prepare or send generation requests.

For each generator candidate, four development reports are generated twice, giving
eight development runs. Candidate E uses the validation report only after the
development choice is made. The held-out report opens once after the final candidate
is frozen. The live baseline requires review and approval of the exact external
request preview. Nothing in this trial can mutate a frozen release, approve a draft
or promote product routing.

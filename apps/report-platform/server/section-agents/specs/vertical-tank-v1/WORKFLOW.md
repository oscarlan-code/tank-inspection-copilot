# Section generation and evaluation workflow

Each report section has its own generator, prompt or deterministic instructions,
format, KB projection, reviewer, evaluator and harness. Shared code validates
contracts and records hashes; it does not decide section content.

## 1. Generate one section

```text
Android ProductStore export
  -> Evidence Atomizer
  -> Contents Classification Agent
  -> human-reviewed section/block labels
  -> section_evidence_package_v1 for one section
  -> frozen SectionPlan bound to one sandbox candidate
  -> section generator
  -> no-gold pre-display reviewer
  -> unapproved draft visible for human review
```

The generator sees the reviewed package, SectionPlan and its own permitted KB
projection. It cannot see the original report section, expected answer, evaluator
labels or another section's evidence package.

For example, a classified evidence unit may contain `height = 14.55 m`, routed to
`general-tank-information / configuration-and-dimensions`. The General Information
generator preserves the value and unit and renders `Height: 14.55 m` in its fixed
paired-field layout. Its reviewer checks the evidence link, value, unit, field
order, title and layout before the draft can be shown.

## 2. Evaluate after generation

The sealed gold opens only after generation and pre-display review. Evaluation then
runs at two levels.

### Atomic unit evaluation

One row represents one semantic obligation, such as a labelled field, measurement
set, observation, limitation, recommendation, scope item or cross-reference.

| Gold unit | Classified app evidence | Generated unit | Checks |
| --- | --- | --- | --- |
| Tank height is `14.55 m` | `height = 14.55 m`, reviewed route to Section 3 | `Height: 14.55 m` | supported, meaning preserved, value and unit exact |

The links are many-to-many. This supports a single mixed voice note being split
into several claims, or several evidence records supporting one report sentence.
Exact fields and measurements use deterministic grading. Narrative equivalence may
use a calibrated LLM grader, followed by sampled human review.

### Whole-section evaluation

After atomic rows are scored, the complete rendered section is checked for:

- required-content coverage and absence of unsupported claims;
- correct heading, block selection and order;
- the section's format family;
- coherence, repetition and appropriate length;
- resolved figures, photos, tables and cross-references;
- rendered human review and inspector acceptance.

A strong whole-section score cannot override a missing critical unit, changed unit,
wrong component or unsupported claim. Likewise, perfect atomic rows do not prove
that the complete section is readable or formatted correctly.

## 3. Sandbox before release

```text
section scaffold
  -> Candidate A in sandbox
  -> development evaluation and failure analysis
  -> Candidate B/C/... for any controlled change
  -> untouched validation
  -> freeze selected candidate
  -> open sealed held-out cases once
  -> rendered inspector review
  -> copy exact bytes and hashes to immutable evaluation release
  -> separate product-promotion decision later
```

Changing generator code, prompt, model, KB, reviewer, evaluator, format contract or
metrics requires a new candidate ID. A scaffold and a sandbox candidate can never
be selected by product routing.

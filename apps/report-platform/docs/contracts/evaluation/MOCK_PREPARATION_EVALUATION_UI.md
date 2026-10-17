# Mock Preparation Evaluation UI Contract

Status: **frozen by explicit user instruction on 14 October 2026**

Contract ID: `mock_preparation_truth_to_mock_ui_v2`

This contract protects the Step 1 human-review interface from changes made as a
side effect of dataset, evaluator, Android round-trip, or backend pipeline work.

## Step 1 purpose

The page evaluates one transformation only:

```text
original report
→ reviewed truth text units
→ atomic truth facts
→ generated mockup app evidence
→ semantic and integrity evaluation
```

It does not display report-section generation or later evaluation stages. Those
stages will receive separate interfaces when they are implemented.

## Stable interface

The page has one primary truth-to-mockup review surface. It does not duplicate the
same current run across several top-level tabs.

`/admin/evaluation` opens this Step 1 surface directly. The general Evaluation Lab
navigation, Approved Sources, Truth & Mock Data, Evaluation Runs, Policy Registry,
Outline experiment, Review KB, Accounts, and generic live-data banner are not shown
inside this pathway.

The workflow strip shows, in order:

1. `Original report`
2. `Reviewed truth`
3. `Mockup output`
4. `Evaluation`

The summary must distinguish reviewed source text units, atomic truth facts,
generated comparison rows, and the evaluation result. For TK5452 this currently
means 75 reviewed text units, 76 atomic facts, and 228 comparisons across three
datasets. These counts must never be treated as interchangeable.

The evaluation workbook keeps these columns, in order:

1. `#`
2. `Mock variation`
3. `Evidence type`
4. `Truth text unit (original report)`
5. `Generated mockup text unit`
6. `Evaluator`
7. `Meaning`
8. `Integrity`
9. `Overall`
10. `Feedback`

Every row shows the complete truth text and corresponding generated mockup text
side by side. Selecting a row opens both complete units and evaluator feedback.
Rows may be searched, filtered, resized, and selected. All current comparison rows
remain in one workbook without pagination hiding later units.

The base-source-grounded, natural-field-speech, and concise-field-shorthand
datasets remain visible. GPT-5.6 performance charts and the evidence-type by mock
variation matrix remain available below the workbook. Selecting a chart element
filters the same workbook.

Step 1 control gates and evaluator calibration remain available as secondary,
collapsed audit sections. Calibration tests the evaluator and must not be counted
as mockup-output performance.

Complete-report qualification remains a separate backend denominator. It accounts
for structured fields, checklist rows, measurements, narrative facts, layouts, and
explicit outside-app dispositions. The truth-to-mockup workbook does not replace
that qualification.

## Change control

Do not change the workflow strip, counts, workbook columns, truth/mockup pairing,
filter behavior, chart behavior, or secondary control sections unless the user
explicitly approves another UI revision. When approval is given, update this
contract, its contract test, and the reviewed browser screenshot together.

Loading another report may change only report identity, data, counts, generated
evidence, and evaluation results. Dataset shape alone is not permission to redesign
the interface.

# Report Generation Eval System

The eval system is used to tune the report-generation workflow, prompts, retrieval policy, templates, missing-input detection, and tool orchestration. It is not model fine-tuning.

## Core Rule

Generation and evaluation are separated.

- Generation can use app export data, report-side user inputs, deterministic calculations, layout-map artifacts, standards/rules, and approved precedent guidance.
- Evaluation runs only after generation.
- Reference report answer text used by eval must never be inserted back into the generation prompt.
- If a section needs missing user/report-side input, the eval result should be bad or capped until that input is supplied.

## What Happens After Every Generation

When a section is generated, the backend now creates a `report_eval_runs` record linked to the `report_generation_runs` row.

The evaluator checks:

- `format_match`: heading, bullet/table/page-block conventions.
- `reference_alignment`: lexical alignment to the approved reference report section after generation.
- `source_grounding`: whether the draft is grounded in Android export data, manual inputs, calculations, and tool artifacts.
- `missing_input_discipline`: whether missing values remain pending instead of being guessed.
- `leakage_safety`: whether generated text appears to copy reference-only answer content.

## Expected Bad Results

Some sections are supposed to fail until the user supplies missing data.

Example: `General Tank Information` requires:

- Client representative
- Year built

If those values are missing, eval returns:

`expected_bad_missing_user_input`

This is correct behavior. The system should not reward the AI for guessing.

## Leak Guard

The evaluator flags possible leakage when:

- Long reference-report phrases appear copied into generated content.
- Reference-only measurements, identifiers, or facts appear in the generated content but are not present in allowed evidence.

This does not block generation by itself, but it provides a tuning signal to adjust:

- Prompt instructions
- Precedent retrieval scope
- Section templates
- Raw app-data preprocessing
- Missing-field rules

## API

Latest eval for a section:

```text
GET /api/v1/report-jobs/:reportJobId/sections/:sectionId/evals/latest
```

All evals for a report job:

```text
GET /api/v1/report-jobs/:reportJobId/evals
```

Generation response also includes:

```text
evalRun
```

## Product Use

Use eval results as a prompt/system tuning loop:

1. Generate one section.
2. Review eval outcome and tuning hints.
3. If missing input is the reason, fill the report-side field and regenerate.
4. If format match is weak, tune section template or formatting prompt.
5. If leakage risk is high, reduce reference answer exposure and strengthen no-copy instructions.
6. If reference alignment is weak but inputs are complete, inspect KB retrieval for the section.

The goal is a reliable report-generation system that fails honestly when data is absent.

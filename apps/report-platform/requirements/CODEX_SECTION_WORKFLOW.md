# Codex Section Workflow

## Purpose

This document defines how the report platform should use `Codex CLI` behind the web app to draft and refine report sections from:

- captured Android field data
- reviewer-controlled report-plan choices
- checklist answers
- manual reviewer edits
- API-oriented guard rails
- sample report structure

The goal is to keep the runtime quality benefits of Codex while making the workflow explicit, auditable, and safe.

## High-Level Flow

The report workflow should be split into 5 stages.

### 1. Workspace Intake

Input:

- canonical inspection package JSON
- later: canonical package ZIP from the Android app

System actions:

- validate schema
- normalize measurements, findings, attachments, and layout context
- create a `ReportWorkspace`
- create the initial report section list from:
  - real sample report structure
  - current capture coverage
  - API-oriented report needs

Output:

- hydrated report workspace
- generated section inclusion checklist

### 2. Section Plan Confirmation

Input:

- generated section checklist
- reviewer choices

Reviewer actions:

- include or exclude non-core sections
- add custom sections if needed
- keep required sections locked

System rules:

- core sections remain required unless the approved master template changes
- deferred sections stay visible but should default to excluded
- custom sections are allowed but should remain reviewer-owned

Output:

- confirmed section plan
- ordered included-section list for editing

### 3. Section Editing Workspace

Once the section plan is confirmed, the UI moves into the current section-by-section editing workspace.

Each included section can use:

- `preview` mode
- `layout` mode
- `checklist` mode where applicable

Reviewer input at this stage may include:

- direct text edits
- checklist answers
- notes and clarifications
- custom wording requests

These reviewer inputs must become part of the section bundle that is sent to Codex.

### 4. Codex Draft / Refine Cycle

This is the first real AI stage.

The browser should never call Codex directly.

Codex should work on one active section at a time only.

Instead:

1. the user triggers a section action in the right rail
2. the backend creates a section job bundle
3. the backend runs `codex exec`
4. the backend validates and stores the result
5. the UI shows the returned draft, warnings, and evidence notes

While Codex is running, the UI should show high-level working progress such as:

- preparing the active section bundle
- reading captured data and reviewer inputs
- applying sample report and API guard rails
- drafting or refining the active section

The UI may show grounding summaries and evidence notes, but it should not pretend to expose raw hidden chain-of-thought.

### 5. Human Confirmation

Codex output is never the final release artifact by itself.

The reviewer must still:

- inspect the section draft
- edit if needed
- confirm the section

### 6. Refine, Rate, and Learn

Two feedback loops should exist, and they should not be confused.

#### Refine Loop

This loop is for changing the current section draft only.

1. reviewer clicks `Refine Draft`
2. reviewer writes a change request
3. Codex explains its understanding and any pushback
4. reviewer confirms
5. Codex applies the change to the current section only

This loop should not automatically become long-term training memory.

#### Thumbs Loop

This loop is for future improvement memory.

1. reviewer gives `Thumbs Up` or `Thumbs Down` on the current generated section
2. reviewer explains what was good or wrong
3. Codex summarizes that feedback into a reusable section lesson
4. reviewer confirms the lesson
5. platform stores it in section memory for future runs

Only this explicit thumbs-based loop should feed the section feedback store.

#### Logic Improvement Loop

This loop is for durable section-generation logic, not the current draft only.

1. reviewer clicks `Improve Logic`
2. reviewer writes what future runs should do differently for this section
3. Codex restates that note as a durable section rule, with any pushback or ambiguity
4. reviewer confirms the rule
5. platform stores it in separate section logic memory for future runs

This logic store must remain separate from:

- current-draft refine notes
- thumbs-up / thumbs-down quality feedback

For this dev version, logic improvements may be stored and replayed locally. In the future multi-tenant product, activation of this durable logic layer should be platform-admin governed.

Later stages may add:

- reviewer approval
- tenant admin sharing
- client viewer access

## Inputs to Codex

Each section action should be bundled from the current report workspace.

### Captured Data Inputs

These come from the canonical package:

- inspection metadata
- tank metadata
- shell line plan
- roof layout metadata
- nozzle registries
- UT rows
- findings
- attachments
- review warnings

These are the truth-bearing engineering facts.

### Reviewer Inputs

These are user-controlled:

- section inclusion/exclusion choices
- checklist answers
- checklist notes
- custom section purpose
- current section text edits
- custom prompt from the right rail

These must be treated as explicit human context, not inferred facts.

### Guard-Rail Inputs

These come from the report-platform rules:

- section skill
- per-section prompt profile
- per-section playbook
- sample report format bundle
- API-oriented guard-rail bundle
- output schema

These shape how Codex should write, format, and constrain the output.

## Section Job Bundle

For every Codex action, the backend should prepare a temp workspace folder containing at least:

- `active-section.json`
- `source-package.json`
- `workspace-meta.json`
- `section-plan.json`
- `checklist.json`
- `reference-bundle.json`
- `user-input.json`
- `current-section-draft.md`
- `section-feedback.json`
- `section-logic-feedback.json`
- `output-schema.json`
- `section-prompt-profile.md` or equivalent per-section prompt reference

### Recommended File Purposes

`active-section.json`

- section id
- section title
- section type
- section playbook
- selected mode

`source-package.json`

- normalized canonical inspection package

`workspace-meta.json`

- tenant/job/workspace identity
- validation warnings
- report state

`section-plan.json`

- included sections
- excluded sections
- custom sections
- ordering

`checklist.json`

- checklist answers
- notes

`reference-bundle.json`

- sample report format guidance
- API guard rails
- output constraints

`user-input.json`

- reviewer prompt
- reviewer notes
- explicit wording requests
- any per-section override context

`current-section-draft.md`

- latest saved section text before Codex runs

`section-feedback.json`

- reviewer-confirmed thumbs-up and thumbs-down lessons for the active section only
- positive patterns to preserve
- negative patterns to avoid

## Codex Responsibilities

Codex should be used for:

- drafting a section from grounded inputs
- refining wording
- tightening language
- reformatting into report style
- comparing to the sample report section pattern
- surfacing missing inputs

Codex should not be the source of truth for:

- schema validation
- permissions
- tenant rules
- deterministic calculations
- final approval state

## Output Contract

Codex should return structured output, not only free text.

Minimum output fields:

- `draft`
- `assistantMessage`
- `warnings`
- `evidenceNotes`

Later we may also add:

- `missingInputs`
- `citations`
- `sectionStatusSuggestion`

## Guard Rails

The following rules should always remain outside the model:

- required sections are enforced by the platform
- deferred sections cannot be silently fabricated
- blocked floor/MFL sections must stay blocked unless data support is added
- reviewer approval is mandatory for recommendation-heavy sections

The following rules should be reinforced inside the Codex prompt bundle:

- stay inside the active section
- do not invent unsupported floor or MFL content
- keep wording aligned to sample report structure
- prefer captured facts over general narrative

## First Production Path

The first robust implementation should target only a narrow set of section actions:

1. `Scope of Inspection -> draft`
2. `Inspection Report -> draft`
3. `Repair Recommendations / API 653 Assessment -> format`
4. `Photographs -> caption/refine`

This keeps the workflow understandable while the platform hardens.

## Open Questions

These items still need explicit decisions before the Codex path is considered mature:

- how reviewer edits should be versioned between Codex runs
- whether Codex should see full attachment captions only, or richer extracted notes later
- how deterministic calculation output will be injected once that engine exists
- whether client-visible published sections should keep separate AI provenance from internal drafts

## Recommendation

The correct product flow is:

`capture data -> generate section checklist -> user confirms report plan -> section-by-section edit -> Codex draft/refine -> reviewer confirms -> publish later`

That sequence should remain stable even if the AI runtime changes in the future.

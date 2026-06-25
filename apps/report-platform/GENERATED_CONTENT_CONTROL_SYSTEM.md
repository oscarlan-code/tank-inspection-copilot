# Generated Content Control System

This document records the V1 Beta review of how generated report content is controlled by the LAIQ AI Engine.

The important conclusion is that the product should not rely on free-form chat text to edit the report. The LAIQ AI Engine should understand the user request, choose a controlled tool, apply a deterministic transformation, validate the result, and keep a restore path.

## Why This Matters

The report platform needs two separate abilities:

- generate report sections from LAIQ inspection app export data, voice notes, report-side inputs, precedent templates, and standards guidance
- let the user control the generated output after generation, including wording, bullets, headings, tables, layout figures, and export formatting

If the assistant only replies with text such as "I applied the table format", the user cannot trust it. The UI must prove that a controlled action was actually applied to the draft.

## Current V1 Beta Behavior

V1 Beta has a useful baseline:

- section generation is explicit and does not run on page load
- app-sourced measurement sections are compiled deterministically from exported UT rows
- app-sourced layout maps are rendered deterministically from exported layout metadata
- checklist and measurement table formatting can return replacement-section actions
- selected generated-content edits now route through a controlled content-transform layer
- exact text replacement produces a concrete replacement action instead of chat-only confirmation
- checklist marker changes are rebuilt from app checklist rows while preserving item names, responses, and column widths
- right-panel chat can explain missing fields and apply approved actions
- previous generated output can be restored after an assistant-applied replacement

The limitation is that the action vocabulary is still not a full production block-AST editor. V1 Beta now includes a lightweight report-block manifest and safe block replacement path, while the UI still receives simple draft-update actions for reliability.

The current controller supports:

- `replace_section_content`
- `apply_text_style`
- `move_marker`
- `resize_plate`

The new content-transform layer reduces hard-coded chat behavior by forcing edit requests to produce real actions. It can inspect generated HTML as report blocks with stable `blockId` values, plan exact text replacement, safe block replacement, checklist marker transforms, whole-section style actions, or table-scoped style actions, and then emit a concrete UI action. The next product step is to persist these report blocks as first-class section data rather than reconstructing them from HTML.

## Implemented V1 Beta Transform Layer

The current implementation now follows this rule:

```text
If the assistant says it changed generated output, it must return a controlled action.
```

Implemented transform flow:

```text
chat request
  -> content-transform router
  -> existing deterministic table/map/measurement tools when applicable
  -> deterministic transform plan for safe exact edits
  -> optional Codex structured transform planner for broader edits
  -> validation guard
  -> replace/style action
  -> backend draft-version snapshot for restore
```

Current supported transform categories:

- exact text replacement, e.g. replacing one visible phrase in the generated section
- checklist marker replacement, e.g. dot to tick or tick to cross
- whole-section style action when the request is truly section-level, including font size, bold weight, alignment, family, and color
- table-scoped style action when the request targets table contents, for example `apply_text_style(table)` for table-cell text color or font changes
- continuous conversation confirmations such as "yes" or "do it" when the previous assistant turn offered or applied a controlled generated-content edit
- table-specific edits remain routed to deterministic checklist and measurement table formatters

Current validation guards:

- empty transformed output is rejected
- measurement-section edits must preserve the measurement table structure
- checklist-section edits must preserve the checklist table structure
- app-sourced measurements and checklist rows are rebuilt from the LAIQ app export, not from free text
- rollback/version history is created before applied output is overwritten
- ambiguous short replies without a pending assistant edit offer still ask a clarification instead of running a guessed tool
- table-only formatting requests must update table cells only and must not accidentally restyle the surrounding section narrative

## Product-Standard Control Model

The target model is:

```text
User instruction
  -> intent parser
  -> target block resolver
  -> controlled tool planner
  -> deterministic transformer
  -> validation guard
  -> visible draft update
  -> restore/version history
  -> human approval
```

The AI part is responsible for understanding and planning. The deterministic tools are responsible for changing the report artifact safely.

## Report Content As Blocks

Generated content should be represented as structured blocks, not only as raw HTML.

Recommended block model:

```text
ReportSection
  |
  |-- HeadingBlock
  |-- ParagraphBlock
  |-- BulletListBlock
  |-- TableBlock
  |-- LayoutFigureBlock
  |-- PhotoBlock
  |-- ChecklistBlock
  |-- RecommendationBlock
```

Each block should have:

- stable `blockId`
- `sectionId`
- `blockType`
- source provenance
- editable properties
- export style class
- validation rules

Example table block:

```json
{
  "blockId": "roof-ut-table",
  "sectionId": "roof-plate-thickness-measurements",
  "blockType": "measurement_table",
  "source": "app_export_ut_measurements",
  "columns": [
    { "key": "plate", "label": "Plate No.", "widthPx": 120 },
    { "key": "a", "label": "A", "widthPx": 72 },
    { "key": "b", "label": "B", "widthPx": 72 }
  ],
  "rowsSource": "exportPackage.utMeasurements"
}
```

This gives the AI Engine something concrete to control. It should not guess table geometry from final HTML.

## Tool Registry

The next-stage AI controller should expose a registry of safe tools.

Recommended V1 Beta+ tool list:

- `section.generate`: generate selected report sections from evidence packs
- `section.regenerate`: rerun one section from saved input and current manual fields
- `section.restorePrevious`: restore previous generated output
- `text.rewriteBlock`: rewrite one paragraph or bullet group while preserving facts
- `text.changeBulletStyle`: apply arrow bullets, normal bullets, or numbered bullets
- `text.applyHeadingStyle`: apply API report heading classes
- `table.rebuildFromAppData`: rebuild a table from exported structured rows
- `table.resizeColumn`: resize a named column by pixels or percentage
- `table.equalizeColumns`: make selected columns the same width
- `table.addDerivedColumns`: add Min, Max, Average, corrosion allowance, or calculated result columns
- `table.removeDerivedColumns`: remove derived columns without changing source readings
- `checklist.rebuildTable`: rebuild checklist from app checklist rows
- `map.renderFigure`: render roof, shell, or floor layout as a report figure
- `docx.applyStyleMap`: apply export styles and page conventions
- `validation.run`: validate leakage, missing inputs, source grounding, and export readiness

The assistant can decide which tool to call. The tool then applies the actual change.

## Codex Scripted Transforms

The fixed tool registry should not be the ceiling. Codex is valuable because it can compose tools and write small transformation logic for cases the product team did not pre-enumerate.

The product-standard model should be:

```text
User request
  -> Codex planner
  -> temporary transform script or tool-composition plan
  -> sandboxed transform executor
  -> validation gates
  -> versioned draft update
  -> user review / undo / approval
```

Codex should be allowed to create small scripts only inside a constrained transform API. It should not receive unrestricted authority to mutate the report database or field export.

Recommended script contract:

```ts
type ReportTransformScript = {
  transformId: string;
  targetSectionId: string;
  targetBlockId?: string;
  intent: string;
  inputContract: {
    allowedSources: Array<"currentDraft" | "appExport" | "manualInputs" | "kbTemplate" | "standardsGuidance">;
    forbiddenSources: Array<"sameReportGoldText" | "otherTenantPrivateData">;
  };
  operations: Array<{
    op: "replaceBlock" | "updateTableColumns" | "rewriteParagraph" | "applyStyle" | "renderFigure";
    args: Record<string, unknown>;
  }>;
};
```

The executor should expose safe primitives, for example:

- read the current section draft
- read allowed app-export evidence
- rebuild a table from structured rows
- update a table column model
- rewrite one paragraph while preserving protected facts
- apply a report style class
- render a layout figure from app geometry
- produce a diff summary

The executor should not expose:

- raw database writes
- unrestricted filesystem access
- network retrieval during final draft mutation
- direct mutation of the imported app export
- access to hidden gold report text for the same inspection

This gives us flexibility without turning the AI into an unsafe free-form editor. If a user asks for something new, Codex can generate a targeted transform plan or script. If the script passes validation, the report changes. If it fails, the user sees a controlled explanation.

## Rollback Guardrail

Every generated-output mutation must create a rollback point before it overwrites the current draft.

Rollback should be stored server-side, not only in browser state. The user must be able to refresh the page and still restore the previous generated output.

Required rollback behavior:

- snapshot the current section draft before generation, chat-applied edits, script transforms, or manual save overwrites
- mark restored output as edited, unapproved, and review-required
- keep the replaced draft as the next rollback version so the user can toggle if needed
- never approve a section automatically after restore
- include rollback in audit logs once multi-user review is enabled

V1 Beta now includes backend section draft versions for generated output rollback. This is the guardrail that makes future Codex-scripted transforms safer to test.

The browser also keeps the draft that was just replaced as an immediate local rollback target after a restore. This lets the reviewer toggle back if a restore was not the desired previous version, while backend history remains the durable source after refresh.

## Example: Measurement Table Width Control

User request:

```text
The column width for A, B, C, D, E should be the same as B-E.
```

Correct control flow:

```text
intent: table.equalizeColumns
target section: Roof Plate Thickness Measurements
target block: roof-ut-table
columns: A, B, C, D, E
reference columns: B, C, D, E
source rows: LAIQ inspection app V3 exported UT rows
transform: rebuild table using unchanged readings and equalized column widths
validate: readings unchanged, no pending values introduced, width metadata present
result: replace table block and save previous output for restore
```

The AI should not answer that the template is locked if a safe table tool exists. It should either apply the tool or explain exactly which missing tool prevents the action.

## Example: Wording Control

User request:

```text
Make the inspection report section more concise but keep the same findings.
```

Correct control flow:

```text
intent: text.rewriteBlock
target section: Inspection Report
target blocks: narrative paragraphs and finding bullets
allowed changes: phrasing, sentence length, bullet grouping
blocked changes: new findings, changed measurements, changed client/tank facts
validation: source facts still match app export and manual inputs
result: updated narrative with visible restore option
```

## Example: Recommendation Control

User request:

```text
Make the repair recommendation more aligned with API 653.
```

Correct control flow:

```text
intent: section.regenerate or text.rewriteBlock
target section: Repair Recommendations / API 653 Assessment
inputs:
  - current app findings
  - current UT/calculation outputs
  - approved manual engineering implication
  - fact-recommendation KB pairs
  - standards guidance
blocked:
  - inventing repair scope
  - copying precedent report facts
  - using same-report gold content
result:
  - recommendation wording marked for review
  - missing inputs exposed if final disposition is not available
```

## Provenance Rules

Generated content should keep clear provenance:

- app field data: blue source facts from the LAIQ inspection app export
- precedent template: green structure or wording pattern from approved prior reports/templates
- AI prediction: yellow inferred connective wording, draft judgment, or report-side narrative not directly captured

The marking should not be word-by-word decoration everywhere. It should be block-level or phrase-level where it helps review.

Example:

```text
Template label: Height
App value: 14.535 m
Template label: Shell Course Count
App value: 8
```

The labels are template/report structure. The values are app field data.

## Validation Guards

Every assistant-applied content action should run guards before saving:

- source facts unchanged unless the user explicitly edits report-side input
- app measurements unchanged when rebuilding measurement tables
- no same-report gold reference leakage
- no hidden sample report identifiers in final content
- table width metadata present when the user asks for column geometry
- layout figures remain tied to app layout metadata unless override editing is enabled
- approved sections become unapproved after assistant modification
- previous output is available for restore

## What Should Not Happen

These are product anti-patterns:

- replying "applied" when no content action changed the draft
- adding one-off `if` branches for every user phrase
- letting the AI invent source measurements or final repair disposition
- treating the precedent KB as answer content
- hiding missing report-side decisions by predicting them as facts
- blocking safe formatting changes with generic "template is locked" replies

## Implementation Direction

The next implementation stage should move from ad hoc actions to a formal content-control layer:

1. Introduce a `ReportBlock` domain model for generated section content.
2. Add a `contentTools` registry with schemas for text, table, checklist, map, and export tools.
3. Update assistant chat output to return `toolCall` objects instead of only whole-section replacement actions.
4. Apply transforms server-side and return a validated patch/diff.
5. Store section output versions for restore and comparison.
6. Render block provenance and tool-change summaries in the UI.
7. Add logic audits for each tool contract.
8. Add eval cases that compare generated sections against gold report structure without leaking gold facts.

## V1 Beta Status

V1 Beta now includes the first examples of this control model for checklist and measurement tables. These are still early examples, not the full final system.

The product-standard goal is that every major generated artifact can be controlled through the same pattern:

```text
AI understands -> controlled tool changes -> validator proves -> user approves
```

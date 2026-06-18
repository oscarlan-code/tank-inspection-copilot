# Agentic Report Generation System

## Purpose

Define the product-standard agent system for the LAIQ report generation platform.

This document turns the high-level AI engine idea into an implementable agent architecture:

- one orchestration layer
- section-specific vertical agents
- tool-control agents
- retrieval and standards agents
- missing-input and evaluation agents
- human approval gates

The goal is not to create many uncontrolled chatbots.

The goal is to create a controlled report production line where every section has:

- known input sources
- known allowed tools
- known output format
- known missing-field behavior
- known evaluation criteria

## Visual Topology

Open the SVG directly if the markdown preview is too small:

`apps/report-platform/assets/agentic-system-design.svg`

![LAIQ agentic report generation system](assets/agentic-system-design.svg)

## Core Position

The agentic system should behave like an experienced inspection report team, not like one free-form prompt.

Use this mental model:

```text
Report Director
  -> Section Planner
  -> Evidence Builder
  -> Retrieval Curator
  -> Tool Dispatcher
  -> Section Specialist Agent
  -> QA / Eval Agent
  -> Human Approval
  -> DOCX / PDF Compiler
```

The AI model can orchestrate and draft, but product correctness must come from:

- app-captured field data
- inspector voice/context input
- approved manual report inputs
- deterministic calculations
- deterministic layout rendering
- controlled precedent retrieval
- standards-aware rule checks
- human approval

## Lessons From Existing Agent Systems

Existing agentic systems are strongest when they do three things well:

1. **Tool control**

   The agent chooses a tool, passes structured arguments, reads structured output, and decides the next step.

2. **Role separation**

   A planner is not the same as a writer, a calculator, a renderer, or a reviewer.

3. **Guarded memory and retrieval**

   The agent retrieves only what is relevant and allowed, instead of dumping all context into every task.

We should copy those strengths.

We should avoid the common failure mode: one large agent with too much context, too many responsibilities, and no clear stop condition.

## System Hierarchy

### Level 0: Report Director Agent

Purpose:
- own the full report-generation run
- decide whether the job is ready to generate
- create the section generation queue
- enforce tenant, role, approval, and audit rules
- coordinate export to DOCX/PDF after approval

Input:
- report job ID
- actor context
- selected sections
- current report state

Output:
- generation plan
- section queue
- run status
- final export readiness state

Allowed tools:
- report job store
- authorization service
- section registry
- generation queue
- audit event writer

Must not:
- write section prose directly
- invent missing facts
- bypass section approval

### Level 1: Control Agents

These agents prepare and route work before vertical section agents draft anything.

#### 1. Report Classification Agent

Purpose:
- classify the report family and standard basis
- decide whether the job is API 653, EEMUA 159, API 650-related, or another report family
- choose the correct report template spine

Typical output:

```json
{
  "reportFamily": "api653_vertical_ast_internal_external",
  "primaryStandard": "API 653",
  "supportingStandards": ["API 650", "API 575", "EEMUA 159"],
  "templateKey": "api653-v10-internal-external"
}
```

#### 2. Section Planner Agent

Purpose:
- build the table-of-contents section list
- map sample report sections to platform section keys
- decide which sections can be generated from app data
- decide which sections need inspector voice/manual input
- decide which sections are template-only until more evidence is provided

Must produce:
- section key
- section title
- section type
- required evidence
- required tools
- approval requirements

#### 3. Evidence Pack Builder Agent

Purpose:
- collect only the relevant evidence for one section
- separate app facts, voice context, manual inputs, calculations, map artifacts, standards references, and precedent references

This is the most important anti-hallucination agent.

It should produce a section-level evidence pack:

```json
{
  "sectionKey": "roof-plate-thickness-measurements",
  "appFacts": [],
  "voiceFacts": [],
  "manualInputs": [],
  "calculationArtifacts": [],
  "mapArtifacts": [],
  "precedentHints": [],
  "standardsHints": [],
  "missingInputs": []
}
```

#### 4. Retrieval Curator Agent

Purpose:
- retrieve relevant precedent sections and standards snippets
- apply tenant/workspace/role filters
- avoid leaking full historical report facts into the new report

Retrieval rules:
- historical reports teach section style and structure
- standards/code documents teach technical requirements and terminology
- neither source can silently provide current inspection facts

#### 5. Tool Dispatcher Agent

Purpose:
- decide which deterministic tool must run before drafting
- call table, calculation, layout-map, photo, DOCX, and validation tools
- store artifacts with provenance

Good examples:
- roof UT section calls `utTable.compileRoofPlateTable`
- shell map section calls `layoutMap.renderShellFigure`
- recommendations call `assessment.evaluateThresholdRules`
- final export calls `docx.compileApprovedSections`

#### 6. Missing Input Agent

Purpose:
- explain missing fields in plain inspector language
- avoid confusing generic placeholders such as "source data"
- distinguish real missing data from already-imported app data

Example:

Bad:

```text
Roof Plate Thickness Measurements Source Data is missing.
```

Better:

```text
The Android export already contains the roof plate measurements.
No extra source input is required for this table. Approval can continue unless you want to add a report note such as worksheet number or inspector confirmation.
```

#### 7. Human Review Controller Agent

Purpose:
- manage section status
- enforce approve/reject/regenerate flow
- ensure only approved and selected sections are exported

Statuses:
- `not_started`
- `editing`
- `approved`

Use high-contrast UI mapping:
- black dot means not started
- yellow dot means editing
- green dot means approved

### Level 2: Vertical Section Agents

Each vertical agent owns one section family. It should have a narrow contract and a narrow tool list.

#### 1. Cover And Report Metadata Agent

Purpose:
- prepare title, client, tank, location, report number, revision, dates, prepared-by, reviewed-by

Data source type:
- app metadata
- report-side manual inputs
- tenant/workspace metadata

Must not:
- invent dates, approvers, client names, or revision numbers

#### 2. Table Of Contents Agent

Purpose:
- produce the section spine matching the selected sample/API report family
- keep section ordering aligned with the report template

Data source type:
- template registry
- selected approved sections
- generated document pagination

Must not:
- invent page numbers before final DOCX/PDF pagination exists

#### 3. Scope Of Inspection Agent

Purpose:
- draft concise scope bullets
- use API 653/report-family wording
- include only inspected components confirmed by app export or inspector context

Data source type:
- app task scope
- voice notes
- precedent style
- standards guidance

#### 4. Inspection And Maintenance Regime Agent

Purpose:
- summarize applicable inspection basis, prior regime, and maintenance context

Data source type:
- inspector voice/manual input
- prior report metadata if provided
- standards/report template

Missing behavior:
- if prior regime is unknown, generate a fillable template instead of pretending it is known

#### 5. General Tank Information Agent

Purpose:
- compile tank attributes and construction details into the sample-report format

Data source type:
- app metadata
- layout configuration
- manual inputs
- historical report fields if explicitly linked to the same tank

Special rule:
- if plate count, course count, or nozzle count can be derived from app layout configuration, use it before asking the user.

#### 6. Inspection Report Narrative Agent

Purpose:
- create the main narrative from observations, field findings, voice notes, and app facts

Data source type:
- app findings
- checklist notes
- voice transcript
- photo captions
- precedent style

Must not:
- create conclusions without evidence
- turn a checklist pass into an engineering assessment unless the rule allows it

#### 7. Roof UT Measurement Agent

Purpose:
- compile roof UT readings, min/max/average, and report table formatting

Data source type:
- app UT rows
- deterministic table compiler
- deterministic calculator

AI role:
- short intro/caption only

Must not:
- invent missing plate readings
- convert table values through prose-only formatting

#### 8. Shell UT Measurement Agent

Purpose:
- compile shell thickness measurements by course, lane, plate, or report-required grouping

Data source type:
- app UT rows
- shell layout geometry
- deterministic calculator

AI role:
- explain table scope and limitations

#### 9. Floor UT Measurement Agent

Purpose:
- compile floor/bottom plate readings and summary tables

Data source type:
- app UT rows
- floor layout geometry
- deterministic calculator

#### 10. Layout Map Agent

Purpose:
- render roof, shell, and floor layout figures consistent with the LAIQ inspection app export
- create figure captions and DOCX-safe image artifacts

Data source type:
- app layout configs
- app elements
- app UT anchors
- app findings
- approved report-side presentation overrides

AI role:
- caption and explanatory wording only

Must not:
- decide geometry
- move anchors without explicit override

#### 11. Findings And NDT Agent

Purpose:
- compile MPI, MFL, visual findings, repair marks, and linked evidence into report sections

Data source type:
- app findings
- linked UT rows
- photos
- layout anchors
- voice notes

Must separate:
- finding observation
- evidence
- recommendation
- pending confirmation

#### 12. Photographs Agent

Purpose:
- order photos, generate captions, and link photos to findings/sections

Data source type:
- app attachments
- finding links
- voice captions
- inspector edits

Must not:
- infer damage from image content unless an explicit image-analysis workflow is approved

#### 13. Checklist Agent

Purpose:
- create interactive checklist tables with selectable responses
- compare current checklist coverage against the sample report checklist

Data source type:
- app checklist rows
- checklist template registry
- manual overrides

#### 14. Repair Recommendation And API Assessment Agent

Purpose:
- generate recommendation wording and API assessment structure

Data source type:
- findings
- UT/calculation outputs
- explicit rule engine
- inspector voice/manual inputs
- standards guidance

Strict rule:
- recommendations must be evidence-backed.
- If app data is insufficient, generate a recommendation template and missing-input questions.

#### 15. Appendix And Worksheet Agent

Purpose:
- compile appendices, worksheet references, settlement/MFL/crawler/MPI pages, and supporting calculations

Data source type:
- app attachments
- external worksheets
- manual inputs
- deterministic table/figure tools

#### 16. Final DOCX/PDF Export Agent

Purpose:
- export only selected approved sections
- preserve report template formatting
- insert layout maps near relevant UT/inspection sections
- apply heading styles for user-generated TOC

Data source type:
- approved report snapshot
- selected export section list
- DOCX/PDF renderer

Must not:
- export unapproved drafts

### Level 3: Tool Agents

Tool agents are wrappers around deterministic services. They may be controlled by AI, but their outputs are code-generated.

#### App Import Tool Agent

Responsibilities:
- validate exported package
- normalize app export into report job model
- classify app data by section relevance

#### Voice Transcript Tool Agent

Responsibilities:
- ingest voice-to-text transcript
- split transcript into observations, context, uncertainty, and action items
- link transcript segments to report sections

Important:
- voice text is evidence, not automatically a final fact

#### KB Ingestion Tool Agent

Responsibilities:
- ingest approved historical reports
- parse report sections
- classify report family and standard basis
- chunk by section, page, table, figure, and appendix
- store metadata and embeddings

#### Standards Ingestion Tool Agent

Responsibilities:
- ingest licensed/internal standards references and public metadata
- classify clauses by topic
- provide short guidance summaries with provenance

Important:
- standards content should guide rules and wording.
- Do not copy protected standard text into client reports.

#### Table Compiler Tool Agent

Responsibilities:
- create report-grade tables from structured app data
- preserve row/column formatting
- add min/max/average where requested
- output HTML, JSON, and DOCX table blocks

#### Calculation Tool Agent

Responsibilities:
- calculate derived metrics
- version formulas
- produce reproducible JSON
- expose warnings and thresholds

#### Layout Renderer Tool Agent

Responsibilities:
- render shell, roof, and floor maps from deterministic geometry
- render SVG and DOCX/PDF-safe PNG
- include element, UT, and finding markers

#### Formatting Tool Agent

Responsibilities:
- apply report styles
- enforce heading classes
- enforce 1.5 line spacing for narrative
- enforce normal margins
- preserve bullet styles
- compile DOCX sections

#### Export Tool Agent

Responsibilities:
- compile selected approved sections
- include figures/tables in correct location
- output DOCX first, PDF later

### Level 4: QA And Evaluation Agents

QA agents decide whether output is safe for user review.

#### Evidence Grounding Agent

Checks:
- every factual claim has app, voice, manual, calculation, or approved precedent basis
- old report facts are not copied into the current report
- generated statements do not conflict with app data

#### Missing Data Judge Agent

Checks:
- missing inputs are real, not artifacts of bad section routing
- app-sourced measurements are not incorrectly marked pending
- the user is asked plain-language questions

#### Format Compliance Agent

Checks:
- section heading format
- bullet style
- table structure
- line spacing
- layout map placement
- DOCX heading styles

#### Standards Reasoning Agent

Checks:
- recommendations cite the correct standard family internally
- standards guidance is not overclaimed
- threshold-based logic uses explicit calculator/rule outputs

#### No-Leak Eval Agent

Checks:
- generated output did not use hidden gold-report content in evaluation
- retrieved precedent is used only as style/structure unless it is explicitly linked current-tank history

#### Regression Eval Agent

Checks:
- current output compared to gold sample target
- score by section
- records prompt, retrieval, tool, and template version
- prevents changes from breaking previously good sections

## Section Data-Type Classification

Every section should be classified before generation.

### Class A: App-Structured Sections

Primary source:
- LAIQ inspection app export

Examples:
- UT measurement tables
- checklist rows
- layout maps
- findings inventory
- photo attachments
- tank/layout metadata

Generation rule:
- deterministic tools first
- AI only captions, summaries, and explanation

### Class B: Voice/Manual Context Sections

Primary source:
- inspector voice transcript
- inspector manual input
- reviewer notes

Examples:
- inspection narrative
- access limitations
- test conditions
- repair history
- site observations

Generation rule:
- AI drafts from transcript and template
- missing facts remain open questions

### Class C: Template/Standards Sections

Primary source:
- report template
- standard guidance
- precedent pattern

Examples:
- scope language
- inspection regime template
- recommendation section structure
- appendix introductions

Generation rule:
- generate template-complete wording
- fill only confirmed current facts
- keep unknown site-specific items pending

### Class D: Hybrid Engineering Judgment Sections

Primary source:
- app data
- calculations
- findings
- standards/rules
- inspector approval

Examples:
- repair recommendations
- API assessment
- fitness/acceptance statements

Generation rule:
- deterministic rules and calculations first
- AI explains only approved conclusions
- human approval required

## Agent Contract Template

Every agent should have an implementation contract.

```json
{
  "agentKey": "roof-ut-measurement-agent",
  "agentType": "vertical_section_agent",
  "ownsSections": ["roof-plate-thickness-measurements"],
  "allowedInputClasses": ["app_structured", "calculation", "manual_note"],
  "requiredEvidence": ["utMeasurements.roof"],
  "allowedTools": [
    "utTable.compileRoofPlateTable",
    "utCalculator.summarizePlateRows",
    "formatting.renderDocxTable"
  ],
  "forbiddenActions": [
    "inventMeasurementValues",
    "copyGoldReportValues",
    "changeLayoutGeometry"
  ],
  "outputSchema": "SectionDraftV1",
  "evalRubric": "RoofUtMeasurementEvalV1",
  "approvalPolicy": "human_required"
}
```

## Orchestration Flow

### Generate Selected Sections

```text
User selects sections
  -> Report Director validates job and actor
  -> Section Planner builds queue
  -> For each section:
       Evidence Pack Builder collects inputs
       Tool Dispatcher runs deterministic tools
       Retrieval Curator fetches precedent/standards
       Section Specialist drafts section
       QA/Eval agents score output
       Draft stored as editing state
  -> User reviews, edits, and approves
```

### Export Final DOCX

```text
User clicks Generate Final DOCX
  -> Export modal shows approved sections only
  -> User selects approved sections
  -> Export Agent compiles selected sections
  -> Formatting Tool applies report styles
  -> Layout Renderer inserts figures near UT/map sections
  -> DOCX generated
```

## Training And Tuning Loop

The training target is the system behavior, not the base model first.

Use this loop:

1. Choose one sample report section as the gold target.
2. Pair it with app export data and voice transcript.
3. Remove selected site-specific text from the input.
4. Run the section agent.
5. Evaluate factual grounding, formatting, completeness, and missing-field behavior.
6. Save prompt, template, retrieval settings, and tool versions.
7. Promote the configuration only after repeated pass results.

## Implementation Roadmap

### Milestone 1: Agent Registry

Build:
- `agentRegistry`
- section-to-agent map
- agent contracts
- allowed tool list
- forbidden action list

### Milestone 2: Evidence Pack Builder

Build:
- section-specific evidence extraction
- full-report context lookup
- app/voice/manual/KB separation
- missing-input classification

### Milestone 3: Deterministic Tool Contracts

Build:
- UT table compiler contract
- layout renderer contract
- calculation contract
- DOCX table/figure contract

### Milestone 4: Three Pilot Agents

Start with:
- General Tank Information Agent
- Roof/Shell/Floor UT Measurement Agents
- Inspection Report Narrative Agent

These cover the three hardest patterns:
- structured app data
- deterministic calculations/tables/maps
- voice and narrative generation

### Milestone 5: Eval Harness

Build:
- gold target section fixtures
- hidden-input tests
- no-leak tests
- format scoring
- regression dashboard

### Milestone 6: Section-by-Section Expansion

Expand after the first three agents are reliable:
- checklist
- findings
- photographs
- layout map pages
- repair recommendations
- appendices

## Product Guardrails

Use these as hard product rules:

- app-captured data is not optional for app-structured sections
- AI must not invent measurement values
- layout geometry must be deterministic
- historical reports are precedent, not current facts
- standards are guidance, not copied report text
- every section needs an evidence pack
- every generated section needs an eval score
- every final export section must be user approved

## Short Summary

The agentic system should be built as a hierarchy.

One orchestrator controls the job.

Vertical section agents draft only their own sections.

Tool agents perform deterministic work.

QA agents check grounding, format, and missing data.

The human remains the final approver.

This is the right structure for making the system improve over time without losing control of inspection facts or report quality.

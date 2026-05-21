# Technical Architecture

This document turns the report-generation plan into a concrete system shape for implementation.

## Product direction

The report platform should feel simple to the user, but it should not be a free-form chatbot with hidden behavior.

The right model is:

- chat-first
- form-backed
- calculation-backed
- retrieval-assisted
- strongly guarded

In practice, the system should combine structured workflows with conversational guidance.

## System layers

The platform should be split into six technical layers.

### 1. Package ingest layer

Responsibilities:

- accept canonical package ZIP or JSON
- unzip attachments
- validate schema
- validate attachment references
- normalize to an internal `ReportWorkspace`

Primary input:

- `packages/canonical-schema/inspection-package.schema.json`

Primary output:

- normalized report workspace record

### 2. Workspace data layer

This is the source of truth for the active report job.

It should store:

- canonical package snapshot
- normalized measurement summaries
- checklist answers
- inspector-entered metadata
- calculation inputs
- calculation outputs
- section statuses
- draft narratives
- provenance/audit metadata

Important rule:

Captured inspection data should remain structured application data, not just vectorized text blobs.

### 3. Retrieval layer

This layer should help the LLM, not replace the workspace data layer.

It should index:

- API standards sections
- IRS sample reports
- approved historical reports
- internal checklist/reference snippets

It should not be the primary store for:

- measurement rows
- findings
- calculations
- section completeness state

Recommended storage split:

- relational/document store for workspace facts
- vector store for standards and report-example retrieval

### 4. Deterministic calculation layer

Responsibilities:

- minimum shell thickness calculations
- corrosion rate calculations
- remaining life calculations
- interval support logic
- later, settlement-derived interpretation helpers

This layer should expose auditable inputs and outputs.

The LLM may explain its outputs, but must not replace them.

### 5. LLM orchestration layer

Responsibilities:

- section-specific prompt assembly
- retrieval selection
- evidence packaging
- narrative generation
- consistency checks

The LLM should receive:

- structured facts from the workspace
- deterministic calculation outputs
- retrieved standards snippets
- retrieved report-style examples when useful

The LLM should not receive raw standards dumps or be asked to invent missing facts.

### 6. Presentation layer

Responsibilities:

- chat-led workspace UI
- checklist/forms UI
- layout map rendering
- section preview
- final HTML/PDF rendering

## Retrieval strategy

### What to index

Index these as chunked retrieval documents:

- API 653 sections
- API 575 sections
- later other standards sections
- sample report sections
- historical report sections
- internal checklist fragments

Recommended metadata per chunk:

- source document
- section title
- section number
- topic tags
- tank type tags
- inspection type tags
- surface tags such as shell / roof / bottom

### What not to index as primary truth

Do not make the vector index the primary source for:

- UT readings
- nozzle tables
- finding locations
- layout coordinates
- calculation outputs

Those should stay in structured workspace tables/models.

## Guard rails

Guard rails must be a first-class subsystem.

### Ingest guard rails

- reject invalid schema
- reject broken attachment references
- flag missing required sections
- flag unsupported package versions

### Drafting guard rails

- block drafting if required calculation inputs are missing
- block drafting if selected sections lack minimum evidence
- mark sections as `auto`, `partial`, `manual required`, or `blocked`
- capture provenance for each draft section

### Standards guard rails

- retrieve only small relevant sections
- keep document source and section references
- paraphrase in output instead of copying long standards text

### Human review guard rails

- never auto-finalize the report
- require explicit user review before export
- show section-by-section confidence and missing-data states

## Recommended workspace model

The central domain object should be a `ReportWorkspace`.

Suggested top-level areas:

- `workspaceMeta`
- `canonicalPackage`
- `normalizedInspection`
- `inspectorInputs`
- `checklist`
- `calcInputs`
- `calcOutputs`
- `layoutScenes`
- `draftSections`
- `sectionStatus`
- `evidenceRegistry`
- `auditTrail`

## Suggested implementation sequence

### Phase 1. Workspace foundation

- upload package
- schema validation
- normalized workspace
- basic report shell

### Phase 2. Inspector inputs

- checklist form
- report metadata form
- assumptions form

### Phase 3. Calculations

- shell thickness calculations
- corrosion and remaining life
- interval support

### Phase 4. Layout rendering

- shell renderer
- roof renderer
- finding markers
- preview/export snapshots

### Phase 5. LLM drafting

- section prompts
- retrieval hooks
- narrative generation

### Phase 6. Export

- HTML report preview
- printable PDF

## Initial technical fit for this repo

This repo already has a React + Vite + TypeScript web stack at the root.

That makes the report platform a good fit for:

- React
- TypeScript
- Vite

The report lane should remain separate from Android app code, but it should reuse:

- canonical schema definitions
- example package fixtures
- shared report-facing types where practical

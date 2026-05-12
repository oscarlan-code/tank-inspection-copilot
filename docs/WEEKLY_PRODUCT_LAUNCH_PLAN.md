# Weekly Product Launch Plan

## Launch intent

Target a first **prototype launch** by **May 25, 2026**.

This is not the full commercial release. It is the first product-build milestone that proves:

- local-first field capture
- canonical package export
- canonical package upload
- report-preview generation

## Product split

### 1. Local-first field application

- primary target: Android tablet
- air-gapped / no live connectivity required
- local storage is the source of truth during inspection

### 2. Connected reporting platform

- upload canonical inspection package later
- validate package
- generate report draft / preview
- archive inspection package

### 3. iOS lane

- iOS is a demo lane for now
- it follows the same workflow and canonical contract
- it is not the primary robustness target in this first launch window

## Week 1: May 12 to May 18

### Goal

Freeze architecture and start the real product lanes.

### Deliverables

- repo split is clear:
  - `src/concept/`
  - `apps/field-android/`
  - `apps/report-platform/`
  - `packages/canonical-schema/`
- canonical inspection-package schema v1
- Android field-app architecture agreed
- report-platform architecture agreed
- first product backlog cut to prototype scope

### Build work

#### Field app

- define screen list for product build
- define local storage model
- define attachment model
- define inspection lifecycle states

#### Schema

- lock package envelope
- lock key entities:
  - inspection
  - tank master
  - shell line plan
  - roof layout
  - nozzle registries
  - UT rows
  - findings
  - photos
  - MFL metadata

#### Report platform

- lock ingestion flow
- lock validation checkpoints
- lock first report-preview sections

### Exit criteria

- one canonical schema exists in repo
- one example inspection package exists in repo
- README clearly differentiates concept vs product
- no ambiguity about Android-first local-first architecture

## Week 2: May 19 to May 25

### Goal

Produce the first end-to-end prototype launch.

### Deliverables

- Android app skeleton with first local inspection flow
- package export stub from the field app lane
- report-platform upload and preview stub
- one end-to-end sample package -> preview path
- iOS demo scope defined and reduced to presentation-critical flows

### Prototype scope

#### Field capture

- inspection setup
- inspection scope
- task board
- shell UT basic path
- roof UT basic path
- finding with photo
- local save / reopen

#### Package handoff

- export canonical package
- attachments manifest
- local package validation

#### Reporting

- upload package
- render preview sections:
  - tank summary
  - shell UT table
  - roof UT table
  - findings register
  - linked photos

### Exit criteria

- one prototype inspection can be completed locally
- canonical package can be exported
- canonical package can be uploaded
- report preview can be generated from the uploaded package

## Week 3 to Week 6

### Week 3

- shell line planning
- shell map refinement
- autosave hardening
- crash / resume behavior

### Week 4

- roof layout templates
- roof feature layer
- nozzle registry rules

### Week 5

- shell nozzle workflow
- roof nozzle workflow
- sketch vs explicit placement

### Week 6

- MFL metadata flow
- review rules
- completeness checks
- export stabilization

## Week 7 to Week 10

### Week 7

- report section mapping
- UT tables
- findings register
- linked evidence sections

### Week 8

- report draft generation
- figure generation
- layout images in report flow

### Week 9

- Android hardening
- larger inspection datasets
- attachment reliability

### Week 10

- pilot readiness
- demo packaging
- UAT fixes

## Working rule

Build the real product in `apps/` and `packages/`.

Use `src/concept/` only to preserve and evolve the concept reference.

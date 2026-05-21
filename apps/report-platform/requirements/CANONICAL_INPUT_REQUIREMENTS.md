# Canonical Input Requirements

This document defines the minimum input contract for the report-generation web lane.

It is the bridge between:

- Android field capture export
- inspector-entered web form inputs
- deterministic calculation services
- LLM-assisted report drafting

## Current canonical anchor

The primary machine-readable source is:

- `packages/canonical-schema/inspection-package.schema.json`

The current export version is:

- `schemaVersion = 0.1.0`

## Input groups

The report platform should treat inputs as four separate groups.

### 1. Canonical package from the field app

Required from Android export:

- inspection metadata
- tank master
- unit profile
- shell line plan
- roof layout and roof surface layouts when present
- nozzle registries
- measurement rows:
  - shell UT
  - roof UT
  - shell nozzle UT
  - roof nozzle UT
- findings
- attachments
- shell settlement survey when captured
- roundness survey when captured
- plumbness survey when captured
- MFL metadata when attached
- review status and warnings

The report platform should never depend on hidden Android UI state. It should only consume exported package data.

### 2. Inspector-entered web inputs

These are not reliably available from the app today and should be captured in the report workflow:

- report number / revision / issue date
- client representative
- prepared by / reviewed by / approved by
- report scope overrides
- checklist answers
- general tank information not captured in the app
- engineering assumptions
- narrative comments
- limitation statements
- recommendation overrides

### 3. Deterministic engineering inputs

Some calculations require inputs beyond raw captured readings:

- original or nominal thickness where known
- year built
- years in service or inspection date basis
- material specification when known
- design/service liquid height
- corrosion allowance assumptions
- product/service context
- similar-service inputs when used
- client inspection interval constraints

### 4. Standards reference inputs

The platform should use internal reference material from the client-standard library, including:

- API 653
- API 575
- API 650 where needed for referenced shell details
- client checklist expectations derived from IRS reporting practice

These references should support traceable rule application, not free-form copy/paste into output.

## Output boundary

The report platform should produce:

- structured section data
- deterministic calculations
- LLM-assisted narrative drafts
- HTML preview
- PDF output
- audit metadata for later review

## Validation rules

Before report drafting starts, the platform should validate:

1. schema validity
2. attachment reference consistency
3. required task presence for selected report sections
4. inspector-side required web inputs
5. calculation prerequisite completeness

If a section cannot be drafted from current inputs, it should be marked as:

- `ready`
- `partial`
- `manual required`
- `blocked`

## Build rule

The canonical package is the transport contract.

The report lane may enrich, normalize, and supplement it, but it should not redefine or bypass that contract.

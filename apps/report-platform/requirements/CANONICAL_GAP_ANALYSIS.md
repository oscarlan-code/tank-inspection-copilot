# Canonical Gap Analysis

This document compares the current Android export package to the needs of the web report generator.

## Strongly covered by the current package

The current canonical package already provides good support for:

- inspection identity
- client / site / tank number
- tank geometry
- shell line plan
- roof layout
- roof surface layouts
- nozzle registries
- shell UT rows
- roof UT rows
- shell nozzle UT rows
- roof nozzle UT rows
- findings
- attachments
- shell settlement survey
- roundness survey
- plumbness survey
- MFL metadata attachment reference
- review status and warnings

These should be treated as trustworthy report inputs once schema validation passes.

## Partially covered by the current package

These exist in some form, but may need enrichment or normalization in the report lane:

- roof-type detail versus final report wording
- reference system wording
- finding location summaries versus formal report locations
- attachment captions and report-facing evidence labels
- survey interpretation versus raw captured values
- MFL handling, because current app scope only supports metadata + attached PDF

## Missing from the current package for IRS-style reporting

These should be collected in the web report workflow rather than forced into v1 Android changes:

- report number / revision control
- issue date
- prepared by / reviewed by / approved by
- client representative
- checklist responses
- narrative inspection observations not fully represented as findings
- original thickness when not inferable
- year built where absent
- service-height assumptions
- material specification when known
- client policy constraints for interval decisions
- recommendation acceptance / override notes
- limitation statements

## Out of scope in the app today

These are real report sections, but the current app does not capture them deeply enough for full automation:

- floor UT workflow
- floor platemap numbering workflow
- floor repair planning workflow
- raw MFL interpretation workflow
- detailed floor corrosion mapping

The report lane should label these sections as manual or deferred instead of pretending they are automatically generated.

## Recommended handling strategy

### Keep in Android export

Do not move these out of the app:

- measurement rows
- captured findings
- linked attachments
- roof and shell layout context
- survey data

### Complete in the web report workflow

Capture here:

- checklist
- document control
- assumptions
- calculation prerequisites
- final narrative edits
- recommendation approval

### Add to Android later only if repeated pain appears

Possible future Android additions:

- structured checklist capture
- richer document-control fields
- floor plate markout and UT capture
- more explicit calculation inputs

## Working rule

The report platform should be honest about source quality:

- use app data where the app is strong
- use web form completion where the app is intentionally light
- leave unsupported sections manual until the capture lane grows

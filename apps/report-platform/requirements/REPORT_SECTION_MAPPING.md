# Report Section Mapping

This document maps the IRS-style report structure to source data and generation mode.

The section model below is based primarily on the `16TJS4 -1 TK 465 Internal & External Inspection Report`.

## Section mapping

| Sample section | Primary source | Generation mode | V1 status |
| --- | --- | --- | --- |
| Cover / title / report header | Inspector web input + package inspection meta | Deterministic template | Included |
| Scope of inspection | Template + selected package tasks + inspector edits | Template + light LLM polish | Included |
| Inspection and maintenance regime | Internal standards text + template | Mostly fixed template | Included |
| General tank information | Package tank master + inspector web input | Deterministic table/block | Included |
| Inspection report narrative | Findings + checklist + measurements + attachments | LLM draft from structured evidence | Included |
| Repair recommendations / API assessment | Calculations + findings + standards rules + inspector override | Deterministic support + LLM draft + human review | Partial |
| Test information | Measurements + package metadata | Deterministic tables | Included |
| Tank inspection checklist | Inspector web input | Deterministic form output | Included |
| Roof plate thickness measurements | Package roof UT rows | Deterministic table | Included |
| Roof plate layout | Package roof layout / surface layout | Deterministic render | Partial |
| Roof nozzle & pad thickness | Package roof nozzle registry + UT rows | Deterministic table | Included |
| Minimum shell thickness calculations | Package shell UT + manual calc inputs | Deterministic calculations | Included |
| Shell plate thickness measurements | Package shell UT rows | Deterministic table | Included |
| Shell plate layout | Package shell line plan + course structure | Deterministic render | Partial |
| Shell nozzle & pad thickness | Package shell nozzle registry + UT rows | Deterministic table | Included |
| Photographs | Package attachments + linked findings | Deterministic evidence gallery | Included |
| Floor plate layout / platemap numbering | Manual or third-party input | Manual / deferred | Deferred |
| Floor recommended repair locations | Manual or third-party input + future rules | Manual / deferred | Deferred |
| Tru-flux / MFL interpretation guidance | Third-party MFL report + manual review | Manual / deferred | Deferred |
| Floor corrosion plan / MFL platemaps | Third-party artifacts | Attachment / manual | Deferred |

## Practical interpretation

Three groups matter most.

### Fully app-driven today

These sections can already be populated primarily from the Android package:

- general tank information
- shell UT
- roof UT
- nozzle UT
- findings
- attachments
- review status

### App + web form hybrid

These sections need package data plus inspector-side completion:

- cover / revision control
- checklist
- narrative inspection report
- recommendations
- calculations that require original thickness or service assumptions

### Still outside current app scope

These sections should be intentionally treated as manual or deferred:

- floor layout
- floor UT workflow
- MFL analytics
- floor repair planning

## Build rule

The generator should mark each section explicitly as:

- `auto`
- `auto + review`
- `manual`
- `deferred`

That visibility will prevent the system from pretending it can fully automate sections that the current field app does not yet support.

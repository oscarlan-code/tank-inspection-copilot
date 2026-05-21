# Report Template Alignment

This document locks the report-platform section order to the real IRS sample report:

- source report: `16TJS4 -1 TK 465 Internal & External Inspection Report.pdf`
- current product branch: `feat/report-generation-web`

The goal is simple:

- the web workspace should feel like the real report
- unsupported sections should stay visible, not disappear
- the user should be able to justify the format section by section

## Real sample report order

1. Scope of Inspection
2. Inspection and Maintenance Regime
3. General Tank Information
4. Inspection Report
5. Repair Recommendations / API 653 Assessment
6. Test Information
7. Tank Inspection Checklist
8. Roof Plate Thickness Measurements
9. Roof Plate Layout
10. Roof Nozzle & Reinforcement Pad Thickness Measurements
11. Minimum Shell Thickness Calculations
12. Shell Plate Thickness Measurements
13. Shell Plate Layout
14. Shell Nozzle & Reinforcement Pad Thickness Measurements
15. Photographs
16. Floor Plate Layout with Platemaps Numbering System
17. Floor Recommended Repair Locations
18. Guidelines for the Interpretation of the TRU-FLUX Data Sheets
19. Floor Plate Corrosion Plan
20. Magnetic Flux Leakage Platemaps

## Current platform support by section

### Ready now

These sections already have useful app-fed or workspace-fed grounding:

- `1 Scope of Inspection`
- `3 General Tank Information`
- `4 Inspection Report`
- `6 Test Information`
- `7 Tank Inspection Checklist`
- `8 Roof Plate Thickness Measurements`
- `9 Roof Plate Layout`
- `10 Roof Nozzle & Reinforcement Pad Thickness Measurements`
- `12 Shell Plate Thickness Measurements`
- `13 Shell Plate Layout`
- `14 Shell Nozzle & Reinforcement Pad Thickness Measurements`
- `15 Photographs`

### Present but still manual or partial

- `2 Inspection and Maintenance Regime`
- `5 Repair Recommendations / API 653 Assessment`
- `11 Minimum Shell Thickness Calculations`

These sections should remain in the workspace so the final document keeps the right shape, but they still need:

- reviewer input
- deterministic calculations
- standards retrieval
- human approval

### Visible but blocked for now

- `16 Floor Plate Layout with Platemaps Numbering System`
- `17 Floor Recommended Repair Locations`
- `18 Guidelines for the Interpretation of the TRU-FLUX Data Sheets`
- `19 Floor Plate Corrosion Plan`
- `20 Magnetic Flux Leakage Platemaps`

These stay visible intentionally because:

- the real report includes them
- floor UT and MFL are deferred, not nonexistent forever
- hiding them would make the prototype feel misleadingly complete

## UX implications

The left navigator should:

- follow this real section order
- show `blocked`, `manual required`, and `auto + review` clearly
- let the user work section by section against a believable report structure

The center panel should:

- show the selected real report section
- allow edits, checklist work, or layout review depending on the section
- preserve the section identity while the user is refining it

The right AI rail should:

- operate only on the active section
- know what sources are allowed for that section
- know what that section must never invent

## Mockup data rule

The default demo workspace should stay grounded to the TK-465 style context:

- `TJS Pte Ltd (Chemstationasia Group)`
- `Tanjong Penjuru Terminal`
- `Tank No. 465`
- roof UT, shell UT, shell nozzle UT, findings, photographs

The mockup can stay synthetic in the row-level readings, but the section structure must follow the real report.

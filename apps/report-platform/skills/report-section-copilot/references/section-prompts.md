# Section Prompt Profiles

Use this file with the `report-section-copilot` skill.

Each section below defines the expected output shape. The AI should follow the active section profile before it defaults to generic prose.

## Section 01: Scope of Inspection

- Shape: job-scope checklist
- Default format: bullet list
- Writing pattern: one operational scope item per bullet, ideally action-led such as `To carry out ...`
- Include: only supported capture scope and confirmed deliverables
- Prefer: methods, covered areas, and deliverables, using meaningful coverage metrics like measured plate counts and readings-per-location profile when available
- Exclude: unsupported floor, MFL, or calculation scope unless the reviewer explicitly includes a deferred placeholder

## Section 02: Inspection and Maintenance Regime

- Shape: short policy/regime block
- Default format: compact paragraph or short sub-list
- Writing pattern: governing basis, regime context, limitations
- Include: confirmed API basis and reviewer-entered maintenance context
- Exclude: invented history, interval claims, or client assumptions

## Section 03: General Tank Information

- Shape: factual information block
- Default format: field-style lines
- Writing pattern: identity, geometry, dates, parties
- Include: exact captured identifiers and dimensions
- Exclude: interpretation, recommendations, or conclusions
- Prefer: one field per line over a loose narrative sentence

## Section 04: Inspection Report

- Shape: narrative findings summary
- Default format: short technical paragraphs
- Writing pattern: observations first, evidence second, limitations third
- Include: UT coverage, findings, linked evidence, reviewer notes
- Exclude: unsupported conclusions or recommendations

## Section 05: Repair Recommendations / API 653 Assessment

- Shape: assessment and recommendation block
- Default format: short paragraphs or numbered sub-points
- Writing pattern: finding, impact, recommendation, reviewer approval boundary
- Include: deterministic outputs and reviewer-approved evidence
- Exclude: final engineering approval language unless explicitly confirmed

## Section 06: Test Information

- Shape: concise methods summary
- Default format: short paragraph or tight list
- Writing pattern: who, when, what methods
- Include: actual inspection methods and dates from the package
- Exclude: methods not present in the data

## Section 07: Tank Inspection Checklist

- Shape: checklist outcome summary
- Default format: bullet list or grouped outcome block
- Writing pattern: passed items, needs-review items, unanswered items
- Include: actual checklist answers and notes only
- Exclude: fabricated answers

## Section 08: Roof Plate Thickness Measurements

- Shape: measurement-led commentary
- Default format: short intro plus table-supporting notes
- Writing pattern: coverage, notable observations, limits
- Include: actual roof UT rows and linked findings
- Exclude: invented plate references or original-thickness assumptions

## Section 09: Roof Plate Layout

- Shape: figure caption and interpretation support
- Default format: caption plus short support note
- Writing pattern: what the figure shows, how to read it
- Include: rendered roof markers, features, linked evidence
- Exclude: CAD claims beyond the renderer

## Section 10: Roof Nozzle & Reinforcement Pad Thickness Measurements

- Shape: nozzle measurement support section
- Default format: short paragraph or bullet list
- Writing pattern: coverage, nozzle context, data gaps
- Include: roof nozzle registry and UT rows
- Exclude: nonexistent pad readings

## Section 11: Minimum Shell Thickness Calculations

- Shape: formal calculations section
- Default format: equation/table support with restrained notes
- Writing pattern: assumptions, result, interpretation
- Include: deterministic calculation outputs only
- Exclude: invented calculations

## Section 12: Shell Plate Thickness Measurements

- Shape: measurement-led commentary
- Default format: short intro plus table-supporting notes
- Writing pattern: shell coverage, lane/course context, notable observations
- Include: actual shell UT rows, line plan, linked findings
- Exclude: unsupported shell condition claims

## Section 13: Shell Plate Layout

- Shape: figure caption and interpretation support
- Default format: caption plus short support note
- Writing pattern: lanes, compass positions, findings, nozzles
- Include: current shell layout markers and known geometry
- Exclude: geometry not represented in the renderer

## Section 14: Shell Nozzle & Reinforcement Pad Thickness Measurements

- Shape: nozzle measurement support section
- Default format: short paragraph or bullet list
- Writing pattern: coverage, nozzle context, data gaps
- Include: shell nozzle registry and UT rows
- Exclude: nonexistent pad readings

## Section 15: Photographs

- Shape: evidence appendix support
- Default format: caption list or short grouped notes
- Writing pattern: what is shown and why it matters
- Include: uploaded attachments and linked findings only
- Exclude: unseen conditions

## Section 16: Floor Plate Layout with Platemaps Numbering System

- Shape: blocked/deferred placeholder
- Default format: one short explanatory block
- Writing pattern: why deferred, what is missing
- Include: honest blocked-state explanation only
- Exclude: fabricated floor layout content

## Section 17: Floor Recommended Repair Locations

- Shape: blocked/deferred placeholder
- Default format: one short explanatory block
- Writing pattern: why deferred, what is missing
- Include: honest blocked-state explanation only
- Exclude: fabricated repair locations

## Section 18: Guidelines for the Interpretation of the TRU-FLUX Data Sheets

- Shape: blocked/deferred placeholder
- Default format: one short explanatory block
- Writing pattern: why deferred, what is missing
- Include: honest blocked-state explanation only
- Exclude: fabricated TRU-FLUX interpretation

## Section 19: Floor Plate Corrosion Plan

- Shape: blocked/deferred placeholder
- Default format: one short explanatory block
- Writing pattern: why deferred, what is missing
- Include: honest blocked-state explanation only
- Exclude: fabricated corrosion plans

## Section 20: Magnetic Flux Leakage Platemaps

- Shape: blocked/deferred placeholder
- Default format: one short explanatory block
- Writing pattern: why deferred, what is missing
- Include: honest blocked-state explanation only
- Exclude: fabricated platemaps or labels

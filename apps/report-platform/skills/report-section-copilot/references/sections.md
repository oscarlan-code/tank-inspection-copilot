# Section Playbook

Use this file with the `report-section-copilot` skill.

Each section below defines:

- what the AI is allowed to use
- what the AI should help with
- what the AI must not invent

## Section 01: Scope of Inspection

- Use: package coverage counts, inspection type, review warnings, report structure.
- Help with: drafting the scope as a job-scope list, showing supported and deferred scope honestly.
- Never invent: floor UT or MFL completion.
- Format:
  - treat this as a scope checklist, not a narrative summary
  - prefer one bullet per scope item
  - each bullet should read like a task or deliverable, for example a `To carry out ...` statement
  - describe methods, coverage areas, and deliverables rather than meaningless exported row totals
  - when captured coverage is available, use useful scope metrics such as the number of measured roof plates or the readings-per-location profile
  - include only scope items supported by the captured data or explicitly confirmed by the reviewer
  - do not pad the section with generic narrative before or after the bullet list unless the reviewer asks for it

## Section 02: Inspection and Maintenance Regime

- Use: inspection type, reviewer-entered maintenance context, retrieved API guidance.
- Help with: concise regime wording and format.
- Never invent: maintenance history, intervals, or tank service assumptions.

## Section 03: General Tank Information

- Use: inspection metadata, tank master data, job identifiers.
- Help with: formatting and wording polish.
- Never invent: identity, geometry, or dates.

## Section 04: Inspection Report

- Use: measurement summaries, findings, attachments, warnings, confirmed reviewer notes.
- Help with: narrative drafting and evidence-grounded refinement.
- Never invent: conclusions unsupported by the package.

## Section 05: Repair Recommendations / API 653 Assessment

- Use: deterministic calculations, reviewer-approved findings, retrieved standards.
- Help with: wording, structure, and reviewer-facing refinement.
- Never invent: final engineering conclusions or approval decisions.

## Section 06: Test Information

- Use: methods present in the package, inspection dates, inspector identity.
- Help with: concise method summary.
- Never invent: methods not present in the package.

## Section 07: Tank Inspection Checklist

- Use: checklist answers and notes only.
- Help with: checklist summarization and highlighting unanswered items.
- Never invent: answers for unchecked lines.

## Section 08: Roof Plate Thickness Measurements

- Use: roof UT rows, linked findings, linked attachments.
- Help with: concise commentary and formatting.
- Never invent: plate IDs or original thickness assumptions.

## Section 09: Roof Plate Layout

- Use: roof layout geometry, roof markers, roof findings.
- Help with: captions and layout explanation.
- Never invent: missing roof entities or CAD-level detail not present.

## Section 10: Roof Nozzle & Reinforcement Pad Thickness Measurements

- Use: roof nozzle registry and roof nozzle UT rows.
- Help with: wording and missing-data clarity.
- Never invent: reinforcement-pad readings that are not present.

## Section 11: Minimum Shell Thickness Calculations

- Use: deterministic calculation outputs and confirmed assumptions.
- Help with: formatting and explanation once numbers exist.
- Never invent: calculation results from prose alone.

## Section 12: Shell Plate Thickness Measurements

- Use: shell UT rows, shell line plan, shell findings, linked photos.
- Help with: commentary and evidence-linked wording.
- Never invent: shell coverage or condition claims beyond the data.

## Section 13: Shell Plate Layout

- Use: shell layout markers, shell findings, shell nozzle positions, shell UT rows.
- Help with: layout captions and marker explanation.
- Never invent: shell geometry not represented in the layout view.

## Section 14: Shell Nozzle & Reinforcement Pad Thickness Measurements

- Use: shell nozzle registry, shell nozzle UT rows, inspector notes.
- Help with: concise summary and gap visibility.
- Never invent: reinforcement-pad measurements that are not present.

## Section 15: Photographs

- Use: attachments, captions, linked findings.
- Help with: captioning and evidence organization.
- Never invent: photographs or observations not present in attachments.

## Section 16: Floor Plate Layout with Platemaps Numbering System

- Use: blocked-state explanation only.
- Help with: explaining why the section is deferred.
- Never invent: floor layout content.

## Section 17: Floor Recommended Repair Locations

- Use: blocked-state explanation only.
- Help with: listing prerequisites for future support.
- Never invent: repair locations without floor evidence.

## Section 18: Guidelines for the Interpretation of the TRU-FLUX Data Sheets

- Use: blocked-state explanation only.
- Help with: clarifying that TRU-FLUX interpretation is deferred.
- Never invent: MFL interpretation.

## Section 19: Floor Plate Corrosion Plan

- Use: blocked-state explanation only.
- Help with: clarifying missing prerequisites.
- Never invent: corrosion plan output without floor data.

## Section 20: Magnetic Flux Leakage Platemaps

- Use: blocked-state explanation only.
- Help with: clarifying that MFL platemaps are not available yet.
- Never invent: platemap content or labels.

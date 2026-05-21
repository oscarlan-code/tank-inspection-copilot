---
name: report-section-copilot
description: Use when refining or generating a single report section inside the report platform workspace. Keeps AI output scoped to the active section, grounded in allowed sources, honest about blocked floor or MFL sections, and aligned to the IRS sample report structure. Read `references/sections.md` and `references/section-prompts.md` to choose the right section workflow, guard rails, and output shape.
---

# Report Section Copilot

Use this skill for section-by-section report drafting inside the report platform.

The workspace model is:

- left rail chooses the active report section
- center panel is where the section is edited, reviewed, or rendered
- right rail AI should only act on that active section unless the user explicitly asks for broader work

## Core rules

1. Stay inside the selected section.
2. Prefer structured workspace facts over retrieved prose.
3. Use standards or sample reports as support, not as truth.
4. Never fabricate floor, MFL, or calculation content when those sections are blocked.
5. Do not silently convert a `blocked` or `manual required` section into `ready`.
6. In the refine workflow, first explain your understanding and any pushback before applying a section change.
7. Treat `references/section-feedback.json` as reviewer-confirmed memory for that section only.
8. Treat `references/section-logic-feedback.json` as a separate durable logic layer for that section, stronger than thumbs memory but still subordinate to captured facts and hard guard rails.
9. Use thumbs-up memories as patterns to preserve and thumbs-down memories as patterns to avoid, but never as permission to invent unsupported facts.

## Workflow

1. Identify the active section name and section number.
2. Read the matching section rule in `references/sections.md`.
3. Read the matching prompt profile in `references/section-prompts.md`.
4. Use only the allowed inputs for that section.
5. Apply one of these actions:
   - draft the section
   - explain your understanding of a requested refinement or feedback note
   - refine wording
   - tighten structure
   - summarize evidence
   - show missing inputs
   - compare the section against the sample report structure
6. Keep the output appropriate for the active section state:
   - `auto`: polish and verify
   - `auto + review`: draft carefully and highlight reviewer checks
   - `manual required`: ask for or preserve manual input
   - `blocked`: explain why the section cannot be drafted yet

## Output style

- Keep report wording neutral, technical, and concise.
- Tie statements back to measurements, findings, attachments, or confirmed reviewer inputs.
- If a section is not ready, say what is missing instead of bluffing.
- Follow the sample report section shape, not just its topic.
- If the sample section is list-led, table-led, or caption-led, preserve that structure instead of collapsing everything into a paragraph.

## References

- Read `references/sections.md` for the section-by-section playbook.
- Read `references/section-prompts.md` for the section-by-section output shape.
- Read `references/section-logic-feedback.json` only as durable section logic guidance that must remain grounded to real captured data.

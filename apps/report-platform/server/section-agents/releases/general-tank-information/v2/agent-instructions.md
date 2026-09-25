# Agent instructions

You own only report section `3 GENERAL TANK INFORMATION` for profile
`vertical_tank_inspection_v1`.

1. Accept only an evaluation execution envelope bound by a frozen ReportPlan and
   SectionPlan to `general_tank_information_v2`.
2. Read current facts only from the pinned app evidence snapshot and confirmed
   report-side General Tank Information fields.
3. Preserve the exact value, unit, source pointer and field order. App values win
   only when they are valid and do not conflict with duplicated task identity.
4. Accept historical facts only when they are explicitly confirmed report-side
   inputs for the same client, tank number and location.
5. Render exactly 31 labelled fields in the reviewed paired-row format, followed
   by the three previous-inspection-history fields.
6. Keep optional absent values visible as `Not recorded`. Never infer a missing
   current fact from a historical report, prompt, model, nearby section or global KB.
7. Block review on missing required identity, conflicting values or units,
   unconfirmed supplements, wrong-asset history, unsupported fields and unresolved
   General Information voice notes.
8. Escape all values before rendering. Do not execute markup from evidence.
9. Do not call AI, retrieval, network, storage or another section agent.
10. Return a typed SectionDocument, validation result, trace and field-level
    evaluation evidence. The draft must remain unapproved.

These instructions are implemented by deterministic code. They are not sent to a
language model.

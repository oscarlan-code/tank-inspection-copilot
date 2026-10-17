# Agent instructions

You own only `3 GENERAL TANK INFORMATION` for profile
`vertical_tank_inspection_v1`.

1. Accept only an evaluation execution bound to this exact release, a frozen
   ReportPlan/SectionPlan and a `section_agent_evidence_snapshot_v1`.
2. Read current values only from the routed `general-tank-information` projection.
3. Preserve the value, declared unit, source pointer, app provenance and reviewed
   31-field order.
4. Use the pinned alias map. Cross-check duplicate display fields against native
   numeric fields; conflicting values block generation.
5. Account for every projected record as rendered, corroborating or explicitly
   delegated. An unknown record blocks review.
6. Keep optional missing values visible as `Not recorded`; never infer them.
7. Escape all evidence and return an unapproved typed SectionDocument and trace.
8. Do not call AI, retrieval, network, storage, another section agent or evaluator.

These instructions are implemented by deterministic code and are not an LLM prompt.

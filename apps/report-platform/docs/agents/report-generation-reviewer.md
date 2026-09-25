# Report Generation Reviewer

Use this role to review generated report sections before implementation or handoff.

## Focus

- app-field facts are preserved
- manual inputs are respected
- missing required facts remain pending
- narrative does not invent measurements/findings
- section is selected by the reviewed ReportPlan and uses its exact agent binding
- historical section patterns and applicable API/technical obligations are pinned,
  traceable, and validated independently
- generated prose is concise and inspector-grade
- the section resolved to the expected immutable Section Generation Agent version
- evaluation and product traces identify the same agent, planner, formatter, KB,
  and dependency hashes
- another section's prompt, KB, or release cannot influence this section
- missing inputs remain visible and the section never falls back to the previous
  shared generator

## Output Format

Return findings first, ordered by severity.

For each finding include:

- section id/title
- issue
- evidence
- recommended fix
- validation command if applicable

If there are no findings, state the remaining residual risks.

# Report Generation Reviewer

Use this role to review generated report sections before implementation or handoff.

## Focus

- app-field facts are preserved
- manual inputs are respected
- missing required facts remain pending
- narrative does not invent measurements/findings
- section matches the API-standard report spine
- generated prose is concise and inspector-grade

## Output Format

Return findings first, ordered by severity.

For each finding include:

- section id/title
- issue
- evidence
- recommended fix
- validation command if applicable

If there are no findings, state the remaining residual risks.

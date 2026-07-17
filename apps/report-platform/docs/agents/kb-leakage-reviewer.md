# KB Leakage Reviewer

Use this role to review precedent KB, standards KB, recommendation KB, and leakage controls.

## Focus

- sample reports guide format only
- same-report gold answer text is excluded from generation
- generated content does not contain restricted sample identifiers
- standards/code references are not copied verbatim into final report prose
- historical same-customer facts are used only when allowed and clearly treated as reference
- eval uses reference text only after generation

## Output Format

Return findings first, ordered by severity.

For each finding include:

- leaked or risky content
- source path or section
- why it is risky
- recommended guardrail
- validation command

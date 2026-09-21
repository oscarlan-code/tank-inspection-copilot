# Section Agent Release Reviewer

Use this development role to review a Section Generation Agent release before
freeze, promotion, or version replacement.

## Focus

- the section ID and report profile resolve to an explicit version, never `latest`
- input schema, evidence roles, applicability, outline, format, output obligations,
  validators, prompt, historical pattern pack, standard obligation pack, renderer
  interface, and dependencies are pinned
- current facts come only from the pinned inspection or confirmed report-side input
- terminology assistance preserves the original inspector wording and uncertainty
- historical retrieval is section-scoped, provenance-bearing, gold-isolated, and
  never treated as a current fact or sufficient technical justification
- API/technical obligations identify the applicable edition, clause provenance,
  review state, missing engineering inputs, and conflict behavior independently of
  historical practice
- evaluation and product execute the same frozen bytes and shared pipeline contracts
- product eligibility comes from a server-owned promotion record, not the release,
  request body, app export, or evaluation result
- later agents and shared-module changes cannot alter frozen output
- browser/export formatting, human review, rollback, and residual limits are recorded
- missing bindings fail closed without legacy-generator fallback

## Output Format

Return findings first, ordered by severity. For each finding include the section,
release version/hash, violated contract, evidence, required correction, and the
validation needed before the next lifecycle state. If there are no findings, state
the remaining promotion and rendered-export risks.

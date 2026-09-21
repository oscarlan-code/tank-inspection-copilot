# Section agents

See [the section-agent release contract](../../SECTION_AGENT_RELEASES.md).

- `index.mjs`: explicit section/version registry; evaluation-only routing.
- `frozen-release.mjs`: checksum verification and candidate execution.
- `releases/general-tank-information/v1/`: immutable implementation, dependencies,
  no-retrieval KB policy and aggregate qualification receipt.
- `specs/vertical-tank-v1/`: uniform agent, isolated-KB and harness specifications
  for report sections 1–7; planned specifications are not executable releases.
- `test-fixtures/`: generic synthetic inputs safe for the public repository.

Never edit a released directory to develop another section. Add a new section's
directory and registry entry. Changes to this section require a new version.

This directory currently contains qualification evidence for the first agent, not
the complete rebuilt runtime. Its v1 wrapper still enters through the previous
shared generator and must remain immutable. A serving-capable successor must use a
ReportPlan-bound SectionPlan, separate historical `SectionPatternPack` and
`StandardObligationPack` bindings, the new integrator interface, and an explicit
promotion record. Missing bindings fail closed; do not call `server/generation.mjs`
as a fallback.

The private 10+1 report fixtures are deliberately not published here.

Build the private metadata-only section-pack candidate inventory with
`npm run kb:common-core:split`. Validate all seven folder contracts with
`npm run section-agent:common-core:audit`. Neither command promotes a KB pack or
enables product execution.

# Section agents

See [the section-agent release contract](../../SECTION_AGENT_RELEASES.md).

- `index.mjs`: explicit section/version registry; evaluation-only routing.
- `frozen-release.mjs`: checksum verification and candidate execution.
- `releases/general-tank-information/v1/`: immutable implementation, dependencies,
  no-retrieval KB policy and aggregate qualification receipt.
- `releases/general-tank-information/v2/`: ReportPlan-bound candidate with visible
  instructions, agent spec, KB and standard policies, and a lean harness.
- `specs/vertical-tank-v1/`: uniform agent, isolated-KB and harness specifications
  for report sections 1–7; planned specifications are not executable releases.
- `test-fixtures/`: one generic contract fixture for deterministic safety checks;
  it is not report-quality qualification evidence.

Never edit a released directory to develop another section. Add a new section's
directory and registry entry. Changes to this section require a new version.

This directory contains the first rebuilt execution slice, not a complete report
runtime. V1 remains immutable qualification evidence. V2 uses the minimum frozen
ReportPlan/SectionPlan route and exact registry binding, with an explicit
no-retrieval historical pack and not-applicable standard-obligation pack. It remains
evaluation-only until product routing, persistence, integration and canary controls
are implemented. Missing bindings fail closed; do not call `server/generation.mjs`
as a fallback.

The private 10+1 report fixtures are deliberately not published here.

Build the private metadata-only section-pack candidate inventory with
`npm run kb:common-core:split`. Validate all seven folder contracts with
`npm run section-agent:common-core:audit`. Neither command promotes a KB pack or
enables product execution.

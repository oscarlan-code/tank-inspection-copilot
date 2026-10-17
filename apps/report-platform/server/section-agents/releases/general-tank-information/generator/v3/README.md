# General Tank Information v3

Status: `evaluation_candidate`; product disabled.

V3 preserves the 31-field historical section format while consuming only the
frozen `section_evidence_projection_v2` produced by the Report Evidence Routing
Agent. It maps Android field names explicitly, retains app provenance and records
every routed evidence item as rendered, corroborating or delegated. An unknown
routed field blocks the draft rather than disappearing silently.

The compiler is deterministic. It uses no model, runtime retrieval, source report
or evaluator gold. Its output remains unapproved and must pass the independently
versioned reviewer before it can be displayed.

Run `npm run section-agent:general-info:v3:audit` from `apps/report-platform`.

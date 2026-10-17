# Evidence Atomizer v3

Status: evaluation candidate. Product use is disabled.

This tool consumes only a passed `sealed_classification_input_v1` package. It
accounts for every report-relevant native ProductStore collection and preserves
each original record, value, unit, relationship and JSON source pointer.

Structured records become deterministic atoms. Voice transcripts are divided into
exact sentence and independent-clause spans without rewriting. Semicolons and
comma-plus-conjunction, semicolon, and explicit “and the/a/an” boundaries are split so independently routable claims do
not reach the classifier as one atom. Semantic section classification happens in
the separate Contents Classification Agent. Operational validation and task-state
records receive explicit `control_metadata` atoms so the input denominator remains
auditable even though those atoms are excluded from report sections.


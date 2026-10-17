# Evidence Atomizer v1

Status: evaluation candidate. Product use is disabled.

This tool consumes only a passed `sealed_classification_input_v1` package. It
accounts for every report-relevant native ProductStore collection and preserves
each original record, value, unit, relationship and JSON source pointer.

Structured records become deterministic atoms. Voice transcripts are divided into
exact source spans without rewriting; semantic section classification happens in
the separate Contents Classification Agent. Operational validation and task-state
records receive explicit `control_metadata` atoms so the input denominator remains
auditable even though those atoms are excluded from report sections.


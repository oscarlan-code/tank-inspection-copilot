# Supporting contracts

These documents define platform services used by the report-generation pipeline.
They are active only within their named subsystem and cannot override the root
architecture or compiler contract.

- `platform/`: upload, identity, storage, deployment, and staging.
- `reporting/`: controlled editing, section formatting, layout maps, MFL, and export.
- `knowledge/`: source ingestion and governed knowledge-pack construction.
- `evaluation/`: offline truth/capture preparation and policy experiments.

For report-generation behavior, start at `../../REPORT_COMPILER_WORKFLOW.md`.

# LAIQ KB Ingestion Worker

This service converts one approved historical-report source into a reviewable,
versioned ingestion package. It uses Docling for document extraction and
LlamaIndex for governed transformations and report-aware chunk construction.

The worker does not publish content to the live KB and does not call an LLM by
default. Low-confidence extraction produces structured escalation requests.
An explicitly configured command provider can return derived annotations, but
those annotations never replace immutable source text.

## Commands

```bash
uv sync --dev
uv run kb-ingest ingest /path/to/report.pdf --output /tmp/laiq-ingestion
uv run kb-ingest validate /tmp/laiq-ingestion/manifest.json
uv run pytest
```

After the source has been copied to object storage, re-ingest with
`--source-object-key`, then store the package in the PostgreSQL review queue:

```bash
uv run kb-ingest publish-review /tmp/laiq-ingestion/manifest.json
```

This command cannot approve or publish the document for retrieval.

Optional AI escalation is fail-closed and must be enabled explicitly:

```bash
uv run kb-ingest ingest report.pdf \
  --output /tmp/laiq-ingestion \
  --allow-ai-escalation \
  --ai-command "/absolute/path/to/schema-constrained-provider"
```

The provider receives one JSON request on standard input and must return one
JSON `DerivedAnnotation`. AI output is stored separately from parsed source
blocks and is never retrieval-eligible without a later review/publish step.

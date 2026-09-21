# Product Storage Implementation

## Current Implementation Checkpoint

The active product path now uses:

- PostgreSQL-only transactional storage;
- S3-compatible source, evidence, and artifact storage;
- immutable app-export source objects with SHA-256 metadata;
- append-only inspection export revisions;
- report jobs pinned to one `import_id`;
- idempotent same-package re-upload;
- a new revision and report job when captured evidence changes.

Mac mini staging lifecycle and backup operations are documented in `MAC_MINI_STAGING.md`.

## Decision

The report platform uses PostgreSQL as its only transactional database. Development, automated audits, demos, and deployed environments all use the same database engine.

There is intentionally no embedded database fallback and no runtime database-driver switch.

## Implemented Baseline

- `DATABASE_URL` is required at API startup.
- PostgreSQL connections use a bounded pool.
- Versioned migrations run under a PostgreSQL advisory lock.
- Transactional tables cover tenants, workspaces, identities, roles, imports, report jobs, manual inputs, drafts, draft history, approvals, generation runs, eval runs, and layout overrides.
- Imported packages and structured orchestration payloads use `JSONB`.
- `pgvector` is enabled and tenant/workspace-scoped KB document and chunk tables are created.
- API and storage hardening tests use disposable PostgreSQL schemas under the normal least-privilege application database account.
- `storage:audit` rejects reintroduction of SQLite code, file paths, or database-driver switches.
- Section-draft updates require the current version and return a controlled `409 section_version_conflict` for stale edits.
- Section approval requires the exact persisted draft version and performs an atomic version-guarded update; stale tabs reload instead of approving newer content.
- Generation, restore, approval, and layout invalidation advance the stored section-draft version.
- Upload-session and evidence-object metadata are stored in PostgreSQL with account-scoped idempotency keys.
- Attachment binaries use S3-compatible object storage through server-issued opaque keys and short-lived signed URLs.
- Finalization independently streams each object and verifies SHA-256, byte size, and media type before importing the report.
- Evidence reads require normal report authorization and return short-lived signed URLs.
- Direct report-workspace MFL imports use the same S3-compatible boundary: source PDF, extraction manifest, transparent corrosion PNGs, immutable source-preview PNGs, and map manifest are persisted under opaque object keys.
- PostgreSQL stores the tenant/workspace/report/run ownership, media type, byte size, and SHA-256 for every MFL artifact.
- The local artifact root is temporary processing space only. Browser and DOCX reads resolve through PostgreSQL and checksum-verified object storage, with no local-disk durability fallback.

## Local Runtime

```bash
cd apps/report-platform
docker compose up -d postgres object-storage object-storage-init
export DATABASE_URL=postgresql://laiq_report_platform:laiq_local_product@127.0.0.1:55432/laiq_report_platform
export REPORT_PLATFORM_DB_SSL=disable
export REPORT_PLATFORM_S3_BUCKET=laiq-report-platform
export REPORT_PLATFORM_S3_ENDPOINT=http://127.0.0.1:59000
export REPORT_PLATFORM_S3_REGION=us-east-1
export REPORT_PLATFORM_S3_FORCE_PATH_STYLE=true
export REPORT_PLATFORM_S3_ACCESS_KEY_ID=laiq_local_object_admin
export REPORT_PLATFORM_S3_SECRET_ACCESS_KEY=laiq_local_object_password
npm run api
```

## Commercial Scale Target

- up to 200 report-platform users
- approximately 50 concurrent active editors
- multiple tenants and workspaces
- concurrent AI generation, export, indexing, and eval work

PostgreSQL provides the required transaction isolation, pooled connections, migration history, tenant filtering, backup/restore path, JSONB evidence storage, and vector retrieval foundation.

## Remaining Product Hardening

### Complete Concurrency Coverage

- require explicit current versions on manual-input and layout-override writes; section approval is implemented
- add idempotency keys to generation, import, approval, and export commands
- preserve the implemented section-draft conflict guard while extending it to every mutable report resource

### Object Storage Follow-Through

App-captured attachment ingestion and report-side MFL source/derivative persistence are implemented. MFL source PDFs remain a direct authenticated report-workspace input, not an Android upload. Continue moving final DOCX/PDF outputs, KB source files, and other generated figures to the same object-storage boundary, with lifecycle jobs for expired/abandoned uploads and retained published evidence.

### Queue Workers

Move generation, export, rendering, indexing, and eval work to durable queue jobs with idempotency keys, tenant/workspace scope, retries, and audit records.

### Database Security And Operations

- add PostgreSQL row-level tenant/workspace policies
- use separate migration and application database roles
- configure managed backups and restore drills
- monitor pool saturation, slow queries, locks, and storage growth
- rotate credentials through a cloud secret manager

## Validation

```bash
npm --prefix apps/report-platform run storage:audit
DATABASE_URL=... npm --prefix apps/report-platform run object-upload:audit
DATABASE_URL=... npm --prefix apps/report-platform run floor-corrosion:durability-audit
DATABASE_URL=... REPORT_PLATFORM_S3_BUCKET=... npm --prefix apps/report-platform run floor-corrosion:object-storage-audit
DATABASE_URL=... npm --prefix apps/report-platform run api:audit
npm --prefix apps/report-platform run build
npm --prefix apps/report-platform run logic:audit
STRICT_SAMPLE_LEAK=1 npm --prefix apps/report-platform run leak:audit
```

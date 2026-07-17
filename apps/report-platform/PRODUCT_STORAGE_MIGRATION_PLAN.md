# Product Storage Migration Plan

## Decision

The report platform should move from the current SQLite V1 Beta store to a product-standard Postgres backend before commercial customer rollout.

SQLite remains useful for:

- local development
- deterministic audits
- offline demos
- single-process internal validation

SQLite should not be the commercial multi-tenant primary database for the report generator.

## Commercial Scale Target

Initial commercial planning target:

- up to 200 report-platform users
- approximately 50 concurrent active editors/reviewers
- multiple tenants and workspaces
- section-by-section editing and approval
- background AI generation, DOCX export, KB indexing, and eval runs

This requires a backend that handles concurrent writes, auditability, tenant isolation, backup/restore, and future horizontal API scaling.

## Target Storage Architecture

Use three storage layers:

- Postgres: transactional product data
- pgvector: first production vector retrieval layer
- S3-compatible object storage: large immutable artifacts

Transactional Postgres should own:

- tenants
- workspaces
- users
- role memberships
- imports
- report jobs
- manual inputs
- section drafts
- section draft versions
- layout overrides
- review decisions
- generation runs
- eval runs
- audit events
- KB document and chunk metadata

Object storage should own:

- imported app export packages
- original attachments and photos
- source sample/reference PDFs
- OCR/text extraction artifacts
- rendered layout-map figures
- generated DOCX/PDF outputs
- debug screenshots when explicitly retained

## Why Postgres

Postgres is the right default for this product stage because it supports:

- concurrent editors
- robust transactions
- row-level tenant/workspace filtering
- migrations
- backup and restore
- connection pooling
- audit queries
- JSONB evidence payloads where needed
- pgvector retrieval for the first KB version

## Concurrency Model

Use section-level optimistic concurrency.

Recommended fields:

- `version`
- `updated_at`
- `updated_by_user_id`
- `approved_at`
- `approved_by_user_id`
- `source_package_fingerprint`

Write behavior:

- section draft updates include the expected current version
- stale edits return a controlled conflict response
- AI generation creates a new draft version rather than overwriting silently
- approval checks the latest draft version and required inputs
- undo/restore reads from version history

This avoids locking the whole report while different users work on different sections.

## Background Work Model

Long-running work should not happen inside normal request transactions.

Queue-backed jobs should handle:

- section generation
- final DOCX/PDF export
- layout-map figure rendering
- KB indexing
- eval runs
- leak audits

Each job should have:

- idempotency key
- tenant/workspace scope
- actor user id
- status
- input payload hash
- output artifact references
- error summary
- retry count

## Migration Phases

### Phase 0: Authentication And Tenant Boundary

Status: V1 Beta foundation implemented.

Implemented baseline:

- login gate and development-only sessions
- OIDC/JWT verification boundary
- server-side permission checks
- tenant/workspace-scoped report and import operations
- tenant/workspace-scoped private KB retrieval
- prevention of role provisioning from app export data

Remaining before commercial rollout:

- selected identity-provider browser flow
- account invitation and provisioning administration
- role-specific product screens
- Postgres-backed memberships and immutable access audit events

### Phase 1: Storage Boundary

Goal: wrap the current SQLite implementation behind a storage-provider interface.

Likely files:

- `server/store.mjs`
- new `server/storage/` modules
- API hardening tests

Validation:

```bash
npm --prefix apps/report-platform run build
npm --prefix apps/report-platform run logic:audit
npm --prefix apps/report-platform run api:audit
```

### Phase 2: Versioned Schema

Goal: move schema creation from inline `CREATE TABLE IF NOT EXISTS` into versioned migrations.

Likely files:

- `server/storage/migrations/`
- `server/store.mjs`
- migration runner script

Validation:

```bash
npm --prefix apps/report-platform run api:audit
```

### Phase 3: Postgres Adapter

Goal: implement the same report-store contract using Postgres.

Likely files:

- `server/storage/postgres-store.mjs`
- `server/storage/sqlite-store.mjs`
- `server/storage/index.mjs`
- `package.json`

Validation:

```bash
REPORT_PLATFORM_DB_DRIVER=postgres npm --prefix apps/report-platform run api:audit
```

### Phase 4: Object Storage

Goal: move large artifacts out of transactional storage.

Likely files:

- `server/object-storage/`
- import routes
- DOCX export route
- layout-map figure renderer

Validation:

```bash
npm --prefix apps/report-platform run report:eval
```

### Phase 5: Queue Workers

Goal: move generation/export/indexing/eval work out of synchronous API routes.

Likely files:

- `server/jobs/`
- generation route
- export route
- KB rebuild routes

Validation:

```bash
npm --prefix apps/report-platform run logic:audit
npm --prefix apps/report-platform run api:audit
```

### Phase 6: Tenant-Safe Production Hardening

Goal: enforce tenant/workspace authorization across all reads, writes, retrieval, generation, and export.

Likely files:

- `server/authz/`
- storage adapters
- API routes
- audit scripts

Validation:

```bash
STRICT_SAMPLE_LEAK=1 npm --prefix apps/report-platform run leak:audit
npm --prefix apps/report-platform run api:audit
```

## Acceptance Criteria

The migration is product-ready when:

- API routes work against Postgres
- SQLite remains available only for local/dev fallback
- 50 concurrent section-draft updates produce no lost updates
- stale writes return controlled conflict responses
- all generated outputs have version history
- approved sections cannot be overwritten silently
- final export uses approved selected sections only
- tenant/workspace filters are applied to every query
- object artifacts are not stored as large DB blobs
- generation/export/index/eval jobs are retryable and auditable

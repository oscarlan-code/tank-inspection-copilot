# Mac Mini Staging Runtime

The Mac mini is the current internal staging host for the LAIQ Report Platform. It runs the same PostgreSQL and S3-compatible storage boundaries intended for cloud deployment; it is not a separate application or SQLite fallback.

## Runtime Topology

```text
LAIQ inspection app
  -> authenticated API on Mac mini
  -> immutable app-export JSON in S3-compatible storage
  -> append-only export revision in PostgreSQL
  -> report job pinned to that revision
  -> deterministic tools / LAIQ AI Engine
  -> editable report drafts and approved DOCX outputs
```

PostgreSQL and MinIO run through `compose.yaml`. The API and built UI run as macOS LaunchAgents so Codex CLI remains available to the internal AI worker.

## First Installation

```bash
cd /Users/oscar/Code/tank-inspection-coplilot-app/apps/report-platform
npm run staging:env
npm run staging:install
```

`staging:env` creates an ignored, mode-`600` `.env` with random database and object-storage credentials. If Tailscale is available, Colima publishes MinIO through the host and signed URLs use the Mac mini Tailscale IP so Android can reach them. PostgreSQL remains loopback-only. Port `59000` must be limited to the trusted staging network by the Mac mini firewall.

The install command:

1. starts PostgreSQL and MinIO;
2. applies versioned PostgreSQL migrations on API start;
3. builds the production UI;
4. installs restartable API and UI LaunchAgents;
5. installs a daily 02:15 backup LaunchAgent;
6. waits for API dependency readiness and UI reachability.

## Status And Logs

```bash
npm run staging:status
curl http://127.0.0.1:8788/api/health
curl http://127.0.0.1:8788/api/ready
```

`/api/health` reports service and dependency state. `/api/ready` returns `503` unless PostgreSQL and S3-compatible object storage are both available.

Runtime logs:

```text
apps/report-platform/.data/runtime/api.stdout.log
apps/report-platform/.data/runtime/api.stderr.log
apps/report-platform/.data/runtime/ui.stdout.log
apps/report-platform/.data/runtime/ui.stderr.log
```

## Backups

```bash
npm run staging:backup
npm run staging:backup-verify -- /absolute/path/to/backup
```

Each backup contains:

- a PostgreSQL custom-format archive;
- every object-storage object;
- object keys, media types, byte sizes, metadata, and SHA-256 digests;
- a PostgreSQL archive checksum.

Verification checks the PostgreSQL archive catalog and every object byte count and checksum. Backups default to `.data/backups/` and are retained for 14 days.

Backups must eventually be copied off the Mac mini. A backup stored only on the same physical machine is not disaster recovery.

## Source Immutability

Every app import has:

- `inspection_id`: stable inspection identity;
- `revision_number`: monotonic revision within that inspection;
- `package_sha256`: semantic package fingerprint;
- `source_object_key` and `source_sha256`: immutable original app-package artifact;
- one report job pinned by `import_id`.

Re-uploading the same semantic package returns the existing revision and report job. Changed inspection evidence creates a new revision and a new report job. Existing report drafts are never silently rebound to changed source data.

The normalized package in PostgreSQL is read-only source evidence. Inspector inputs, AI drafts, layout overrides, approvals, and generated artifacts remain in separate tables.

## Cloud Transition

Cloud deployment replaces only the operators:

- Docker PostgreSQL -> managed PostgreSQL/pgvector;
- local MinIO -> managed S3-compatible storage;
- LaunchAgents -> container/service scheduler;
- local backup directory -> managed backups plus cross-region object retention.

The API contracts, immutable revisions, report-job pinning, and generation workflow remain unchanged.

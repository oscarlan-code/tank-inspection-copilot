# Report Platform

`apps/report-platform` is the product-standard web reporting lane for Tank Inspection Copilot.

It imports durable field capture output from the LAIQ inspection app V3 Product lane, combines it with report-side inputs and approved knowledge-base guidance, then produces browser previews and final DOCX/PDF-ready report outputs.

This is product-standard report infrastructure, not a prototype lane.

## Current Status

Current product status: `V1 Beta`.

V1 Beta is the first stable product baseline for the V10 API 653 internal/external vertical tank report workflow. It is ready for training, section-by-section evaluation, UI review, and backend hardening, but it is not the final production platform.

Core V1 Beta capabilities:

- Login-gated workspace with PostgreSQL-backed username/password credentials, persistent hashed sessions, and login throttling.
- Super Admin account-management screen for creating tenant/workspace accounts, assigning roles, resetting passwords, and disabling or reactivating access.
- Shared app/web credentials: an Inspector uses the same account to send a V3 export from the LAIQ inspection app and open the resulting report job in the browser.
- End-to-end V3 evidence ingestion through authenticated upload sessions, short-lived S3-compatible signed URLs, byte-for-byte SHA-256/size/media verification, and idempotent report finalization.
- Connected report inbox scoped by the authenticated user's tenant and workspace memberships; synthetic V10 data remains an explicit demo action only, with a stable account-owned copy so inspectors never share mutable demo drafts.
- Server-enforced tenant/workspace authorization for report import, access, editing, generation, approval, KB retrieval, and export.
- V10 LAIQ inspection app V3 export loading through the report-platform API.
- Browser authoring workspace with table-of-contents navigation, report workspace, and right-side LAIQ AI Engine assistant.
- Section-by-section generation with a selectable generation queue.
- Section status tracking: not started, editing, approved.
- Human approval gate before final report export.
- PostgreSQL optimistic concurrency for section saves and approval, including automatic reload when another session has changed the draft.
- Approved-section-only DOCX export flow.
- Deterministic UT measurement table generation from exported app rows.
- Deterministic checklist table generation from exported app checklist rows.
- Deterministic roof and shell rendering from app layout metadata. For V3 floor maps, the LAIQ inspection app owns the final deterministic SVG artifact in `layoutFigures[]`; browser preview and DOCX embed the same checksum-verified SVG bytes, while resolved polygons and coordinates are used only for selection and linked evidence overlays.
- Source-driven floor-corrosion composition: extract the original engineering layout page as sanitized vector geometry, preserve its symbols and seams, add grid-free MFL corrosion pixels to matched plate regions, review orientation, and render the same layered map in the browser and DOCX.
- Durable MFL artifact storage: the report-side source PDF, manifests, transparent overlays, immutable source previews, and optional source-layout vector are persisted to S3-compatible object storage with PostgreSQL ownership/checksum metadata; local files are temporary processing only.
- V3 app-generated floor mock: the mobile layout tool exports `resolvedGeometryVersion: 2`, resolved bounds and stable IDs for 24 bottom plates including `6.2a/6.2b`, all 10 resolved AR polygons and labels, S1-S8 element coordinates, and the app-owned SVG. A V3 import missing the geometry/figure contract, containing unsafe SVG, or carrying a mismatched SHA-256 is rejected instead of being reconstructed on the web.
- The app-owned floor SVG paints LAIQ-red AR seams after internal plates; report-platform must preserve that layer order in browser and DOCX output.
- DOCX-safe layout-map figure rendering for approved export.
- V3 `voiceNotes[]` context routing by workflow screen, card, target, item, and transcript status.
- Rich-text editing for generated report drafts.
- Selection-scoped LAIQ AI editing in Step 3: highlight narrative content, use Rephrase, Shorten, Enhance, To Points, To Text, or a custom instruction, preview the proposed replacement, then Accept, Try Again, or Cancel without changing unselected content.
- Backend draft-version history and restore support for assistant-applied edits.
- Controlled generated-content transform layer for exact text edits, scoped style edits, checklist marker changes, table formatting, and structured AI-planned draft updates.
- Precedent KB, standards KB, and fact-to-recommendation KB baselines.
- Super Admin KB Review workspace at `/admin/knowledge-base` with a governed queue, immutable source preview, extracted section/chunk inspection, quality findings, document/section classification, dataset-split assignment, quarantine/reject/reopen decisions, and an append-only review history.
- Super Admin Truth Case Builder inside Evaluation Lab with approved-source discovery, deterministic source-linked fact proposals, exact PDF page/region review, answerability classification, explicit approve/reject decisions, and immutable Truth Graph approval.
- Approved Truth Graphs are versioned JSON artifacts in S3-compatible object storage; PostgreSQL records their checksum and locks the Truth Case plus benchmark snapshot transactionally.
- Consolidated Super Admin Truth & Mock Data stage with automated date/fact drafting, optional corrections, eight user-selectable capture styles, deterministic seeds, protected-fact preservation, and automatically validated immutable S3 Capture Scenarios.
- Capture Variant output is the versioned `laiq_capture_scenario` contract only; the LAIQ inspection app owns materializing it and producing the real `v3_product_export` through App Round Trip.
- Two-stage KB publication safety: human approval records that a source is suitable for a knowledge lane, but keeps `retrieval_eligible = false` until a separate embedding/index publication worker validates citations, exclusions, and index readiness.
- PostgreSQL-backed system-level RL controller that automatically selects approved retrieval, prompt, and tool-route configurations from offline eval rewards.
- Quantified historical-report evaluation with retrieval Precision@3, Recall@3, MRR, nDCG@3, verifiable claim precision, and required app-fact recall.
- PostgreSQL-backed evaluation cases and reviewable relevance/fact labels for offline retrieval-policy learning.
- Strict sample-report leak audit, generation logic audit, API hardening audit, and report performance eval script.

The report compiler pipeline is:

```text
LAIQ app export
  -> authenticated JSON + evidence upload session
  -> S3-compatible object verification
  -> import adapter
  -> normalized report job
  -> evidence packs
  -> deterministic tools / constrained AI workers
  -> generated section drafts
  -> human review and approval
  -> DOCX/PDF export
```

## Architecture

The report platform is one complete product system. The inspector authoring
workspace is the primary workflow; authentication, ingestion, storage, AI,
layout/MFL, knowledge, evaluation, training, and RL are supporting subsystems.

- Whole-system authority: `SYSTEM_ARCHITECTURE.md`
- Product and workflow vocabulary: `PRODUCT_TERMINOLOGY.md`
- Documentation hierarchy and subsystem ownership: `DOCUMENTATION_INDEX.md`

Older full-system diagrams and early implementation plans are retained only as
historical design records. They do not override the current V3,
PostgreSQL/S3, inspector-copilot architecture.

## Mac Mini Staging

The current internal server is the Mac mini. It uses PostgreSQL and S3-compatible object storage, not a separate demo database pathway.

Operational commands:

```bash
npm run staging:env
npm run staging:install
npm run staging:status
npm run staging:backup
```

App exports are stored as immutable, checksum-verified source objects. PostgreSQL keeps append-only inspection revisions, and every report job pins one exact revision through `import_id`. A changed export creates a new revision/report job rather than replacing source data behind an existing draft.

See `MAC_MINI_STAGING.md` for service lifecycle, Tailscale access, logs, readiness checks, backups, and the cloud transition boundary.

## Product Boundary

The LAIQ inspection app V3 Product lane owns:

- durable field capture
- local-first task storage
- task recovery and export readiness
- structured export packages
- layout-map metadata, elements, findings, UT rows, checklist rows, app-captured attachments, and voice note metadata
- local attachment binaries, hashes, and byte sizes before upload

`apps/report-platform` owns:

- import and normalization of exported inspection packages
- report job management
- section generation and review workflow
- report-only narrative inputs
- report layout, formatting, page blocks, and DOCX/PDF assembly
- photo ordering and captions
- direct MFL plate-map upload, validation, extraction, placement review, and floor-corrosion composition
- recommendations formatting
- calculation worksheets and technical appendices
- knowledge-base retrieval and evaluation
- governed Super Admin knowledge-base review and classification
- final report export

Do not force full report presentation requirements back into the field app.

## Trusted Inputs

Primary import source:

- LAIQ inspection app V3 export package
- `packageType: "v3_product_export"`
- `schemaVersion: 3`

Current V10 fixture:

- `apps/report-platform/src/fixtures/v3-product-export-shell-internal.json`
- shared public copy: `/Users/oscar/Public/irs/mockup sample data/v10-laiq-inspection-app-export.json`

Fixture coverage:

- tenant, workspace, user, task, and inspection metadata
- validation and export-readiness state
- roof, shell, and floor layout configuration
- placed elements and layout anchors
- roof, shell, and floor UT measurements
- checklist rows and checklist section notes
- V3 voice note metadata, prepared mock transcripts, and voice-audio attachment references
- findings, finding notes, and attachment inventory

Important reference material:

- primary report precedent: `/Users/oscar/Public/irs/Sample Reports/22PE1-4 TK V10 Internal & External Inspection Report.pdf`
- sample report corpus: `/Users/oscar/Public/irs/Sample Reports/`
- standards/code corpus: `/Users/oscar/Public/irs/Codes/`
- checklist/fieldsheet reference: `/Users/oscar/Public/irs/Sample Reports/Pacific Energy Fieldsheet (Fullscope).pdf`

Safety rules:

- current report facts must come from the LAIQ app export or report-side user confirmation
- historical reports may guide format, structure, and approved recommendation patterns
- standards/code references may guide technical checks, but must not be copied verbatim into report text
- exact current gold-report text is excluded from generation retrieval
- sample-report identifiers must not leak into generated drafts, fixtures, or final report output

## UI/UX Model

The workspace is intentionally simple:

```text
Left report sections | Middle report workspace | Right LAIQ AI Engine
```

Left sidebar:

- follows the active API-standard table-of-contents spine
- shows one status dot per section
- black means not started
- yellow means editing
- green means approved

Middle workspace:

- Step 1: section-specific app/voice/guideline evidence input
- Step 2: layout map or visual evidence when applicable
- Step 3: generated report content editor and approval control
- Step 3 targeted editing appears beside highlighted narrative text and uses the same LAIQ AI Engine as the right-side assistant

Right sidebar:

- section-aware LAIQ AI Engine assistant
- missing-content helper
- formatting and refinement commands
- visible control trace for assistant-applied actions
- Apply/Cancel confirmation for planned non-trivial edits

Key UI principles:

- no AI generation on page load
- left, middle, and right panes scroll independently
- generated content is separate from raw evidence
- layout maps get wide visual space
- approval controls stay close to generated output
- stale tabs cannot approve a newer section version
- targeted edit proposals are bound to section, document, selection, and version hashes
- accepted targeted edits reopen approved output as editing and create a durable rollback version
- only approved sections can enter final export selection

## LAIQ AI Engine Control Model

The LAIQ AI Engine is both a generation orchestrator and a report-edit assistant.

Default runtime target:

- `REPORT_PLATFORM_CODEX_MODEL=gpt-5.6-sol`
- `REPORT_PLATFORM_CODEX_TIMEOUT_MS=120000`

The report-platform worker uses Codex CLI for the current internal phase. GPT-5.6 live-worker mode requires Codex CLI `0.144.0` or newer; if the local CLI is missing or too old, the API reports deterministic fallback mode instead of silently pretending live AI is running. This keeps demos stable while making the runtime status honest.

The product rule is:

```text
If the assistant says it changed generated output, it must return a controlled action.
```

Current controlled action paths:

- exact text replacement
- whole-section style changes
- table-scoped style changes
- checklist marker changes
- deterministic checklist table formatting
- deterministic measurement table formatting
- measurement evidence lookup
- structured AI-planned edit with user confirmation
- selection-scoped narrative rewrite with before-apply preview and protected-fact validation
- backend draft restore after applied edits

Every assistant control response can include:

- interpreted intent
- planner path
- risk level
- target section
- operation
- guardrails
- validation summary
- confirmation requirement
- undo snapshot status

For table-only requests, actions must be scoped to table cells rather than the full section. For example, "change font color of the table contents to red" becomes `apply_text_style(table)`.

## Knowledge Base And Evaluation

KB layers:

- precedent KB: section shape, wording pattern, report style, and formatting precedent
- standards KB: controlled technical guidance from codes/standards
- fact-to-recommendation KB: structured historical condition-to-recommendation pairs

Generated local indexes live under `apps/report-platform/.data/`, which is intentionally gitignored and rebuilt from the local corpus.

Eval and safety gates:

- generation logic audit checks deterministic measurement, map, checklist, chat-guard, and content-control behavior
- leak audit blocks restricted sample-report identifiers
- API hardening audit checks negative paths and export readiness
- report performance eval generates section-by-section scorecards against the reference workflow
- internal evaluation links pair immutable app packages with Hidden Gold and section-level relevance/fact labels
- the offline Training Harness Phase 1 persists Benchmark Snapshots, Truth Cases, reviewed truth facts, and answerability labels without exposing matching Hidden Gold to generation
- training/evaluation app packages must use the same authenticated V3 object-upload and import path as real inspections; bootstrap or direct database seeds are rejected as evaluation evidence
- all Capture Variants from one Truth Case share one dataset split and are macro-aggregated at case level before Policy Optimization
- benchmark roles and inspection-date cutoffs now prevent validation/hidden gold, matching case/rendition/hash identities, and future reports from entering evaluation retrieval before scoring
- report scorecards expose retrieval Precision@3, Recall@3, nDCG@3, verifiable claim precision, and required-fact recall
- contextual UCB explores only reviewed candidate configurations in super-admin offline episodes
- missing-input, unlabelled, and low-confidence episodes do not train the controller, while leakage and unsupported-fact risks force reward to zero
- live inspector generation uses an immutable production policy with exploration disabled
- policy promotion requires benchmark gates and super-admin confirmation; archived versions remain available for rollback

## Backend/API Baseline

The report platform uses PostgreSQL as its only transactional database in development, audits, and deployment. The API fails fast when `DATABASE_URL` is absent; there is no SQLite or selectable database-driver fallback.

Product-standard storage baseline:

- `Postgres` for transactional report, user, tenant, review, generation, and audit state, with versioned migrations and pooled connections.
- `pgvector` in the same Postgres system for tenant-scoped KB/vector retrieval.
- S3-compatible object storage for imported packages, source attachments, generated DOCX/PDF files, layout-map figures, and KB source documents.
- MFL browser and DOCX reads use checksum-verified object storage through tenant/workspace-authorized API routes, with no local artifact fallback.

Local PostgreSQL starts from `compose.yaml`; API and product audits run in disposable PostgreSQL schemas rather than a different test store or a privileged database-creation path.

Scale assumption for the commercial backend:

- up to 200 report-platform users in the first commercial stage
- approximately 50 concurrent active editors/reviewers
- multiple report jobs in progress across tenants/workspaces
- background AI generation, DOCX export, KB indexing, and eval jobs running without blocking interactive editing

Current API responsibilities:

- authenticate browser users with secure cookies and inspection-app users with short-lived bearer sessions
- manage accounts, roles, password resets, and active/disabled status for Super Admin users
- enforce role permissions and tenant/workspace boundaries
- bind inspection-app imports to authenticated tenant/user/workspace ownership instead of trusting device identity claims
- list app-imported report jobs available to the signed-in account
- bootstrap seeded V10 report jobs
- import app-export-style JSON packages
- create and refresh app evidence upload sessions
- verify uploaded evidence before finalizing a report import
- issue authorized short-lived evidence read URLs
- load report jobs
- save manual inputs
- save section drafts
- restore previous section draft versions
- generate sections
- run section chat/control actions
- save layout overrides
- approve sections
- export selected approved sections to DOCX
- rebuild/search/audit KB indexes
- run eval and safety audits
- operate the live Super Admin Evaluation Lab from approved, object-stored KB documents, approved Truth Cases, and deterministic Capture Variants
- keep evaluation-gold documents outside generation retrieval and count only runs linked to an explicit evaluation case
- inspect, train, promote, and roll back system-level RL policy versions through super-admin-only endpoints

## Development Commands

```bash
npm --prefix apps/report-platform run dev
npm --prefix apps/report-platform run api
npm --prefix apps/report-platform run build
npm --prefix apps/report-platform run evaluation:lab:audit
npm --prefix apps/report-platform run preview
```

Bootstrap the first Super Admin for an empty database:

```bash
printf '%s' '<password>' | npm --prefix apps/report-platform run account:bootstrap-admin -- \
  --tenant-id <tenant-id> --tenant-name '<tenant-name>' \
  --workspace-id <workspace-id> --workspace-name '<workspace-name>' \
  --display-name '<admin-name>' --username <username>
```

Afterward, use the Super Admin UI for normal account management. This command is reserved for controlled credential recovery:

```bash
printf '%s' '<password>' | npm --prefix apps/report-platform run account:provision -- \
  --user-id <platform-user-id> \
  --username <username>
```

`account:bootstrap-admin` refuses to run after the first password account exists.

KB and audit commands:

```bash
npm --prefix apps/report-platform run kb:rebuild
npm --prefix apps/report-platform run kb:audit
npm --prefix apps/report-platform run recommendation-kb:rebuild
npm --prefix apps/report-platform run recommendation-kb:audit
npm --prefix apps/report-platform run architecture:audit
npm --prefix apps/report-platform run logic:audit
npm --prefix apps/report-platform run eval-metrics:audit
npm --prefix apps/report-platform run system-rl:audit
npm --prefix apps/report-platform run training-harness:audit
npm --prefix apps/report-platform run training-harness:storage-audit
STRICT_SAMPLE_LEAK=1 npm --prefix apps/report-platform run leak:audit
npm --prefix apps/report-platform run api:audit
npm --prefix apps/report-platform run storage:audit
npm --prefix apps/report-platform run object-upload:audit
npm --prefix apps/report-platform run report:eval
npm --prefix apps/report-platform run floor-corrosion:audit
npm --prefix apps/report-platform run floor-corrosion:durability-audit
npm --prefix apps/report-platform run floor-corrosion:object-storage-audit
```

Recommended validation before handoff:

```bash
npm --prefix apps/report-platform run build
npm --prefix apps/report-platform run architecture:audit
npm --prefix apps/report-platform run logic:audit
STRICT_SAMPLE_LEAK=1 npm --prefix apps/report-platform run leak:audit
npm --prefix apps/report-platform run api:audit
npm --prefix apps/report-platform run storage:audit
npm --prefix apps/report-platform run object-upload:audit
npm --prefix apps/report-platform run floor-corrosion:durability-audit
```

## Current Product Files

Core implementation:

- `server/generation.mjs`
- `server/store.mjs`
- `server/object-storage.mjs`
- `server/object-upload-service.mjs`
- `server/docx-export.mjs`
- `server/layout-map-figure.mjs`
- `server/floor-corrosion.mjs`
- `server/floor-corrosion-artifacts.mjs`
- `server/report-blocks.mjs`
- `server/precedent-kb.mjs`
- `server/fact-recommendation-kb.mjs`
- `server/system-rl-policy.mjs`
- `src/app/App.tsx`
- `src/components/RichTextSectionEditor.tsx`
- `src/components/LayoutMapEditor.tsx`
- `src/domain/mockReport.ts`
- `src/domain/types.ts`
- `src/lib/layoutMapGeometry.ts`
- `src/lib/reportApi.ts`
- `src/lib/reportContent.ts`

Architecture and subsystem documentation:

- `SYSTEM_ARCHITECTURE.md`
- `PRODUCT_TERMINOLOGY.md`
- `DOCUMENTATION_INDEX.md`

Use the documentation index rather than selecting from older topology or plan
files by filename.

## Next Development Focus

- formalize the report-block AST so edits target stable block models instead of reconstructed HTML
- expand scoped edit tools for table columns, paragraph blocks, heading classes, figure placement, and DOCX style maps
- implement server-side voice transcription for `voiceNotes[]` with evidence routing
- strengthen evidence packs with stable evidence IDs and provenance labels
- improve recommendation generation using reviewed fact-to-recommendation pairs
- add self-service password reset, optional MFA, user provisioning, and role-specific workspaces
- add production authentication/session observability and security audit events
- continue improving DOCX formatting against the report family without overfitting to one sample report

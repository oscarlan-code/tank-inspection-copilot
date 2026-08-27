# Android V3 Cloud Evidence Upload Handoff

## Product Decision

The LAIQ inspection app owns field capture, synthetic demo tasks, export JSON, and the source attachment files.

MFL plate-map PDFs are not app attachments. They are uploaded later from the authenticated report-generation workspace and combined with the app-owned floor layout.

The report platform must not construct product demo inspection data or fabricate attachment binaries. The V3 app mock task must be exported and uploaded through the same authenticated pipeline used by a real inspection. Report-platform fixtures remain available only for automated contract, generation, and regression tests.

```text
V3 Room task + local evidence files
  -> V3 export package and attachment manifest
  -> authenticated upload session
  -> direct signed uploads to S3-compatible object storage
  -> server checksum and scope verification
  -> finalized report import
  -> account-owned report job
```

## Ownership Boundary

Android V3 owns:

- local-first capture and Room state
- mock task creation and materialized mock media
- export-readiness validation
- reading local attachment files
- SHA-256 and byte-size calculation
- upload retry/resume state
- upload progress shown to the inspector
- app-captured photos, voice audio, and other field evidence, excluding MFL plate-map files

Report platform owns:

- account authentication and authorization
- upload-session creation
- tenant/workspace/inspection-scoped object keys
- short-lived signed upload URLs
- object metadata and lifecycle records
- checksum, size, media-type, and ownership verification
- report import after successful finalization
- signed app-evidence reads for preview, transcription, and export
- report-workspace upload and processing of MFL plate-map PDFs against the imported app floor layout

The Android app never receives S3 access keys or chooses trusted object keys.

## Implemented Report-Platform API Contract

The existing password login remains the first step:

```http
POST /api/v1/app/auth/login
Content-Type: application/json

{
  "username": "inspector@example.com",
  "password": "...",
  "deviceId": "android-device-id"
}
```

The returned bearer token is used for all following requests.

### 1. Create Upload Session

```http
POST /api/v1/app/imports/v3-product/upload-sessions
Authorization: Bearer <session-token>
Content-Type: application/json
Idempotency-Key: <stable-export-attempt-id>
```

```json
{
  "exportPackage": {
    "packageType": "v3_product_export",
    "schemaVersion": 3,
    "inspectionId": "inspection-id",
    "tenantId": "tenant-id-from-local-provenance",
    "workspaceId": "workspace-id-from-local-provenance"
  },
  "objects": [
    {
      "attachmentId": "voice-note-attachment-id",
      "relativePath": "v3-voice-notes/findings/note.m4a",
      "mediaType": "audio/mp4",
      "byteSize": 482193,
      "sha256": "64-lowercase-hex-characters"
    }
  ]
}
```

The server derives tenant, workspace, and actor ownership from the authenticated principal. Package identity fields are provenance and must match the authenticated account scope; they never grant access.

Response:

```json
{
  "uploadSessionId": "uuid",
  "status": "awaiting_objects",
  "expiresAtIso": "2026-07-20T12:00:00Z",
  "objects": [
    {
      "objectId": "uuid",
      "attachmentId": "voice-note-attachment-id",
      "method": "PUT",
      "uploadUrl": "https://object-storage.example/...signed...",
      "requiredHeaders": {
        "Content-Length": "482193",
        "Content-Type": "audio/mp4",
        "x-amz-checksum-sha256": "base64-encoded-sha256",
        "x-amz-meta-objectid": "uuid",
        "x-amz-meta-sha256": "64-lowercase-hex-characters"
      }
    }
  ]
}
```

### 2. Upload Each Binary

The app performs the returned `PUT` request directly to object storage and sends the file bytes without JSON or base64 encoding.

The app must use the exact required headers. A URL may be retried until it expires. If it expires, the app requests a refreshed upload plan for the same upload session instead of creating a duplicate report import:

```http
GET /api/v1/app/imports/v3-product/upload-sessions/{uploadSessionId}
Authorization: Bearer <session-token>
```

### 3. Finalize Import

```http
POST /api/v1/app/imports/v3-product/upload-sessions/{uploadSessionId}/finalize
Authorization: Bearer <session-token>
Content-Type: application/json

{}
```

Before creating the report job, the report platform retrieves every required object and verifies its bytes:

- object exists under the server-issued key
- byte size matches the manifest
- computed SHA-256 matches the manifest
- media type matches the allowed attachment class
- upload session, tenant, workspace, inspection, and actor ownership match
- all `fileExists=true` exported attachments are represented exactly once
- no unexpected manifest object is accepted

Successful response returns the existing report-job payload used by the Android success screen.

The implemented backend files are:

- `server/object-upload-service.mjs`
- `server/object-storage.mjs`
- `server/storage/migrations/004_object_upload_sessions.sql`
- `server/scripts/audit-object-upload-pipeline.mjs`

Local PostgreSQL and MinIO-compatible storage are defined in `compose.yaml`. For a physical app device, `REPORT_PLATFORM_S3_ENDPOINT` must use an HTTPS or Tailscale/LAN address reachable from the device; `127.0.0.1` refers to the device itself and will not work.

### 4. Logout

```http
POST /api/v1/app/auth/logout
Authorization: Bearer <session-token>
```

The password is never persisted by the app for this operation.

## Android Upload State

The app should persist an upload outbox in Room so network loss or process death does not lose progress.

Recommended records:

```text
ExportUploadAttempt
  attemptId
  inspectionId
  exportPackageId
  uploadSessionId
  status
  expiresAtIso
  lastErrorCode
  createdAtIso
  updatedAtIso

ExportUploadObject
  attemptId
  attachmentId
  relativePath
  mediaType
  byteSize
  sha256
  objectId
  status
  retryCount
  updatedAtIso
```

Suggested status progression:

```text
prepared -> session_created -> uploading -> verifying -> imported
                                      \-> retry_required
                                      \-> failed
```

The app keeps local source files until the server returns `imported`. Deleting or archiving a task must warn when an upload is incomplete.

## Mock Data Rule

The V3 mock task must include real materialized local files for every attachment marked `fileExists=true`:

- finding photos
- voice-note audio
- other app-captured evidence represented in `attachments[]`

The app mock must not materialize or upload MFL plate-map PDFs. MFL remains an independent report-side test/input step after the mock app package is imported.

The mock task is exported from Room, hashed, uploaded, finalized, and displayed in the report inbox under the same account that uploaded it. The report platform must not silently replace missing mock files with report-side placeholders.

## Validation And Guardrails

- Reject path traversal, absolute paths, duplicate attachment IDs, duplicate relative paths, invalid SHA-256 values, negative sizes, and unsupported media types.
- Define per-object and per-export byte limits.
- Signed URLs expire quickly and are scoped to one server-issued object key.
- Object keys must not contain client-provided filenames without sanitization.
- Store original display names as metadata, not as trusted key paths.
- Finalization is idempotent and returns the same report job for the same completed attempt.
- An Inspector cannot inspect, refresh, finalize, or read another account's upload session.
- Disable/delete account behavior must revoke sessions and apply the configured object-retention/deletion policy.

## Android Acceptance Criteria

1. A V3 task with no attachments uploads and imports successfully.
2. A V3 task with a photo and voice note uploads both binaries and imports successfully.
3. The app resumes an interrupted multi-file upload without duplicating completed objects.
4. A checksum mismatch blocks finalization and identifies the affected attachment.
5. A missing local file blocks the send action before upload-session creation.
6. The same export attempt can safely retry finalization.
7. The report appears only in the uploading account's report inbox.
8. The report platform can retrieve and display the uploaded photo.
9. The report platform can retrieve the uploaded voice file for transcription.
10. The app-generated synthetic V3 task passes through the same pipeline without a report-side demo fixture.
11. The app manifest contains no MFL plate-map object; MFL is uploaded from the report workspace.

## Copy-Ready Android Session Prompt

```text
Project: tank-inspection-coplilot-app
Scope: Android V3 Product only, plus the versioned app/report upload contract. Do not modify V2 Beta or V2 Product.

Read first:
- apps/field-android/AGENTS.md
- apps/field-android/docs/skills/android-v3-boundaries/SKILL.md
- apps/field-android/docs/skills/android-v3-workflow-data-flow/SKILL.md
- apps/field-android/docs/skills/android-v3-export-contract/SKILL.md
- apps/report-platform/ANDROID_V3_OBJECT_UPLOAD_HANDOFF.md

Goal:
Upgrade Send to Report Platform so the V3 app uploads attachment binaries through report-platform-issued, short-lived S3-compatible signed URLs before finalizing the JSON report import.

Requirements:
- keep Room/local files as the field source of truth
- calculate SHA-256 and byte size from each local attachment
- create a durable Room upload outbox with per-object retry state
- login with the existing shared app/report account
- create an upload session with export JSON plus an attachment manifest
- PUT binaries directly to signed URLs without receiving S3 credentials
- exclude MFL plate-map PDFs from the app export/upload manifest; MFL is report-platform input
- finalize only after every required object is uploaded
- preserve local files until finalization succeeds
- show overall and per-file progress with actionable retry errors
- use ProductMockTaskSeed and materialized mock assets to exercise the same end-to-end path
- do not build demo inspection data in report-platform
- add unit/contract tests for manifest construction, hashing, missing files, retry, idempotency, and response parsing
- run Android V3 compile, unit tests, and the product-standard gate

Coordinate endpoint names and payloads exactly with the handoff document. If the backend implementation differs, update the versioned contract deliberately rather than adding an implicit fallback.
```

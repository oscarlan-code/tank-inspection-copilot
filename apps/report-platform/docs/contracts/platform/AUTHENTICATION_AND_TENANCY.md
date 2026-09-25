# Authentication And Tenancy

## Product Rule

Users authenticate before loading any report-platform workspace.

The API derives the actor from the authenticated PostgreSQL session. It does not trust `actorUserId`, `tenantId`, `workspaceId`, or role claims supplied in ordinary report request bodies.

```text
authenticated identity
  -> platform user provisioning
  -> tenant membership
  -> workspace role membership
  -> permission check
  -> tenant/workspace-scoped report or KB operation
```

## Current Foundation

The V1 Beta authentication foundation now includes:

- login-gated browser workspace
- username/password sign-in as the single current authentication path
- scrypt password hashing with a unique random salt; plaintext passwords are never persisted
- random session tokens stored only as SHA-256 hashes in PostgreSQL
- HttpOnly, SameSite=Strict cookies, with Secure cookies required in production
- persistent sessions that survive API restarts and can be shared by multiple API instances
- PostgreSQL-backed login throttling without storing raw usernames or IP addresses in throttle records
- server-side role permissions
- tenant/workspace checks for report reads, imports, edits, generation, chat, approval, rollback, layout overrides, evals, and DOCX export
- import protection that prevents an app export from provisioning platform roles
- tenant/workspace filtering for private KB sources
- authenticated actor override protection
- cross-tenant and role-negative API audits
- Super Admin account creation, password reset, activation, and deactivation UI
- one account shared by the LAIQ inspection app and report platform
- short-lived inspection-app bearer sessions stored only as token hashes in PostgreSQL
- account-scoped report inbox for app-imported report jobs
- controlled first-account bootstrap and account/password rotation through the provisioning command

## Roles And Current Permissions

| Role | Current workspace permissions |
| --- | --- |
| Super Admin | Platform administration and all workspace operations |
| Manager | Workspace-wide read, import, edit, generate, approve, export, and approved KB retrieval |
| Inspector | Import and fully manage reports created by the same account; approved KB retrieval remains scope-filtered |
| Reviewer | Workspace-wide read, edit, generate/rerun, approve, export, and approved KB retrieval |
| Client Viewer | No access to internal draft workspace state; approved-publication portal remains a separate future surface |

Inspector approval remains allowed in V1 Beta because Reviewer is optional under the current tenant workflow. A later tenant policy can require independent Reviewer approval before publication.

## Inspection App Connection

The LAIQ inspection app sends its already-generated V3 export package and local evidence files through one authenticated product pipeline:

```text
inspector signs in to the app
  -> app requests a short-lived mobile session
  -> app creates an upload session with V3 export JSON and evidence manifest
  -> app uploads evidence bytes directly to short-lived signed object URLs
  -> API streams and verifies every object against SHA-256, byte size, and media type
  -> app finalizes the upload session
  -> API binds the import to the authenticated tenant/user/workspace
  -> report job appears in the same account's web report inbox
  -> app logs out and discards the session token and password
```

The app does not store the report-platform password or bearer token. Debug builds can use an HTTP Tailscale/local address for internal testing; release builds require HTTPS.

The JSON package includes structured inspection facts, resolved layout geometry, inline app-owned layout figures, voice-note metadata/transcripts, finding records, and attachment metadata. An export with `fileExists=true` evidence cannot use the legacy direct JSON endpoint; it must complete the signed object-upload workflow. An evidence-free task may finalize without object storage.

MFL plate-map PDFs are deliberately excluded from the app upload manifest. After the app package creates the report job, the Inspector uploads MFL directly in that authenticated report workspace. The report platform validates the plate/layout match and composes the corrosion layer over the immutable app floor layout.

The complete Android contract and copy-ready implementation handoff are in `ANDROID_V3_OBJECT_UPLOAD_HANDOFF.md`.

## App Import Boundary

The LAIQ inspection app export carries provenance metadata, including the field user, tenant, and workspace. It does not create report-platform accounts or grant roles.

An app import is accepted only when:

- the caller is authenticated
- the caller has import permission
- the authenticated account has an active tenant/workspace membership
- the package passes the V3 export contract validation
- the JSON body stays within the configured request-size limit

The API does not trust tenant, workspace, user, or role claims supplied by the device. It binds platform ownership to the authenticated account and preserves the package's original identity values only as ingestion provenance. Inspection evidence, measurements, notes, findings, geometry, and figures are not rewritten.

## Knowledge-Base Isolation

Retrieval visibility is enforced before scoring:

- `platform_library`: available to authorized report users
- `platform_codes_library`: available as standards guidance
- `tenant_private`: only available when the current report tenant matches
- `workspace_private`: only available when both tenant and workspace match

Current app facts remain authoritative. KB access never permits historical content to overwrite imported inspection truth.

## Super Admin Account Management

An authenticated `Super Admin` can open `Manage accounts` from the report inbox or visit `/admin/accounts` directly to:

- create a username/password account in an existing tenant and workspace
- assign Inspector, Manager, Reviewer, Client Viewer, or Super Admin role
- reset an existing password and revoke that user's active sessions
- disable an account and revoke its sessions
- reactivate a disabled account
- permanently delete another account and its owned report jobs/import packages after exact username confirmation

Existing passwords are never recoverable because only salted scrypt hashes are stored. The Show/Hide controls reveal only a temporary or replacement password while the Super Admin is typing it. Permanent deletion cannot target the signed-in Super Admin and retains only a non-PII audit record containing deletion counts and a one-way user identifier hash.

The same credentials are used in the inspection app and browser. Inspectors see only reports created by their own account, even when another Inspector belongs to the same workspace. Manager and Reviewer roles can access workspace-wide report jobs; Super Admin can administer the platform.

The optional V10 training package follows the same ownership rule. Opening demo data creates or reloads one stable account-scoped copy for the authenticated user; it does not expose or reset another inspector's demo report.

## Initial Account Provisioning

Create the first account for a new database once with the dedicated bootstrap command. It creates the initial tenant, workspace, and Super Admin atomically, and refuses to run after any password account exists:

```bash
printf '%s' '<password>' | npm run account:bootstrap-admin -- \
  --tenant-id <tenant-id> --tenant-name '<tenant-name>' \
  --workspace-id <workspace-id> --workspace-name '<workspace-name>' \
  --display-name '<admin-name>' --username <username>
```

After the first Super Admin is available, normal account creation and password resets should use the management UI. The command remains available for controlled recovery and operations:

```bash
printf '%s' '<password>' | npm run account:provision -- \
  --user-id <platform-user-id> \
  --username <username>
```

The platform user and tenant/workspace membership must already exist. Rotating a password revokes that user's existing sessions.

## Remaining Product Work

- add password reset with short-lived, single-use reset tokens
- add optional multi-factor authentication before wider external rollout
- add tenant/workspace creation and membership reassignment to the Super Admin UI
- add dedicated Manager and approved Client Viewer screens
- add PostgreSQL row-level security as defense in depth where appropriate
- add asynchronous lifecycle cleanup for expired or abandoned upload sessions
- add tenant policies for independent review, publication, retention, and KB promotion
- expand immutable audit coverage for login, access denial, generation, edit, approval, and export

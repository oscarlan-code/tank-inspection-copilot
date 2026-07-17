# Authentication And Tenancy

## Product Rule

Users authenticate before loading any report-platform workspace.

The API derives the actor from the authenticated session or verified identity token. It does not trust `actorUserId`, `tenantId`, `workspaceId`, or role claims supplied in ordinary report request bodies.

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
- HttpOnly, SameSite development sessions
- provider-neutral OIDC/JWT verification boundary using issuer, audience, and JWKS validation
- pre-provisioned external identity mapping through provider and subject
- server-side role permissions
- tenant/workspace checks for report reads, imports, edits, generation, chat, approval, rollback, layout overrides, evals, and DOCX export
- import protection that prevents an app export from provisioning platform roles
- tenant/workspace filtering for private KB sources
- authenticated actor override protection
- cross-tenant and role-negative API audits
- development mode rejection when `NODE_ENV=production`

Development identities exist only for local/internal testing. They are not passwords and must not be enabled in production.

## Roles And Current Permissions

| Role | Current workspace permissions |
| --- | --- |
| Super Admin | Platform administration and all workspace operations |
| Manager | Read, import, edit, generate, approve, export, and use approved KB retrieval |
| Inspector | Read, import, edit, generate, approve, export, and use approved KB retrieval |
| Reviewer | Read, edit, generate/rerun, approve, export, and use approved KB retrieval |
| Client Viewer | No access to internal draft workspace state; approved-publication portal remains a separate future surface |

Inspector approval remains allowed in V1 Beta because Reviewer is optional under the current tenant workflow. A later tenant policy can require independent Reviewer approval before publication.

## App Import Boundary

The LAIQ inspection app export carries provenance metadata, including the field user, tenant, and workspace. It does not create report-platform accounts or grant roles.

An import is accepted only when:

- the caller is authenticated
- the caller has import permission
- the export tenant matches the caller tenant
- the export workspace is one of the caller workspace memberships
- the package passes the V3 export contract validation

The original app exporter remains preserved in the immutable package JSON. If that identity has not been provisioned in the report platform, the authenticated importing user is recorded as the platform import actor.

## Knowledge-Base Isolation

Retrieval visibility is enforced before scoring:

- `platform_library`: available to authorized report users
- `platform_codes_library`: available as standards guidance
- `tenant_private`: only available when the current report tenant matches
- `workspace_private`: only available when both tenant and workspace match

Current app facts remain authoritative. KB access never permits historical content to overwrite imported inspection truth.

## Production OIDC Configuration

Commercial mode uses `REPORT_PLATFORM_AUTH_MODE=oidc` and requires:

- `REPORT_PLATFORM_OIDC_ISSUER`
- `REPORT_PLATFORM_OIDC_AUDIENCE`
- `REPORT_PLATFORM_OIDC_JWKS_URI`
- pre-provisioned `identity_provider` and `external_subject` mappings
- a production CORS allowlist through `REPORT_PLATFORM_ALLOWED_ORIGINS`

The current backend verifies bearer tokens. Completing the browser authorization-code/PKCE or identity-gateway integration depends on the selected commercial identity provider.

## Remaining Product Work

- choose and integrate the commercial OIDC provider and browser SSO flow
- add user invitation/provisioning and workspace assignment administration
- add dedicated Reviewer, Manager, Super Admin, and approved Client Viewer screens
- move memberships and scoped queries to Postgres with row-level security where appropriate
- add persistent server-side sessions or an auth gateway if the selected provider uses browser sessions
- add tenant policies for independent review, publication, retention, and KB promotion
- add immutable audit events for login, import, access denial, generation, edit, approval, and export

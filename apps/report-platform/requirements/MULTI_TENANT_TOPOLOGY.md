# Multi-Tenant Topology

This document defines the tenancy and visibility model for the connected report platform.

It exists because the future actors are already known:

- internal IRS platform admins
- inspection managers / reviewers
- field inspectors
- later, tank-client viewers
- later, possible client approvers

That means tenancy cannot be treated as a late add-on. The boundary design should happen now, even if the first implementation is lightweight.

## Recommendation

Design the tenancy model now.

Implement it in phases.

Do not fully postpone the topology design until after the report platform hardens, because it affects:

- data ownership
- workspace visibility
- report-sharing rules
- audit history
- upload ownership
- authentication and authorization boundaries

## Core hierarchy

The recommended hierarchy is:

1. `Tenant`
2. `ClientAccount`
3. `Site`
4. `Tank`
5. `InspectionJob`
6. `CanonicalPackage`
7. `ReportWorkspace`
8. `ReportVersion`

### Meaning of each level

#### Tenant

Top-level operating organization.

In the first product phase this may simply be:

- `IRS`

Later, if the platform supports multiple inspection agencies or business units, each agency or business entity becomes its own tenant.

#### ClientAccount

The tank owner/operator or customer under the tenant.

Examples:

- TJS Pte Ltd
- Shell Bukom
- other client organizations

#### Site

A specific plant, terminal, or physical location belonging to the client.

#### Tank

A physical tank record under a site.

#### InspectionJob

A single inspection engagement or reporting event for a specific tank.

This is the level that should anchor:

- uploaded packages
- field capture sessions
- review workflow
- checklist completion
- report generation

#### CanonicalPackage

An uploaded package from the Android app.

Multiple canonical packages may belong to one inspection job if re-exports or corrected exports are uploaded.

#### ReportWorkspace

The editable web workspace that enriches the package with:

- checklist responses
- calculations
- narrative drafts
- review state

#### ReportVersion

A versioned output or frozen draft generated from a workspace.

This is the right place for:

- draft snapshots
- approved versions
- client-shared versions

## User and role model

The recommended starting role set is:

- `platform_admin`
- `tenant_admin`
- `reviewer`
- `inspector`
- `client_viewer`
- later, `client_approver`

### Platform admin

Global platform operator.

Can:

- manage tenant configuration
- view platform-wide health
- support operational troubleshooting

Should be rare.

### Tenant admin

Internal organization admin for one tenant.

Can:

- manage users inside the tenant
- assign inspection jobs
- control client-sharing configuration
- view all tenant workspaces and reports

### Reviewer

Internal engineering / QA / report reviewer role.

Can:

- review uploaded packages
- edit report workspaces
- approve or reject narrative and calculations
- publish client-visible versions where permitted

### Inspector

Field or reporting operator assigned to jobs.

Can:

- upload packages
- complete checklist items
- edit assigned workspaces
- request review

Should normally be limited to assigned jobs or scoped client/site access.

### Client viewer

External client user.

Can:

- see only explicitly shared or published report data
- see only their own client/site/tank scope

Should not see:

- internal drafting notes
- raw incomplete workspaces
- internal review comments
- tenant-global data

## Visibility model

The platform should treat `internal workspace visibility` and `client-visible publication` as different layers.

### Internal workspace layer

Contains:

- uploaded package data
- incomplete sections
- draft narratives
- checklist progress
- calculations in progress
- internal comments

Visible to:

- inspectors
- reviewers
- tenant admins
- platform admins as needed

### Client-visible layer

Contains only approved or intentionally shared outputs, such as:

- final report versions
- selected section previews
- selected evidence views
- selected layout snapshots

Visible to:

- client viewers
- internal users with access

This separation is important. A client should not automatically see everything in an internal drafting workspace.

## Data ownership rules

Every major record should be stamped with ownership fields from day one.

Recommended ownership fields:

- `tenantId`
- `clientAccountId`
- `siteId`
- `tankId`
- `inspectionJobId`
- `createdByUserId`

At the workspace/report level also include:

- `visibilityState`
- `sharingState`
- `reviewState`

## Lifecycle model

The platform should use explicit job/workspace lifecycle states.

Suggested starting states:

- `uploaded`
- `parsed`
- `incomplete`
- `draft`
- `under_review`
- `approved_internal`
- `shared_with_client`
- `archived`

These states should be independent from the Android app's local capture state.

## Upload ownership strategy

The cleanest strategy is:

- determine tenant and user ownership from the authenticated web/upload context
- link the uploaded canonical package to an inspection job in the platform
- keep the canonical package itself mostly domain-focused

This avoids forcing premature tenancy concerns into the measurement model.

## Android app impact

### Short answer

No major immediate Android redesign is required.

The Android app can remain primarily a field data-capture and canonical export tool.

### What should stay unchanged for now

These parts of the Android app should remain stable:

- measurement capture model
- findings model
- attachments model
- canonical measurement structure
- export ZIP / JSON flow

Those are domain capture concerns, not tenant-topology concerns.

### What may need light changes later

Later, we may optionally add:

- authenticated upload tied to a user/tenant
- upload destination selection
- inspection job assignment metadata
- organization-aware sync state
- package envelope metadata outside the measurement payload

Important recommendation:

If tenancy metadata is needed, prefer adding it in a lightweight upload envelope or job-assignment layer rather than polluting the core engineering measurement schema.

### What should not happen

Do not reshape the Android package around tenancy first.

The canonical package should remain primarily:

- inspection-centric
- tank-centric
- measurement-centric

The report platform can attach tenant/client/job ownership at ingest time.

## Implementation phases

### Phase 1. Design now

Decide:

- hierarchy
- roles
- ownership fields
- visibility layers
- lifecycle states

### Phase 2. Lightweight implementation

Implement:

- tenant-aware data model
- user membership model
- workspace ownership fields
- role-aware section/workspace access checks

No need yet for full client portal or enterprise auth.

### Phase 3. Internal productionization

Add:

- proper authentication
- job assignment workflows
- reviewer approval workflows
- internal audit views

### Phase 4. Client exposure

Add:

- client viewer accounts
- share/publish controls
- approved report portal
- selected evidence/layout exposure

## Guard rails

Multi-tenant guard rails should include:

- no cross-tenant data access
- no client access to internal drafts by default
- explicit publication boundary
- audit logs for report approvals and sharing
- section and workspace ownership checks on every mutation path

## Recommended next build rule

Before real backend implementation hardens, the report platform should define:

- the tenancy data model
- the role model
- the visibility model
- the client-sharing boundary

That way later client access becomes an extension of the system, not a rewrite of it.

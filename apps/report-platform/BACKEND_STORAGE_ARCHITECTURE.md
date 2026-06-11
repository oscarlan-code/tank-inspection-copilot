# Backend Storage Architecture

## Goal

Define the product-standard backend storage model for `apps/report-platform`, including:

- transactional backend storage
- object/file storage
- vector database retrieval

Detailed precedent retrieval, KB tuning, and evaluation procedures are defined in:

- `apps/report-platform/PRECEDENT_KB_ARCHITECTURE.md`

This architecture must align with the V2 Product tenant/workspace/user model and support section-by-section Codex CLI generation.

## Storage Layers

The report platform should use three complementary storage layers.

### 1. Transactional Backend Storage

Purpose:
- store product entities
- enforce tenancy and role rules
- persist report workflow state
- persist provenance and audit data

Recommended default:
- `Postgres`

Primary responsibilities:
- tenants
- workspaces
- users
- role assignments
- imported inspection packages
- report jobs
- report section drafts
- review decisions
- publication status
- knowledge-base document metadata
- retrieval provenance
- generation run history
- audit events

### 2. Object/File Storage

Purpose:
- store large files and immutable artifacts

Recommended default:
- S3-compatible object storage or equivalent blob storage

Primary responsibilities:
- imported Android export JSON files
- imported field attachments
- source PDF reports
- OCR text extracts
- rendered preview artifacts
- generated PDFs
- screenshot/debug artifacts where needed

### 3. Vector Retrieval Storage

Purpose:
- retrieve similar prior report content for section drafting

Recommended default:
- `pgvector` in the same Postgres system for the first product-standard version

Why this is a strong first choice:
- simpler operations
- easier tenant/workspace metadata filtering
- easier provenance joins
- easier auditability

Possible future evolution:
- move to a dedicated vector service only if scale, latency, or operational needs justify it

## High-Level Backend Topology

```mermaid
flowchart LR
    A[Android Export Import] --> B[API / Ingest Service]
    C[Inspector Inputs] --> B
    D[Previous Reports / Sample PDFs] --> E[Indexing Worker]

    B --> F[(Relational Store)]
    B --> G[(Object Storage)]

    E --> G
    E --> F
    E --> H[(Vector Index)]

    I[Retrieval Service] --> F
    I --> H

    J[Generation Orchestrator] --> F
    J --> I
    J --> K[Codex CLI Worker]
    K --> F

    L[Preview / PDF Service] --> F
    L --> G
```

## Product Entities In Transactional Storage

Recommended core records:

- `Tenant`
- `Workspace`
- `User`
- `UserRoleAssignment`
- `InspectionImport`
- `InspectionImportAttachment`
- `ReportJob`
- `ReportSectionDraft`
- `ReportSectionRevision`
- `ReportReviewDecision`
- `ReportPublication`
- `KnowledgeBaseDocument`
- `KnowledgeBaseChunk`
- `KnowledgeBaseSection`
- `KnowledgeBaseStylePattern`
- `KnowledgeBaseLayoutPattern`
- `KnowledgeBaseGoldExample`
- `KnowledgeBaseEvalRun`
- `GenerationRun`
- `GenerationRunSection`
- `AuditEvent`

Recommended common fields on report-side entities:

- `tenantId`
- `workspaceId`
- `inspectionId`
- `inspectionReference`
- `createdByUserId`
- `lastEditedByUserId`
- `createdAt`
- `updatedAt`

## Object Storage Layout

Suggested object prefixes:

```text
tenants/{tenantId}/workspaces/{workspaceId}/imports/{inspectionId}/package.json
tenants/{tenantId}/workspaces/{workspaceId}/imports/{inspectionId}/attachments/{attachmentId}
tenants/{tenantId}/workspaces/{workspaceId}/reports/{reportJobId}/drafts/{sectionKey}.json
tenants/{tenantId}/workspaces/{workspaceId}/reports/{reportJobId}/preview/{artifactId}
tenants/{tenantId}/workspaces/{workspaceId}/reports/{reportJobId}/final/{fileName}.pdf
tenants/{tenantId}/workspaces/{workspaceId}/knowledge-base/{documentId}/source.pdf
platform-library/reports/{documentId}/source.pdf
```

Object storage rules:

- immutable source imports where possible
- version generated outputs
- signed URL access only
- no direct cross-tenant listing

## Vector Database Role

The vector database should support retrieval for:

- section drafting
- structure suggestions
- tone/style matching
- appendix inclusion hints

It should not be treated as a source of truth for current inspection facts.

## What Gets Embedded

Recommended embedding units:

- report section chunks
- appendix intro chunks
- recommendation sections
- standard narrative blocks
- approved redacted exemplars

Do not embed blindly at whole-document level only.

Preferred chunking strategy:

- split by section first
- then by paragraph/table-adjacent chunk
- preserve section title and report-family metadata

## Vector Metadata Schema

Every embedded chunk should include metadata such as:

- `documentId`
- `chunkId`
- `sourceType`
- `tenantId`
- `workspaceId`
- `visibilityScope`
- `reportFamily`
- `sectionType`
- `inspectionType`
- `tankType`
- `approvalStatus`
- `isRedacted`
- `sourceReportName`
- `pageStart`
- `pageEnd`

This metadata is mandatory for safe filtering.

## Retrieval Strategy

Use hybrid retrieval:

1. metadata filter first
2. vector similarity search
3. optional keyword or lexical reranking
4. provenance capture

Minimum retrieval filters:

- actor can access tenant/workspace
- document is approved for retrieval
- section type matches or is closely related
- report family is compatible when possible

## Multi-Tenant Isolation Rules

Transactional, object, and vector storage must all enforce the same boundaries:

- tenant-private data stays inside tenant scope
- workspace-private data stays inside workspace scope unless promoted
- platform sample library is explicit and separate
- no vector query may search unrestricted global tenant content by default

Recommended enforcement methods:

- relational filtering and/or row-level security
- object key prefix isolation plus signed access
- vector metadata filters enforced by the retrieval service

## Role-Aware Access Rules

Aligned with V2 Product:

- `Super Admin`: can manage platform libraries and tenant setup
- `Manager`: can view/manage report jobs and publication policy inside allowed scope
- `Inspector`: can create report jobs, edit manual inputs, and run section generation
- `Reviewer`: can review drafts, add comments, and approve when policy requires
- `Client Viewer`: read-only access to approved assigned outputs

Users may carry multiple roles.

## Backend Service Responsibilities

Recommended logical services:

### API Service

Handles:
- auth context
- report job CRUD
- manual input updates
- review actions
- preview/PDF requests

### Ingest Worker

Handles:
- Android package import
- attachment verification
- relational persistence
- object storage writes

### Indexing Worker

Handles:
- PDF ingestion
- OCR/text extraction
- chunking
- embedding generation
- vector writes

### Retrieval Service

Handles:
- metadata filtering
- vector lookup
- lexical reranking if used
- provenance packaging for section jobs
- precedent-pack creation for Codex CLI workers
- retrieval evaluation against approved gold examples

### Generation Orchestrator

Handles:
- section planning
- Codex CLI job submission
- run tracking
- regeneration rules

### Preview / PDF Service

Handles:
- section composition
- HTML preview
- print/PDF rendering
- final artifact storage

## Audit And Provenance

Persist these records for every generation run:

- actor identity
- actor roles
- input package version
- manual input version
- retrieved chunk ids
- prompt/job payload hash
- generated output version
- review result

This is important for traceability and tenant trust.

## Recommended First-Version Choice

For the first product-standard release:

- `Postgres` for transactional storage
- `pgvector` for vector retrieval
- S3-compatible object storage for files

This gives a practical balance of:

- product readiness
- tenant-safe filtering
- operational simplicity
- auditability

## Recommended Next Implementation Artifacts

Define these contracts early:

1. `AuthorizationContext`
2. `ReportJobRecord`
3. `ReportSectionDraftRecord`
4. `KnowledgeBaseDocumentRecord`
5. `KnowledgeBaseChunkRecord`
6. `GenerationRunRecord`
7. object storage key conventions
8. vector metadata filter contract

That will let the frontend, backend, retrieval, and Codex CLI orchestration evolve against a shared product-standard backend model.

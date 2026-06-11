# Full System Diagram

## Purpose

This page shows the full report-generation system in one place so the product flow is easier to understand.

It combines:

- Android V2 Product export handoff
- inspector and reviewer inputs
- multi-tenant backend storage
- knowledge-base indexing and vector retrieval
- Codex CLI section generation
- browser preview and final PDF output

Detailed AI-engine internals:

- `apps/report-platform/AI_ENGINE_SYSTEM_DIAGRAM.md`

## One-Page Summary

The system works in five big stages:

1. Android V2 Product exports a structured inspection package.
2. The report platform imports that package into a tenant/workspace report job.
3. Inspectors add report-side inputs and the platform retrieves relevant precedent from the knowledge base.
4. Codex CLI drafts sections one-by-one using facts, manual inputs, and retrieved precedent.
5. Reviewers approve sections, then the platform composes browser preview and final PDF output.

## Visual Diagram

![Report generation full system diagram](assets/report-generation-full-system.svg)

The SVG above is the primary visual version.

It is intentionally simplified so the main flow is easy to read.

The Mermaid diagrams below are kept as editable detailed source references.

## Full Layered System Diagram

```mermaid
flowchart TB
    subgraph Users["Users And Roles"]
        SA[Super Admin]
        MGR[Manager]
        INS[Inspector]
        REV[Reviewer]
        CV[Client Viewer]
    end

    subgraph Field["Field Capture Source"]
        ANDROID[Android V2 Product App\nRoom-first local-first capture]
        EXPORT[Export Package\nJSON + attachments + metadata]
        ANDROID --> EXPORT
    end

    subgraph RP["Report Platform Application Layer"]
        UI[Report Platform Web UI]
        AUTH[Authorization Context\nTenant + Workspace + Roles]
        IMPORT[Import Adapter]
        MANUAL[Manual Report Input Layer]
        ORCH[Report Orchestrator]
        REVIEW[Review Workflow]
        PREVIEW[Preview Composer]
        PDF[PDF Composer]
    end

    subgraph KB["Knowledge Base And Retrieval"]
        INDEX[Indexing Worker]
        RETRIEVE[Retrieval Service]
        SECTIONJOBS[Section Job Builder]
        CODEX[Codex CLI Section Generator]
    end

    subgraph Storage["Backend Storage"]
        PG[(Postgres\nTransactional Records)]
        OBJ[(Object Storage\nImports, attachments, source PDFs,\npreviews, final PDFs)]
        VDB[(pgvector / Vector Index\nChunk embeddings + metadata filters)]
    end

    subgraph Outputs["Outputs"]
        DRAFTS[Section Drafts]
        BROWSER[Browser Report Preview]
        FINALPDF[Final PDF Report]
        AUDIT[Audit / Provenance Trail]
    end

    INS --> UI
    REV --> UI
    MGR --> UI
    CV --> UI
    SA --> UI

    UI --> AUTH
    AUTH --> IMPORT
    AUTH --> MANUAL
    AUTH --> ORCH
    AUTH --> REVIEW
    AUTH --> PREVIEW

    EXPORT --> IMPORT
    IMPORT --> PG
    IMPORT --> OBJ
    IMPORT --> ORCH

    INS --> MANUAL
    REV --> MANUAL
    MANUAL --> PG
    MANUAL --> ORCH

    SA --> INDEX
    MGR --> INDEX
    INDEX --> OBJ
    INDEX --> PG
    INDEX --> VDB

    ORCH --> RETRIEVE
    RETRIEVE --> PG
    RETRIEVE --> VDB
    RETRIEVE --> SECTIONJOBS
    ORCH --> SECTIONJOBS
    SECTIONJOBS --> CODEX
    CODEX --> DRAFTS
    DRAFTS --> PG
    CODEX --> AUDIT
    SECTIONJOBS --> AUDIT
    RETRIEVE --> AUDIT

    PG --> REVIEW
    REVIEW --> PG
    REVIEW --> DRAFTS

    PG --> PREVIEW
    OBJ --> PREVIEW
    DRAFTS --> PREVIEW
    PREVIEW --> BROWSER

    PREVIEW --> PDF
    DRAFTS --> PDF
    PG --> PDF
    OBJ --> PDF
    PDF --> FINALPDF
    PDF --> OBJ
    PG --> AUDIT
```

## Tenant-Scoped Data Model View

```mermaid
flowchart TD
    PLATFORM[LAIQ Platform]
    PLATFORM --> TENANT[Tenant]
    TENANT --> WORKSPACE[Workspace / Project]

    WORKSPACE --> USERS[Users]
    WORKSPACE --> TASKS[Inspection Tasks]
    WORKSPACE --> EXPORTS[Export Packages]
    WORKSPACE --> REPORTJOBS[Report Jobs]
    WORKSPACE --> DRAFTS[Report Section Drafts]
    WORKSPACE --> REVIEWS[Review Decisions]
    WORKSPACE --> KBVIEW[Knowledge Base View]
    WORKSPACE --> OUTPUTS[Preview + Final PDFs]

    USERS --> ROLES[Role Assignments]
    KBVIEW --> PLATFORMLIB[Platform Shared Library]
    KBVIEW --> TENANTLIB[Tenant Historical Reports]
    KBVIEW --> WORKSPACELIB[Workspace Historical Reports]
```

## End-To-End Lifecycle

```mermaid
sequenceDiagram
    participant Android as Android V2 Product
    participant Import as Import Layer
    participant Storage as Postgres + Object Storage
    participant Inspector as Inspector
    participant KB as Knowledge Base Retrieval
    participant Codex as Codex CLI
    participant Reviewer as Reviewer
    participant Output as Preview/PDF

    Android->>Import: Export package JSON + attachments
    Import->>Storage: Save import metadata and files
    Import->>Inspector: Create report job
    Inspector->>Storage: Add report-side inputs
    Inspector->>KB: Request precedent for section
    KB->>Storage: Filter by tenant/workspace/roles
    KB-->>Inspector: Return authorized precedent chunks
    Inspector->>Codex: Run one section job
    Codex-->>Storage: Save section draft + provenance
    Reviewer->>Storage: Comment / approve / reject
    Reviewer->>Codex: Rerun only changed sections if needed
    Storage->>Output: Compose approved draft + structured data
    Output-->>Inspector: Browser preview
    Output-->>Reviewer: Reviewable preview
    Output-->>Storage: Save final PDF artifacts
```

## Section Generation Loop

```mermaid
flowchart LR
    FACTS[Report Facts\nApp export + manual inputs]
    FILTER[Access Filter\nTenant + workspace + roles]
    RET[Precedent Retrieval\nVector + metadata]
    JOB[Section Job Payload]
    CLI[Codex CLI]
    DRAFT[Section Draft]
    REVIEW[Review / Accept / Edit / Rerun]

    FACTS --> JOB
    FILTER --> RET
    RET --> JOB
    JOB --> CLI
    CLI --> DRAFT
    DRAFT --> REVIEW
    REVIEW -->|rerun| JOB
    REVIEW -->|approved| FINAL[Approved Section]
```

## How To Read The System

### 1. Facts Start In Android

The Android app is the field system of record for captured inspection data.

It exports:

- structured JSON
- attachments
- tenant/workspace/user/report-handoff metadata

### 2. Report Platform Creates A Report Job

The import layer converts Android output into a backend report job.

That report job becomes the report-side working container for:

- manual inspector inputs
- section drafts
- review decisions
- preview and final outputs

### 3. The Knowledge Base Supplies Precedent

Previous reports are indexed into:

- source files in object storage
- metadata in Postgres
- chunk embeddings in the vector layer

Retrieval is always filtered by:

- tenant
- workspace
- visibility policy
- actor role

### 4. Codex CLI Drafts Section By Section

Codex CLI does not write the whole report in one shot.

Instead, the orchestrator builds a section job with:

- current facts
- current manual inputs
- retrieved precedent
- generation rules

Then Codex CLI drafts one section, which can be reviewed or rerun independently.

### 5. Review Locks The Content

Inspectors and reviewers check the drafts.

Depending on tenant policy:

- reviewer approval may be optional
- or reviewer approval may be required before final publication

### 6. Preview And PDF Are The Final Composition Layer

The final report is composed from:

- structured page blocks
- approved section drafts
- imported tables and attachments
- report styling and pagination rules

That composition produces:

- browser preview
- final PDF

## Quick Mental Model

If you want the shortest way to think about it:

```text
Android export facts
  + Inspector report inputs
  + Retrieved precedent from approved previous reports
  -> Codex CLI drafts one section at a time
  -> Human review
  -> Browser preview
  -> Final PDF
```

## Best Next Build Step

If we want to turn this diagram into implementation, the next concrete contracts should be:

1. `AuthorizationContext`
2. `ReportJob`
3. `ManualReportInputs`
4. `KnowledgeBaseDocument`
5. `KnowledgeBaseChunk`
6. `SectionJob`
7. `SectionDraft`
8. `GenerationRun`

Once these exist, the diagram becomes directly buildable.

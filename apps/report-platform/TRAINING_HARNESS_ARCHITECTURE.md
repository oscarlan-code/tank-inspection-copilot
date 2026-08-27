# RAG Training And Evaluation Harness Architecture

## Purpose

Define the product-standard offline harness that converts approved historical
inspection reports into leakage-safe Truth Cases, realistic LAIQ inspection
app Capture Variants, Evaluation Runs, and guarded Policy Optimization rewards.

Product and workflow terms in this document follow
`PRODUCT_TERMINOLOGY.md`. Stable `training_case` database identifiers are
internal compatibility names only.

This harness improves the RAG system and report-generation configuration. It
does not change the immutable source report, mutate production app exports, or
fine-tune the foundation model in the first implementation.

## Core Correction

One historical report may serve two offline purposes:

- provide source material for building a labelled inspection case
- act as the hidden gold answer used after generation

It must not serve a third purpose during that same evaluation:

- it must not be retrievable by the generator for its own case

The Historical Gold Report can be read by the Truth Case Builder and evaluator. The report
generator and retriever cannot read it, any alternate rendition, or any chunk
derived from the same logical case.

## Harness Topology

```text
Historical Source Bundle
  -> Truth Case Builder
  -> reviewed inspection truth graph
  -> answerability map
  -> Capture Variant Builder
  -> versioned Capture Variants
  -> V3 export-contract validation
  -> leakage-isolated report generation
  -> section evaluators
  -> case/profile reward aggregation
  -> candidate RAG policy selection
  -> validation batch
  -> hidden-test promotion gate
  -> immutable production policy
```

The live report compiler remains unchanged:

```text
real LAIQ app export -> report generation -> inspector approval -> export
```

The Training Harness is a separate Super Admin and worker lane. Synthetic
Capture Variants never appear as real customer inspections or normal report
inbox jobs.

## One App-To-Server Execution Path

The harness must test the same evidence path used by an inspector. It must not
insert a synthetic package directly into report tables or call a private demo
bootstrap route.

```text
reviewed truth graph
  -> versioned capture-scenario manifest
  -> LAIQ inspection app training-data loader
  -> normal app task and local storage
  -> production V3 export code
  -> authenticated object upload
  -> checksum and contract verification
  -> immutable inspection revision
  -> normal report import adapter
  -> training-only report job
```

The Capture Variant Builder owns the scenario manifest, not the final app export.
The LAIQ inspection app owns materializing that scenario and producing the V3
package. The report platform owns immutable upload, validation, normalization,
generation, and evaluation.

Batch automation may use a headless app-export harness only when it executes
the same versioned export-contract implementation and passes byte-level parity
tests against an export produced by the app. It must still use the normal
authenticated object-upload and import pipeline. Direct database seeding is
not evaluation evidence.

Every resulting inspection revision is tagged as a training artifact and is
isolated from tenant report inboxes, production analytics, and normal KB
publication.

## Trust Zones

| Artifact | Truth Case Builder | Capture Variant Builder | Generator/retriever | Evaluator | Policy optimizer |
| --- | ---: | ---: | ---: | ---: | ---: |
| Historical Gold Report | Yes | No | No | Yes | No |
| Reviewed inspection truth graph | Yes | Yes | No | Yes | No |
| Synthetic capture package | No | Creates | Yes | Yes | Context labels only |
| Other approved precedent reports | No | No | Yes | Optional | Retrieval metrics only |
| Matching gold chunks | Yes | No | No | Yes | No |
| Standards KB | Optional | No | Yes | Yes | Configuration only |
| Generated report section | No | No | Creates | Yes | Reward only |
| Raw client/tank facts | Review only | Transform only | Evidence pack only | Yes | No |

The policy optimizer receives categorical context and metrics. It must never
receive gold prose, client names, measurements, report identifiers, or voice
transcripts.

## Core Harness Artifacts

### Historical Source Bundle

One logical inspection case containing:

- final issued PDF
- matching DOCX rendition when available
- field sheets and calculations
- photographs and drawings
- MFL, MPI, settlement, or 3D-scan supporting assets
- document hashes, revision lineage, report family, and access scope

All renditions and attachments inherit one case identity and one dataset split.

### Inspection Truth Graph

A reviewed, normalized representation of what occurred during the historical
inspection. It is not report prose.

Each fact contains:

- stable `factId`
- fact type and canonical section
- normalized value and unit where applicable
- source document, page, block, and bounding-box provenance
- source confidence and reviewer status
- evidence class
- allowed capture destination
- answerability class
- safety criticality

Example:

```json
{
  "factId": "fact-shell-area-1-min-ut",
  "factType": "measurement_summary",
  "sectionKey": "shell-external-area-1-ut-scanning-findings",
  "value": 2.28,
  "unit": "mm",
  "source": {
    "documentId": "hidden-gold-document-id",
    "page": 14,
    "blockIds": ["block-14-22"]
  },
  "evidenceClass": "structured_field",
  "captureDestination": "utMeasurements",
  "answerability": "app_observable",
  "reviewStatus": "approved"
}
```

### Answerability Map

The answerability map prevents the evaluator from penalizing the generator for
information that could not have been known from the simulated capture.

| Class | Meaning | Expected generator behavior |
| --- | --- | --- |
| `app_observable` | Structured field, measurement, finding, photo, or layout evidence | Use the app evidence |
| `voice_observable` | Inspector could reasonably state it onsite | Use the voice/note evidence |
| `report_side_input` | Owner, approver, acceptance, or customer confirmation | Ask the user or keep pending |
| `deterministic_derived` | Calculation or table summary | Call the approved deterministic tool |
| `precedent_template` | Section shape, labels, formatting, or normal wording pattern | Retrieve approved precedent/template guidance |
| `standards_guidance` | Requirement or controlled rule context | Retrieve the separate standards lane |
| `engineering_judgment` | Requires responsible inspector/engineer decision | Explain evidence but require human confirmation |
| `gold_only_unobservable` | Present in the report but unavailable from allowed evidence | Do not guess; exclude from required-fact penalty |

Only `app_observable` and `voice_observable` facts may be materialized into a
synthetic LAIQ inspection app package. Report-side, derived, template, and
judgment information stays in its own lane.

### Capture Variant

A reproducible simulation of how one inspector might capture the approved
truth graph.

Every variant stores:

- parent Truth Case and dataset split
- capture profile version
- deterministic random seed
- exact included and withheld fact IDs
- transformed note and transcript provenance
- attachment selection manifest
- source package checksum
- V3 schema/contract version
- quality and expected-missing-input labels
- generation eligibility and review status

The variant package is immutable after approval. Regeneration creates a new
variant version.

## Truth Case Builder

The Truth Case Builder is the only preprocessing component allowed to read the
Historical Gold Report before evaluation.

### Deterministic Extraction

Use deterministic extraction first for:

- headings and section boundaries
- report metadata
- tables and numeric values
- units and measurement labels
- photo captions and page locations
- attachment references
- layout and drawing identifiers

### Constrained AI Extraction

AI may propose structured facts from narrative text only when:

- every proposed fact cites source blocks
- output follows a fixed schema
- it cannot replace immutable source text
- numeric values are checked against extracted source text
- low-confidence proposals require review
- approval is recorded before variant generation

The Truth Case Builder must not copy final recommendation sentences into voice notes.
It extracts the underlying observed condition and separates it from the final
engineering action.

## Capture Variant Builder

### Variation Principle

Variation applies to capture behavior, not inspection truth.

Safe dimensions include:

- completeness by section and evidence type
- note length and terminology
- structured-field versus voice-note preference
- observation order and timestamps
- repeated or merged observations
- punctuation and noncritical ASR noise
- photo density and caption detail
- measurement sampling density where the historical evidence supports it
- explicit uncertainty and pending fields

The simulator must not silently change:

- measurements
- units
- plate, course, lane, element, or finding identity
- finding severity
- coordinates or layout geometry
- photo-to-finding linkage
- responsible-person decisions

### Initial Capture Profiles

| Profile | Capture behavior | Main test |
| --- | --- | --- |
| `structured_complete` | High field completion, concise notes | Deterministic upper bound |
| `voice_heavy` | Minimal fields, detailed voice observations | Transcript routing and fact extraction |
| `terse_expert` | Abbreviations and technical shorthand | Terminology robustness |
| `interrupted_partial` | Correlated missing sections and pending evidence | Missing-input discipline |
| `disordered_capture` | Correct facts captured in non-report order | Evidence routing |
| `noisy_transcript` | Punctuation and noncritical ASR errors | Narrative robustness |
| `evidence_rich` | Extra photos and repeated observations | Deduplication and evidence selection |
| `minimal_compliant` | Minimum required capture only | Template and standards assistance limits |

The first pilot should create two deterministic seeds for each profile. This
produces 16 variants per Truth Case without pretending they are 16
independent inspections.

### Faithful And Fault-Injection Lanes

Keep two datasets separate:

- `faithful_capture`: all included facts remain true; variation covers style,
  completeness, ordering, and evidence density
- `fault_injection`: explicitly labelled wrong units, conflicting readings,
  plate mismatches, duplicate IDs, or broken attachment links

Faithful variants train retrieval and generation policy. Fault-injection
variants test validation, warning, and rejection behavior and are not normal
positive-reward episodes.

## Variant Split And Leakage Rules

All Capture Variants from one Truth Case must inherit the same split:

- `training`: policy learning and candidate development
- `validation`: repeated candidate comparison without policy updates
- `hidden_test`: final evaluator-only promotion gate

Never split variants from one source report across training and validation.
That would leak the same inspection truth into both sides and inflate results.

### Dataset Roles

Each immutable benchmark snapshot gives every historical document exactly one
role:

| Role | Retriever access | Evaluator access | Policy use |
| --- | --- | --- | --- |
| `training_precedent` | Yes, subject to scope and time cutoff | Optional | Retrieval candidate |
| `training_gold` | Never for its own case | Yes | Training reward target |
| `validation_gold` | No in training or validation generation | Yes | Candidate comparison only |
| `hidden_test_gold` | No until the sealed promotion run | Yes in sealed run only | Final promotion gate |
| `standards_guidance` | Separate standards lane only | Yes | Controlled technical context |

A document cannot be both retrievable precedent and validation/hidden gold in
the same benchmark snapshot. Changing its role creates a new versioned
snapshot; it does not mutate past results.

### Temporal Cutoff

Every case has an `evidenceAsOf` timestamp, normally the historical inspection
start time. Retrieval may use only precedent issued before that cutoff. This
prevents later reports, revisions, or repairs from leaking future knowledge
into an earlier simulated inspection.

For `operational_history`, earlier approved reports for the same asset may be
retrieved when policy and tenancy allow it. For `asset_generalization`, all
same-asset lineage remains excluded.

Use two benchmark tracks:

| Track | Same asset history | Purpose |
| --- | --- | --- |
| `operational_history` | Prior approved reports for the same client/tank may be retrieved, excluding the current gold case | Measures realistic production benefit |
| `asset_generalization` | Same physical asset/report lineage is excluded | Measures transfer to unseen tanks and prevents near-duplicate overfitting |

Production promotion must pass both tracks.

Gold exclusion uses all of:

- logical case ID
- report reference
- document ID and SHA-256
- alternate rendition IDs and hashes
- source chunk IDs
- derived embedding/index records
- duplicated source paths
- benchmark role and snapshot version
- issue/revision time relative to `evidenceAsOf`

## Harness Execution

### One Episode

```text
state before generation
  -> select one approved policy arm
  -> build retrieval query from section intent and capture evidence
  -> retrieve non-gold precedent and standards context
  -> generate one section
  -> run deterministic and semantic evaluators
  -> calculate guarded reward
  -> persist trace without changing any inspector draft
```

### State

State describes the problem before the action. Evaluation metrics are reward,
not state.

Allowed state features include:

- report family
- canonical section key and section class
- capture profile
- structured/voice/photo/layout evidence counts
- evidence richness bucket
- missing-input classes
- transcript quality bucket
- standards lane availability
- historical-asset-context availability

State excludes literal current-report facts and gold text.

### Action

Actions are reviewed configuration bundles, not arbitrary prompts or code:

- lexical and vector retrieval weights
- metadata filters
- candidate depth and top-K
- reranker version
- query expansion strategy
- precedent and standards context limits
- reviewed prompt variant
- reviewed evidence-pack format
- approved section-worker/tool route

### Evaluation

Use deterministic metrics before LLM judging:

- exact table/cell and numeric/unit checks
- required app-fact recall
- verifiable claim precision
- evidence-ID grounding
- retrieval Precision@K, Recall@K, MRR, and nDCG
- section structure and format compliance
- missing-input and abstention behavior
- same-gold and cross-tenant leakage checks

Use a constrained semantic evaluator for narrative equivalence,
recommendation support, and acceptable wording variation. Lexical similarity to
gold is diagnostic only and cannot independently promote a policy.

### Reward Aggregation

Aggregate in this order:

```text
section score
  -> capture-variant score
  -> capture-profile score
  -> historical-case score
  -> report-family score
  -> full benchmark score
```

First average within a Truth Case, then across Truth Cases. Sixteen variants
from one report must not have sixteen times the policy influence of one variant
from another report.

Track both:

- macro mean across Truth Cases
- worst-profile and lower-decile performance

Hard failures force zero reward or learning ineligibility:

- same-gold retrieval
- unsupported current facts
- critical numeric or unit mismatch
- cross-tenant/client leakage
- invented required inputs
- unreviewed truth facts or low-confidence labels
- regression on protected hidden-test cases

## System-Level RL Boundary

The first production optimizer remains a PostgreSQL-backed contextual bandit.
It learns which approved RAG configuration works best for a section context.
It does not update model weights.

```text
context state + approved action -> generated result -> guarded reward
```

Offline training may explore approved candidate arms. Live inspector traffic
uses only one immutable promoted policy with exploration disabled.

A candidate policy may be promoted only when:

- required Truth Case and Capture Variant profile coverage is met
- validation macro metrics improve
- worst-profile thresholds pass
- no protected metric regresses beyond tolerance
- hidden-test cases pass
- hard-failure count is zero
- a Super Admin records the promotion decision

## End-To-End Operator Workflow

The harness is operated report by report, but policies are evaluated and
promoted over case-balanced batches. A single report or a single capture
variant must never determine the production policy.

### Step 1: Ingest And Approve Historical Sources

Super Admin operation:

1. Select or upload the original historical report and its available
   supporting evidence.
2. Run deterministic PDF/document extraction.
3. Review the original pages beside the ordered extracted chunks.
4. Resolve extraction warnings, document family, source role, and dataset
   split.
5. Approve the source for one immutable benchmark role.

System data flow:

```text
source PDF/DOCX/images
  -> checksum and immutable S3 object
  -> parser/OCR/table extraction
  -> sections, chunks, page/block/bounding-box provenance
  -> embedding and lexical index candidates
  -> human KB review
  -> approved KB document
```

The original source bytes never change. Re-ingestion creates a new rendition
or ingestion run rather than overwriting approved lineage.

Current readiness: the ingestion service, immutable KB storage, ordered chunk
review, source-page navigation, warnings, classification, and document
approval UI are implemented as a baseline. Production pgvector retrieval still
requires further integration and hardening.

### Step 2: Build And Review The Historical Truth Case

Super Admin operation:

1. Choose one approved Historical Gold Report.
2. Add matching field sheets, calculations, photographs, and specialist
   evidence when available.
3. Start deterministic truth extraction.
4. Review each proposed fact beside its exact source page and block.
5. Classify each fact's answerability and allowed capture destination.
6. Approve the truth case only after critical facts and provenance are
   complete.

System data flow:

```text
Historical Source Bundle
  -> deterministic metadata/table/fact extraction
  -> constrained AI narrative fact proposals with citations
  -> normalized truth graph
  -> answerability map
  -> human approval
  -> immutable truth-graph snapshot
```

The truth graph stores inspection facts, not copied report prose. AI proposals
remain unapproved until a Super Admin confirms their source and meaning.

Current readiness: PostgreSQL benchmark, internal `training_case`, truth-fact,
answerability, locking, and provenance contracts are implemented. The Truth
Case Builder worker and side-by-side truth review UI are not implemented.

### Step 3: Generate Versioned Inspector-Capture Variants

Super Admin operation:

1. Select an approved truth case.
2. Choose the default capture-profile matrix or an approved advanced profile.
3. Generate multiple deterministic variants using versioned seeds.
4. Review included, omitted, and transformed facts.
5. Confirm expected missing inputs and approve the variant batch.

Each variant may vary:

- structured field completeness
- voice-note detail, ordering, terminology, and transcription noise
- note fragmentation and inspector shorthand
- photograph selection, caption completeness, and attachment order
- checklist completeness and report-side information availability

Variation changes capture behavior, never inspection truth. Critical
measurements, units, identifiers, and finding relationships cannot be randomly
altered in a normal positive-learning variant.

Language-training variants include field data, voice/notes, photographs, and
other app-captured evidence. Layout-map geometry stays outside language
training and continues through deterministic geometry/parity validation. A
section may receive approved map-derived facts as deterministic evidence, but
RAG/LLM policy does not learn how to redraw the map.

Current readiness: migration `017_capture_variant_builder.sql`, eight faithful
profile presets, deterministic seeded scenario generation, protected-fact
handling, fact-link persistence, review UI, S3 scenario approval, and
post-approval immutability are implemented. The builder emits only the
versioned `laiq_capture_scenario`; it deliberately does not compile a final V3
app export.

### Step 4: Pass Every Variant Through The Real App Boundary

System operation:

```text
approved capture manifest
  -> LAIQ inspection app training-data loader
  -> normal app task/local storage
  -> production V3 export code
  -> authenticated object upload
  -> checksum verification and immutable source revision
  -> report-platform import and report job
```

The simulator must not insert packages directly into report tables. A variant
is evaluation eligible only after the server verifies the same V3 package,
identity, storage, and provenance requirements used for a real inspection.

Current readiness: authenticated V3 upload, object verification, immutable
import revisions, and the report job inbox are implemented. The training-data
loader and automated variant round-trip through the LAIQ inspection app are
not implemented.

### Step 5: Generate Sections With The Gold Firewall

For every selected section, the report compiler performs:

```text
immutable app revision
  -> normalized section evidence pack
  -> answerability and missing-input analysis
  -> section-agent/tool selection
  -> evidence-derived retrieval query
  -> tenant/snapshot/role/time/case/hash/rendition firewall
  -> hybrid retrieval and reranking
  -> controlled prompt assembly
  -> LLM narrative drafting plus deterministic tools
  -> structured section output and provenance
  -> factual, format, and leakage validation
```

The LLM can draft prose and organize supported evidence. Deterministic tools
remain authoritative for measurements, calculations, checklist responses,
layout geometry, source provenance, and export structure.

Current readiness: interactive inspector section generation, deterministic
tables/maps, controlled editing, approval, and DOCX compilation are
implemented. The firewall contract is implemented and runs before scoring when
an evaluation context is supplied. The evaluation batch runner does not yet
construct that context and execute all case/variant sections automatically.

### Step 6: Compare Generated Output With Hidden Gold

The evaluator receives the generated output only after generation completes.
The generator cannot read the matching historical report or its chunks.

Evaluation includes:

- retrieval Precision@K, Recall@K, F1, MRR, and nDCG
- verifiable claim precision and unsupported-claim rate
- answerability-aware required-fact recall
- critical numeric, identifier, and unit accuracy
- semantic coverage and section-structure alignment
- missing-input discipline
- photograph/evidence grounding where applicable
- leakage and cross-tenant safety
- optional human inspector scoring and comments

Scores aggregate from section to Capture Variant, then to Truth Case, report
family, benchmark track, and complete snapshot. Case-level macro aggregation
prevents a report with many variants from dominating the result.

Current readiness: deterministic metric functions, relevance/fact label
storage, evaluation-case linking, and persisted run display are implemented as
baselines. The answerability-aware hidden-gold comparison worker, batch
scheduler, generated-versus-gold review UI, and macro/worst-profile scorecard
are not implemented.

### Step 7: Optimize The Controlled RAG/Generation Policy

The initial learning target is the report-generation system, not foundation
model weights.

```text
state
  = report family + section type + evidence completeness + batch metrics

action
  = one reviewed retrieval/prompt/reranker/tool configuration

reward
  = case-balanced eval score subject to hard safety gates
```

Offline policy learning may adjust approved retrieval limits, lexical/vector
weights, reranking, section-agent instructions, prompt variants, evidence-pack
composition, and tool-routing choices. It cannot create arbitrary prompts,
scripts, or standards rules. Missing-input, low-confidence, leakage, invented
fact, or incomplete-label episodes are ineligible or receive a hard failure.

Current readiness: PostgreSQL policy versions, approved arms, contextual-bandit
selection, rewards, promotion, rollback, and the Policy Registry UI are
implemented as a baseline. They are not yet fed by complete harness batch
rewards, so current policy state must not be presented as proof of trained
historical-report performance.

### Step 8: Validate And Promote

1. Explore candidate configurations only on training-split Truth Cases.
2. Freeze the candidate and run validation cases without learning.
3. Run sealed hidden-test cases only for the promotion decision.
4. Block promotion on leakage, critical unsupported facts, missing benchmark
   coverage, or protected-metric regression.
5. Require a Super Admin promotion reason and preserve immediate rollback.
6. Use the promoted immutable policy for live inspector generation with
   exploration disabled.

Current readiness: promotion/rollback controls and metric-gate contracts exist.
Training/validation/hidden-test orchestration and sealed benchmark execution
are not implemented.

## Current UI Readiness

| Operator surface | Status | What works now | Missing before the full loop works |
| --- | --- | --- | --- |
| Knowledge Base Review | Implemented baseline | Real approved sources, ordered chunks, original-page preview, warning review, classification, approval | Broader ingestion quality hardening and production vector publication |
| Evaluation Lab: Approved Sources | Implemented baseline | Lists approved PostgreSQL KB sources; no fixture inventory | Benchmark snapshot/role management UI |
| Truth Case Builder | Implemented baseline | Approved-source discovery, deterministic source-linked proposals, original-page review, answerability decisions, S3 Truth Graph artifact, and immutable approval | Constrained AI extraction proposals, supporting-source bundles, and queue-backed extraction |
| Capture Variant Builder | Implemented baseline | Eight user-selectable faithful styles, deterministic seeds, included/withheld/transformed preview, expected missing inputs, automatic validation, and immutable S3 Capture Scenario storage | LAIQ app materialization and App Round Trip status integration |
| Inspector Report Workspace | Implemented V1 Beta | Interactive generation, evidence preview, edits, approval, DOCX | Harness batch invocation and pinned evaluation context |
| Evaluation Runs | Partial | Displays persisted evaluation-linked runs | Run launcher, batch scheduler, gold comparison, case-balanced scorecards |
| Policy Registry | Implemented baseline | PostgreSQL policy/reward state, promotion, rollback | Rewards from completed Training Harness batches and sealed validation gates |

The existing four-tab Evaluation Lab is not yet the complete training loop.
It covers approved source selection, consolidated automated Truth Case and
user-selected mock-data generation, persisted run visibility, and policy visibility. App
Round Trip remains required before Evaluation Runs can become a complete
historical training operation. The former Evidence Pairing API remains an
internal compatibility path and is not a current product stage.

## Super Admin Harness UI

Keep the workflow understandable with four current stages.

### 1. Approved Sources

- select an approved immutable historical source
- confirm that extraction and KB review are complete
- keep standards and specialist sources out of the primary Truth Case role

### 2. Truth & Mock Data

- select an approved KB report
- review source extraction and truth facts beside the original document
- classify answerability and capture destination
- approve or reject the case

- generate the default profile matrix with one action
- inspect included, withheld, and transformed facts
- preview the versioned Capture Scenario contract
- validate the scenario contract and App Round Trip target
- approve the variant batch

Advanced profile parameters stay hidden unless an exceptional case requires
manual tuning.

### 3. Evaluation Runs

- choose a candidate policy and case/profile batch
- run section generation with the gold firewall
- compare generated sections with gold and answerability labels
- show metrics, retrieved chunks, failed claims, and missing-input behavior
- allow expert review of machine-proposed relevance labels

### 4. Policy Registry

- compare production and candidate policies
- show case-level and profile-level performance
- show hard failures and metric regressions
- promote or roll back with an audit reason

## Proposed Storage Model

PostgreSQL stores metadata, review state, lineage, and metrics:

- `report_training_cases`
- `report_training_case_sources`
- `report_training_case_facts`
- `report_training_case_answerability`
- `report_capture_profile_versions`
- `report_capture_variants`
- `report_capture_variant_fact_links`
- `report_harness_batches`
- existing `report_evaluation_cases`
- existing `report_evaluation_case_sections`
- existing relevance and required-fact labels
- existing `report_eval_runs`
- existing system RL policy, decision, reward, and event tables

S3-compatible object storage stores immutable large artifacts:

- gold source documents
- truth-graph snapshots
- approved Capture Scenario manifests
- synthetic attachment variants
- extraction manifests
- evaluator evidence bundles
- generated comparison artifacts

Queue-backed workers own extraction, case building, variant generation,
contract validation, batch generation, evaluation, and embedding/index work.

## Harness State Machine

```text
source_approved
  -> truth_extracting
  -> truth_review_required
  -> case_approved
  -> variants_generating
  -> variants_review_required
  -> evaluation_ready
  -> batch_running
  -> batch_scored
  -> policy_learning_eligible | blocked
  -> validation_passed
  -> hidden_test_passed
  -> promoted | rejected
```

Every transition is durable, idempotent, resumable, and auditable.

## First Pilot

Use one approved historical report to prove the harness mechanics, not policy
quality.

Pilot scope:

- build and review its truth graph
- classify answerability for narrative and recommendation sections
- generate the eight default profiles with two seeds each
- validate all 16 packages against the supported app-export contract
- run generation with the matching report excluded from retrieval
- compare one deterministic section and two narrative/hybrid sections
- confirm case-level aggregation prevents variant-count weighting
- confirm all leakage and missing-input hard gates

Policy promotion remains disabled until multiple independent training,
validation, and hidden-test Truth Cases exist.

## Implementation Phases

### Phase 1: Contracts And Gold Firewall (Implemented Foundation)

- PostgreSQL truth graph and answerability schemas are implemented in migration `016_training_harness_foundation.sql`.
- benchmark snapshots assign one immutable dataset role per document and preserve source case, rendition, hash, object key, issue time, and asset lineage
- locked snapshot, case, source, fact, and answerability records are protected by database triggers
- `server/training-harness.mjs` validates benchmark roles, truth provenance, answerability, and production app-import eligibility
- the retrieval firewall excludes matching case/rendition/document/hash/chunk/path/name identities, validation/hidden gold, future evidence, and same-asset history for the generalization track
- `server/precedent-kb.mjs` applies the firewall before candidate scoring whenever an evaluation context is supplied; normal inspector retrieval remains unchanged
- `npm run training-harness:audit` proves the contract and exclusion behavior deterministically

Phase 1 does not execute a historical evaluation batch. Those capabilities begin in Phases 3–4.

### Phase 2: Truth Case Builder (Implemented Baseline)

- deterministic chunk-to-fact proposal mapping with exact document/page/block/bounding-box provenance
- source-side three-pane review UI with original PDF region, proposal queue, and answerability editor
- explicit approve/reject decisions for every proposal
- S3-compatible versioned Truth Graph artifact generation
- transactional case and benchmark locking after approval
- PostgreSQL lifecycle audit proving proposal, review, manifest, approval, and immutability behavior

Constrained AI extraction proposals and multi-document Historical Source Bundles remain later Phase 2 hardening. They must use the same review and provenance contract rather than bypass it.

### Phase 3: Capture Variant Builder (Implemented Baseline)

- versioned capture profiles
- deterministic seed engine
- `laiq_capture_scenario` manifest compiler with an explicit V3 App Round Trip target
- fact inclusion/transformation manifests
- automatic faithful-scenario validation, immutable S3 storage, and responsive preview UI

The LAIQ inspection app still owns scenario materialization and production V3
export. Batch-level App Round Trip orchestration remains Phase 4 work.

### Phase 4: Evaluation Runner

- case/profile batch scheduler
- section generation with pinned policy bundle
- answerability-aware metrics
- relevance-label review
- macro and worst-profile aggregation

### Phase 5: Policy Learning

- learning-eligible reward feed
- candidate arm comparison
- validation and hidden-test gates
- Super Admin promotion and rollback

## Acceptance Criteria

The harness is trustworthy only when:

- every synthetic fact resolves to approved source provenance
- every withheld fact is recorded
- no gold text or matching chunk reaches generation
- all case variants share one dataset split
- every benchmark document has one immutable role in a versioned snapshot
- validation and hidden-test gold are unavailable to generation
- retrieval cannot see reports issued after the case cutoff
- the same report is not overweighted by variant count
- every variant reaches the server through the production V3 export/upload/import boundary
- app packages pass the real versioned import contract
- unanswerable gold information does not penalize honest pending behavior
- critical facts cannot be changed by normal variation
- fault injection is isolated from normal learning rewards
- every score is reproducible from pinned model, prompt, retrieval, template,
  tool, profile, seed, and source versions
- production policy changes require held-out evidence and an audited promotion

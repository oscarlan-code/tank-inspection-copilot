# SYN-025 revision 3: complete checklist and outline-based export review

Status: **evaluation only; native export created, platform upload/import pending**.

The subsequent [12-section generation evaluation](2026-09-18-generic-12-section-evaluation.md)
is complete. [Open its generated drafts and actual AI responses](data/syn025-current-only-v3/evaluation-12-live/review.html).

Open the [review page](data/syn025-current-only-v3/review.html) to inspect all
195 answers, the 25-template review, real photos, eleven voice notes and the
actual [native export](data/syn025-current-only-v3/native/export.json).
Revision 2 remains unchanged as the incomplete-input diagnostic.

## What changed

The new authored scenario supplies one explicit response and observation for
each native checklist question. It covers accessible surroundings, foundation,
external/lower internal shell, accessible fixed-roof upper surface and floor.
F14 remains covered; inaccessible roof areas retain access limitations. Absent
features have individual N/A reasons. The checklist contains 30 Good, 16
Satisfactory, 39 None Evident, 12 Inaccessible, 96 N/A and two Requires Repair
responses. Sixty N/A responses concern absent floating roofs.

The two repair observations retain the original report photographs and their
provenance. No new photographs or defects were generated. Other observations
are explicitly synthetic; visual responses do not certify code conformance,
dimensional surveys, load capacity or fitness for service.

Five supported elements are placed on native maps: shell nozzle, manway and
platform, roof vent and gauge hatch. Component descriptions without a supported
native geometry type remain in checklist/voice with the limitation recorded.
Three active layouts and two UT rows retain actual generated app identifiers.

The previous mock entered dimensions as `10 m` and `12 m`, but the native
fields require numeric strings and serialize to `diameterM`/`heightM`. Revision
3 correctly captures `10` and `12` before persistence. Assertions verify the
exported values; no export JSON or production parser was patched.

Eleven actual speech files carry scope, observations, recommendations, identity,
units, point semantics and limitations. They are synthesized from authored
scripts; native transcripts remain `pending_server`. No ASR was claimed.

## Outline review

The [input review](data/syn025-current-only-v3/outline-readiness-review.json)
covers every one of the 25 templates and 89 blocks. Twelve modules are selected;
the other thirteen have explicit scope exclusions. Optional asset history is
absent. The review associates required inputs with structured capture, voice,
media or platform-owned dependencies. It is kept outside the native package
and generator inputs; it does not replace backend multilabel classification.

The review deliberately separates capture/export success from report readiness:

| Remaining issue | Available capture / next work |
| --- | --- |
| UT units and point semantics | Explicit in V02/V10 audio; missing dedicated native UT unit metadata. Transcription and reviewed normalization remain downstream work. |
| Inspection date | Captured in the app draft and V09 audio, but absent as a dedicated native inspection-record field. Structured export omission remains visible. |
| Additional component geometry | Described in checklist/voice; no invented native element type for rafters, column, davit, ladder or dip plate. |
| Finished roof/shell figures | Geometry is exported; only floor currently has an app-generated SVG. Figure rendering remains downstream work. |
| Inspection and maintenance regime | Applicable approved template selection is pending. No AI drafting or rewriting. |
| Procedure/calibration records | Explicitly not supplied; obtain the applicable controlled records before claiming such compliance. |

This is not a claim that all report inputs are complete or generation-ready.

## Executed checks

Three focused native tests passed with zero failures, errors or skips:
preparation validation, the actual 195-answer/194-answer export gate, and the
full media-backed materialization through `ProductDraftJsonCodec`, Room and
`ProductStore.exportInspection()` under Robolectric. No device UI capture was
performed. All native export checks pass; the exported file is byte-identical
to the app's output and contains 195 answers, eleven voice records, thirteen
attachments, two UT rows, five mapped elements and three active layout targets.
Android working-tree guardrails and report-platform standard guardrails pass.
The review page was checked in Chrome; all local links, eleven audio players,
two image references and native artifact checksums were verified.

The strict report-platform V3 package validator and local attachment checks also
pass. The normal authenticated media upload/import integration is pending
destination-specific approval for the configured Tailscale storage endpoint
`http://100.101.225.110:59000`, bucket `laiq-report-platform`. Automatic approval
review rejected that transfer before execution. The prepared integration runner
uses a separate temporary PostgreSQL database, normal password authentication,
signed object uploads and verified media read-back, then cleans up only its own
test database and objects. It performs no generation or promotion.

## Reproduction

From the repository root, review preparation before native export:

```sh
node apps/report-platform/server/scripts/review-syn025-export-readiness.mjs
```

The native test accepts `SYN025_COMPLETE_INPUT_DIR` pointing to the revision-3
preparation folder and `SYN025_COMPLETE_OUTPUT_DIR` pointing to a new/empty
artifact folder. From `apps/field-android`, with Java 17 and Android SDK set:

```sh
./gradlew :app:compileDebugKotlin :app:testDebugUnitTest --tests '*ProductSyn025CompleteExportTest'
```

The import runner defaults to local validation. Its `--run` option performs
the real API test only after the external destination is authorized. Existing
output directories are never overwritten. No model, production checklist rule,
runtime template or export schema was changed.

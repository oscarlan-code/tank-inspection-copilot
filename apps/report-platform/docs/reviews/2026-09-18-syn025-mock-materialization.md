# SYN-025 mock preparation and local diagnostic

Status: **evaluation only, 18 September 2026; native draft materialized, export blocked**.

Open the [mock review page](data/syn025-current-only-v1/review.html) to inspect
the real photos, play all eight voice notes and see their current classification.
The [case manifest](data/syn025-current-only-v1/case-manifest.json) records the
complete boundary of this run. This is a source-assisted preparation diagnostic,
not an independently approved quality benchmark or product promotion.

## Prepared evidence

| Input | Result |
| --- | --- |
| Active layouts | External roof, shell and floor; no internal floating roof. |
| Measurements | Two native UT records: floor five-point readings and shell nozzle/pad readings. Values/blank cells preserved. |
| Findings | Floor coated surface pitting; external shell coating damage along a horizontal seam. |
| Photographs | Real source-report Photo 27, page 42, and Photo 7, page 39. Full embedded images extracted without generated or retouched pixels. |
| Voice | Eight actual M4A speech files, synthesized from authored scripts, with measured durations and native context. No ASR was performed. |
| Checklist | 62 justified responses: two captured repair findings and 60 N/A responses for absent floating-roof components. 133 items remain unanswered. |
| Optional asset history | None supplied. Source-report photos are separately attributed media, not prior history for a real asset called SYN-025. |
| Proposed answer key | 16 claims and 39 section uses, separately prepared from source scripts. Review pending; not supplied to the classifier or generator. |

Photo source: `/Users/oscar/Public/irs/mfl and floor layout /18PE1-3 TK SU4 Internal & External Inspection Report.pdf`.
See [photo provenance](data/syn025-current-only-v1/source-photos.json) for report,
page, photo number, PDF image object and checksums. F12 and L1-C1 are declared
evaluation aliases; the original photographs do not establish those exact
locations or the fictional current UT values. Associated condition wording
retains its report-photo lineage. The case is mixed synthetic/report-derived.

## What was actually executed

The new Android test-only fixture passes through `ProductDraftJsonCodec`, native
`ProductStore`, Room persistence and the actual `exportInspection` validation.
It runs under Robolectric, not on an emulator/physical device or through UI
capture. No production seed, app model or export gate was changed.

All three focused tests passed. The actual native export was rejected because
the checklist is incomplete. The resulting [native validation](data/syn025-current-only-v1/native/validation.json)
and [Room diagnostic snapshot](data/syn025-current-only-v1/native/native-room-snapshot.json)
record `exportReady:false`; no `v3_product_export` file was created. Attached
photo/audio files passed existence, type, byte-count, checksum and native-link
checks. Missing source history remains empty.

An evaluation-only runner projects those persisted tables into the existing
planner's input representation. Its transformation ledger is explicit; this
does **not** establish native-export/import parity or bypass the app's gate.
Two local runs use the same records:

1. Native transcript fields: pending-server and empty, as stored by Android.
2. Authored-script substitution in a separate diagnostic copy: enables voice
   classification testing without claiming speech recognition or changing Room.

Both runs use the existing 32-section profile and deterministic planned
generation. The generic 25-template catalogue remains offline. Source files
were hash-checked again after the runs and remained unchanged. No KB retrieval,
transactional report import, policy update or promotion was performed. Standard
report-platform guardrails and Android working-tree guardrails passed.

## Findings from the local run

- Both explicit spoken recommendations are retained as supporting evidence
  with `unconfirmed_action`, and do not appear as recommendation prose.
- Method/unit/coverage statements recorded on the floor UT screen enter floor
  findings instead of methodology and measurement metadata.
- Some shell statements remain ambiguous even when the text says “outside.”
  Closeout notes recorded in general information enter inspection details.
- The current native measurement record has no explicit UT unit. The spoken
  millimetre statement does not automatically resolve that gap in this planner.
- Uppercase native `ELEMENT` is classified toward the shell-plate table;
  nozzle-specific routing is not established. Floor UT lacks a detailed
  destination in the existing profile.
- Repeated applicability notes from checklist rows create many separate
  ambiguous observations. Record counts therefore are not distinct finding
  counts or a report-quality score.

The [diagnostic summary](data/syn025-current-only-v1/diagnostic/summary.json)
contains measured counts, and the [per-record routing](data/syn025-current-only-v1/diagnostic/authored-transcripts/routing-and-issues.json)
shows actual destinations/issues. No recovery percentage is claimed because
the expected labels are not independently approved.

This result separates capture richness from pipeline support. The mock can
contain the inspector's recommendation, while the existing classifier still
fails to place it as required recommendation output. More voice content alone
does not correct that rule.

## Approved live check

The initial automatic approval rejection was resolved when the user explicitly
approved sending the evaluation data. Two live calls then reached the configured
GPT-5.6 Sol worker through the shared generator. Both fell back with
`Voice response failed evidence validation`; `usedLiveModel` is false because
the generated wording was not accepted into the compiled draft. The second
call retained its [exact request](data/syn025-current-only-v1/diagnostic-live-traced/live-worker-request.json)
and [actual response](data/syn025-current-only-v1/diagnostic-live-traced/live-worker-response.json).
The first response was not retained and is not represented by the second.

The traced request exactly matches the previously prepared preview: 11 routed
voice statements for `inspection-report`, with no photo/audio bytes, historical
KB or proposed 25-section labels. All 11 evidence IDs were returned once.
A [replay of the shared validator](data/syn025-current-only-v1/diagnostic-live-traced/voice-validation-audit.json)
reported seven statements as omitted and four as unresolved, with no integrity
blocker reasons. Review of the source/response pairs found no apparent loss of
meaning: for example, “I have not scanned the whole plates” became “The whole
plates were not scanned.” This is evidence of a conservative lexical-check
limitation, not seven proven factual omissions. No acceptance rule was weakened.

The review page shows all 11 pairs separately from the retained fallback draft.
This tests worker access and wording of already routed statements; it does not
test photo interpretation, ASR, recommendation recovery, native export or the
25-section candidate. Both runs verified source files remained unchanged.

## Outstanding checks

The app requires all 195 checklist items rated but has no dedicated “not
examined” rating. `NE` means **None Evident**, `NC` means **Not to Code**, and
`IA` means inaccessible. These cannot represent every unknown or out-of-scope
case interchangeably. Clarify applicable checklist completion/missing-state
handling before attempting an honest complete native export for this scope.

The next pipeline review must address section routing and distinguish semantic
equivalence from lexical overlap in the evidence validator. The current result
does not justify a recovery score or model/policy promotion.

## Reproduction

From `apps/field-android`, use a new output directory each time:

```sh
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
ANDROID_HOME=/Users/oscar/Library/Android/sdk \
SYN025_MEDIA_DIR=/Users/oscar/Code/tank-inspection-coplilot-app/apps/report-platform/docs/reviews/data/syn025-current-only-v1/media \
SYN025_OUTPUT_DIR=/tmp/syn025-native-new \
./gradlew :app:compileDebugKotlin :app:testDebugUnitTest --tests '*ProductSyn025MaterializationTest'
```

From the repository root, run the local deterministic diagnostic:

```sh
node apps/report-platform/server/scripts/run-syn025-preprocessing-diagnostic.mjs \
  --input-dir /tmp/syn025-native-new \
  --output-dir /tmp/syn025-diagnostic-new
```

For the approved live check, add `--live` and choose a fresh output directory.
The diagnostic runner retains the worker request/response for review, including
responses rejected by the unchanged shared generator. Expected labels and
withheld facts remain outside all generator inputs.

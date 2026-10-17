# Evaluation Input Leakage Guard v1

Status: evaluation candidate. Product use is disabled.

This deterministic gate sits after `ProductStore.exportInspection` and before the
Evidence Atomizer. It proves that a mock Android export contains native app evidence
without target report labels or evaluator answers.

```text
ProductStore export + Android receipt
  -> Evaluation Input Leakage Guard
  -> sealed classifier input + safe runtime receipt

Android receipt + optional truth-text fingerprints
  -> evaluator-only lineage crosswalk
```

The original ProductStore export is immutable and hash-bound. The runtime projection
preserves inspection evidence exactly while pseudonymizing mock transport identifiers
such as voice-note IDs, evaluator case paths and source-derived media filenames. A
contaminated package is blocked and produces no runtime input.
`caseId`, `variant`, `goldSha256`, source-report identifiers and detailed leakage
findings remain only in the evaluator crosswalk.

Native Android taxonomy such as checklist `sectionKey` and voice-note `screenKey`
is retained because the product supplies it in real inspections. Report section
answers such as `goldSectionId`, `targetReportSectionId`, original page/chunk fields,
or instructions such as “route this to Section 4” are blocking leakage.

The evaluator-only crosswalk retains the transport-identifier mapping for audit and
media resolution. The runtime receives an opaque HMAC lineage token. The token cannot be reversed to
recover a report, page, variation or gold label. After classification output is
sealed, the evaluator uses its private crosswalk to join the token to gold.

## CLI

Set `REPORT_PLATFORM_EVALUATION_LINEAGE_SECRET` to a secret of at least 32
characters, then run:

```bash
node guard.mjs \
  --export /path/to/v3-product-export.json \
  --receipt /path/to/android-export-receipt.json \
  --output /safe/runtime-output \
  --crosswalk /evaluator-private/crosswalk.json
```

Optional `--reference-units` accepts an evaluator-private JSON array containing
`unitId` and `text`. An exact source sequence of 8–15 normalized words is recorded
for evaluator review because standards, component names and measurements can require
shared technical wording. A sequence of 16 or more words blocks the runtime package
as likely copied report prose. The frozen mock-preparation semantic guard remains
responsible for judging meaning preservation and protected technical phrases before
the Android round trip. Reference text is never written to runtime output or the
crosswalk; only unit IDs, hashes and overlap lengths are retained.

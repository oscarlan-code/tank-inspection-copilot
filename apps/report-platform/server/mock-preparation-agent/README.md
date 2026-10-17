# Mock Preparation Agent

This subsystem converts one reviewed historical report into Android-shaped mock
inspection evidence for evaluation. It is separate from report generation.

## Directories

- `sandbox/candidates/`: editable evaluation candidates. These may be run, repaired,
  and rejected. They are never selected by product routing.
- `releases/`: immutable, hash-bound R&D releases that completed their declared
  qualification gate. A release may still be product-disabled.
- `archive/`: superseded prototypes retained only for provenance.
- private run data: stored under the selected Android corpus case in
  `.local/report-mock-corpus/`; it is never committed as agent source.

## Terminology

| Term | Meaning |
| --- | --- |
| **Mock Preparation Agent v1** | The current immutable R&D release. Product use remains disabled. |
| **Contract/schema revision** | The version of a JSON interface. It is independent of the agent release. |
| **Tank V4 qualification case** | The historical Vuda Terminal report used for qualification. `V4` is the tank identifier. |
| **Android product export contract** | The app-owned interface used to materialize and export mock evidence. |

The qualified bytes are stored in `releases/v1`. The original editable candidate
remains at `sandbox/candidates/mock-preparation-v1` for audit provenance and must
not be treated as the release. Earlier experiments are retained under `archive/`.
None of these paths is selected by product routing.

## Lifecycle

```text
source report and approved atomic gold
  -> sandbox candidate
  -> dry-run request preview
  -> controlled live generation
  -> independent pre-export review
  -> Android ProductStore round trip
  -> complete-report evaluation
  -> independent PDF and emulator review
  -> frozen case
  -> release promotion
```

Edit only a sandbox candidate. Promotion copies the exact qualified candidate into
a new release directory and writes a content-hash manifest. Never edit a promoted
release; create a new sandbox candidate instead.

Prepare or test the current candidate with:

```bash
npm run mock-preparation:candidate:test
npm run mock-preparation:candidate:prepare -- --case-root <private-case-root>
```

Check promotion eligibility without writing a release:

```bash
npm run mock-preparation:candidate:promote -- \
  --candidate mock-preparation-v1 \
  --release v1 \
  --case-root <private-case-root>
```

Only after the dry run reports `eligible: true`, repeat it with `--write`.

## Cleanup

Do not delete a sandbox candidate until its promoted release, manifest, tests, and
Git commit have been verified. After that, disposable request caches and temporary
Android staging files may be removed. Keep the release manifest, evaluation
summary, independent-review decision, and source/case hashes as audit evidence.


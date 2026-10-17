# Mock Preparation Agent v1 candidate

Status: sandbox evaluation candidate. It is not a frozen release and product use
is disabled.

A mock-preparation case starts from a human-approved, hash-bound atomic source
ledger and reviewed app-note plan.
It reuses the canonical historical extraction when its source, index, and block
hashes match; it does not re-run PDF extraction for each experiment.
Before that ledger is prepared, the source semantic-integrity gate compares every
rendered PDF page with its parsed blocks and removes foreign text, wrong copied
headers, and meaning-changing parser errors. Existing historical-KB semantic chunks
may then be reused only when their lineage and evidence text still match approved
canonical blocks.
It does not require the generated Android case to be frozen before generation.
The output case is frozen only after ProductStore round trips, deterministic checks,
independent comparison with the original report, and emulator review.

The mock-preparation agent is open-book. Every report is evaluated against its own
original; development/validation splits are reserved for later closed-book report
generation experiments.

Pipeline:

`original report -> semantic source-integrity gate -> audited historical semantic chunks -> approved atomic gold -> base + controlled variations -> independent pre-export guard -> Android plan -> ProductStore export -> independent original-report review -> case freeze`

For generated variations, the pre-export guard rejects any clause that repeats an
exact sequence of eight or more normalized source words. This runs before audio
materialization or Android export so copied report prose is repaired at the
cheapest stage.

`prepare-full-case.mjs` performs a dry run by default. It writes the complete fact
ledger, deterministic batches and exact request preview. `--live` is rejected unless
`review/gold-review-manifest.json` approves the exact `goldSha256` in the gold review.

Use `--datasets base-source-grounded --live` for the offline fidelity anchor. It
does not configure or call the external model. Its result is deliberately marked
`partial_dataset_pass_not_full_case_qualified`; exact source wording may overlap and
therefore fail the narrative-leakage gate. It tests gold-to-plan-to-Android lineage,
not final field-note realism. A full qualification must include all three datasets.

The run produces three isolated Android plans. These are candidate inputs only;
they do not count as app evidence until the approved Android product evaluation
importer saves and exports them through `ProductStore.exportInspection` and returns
matching receipts.

Do not copy this directory into `releases/` manually. After the complete-report,
independent PDF, emulator, Android receipt, and case-freeze gates pass, use the
promotion command documented in the parent `README.md`. Promotion records exact
candidate and qualification hashes.

# Mock Preparation Agent v2

Status: evaluation candidate. Product use is disabled.

This release tests a source-grounded base and controlled inspector-note variations
without using report generation. The flow ends at authentic Android V3 exports
and mock-fidelity evaluation:

`original report facts -> atomic ledger -> base + variations -> guard review -> Android exports`

The pilot uses 20 atomic narrative facts from one open-book historical case:
all 9 scope facts, all 7 recommendations, and 4 difficult observations. The facts
are grouped into seven simulated voice notes. The deterministic base may retain
source wording. GPT-5.6 Sol creates natural-speech and concise-shorthand variants
from the same facts and grouping. A note may mix evidence types, while every
clause remains linked to one or more source fact IDs.

`prepare-pilot.mjs` writes private artifacts below the selected case's `review/`
directory. A dry run creates the fact ledger, composition plan and exact request
preview. `--live` calls the pinned GPT-5.6 Sol worker, runs an independent
pre-export semantic guard for every dataset, and allows one bounded repair by
default.

The harness fails closed when a source fact is unassigned, repeated, missing,
altered, contradicted, or when a generated clause adds unsupported meaning. A
passing run produces three plans under `android-plans/`; each must still be
materialized and exported through the existing Android ProductStore round trip.
Wording overlap is recorded as a variation metric. It does not fail fidelity.
`audit-pilot-android.mjs` then verifies accepted-text, draft, ProductStore export,
attachment and receipt-hash continuity for all three isolated cases.

This pilot does not route evidence to report sections, retrieve a report KB, or
generate report prose.

## Freezing and running the full test

The 20-unit run is a workflow pilot. It is not the full qualification result.

1. Run `full-test-preflight.mjs` against the checked-in cohort and private corpus.
2. Resolve every missing gold matrix or reviewed app-plan blocker.
3. Write and verify `candidate-freeze.json` with `freeze-candidate.mjs --write` and
   `freeze-candidate.mjs --verify`.
4. Run the full-case regression, then the held-out validation split, without
   changing a locked file.
5. Review every failure and the stratified passing sample. A human decision creates
   a later validated release freeze.

`full-test-contract.json` pins the cohort split, batching, datasets, gates and
aggregation. Candidate freeze means the workflow is immutable for evaluation; it
does not enable product use or claim validation success.

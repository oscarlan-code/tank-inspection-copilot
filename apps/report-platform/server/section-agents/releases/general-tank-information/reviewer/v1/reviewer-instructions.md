# Reviewer instructions

You review only the unapproved output of `general_tank_information_v2` for
`vertical_tank_inspection_v1`.

1. Compare every displayed field to the pinned current evidence snapshot.
2. Require the exact section title, 31 reviewed fields, field order and paired-field format.
3. Preserve values and units exactly. Missing values remain visibly missing.
4. Confirm that every displayed field carries a reviewed evidence identifier.
5. Block generator validation failures, unsupported fields, duplicate/missing fields,
   changed protected values, wrong titles, wrong format, runtime retrieval and model use.
6. Historical patterns may validate presentation only. They cannot validate or replace current facts.
7. Do not receive or request the original report section or hidden evaluation gold.
8. Return `ready_for_review` only when there are no blockers. Never approve the draft.

These rules are implemented by deterministic reviewer code and are not an LLM prompt
for this release.

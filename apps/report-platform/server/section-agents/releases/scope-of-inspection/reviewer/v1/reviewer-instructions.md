# Reviewer instructions

You review only the unapproved output of `scope_of_inspection_v1` for
`vertical_tank_inspection_v1`.

1. Compare the output to the confirmed current scope record, never to historical gold.
2. Require one ordered evidence-labelled bullet per confirmed activity/deliverable.
3. Verify action, target, method, extent, conditions and controlled references.
4. Require all confirmed limitations and exclusions in their confirmed order.
5. Block extra/missing bullets, changed concepts, wrong title/format, invalid generator
   output, historical/current-fact crossover, task-to-scope widening and approval changes.
6. Historical patterns validate structure and cadence only. Standards cannot create scope.
7. Return `ready_for_review` only with zero blockers. Never approve the draft.

These rules are implemented by deterministic reviewer code and are not an LLM prompt
for this release.

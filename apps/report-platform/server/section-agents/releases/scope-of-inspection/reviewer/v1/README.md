# Reviewer v1

Status: `evaluation_candidate`; product disabled.

This independent reviewer runs after `scope_of_inspection_v1` generation and before
the draft may be shown to a user. It compares the output to the confirmed current
scope record, checks protected action/target/method/extent/condition/reference
concepts, verifies limitations and exclusions, and enforces the reviewed title and
arrow-bullet format. It imports no generator implementation and receives no gold.

The current generator is deterministic, so an LLM is not required for this gate.
Passing means the draft is safe to present for inspector review, not approved.

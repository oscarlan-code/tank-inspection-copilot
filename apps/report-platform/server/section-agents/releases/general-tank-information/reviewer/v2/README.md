# Reviewer v2

Status: `evaluation_candidate`; product disabled.

This independent reviewer runs after `general_tank_information_v3` generation and
before a draft may be presented to a user. It checks the 31-field structure,
protected values and app-supplied units, explicit aliases, routed evidence
provenance, complete evidence dispositions, section title, paired-field format and
current-evidence/KB boundaries. It imports no generator implementation and does not
receive historical gold.

The current section is deterministic, so an LLM is not required to decide the gate.
Future narrative section reviewers may declare a bounded semantic LLM check in their
own immutable release. Passing this reviewer means `ready_for_review`; it never
means inspector-approved.

# Test Information generator prompt

Role: compile Section 6 test traceability and use bounded wording only for confirmed
extent or limitation notes.

Model policy: deterministic records first. A version-pinned LLM may rewrite only
the supplied method extent and limitation text; it cannot create or change test
identity, equipment, calibration, personnel, result or status fields.

1. Emit the exact heading `6 TEST INFORMATION`.
2. Accept only the reviewed `test-information` evidence package and matching
   SectionPlan.
3. Create the performed/excluded method inventory deterministically.
4. Render procedure, equipment, calibration, personnel and qualification fields
   from exact current records.
5. Preserve values, units, identifiers and availability states exactly.
6. Use the bounded wording prompt only when reviewed narrative evidence exists for
   extent or limitations. Keep every sentence traceable to that evidence.
7. Link detailed measurements, scans and NDT results rather than rewriting them.
8. Do not infer that a method was performed from a template or historical report.
9. Return an unapproved draft and all field/claim evidence references.

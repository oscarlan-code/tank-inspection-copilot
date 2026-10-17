# Scope of Inspection generator instructions

Role: compile Section 1 from reviewed, current-task scope evidence.

Model policy: **no LLM call**. Scope is a commissioned-work contract and must not be
inferred from completed inspection records or historical reports.

1. Accept only a `section_evidence_package_v1` for `scope-of-inspection` and its
   matching frozen `package_bound_section_plan_v1`.
2. Reject unreviewed routing, unresolved provenance, duplicate claim order or a
   package/plan identity mismatch.
3. Emit the exact heading `1 SCOPE OF INSPECTION`.
4. Compile confirmed activities in reviewed order. Preserve component, method,
   coverage, quantity, conditional wording and units exactly.
5. Emit confirmed deliverables, limitations, exclusions and procedure references
   only when present.
6. Keep prospective scope language. Do not turn performed work, findings or
   recommendations into scope.
7. Return an unapproved draft with source references for every statement.

Historical Section 1 material may define structure and accepted cadence during
offline qualification. It cannot provide any current scope statement at runtime.

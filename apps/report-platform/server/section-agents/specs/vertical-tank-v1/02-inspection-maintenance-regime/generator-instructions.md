# Inspection and Maintenance Regime generator instructions

Role: render Section 2 from an approved controlled template.

Model policy: **no LLM call**. This section is standard content and must use the
approved template revision byte-for-byte except for declared substitution fields.

1. Accept only the matching `section_evidence_package_v1`, frozen SectionPlan,
   approved template ID, revision and hash.
2. Reject a missing template, hash mismatch or undeclared substitution.
3. Emit the exact heading `2 INSPECTION AND MAINTENANCE REGIME`.
4. Render the controlled body in template order.
5. Insert same-asset history, schedule or responsibility fields only when the
   template declares the field and reviewed current evidence supplies it.
6. Never infer an interval, due date, responsibility or regulatory conclusion.
7. Return an unapproved draft with the template revision and substitution trace.

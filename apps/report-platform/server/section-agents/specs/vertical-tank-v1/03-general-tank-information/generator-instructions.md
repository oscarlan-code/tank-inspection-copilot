# General Tank Information generator instructions

Role: compile Section 3 from protected structured fields in the reviewed section
evidence package.

Model policy: **no LLM call**. The executable reference is package-bound Candidate
A in the section-agent sandbox.

1. Accept only `section_evidence_package_v1` for `general-tank-information` and its
   matching frozen SectionPlan.
2. Reject unresolved identity, value or unit conflicts.
3. Emit the exact heading `3 GENERAL TANK INFORMATION`.
4. Render the 31 configured body fields in fixed paired-label order.
5. Preserve job number, date completed and inspector as report-header metadata.
6. Keep roof-presence and insulation-distance values as support data unless the
   format contract explicitly promotes them in a future version.
7. Show `Not recorded` for an expected missing field. Never infer a value.
8. Preserve source units exactly; do not convert or normalize values silently.
9. Return an unapproved draft with every field linked to its evidence atom.

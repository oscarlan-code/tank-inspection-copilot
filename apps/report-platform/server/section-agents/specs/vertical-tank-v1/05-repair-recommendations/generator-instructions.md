# Repair Recommendations / API 653 Assessment generator prompt

Role: compose Section 5 from verified observations and inspector-approved actions.

Model policy: **LLM allowed only in a version-pinned sandbox candidate**. The model
may improve wording and explain applicability. It cannot approve an action, select
urgency or make an engineering fitness decision.

1. Emit the exact heading `5 REPAIR RECOMMENDATIONS / API 653 ASSESSMENT`.
2. Accept only the reviewed `repair-recommendations` evidence package, matching
   SectionPlan, approved action records and pinned section KB/standard packs.
3. Link every proposed sentence to the current observation it addresses.
4. State the affected component/location, action, confirmed priority/timing and
   verification requirement when supplied.
5. If historical precedent is supplied, state why it appears applicable and record
   important differences or missing information. Precedent is not technical proof.
6. Keep unknown rationale, implementation and outcome explicitly unknown.
7. Ask for inspector confirmation when applicability, priority or engineering basis
   is unresolved.
8. Never invent an action, code clause, interval, urgency or no-action conclusion.
9. Return an unapproved draft with finding, evidence and precedent references.

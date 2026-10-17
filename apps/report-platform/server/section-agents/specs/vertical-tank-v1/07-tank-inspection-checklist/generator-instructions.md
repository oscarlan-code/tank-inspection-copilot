# Tank Inspection Checklist generator instructions

Role: render Section 7 from the native reviewed checklist grid.

Model policy: **no LLM call**. Checklist responses are app-owned records and must
remain deterministic.

1. Accept only the reviewed `tank-inspection-checklist` evidence package, matching
   SectionPlan and exact checklist definition version.
2. Reject an unknown definition, missing applicable response, row identity/order
   conflict, response-note conflict or missing not-applicable reason.
3. Emit the exact heading `7 TANK INSPECTION CHECKLIST` and the definition-owned
   response legend.
4. Render categories and items in native order with item number, prompt, response
   and note.
5. Preserve section notes under their native category.
6. Never treat an unanswered item as satisfactory and never reuse a historical
   response.
7. Return an unapproved draft with row-level evidence references.

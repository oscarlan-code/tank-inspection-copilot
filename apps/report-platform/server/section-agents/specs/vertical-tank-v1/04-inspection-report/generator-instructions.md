# Inspection Report generator prompt

Role: write Section 4 findings from verified current-inspection observations.

Model policy: **LLM allowed only in a version-pinned sandbox candidate**. The model
may compose evidence-bound wording; deterministic code owns block selection,
ordering, values, units and cross-references.

## Inputs

- one reviewed `section_evidence_package_v1` for `inspection-report`;
- its matching frozen SectionPlan;
- the section generator projection of a frozen, multi-report SectionKnowledgeBundle;
- a separately pinned applicable-standard obligation pack.

## Instructions

1. Emit the exact heading `4 INSPECTION REPORT`.
2. Write only the component blocks selected by the SectionPlan, in plan order.
3. For every sentence, use only facts and qualifiers linked to the current evidence
   package. Preserve component, location, side, polarity, uncertainty, severity,
   measurements and units.
4. Group observations by component. Describe condition, location and examination
   extent clearly. Use concise professional inspection-report language.
5. Treat historical material as structure, terminology and wording-pattern support.
   Never use a historical condition or value as a current fact.
6. Do not convert an absence of evidence into a satisfactory condition.
7. When a material ambiguity affects meaning, return a clarification requirement
   instead of completing the sentence.
8. Do not write repair recommendations, unsupported fitness-for-service conclusions
   or detailed measurement tables in this section.
9. Return claim-level evidence references and an unapproved draft.

The evaluator-only original section and gold labels are never prompt inputs.

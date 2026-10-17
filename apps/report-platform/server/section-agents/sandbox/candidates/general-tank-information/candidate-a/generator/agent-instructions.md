# Generator instructions

1. Accept only the exact reviewed `section_evidence_package_v1` bound into the
   frozen evaluation SectionPlan.
2. Render the exact SectionPlan title and the reviewed 31-field paired layout.
3. Preserve source values and explicit units character-for-character after safe
   whitespace normalization. Never infer or convert a unit.
4. Keep missing optional fields visible as `Not recorded`. Block missing required
   identity/dimension fields, conflicts, missing units and unsupported evidence.
5. Preserve job number, date and inspector as report-header metadata. Preserve
   roof flags and insulation distance for planning/support; do not print them as
   descriptive tank facts.
6. Give every package record one traceable disposition.
7. Never access a source report, gold packet, model, prompt, network or runtime KB.
8. Return an unapproved draft that remains hidden until the independent reviewer
   returns `ready_for_review`.


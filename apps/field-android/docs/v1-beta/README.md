# V1 Beta

`V1 beta` is the current working Android field app baseline inside `apps/field-android`.

Use `V1 beta` for:
- critical fixes
- regression-safe maintenance
- demo and QA reference behavior
- storage, export, and workflow stabilization

Current `V1 beta` code lives mainly under:
- `app/src/main/java/ai/laiq/tankinspection/presentation/screens/`
- `app/src/main/java/ai/laiq/tankinspection/presentation/components/`
- `app/src/main/java/ai/laiq/tankinspection/presentation/FieldDraftState.kt`

Rules for `V1 beta`:
- do not perform broad UX redesign directly in the stable screens
- prefer small, safe fixes
- keep compile/test/install verification intact
- treat `V1 beta` as the comparison point for future `V2` replacements

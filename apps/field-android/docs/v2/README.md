# V2

`V2` is the Android UX redesign lane inside the same project folder: `apps/field-android`.

`V2` is not a second top-level app folder. It is differentiated by:
- branch and release naming
- docs under `docs/v2/`
- new code under `presentation/v2/`

Current `V2` code areas:
- `app/src/main/java/ai/laiq/tankinspection/presentation/v2/`
- `app/src/main/java/ai/laiq/tankinspection/v2/`

Current status:
- no approved production `V2` screens yet
- any exploratory screen work must remain in clearly marked `scratch/` packages until approved

Approved workflow for `V2`:
1. build one screen only
2. UI/UX first
3. show the screen to the user
4. refine from user feedback
5. wire backend only after approval
6. test and refine
7. move to the next screen only after the current one is accepted

Initial V2 target order:
1. General Tank Information
2. Shell Layout
3. Roof Layout
4. Floor Layout
5. Element Registration
6. UT screens
7. Standalone Findings

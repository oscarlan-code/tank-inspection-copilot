# Canonical Export Plan

This app lane must stay in sync with:

- `/Users/oscar/Documents/oscar-code/tank-inspection-coplilot-report/apps/report-platform/requirements/CANONICAL_INPUT_REQUIREMENTS.md`

## Must export now

The app lane should export the current `0.1.0` package with these sections populated:

- envelope
- inspection
- tank master
- shell line plan
- roof layout
- nozzle registries
- measurements
- findings
- attachments
- MFL metadata
- review status

Current app-lane implementation now writes:

- shell line plan from tank diameter + override
- shell UT rows
- roof layout draft and roof UT rows
- shell nozzle registry + shell nozzle UT rows
- roof nozzle registry + roof nozzle UT rows
- findings with camera-backed photo attachment records
- MFL metadata with picked `mfl_report` PDF attachment records
- review warnings used as export readiness gates
- canonical package folder:
  - `inspection-package.json`
  - `manifest.json`
  - copied attachment paths
  - zipped handoff bundle
- persistent local export ledger with:
  - package id
  - export timestamp
  - zip file path
  - attachment completeness counts
  - handoff status on device:
    - `exported`
    - `shared`
    - `uploaded`
  - configurable report-platform upload endpoint for prototype POST handoff

## MFL rule

For MFL:

- do not capture raw scan data in the app
- do attach the third-party MFL PDF
- do populate `mflImport` metadata

## Next schema priorities

After the first prototype path works, add structured fields for:

1. report header / document control
2. general tank information
3. recommendations
4. checklist items
5. thickness calculation inputs
6. settlement survey
7. richer attachment metadata

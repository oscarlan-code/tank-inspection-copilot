# General Tank Information: section agent and 10+1 report review

The `general_tank_information_v1` candidate is implemented and tested through the
shared generation entry point. Ten development-report mocks preserved **310/310
labelled fields**, and the eleventh report preserved **31/31** after the generator,
preparer and evaluator were frozen. No AI calls, external requests, KB retrieval,
model changes, production-policy changes or persisted inspector approvals occurred.

Open the saved [development comparison](http://oscars-mac-mini.tailbd3a33.ts.net:4175/admin/evaluation?evaluationCaseId=eval-general-info-v1-gti-01&sectionId=general-tank-information)
or [held-out comparison](http://oscars-mac-mini.tailbd3a33.ts.net:4175/admin/evaluation?evaluationCaseId=eval-general-info-v1-gti-11&sectionId=general-tank-information).
The report selector navigates all eleven sources. The existing three columns show
the original section, generated content and inputs, including clearly labelled
supplementary fields. The original PDF button opens the checksum-verified source.

## Report cohort and result

| Case | Split | Report / tank | Fields preserved |
| --- | --- | --- | --- |
| gti-01 | Development | 19SE2-1 / Shell 5452 | 31/31 |
| gti-02 | Development | 19SE1-1 / Shell V1302A | 31/31 |
| gti-03 | Development | 17SE2-1 / Shell 156 | 31/31 |
| gti-04 | Development | 20SE1-1 / Shell 28 | 31/31 |
| gti-05 | Development | 23PE1-1 / Pacific Energy FU 1 | 31/31 |
| gti-06 | Development | 19PE1-5 / Pacific Energy BE 1 | 31/31 |
| gti-07 | Development | 19PE1-1 / Pacific Energy VU1 | 31/31 |
| gti-08 | Development | 15PP3-1 / Pacific Petroleum VI 2 | 31/31 |
| gti-09 | Development | 16TJS3-1 / TJS 10 | 31/31 |
| gti-10 | Development | 15PIE1-1 / Pacific Islands Energy RA 1 | 31/31 |
| gti-11 | Held out | 19PE2-2 / Pacific Energy BE 2 | 31/31 |

The sources have eleven distinct PDF hashes and tank identities. They share a
common report format; this does not validate every report family or prove broad
generalization. Registry lineage metadata is retained for audit, but source-page
identity fields determine mock client/tank/location, not potentially stale registry
aliases. The held-out asset is different from all development assets.

## What the agent does

- Preserves the title `3 GENERAL TANK INFORMATION`, paired field order and a
  separate Previous Inspection History block.
- Uses seven native fields: client, tank number, location, field/lease name,
  height in metres, diameter in metres and shell course count.
- Accepts 24 separately labelled structured supplementary fields: client
  representative, year built, manufacturer, construction standard, service
  height, material specification, shell construction, product, drawing reference,
  specific gravity, roof type, design temperature, internal pressure, floor/roof
  plate counts, floor thickness, wind girder, annular plate count, insulation,
  annular thickness, stiffener and three inspection-history fields.
- Keeps qualifiers such as `Estimated`, `for Assessment`, `UT Measured`, specific
  course references, pressure signs and unavailable/not-applicable values.
- Does not infer roof geometry from the app's yes/no roof-presence field, invent
  asset facts, add record-count summaries or append evidence to the report.
- Marks absent optional information, blocks unresolved critical fields/conflicts,
  rejects wrong-asset history and leaves unconfirmed general-information voice
  pending field interpretation. The module does not yet extract values from
  arbitrary inspector notes.
- Returns an unapproved draft through the common `ReportDocument` formatter.
  The explicit section-agent registry prevents accidental production execution.

## Mock and hold-out protocol

The [cohort](data/general-tank-information-v1/cohort.json) was selected by source
metadata before development. All ten development sources are KB training entries;
report eleven is already a hidden-test entry. Only development pages were opened
for field/layout review before the freeze.

Source fields were extracted into evaluator-only ledgers and reviewed against
the original page text and rendered PDF pages. The mocks retain structured values;
there are no manufactured voice notes, report narrative sentences presented as
inspector notes, fake photographs or claimed device recordings. Seven values use
native app field names; the other 24 are explicitly supplied as report-side input
fixtures with source references. Fixture confirmation is **not inspector approval**.
The section-sized JSON fixtures do not claim complete native app export readiness.

Each development generation receives only its input JSON, with the expected
ledger opened afterwards for scoring. The [development freeze](data/general-tank-information-v1/development-freeze.json)
pins the agent, registry, shared generation/planning/format/export modules,
preparer and evaluator, plus the development result and cohort hashes. Report
eleven's section was then extracted, prepared and run once without changing those
files. The frozen audit verifies this boundary and both result manifests.

This is a held-out **module-development** test, not a claim that the report has
never appeared in the historical KB inventory. No historical KB content is
retrieved by this deterministic module. These results establish structured
assembly fidelity; they do not measure narrative interpretation, ASR, recommendation
quality or independently judged report completeness.

## Validation and remaining review

- All 341 labelled output fields match their expected value/unit and corresponding
  rendered paragraph. Numeric display normalization, such as `11.0 m` to `11 m`,
  retains the exact value; qualifiers and other supplied strings remain intact.
- Sixteen behavior checks cover missing identity, task/record conflict, dimension
  conflicts/zero values/units, pending supplements, wrong-asset history, missing
  optional history, unresolved voice, HTML escaping, unsupported fields, hidden
  reference isolation, production/section isolation and unapproved export rejection.
- Eleven saved reviews validate hashes, source identity, previous/next navigation,
  seven native versus 24 supplementary evidence records and no promotion.
- The standard build, architecture, generation, storage, object upload,
  floor-corrosion durability, strict leakage and API authorization audits pass.
- The existing 32-section regression audit completes with five passing, 27
  needing review and zero failing sections. Its legacy scores are not the new
  section-agent results and do not establish full-report readiness.
- DOCX fixtures use the existing exporter with isolated in-memory approval for
  rendering tests only; report jobs and review approvals are never changed. Their
  field/table contents are checked structurally. LibreOffice is unavailable, so
  visual DOCX pagination/layout parity remains unverified.
- Browser checks through the Tailscale address confirm eleven report choices,
  previous/next navigation, three comparison columns, seven native and 24
  supplementary evidence cards, and no horizontal overflow at the checked
  desktop viewport. Development and held-out screenshots were inspected.
- Inspector source/format review and the user-facing supplementary-field workflow
  are still needed before enabling this candidate in normal generation. The next
  decision is specific to this section, not a global model/policy promotion.

Run from `apps/report-platform`:

```sh
npm run section-agent:general-info:audit
```

Frozen results must not be overwritten or repeatedly retested as an unseen holdout.
Future generator changes require a new version and a new held-out report.

## Consolidated release

The candidate is now packaged as an immutable release; see [Versioned section agents](../../SECTION_AGENT_RELEASES.md). Its original implementation and dependency bytes are preserved. The original development freeze and result files were not rewritten. The nine-file historical qualification context is retained locally under `data/general-tank-information-v1/qualification-snapshot/`; the review audit verifies that archive, while the release audit verifies current routing and the complete frozen runtime dependency graph. All eleven saved inputs replayed to identical drafts, evidence and validation results. This is packaging parity, not another unseen holdout. Client qualification data stays local because the Git remote is public.

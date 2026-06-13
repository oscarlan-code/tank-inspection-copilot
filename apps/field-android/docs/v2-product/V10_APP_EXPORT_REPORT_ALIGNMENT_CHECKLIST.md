# V10 App Export vs Report Data Alignment Checklist

Date: 2026-06-11

Reference report:

`/Users/oscar/Public/irs/Sample Reports/22PE1-4 TK V10 Internal & External Inspection Report.pdf`

Android V2 Product source of truth reviewed:

`apps/field-android/app/src/main/java/ai/laiq/tankinspection/v2product/preview/V2ProductMockTaskSeed.kt`

Report-platform fixture reviewed:

`apps/report-platform/src/fixtures/v2-product-export-shell-internal.json`

Report generation mock import decision:

- Use `apps/report-platform/src/fixtures/v2-product-export-shell-internal.json` as the app-import mock source for the report platform.
- Treat this fixture as Android V2 Product exported/captured data, not report-side hand-written mock content.
- Compare generated report sections against `/Users/oscar/Public/irs/Sample Reports/22PE1-4 TK V10 Internal & External Inspection Report.pdf`.
- The report platform should load it through `GET /api/v1/report-jobs/bootstrap/v10-api-standard` or accept it through `POST /api/v1/imports/android-v2-product`.

## Summary

| Area | App V2 Product seed/export | Report data | Status | Notes |
| --- | ---: | ---: | --- | --- |
| Roof plate count | 59 | 59 | Match | App roof layout and UT seed now cover all report roof plates. |
| Roof plate UT readings | 59 rows / 295 readings | 59 rows / 295 readings | Identical | Parsed from PDF and compared row-by-row. Zero mismatches. |
| Roof nozzle UT readings | 9 rows / 36 readings | 9 rows / 36 readings | Identical | N/E/S/W readings match. Reinforcement pad values need a future model field. |
| Shell strake count | 8 | 8 | Match | Matches report general info and shell thickness section. |
| Shell plates per strake | 9 | 9 | Match | Report calculation page says plates per strake is 9. |
| Shell UT lanes | 4 | 4 | Match | App maps `L1=N`, `L2=E`, `L3=S`, `L4=W`. |
| Shell plate UT readings | 32 rows / 160 readings | 32 rows / 160 readings | Identical | Parsed from PDF and compared row-by-row. Zero mismatches. |
| Floor plate count | 35 | 35 | Count match | App count matches general report info. |
| Floor UT readings | 35 rows / 175 readings | Range summaries + MFL plate maps | Partial | Report does not provide a simple 35-row floor UT table. App values are range-aligned mock samples, not identical report rows. |
| Checklist numbering | 1-195 | 1-195 | Match | Floating-roof sections are included and marked N/A for fixed dome V10. |
| Report-platform fixture | 136 UT rows / 195 checklist rows | Full V10 app export | Aligned | Fixture now uses the report-aligned Android V2 Product data. |

## Detailed Checklist

- [x] Roof plate numbers 1-59 are present in the Android V10 seed.
- [x] Roof plate UT values are identical to the report table.
- [x] Roof nozzles R1-R9 are present in the Android V10 seed.
- [x] Roof nozzle N/E/S/W UT values are identical to the report table.
- [ ] Roof nozzle reinforcement pad values are not structurally captured yet.
- [x] Shell setup uses 8 strakes/courses.
- [x] Shell setup uses 9 plates per strake, not 14.
- [x] Shell UT uses 4 directional lanes, not 14.
- [x] Shell UT lane mapping is `L1=N`, `L2=E`, `L3=S`, `L4=W`.
- [x] Shell UT values are identical to the report table for all 8 strakes and 4 directions.
- [x] Floor setup uses 35 floor plates.
- [ ] Floor exact per-plate UT is not identical because the report source is MFL plate maps and summary ranges, not a direct 35-row UT table.
- [x] Checklist catalog includes the full report numbering, including 97-143 and 153-165.
- [x] Floating roof checklist items are marked N/A for fixed dome V10.
- [x] Report-platform fixture is regenerated from the latest app seed/export.

## Verified UT Equality

Automated comparison against PDF-extracted text returned:

```text
roof report rows/app rows: 59 59
roof missing/extra/mismatch: 0 0 0
shell report rows/app rows: 32 32
shell missing/extra/mismatch: 0 0 0
shell lane mapping: L1=N, L2=E, L3=S, L4=W
roof nozzle report/app rows: 9 9
roof nozzle missing/extra/mismatch: 0 0 0
```

## Known Gaps Before Report Generation

- The Android model has no dedicated field for roof nozzle reinforcement pad thickness. Report values are `R1=6.73`, `R2=NA`, `R3=6.53`, `R4=6.24`, `R5=4.08`, `R6=6.07`, `R7=NA`, `R8=5.81`, `R9=6.75`.
- Floor data needs a product decision: either keep app capture as UT sample/range evidence, or add a dedicated MFL plate-map structure with report labels such as `1.1`, `1.2`, and annular labels such as `A1`.
- The report-platform fixture is now regenerated with 136 UT rows, 195 checklist items, 23 elements, and 9 findings.

## Next Alignment Step

Add dedicated export/model fields for report-only data that is not currently represented in Android structured capture, especially roof nozzle reinforcement pad thickness and floor MFL plate-map evidence.

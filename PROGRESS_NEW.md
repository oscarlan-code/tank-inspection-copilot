# Tank Inspection Copilot — Work Progress

## Project path
`/Users/oscar/Documents/oscar-code/tank-inspection-coplilot`
Run: `npm run dev` → http://localhost:5173
Tailscale: http://100.101.225.110:5173

---

## Version history

| Version | Date | Description |
|---------|------|-------------|
| v1.0 | 2026-04-21 | Initial prototype — defect-centric data model, all surface maps, full UI flow |

---

## V1 — Current status (April 21 2026)

V1 is a working field prototype covering the full defect entry flow. It is built on a **defect-centric data model** which, after analysis against real IRS inspection reports and the April 21 client meeting, needs significant rethinking for V2. See analysis below.

### Screens implemented in V1 (29 total)

All screens compile and build cleanly.

| Screen | Status | Notes |
|--------|--------|-------|
| Home | Done | |
| Inspection Setup | Done | |
| Tank Profile | Done | Lean: design code, dims, roof, foundation only |
| Orientation | Done | True North / Physical Marker toggle + compass |
| Tank Overview | Done | Routes to surface-specific setup |
| Shell Setup | Done | Courses, plate width, seam origin, offset rule |
| Roof Setup | Done | Sector × ring polar grid, SVG preview |
| Annular Setup | Done | Width input, top-view SVG with azimuth ticks |
| Nozzle Setup | Done | Add/edit/remove nozzle registry |
| Nozzle List | Done | Tap to select nozzle for inspection |
| Location Mode | Done | |
| Map (shell) | Done | ShellSurfaceMap — unwrapped SVG with zoom |
| Map (roof) | Done | RoofPolarMap — polar sector × ring grid |
| Map (annular) | Done | AnnularTopView — circular band, 36 zones |
| Map (nozzle) | Done | NozzleClockMap — 12 clock positions × 3 rings |
| Manual Entry | Done | |
| Plate Picker | Done | |
| Location Confirm | Done | |
| Defect Type | Done | |
| Defect Detail | Done | Weld seam flag added |
| Measurements | Done | |
| Evidence | Done | |
| Defect Saved | Done | |
| Surface Map | Done | |
| Surface Review | Done | |
| Inspection Validation | Done | |
| MFL Import | Done | |
| Export & Summary | Done | |
| Success | Done | |

---

## V1 Architecture

### Data model (`src/types.ts`)

```typescript
TankProfile  = { designCode, diameterM, heightM, capacityM3, roofType, foundationType }
ShellConfig  = { numCourses, plateWidthMm, plateLengthMm*, seamOriginC1Deg, seamOffsetRule }
RoofConfig   = { sectorCount, ringCount, apexHeightM? }
AnnularConfig = { widthMm }
NozzleConfig = { nozzles: NozzleDefinition[] }
InspectionSession = { ..., tankProfile, shellConfig?, roofConfig?, annularConfig?, nozzleConfig?, surfaces[] }
DefectRecord = { id, location: GridLocation, defectType, severity, measurements, evidence, weldLocation? }
```

### Architecture notes
- `src/App.tsx` (~3000 lines) + `src/types.ts`
- All state in `InspectionSession`, persisted to localStorage
- No routing library — `Screen` union type + conditional rendering
- Tailwind CSS with custom tokens (teal, mint, field, panel, ink, danger, caution, repair)
- `SurfaceMapRenderer` helper picks correct SVG map by surface type

### Surface flow
```
TankOverview
  → shell    → ShellSetup  → LocationMode → ShellSurfaceMap  → defect flow
  → roof     → RoofSetup   → LocationMode → RoofPolarMap     → defect flow
  → annular  → AnnularSetup → AnnularTopView                 → defect flow
  → nozzle   → NozzleSetup → NozzleList → NozzleClockMap     → defect flow
  → bottom   → MflImport   → defect flow
```

### Key design decisions (V1)
- Shell seam offset is repeating, not cumulative (API 650 ½ plate = 2-course cycle)
- Weld location is a flag on a defect record, not a separate surface
- Annular ring shown as top-down circular band
- Nozzle inspection zone = 150 mm radius from CL (API 653)
- `plateLengthMm` = derived = `floor(totalHeightMm / numCourses)`

---

## V2 — Analysis & Required Work

### Root problem: wrong data model

V1 treats all data as **defect records** (exception-based). Real inspection reports contain three fundamentally different data types:

| Track | Type | Description |
|-------|------|-------------|
| A | Routine measurements | Tabular, every location measured: shell UT table, roof UT table, nozzle UT |
| B | Inspection checklist | ~195 items rated 1–4/IA/NE/NA — drives narrative and repair recommendations |
| C | Visual findings | Exception-based, only when something notable found — current V1 "defects" |

V1 only implements Track C partially. Tracks A and B are both missing and are critical for report generation.

---

### What the actual report generates (section by section)

From IRS sample reports (TK BE 51, TK 13, TK SU4, and others):

1. **Cover + signatories** — client, site, tank number, inspector, date, scope
2. **General Tank Information** — ~20 fields
3. **Inspection Report** — narrative prose per zone (diked area, foundation, shell, roof, floor)
4. **Repair Recommendations** — Off-line / On-line / Others structured bullets
5. **Test Information** — instrument specs (UT flaw detector, MFL unit)
6. **Tank Inspection Checklist** — ~195 items, 7 ratings (1/2/3/4/IA/NE/N/A)
7. **Roof Plate Thickness Table** — plate number × readings A–E (5 per plate) → min/max
8. **Roof Plate Layout** — top-down plan with plate numbers and nozzle positions
9. **Roof Nozzle Thickness** — nozzle × N/E/S/W + reinforcement pad (in inches)
10. **Min Shell Thickness Calculations** — API 653 formula per course
11. **Shell Plate Thickness Table** — strake × N/S/E/W × 5 readings → min/mean/max + t_min + life expectancy
12. **Shell Plate Layout** — unwrapped drawing with compass marks and nozzle positions
13. **Shell Nozzle Thickness** — nozzle × 12/3/6/9 o'clock + reinforcement pad (in inches)
14. **Shell Settlement Survey** — 8 elevation readings at compass bearings, API 653 B.2.2.2 calc
15. **Photographs** — numbered, linked to narrative
16. **Floor layouts** — plate numbering, findings annotation, corrosion plan
17. **MFL Platemaps** — from contractor (import only)

---

### V2 data model gaps

#### 1. Client / Site / Tank fields — MISSING

Current `TankProfile` only has 6 fields. Report needs ~20 more:

```
terminal name, location, client representative, contact person,
year built, original manufacturer, original construction standard,
material spec (A36 etc.), construction type (butt-welded/lap-welded),
drawing reference, product stored, specific gravity,
design temperature, internal pressure, service height,
total floor plates, floor plate thickness (nominal),
total annular plates, annular plate thickness,
wind girder (Y/N), insulated (Y/N), stiffener (Y/N),
previous inspection history (external/internal/bottom dates)
```

#### 2. Shell UT measurement table — WRONG MODEL

Current: defect record per location.
Needed: structured table per strake:

```
Strake N
  compass bearing (N / E / S / W)
    reading 1 (bottom) … reading 5 (top)
    → auto: min / mean / max
  original "t" (from drawing)
  previous actual thickness (from last inspection)
  t_min hydrostatic  (API 653 §4.3.3 formula)
  t_min product      (API 653 §4.3.3 formula)
  → auto: corrosion rate, remaining life, inspection interval
```

Shell field location = **strake + azimuth bearing** (not plate number). Confirmed by meeting and all sample reports. The crawler travels up at a compass bearing; plate identification is not done in the field.

#### 3. Roof UT measurement table — MISSING

Roof plates are numbered sequentially (1–50 typical). Per plate:
```
Plate No. → readings A / B / C / D / E  (5 spots per plate)
         → auto: min / max
```

The current RoofPolarMap (sector × ring grid) does not match field practice. Roof plate numbering is arbitrary (set by the CAD drawing), not sector-based.

#### 4. Nozzle thickness table — WRONG MODEL

Current: clock-face map for locating defects.
Needed: simple 4-reading UT table (this IS how nozzles are reported):

```
Nozzle ID | Dia. | 12 o'clock | 3 o'clock | 6 o'clock | 9 o'clock | Reinf pad
S1        | 4"   | 6.13       | 5.98      | 3.55(!)   | 6.08      | 6.30
```

- Readings in **inches** (confirmed in meeting)
- Shell nozzles (S1, S2…) and roof nozzles (R1, R2…) are **separate lists**
- Reinforcement pad: required for nozzles > 2" (shell) or ≥ 6" (roof) per API 650

#### 5. Inspection checklist — COMPLETELY MISSING

~195 items across zones, each rated 1 / 2 / 3 / 4 / IA / NE / N/A:

| Zone | Items |
|------|-------|
| Diked Area | 8 |
| Tank Foundation | 12 |
| Shell External | 20 |
| Shell Appurtenances | 23 |
| Access Structure | 14 |
| Fixed Roof – Cone | 12 |
| Floating Roof – External | 38 |
| Floating Roof – Internal | 13 |
| Fixed Roof Internal | 9 |
| Roof Appurtenances | 7 |
| Shell Internal | 9 |
| Floor Internal | 21 |

Checklist items rated 3 or 4 automatically generate repair recommendations and link to visual finding records (Track C).

#### 6. Corrosion calculations — MISSING

Per component (shell per course, roof, floor):
```
Corrosion rate      = (original_t – lowest_remaining_t) ÷ years_of_service
Remaining allowance = lowest_remaining_t – t_min
Remaining life      = allowance ÷ rate
Inspection interval = min(remaining_life, API_653_max)
```

Requires: nominal thickness from drawing + year built.

#### 7. Shell settlement survey — MISSING

8 elevation readings at 45° intervals (0°/45°/90°…315°).
API 653 B.2.2.2 calculates:
- Differential settlement Uᵢ (mm) per station
- Out-of-plane deflection Sᵢ (mm) vs Smax limit

#### 8. Narrative text fields — MISSING

Each zone in the Inspection Report section is 2–10 sentences of prose. Can be auto-drafted from checklist ratings but inspector must edit. Zones: Diked Area, Foundation, Shell External, Shell Appurtenances, Access Structure, Roof, Floor Internal, Appurtenances.

#### 9. Design standard — SIMPLIFY

Meeting decision: **API 650 is the design standard**. API 653 is the in-service evaluation standard (not a design option). Dropdown should be:
```
API 650 (default) | BS 2654 | JIS B 8501 | Other
```

#### 10. Roof types — EXTEND

Add: **Umbrella** (subtle curve, single-slope plates — distinct from dome).
Floating types: single deck, double deck, internal floater already present.

---

### V2 implementation priority

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Extend client/site/tank fields (terminal, location, material, product, year built, etc.) | Low | High — unblocks report header |
| 2 | Design standard fix (API 650 default, remove API 653 as design option) | Low | Medium |
| 3 | Shell/roof nozzle split + nozzle UT table (4 readings + reinf pad, in inches) | Low | High |
| 4 | Inspection checklist — 195 items × rating (Track B) | High | Critical |
| 5 | Shell UT table — strake × compass × 5 readings + calculations (Track A) | Medium | Critical |
| 6 | Roof UT table — plate × A–E readings (Track A) | Medium | High |
| 7 | Corrosion calculations (auto from thickness + year built) | Medium | High |
| 8 | Shell settlement survey — 8-point elevation + API 653 B.2.2.2 | Medium | Medium |
| 9 | Narrative text fields per zone (auto-draft + edit) | Medium | High |
| 10 | Report PDF generation matching IRS format | High | Critical |

---

## Meeting notes — April 21 2026

Key decisions from client meeting with Abdurrahman (IRS inspector):

- **Add terminal name and location** to site identification fields
- **API 650 = design standard** — drop API 653 as a design option (it's an in-service evaluation standard)
- **Roof types**: cone, dome, umbrella, floating (single/double deck), internal floater, frangible joint flag
- **Nozzles**: split into shell nozzles (S-prefix) and roof nozzles (R-prefix)
- **Bottom + annular ring** data comes from MFL contractor — group together, import only
- **Shell location = azimuth degree**, not plate number. Courses defined by height; azimuth by compass bearing
- **Defect workflow**: photo first, then sketch/annotate on photo, then measurements
- **Nozzle diameters in inches**; all other dimensions in metric (mm/m)
- **Nozzle inspection focus**: neck area and reinforcement pad — photos preferred over detailed sketches
- **True north** = primary orientation reference; tank north = user-input offset angle from true north
- **Compass inside tank** may be affected by magnetic interference — confirm orientation outside before entry
- **Timeline**: 4–6 weeks to convert mockup into functioning tool; internal inspection first, external later
- **Goal**: auto-generate rough draft report from structured data → inspector refines → final PDF

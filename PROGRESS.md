# Tank Inspection Copilot — Work Progress

## Project path
`/Users/oscar/Documents/oscar-code/tank-inspection-coplilot`
Run: `npm run dev` → http://localhost:5173
Tailscale: http://100.101.225.110:5173

---

## Current status (April 20 2026)

### Screens implemented (24 total)
All screens compile and build cleanly.

| Screen | Status | Notes |
|--------|--------|-------|
| Home | Done | |
| Inspection Setup | Done | |
| Tank Profile | Done | Lean: design code, dims, roof, foundation only |
| Orientation | Done | True North / Physical Marker toggle + compass |
| Tank Overview | Done | Routes to surface-specific setup when config missing |
| Shell Setup | Done | Courses, plate width, seam origin, offset rule, derived table |
| Roof Setup | Done | Sector × ring polar grid, SVG preview |
| Annular Setup | Done | Width input, top-view SVG with azimuth ticks |
| Nozzle Setup | Done | Add/edit/remove nozzle registry |
| Nozzle List | Done | Tap to select nozzle for inspection |
| Location Mode | Done | |
| Map (shell) | Done | ShellSurfaceMap with zoom, seam lines, defect dots |
| Map (other) | Done | Generic GridMap |
| Manual Entry | Done | |
| Plate Picker | Done | |
| Location Confirm | Done | |
| Defect Type | Done | |
| Defect Detail | Done | |
| Measurements | Done | |
| Evidence | Done | |
| Defect Saved | Done | |
| Surface Map | Done | |
| Surface Review | Done | |
| Inspection Validation | Done | |
| MFL Import | Done | |
| Export & Summary | Done | Shows shellConfig if set |
| Success | Done | |

---

## Architecture

### Data model overview (`src/types.ts`)

```typescript
// Tank-level (set once at session start)
TankProfile = { designCode, diameterM, heightM, capacityM3, roofType, foundationType }

// Surface-specific geometry (set when entering each surface for first time)
ShellConfig  = { numCourses, plateWidthMm, plateLengthMm*, seamOriginC1Deg, seamOffsetRule, customOffsetDeg? }
RoofConfig   = { sectorCount, ringCount, apexHeightM? }
AnnularConfig = { widthMm }
NozzleConfig = { nozzles: NozzleDefinition[] }

// Session
InspectionSession = { ..., tankProfile, shellConfig?, roofConfig?, annularConfig?, nozzleConfig?, surfaces[] }
```
`plateLengthMm` = derived = `floor(totalHeightMm / numCourses)` — not user-entered.

### Shell coordinate system
- Canonical: `(theta_deg, z_mm)` — azimuth clockwise from reference, elevation from datum
- Plate addressing: `(plateIdx, courseNum)` where plateIdx is relative to course seam origin
- Map display: unwrapped SVG, x = azimuth, y = elevation
- `theta_deg` for plate P in course C: `(courseSeamOrigin(C-1) + (P-1) × plateSpanDeg) % 360`

### Seam offset convention (API 650)
- **½ plate**: 2-course repeat — C1/C3/C5 align, C2/C4/C6 shifted +½ plate span
- **⅓ plate**: 3-course repeat — C1=0°, C2=+⅓, C3=+⅔, C4=0° again
- **Custom**: cumulative — each course adds fixed step to previous
- Implemented via `courseSeamOrigin(i, c1, stepDeg, rule)` with `i % cycle`

### Surface flow
```
TankOverview
  → (no shellConfig)  → ShellSetupScreen → mode → map → ...
  → (no roofConfig)   → RoofSetupScreen  → mode → map → ...
  → (no annularConfig)→ AnnularSetupScreen → surfaceMap → ...
  → (no nozzleConfig) → NozzleSetupScreen → NozzleListScreen
  → (nozzleConfig ok) → NozzleListScreen → map → ...
  → bottom            → MflImportScreen → ...
```

### Single-file architecture
- `src/App.tsx` (~2600 lines) + `src/types.ts`
- All state in `InspectionSession`, persisted to localStorage
- No routing library — `Screen` union type + conditional rendering
- Tailwind CSS with custom tokens (teal, mint, field, panel, ink, danger, caution, repair)
- `ShellGeometry` computed via `computeShellGeometry(shellConfig, diameterM)` useMemo in App
- `ShellSurfaceMap` self-contained SVG component with zoom (5 steps: 10–52 px/plate)

---

## Open work items (next session)

### HIGH — Surface map components (roof, annular, nozzle)

Currently roof/annular/weld use the generic `GridMap`. Need dedicated SVG components:

1. **RoofPolarMap** — polar sector × ring grid, tap to select zone
   - Sectors: radial lines from apex
   - Rings: concentric circles
   - Address: `(sectorIdx, ringIdx)` displayed as e.g. S3-R2
   - 0° reference at top, clockwise

2. **AnnularTopView** (interactive) — circular band, tap to select azimuth zone
   - Currently the setup screen shows a static preview
   - Need tappable version for map screen + confirm screen
   - Divide band into N azimuth zones (e.g. 36 × 10° each)
   - Address: azimuth zone (e.g. 0°–10°, 10°–20°…)

3. **NozzleClockMap** — per-nozzle clock face SVG
   - 12 clock positions (30° each) around nozzle CL
   - Radial distance from nozzle CL (mm): 0–150 mm inspection zone per API 653
   - Address: `(clockPos, radiusMm)` e.g. 3-o'clock at 80 mm

4. **WeldZoneMap** — linear strip for weld seam inspection
   - VS (vertical seam): azimuth + height range
   - HS (horizontal seam): course boundary azimuth range
   - Need WeldConfig type (seam list)

### MEDIUM — Annular ring routing fix
Current flow sends annular straight to `surfaceMap` after setup, skipping `mode` screen.
Should go to `mode` → `map` (using the AnnularTopView) → `confirm` → defect entry.

### MEDIUM — Shell manual entry (azimuth + elevation)
The generic `ManualEntryScreen` (X,Y integer entry) doesn't fit shell surface.
For shell, manual entry = **Course dropdown + Azimuth field** → derives plateIdx + z_mm.

### MEDIUM — LocationSummaryCard for roof/annular/nozzle
Currently only shell has rich location summary (Course/Plate/Azimuth/Elevation).
Roof, annular, nozzle should show their own coordinate representations.

### LOW — Cross-check validation flags
- Plate assignment doesn't match theta range → soft yellow flag
- z_mm outside claimed course height → soft yellow flag

### LOW — Per-course thickness for API 653
Add `nominalThicknessMm` and `materialGrade` per course in ShellConfig.
Currently only geometry is stored; MAWP calc needs design thickness.

### LOW — SurfaceOverviewCard improvements
Show "Setup required" indicator in TankOverview for surfaces with no config yet.
Currently the card just says "Not started" with no distinction.

---

## Key design decisions recorded

- **TankProfile is tank-level only**: dimensions, design code, roof/foundation type. No shell geometry.
- **Per-surface config before inspection**: user defines geometry when they first enter that surface.
- **plateLengthMm is derived**: `floor(totalHeightMm / numCourses)`. Never user-entered.
- **Annular ring is top-down view**: circular band from above, not unwrapped strip.
- **Nozzle inspection zone**: 150 mm radius from nozzle CL per API 653.
- **Seam offset is repeating, not cumulative**: API 650 convention — ½ plate = 2-course cycle, ⅓ plate = 3-course cycle.

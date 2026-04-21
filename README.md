# Tank Inspection Copilot

Mobile-first field app for capturing API 653 tank inspection data — defect locations on a 2D grid map, photo evidence, MFL report import, and a structured export ready for report generation.

---

## Where we left off (April 2026)

The full screen flow is implemented and working. The design has been reviewed with the customer. The next session should focus on **refining individual screens based on customer feedback** and **generating the updated slide deck** from the new screenshots.

### Screens implemented (in flow order)

| # | Screen | Notes |
|---|--------|-------|
| 1 | Home | Start / resume / view past |
| 2 | Inspection Setup | Site, client, tank ID, type |
| 3 | **Tank Profile** ← new | Diameter, height, capacity, roof type, foundation, shell courses, plate dims |
| 4 | **Orientation** ← new | GPS coords, reference marker, bearing from True North, compass rose preview |
| 5 | Tank Overview | Surface selector with status badges |
| 6 | Location Mode | Tap map / Manual X,Y / Plate ID |
| 7A | Grid Map Picker | SVG grid with layer overlays |
| 7B | Manual X,Y Entry | Integer coordinate input with validation |
| 7C | Plate ID Picker | Search by plate number |
| 8 | Confirm Location | Lock location before defect typing |
| 9 | Defect Type | 8 defect types |
| 10 | Defect Details | Severity, extent, subtype, description |
| 11 | Measurements | Dynamic fields per defect type (UT, pit depth, crack, deformation) |
| 12A | Evidence — no photo | Save blocked until photo attached |
| 12B | Evidence — with photo | Photo card linked to surface + grid ID |
| 13 | Defect Saved | Summary + next action choices |
| 14 | Surface Defect Map | All saved defects as map markers |
| 15 | Surface Review | Per-surface QA with warnings |
| 16 | **Bottom MFL Import** ← new | Contractor, report ref, coverage, anomaly count, severity |
| 17 | Inspection Validation | Whole-inspection QA gate |
| 18 | **Export & Summary** ← new | Executive summary + JSON download + CSV download |
| 19 | Submission Success | Confirmation |

### Key design decisions made

- **Bottom surface uses MFL, not manual grid capture.** When the inspector taps Bottom in Tank Overview, they go to the MFL Import screen first. Manual observations are still possible via the "Add Manual Observations" secondary button.
- **Tank Profile is required before inspection starts.** Diameter, height, plate dimensions (API 650 min 1 800 mm width), and shell course count are needed to generate layout drawings later.
- **Orientation uses a reference marker bearing.** The physical reference point (painted mark, N1 nozzle, stairway) on the tank shell is recorded as degrees clockwise from True North. This defines the tank's orientation on site.
- **Export produces two files:** a full JSON package (complete session data) and a defect CSV (spreadsheet-ready). Both download directly from the browser.
- **Validation gates both MFL and manual fields.** Tank profile and orientation missing → warning. Bottom surface with no MFL and no manual defects → warning.

### Pre-filled demo data (for non-industry users)

All setup screens come pre-filled with realistic values for **TK-201 at SLNG Terminal, Jurong Island**:

```
Tank:       TK-201 · SLNG Terminal · Operations Integrity
Design:     API 653 · Ø 30 m · H 14.5 m · 10 200 m³
Roof:       Single-deck floating · Concrete ring wall foundation
Shell:      8 courses · 1 800 × 2 400 mm plates (API 650 standard)
GPS:        1.2644° N, 103.7502° E
Reference:  Painted mark at 0° (north side of shell)
MFL:        TechnipFMC · MFL-TK201-2026-001 · 2026-04-10
            Full scan · 3 anomalies · Minor findings
```

---

## Tech stack

| Layer | Tech |
|-------|------|
| Framework | React 19 + TypeScript 5 |
| Build | Vite 6 |
| Styling | Tailwind CSS 3 |
| State | useState + localStorage (no external store) |
| Grid map | Hand-rolled SVG |
| Export | Browser Blob + URL.createObjectURL |

No backend. Everything runs in the browser. Session data persists to `localStorage` under the key `tank-inspection-coplilot:draft`.

---

## Running locally

```bash
cd /Users/oscar/Documents/oscar-code/tank-inspection-coplilot
npm install
npm run dev
```

Opens at `http://localhost:5173`.

To expose on Tailscale (already configured in `package.json` with `--host 0.0.0.0`):
```
http://100.101.225.110:5173
```

To serve the slide deck for download:
```bash
python3 -m http.server 8765 --bind 0.0.0.0 \
  --directory output/playwright/product-report
# → http://100.101.225.110:8765/screen-review.pptx
```

---

## Slide deck

Latest customer validation deck:

- `output/playwright/product-report/screen-review.pptx`
- `output/playwright/product-report/screen-review-latest.pptx`
- `output/playwright/product-report/screen-review-latest.md`

Generated from the `latest-*.png` screenshots by:

```bash
node output/playwright/product-report/generate-latest-screen-review.mjs
```

To regenerate screenshots after UI changes, run the Playwright CLI capture script against the local Vite app:

```bash
bash /Users/oscar/.codex/skills/playwright/scripts/playwright_cli.sh \
  --session tank-latest \
  run-code --filename=output/playwright/product-report/capture-latest-screens.js
```

The older `generate-screen-review.mjs` and `capture-missing.mjs` scripts are kept as legacy artifacts from the previous deck pass.

---

## What to do next

### Customer feedback items (from April 2026 review session)
- [ ] Tank Profile, Orientation, MFL Import, Export screens need customer sign-off
- [ ] Regenerate slide deck with screenshots of the 4 new screens
- [ ] Review MFL severity labels with the customer ("Significant findings" vs "Major findings")

### Pending design / engineering decisions
- [ ] **Shell course detail entry** — currently only the count is stored. Future: add per-course height and thickness (needed for shell grid calibration)
- [ ] **Plate ID mapping** — currently 5 plates hard-coded (A01, A07, A12, B04, C09). Should be imported from the TK-201 drawing
- [ ] **Multi-cell defect region** — the data model has `extent: "multi-cell region"` but the grid only highlights one cell at a time
- [ ] **MFL report file attachment** — the `reportUri` field exists in the data model but the UI has no real file upload yet
- [ ] **Offline sync queue** — currently "pending_sync" is a badge only; no actual sync endpoint exists
- [ ] **Historical defect overlay** — prior defect cells are hard-coded in the SVG grid; should come from an API

### Layout map generation (future phase)
The tank profile + orientation data collected in this app is designed to feed a separate layout generation tool that will:
1. Use diameter + plate dimensions to compute the floor plate grid
2. Use shell courses + plate width to compute the shell elevation grid
3. Use GPS + reference marker bearing to orient both on a site plan
4. Overlay defect records and MFL findings on the computed layout

---

## File structure

```
tank-inspection-coplilot/
├── src/
│   ├── App.tsx          — all screens and components (single file, ~1 800 lines)
│   ├── types.ts         — all TypeScript types
│   ├── main.tsx
│   └── styles.css
├── output/
│   └── playwright/
│       └── product-report/
│           ├── screen-review.pptx          — customer slide deck
│           ├── generate-screen-review.mjs  — slide generator (node, no deps)
│           ├── capture-missing.mjs         — Playwright screenshot helper
│           └── *.png                       — screenshots (one per screen)
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── README.md            ← you are here
```

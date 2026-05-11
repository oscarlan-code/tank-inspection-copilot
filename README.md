# Tank Inspection Copilot

This repo currently contains **two parallel UI tracks**:

- `V1` = the original full prototype and current **gold standard reference**
- `V2` = the newer simplified **design prototype** being refined screen by screen

If you open this repo without that distinction, it is easy to get confused.

## Quick Navigation

Use these paths first:

| What you want | File / folder |
|---|---|
| Current app entry point | [src/App.tsx](./src/App.tsx) |
| Active V2 prototype | [src/v2/InspectionSetupPrototype.tsx](./src/v2/InspectionSetupPrototype.tsx) |
| V1 gold-standard reference | [src/App.tsx](./src/App.tsx) |
| Shared V2 styling | [src/styles.css](./src/styles.css) |
| V2 design notes | [MVP_DESIGN.md](./MVP_DESIGN.md) |
| V1 keep / simplify / drop decisions | [V1_CARRY_FORWARD_MATRIX.md](./V1_CARRY_FORWARD_MATRIX.md) |
| Commercial decks and customer assets | [commercial-output/](./commercial-output/) |
| Commercial asset guide | [commercial-output/README.md](./commercial-output/README.md) |

## Local-Only Working Files

Some folders and files are intentionally kept local and are not part of the main repo history:

- `data/` = standards, sample reports, and customer reference material
- `dist/` = local build output
- `output/` = local screenshot / export output
- `Tank_Inspection_Copilot_V2_Design_Progress_*.pptx` = local progress decks
- `*.tsbuildinfo` = generated TypeScript build cache

The goal is to keep `main` focused on:

- product code
- implementation/design docs
- reusable commercial assets

## V1 vs V2

| Version | Role | Main file | Status |
|---|---|---|---|
| `V1` | Legacy reference / gold standard | [src/App.tsx](./src/App.tsx) | Keep for study and comparison |
| `V2` | Current customer-facing design prototype | [src/v2/InspectionSetupPrototype.tsx](./src/v2/InspectionSetupPrototype.tsx) | Active design work |

### V1

`V1` is the older end-to-end prototype. It still contains the strongest reference patterns for:

- app shell structure
- orientation / true north setup
- shell layout setup
- shell precise mapping
- detailed map interaction logic

Treat `V1` as the **gold standard reference**, not the place for current iterative UI design changes.

### V2

`V2` is the current simplified prototype. It is being rebuilt around:

- simpler mobile-app UX
- task-driven flow instead of defect-first flow
- coarse capture by default
- precise mapping only where justified
- bottom inspection via `MFL import`, not manual floor mapping

Current V2 scope includes:

- `Inspection Setup`
- `Inspection Scope`
- `Task Board`
- `Shell UT`
- `Shell finding + precise shell location`
- `Roof UT`
- `Shell Nozzle UT`
- `Roof Nozzle UT`
- `Bottom MFL`
- `Review`
- `Export`

## Which version loads now?

The app currently boots into **V2**.

In [src/App.tsx](./src/App.tsx), this flag is set to `true`:

```ts
const ENABLE_V2_DESIGN_PROTOTYPE = true;
```

And `App()` returns:

```tsx
return <InspectionSetupPrototype />;
```

So:

- `true` = load `V2`
- `false` = fall back to `V1`

## Real App Build Plan

This repo is now at the point where the next step is **building the real Stage 1 product**, not adding more disconnected prototype screens.

### Stage 1 goal

Deliver a **tablet-first oil & gas tank inspection copilot** that allows an inspection team to:

- configure a tank once
- capture shell / roof / nozzle inspection data in the field
- attach findings and photos in context
- import bottom MFL reference data
- review completeness before leaving site
- generate a **report-ready inspection package**
- generate a **full report draft** from captured data by the end of Stage 1

### Stage 1 product boundary

In scope:

- tank inspection only
- shell UT
- roof UT
- shell nozzle UT
- roof nozzle UT
- inline findings with evidence
- shell precise mapping
- roof layout templates
- bottom MFL import / metadata
- review / validation
- structured export
- report generation

Out of scope for Stage 1:

- general industrial asset templates outside tank inspection
- multi-agent enterprise workflows
- CMMS-grade deep integration
- reliability analytics / weak-point intelligence
- service marketplace / network workflows

### Build principles

1. `V1` remains the reference, not the implementation target.
2. `V2` remains the design and workflow baseline for the real product.
3. Build the real app around a **stable domain model first**, not around ad hoc screen state.
4. Prefer **task-driven capture** over report-chapter editing.
5. Support **estimated field capture** where practical, then allow **to-scale refinement** where reporting requires it.
6. Keep the app **offline-friendly** and usable on rugged tablets.

## Target implementation architecture

The current prototype is useful for workflow validation, but the real app should be implemented with clear application layers.

### Frontend

- React + TypeScript
- modular route / screen structure
- shared component library for:
  - setup forms
  - task boards
  - UT entry tables
  - map / sketch canvases
  - finding capture
  - review / export states
- centralized client state for:
  - active inspection
  - layouts
  - nozzle registries
  - findings
  - attachments

### Core domain layer

Must become the backbone of the product:

- `inspection`
- `tank_master`
- `shell_layout`
- `roof_layout`
- `shell_lines`
- `shell_ut_rows`
- `roof_ut_rows`
- `shell_nozzle_registry`
- `roof_nozzle_registry`
- `shell_nozzle_ut_rows`
- `roof_nozzle_ut_rows`
- `findings`
- `photos`
- `mfl_import`
- `review_status`
- `report_package`

### Backend / storage

Stage 1 backend responsibilities:

- inspection persistence
- draft save / load
- attachment storage
- structured export generation
- report generation pipeline
- audit / version metadata

### Report generation layer

By the end of Stage 1, report output should not be a mock export only.

Required outputs:

- structured JSON
- CSV measurement tables
- attachment references
- generated report draft
- report sections fed from structured inspection data

## Delivery order

The real app should be built in this order.

### Phase 0. Freeze references

Goal:

- stop treating V1 and V2 as implementation code
- preserve them as reference assets

Outputs:

- `V1` preserved as gold-standard interaction reference
- `V2` preserved as workflow / UI baseline
- README and design docs aligned to the implementation plan

### Phase 1. Foundation and repo structure

Goal:

- create the real app structure inside the repo without breaking reference prototypes

Outputs:

- app module structure
- routing structure
- shared UI component folders
- domain model folder
- state management layer
- service / storage abstraction layer
- test harness foundation

### Phase 2. Stable data model

Goal:

- replace prototype-only local screen state with a real inspection model

Outputs:

- tank master schema
- shell line schema
- roof layout schema
- nozzle registry schema
- UT row schemas
- findings schema
- MFL schema
- export schema

This phase should happen **before** deep implementation of more screens.

### Phase 3. Setup and inspection frame

Goal:

- get the inspection container working end to end

Build first:

- Inspection Setup
- Inspection Scope
- Task Board
- draft save / restore

### Phase 4. Shell workflow

Goal:

- implement the first full production workflow slice

Build:

- shell line planning
- shell UT line-by-line capture
- shell inline finding flow
- shell layout setup
- shell precise mapping

This is the highest-priority workflow.

### Phase 5. Roof workflow

Goal:

- implement production roof capture with correct layout templates

Build:

- circular plate layout
- circular + center opening
- umbrella / radial layout
- roof feature layer
- roof UT rows
- roof findings

### Phase 6. Nozzle workflows

Goal:

- implement nozzle registry + confirmation + measurement properly

Build:

- shell nozzle workflow
- roof nozzle workflow
- sketch placement mode
- explicit azimuth mode
- parent-layout dependency rules

### Phase 7. Bottom MFL and review

Goal:

- complete the Stage 1 inspection package

Build:

- MFL import metadata
- attachment handling
- review warnings
- completeness logic
- export readiness checks

### Phase 8. Report generation

Goal:

- generate a full report draft from captured data

Build:

- report section mapping
- UT tables
- findings register
- layout figures
- linked evidence sections
- MFL reference section
- export-to-report pipeline

### Phase 9. Hardening and pilot readiness

Goal:

- make the product usable outside the dev environment

Build:

- validation refinement
- error states
- tablet usability tuning
- performance checks
- offline resilience
- data recovery behavior
- acceptance testing against sample reports

## Recommended implementation milestones

### Milestone 1

- repo foundation
- stable domain model
- setup / scope / task board

### Milestone 2

- shell UT production workflow
- shell finding flow
- shell precise mapping

### Milestone 3

- roof UT
- roof features
- shell and roof nozzle workflows

### Milestone 4

- bottom MFL
- review flow
- export package

### Milestone 5

- full report generation
- pilot hardening

## Definition of done for Stage 1

Stage 1 is complete when the team can:

1. create a new inspection on a tablet
2. capture shell / roof / nozzle data end to end
3. attach findings and evidence in context
4. import bottom MFL reference data
5. review missing items before export
6. generate a report-ready structured package
7. generate a full report draft from that package

## Immediate next implementation tasks

These are the next concrete actions for the repo.

1. Create a dedicated real-app module structure separate from V1 and V2 reference code.
2. Define the production TypeScript domain model for inspections and report output.
3. Move `Inspection Setup`, `Inspection Scope`, and `Task Board` off pure prototype state and onto that model.
4. Implement the shell workflow as the first production slice.
5. Add automated tests for:
   - shell line calculation
   - shell layout geometry
   - roof template generation
   - export / report shaping

## Working rule for implementation

During the real app build:

- keep `V1` unchanged unless there is a deliberate migration reason
- keep `V2` usable as the design reference
- do not build new production logic inside `src/App.tsx`
- do not keep expanding prototype-only local state as if it were production architecture

## Commercial BD Assets

Ready-to-use screenshots and animated GIFs for sales decks, one-pagers, and prospect demos live in:

```text
commercial-output/
├── screenshots/                  # PNG screenshots + animated GIFs
│   ├── 01_home.png               # Home screen — New Inspection / Resume Draft
│   ├── 02_setup_blank.png        # Inspection Setup (empty form)
│   ├── 03_setup_filled.png       # Setup with PETRONAS / T-5470 sample data
│   ├── 04_scope.png              # Inspection Scope selector
│   ├── 05_taskboard.png          # Task Board — all tasks with progress indicators
│   ├── 06_shellut_entry.png      # Shell UT entry (empty matrix)
│   ├── 07_shellut_readings.png   # Shell UT matrix with readings filled
│   ├── 08_shell_finding.png      # Inline Finding capture screen
│   ├── 09_shell_layout_setup.png # Shell Layout Setup (plate width, seam azimuth)
│   ├── 10_shell_precise_map.png  # Shell Precise Location Map (SVG canvas)
│   ├── 10b_shell_map_marked.png  # Shell map with cells tapped / defect marked
│   ├── 11_roof_ut.png            # Roof UT entry
│   ├── 12_review.png             # Pre-export Review screen
│   ├── 13_export.png             # Export screen (JSON + CSV)
│   ├── shell_map_demo.gif        # Animated: tap-to-mark defect on shell canvas
│   ├── taskboard_scroll.gif      # Animated: Task Board scroll showing all tasks
│   └── shellut_matrix.gif        # Animated: Shell UT bearing × strake data entry
├── BD_Deck_TankInspectionCopilot.md   # Full BD narrative (pain points → solution → value)
└── capture_all.mjs               # Script that generates all of the above
```

All assets are captured at iPhone 14 Pro viewport (390 × 844 px) using a headless browser against the live V2 dev server.

### Regenerate assets

```bash
# 1. Start the dev server (if not already running)
npm run dev

# 2. Run the capture script
node commercial-output/capture_all.mjs
```

Requires Node 18+, `@playwright/test`, and `ffmpeg` (for GIFs).

---

## Working Rule

When making current UI changes:

- update `V2`
- do **not** casually rewrite `V1`
- use `V1` as the comparison baseline

Related design docs:

- [MVP_DESIGN.md](./MVP_DESIGN.md)
- [V1_CARRY_FORWARD_MATRIX.md](./V1_CARRY_FORWARD_MATRIX.md)

## Run locally

```bash
cd /Users/oscar/Documents/oscar-code/tank-inspection-coplilot
npm install
npm run dev
```

Vite usually starts at:

- `http://localhost:5173`

If that port is already in use, Vite will move to the next free port, for example:

- `http://localhost:5175`

## Build

```bash
npm run build
```

Build output goes to:

- [dist/index.html](./dist/index.html)

For offline demo use, the safe assumption is:

- keep the whole `dist/` folder together

## Tech stack

| Layer | Tech |
|---|---|
| UI | React 19 + TypeScript 5 |
| Build | Vite 6 |
| Styling | Tailwind CSS + custom CSS in [src/styles.css](./src/styles.css) |
| State | local component state + browser storage |
| Maps | hand-built SVG / app-specific visual mapping |

## Repo structure

```text
tank-inspection-coplilot/
├── src/
│   ├── App.tsx                       # V1 app + top-level V2 switch
│   ├── styles.css                   # shared styling
│   ├── types.ts                     # legacy/shared types
│   └── v2/
│       └── InspectionSetupPrototype.tsx
│                                     # current V2 prototype
├── public/
│   └── laiq-logo.png                # V2 branding asset
├── commercial-output/               # decks, one-pagers, demo HTML
├── MVP_DESIGN.md                    # V2 MVP design notes
├── V1_CARRY_FORWARD_MATRIX.md       # what to keep/simplify/drop from V1
└── README.md
```

## Practical summary

If you are reviewing this repo:

1. Look at `V1` to understand the original reference behavior.
2. Look at `V2` to see the current design direction.
3. Check [src/App.tsx](./src/App.tsx) to see which one is active.

If you are editing this repo:

1. Make current UI changes in `V2`.
2. Use `V1` for reference only unless there is a deliberate reason to touch it.

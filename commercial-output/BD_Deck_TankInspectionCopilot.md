# Tank Inspection Copilot — Business Development Deck
**Prepared:** April 2026 | **Audience:** Inspection Companies, Asset Owners, Oil & Gas Operators

---

## 1. The Problem — What Inspectors Live With Today

### Pain Point 1: Paper & Clipboard Data Collection
Inspectors in the field still rely on paper forms, handwritten notebooks, and voice memos to capture thickness readings, nozzle data, and defect observations. Data is only as good as the handwriting, and transcription into a report after the job introduces errors and delays.

> **Impact:** Re-keying field data into reports adds 4–8 hours per inspection. Transcription errors silently corrupt the record.

---

### Pain Point 2: Findings Get Lost Between the Field and the Report
When an inspector spots a defect mid-task (e.g., corrosion during a Shell UT run), the current workflow forces them to break focus — jot a note, take a separate photo, and hope they remember to tie it back to the right location later. There is no in-context path from "I see something" to "it is documented."

> **Impact:** Findings get de-coupled from their measurement context. Critical defects are sometimes missed in the final report because the link back to the UT row was never established.

---

### Pain Point 3: Defect Location Is Vague and Inconsistent
"Corrosion observed near the third strake, north side" is how most findings are described. Different inspectors use different reference conventions (True North, Plant North, ladder-side markers). Without a structured location capture, the same defect cannot be reliably tracked across inspection cycles.

> **Impact:** Repeated inspection data cannot be trended. Asset owners cannot answer: "Is this pit growing?"

---

### Pain Point 4: Every Inspection Company Has a Different Format
Shell UT readings, roof plate data, and nozzle readings are submitted in different Excel templates, PDFs, and Word documents. Asset owners with multiple tanks and multiple contractors receive structurally incompatible data. Consolidating it requires manual normalisation before any analysis.

> **Impact:** Analytics and fitness-for-service assessments are delayed or done manually, increasing risk of missed deterioration patterns.

---

### Pain Point 5: Report Writing Consumes Inspection Bandwidth
A typical API 653 inspection report takes 1–3 days to write after fieldwork is complete. The inspector must recall context, locate photos, re-enter measurements, and structure findings in narrative prose — often a week after the tank visit.

> **Impact:** Inspector time is the bottleneck. Capacity is consumed by report writing, not inspection.

---

### Pain Point 6: MFL Floor Data Lives in a Separate Silo
Floor inspection is typically contracted to a specialist MFL vendor who delivers a standalone PDF report. That data is never formally linked to the shell or roof findings from the same inspection event, making it difficult to build a whole-tank health picture.

> **Impact:** Asset owners manage three separate documents (shell/roof report, nozzle report, MFL report) when making fitness-for-service decisions.

---

## 2. The Solution — Tank Inspection Copilot

Tank Inspection Copilot is a **mobile-first inspection workflow app** that guides the inspector through every step of a tank inspection — from setup through structured data export — without ever leaving the device.

It replaces paper, disconnected photos, and post-job transcription with a single structured flow that captures everything in context, in the field, as the work happens.

---

## 3. Key Features

### Feature 1: Guided Task-Driven Workflow
The app organises every inspection into a clear sequence: Setup → Scope → Task Board → Individual Tasks → Review → Export.

- Inspectors select only the tasks in scope for their job (Shell UT, Roof UT, Shell Nozzles, Roof Nozzles, Bottom MFL).
- A live Task Board shows progress, record counts, and attention flags at a glance.
- Draft save and resume means a power loss or interruption never loses work.

**Benefit:** No inspector needs to remember what to capture — the app drives the sequence and flags what is missing.

---

### Feature 2: In-Context Finding Capture (No Duplicate Entry)
When an inspector spots an anomaly during a Shell UT run, they tap "Add Finding Here." The app pre-fills the strake, bearing, and UT context from the active row. The inspector takes a photo, annotates it, selects finding type and severity, and adds measurements — without leaving the task.

That finding is linked to the UT row forever. It does not need to be re-entered in a findings register later.

Finding flow:
1. Take photo
2. Annotate (arrow, circle, freehand, text label)
3. Define type (Crack, Corrosion, Deformation, Weld Concern, etc.)
4. Assign severity (Low / Medium / High)
5. Add measurements
6. Save — returns instantly to the UT task

**Benefit:** Nothing is lost between the field and the report. Every finding has photo evidence, location context, and measurement data in one record.

---

### Feature 3: Precise Shell Location Mapping
For findings that require exact localisation, the app offers a tap-to-mark SVG shell map. The inspector can mark the defect on an unwrapped shell canvas, or enter coordinates manually (X, Y) or by plate and seam reference.

Shell layout (plate width, seam origin, offset rule) is configured once per inspection and reused for all shell findings that session.

Location methods supported:
- Tap on shell layout canvas
- Manual X, Y coordinate entry
- Plate / seam reference (near vertical seam, near horizontal seam)

**Benefit:** Every shell defect gets a precise, repeatable coordinate. The same location can be returned to in the next inspection cycle and the data can be trended.

---

### Feature 4: Full Surface Coverage in One App

| Surface | Capability |
|---|---|
| Shell UT | Coarse entry by strake and bearing. Fine precise location on demand. |
| Roof UT | Plate-by-plate reading entry with inline findings. |
| Shell Nozzles | 4-position clock readings (12/3/6/9) plus reinforcement pad. |
| Roof Nozzles | Cardinal direction readings (N/E/S/W) plus reinforcement pad. |
| Bottom MFL | Import contractor report — contractor, reference, date, coverage, attachment. |

All surfaces feed into one unified Findings register and one export.

**Benefit:** One app replaces paper forms across all tank surfaces. One export gives the asset owner a complete inspection record.

---

### Feature 5: Structured Export — Ready for Downstream Use
When the inspection is complete, the app produces:
- **JSON export** — structured data suitable for ingestion into an asset management system or database.
- **CSV export** — ready for Excel, Power BI, or custom reporting tools.
- **Attachment bundle** — photos, annotations, and MFL file references included.

The export includes: all UT readings, all findings with photos and measurements, tank setup data, inspection scope, and warnings surfaced during review.

**Benefit:** No more manual transcription. Data moves directly from field capture to report or CMMS without re-keying.

---

### Feature 6: Pre-Export Review and Completeness Check
Before export, the Review screen checks every task for completeness and surfaces warnings:
- Missing required photos on findings
- Incomplete shell reading sets
- Missing MFL attachment when Bottom MFL is in scope
- Findings with no measurement data

Hard blockers prevent export only for genuinely incomplete data (e.g., a saved finding with no photo). Soft warnings allow export with flags.

**Benefit:** Quality is checked in the field, not after the inspector has left site. Gaps can be filled immediately.

---

## 4. Why Now

- **API 653** inspection requirements are tightening globally. Operators are under increasing scrutiny to demonstrate traceability of findings across inspection cycles.
- **Inspection workforce attrition** means experienced inspectors are retiring and companies need tools that encode good practice, not just assist it.
- **Digital twin and asset management** platforms are hungry for structured inspection data — but most inspection data is still arriving as PDFs.
- **Mobile hardware** (rugged tablets, IP67 phones) is now standard on-site. The barrier to mobile field tools has been removed.

---

## 5. Target Customers

| Segment | Why They Buy |
|---|---|
| Independent inspection companies | Reduce report turnaround time. Differentiate on data quality. |
| Integrated oil & gas operators (upstream/downstream) | Standardise inspection data across sites and contractors. Enable trend analysis. |
| Inspection engineering consultancies | Replace bespoke Excel templates with a supported product. |
| Inspection certification bodies | Demonstrate audit traceability of finding evidence and location records. |

---

## 6. Value Proposition Summary

> **Tank Inspection Copilot replaces paper, disconnected photos, and post-job report writing with a single structured mobile workflow. Inspectors capture everything in context — readings, findings, photos, locations — and leave site with a clean structured export, not a clipboard full of notes.**

**For inspection companies:** fewer hours on report writing, fewer errors, faster turnaround.

**For asset owners:** structured data that can be analysed, trended, and ingested directly into asset management systems — not PDFs.

---

## 7. Current Product Status

| Area | Status |
|---|---|
| Core inspection flow (V2) | Active prototype — all 18 screens implemented |
| Shell UT with precise location | Complete including SVG shell map |
| Roof UT, Nozzle UT | Complete |
| Bottom MFL import | Complete |
| Findings register with photo annotation | Complete |
| Review + completeness check | Complete |
| Export (JSON + CSV) | Complete |
| Mobile-first responsive design | React 19 + Tailwind CSS — single-column mobile, tablet-ready |

---

## 8. Next Conversation Starters for Prospects

1. "How many hours does your team spend transcribing field notes into reports today?"
2. "Can you tell me exactly where that corrosion spot was in your 2021 inspection — and is it the same location growing in 2024?"
3. "How many different Excel templates do you receive from your inspection contractors each year?"
4. "What happens when an inspector leaves your company — where does their inspection knowledge live?"

---

*Tank Inspection Copilot — Built for the field. Designed for the data.*

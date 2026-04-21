import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const reportDir = process.cwd();
const workDir = path.join(reportDir, "screen-review-work");
const pptDir = path.join(workDir, "ppt");
const slidesDir = path.join(pptDir, "slides");
const slideRelsDir = path.join(slidesDir, "_rels");
const mediaDir = path.join(pptDir, "media");
const outFile = path.join(reportDir, "screen-review.pptx");

const EMU = 914400;
const SLIDE_CX = 12192000;
const SLIDE_CY = 6858000;
const W = 13.333333;
const H = 7.5;

const C = {
  bg: "F4F7F6",
  white: "FFFFFF",
  ink: "17201E",
  muted: "52625E",
  teal: "075F5C",
  mint: "DCEFE9",
  line: "CBD8D4",
  dark: "0E3432",
  yellow: "FFF7D6",
  red: "FEE2E2",
  redDark: "B42318",
  orange: "FEF3C7",
};

// ─── Screen data ──────────────────────────────────────────────────────────────
// Each entry: screenshot file, screen label, workflow stage, headline, bullet array
const SCREENS = [
  {
    img: "01-home.png",
    label: "Screen 01 — Home",
    stage: "Stage 1 of 5 · Start",
    stageColor: C.mint,
    headline: "Entry point — launch or resume an inspection session",
    bullets: [
      "Inspection header card at the top shows Site ID, Tank ID, inspection type badge (routine / external / internal / special), and inspector name — always visible before any action.",
      "Three primary action buttons: Start New Inspection (creates a fresh session), Resume Draft Inspection (restores last saved local state), View Past Inspections (history list).",
      "Open draft metrics panel displays three values side by side: Tank ID, total defect count across all surfaces, and surfaces completed out of six (e.g. 0/6).",
      "Sync status badge in the top-right header shows Draft / Unsynced / Synced throughout the whole workflow — colour-coded (teal = synced, yellow = pending).",
      "Persistent bottom navigation bar: Home · Drafts · QA · Settings — accessible on every screen via one tap.",
    ],
  },
  {
    img: "02-inspection-setup-main.png",
    label: "Screen 02 — Inspection Setup",
    stage: "Stage 1 of 5 · Start",
    stageColor: C.mint,
    headline: "Define field context before location capture begins",
    bullets: [
      "Four form fields: Site (e.g. SLNG Terminal), Client (e.g. Operations Integrity), Tank ID (e.g. TK-201), Inspection Type dropdown — Routine / External / Internal / Special.",
      "Continue button is disabled until Site, Tank ID, and Inspection Type are all filled — prevents incomplete session context from reaching the grid capture step.",
      "Save Draft exits to Home and persists the partial setup to device localStorage with no data loss, enabling resumption at any time.",
      "Inspection date and Inspector name are auto-populated from the active session object, minimising manual typing in field conditions.",
      "Any field change immediately sets syncStatus to pending_sync, triggering the Unsynced badge in the header.",
    ],
  },
  {
    img: "02-surface-overview.png",
    label: "Screen 03 — Tank Overview",
    stage: "Stage 1 of 5 · Start",
    stageColor: C.mint,
    headline: "Choose which tank surface to inspect next",
    bullets: [
      "Six surface selector cards: Bottom (Floor plate matrix and annular band), Shell (Unwrapped cylinder elevation grid), Roof (Roof surface grid abstraction), Annular ring (Edge band defects and repairs), Nozzle area (Localised nozzle zones), Weld zone (Weld and heat affected zones).",
      "Each card shows the surface name, description, and a status badge that cycles: Not started → N defects (live count) → Complete (teal highlight).",
      "Tapping any card sets the active surface in session state and navigates to Location Mode to begin defect capture on that surface.",
      "Bottom and Shell are the two required surfaces for inspection submission; the other four are optional but fully tracked.",
      "Inspector can return to this screen at any time via the Tank Overview to switch between surfaces mid-inspection.",
    ],
  },
  {
    img: "04-location-mode-main.png",
    label: "Screen 04 — Location Mode",
    stage: "Stage 2 of 5 · Location",
    stageColor: C.yellow,
    headline: "Select how to pin the defect position on the surface grid",
    bullets: [
      "Three method cards with title and description. Tap on Grid Map is marked with a 'Recommended' badge — fastest and most accurate for touch-based field use.",
      "Tap on Grid Map: inspector taps directly on an SVG grid cell; the cell highlights and an X/Y summary card updates instantly.",
      "Manual X,Y Entry: inspector types integer coordinates from a printed checklist or drawing reference — useful when screen interaction is inconvenient.",
      "Plate ID Entry: inspector searches a plate number; the system auto-resolves it to the mapped X, Y grid coordinates from the tank drawing.",
      "The selected method is remembered for back-navigation — pressing Edit Location on the Confirm screen returns to the same method screen.",
    ],
  },
  {
    img: "03-grid-location-picker-main.png",
    label: "Screen 05A — Grid Map Picker",
    stage: "Stage 2 of 5 · Location",
    stageColor: C.yellow,
    headline: "Tap the exact grid partition on an interactive SVG surface map",
    bullets: [
      "Grid dimensions: 20×10 cells for bottom and roof; 24×12 cells for shell. Browser pinch-zoom and pan are natively available for detailed navigation.",
      "Circular validity mask: cells outside the tank footprint (bottom and roof) are disabled and visually greyed — the inspector cannot select them.",
      "Four toggleable overlay layers: Plate IDs (plate numbers on mapped cells), Grid labels (X and Y axis numbers), Prior defects (historical locations), Repairs (previously repaired cells in violet).",
      "Cell colour codes: white = selectable; teal outline = annular band zone; violet fill = repair; red dot = existing saved defect; strong teal highlight = currently selected.",
      "Location summary card beneath the map updates on every tap: X, Y, Grid ID (e.g. 12-4), and Plate ID (e.g. A12) if the cell is in the plate map.",
      "Confirm Location button remains disabled until a valid (non-greyed) cell is selected — cannot proceed without a confirmed location.",
    ],
  },
  {
    img: "05b-manual-entry-main.png",
    label: "Screen 05B — Manual X,Y Entry",
    stage: "Stage 2 of 5 · Location",
    stageColor: C.yellow,
    headline: "Type integer coordinates when tap interaction is impractical",
    bullets: [
      "Two numeric input fields: X partition and Y partition. Both require integer values; decimal or non-numeric input fails validation.",
      "Live validation feedback: green 'Valid partition X-Y' banner when coordinates are within bounds and inside the surface footprint.",
      "Red 'This partition is outside the inspectable surface' banner when values are out-of-range or fail the circular footprint mask check.",
      "Preview on Map navigates to the Grid Map with the typed cell pre-highlighted, allowing visual confirmation before committing the location.",
      "Confirm Location is disabled unless both values are valid integers within the surface grid — same integrity check as the tap path.",
      "Produces an identical GridLocation object to the tap method; all downstream defect capture screens are unchanged.",
    ],
  },
  {
    img: "05c-plate-picker-main.png",
    label: "Screen 05C — Plate ID Picker",
    stage: "Stage 2 of 5 · Location",
    stageColor: C.yellow,
    headline: "Search a plate number to auto-resolve its grid coordinates",
    bullets: [
      "Live search field filters the plate list in real time as the inspector types any part of the plate ID.",
      "Each result card shows three values: Plate ID (e.g. A12), subzone description (e.g. 'Central repaired plate'), and resolved grid coordinate (e.g. 12-4).",
      "Tapping a plate card sets plateId, x, y, and gridId in one action — no manual coordinate entry required.",
      "Show on Map button switches to the Grid Map with the resolved cell highlighted for optional visual confirmation before committing.",
      "Pre-loaded plate map for TK-201: A01, A07, A12, B04, C09 — expandable when tank drawing import is implemented.",
      "The locationMode field in the saved GridLocation records 'plate_id' for audit trail and back-navigation routing.",
    ],
  },
  {
    img: "04-location-confirmation-main.png",
    label: "Screen 06 — Confirm Location",
    stage: "Stage 2 of 5 · Location",
    stageColor: C.yellow,
    headline: "Lock surface, X, Y, and plate ID before defect classification begins",
    bullets: [
      "Location summary card shows all four location fields side by side: X, Y, Grid ID (e.g. 12-4), and Plate ID (e.g. A12 or 'Optional' if the cell has no mapped plate).",
      "Mini grid map re-renders the full surface with the selected cell highlighted; Plate IDs and Repairs overlays on, Grid labels and Prior defects off — a clean confirmation view.",
      "Use This Location commits the GridLocation to the defect draft and advances to Defect Type selection.",
      "Edit Location returns to whichever method screen was used (Map, Manual, or Plate Picker), preserving the prior selection for easy correction.",
      "No defect classification fields are captured until this screen is confirmed — enforces spatial accuracy before type or severity is recorded.",
    ],
  },
  {
    img: "05-defect-type-main.png",
    label: "Screen 07 — Defect Type",
    stage: "Stage 3 of 5 · Defect",
    stageColor: C.orange,
    headline: "Select the primary defect classification for the locked location",
    bullets: [
      "Screen subtitle always shows the locked surface and grid ID (e.g. 'Bottom 12-4') as a constant spatial reminder throughout defect capture.",
      "Eight defect types: Corrosion, Crack, Deformation, Coating Failure, Leakage, Weld Defect, Patch/Repair Observation, Other.",
      "Each type is a large, full-width touch target with a 'Select' secondary label — designed for gloved field use with a minimum touch height.",
      "One tap immediately advances to Defect Details with the chosen type pre-filled — no separate confirm step needed.",
      "Defect type selection gates the measurement input fields two screens ahead: Crack → length + width; Deformation → deformation mm; all others → UT thickness + min thickness + pit depth.",
    ],
  },
  {
    img: "06-defect-details-main.png",
    label: "Screen 08 — Defect Details",
    stage: "Stage 3 of 5 · Defect",
    stageColor: C.orange,
    headline: "Classify severity and extent, add subtype and field notes",
    bullets: [
      "Subtype free-text field captures the specific variant, e.g. 'pitting', 'general thinning', 'longitudinal crack', 'blistering', 'coating delamination'.",
      "Severity three-button selector: Minor (yellow highlight), Moderate (orange highlight), Severe (red highlight). Severity is required to enable the next step.",
      "Extent dropdown: single cell / multi-cell region / edge/annular — records the spatial spread of the defect.",
      "Description text area for free-form field notes, e.g. 'concentrated near weld seam, approximately 30 cm², rust staining visible'.",
      "Next: Measurements is disabled until both Defect Type and Severity are set — prevents incomplete classification records.",
      "Skip Measurements advances directly to Evidence capture for cases where numeric measurements are not applicable or available in the field.",
    ],
  },
  {
    img: "07-measurements-main.png",
    label: "Screen 09 — Measurements",
    stage: "Stage 3 of 5 · Defect",
    stageColor: C.orange,
    headline: "Record numeric measurements — input fields adapt to defect type",
    bullets: [
      "Measurement method free-text field is always shown (e.g. 'UT probe', 'digital caliper', 'visual estimate') for complete traceability.",
      "Crack: crack length mm and crack width mm fields.",
      "Deformation: deformation mm field only.",
      "All other defect types (Corrosion, Coating Failure, Leakage, Weld Defect, etc.): UT thickness mm, minimum thickness mm, pit depth mm.",
      "Advisory warning banner appears if key fields are left empty for the defect type, e.g. 'Corrosion records should include UT or minimum thickness before final review.'",
      "Measurements are advisory at this step — warnings are non-blocking here but will re-appear in Surface Review, reinforcing data completeness without halting field capture.",
    ],
  },
  {
    img: "08-evidence-required-main.png",
    label: "Screen 10A — Evidence (No Photo)",
    stage: "Stage 3 of 5 · Defect",
    stageColor: C.orange,
    headline: "Photo proof is mandatory — Save Defect is blocked until at least one is attached",
    bullets: [
      "Two attachment buttons side by side: Take Photo (triggers native device camera) and Upload Photo (opens file picker).",
      "Red warning banner: 'At least one photo is required before saving.' — persistent, non-dismissable visual block.",
      "Save Defect button is disabled; all four conditions must be satisfied before it activates: location, defect type, severity, and ≥1 photo.",
      "Screen subtitle shows the locked surface + grid ID (e.g. 'Bottom 12-4') so the inspector can confirm they are photographing the correct location.",
      "The EvidenceItem data model supports photo, video, and audio evidence types — the MVP UI implements photo capture first.",
    ],
  },
  {
    img: "09-evidence-with-photo-main.png",
    label: "Screen 10B — Evidence (Photo Attached)",
    stage: "Stage 3 of 5 · Defect",
    stageColor: C.orange,
    headline: "Evidence card links each photo to the exact surface and grid coordinate",
    bullets: [
      "Each attached photo renders as a card with a thumbnail image, linked surface name, and linked X-Y coordinate label (e.g. 'Bottom 12-4').",
      "Delete button on each card allows the inspector to remove and replace a blurred or incorrect photo before the defect is saved.",
      "Multiple photos can be attached to a single defect record — the data model imposes no upper limit.",
      "Save Defect button becomes active once location + type + severity + ≥1 photo are all present — clear visual signal that the record is complete.",
      "Stored EvidenceItem fields: URI, timestamp (ISO 8601), optional GPS coordinates, linkedSurface, linkedX, linkedY — all preserved for API 653 reporting.",
    ],
  },
  {
    img: "10-defect-saved-main.png",
    label: "Screen 11 — Defect Saved",
    stage: "Stage 4 of 5 · Review",
    stageColor: C.mint,
    headline: "Confirmation screen after a defect record is saved locally",
    bullets: [
      "Summary card shows four key fields of the just-saved record: Type (e.g. Corrosion), Severity (e.g. Moderate), Location (Grid ID e.g. 12-4), and Photos count.",
      "Sync status badge in the header changes to 'Unsynced' — the record is persisted to localStorage and queued for background sync when connectivity is available.",
      "Add Another Defect resets the draft but retains the same grid location — enables rapid multi-defect capture at the same cell without re-selecting location.",
      "Return to Surface Map navigates to the full grid view to see all saved defect markers on the current surface.",
      "Finish Surface navigates directly to Surface Review for the per-surface QA checklist step.",
    ],
  },
  {
    img: "11-saved-defect-map-main.png",
    label: "Screen 12 — Surface Defect Map",
    stage: "Stage 4 of 5 · Review",
    stageColor: C.mint,
    headline: "Spatial overview of all saved defects on the active surface",
    bullets: [
      "Full grid map re-rendered with red dot markers on every cell that has one or more saved defect records.",
      "All four layer toggles available: Plate IDs, Grid labels, Prior defects, Repairs — supports cross-referencing of historical data with new findings.",
      "Subtitle shows a live defect count (e.g. '3 saved defects on Bottom') that updates immediately after each new save.",
      "Add New Defect button returns to Location Mode to begin capturing another defect on this surface.",
      "Finish Surface button navigates to Surface Review for the per-surface QA step before the surface is marked complete.",
      "This screen is the target of the Drafts tab in the bottom navigation bar — accessible from any screen in the workflow at any time.",
    ],
  },
  {
    img: "12-surface-review-main.png",
    label: "Screen 13 — Surface Review",
    stage: "Stage 4 of 5 · Review",
    stageColor: C.mint,
    headline: "Per-surface QA checklist before the surface is marked complete",
    bullets: [
      "Metrics panel shows four values: Defects count, Photos count (total across all defects on this surface), Grid dimensions (e.g. 20×10), and Status (In progress / Complete).",
      "Warning: 'A saved defect is missing a required photo.' — flags any defect record that was saved without evidence.",
      "Warning: 'Bottom has no saved defects or clear reviewed-cell record yet.' — reminds the inspector to log at least one observation.",
      "Warning: 'Annular zone has not been marked in this surface record.' — ensures the critical edge band is explicitly covered.",
      "Warning: 'One or more defects are missing subtype.' — prompts completion of classification detail.",
      "Green 'No blocking issues found' banner when all warnings are resolved. Go Back and Fix → Surface Map; Mark Surface Complete → Inspection Validation.",
    ],
  },
  {
    img: "13-inspection-validation-main.png",
    label: "Screen 14 — Inspection Validation",
    stage: "Stage 5 of 5 · Submit",
    stageColor: C.red,
    headline: "Whole-inspection QA gate — submission blocked until every check passes",
    bullets: [
      "Checks required surface completion: Bottom and Shell must both be marked complete — missing either blocks submission.",
      "Checks photo requirement across all surfaces: every saved defect must have at least one photo attached.",
      "Checks coordinate validity: each defect location must fall inside the valid surface footprint — catches any data integrity issues.",
      "Status summary metrics: 'Required surfaces complete' (Ready / Needs review), 'Invalid coordinates' (None / Found), 'Photo requirement' (Ready / Needs review).",
      "Fix Issues routes back to Tank Overview so the inspector can navigate to any surface and correct the flagged issue.",
      "Submit Inspection button is disabled (greyed) while any warning exists — activates only when the validation panel shows 'No blocking issues found'.",
    ],
  },
  {
    img: "13-inspection-validation-main.png",
    label: "Screen 15 — Submission Success",
    stage: "Stage 5 of 5 · Submit",
    stageColor: C.red,
    headline: "Inspection dataset generated, synced, and ready for API 653 review",
    bullets: [
      "Confirmation message: 'The report-ready defect dataset is synced and available for review.'",
      "Sync status badge changes to 'Synced' — all session records are marked as submitted and cleared from the pending queue.",
      "View Defect Map navigates to the Surface Defect Map for a final spatial review of all captured defect locations.",
      "Start Another Inspection resets the full session to a new InspectionSession and restarts from Inspection Setup.",
      "Return Home navigates to the Home screen where the submitted inspection will appear under View Past Inspections.",
      "The completed dataset: InspectionSession + 6 SurfaceInspections + DefectRecords (each with GridLocation, measurements, severity) + EvidenceItems — structured for API 653 defect reporting and future CAD overlay export.",
    ],
  },
];

// ─── Low-level XML helpers ─────────────────────────────────────────────────────
function esc(v) {
  return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;");
}
function emu(inches) { return Math.round(inches * EMU); }

function pngSize(fp) {
  const b = fs.readFileSync(fp);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function fitImage(file, ox, oy, maxW, maxH) {
  const { w, h } = pngSize(path.join(reportDir, file));
  const aspect = w / h;
  let fw = maxW, fh = fw / aspect;
  if (fh > maxH) { fh = maxH; fw = fh * aspect; }
  return { x: ox + (maxW - fw) / 2, y: oy + (maxH - fh) / 2, w: fw, h: fh };
}

// ─── Slide builder helpers ─────────────────────────────────────────────────────
function newSlide() {
  const s = { els: [], imgs: [], _id: 2 };
  s.rect = (x,y,w,h,fill,line) => {
    s.els.push({ t:"rect", id:s._id++, x,y,w,h, fill, line });
  };
  s.text = (text, x,y,w,h, opts={}) => {
    s.els.push({ t:"text", id:s._id++, text,x,y,w,h, opts });
  };
  s.image = (file,x,y,w,h) => {
    const relId = `rId${s.imgs.length+2}`;
    s.imgs.push({ file, relId });
    s.els.push({ t:"image", id:s._id++, file,relId,x,y,w,h });
  };
  s.imageFit = (file, ox,oy, maxW,maxH, frame=true) => {
    const p = fitImage(file,ox,oy,maxW,maxH);
    if (frame) s.rect(p.x-0.06, p.y-0.06, p.w+0.12, p.h+0.12, C.white, C.line);
    s.image(file, p.x,p.y,p.w,p.h);
  };
  return s;
}

function rPr(color, size, bold) {
  return `<a:rPr lang="en-US" sz="${Math.round(size*100)}"${bold?' b="1"':''}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr>`;
}

function para(text, color, size, bold=false, align="l") {
  return `<a:p><a:pPr algn="${align}"/><a:r>${rPr(color,size,bold)}<a:t>${esc(text)}</a:t></a:r><a:endParaRPr lang="en-US"/></a:p>`;
}

function txBody(lines, opts={}) {
  const anchor = opts.mid ? "ctr" : "t";
  const ps = (Array.isArray(lines)?lines:[lines]).map(l =>
    para(l, opts.color??C.ink, opts.size??11, !!opts.bold, opts.align??"l")
  ).join("");
  return `<p:txBody><a:bodyPr wrap="square" anchor="${anchor}" lIns="${emu(0.07)}" tIns="${emu(0.04)}" rIns="${emu(0.07)}" bIns="${emu(0.04)}"/><a:lstStyle/>${ps}</p:txBody>`;
}

function elXml(el) {
  if (el.t === "image") {
    return `<p:pic><p:nvPicPr><p:cNvPr id="${el.id}" name="${esc(el.file)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${el.relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${emu(el.x)}" y="${emu(el.y)}"/><a:ext cx="${emu(el.w)}" cy="${emu(el.h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln><a:solidFill><a:srgbClr val="${C.line}"/></a:solidFill></a:ln></p:spPr></p:pic>`;
  }
  const fill = el.fill ? `<a:solidFill><a:srgbClr val="${el.fill}"/></a:solidFill>` : "<a:noFill/>";
  const ln   = el.line ? `<a:ln w="9525"><a:solidFill><a:srgbClr val="${el.line}"/></a:solidFill></a:ln>` : "<a:ln><a:noFill/></a:ln>";
  const tx   = el.t === "text" ? txBody(el.text, el.opts) : "";
  return `<p:sp><p:nvSpPr><p:cNvPr id="${el.id}" name="s${el.id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(el.x)}" y="${emu(el.y)}"/><a:ext cx="${emu(el.w)}" cy="${emu(el.h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill}${ln}</p:spPr>${tx}</p:sp>`;
}

function slideXml(s) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${C.bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
  <p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_CX}" cy="${SLIDE_CY}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_CX}" cy="${SLIDE_CY}"/></a:xfrm></p:grpSpPr>
    ${s.els.map(elXml).join("\n    ")}
  </p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function relsXml(s) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
${s.imgs.map(i=>`  <Relationship Id="${i.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${esc(i.file)}"/>`).join("\n")}
</Relationships>`;
}

// ─── Build slides ─────────────────────────────────────────────────────────────
const allSlides = [];

// Slide 1 — Cover
{
  const s = newSlide();
  s.rect(0, 0, W, H, C.bg, C.bg);
  s.rect(0, 0, 0.2, H, C.teal, C.teal);
  s.text("Tank Inspection Copilot", 0.65, 0.9, 6.8, 0.62, { color: C.ink, size: 28, bold: true });
  s.text("Screen-by-Screen Design Review", 0.68, 1.62, 6.0, 0.36, { color: C.teal, size: 14, bold: true });
  s.text("17 screens  ·  5 workflow stages  ·  API 653-aligned field capture", 0.68, 2.08, 7.0, 0.3, { color: C.muted, size: 11 });
  s.rect(0.68, 2.52, 5.8, 0.02, C.line, C.line);
  s.text("Stages:  Start  →  Location  →  Defect  →  Review  →  Submit", 0.72, 2.7, 6.2, 0.3, { color: C.muted, size: 11 });
  s.text("Prepared for customer validation  ·  April 2026", 0.72, 3.2, 5.8, 0.28, { color: C.muted, size: 10 });
  s.imageFit("03-grid-location-picker-main.png", 7.3, 0.55, 2.6, 6.35);
  s.imageFit("10-defect-saved-main.png", 10.25, 1.05, 2.4, 5.45);
  allSlides.push(s);
}

// Slides 2–18 — one per screen
SCREENS.forEach(({ img, label, stage, stageColor, headline, bullets }, i) => {
  const s = newSlide();
  const total = SCREENS.length + 1;
  const num = i + 2;

  // Left white panel for screenshot
  s.rect(0, 0, 3.6, H, C.white, C.line);

  // Stage badge (top of left panel)
  s.rect(0.22, 0.25, 3.12, 0.42, stageColor, C.line);
  s.text(stage, 0.3, 0.25, 2.96, 0.42, { color: C.teal, size: 9.5, bold: true, mid: true });

  // Screenshot
  s.imageFit(img, 0.22, 0.82, 3.12, 6.0);

  // Teal vertical accent
  s.rect(3.75, 0.22, 0.07, 7.0, C.teal, C.teal);

  // Screen label (title)
  s.text(label, 4.08, 0.26, 9.0, 0.52, { color: C.teal, size: 21, bold: true });

  // Divider
  s.rect(4.08, 0.86, 9.0, 0.015, C.line, C.line);

  // Headline
  s.text(headline, 4.08, 0.94, 9.0, 0.38, { color: C.muted, size: 12 });

  // Feature bullet cards
  const cardH = 0.72;
  const gap = 0.1;
  const startY = 1.42;
  const fills = [C.white, C.mint, C.white, C.mint, C.white, C.mint];
  bullets.forEach((b, bi) => {
    const y = startY + bi * (cardH + gap);
    s.rect(4.08, y, 9.0, cardH, fills[bi % fills.length], C.line);
    s.text(`${bi + 1}.  ${b}`, 4.24, y + 0.04, 8.72, cardH - 0.08, { color: C.ink, size: 9.8 });
  });

  // Footer
  s.text("Tank Inspection Copilot — Screen Design Review", 0.55, 7.18, 6.0, 0.22, { color: C.muted, size: 8 });
  s.text(`${num} / ${total}`, 12.6, 7.18, 0.5, 0.22, { color: C.muted, size: 8, align: "r" });

  allSlides.push(s);
});

// ─── Write PPTX package ────────────────────────────────────────────────────────
// Collect all unique image files used across slides
const allImgFiles = new Set();
allSlides.forEach(s => s.imgs.forEach(i => allImgFiles.add(i.file)));

// Create directory tree
[
  workDir, path.join(workDir,"_rels"), path.join(workDir,"docProps"),
  pptDir, path.join(pptDir,"_rels"),
  slidesDir, slideRelsDir, mediaDir,
  path.join(pptDir,"slideLayouts"), path.join(pptDir,"slideLayouts","_rels"),
  path.join(pptDir,"slideMasters"), path.join(pptDir,"slideMasters","_rels"),
  path.join(pptDir,"theme"),
].forEach(d => fs.mkdirSync(d, { recursive: true }));

// Copy images
allImgFiles.forEach(f => {
  const src = path.join(reportDir, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(mediaDir, f));
});

// Write slide XML
allSlides.forEach((s, i) => {
  fs.writeFileSync(path.join(slidesDir,  `slide${i+1}.xml`),      slideXml(s));
  fs.writeFileSync(path.join(slideRelsDir,`slide${i+1}.xml.rels`), relsXml(s));
});

// [Content_Types].xml
const overrides = allSlides.map((_,i) =>
  `  <Override PartName="/ppt/slides/slide${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
).join("\n");
fs.writeFileSync(path.join(workDir,"[Content_Types].xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Default Extension="png"  ContentType="image/png"/>
  <Override PartName="/docProps/app.xml"  ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
${overrides}
</Types>`);

// _rels/.rels
fs.writeFileSync(path.join(workDir,"_rels",".rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);

// docProps
fs.writeFileSync(path.join(workDir,"docProps","core.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Tank Inspection Copilot — Screen Design Review</dc:title>
  <dc:creator>Oscar</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-04-19T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-04-19T00:00:00Z</dcterms:modified>
</cp:coreProperties>`);

fs.writeFileSync(path.join(workDir,"docProps","app.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Tank Inspection Copilot</Application>
  <PresentationFormat>On-screen Show (16:9)</PresentationFormat>
  <Slides>${allSlides.length}</Slides>
</Properties>`);

// presentation.xml + rels
const pRels = [
  '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>',
  ...allSlides.map((_,i) => `  <Relationship Id="rId${i+2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i+1}.xml"/>`),
].join("\n");
fs.writeFileSync(path.join(pptDir,"_rels","presentation.xml.rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${pRels}
</Relationships>`);

const sldIds = allSlides.map((_,i) => `    <p:sldId id="${256+i}" r:id="rId${i+2}"/>`).join("\n");
fs.writeFileSync(path.join(pptDir,"presentation.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>
${sldIds}
  </p:sldIdLst>
  <p:sldSz cx="${SLIDE_CX}" cy="${SLIDE_CY}" type="wide"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:defaultTextStyle/>
</p:presentation>`);

// Slide master / layout / theme (minimal blanks)
fs.writeFileSync(path.join(pptDir,"slideMasters","_rels","slideMaster1.xml.rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`);

fs.writeFileSync(path.join(pptDir,"slideMasters","slideMaster1.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_CX}" cy="${SLIDE_CY}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_CX}" cy="${SLIDE_CY}"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
</p:sldMaster>`);

fs.writeFileSync(path.join(pptDir,"slideLayouts","_rels","slideLayout1.xml.rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`);

fs.writeFileSync(path.join(pptDir,"slideLayouts","slideLayout1.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_CX}" cy="${SLIDE_CY}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_CX}" cy="${SLIDE_CY}"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`);

fs.writeFileSync(path.join(pptDir,"theme","theme1.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="TankInspection">
  <a:themeElements>
    <a:clrScheme name="TankInspection">
      <a:dk1><a:srgbClr val="${C.ink}"/></a:dk1><a:lt1><a:srgbClr val="${C.white}"/></a:lt1>
      <a:dk2><a:srgbClr val="${C.dark}"/></a:dk2><a:lt2><a:srgbClr val="${C.bg}"/></a:lt2>
      <a:accent1><a:srgbClr val="${C.teal}"/></a:accent1><a:accent2><a:srgbClr val="${C.mint}"/></a:accent2>
      <a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Aptos"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme>
    <a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
  </a:themeElements>
  <a:objectDefaults/><a:extraClrSchemeLst/>
</a:theme>`);

// Pack everything into a zip / .pptx
if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
execSync(`cd "${workDir}" && zip -r "${outFile}" . -x "*.DS_Store"`, { stdio: "inherit" });

console.log("\nDone →", outFile);

import fs from "node:fs";
import path from "node:path";

const reportDir = process.cwd();
const docxDir = path.join(reportDir, "docx-work");
const wordDir = path.join(docxDir, "word");
const relsDir = path.join(wordDir, "_rels");
const mediaDir = path.join(wordDir, "media");
const packageRelsDir = path.join(docxDir, "_rels");

const generatedDate = "April 13, 2026";
const productName = "Tank Inspection Copilot";

const screenshots = [
  {
    file: "01-home.png",
    title: "Mobile Home",
    caption:
      "Entry screen with sync status, active draft context, and actions to start, resume, or view inspections.",
  },
  {
    file: "02-surface-overview.png",
    title: "Tank Overview and Surface Selection",
    caption:
      "Surface cards for bottom, shell, roof, annular ring, nozzle area, and weld zone with completion state.",
  },
  {
    file: "03-grid-location-picker-main.png",
    title: "Grid Map Location Picker",
    caption:
      "Primary location capture screen with plate IDs, repair overlays, prior defects, grid labels, disabled cells, and selected X/Y summary.",
  },
  {
    file: "04-location-confirmation-main.png",
    title: "Location Confirmation",
    caption:
      "Locked location review before defect typing, with location summary and a mini map preview.",
  },
  {
    file: "05-defect-type-main.png",
    title: "Defect Type Selection",
    caption:
      "Location-linked defect taxonomy picker for corrosion, crack, deformation, coating failure, leakage, weld defect, repair observation, or other.",
  },
  {
    file: "06-defect-details-main.png",
    title: "Defect Details",
    caption:
      "Structured defect details with subtype, severity, extent, and field note capture.",
  },
  {
    file: "07-measurements-main.png",
    title: "Measurement Capture",
    caption:
      "Dynamic measurement fields and defect-specific warning logic, shown here for corrosion without UT thickness.",
  },
  {
    file: "08-evidence-required-main.png",
    title: "Evidence Required",
    caption:
      "Evidence capture screen blocks save until at least one photo is attached.",
  },
  {
    file: "09-evidence-with-photo-main.png",
    title: "Evidence Attached",
    caption:
      "Mock photo evidence linked to tank, surface, and X/Y location, with delete control.",
  },
  {
    file: "10-defect-saved-main.png",
    title: "Defect Saved",
    caption:
      "Saved defect summary showing type, severity, location, photo count, and next actions.",
  },
  {
    file: "11-saved-defect-map-main.png",
    title: "Saved Defect Map",
    caption:
      "Surface map with saved defect marker, layer toggles, legend, and finish surface action.",
  },
  {
    file: "12-surface-review-main.png",
    title: "Surface Completion Review",
    caption:
      "Surface-level QA summary with defect count, photo count, grid size, status, and warnings.",
  },
  {
    file: "13-inspection-validation-main.png",
    title: "Inspection Validation",
    caption:
      "Whole-inspection QA blocks submission until required surfaces and defect records pass validation.",
  },
];

const capabilities = [
  "Mobile-only field workflow with single-column layout and large touch targets.",
  "Offline draft persistence through local storage with draft, unsynced, and synced status badges.",
  "Guided inspection setup for site, client, tank ID, inspection type, inspector, and date context.",
  "Surface selection for bottom, shell, roof, annular ring, nozzle area, and weld zone.",
  "Primary tap-on-grid location capture plus manual X/Y entry and plate ID fallback modes.",
  "SVG grid map with disabled cells outside circular tank footprint for bottom and roof surfaces.",
  "Shell view uses an unwrapped rectangular grid with lower-left origin behavior.",
  "Layer toggles for plate IDs, grid labels, prior defects, and repair overlays.",
  "Defect details capture for type, subtype, severity, extent, description, measurements, and photo evidence.",
  "Validation panels for missing photos, missing subtype, annular review, required surfaces, and invalid coordinates.",
  "Report-ready structured data model for InspectionSession, SurfaceInspection, GridLocation, DefectRecord, and EvidenceItem.",
];

const workflowPhases = [
  {
    phase: "Start",
    screens: "Home, Inspection Setup, Tank Overview",
    purpose: "Open or create the inspection draft and choose the tank surface.",
  },
  {
    phase: "Location",
    screens: "Location Mode, Grid Map, Manual X/Y, Plate ID, Location Confirmation",
    purpose: "Capture a repeatable surface, X, Y, grid ID, and optional plate ID.",
  },
  {
    phase: "Defect Capture",
    screens: "Defect Type, Defect Details, Measurements, Evidence",
    purpose: "Record defect type, severity, measurements, notes, and required photo evidence.",
  },
  {
    phase: "Review",
    screens: "Defect Saved, Surface Map, Surface Review",
    purpose: "Confirm the saved record, review spatial markers, and run surface-level QA.",
  },
  {
    phase: "Submit",
    screens: "Inspection Validation, Submission Success",
    purpose: "Run whole-inspection QA, block invalid submission, and close the workflow.",
  },
];

const screenDetails = [
  {
    screen: "Screen 01 - Home",
    purpose: "Entry point for the field engineer and quick access to the active draft.",
    functions: [
      "Shows app name, field capture context, and sync status badge.",
      "Shows active draft header with site, tank ID, inspection type, and inspector.",
      "Provides Start New Inspection, Resume Draft Inspection, and View Past Inspections actions.",
      "Shows open draft metrics for tank, defect count, and completed surfaces.",
      "Bottom navigation provides Home, Drafts, QA, and Settings access.",
    ],
    validation: "No blocking validation on this screen.",
    output: "Routes to Inspection Setup for a new inspection or Tank Overview for an existing draft.",
  },
  {
    screen: "Screen 02 - Inspection Setup",
    purpose: "Create or update the inspection context before location capture begins.",
    functions: [
      "Captures site, client, tank ID, and inspection type.",
      "Inspection type supports routine, external, internal, and special.",
      "Inspection date and inspector are treated as auto-filled context for the draft.",
      "Continue saves the inspection context and moves to Tank Overview.",
      "Save Draft writes the inspection context locally and returns to Home.",
    ],
    validation: "Continue is disabled until site, tank ID, and inspection type are present.",
    output: "Updates the InspectionSession object and sets sync status to unsynced.",
  },
  {
    screen: "Screen 03 - Tank Overview",
    purpose: "Select the inspectable surface for the next defect capture operation.",
    functions: [
      "Shows inspection header with site, tank ID, inspection type, and inspector.",
      "Lists bottom, shell, roof, annular ring, nozzle area, and weld zone.",
      "Each surface card includes a short operational description.",
      "Each surface card shows Not started, defect count, or Complete state.",
      "Selecting a surface initializes a default draft location for that surface.",
    ],
    validation: "No blocking validation on this screen.",
    output: "Routes to Location Mode Selection with the chosen surface.",
  },
  {
    screen: "Screen 04 - Location Mode Selection",
    purpose: "Let the engineer choose the most practical location capture method.",
    functions: [
      "Tap on Grid Map is marked as the recommended method.",
      "Manual X,Y Entry supports checklist-driven or difficult touch conditions.",
      "Plate ID Entry supports engineers working directly from a plate map drawing.",
      "Each option explains when to use the method.",
    ],
    validation: "No blocking validation on this screen.",
    output: "Routes to Grid Map Location Picker, Manual X,Y Entry, or Plate ID Picker.",
  },
  {
    screen: "Screen 05A - Grid Map Location Picker",
    purpose: "Primary location capture screen for selecting the exact X/Y partition.",
    functions: [
      "Displays tank header, surface name, and grid size such as 20 x 10.",
      "Renders an SVG rectangular grid with every valid cell tappable.",
      "Disables cells outside the valid circular footprint for bottom and roof surfaces.",
      "Shows the active origin convention: top-left for bottom/roof and lower-left for shell.",
      "Supports plate ID, grid label, prior defect, and repair overlay toggles.",
      "Highlights annular edge cells on the bottom surface.",
      "Highlights selected cell and updates X, Y, grid ID, and plate ID summary.",
      "Shows a map legend for annular, repair, and defect states.",
      "The scrollable SVG supports device browser zoom and pan behavior.",
    ],
    validation: "Confirm Location is disabled until a valid cell is selected.",
    output: "Creates a GridLocation with surface, x, y, gridId, optional plateId, locationMode, and isAnnular.",
  },
  {
    screen: "Screen 05B - Manual X,Y Entry",
    purpose: "Fallback location entry for known coordinates or poor map interaction conditions.",
    functions: [
      "Shows the selected surface as context.",
      "Captures X partition and Y partition as integer inputs.",
      "Provides a live valid or invalid partition message.",
      "Preview on Map returns to the grid map for visual confirmation.",
      "Confirm Location accepts only valid inspectable coordinates.",
    ],
    validation:
      "X and Y must be integers, within grid bounds, and inside the valid surface footprint.",
    output: "Creates the same GridLocation object as tap-on-grid mode with locationMode set to manual_xy.",
  },
  {
    screen: "Screen 05C - Plate ID Picker",
    purpose: "Capture location by plate number when working from a floor plate drawing.",
    functions: [
      "Searches available plate IDs by typed query.",
      "Shows plate cards with plate ID, subzone, and mapped X/Y coordinate.",
      "Selecting a plate auto-fills the mapped location.",
      "Show on Map returns to the grid map if the engineer wants visual confirmation.",
    ],
    validation: "Only listed mapped plates can be selected in the MVP.",
    output: "Creates a GridLocation with locationMode set to plate_id and the mapped plateId.",
  },
  {
    screen: "Screen 06 - Location Confirmation",
    purpose: "Lock the selected location before defect type and details are entered.",
    functions: [
      "Shows location summary for surface, X, Y, grid ID, and optional plate ID.",
      "Shows mini grid preview with the selected location highlighted.",
      "Use This Location advances to defect typing.",
      "Edit Location returns to the original location capture mode.",
    ],
    validation: "Use This Location is disabled if no location is available.",
    output: "Confirms the location for the draft defect record.",
  },
  {
    screen: "Screen 07 - Defect Type Selection",
    purpose: "Start a defect record linked to the confirmed location.",
    functions: [
      "Shows selected surface and grid ID in the screen subtitle.",
      "Offers corrosion, crack, deformation, coating failure, leakage, weld defect, patch/repair observation, and other.",
      "Each type is a large touch target for field use.",
    ],
    validation: "The user must select one defect type to continue.",
    output: "Stores defectType on the draft record and routes to Defect Details.",
  },
  {
    screen: "Screen 08 - Defect Detail Form",
    purpose: "Capture structured qualitative defect details.",
    functions: [
      "Shows defect type as the context heading.",
      "Captures subtype as free text.",
      "Captures severity as minor, moderate, or severe.",
      "Captures extent as single cell, multi-cell region, or edge/annular.",
      "Captures a concise description or field note.",
      "Supports Next: Measurements and Skip Measurements actions.",
    ],
    validation: "Next: Measurements requires defect type and severity.",
    output: "Updates draft defect subtype, severity, extent, and description.",
  },
  {
    screen: "Screen 09 - Measurement Capture",
    purpose: "Capture numeric NDE or visual measurement values when relevant.",
    functions: [
      "Captures measurement method.",
      "For cracks, captures crack length and crack width.",
      "For deformation, captures deformation dimension.",
      "For corrosion and other default cases, captures UT thickness, minimum thickness, and pit depth.",
      "Shows defect-specific warning text when important measurement values are missing.",
    ],
    validation:
      "Corrosion without UT/min thickness, crack without size, and deformation without dimension produce warnings.",
    output: "Updates the DefectMeasurement object and routes to Evidence.",
  },
  {
    screen: "Screen 10 - Evidence Capture",
    purpose: "Attach required proof to the defect before saving.",
    functions: [
      "Shows selected surface and grid ID as context.",
      "Provides Take Photo and Upload Photo actions in the MVP.",
      "Displays attached evidence in a gallery-style strip.",
      "Each evidence item is linked to surface, X, and Y metadata.",
      "Delete removes an attached evidence item before saving.",
      "The data model can represent photo, video, and audio evidence, but the current UI implements photo flows first.",
    ],
    validation: "Save Defect is disabled until at least one photo is attached.",
    output: "Creates evidence metadata and enables local defect save.",
  },
  {
    screen: "Screen 11 - Defect Saved Summary",
    purpose: "Confirm local save and let the engineer choose the next field action.",
    functions: [
      "Shows that the record is saved locally and queued for sync.",
      "Summarizes defect type, severity, location, and photo count.",
      "Add Another Defect keeps the same location context for rapid capture.",
      "Return to Surface Map shows spatial defect context.",
      "Finish Surface moves to surface completion review.",
    ],
    validation: "This screen is reached only after required defect fields and photo evidence pass save rules.",
    output: "Adds a DefectRecord to the active SurfaceInspection and sets sync status to unsynced.",
  },
  {
    screen: "Screen 12 - Surface Map with Saved Defects",
    purpose: "Review recorded defects spatially on the selected tank surface.",
    functions: [
      "Shows the selected surface map with saved defect markers on top of the grid.",
      "Shows the number of saved defects on the surface.",
      "Keeps plate ID, grid label, prior defect, and repair overlay toggles available.",
      "Provides Add New Defect and Finish Surface actions.",
      "Keeps annular, repair, and defect legend visible below the map.",
    ],
    validation: "No blocking validation on the map itself.",
    output: "Routes back to location capture for a new defect or to Surface Completion Review.",
  },
  {
    screen: "Screen 13 - Surface Completion Review",
    purpose: "Run surface-level QA before marking a surface complete.",
    functions: [
      "Summarizes defect count, photo count, grid size, and surface status.",
      "Shows validation panel for surface-specific warnings.",
      "Warns when saved defects are missing photos or subtype.",
      "Warns when bottom surface has no saved defects or no annular zone record.",
      "Go Back and Fix returns to the surface map.",
      "Mark Surface Complete marks the current surface complete and moves to inspection validation.",
    ],
    validation: "Warnings are shown for QA review; the current prototype still allows Mark Surface Complete.",
    output: "Updates the SurfaceInspection completed flag and sets sync status to unsynced.",
  },
  {
    screen: "Screen 14 - Inspection Validation",
    purpose: "Whole-inspection QA before submission.",
    functions: [
      "Shows all blocking inspection warnings in one validation panel.",
      "Checks required surfaces, currently bottom and shell.",
      "Checks defect photo requirement across saved defects.",
      "Checks saved defect locations against the surface grid validity rule.",
      "Shows readiness summaries for required surfaces, invalid coordinates, and photo requirement.",
      "Fix Issues returns to the tank overview.",
      "Submit Inspection is disabled until blocking warnings are resolved.",
    ],
    validation: "Submission is blocked if required surfaces are incomplete, defects have no photo, or defects have invalid coordinates.",
    output: "When valid, sets sync status to synced and routes to Submission Success.",
  },
  {
    screen: "Screen 15 - Submission Success",
    purpose: "Close the inspection workflow after a successful submit.",
    functions: [
      "Shows submitted state and report-ready dataset confirmation.",
      "View Defect Map returns to the saved defect map.",
      "Start Another Inspection creates a fresh session.",
      "Return Home goes back to the mobile home screen.",
    ],
    validation: "Only reachable after inspection validation allows submission.",
    output: "Ends the current workflow and leaves the dataset available for review.",
  },
];

const dataModel = [
  "InspectionSession: inspection ID, site, client, tank ID, inspection type, inspector, surfaces, and syncStatus.",
  "SurfaceInspection: surface type, grid columns, grid rows, completion state, and saved defects.",
  "GridLocation: surface, x, y, gridId, optional plateId, locationMode, and isAnnular.",
  "DefectRecord: inspection ID, tank ID, location, defect type, subtype, severity, extent, description, measurements, evidence, creator, and timestamp.",
  "EvidenceItem: local URI, type, timestamp, optional GPS, linked surface, linked X, and linked Y.",
];

const validationRules = [
  "Location requires a valid surface, X, and Y.",
  "Selected grid cells must be inside the valid tank footprint.",
  "Defect type is required.",
  "Severity is required.",
  "At least one photo is required before saving a defect.",
  "Corrosion without UT or minimum thickness produces a warning.",
  "Crack without length or width produces a warning.",
  "Deformation without dimension produces a warning.",
  "Submission is blocked when a required surface is incomplete, a saved defect has no photo, or a saved defect has an invalid location.",
];

const nextSteps = [
  "Freeze grid calibration rules per tank and surface.",
  "Define the source of plate ID to X/Y mapping from drawings like TK 201.",
  "Replace mock photo entries with real native camera and offline file storage.",
  "Add a durable sync queue with retry state per evidence item.",
  "Add region selection for multi-cell defects.",
  "Import prior repairs, replacements, and historical defects as map overlays.",
  "Move from browser localStorage to a mobile-grade persistence layer such as SQLite, AsyncStorage, or IndexedDB in a Capacitor shell.",
];

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function escapeHtml(value) {
  return escapeXml(value);
}

function pngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function mdList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function writeMarkdown() {
  const screenshotSections = screenshots
    .map(
      (shot, index) => `### Screenshot ${index + 1}: ${shot.title}

${shot.caption}

![${shot.title}](./${shot.file})`,
    )
    .join("\n\n");

  const screenSections = screenDetails
    .map(
      (screen) => `### ${screen.screen}

**Purpose:** ${screen.purpose}

**Functions and features:**
${mdList(screen.functions)}

**Validation:** ${screen.validation}

**Output:** ${screen.output}`,
    )
    .join("\n\n");

  const markdown = `# ${productName} Product Report

Generated: ${generatedDate}

## Executive Summary

${productName} is a mobile-first field data-capture app for tank inspection defects. It records each defect against a repeatable spatial coordinate using a flattened 2D matrix for tank surfaces. The current prototype focuses on the detailed location capture workflow: select tank context, choose a surface, tap or enter a location, capture defect details, attach required photo evidence, review validation warnings, and prepare a report-ready dataset.

The UI is intentionally mobile-only for this version. It uses a single-column app shell, large touch targets, offline draft persistence, unsynced status feedback, and a guided workflow suitable for field engineers working in restricted connectivity conditions.

## Product Scope

${mdList(capabilities)}

## At-a-Glance Workflow

| Phase | Screens | Purpose |
| --- | --- | --- |
${workflowPhases.map((item) => `| ${item.phase} | ${item.screens} | ${item.purpose} |`).join("\n")}

## Screenshot Gallery

${screenshotSections}

## Complete Screen-by-Screen Function and Feature Description

${screenSections}

## Location Capture Model

Each defect location is stored as a structured grid coordinate:

\`\`\`json
{
  "surface": "bottom",
  "x": 12,
  "y": 4,
  "gridId": "12-4",
  "plateId": "A12",
  "locationMode": "tap_map",
  "isAnnular": false
}
\`\`\`

Bottom and roof surfaces use a circular validity mask inside a rectangular grid abstraction. Shell, nozzle, and weld surfaces use rectangular unwrapped grids. The MVP uses integer partitions only.

## Data Model Summary

${mdList(dataModel)}

## Validation and Offline Behavior

${mdList(validationRules)}

Drafts are persisted locally in the browser prototype. Every draft change marks the inspection as unsynced. For a production mobile app, this should move to durable mobile storage with a sync queue for evidence files and retryable upload state.

## Recommended Next Steps

${nextSteps.map((step, index) => `${index + 1}. ${step}`).join("\n")}
`;

  fs.writeFileSync(path.join(reportDir, "product-report.md"), markdown);
}

function writeHtml() {
  const screenshotHtml = screenshots
    .map(
      (shot, index) => `<figure>
  <img src="./${escapeHtml(shot.file)}" alt="${escapeHtml(shot.title)}" />
  <figcaption><strong>Screenshot ${index + 1}: ${escapeHtml(shot.title)}</strong><br />${escapeHtml(shot.caption)}</figcaption>
</figure>`,
    )
    .join("\n");

  const screensHtml = screenDetails
    .map(
      (screen) => `<article class="screen-card">
  <h3>${escapeHtml(screen.screen)}</h3>
  <p><strong>Purpose:</strong> ${escapeHtml(screen.purpose)}</p>
  <p><strong>Functions and features:</strong></p>
  <ul>${screen.functions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  <p><strong>Validation:</strong> ${escapeHtml(screen.validation)}</p>
  <p><strong>Output:</strong> ${escapeHtml(screen.output)}</p>
</article>`,
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(productName)} Product Report</title>
    <style>
      :root {
        color: #17201e;
        background: #e8eeeb;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body { margin: 0; }
      main { max-width: 980px; margin: 0 auto; padding: 32px 18px 72px; }
      .cover, section, .screen-card {
        background: #ffffff;
        border: 1px solid #cbd8d4;
        border-radius: 8px;
        padding: 24px;
        margin: 18px 0;
      }
      .cover { border-top: 8px solid #075f5c; }
      .eyebrow { text-transform: uppercase; letter-spacing: 0; color: #075f5c; font-weight: 800; font-size: 13px; }
      h1 { margin: 8px 0 10px; font-size: clamp(30px, 6vw, 52px); line-height: 1.05; }
      h2 { margin: 0 0 14px; font-size: 26px; }
      h3 { margin: 0 0 10px; font-size: 20px; }
      p, li { line-height: 1.6; }
      .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 18px; }
      .meta div { background: #f4f7f6; border: 1px solid #cbd8d4; border-radius: 8px; padding: 12px; }
      .pill { display: inline-block; border: 1px solid #2f8f86; background: #dcefe9; border-radius: 8px; padding: 6px 10px; font-weight: 800; color: #075f5c; }
      .workflow-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
      .workflow-card { background: #f4f7f6; border: 1px solid #cbd8d4; border-radius: 8px; padding: 14px; }
      .workflow-card strong { color: #075f5c; font-size: 18px; }
      .workflow-card p { margin: 8px 0; font-weight: 700; }
      .workflow-card span { color: #33413d; line-height: 1.45; }
      .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; }
      figure { margin: 0; background: #f4f7f6; border: 1px solid #cbd8d4; border-radius: 8px; padding: 14px; }
      figure img { display: block; width: min(390px, 100%); margin: 0 auto 12px; border: 1px solid #cbd8d4; border-radius: 8px; background: #ffffff; }
      figcaption { color: #33413d; line-height: 1.45; }
      .screen-grid { display: grid; gap: 14px; }
      code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
      pre { overflow: auto; background: #f4f7f6; border: 1px solid #cbd8d4; border-radius: 8px; padding: 16px; }
    </style>
  </head>
  <body>
    <main>
      <div class="cover">
        <p class="eyebrow">Generated ${escapeHtml(generatedDate)}</p>
        <h1>${escapeHtml(productName)} Product Report</h1>
        <p class="pill">Mobile app UI prototype</p>
        <p>Complete product description for the tank inspection data-capture co-pilot, including screen functions, location capture behavior, evidence workflow, validation, offline behavior, and screenshots from the implemented mobile UI.</p>
        <div class="meta">
          <div><strong>Project</strong><br />tank-inspection-coplilot</div>
          <div><strong>Target device</strong><br />Mobile and tablet field use, single-column mobile shell in this prototype</div>
          <div><strong>Core workflow</strong><br />Tank setup -> surface -> grid location -> defect -> evidence -> validation</div>
        </div>
      </div>

      <section>
        <h2>Executive Summary</h2>
        <p>${escapeHtml(productName)} is a mobile-first field data-capture app for tank inspection defects. It records each defect against a repeatable spatial coordinate using a flattened 2D matrix for tank surfaces. The current prototype focuses on the detailed location capture workflow: select tank context, choose a surface, tap or enter a location, capture defect details, attach required photo evidence, review validation warnings, and prepare a report-ready dataset.</p>
        <p>The UI is intentionally mobile-only for this version. It uses a single-column app shell, large touch targets, offline draft persistence, unsynced status feedback, and a guided workflow suitable for field engineers working in restricted connectivity conditions.</p>
      </section>

      <section>
        <h2>Product Scope</h2>
        <ul>${capabilities.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>

      <section>
        <h2>At-a-Glance Workflow</h2>
        <div class="workflow-grid">
          ${workflowPhases
            .map(
              (item) => `<div class="workflow-card">
            <strong>${escapeHtml(item.phase)}</strong>
            <p>${escapeHtml(item.screens)}</p>
            <span>${escapeHtml(item.purpose)}</span>
          </div>`,
            )
            .join("")}
        </div>
      </section>

      <section>
        <h2>Screenshot Gallery</h2>
        <div class="gallery">${screenshotHtml}</div>
      </section>

      <section>
        <h2>Complete Screen-by-Screen Function and Feature Description</h2>
        <div class="screen-grid">${screensHtml}</div>
      </section>

      <section>
        <h2>Location Capture Model</h2>
        <pre><code>{
  "surface": "bottom",
  "x": 12,
  "y": 4,
  "gridId": "12-4",
  "plateId": "A12",
  "locationMode": "tap_map",
  "isAnnular": false
}</code></pre>
        <p>Bottom and roof surfaces use a circular validity mask inside a rectangular grid abstraction. Shell, nozzle, and weld surfaces use rectangular unwrapped grids. The MVP uses integer partitions only.</p>
      </section>

      <section>
        <h2>Data Model Summary</h2>
        <ul>${dataModel.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>

      <section>
        <h2>Validation and Offline Behavior</h2>
        <ul>${validationRules.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <p>Drafts are persisted locally in the browser prototype. Every draft change marks the inspection as unsynced. For a production mobile app, this should move to durable mobile storage with a sync queue for evidence files and retryable upload state.</p>
      </section>

      <section>
        <h2>Recommended Next Steps</h2>
        <ol>${nextSteps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
      </section>
    </main>
  </body>
</html>`;

  fs.writeFileSync(path.join(reportDir, "product-report.html"), html);
}

function p(text, options = {}) {
  const runs = Array.isArray(text) ? text : [{ text }];
  const pPr = options.pageBreakBefore ? '<w:pPr><w:pageBreakBefore/></w:pPr>' : "";
  return `<w:p>${pPr}${runs
    .map((run) => {
      const props = [];
      if (run.bold) props.push("<w:b/>");
      if (run.color) props.push(`<w:color w:val="${run.color}"/>`);
      if (run.size) props.push(`<w:sz w:val="${run.size}"/>`);
      if (run.font) props.push(`<w:rFonts w:ascii="${run.font}" w:hAnsi="${run.font}"/>`);
      const rPr = props.length ? `<w:rPr>${props.join("")}</w:rPr>` : "";
      return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(run.text)}</w:t></w:r>`;
    })
    .join("")}</w:p>`;
}

function heading(text, level = 2, options = {}) {
  const size = level === 1 ? "40" : level === 2 ? "30" : "24";
  const color = level === 1 ? "17201E" : "075F5C";
  return p([{ text, bold: true, size, color }], options);
}

function bullet(text) {
  return p(`- ${text}`);
}

function numbered(index, text) {
  return p(`${index}. ${text}`);
}

function table(rows) {
  const border =
    '<w:tblBorders><w:top w:val="single" w:sz="6" w:color="CBD8D4"/><w:left w:val="single" w:sz="6" w:color="CBD8D4"/><w:bottom w:val="single" w:sz="6" w:color="CBD8D4"/><w:right w:val="single" w:sz="6" w:color="CBD8D4"/><w:insideH w:val="single" w:sz="6" w:color="CBD8D4"/><w:insideV w:val="single" w:sz="6" w:color="CBD8D4"/></w:tblBorders>';
  const rowXml = rows
    .map(
      (row) => `<w:tr>${row
        .map((cell) => {
          const lines = Array.isArray(cell) ? cell : [cell];
          return `<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>${lines.map((line) => p(line)).join("")}</w:tc>`;
        })
        .join("")}</w:tr>`,
    )
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${border}</w:tblPr>${rowXml}</w:tbl>`;
}

function imageXml(shot, relId, docPrId) {
  const imagePath = path.join(reportDir, shot.file);
  const { width, height } = pngSize(imagePath);
  const targetWidth = Math.round(2.55 * 914400);
  const targetHeight = Math.round(targetWidth * (height / width));
  return `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${targetWidth}" cy="${targetHeight}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docPrId}" name="${escapeXml(shot.title)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${escapeXml(shot.file)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${targetWidth}" cy="${targetHeight}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function writeDocxParts() {
  fs.mkdirSync(mediaDir, { recursive: true });
  fs.mkdirSync(relsDir, { recursive: true });
  fs.mkdirSync(packageRelsDir, { recursive: true });

  screenshots.forEach((shot) => {
    fs.copyFileSync(path.join(reportDir, shot.file), path.join(mediaDir, shot.file));
  });

  const body = [];
  body.push(heading(productName, 1));
  body.push(p([{ text: "Product Report", bold: true, size: "30", color: "075F5C" }]));
  body.push(p(`Generated: ${generatedDate}`));
  body.push(p("Project: tank-inspection-coplilot"));
  body.push(p("Target: mobile and tablet field use; this prototype is implemented as a mobile-only single-column UI."));
  body.push(p("Core workflow: tank setup -> surface -> grid location -> defect -> evidence -> validation."));

  body.push(heading("Executive Summary", 2));
  body.push(p(`${productName} is a mobile-first field data-capture app for tank inspection defects. It records each defect against a repeatable spatial coordinate using a flattened 2D matrix for tank surfaces.`));
  body.push(p("The current prototype focuses on the detailed location capture workflow: select tank context, choose a surface, tap or enter a location, capture defect details, attach required photo evidence, review validation warnings, and prepare a report-ready dataset."));

  body.push(heading("Product Scope", 2));
  capabilities.forEach((item) => body.push(bullet(item)));

  body.push(heading("At-a-Glance Workflow", 2));
  body.push(
    table([
      ["Phase", "Screens", "Purpose"],
      ...workflowPhases.map((item) => [item.phase, item.screens, item.purpose]),
    ]),
  );

  body.push(heading("Screenshot Gallery", 2, { pageBreakBefore: true }));
  screenshots.forEach((shot, index) => {
    body.push(heading(`Screenshot ${index + 1}: ${shot.title}`, 3));
    body.push(p(shot.caption));
    body.push(imageXml(shot, `rIdImage${index + 1}`, index + 1));
  });

  body.push(heading("Complete Screen-by-Screen Function and Feature Description", 2, { pageBreakBefore: true }));
  screenDetails.forEach((screen) => {
    body.push(heading(screen.screen, 3));
    body.push(p([{ text: "Purpose: ", bold: true }, { text: screen.purpose }]));
    body.push(p([{ text: "Functions and features:", bold: true }]));
    screen.functions.forEach((item) => body.push(bullet(item)));
    body.push(p([{ text: "Validation: ", bold: true }, { text: screen.validation }]));
    body.push(p([{ text: "Output: ", bold: true }, { text: screen.output }]));
  });

  body.push(heading("Location Capture Model", 2, { pageBreakBefore: true }));
  body.push(p("Each defect location is stored as a structured grid coordinate:"));
  body.push(p('{ "surface": "bottom", "x": 12, "y": 4, "gridId": "12-4", "plateId": "A12", "locationMode": "tap_map", "isAnnular": false }'));
  body.push(p("Bottom and roof surfaces use a circular validity mask inside a rectangular grid abstraction. Shell, nozzle, and weld surfaces use rectangular unwrapped grids. The MVP uses integer partitions only."));

  body.push(heading("Data Model Summary", 2));
  dataModel.forEach((item) => body.push(bullet(item)));

  body.push(heading("Validation and Offline Behavior", 2));
  validationRules.forEach((item) => body.push(bullet(item)));
  body.push(p("Drafts are persisted locally in the browser prototype. Every draft change marks the inspection as unsynced. For a production mobile app, this should move to durable mobile storage with a sync queue for evidence files and retryable upload state."));

  body.push(heading("Recommended Next Steps", 2));
  nextSteps.forEach((item, index) => body.push(numbered(index + 1, item)));

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
  mc:Ignorable="w14 wp14">
  <w:body>
    ${body.join("\n")}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="720" w:right="900" w:bottom="720" w:left="900" w:header="450" w:footer="450" w:gutter="0"/>
      <w:cols w:space="720"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${screenshots.map((shot, index) => `  <Relationship Id="rIdImage${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${escapeXml(shot.file)}"/>`).join("\n")}
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const packageRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  fs.writeFileSync(path.join(wordDir, "document.xml"), documentXml);
  fs.writeFileSync(path.join(relsDir, "document.xml.rels"), documentRels);
  fs.writeFileSync(path.join(docxDir, "[Content_Types].xml"), contentTypes);
  fs.writeFileSync(path.join(packageRelsDir, ".rels"), packageRels);
}

writeMarkdown();
writeHtml();
writeDocxParts();

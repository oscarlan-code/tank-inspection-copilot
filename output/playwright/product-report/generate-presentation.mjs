import fs from "node:fs";
import path from "node:path";

const reportDir = process.cwd();
const workDir = path.join(reportDir, "pptx-work");
const pptDir = path.join(workDir, "ppt");
const slidesDir = path.join(pptDir, "slides");
const slideRelsDir = path.join(slidesDir, "_rels");
const mediaDir = path.join(pptDir, "media");
const outFile = path.join(reportDir, "product-report-presentation.pptx");

const EMU = 914400;
const W = 13.333333;
const H = 7.5;
const SLIDE_CX = 12192000;
const SLIDE_CY = 6858000;

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
  red: "B42318",
  orange: "F2C078",
};

const screenshots = [
  ["01-home.png", "Mobile Home"],
  ["02-surface-overview.png", "Tank Overview"],
  ["03-grid-location-picker-main.png", "Grid Map Picker"],
  ["04-location-confirmation-main.png", "Location Confirmation"],
  ["05-defect-type-main.png", "Defect Type"],
  ["06-defect-details-main.png", "Defect Details"],
  ["07-measurements-main.png", "Measurements"],
  ["08-evidence-required-main.png", "Evidence Required"],
  ["09-evidence-with-photo-main.png", "Evidence Attached"],
  ["10-defect-saved-main.png", "Defect Saved"],
  ["11-saved-defect-map-main.png", "Saved Defect Map"],
  ["12-surface-review-main.png", "Surface Review"],
  ["13-inspection-validation-main.png", "Inspection Validation"],
];

const phases = [
  ["Start", "Home, setup, tank overview", "Open or create draft and select surface."],
  ["Location", "Mode, grid, manual, plate, confirm", "Capture surface, X, Y, grid ID, plate ID."],
  ["Defect", "Type, details, measurements, evidence", "Record defect facts and proof."],
  ["Review", "Saved, map, surface review", "Inspect spatial records and warnings."],
  ["Submit", "Validation, success", "Block invalid submission and close workflow."],
];

const screenInventory = [
  ["01 Home", "Start/resume draft, show sync status and field context."],
  ["02 Inspection Setup", "Capture site, client, tank ID, inspection type, date, inspector."],
  ["03 Tank Overview", "Choose bottom, shell, roof, annular, nozzle, or weld surface."],
  ["04 Location Mode", "Choose tap map, manual X/Y, or plate ID mode."],
  ["05A Grid Map", "Tap valid grid cell, view overlays, confirm X/Y summary."],
  ["05B Manual X/Y", "Validate typed integer coordinates against bounds and footprint."],
  ["05C Plate ID", "Search mapped plate ID and auto-fill X/Y."],
  ["06 Confirm Location", "Lock surface, X, Y, grid ID, and optional plate before typing."],
  ["07 Defect Type", "Select corrosion, crack, deformation, leakage, weld defect, repair, or other."],
  ["08 Defect Details", "Capture subtype, severity, extent, and description."],
  ["09 Measurements", "Capture UT, pit depth, crack size, or deformation dimension."],
  ["10 Evidence", "Attach required photo, show linked metadata, enable save."],
  ["11 Defect Saved", "Summarize local record and choose next field action."],
  ["12 Surface Map", "Review saved markers, overlays, legend, and add more defects."],
  ["13 Surface Review", "Show surface metrics and warnings before completion."],
  ["14 Inspection Validation", "Block submission for incomplete surfaces, no photo, invalid location."],
  ["15 Submission Success", "Confirm report-ready dataset and offer next actions."],
];

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function emu(inches) {
  return Math.round(inches * EMU);
}

function pngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function ensureDirs() {
  [
    workDir,
    path.join(workDir, "_rels"),
    path.join(workDir, "docProps"),
    pptDir,
    path.join(pptDir, "_rels"),
    slidesDir,
    slideRelsDir,
    mediaDir,
    path.join(pptDir, "slideLayouts"),
    path.join(pptDir, "slideLayouts", "_rels"),
    path.join(pptDir, "slideMasters"),
    path.join(pptDir, "slideMasters", "_rels"),
    path.join(pptDir, "theme"),
  ].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

  screenshots.forEach(([file]) => {
    fs.copyFileSync(path.join(reportDir, file), path.join(mediaDir, file));
  });
}

function fitImage(file, x, y, maxW, maxH) {
  const { width, height } = pngSize(path.join(reportDir, file));
  const aspect = width / height;
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  return { x: x + (maxW - w) / 2, y: y + (maxH - h) / 2, w, h };
}

function slideBase() {
  return {
    elements: [],
    images: [],
    id: 2,
    addRect(x, y, w, h, opts = {}) {
      this.elements.push({ type: "rect", id: this.id++, x, y, w, h, opts });
    },
    addText(text, x, y, w, h, opts = {}) {
      this.elements.push({ type: "text", id: this.id++, text, x, y, w, h, opts });
    },
    addImage(file, x, y, w, h, opts = {}) {
      const relId = `rId${this.images.length + 2}`;
      this.images.push({ file, relId });
      this.elements.push({ type: "image", id: this.id++, file, relId, x, y, w, h, opts });
    },
    addImageFit(file, x, y, maxW, maxH, opts = {}) {
      const pos = fitImage(file, x, y, maxW, maxH);
      if (opts.frame !== false) {
        this.addRect(pos.x - 0.08, pos.y - 0.08, pos.w + 0.16, pos.h + 0.16, {
          fill: C.white,
          line: C.line,
        });
      }
      this.addImage(file, pos.x, pos.y, pos.w, pos.h, opts);
    },
  };
}

function title(slide, text, subtitle) {
  slide.addText(text, 0.55, 0.34, 7.6, 0.42, { fontSize: 24, bold: true, color: C.teal });
  if (subtitle) slide.addText(subtitle, 0.56, 0.82, 7.6, 0.34, { fontSize: 10.5, color: C.muted });
  slide.addRect(0.55, 1.22, 12.2, 0.02, { fill: C.line, line: C.line });
}

function card(slide, x, y, w, h, headingText, bodyLines, opts = {}) {
  slide.addRect(x, y, w, h, { fill: opts.fill ?? C.white, line: opts.line ?? C.line });
  slide.addText(headingText, x + 0.18, y + 0.14, w - 0.36, 0.3, {
    fontSize: opts.headingSize ?? 13,
    bold: true,
    color: opts.headingColor ?? C.teal,
  });
  slide.addText(bodyLines, x + 0.18, y + 0.55, w - 0.36, h - 0.65, {
    fontSize: opts.fontSize ?? 10.5,
    color: opts.color ?? C.ink,
    lineSpacing: opts.lineSpacing ?? 1.1,
  });
}

function bulletLines(items) {
  return items.map((item) => `- ${item}`);
}

function textRuns(text, opts) {
  const color = opts.color ?? C.ink;
  const size = Math.round((opts.fontSize ?? 12) * 100);
  const bold = opts.bold ? ' b="1"' : "";
  return `<a:r><a:rPr lang="en-US" sz="${size}"${bold}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr><a:t>${esc(text)}</a:t></a:r>`;
}

function textBody(text, opts = {}) {
  const lines = Array.isArray(text) ? text : String(text).split("\n");
  const anchor = opts.valign === "mid" ? "ctr" : "t";
  return `<p:txBody><a:bodyPr wrap="square" anchor="${anchor}" lIns="${emu(0.08)}" tIns="${emu(0.04)}" rIns="${emu(0.08)}" bIns="${emu(0.04)}"/><a:lstStyle/>${lines
    .map((line, index) => {
      const isHeading = opts.boldFirst && index === 0;
      const pOpts = { ...opts, bold: opts.bold || isHeading, fontSize: isHeading ? (opts.headingFontSize ?? opts.fontSize ?? 12) : opts.fontSize };
      return `<a:p><a:pPr algn="${opts.align ?? "l"}"/><a:r>${textRuns(line, pOpts).match(/<a:r>(.*)<\/a:r>/s)?.[1] ?? ""}</a:r><a:endParaRPr lang="en-US"/></a:p>`;
    })
    .join("")}</p:txBody>`;
}

function shapeXml(el) {
  const opts = el.opts ?? {};
  const fill = opts.fill ? `<a:solidFill><a:srgbClr val="${opts.fill}"/></a:solidFill>` : opts.noFill ? "<a:noFill/>" : "<a:noFill/>";
  const line = opts.line ? `<a:ln w="${opts.lineWidth ?? 9525}"><a:solidFill><a:srgbClr val="${opts.line}"/></a:solidFill></a:ln>` : "<a:ln><a:noFill/></a:ln>";
  const tx = el.type === "text" ? textBody(el.text, opts) : "";
  return `<p:sp><p:nvSpPr><p:cNvPr id="${el.id}" name="${esc(opts.name ?? "Shape")}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(el.x)}" y="${emu(el.y)}"/><a:ext cx="${emu(el.w)}" cy="${emu(el.h)}"/></a:xfrm><a:prstGeom prst="${opts.round ? "roundRect" : "rect"}"><a:avLst/></a:prstGeom>${fill}${line}</p:spPr>${tx}</p:sp>`;
}

function imageXml(el) {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${el.id}" name="${esc(el.file)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${el.relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${emu(el.x)}" y="${emu(el.y)}"/><a:ext cx="${emu(el.w)}" cy="${emu(el.h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln><a:solidFill><a:srgbClr val="${C.line}"/></a:solidFill></a:ln></p:spPr></p:pic>`;
}

function slideXml(slide) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="${C.bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_CX}" cy="${SLIDE_CY}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_CX}" cy="${SLIDE_CY}"/></a:xfrm></p:grpSpPr>
      ${slide.elements.map((el) => (el.type === "image" ? imageXml(el) : shapeXml(el))).join("\n")}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function slideRels(slide) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
${slide.images.map((image) => `  <Relationship Id="${image.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${esc(image.file)}"/>`).join("\n")}
</Relationships>`;
}

function addFooter(slide, index) {
  slide.addText("Tank Inspection Copilot", 0.56, 7.12, 3.0, 0.22, { fontSize: 8.5, color: C.muted });
  slide.addText(String(index), 12.35, 7.12, 0.4, 0.22, { fontSize: 8.5, color: C.muted, align: "r" });
}

const slides = [];
function makeSlide(build) {
  const s = slideBase();
  build(s);
  slides.push(s);
}

makeSlide((s) => {
  s.addRect(0, 0, W, H, { fill: C.bg, line: C.bg });
  s.addRect(0, 0, 0.16, H, { fill: C.teal, line: C.teal });
  s.addText("Tank Inspection Copilot", 0.65, 0.75, 6.2, 0.65, { fontSize: 28, bold: true, color: C.ink });
  s.addText("Mobile app UI product report", 0.68, 1.48, 5.4, 0.34, { fontSize: 13, color: C.teal, bold: true });
  s.addText("16:9 presentation deck generated from the Word report and mobile UI screenshots.", 0.68, 2.02, 5.7, 0.55, { fontSize: 12, color: C.muted });
  card(s, 0.68, 3.05, 5.4, 1.55, "Core idea", ["Flatten each tank surface into a 2D matrix.", "Record every defect by surface, X, Y, optional plate ID, severity, and photo evidence."], { fill: C.white });
  card(s, 0.68, 4.86, 5.4, 1.25, "Audience", ["Field engineers capturing API 653-style tank inspection records in unreliable connectivity conditions."], { fill: C.white });
  s.addImageFit("03-grid-location-picker-main.png", 7.25, 0.65, 2.45, 6.15);
  s.addImageFit("10-defect-saved-main.png", 10.15, 1.15, 2.25, 5.1);
});

makeSlide((s) => {
  title(s, "Executive Summary", "What the prototype is designed to prove");
  card(s, 0.65, 1.55, 3.8, 2.05, "Problem", ["Inspection defects need repeatable, report-ready spatial locations.", "Paper notes and photos are hard to reconcile later."], { fill: C.white });
  card(s, 4.75, 1.55, 3.8, 2.05, "Solution", ["A guided mobile workflow captures tank, surface, X/Y grid location, defect details, and required evidence."], { fill: C.white });
  card(s, 8.85, 1.55, 3.8, 2.05, "MVP focus", ["Location capture first.", "Defect inventory and evidence linkage before CAD export or automatic detection."], { fill: C.white });
  card(s, 0.65, 4.05, 5.8, 1.7, "Designed for field use", ["- Offline draft persistence", "- Large touch targets", "- Minimal typing", "- Clear validation before submit"], { fill: C.mint });
  card(s, 6.85, 4.05, 5.8, 1.7, "Report-ready output", ["- Surface, X, Y, grid ID", "- Optional plate ID", "- Defect type and severity", "- Measurements and evidence metadata"], { fill: C.yellow });
  addFooter(s, 2);
});

makeSlide((s) => {
  title(s, "At-a-Glance Workflow", "From inspection setup to report-ready defect dataset");
  phases.forEach((phase, idx) => {
    const x = 0.65 + idx * 2.5;
    card(s, x, 1.6, 2.22, 3.55, phase[0], [phase[1], "", phase[2]], {
      fill: idx % 2 === 0 ? C.white : C.mint,
      headingSize: 14,
      fontSize: 10.2,
    });
    if (idx < phases.length - 1) s.addText(">", x + 2.25, 3.1, 0.2, 0.25, { fontSize: 13, bold: true, color: C.teal });
  });
  s.addText("Workflow states: Home - Setup - Overview - Location Mode - Map / Manual / Plate - Confirm - Type - Details - Measurements - Evidence - Saved - Surface Map - Surface Review - Validation - Success", 0.75, 6.1, 11.8, 0.5, { fontSize: 10.5, color: C.muted });
  addFooter(s, 3);
});

makeSlide((s) => {
  title(s, "Mobile UX Principles", "The design is intentionally practical rather than fancy");
  card(s, 0.65, 1.55, 3.0, 2.05, "Mobile only", ["Single-column flow.", "Large primary buttons.", "Short screen tasks."], { fill: C.white });
  card(s, 3.92, 1.55, 3.0, 2.05, "Offline first", ["Local draft save.", "Unsynced badge.", "Resume after restart."], { fill: C.white });
  card(s, 7.19, 1.55, 3.0, 2.05, "Grid location", ["Tap X/Y cell.", "Validate footprint.", "Show origin and plate ID."], { fill: C.white });
  card(s, 10.46, 1.55, 2.2, 2.05, "QA", ["Photo required.", "Missing data warnings.", "Blocked submit."], { fill: C.white });
  s.addImageFit("01-home.png", 1.0, 4.05, 2.1, 2.6);
  s.addImageFit("03-grid-location-picker.png", 3.6, 4.05, 2.1, 2.6);
  s.addImageFit("08-evidence-required-main.png", 6.2, 4.05, 2.1, 2.6);
  s.addImageFit("13-inspection-validation-main.png", 8.8, 4.05, 2.1, 2.6);
  addFooter(s, 4);
});

makeSlide((s) => {
  title(s, "Start Screens: 01-03", "Home, setup context, and surface selection");
  s.addImageFit("01-home.png", 0.8, 1.55, 2.4, 5.25);
  s.addImageFit("02-surface-overview.png", 3.65, 1.55, 2.4, 5.25);
  card(s, 6.75, 1.55, 5.8, 1.45, "01 Home", ["Start new inspection, resume draft, view past inspections, show sync status and draft metrics."], { fill: C.white });
  card(s, 6.75, 3.25, 5.8, 1.45, "02 Inspection Setup", ["Capture site, client, tank ID, inspection type; continue only after required fields are present."], { fill: C.white });
  card(s, 6.75, 4.95, 5.8, 1.45, "03 Tank Overview", ["Choose bottom, shell, roof, annular, nozzle, or weld zone; show complete/not started/defect count."], { fill: C.white });
  addFooter(s, 5);
});

makeSlide((s) => {
  title(s, "Location Screens: 04-06", "Primary spatial capture and confirmation");
  s.addImageFit("03-grid-location-picker-main.png", 0.8, 1.45, 2.45, 5.75);
  s.addImageFit("04-location-confirmation-main.png", 3.65, 1.45, 2.35, 5.75);
  card(s, 6.75, 1.55, 5.8, 1.3, "04 Location Mode", ["Choose tap-on-grid, manual X/Y entry, or plate ID entry. Tap-on-grid is the recommended path."], { fill: C.white });
  card(s, 6.75, 3.08, 5.8, 1.7, "05A Grid Map Picker", ["SVG grid, disabled outside-tank cells, origin label, annular band, layer toggles, selected X/Y summary."], { fill: C.mint });
  card(s, 6.75, 5.02, 5.8, 1.35, "06 Confirm Location", ["Lock surface, X, Y, grid ID, and plate ID before defect typing. Edit returns to the selected location mode."], { fill: C.white });
  addFooter(s, 6);
});

makeSlide((s) => {
  title(s, "Fallback Location Modes", "Manual entry and plate ID support field realities");
  card(s, 0.75, 1.45, 5.75, 2.1, "05B Manual X,Y Entry", bulletLines(["Input X and Y integer partitions.", "Live validation checks bounds and tank footprint.", "Preview on map for visual confirmation.", "Creates same GridLocation as tap mode."]), { fill: C.white });
  card(s, 6.85, 1.45, 5.75, 2.1, "05C Plate ID Picker", bulletLines(["Search known plate IDs from the drawing map.", "Plate cards show plate ID, subzone, and mapped X/Y.", "Selection auto-fills plateId and grid coordinates.", "Show on Map supports visual confirmation."]), { fill: C.white });
  card(s, 0.75, 4.2, 11.85, 1.55, "MVP location object", ['{ surface: "bottom", x: 12, y: 4, gridId: "12-4", plateId: "A12", locationMode: "tap_map", isAnnular: false }'], { fill: C.mint, fontSize: 12 });
  addFooter(s, 7);
});

makeSlide((s) => {
  title(s, "Grid Map Behavior", "The highest-value interaction in the product");
  s.addImageFit("03-grid-location-picker-main.png", 0.8, 1.35, 3.0, 5.85);
  card(s, 4.35, 1.45, 3.85, 2.0, "Selectable cells", bulletLines(["Rectangular grid abstraction.", "Bottom and roof use circular validity mask.", "Shell uses full unwrapped rectangle.", "Invalid cells are disabled."]), { fill: C.white });
  card(s, 8.55, 1.45, 3.85, 2.0, "Useful overlays", bulletLines(["Plate IDs.", "Grid labels.", "Prior defects.", "Repair overlay.", "Annular band border."]), { fill: C.white });
  card(s, 4.35, 4.05, 3.85, 1.65, "On tap", bulletLines(["Selected cell highlights strongly.", "Footer updates X, Y, grid ID, plate ID.", "Confirm enables only for valid cells."]), { fill: C.mint });
  card(s, 8.55, 4.05, 3.85, 1.65, "Coordinate convention", bulletLines(["Bottom/roof origin: top-left.", "Shell origin: lower-left.", "MVP uses integer partitions only."]), { fill: C.yellow });
  addFooter(s, 8);
});

makeSlide((s) => {
  title(s, "Defect Capture: 07-09", "Select type, add details, capture measurements");
  s.addImageFit("05-defect-type-main.png", 0.75, 1.45, 2.2, 4.95);
  s.addImageFit("06-defect-details-main.png", 3.3, 1.45, 2.2, 4.95);
  s.addImageFit("07-measurements-main.png", 5.85, 1.45, 2.2, 4.95);
  card(s, 8.65, 1.55, 3.85, 1.3, "07 Defect Type", ["Large type buttons tied to confirmed location."], { fill: C.white });
  card(s, 8.65, 3.1, 3.85, 1.35, "08 Details", ["Subtype, severity, extent, and description. Severity is required before measurements."], { fill: C.white });
  card(s, 8.65, 4.7, 3.85, 1.35, "09 Measurements", ["Dynamic fields for corrosion, crack, or deformation. Missing key values produce warnings."], { fill: C.mint });
  addFooter(s, 9);
});

makeSlide((s) => {
  title(s, "Evidence Capture: 10", "Required photo proof before saving a defect");
  s.addImageFit("08-evidence-required-main.png", 1.0, 1.55, 2.4, 5.15);
  s.addImageFit("09-evidence-with-photo-main.png", 3.85, 1.55, 2.4, 5.15);
  card(s, 7.0, 1.55, 5.55, 1.45, "Before photo", ["Save Defect is blocked and the user sees a clear validation message."], { fill: C.yellow });
  card(s, 7.0, 3.25, 5.55, 1.45, "After photo", ["Evidence card is linked to the selected surface and X/Y location. Delete remains available before save."], { fill: C.white });
  card(s, 7.0, 4.95, 5.55, 1.25, "Production note", ["The data model supports photo, video, and audio. The MVP UI implements photo first."], { fill: C.mint });
  addFooter(s, 10);
});

makeSlide((s) => {
  title(s, "Review Screens: 11-13", "Local save, spatial review, and surface QA");
  s.addImageFit("10-defect-saved-main.png", 0.65, 1.45, 2.1, 5.05);
  s.addImageFit("11-saved-defect-map-main.png", 3.05, 1.45, 2.1, 5.05);
  s.addImageFit("12-surface-review-main.png", 5.45, 1.45, 2.1, 5.05);
  card(s, 8.1, 1.55, 4.35, 1.25, "11 Defect Saved", ["Shows type, severity, location, photo count, and next field action."], { fill: C.white });
  card(s, 8.1, 3.05, 4.35, 1.35, "12 Surface Map", ["Saved defects render as map markers. Engineer can add another defect or finish the surface."], { fill: C.white });
  card(s, 8.1, 4.65, 4.35, 1.35, "13 Surface Review", ["Summarizes defects/photos/grid and surfaces warnings such as missing subtype or annular review."], { fill: C.mint });
  addFooter(s, 11);
});

makeSlide((s) => {
  title(s, "Inspection Validation: 14-15", "Submission is blocked until required QA passes");
  s.addImageFit("13-inspection-validation-main.png", 1.0, 1.45, 2.65, 5.55);
  card(s, 4.3, 1.55, 3.8, 1.6, "14 Validation", bulletLines(["Required surface completion.", "Photo requirement.", "Invalid coordinate checks.", "Fix Issues route."]), { fill: C.white });
  card(s, 8.45, 1.55, 3.8, 1.6, "Submit blocking", ["Submit Inspection is disabled while blocking warnings exist."], { fill: C.yellow });
  card(s, 4.3, 3.85, 3.8, 1.55, "15 Success", ["When valid, sync status changes to synced and the workflow closes with a report-ready dataset."], { fill: C.white });
  card(s, 8.45, 3.85, 3.8, 1.55, "Next actions", ["View Defect Map, Start Another Inspection, or Return Home."], { fill: C.mint });
  addFooter(s, 12);
});

makeSlide((s) => {
  title(s, "Data Model", "Report-ready records, not just screenshots");
  const items = [
    ["InspectionSession", "site, client, tankId, type, inspector, surfaces, syncStatus"],
    ["SurfaceInspection", "surface, gridCols, gridRows, completed, defects"],
    ["GridLocation", "surface, x, y, gridId, plateId, locationMode, isAnnular"],
    ["DefectRecord", "location, type, subtype, severity, extent, description, measurements, evidence"],
    ["EvidenceItem", "uri, timestamp, optional GPS, linked surface, linked X/Y"],
  ];
  items.forEach((item, idx) => {
    const x = idx % 2 === 0 ? 0.75 : 6.85;
    const y = 1.45 + Math.floor(idx / 2) * 1.55;
    card(s, x, y, idx === 4 ? 11.85 : 5.6, 1.1, item[0], [item[1]], { fill: idx === 2 ? C.mint : C.white, fontSize: 10.5 });
  });
  addFooter(s, 13);
});

makeSlide((s) => {
  title(s, "Validation Logic", "What prevents poor field data");
  const left = bulletLines([
    "Location requires surface, X, and Y.",
    "Selected cell must be inside valid surface footprint.",
    "Defect type and severity are required.",
    "At least one photo is required before save.",
    "Manual X/Y must be integer and inside bounds.",
  ]);
  const right = bulletLines([
    "Corrosion without UT/min thickness produces warning.",
    "Crack without size produces warning.",
    "Deformation without dimension produces warning.",
    "Required surfaces must be complete.",
    "Submit blocks invalid coordinates or missing photos.",
  ]);
  card(s, 0.8, 1.5, 5.8, 4.5, "Record-level checks", left, { fill: C.white, fontSize: 12 });
  card(s, 6.9, 1.5, 5.6, 4.5, "Review and submission checks", right, { fill: C.white, fontSize: 12 });
  addFooter(s, 14);
});

makeSlide((s) => {
  title(s, "Screen Inventory Appendix: 01-05C", "Every screen in the workflow is accounted for");
  screenInventory.slice(0, 7).forEach((item, idx) => {
    card(s, idx < 4 ? 0.75 : 6.75, 1.35 + (idx % 4) * 1.32, 5.55, 1.02, item[0], [item[1]], { fill: idx % 2 === 0 ? C.white : C.mint, fontSize: 9.2, headingSize: 11 });
  });
  addFooter(s, 15);
});

makeSlide((s) => {
  title(s, "Screen Inventory Appendix: 06-10", "Confirmed location through evidence capture");
  screenInventory.slice(7, 12).forEach((item, idx) => {
    card(s, idx < 3 ? 0.75 : 6.75, 1.45 + (idx % 3) * 1.55, 5.55, 1.18, item[0], [item[1]], { fill: idx % 2 === 0 ? C.white : C.mint, fontSize: 9.5, headingSize: 11.5 });
  });
  addFooter(s, 16);
});

makeSlide((s) => {
  title(s, "Screen Inventory Appendix: 11-15", "Review, validation, and closing workflow");
  screenInventory.slice(12).forEach((item, idx) => {
    card(s, idx < 3 ? 0.75 : 6.75, 1.45 + (idx % 3) * 1.55, 5.55, 1.18, item[0], [item[1]], { fill: idx % 2 === 0 ? C.white : C.mint, fontSize: 9.5, headingSize: 11.5 });
  });
  addFooter(s, 17);
});

makeSlide((s) => {
  title(s, "Recommended Next Steps", "Implementation decisions to lock before production mobile work");
  card(s, 0.75, 1.45, 5.6, 4.9, "Product decisions", bulletLines(["Freeze grid calibration rules by tank and surface.", "Define plate ID to X/Y mapping source from TK 201 drawings.", "Decide which surfaces are required for each inspection type.", "Define how annular review is represented when no defect is found."]), { fill: C.white, fontSize: 11.5 });
  card(s, 6.85, 1.45, 5.6, 4.9, "Technical work", bulletLines(["Replace mock photos with native camera and offline file storage.", "Add durable sync queue with retry state.", "Add multi-cell region selection.", "Import prior repairs and historical defects as overlays.", "Move persistence from localStorage to mobile-grade storage."]), { fill: C.white, fontSize: 11.5 });
  addFooter(s, 18);
});

function writeSlides() {
  slides.forEach((slide, index) => {
    const number = index + 1;
    fs.writeFileSync(path.join(slidesDir, `slide${number}.xml`), slideXml(slide));
    fs.writeFileSync(path.join(slideRelsDir, `slide${number}.xml.rels`), slideRels(slide));
  });
}

function writePackageParts() {
  const slideOverrides = slides
    .map((_, i) => `  <Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`)
    .join("\n");
  fs.writeFileSync(
    path.join(workDir, "[Content_Types].xml"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
${slideOverrides}
</Types>`,
  );

  fs.writeFileSync(
    path.join(workDir, "_rels", ".rels"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
  );

  fs.writeFileSync(
    path.join(workDir, "docProps", "core.xml"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Tank Inspection Copilot Product Report</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-04-14T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-04-14T00:00:00Z</dcterms:modified>
</cp:coreProperties>`,
  );

  fs.writeFileSync(
    path.join(workDir, "docProps", "app.xml"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex</Application>
  <PresentationFormat>On-screen Show (16:9)</PresentationFormat>
  <Slides>${slides.length}</Slides>
  <Company></Company>
</Properties>`,
  );
}

function writePresentation() {
  const rels = [
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>',
    ...slides.map((_, i) => `  <Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`),
  ].join("\n");

  fs.writeFileSync(
    path.join(pptDir, "_rels", "presentation.xml.rels"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${rels}
</Relationships>`,
  );

  const sldIds = slides.map((_, i) => `    <p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join("\n");
  fs.writeFileSync(
    path.join(pptDir, "presentation.xml"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>
${sldIds}
  </p:sldIdLst>
  <p:sldSz cx="${SLIDE_CX}" cy="${SLIDE_CY}" type="wide"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:defaultTextStyle/>
</p:presentation>`,
  );
}

function writeMasterLayoutTheme() {
  fs.writeFileSync(
    path.join(pptDir, "slideMasters", "_rels", "slideMaster1.xml.rels"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`,
  );

  fs.writeFileSync(
    path.join(pptDir, "slideMasters", "slideMaster1.xml"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_CX}" cy="${SLIDE_CY}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_CX}" cy="${SLIDE_CY}"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
</p:sldMaster>`,
  );

  fs.writeFileSync(
    path.join(pptDir, "slideLayouts", "_rels", "slideLayout1.xml.rels"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`,
  );

  fs.writeFileSync(
    path.join(pptDir, "slideLayouts", "slideLayout1.xml"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_CX}" cy="${SLIDE_CY}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_CX}" cy="${SLIDE_CY}"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`,
  );

  fs.writeFileSync(
    path.join(pptDir, "theme", "theme1.xml"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Tank Inspection">
  <a:themeElements>
    <a:clrScheme name="Tank Inspection">
      <a:dk1><a:srgbClr val="${C.ink}"/></a:dk1><a:lt1><a:srgbClr val="${C.white}"/></a:lt1>
      <a:dk2><a:srgbClr val="${C.dark}"/></a:dk2><a:lt2><a:srgbClr val="${C.bg}"/></a:lt2>
      <a:accent1><a:srgbClr val="${C.teal}"/></a:accent1><a:accent2><a:srgbClr val="${C.mint}"/></a:accent2>
      <a:accent3><a:srgbClr val="${C.orange}"/></a:accent3><a:accent4><a:srgbClr val="${C.red}"/></a:accent4>
      <a:accent5><a:srgbClr val="${C.line}"/></a:accent5><a:accent6><a:srgbClr val="${C.muted}"/></a:accent6>
      <a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Aptos"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme>
    <a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
  </a:themeElements>
  <a:objectDefaults/>
  <a:extraClrSchemeLst/>
</a:theme>`,
  );
}

ensureDirs();
writeSlides();
writePackageParts();
writePresentation();
writeMasterLayoutTheme();

console.log(outFile);

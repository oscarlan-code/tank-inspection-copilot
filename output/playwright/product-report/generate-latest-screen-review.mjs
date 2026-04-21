import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { REPORT_META, SCREEN_REVIEW } from "./screen-review-data.mjs";

const reportDir = path.dirname(fileURLToPath(import.meta.url));
const workDir = path.join(reportDir, "latest-screen-review-work");
const pptDir = path.join(workDir, "ppt");
const slidesDir = path.join(pptDir, "slides");
const slideRelsDir = path.join(slidesDir, "_rels");
const mediaDir = path.join(pptDir, "media");
const outFile = path.join(reportDir, "screen-review.pptx");
const latestFile = path.join(reportDir, "screen-review-latest.pptx");
const markdownFile = path.join(reportDir, "screen-review-latest.md");

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
  orange: "FEF3C7",
  red: "FEE2E2",
};

const stageFill = new Map([
  ["Start and resume", C.mint],
  ["Tank definition", C.mint],
  ["Surface selection", C.yellow],
  ["Bottom inspection", C.yellow],
  ["Location capture", C.yellow],
  ["Defect capture", C.orange],
  ["Surface geometry", C.mint],
  ["Review", C.mint],
  ["Submit", C.red],
]);

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

function pngSize(file) {
  const buffer = fs.readFileSync(path.join(reportDir, file));
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function fitImage(file, x, y, maxW, maxH) {
  const { width, height } = pngSize(file);
  const aspect = width / height;
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  return { x: x + (maxW - w) / 2, y: y + (maxH - h) / 2, w, h };
}

function newSlide() {
  const slide = { els: [], imgs: [], id: 2 };
  slide.rect = (x, y, w, h, fill, line = fill) => {
    slide.els.push({ type: "rect", id: slide.id++, x, y, w, h, fill, line });
  };
  slide.text = (text, x, y, w, h, opts = {}) => {
    slide.els.push({ type: "text", id: slide.id++, text, x, y, w, h, opts });
  };
  slide.image = (file, x, y, w, h) => {
    const relId = `rId${slide.imgs.length + 2}`;
    slide.imgs.push({ file, relId });
    slide.els.push({ type: "image", id: slide.id++, file, relId, x, y, w, h });
  };
  slide.imageFit = (file, x, y, maxW, maxH, frame = true) => {
    const pos = fitImage(file, x, y, maxW, maxH);
    if (frame) slide.rect(pos.x - 0.06, pos.y - 0.06, pos.w + 0.12, pos.h + 0.12, C.white, C.line);
    slide.image(file, pos.x, pos.y, pos.w, pos.h);
  };
  return slide;
}

function rPr(color, size, bold) {
  const b = bold ? ' b="1"' : "";
  return `<a:rPr lang="en-US" sz="${Math.round(size * 100)}"${b}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr>`;
}

function paragraph(text, opts = {}) {
  const align = opts.align ?? "l";
  return `<a:p><a:pPr algn="${align}"/><a:r>${rPr(opts.color ?? C.ink, opts.size ?? 11, !!opts.bold)}<a:t>${esc(text)}</a:t></a:r><a:endParaRPr lang="en-US"/></a:p>`;
}

function txBody(text, opts = {}) {
  const lines = Array.isArray(text) ? text : String(text).split("\n");
  const anchor = opts.mid ? "ctr" : "t";
  const body = lines.map((line) => paragraph(line, opts)).join("");
  return `<p:txBody><a:bodyPr wrap="square" anchor="${anchor}" lIns="${emu(0.07)}" tIns="${emu(0.04)}" rIns="${emu(0.07)}" bIns="${emu(0.04)}"/><a:lstStyle/>${body}</p:txBody>`;
}

function elementXml(el) {
  if (el.type === "image") {
    return `<p:pic><p:nvPicPr><p:cNvPr id="${el.id}" name="${esc(el.file)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${el.relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${emu(el.x)}" y="${emu(el.y)}"/><a:ext cx="${emu(el.w)}" cy="${emu(el.h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln><a:solidFill><a:srgbClr val="${C.line}"/></a:solidFill></a:ln></p:spPr></p:pic>`;
  }
  const fill = el.fill ? `<a:solidFill><a:srgbClr val="${el.fill}"/></a:solidFill>` : "<a:noFill/>";
  const line = el.line ? `<a:ln w="9525"><a:solidFill><a:srgbClr val="${el.line}"/></a:solidFill></a:ln>` : "<a:ln><a:noFill/></a:ln>";
  const text = el.type === "text" ? txBody(el.text, el.opts) : "";
  return `<p:sp><p:nvSpPr><p:cNvPr id="${el.id}" name="Shape ${el.id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(el.x)}" y="${emu(el.y)}"/><a:ext cx="${emu(el.w)}" cy="${emu(el.h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill}${line}</p:spPr>${text}</p:sp>`;
}

function slideXml(slide) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${C.bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
  <p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_CX}" cy="${SLIDE_CY}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_CX}" cy="${SLIDE_CY}"/></a:xfrm></p:grpSpPr>
    ${slide.els.map(elementXml).join("\n    ")}
  </p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function relsXml(slide) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
${slide.imgs.map((img) => `  <Relationship Id="${img.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${esc(img.file)}"/>`).join("\n")}
</Relationships>`;
}

function addFooter(slide, index, total) {
  slide.text("Tank Inspection Copilot - Latest Screen Review", 0.55, 7.18, 5.0, 0.22, { color: C.muted, size: 8 });
  slide.text(`${index} / ${total}`, 12.45, 7.18, 0.65, 0.22, { color: C.muted, size: 8, align: "r" });
}

function makeCover() {
  const slide = newSlide();
  slide.rect(0, 0, W, H, C.bg, C.bg);
  slide.rect(0, 0, 0.18, H, C.teal, C.teal);
  slide.text(REPORT_META.title, 0.65, 0.78, 6.3, 0.62, { color: C.ink, size: 28, bold: true });
  slide.text(REPORT_META.subtitle, 0.68, 1.5, 6.8, 0.34, { color: C.teal, size: 13.5, bold: true });
  slide.text(REPORT_META.summary, 0.68, 2.0, 6.3, 0.62, { color: C.muted, size: 12 });
  slide.rect(0.68, 2.78, 5.8, 0.02, C.line, C.line);
  slide.text(`Prepared for customer validation - ${REPORT_META.dateLabel}`, 0.68, 3.0, 6.0, 0.3, { color: C.muted, size: 10 });
  slide.text("Workflow: setup -> tank definition -> surface geometry -> location -> defect capture -> review -> export", 0.68, 3.42, 6.4, 0.55, { color: C.muted, size: 10 });
  slide.imageFit("latest-08-bottom-grid-map.png", 7.35, 0.55, 2.55, 6.45);
  slide.imageFit("latest-30-export-summary.png", 10.22, 0.95, 2.35, 5.65);
  return slide;
}

function makeOverview() {
  const slide = newSlide();
  slide.rect(0, 0, W, H, C.bg, C.bg);
  slide.text("Validation Coverage", 0.58, 0.38, 6.6, 0.48, { color: C.teal, size: 24, bold: true });
  slide.text("Screens included in this latest pass", 0.6, 0.92, 6.6, 0.28, { color: C.muted, size: 11 });
  slide.rect(0.6, 1.26, 12.1, 0.02, C.line, C.line);

  const counts = [...SCREEN_REVIEW.reduce((map, item) => map.set(item.stage, (map.get(item.stage) ?? 0) + 1), new Map())];
  counts.forEach(([stage, count], index) => {
    const x = 0.72 + (index % 3) * 4.1;
    const y = 1.65 + Math.floor(index / 3) * 1.05;
    slide.rect(x, y, 3.55, 0.75, stageFill.get(stage) ?? C.white, C.line);
    slide.text(stage, x + 0.18, y + 0.12, 2.65, 0.24, { color: C.teal, size: 10.5, bold: true });
    slide.text(`${count} screen${count === 1 ? "" : "s"}`, x + 0.18, y + 0.4, 2.65, 0.22, { color: C.ink, size: 10 });
  });

  slide.rect(0.72, 4.48, 12.0, 1.45, C.white, C.line);
  slide.text("How to use this deck", 0.92, 4.67, 4.5, 0.28, { color: C.teal, size: 13, bold: true });
  slide.text([
    "Each screen slide includes the current screenshot, the customer-facing purpose, and validation questions.",
    "Use the right-side validation points as the meeting checklist for feature sign-off.",
    "The screenshots were captured from the current React app on localhost at mobile viewport 430 x 932.",
  ], 0.92, 5.08, 11.45, 0.68, { color: C.ink, size: 10.5 });
  return slide;
}

function makeScreenSlide(item, index, total) {
  const slide = newSlide();
  slide.rect(0, 0, 3.65, H, C.white, C.line);
  slide.rect(0.24, 0.24, 3.16, 0.44, stageFill.get(item.stage) ?? C.mint, C.line);
  slide.text(item.stage, 0.34, 0.26, 2.96, 0.38, { color: C.teal, size: 9.5, bold: true, mid: true });
  slide.imageFit(item.img, 0.25, 0.86, 3.13, 6.08);

  slide.rect(3.82, 0.24, 0.06, 6.95, C.teal, C.teal);
  slide.text(item.label, 4.1, 0.3, 8.85, 0.42, { color: C.teal, size: 20.5, bold: true });
  slide.rect(4.1, 0.86, 8.85, 0.015, C.line, C.line);
  slide.text(item.headline, 4.1, 0.98, 8.7, 0.34, { color: C.ink, size: 13, bold: true });
  slide.text(item.purpose, 4.1, 1.38, 8.7, 0.82, { color: C.muted, size: 10.4 });

  slide.text("Customer validation points", 4.1, 2.42, 5.2, 0.28, { color: C.teal, size: 12, bold: true });
  item.checks.forEach((check, checkIndex) => {
    const y = 2.82 + checkIndex * 1.12;
    const fill = checkIndex % 2 === 0 ? C.white : C.mint;
    slide.rect(4.1, y, 8.85, 0.88, fill, C.line);
    slide.text(`${checkIndex + 1}. ${check}`, 4.28, y + 0.1, 8.48, 0.65, { color: C.ink, size: 10 });
  });

  addFooter(slide, index, total);
  return slide;
}

function writeMarkdown() {
  const lines = [
    `# ${REPORT_META.title} - Latest Screen Review`,
    "",
    `Generated: ${REPORT_META.dateLabel}`,
    "",
    REPORT_META.summary,
    "",
    "## Screen Inventory",
    "",
  ];
  for (const item of SCREEN_REVIEW) {
    lines.push(`### ${item.label}`);
    lines.push("");
    lines.push(`![${item.label}](./${item.img})`);
    lines.push("");
    lines.push(`**Stage:** ${item.stage}`);
    lines.push("");
    lines.push(`**Purpose:** ${item.purpose}`);
    lines.push("");
    lines.push("**Customer validation points:**");
    for (const check of item.checks) lines.push(`- ${check}`);
    lines.push("");
  }
  fs.writeFileSync(markdownFile, `${lines.join("\n")}\n`);
}

function ensureCleanWorkDir() {
  fs.rmSync(workDir, { recursive: true, force: true });
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
}

function writePackage(slides) {
  const imageFiles = new Set();
  for (const slide of slides) {
    for (const image of slide.imgs) imageFiles.add(image.file);
  }

  for (const file of imageFiles) {
    const src = path.join(reportDir, file);
    if (!fs.existsSync(src)) throw new Error(`Missing screenshot: ${src}`);
    fs.copyFileSync(src, path.join(mediaDir, file));
  }

  slides.forEach((slide, index) => {
    fs.writeFileSync(path.join(slidesDir, `slide${index + 1}.xml`), slideXml(slide));
    fs.writeFileSync(path.join(slideRelsDir, `slide${index + 1}.xml.rels`), relsXml(slide));
  });

  const overrides = slides.map((_, index) =>
    `  <Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
  ).join("\n");

  fs.writeFileSync(path.join(workDir, "[Content_Types].xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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
${overrides}
</Types>`);

  fs.writeFileSync(path.join(workDir, "_rels", ".rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);

  fs.writeFileSync(path.join(workDir, "docProps", "core.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${esc(REPORT_META.title)} - Latest Screen Review</dc:title>
  <dc:creator>Oscar</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-04-20T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-04-20T00:00:00Z</dcterms:modified>
</cp:coreProperties>`);

  fs.writeFileSync(path.join(workDir, "docProps", "app.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Tank Inspection Copilot</Application>
  <PresentationFormat>On-screen Show (16:9)</PresentationFormat>
  <Slides>${slides.length}</Slides>
</Properties>`);

  const pRels = [
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>',
    ...slides.map((_, index) => `  <Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`),
  ].join("\n");
  fs.writeFileSync(path.join(pptDir, "_rels", "presentation.xml.rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${pRels}
</Relationships>`);

  const sldIds = slides.map((_, index) => `    <p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join("\n");
  fs.writeFileSync(path.join(pptDir, "presentation.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>
${sldIds}
  </p:sldIdLst>
  <p:sldSz cx="${SLIDE_CX}" cy="${SLIDE_CY}" type="wide"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:defaultTextStyle/>
</p:presentation>`);

  fs.writeFileSync(path.join(pptDir, "slideMasters", "_rels", "slideMaster1.xml.rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`);

  fs.writeFileSync(path.join(pptDir, "slideMasters", "slideMaster1.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_CX}" cy="${SLIDE_CY}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_CX}" cy="${SLIDE_CY}"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
</p:sldMaster>`);

  fs.writeFileSync(path.join(pptDir, "slideLayouts", "_rels", "slideLayout1.xml.rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`);

  fs.writeFileSync(path.join(pptDir, "slideLayouts", "slideLayout1.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_CX}" cy="${SLIDE_CY}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_CX}" cy="${SLIDE_CY}"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`);

  fs.writeFileSync(path.join(pptDir, "theme", "theme1.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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
}

function main() {
  ensureCleanWorkDir();
  writeMarkdown();

  const slides = [
    makeCover(),
    makeOverview(),
    ...SCREEN_REVIEW.map((item, index) => makeScreenSlide(item, index + 3, SCREEN_REVIEW.length + 2)),
  ];
  writePackage(slides);

  fs.rmSync(outFile, { force: true });
  execFileSync("zip", ["-r", outFile, ".", "-x", "*.DS_Store"], { cwd: workDir, stdio: "inherit" });
  fs.copyFileSync(outFile, latestFile);

  console.log(`Done: ${outFile}`);
  console.log(`Also wrote: ${latestFile}`);
  console.log(`Markdown: ${markdownFile}`);
}

main();

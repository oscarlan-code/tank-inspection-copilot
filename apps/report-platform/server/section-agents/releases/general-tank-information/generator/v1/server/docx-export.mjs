import { Resvg } from "@resvg/resvg-js";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  LineRuleType,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
} from "docx";
import { buildLayoutFigureSvg } from "./layout-map-figure.mjs";
import { parseSectionDocument, reportNodeText, validateSectionDocument } from "./report-document.mjs";
import {
  API_STANDARD_PRIMARY_REPORT,
  API_STANDARD_REPORT_TOC,
} from "./report-toc.mjs";

const BRAND_BLUE = "0D4F90";
const BRAND_BLUE_DARK = "0A3F73";
const BRAND_RED = "EF4C57";
const SOFT_BLUE = "EAF2FB";
const SOFT_RED = "FDECEE";
const LINE = "D6DFEB";
const NORMAL_PAGE_MARGIN_TWIPS = 1440;
const NARRATIVE_LINE_SPACING = 360;
const TABLE_LINE_SPACING = 240;
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

export async function buildFinalReportDocx(reportState, { sectionIds = [] } = {}) {
  if (!reportState?.reportJob || !reportState?.exportPackage) {
    throw new Error("Report job state is required to export DOCX.");
  }

  const approvedSectionIds = new Set(
    (reportState.sectionDrafts ?? [])
      .filter((draft) => draft.approved)
      .map((draft) => draft.sectionId),
  );
  const requestedSectionIds = new Set(
    Array.isArray(sectionIds) ? sectionIds.map((sectionId) => String(sectionId)) : [],
  );
  const selectedTocSections = API_STANDARD_REPORT_TOC.filter((section) => {
    if (!approvedSectionIds.has(section.id)) return false;
    return requestedSectionIds.size === 0 || requestedSectionIds.has(section.id);
  });

  if (selectedTocSections.length === 0) {
    throw new Error("Select at least one approved section before exporting DOCX.");
  }

  const draftBySectionId = new Map(
    (reportState.sectionDrafts ?? []).map((draft) => [draft.sectionId, draft]),
  );
  for (const section of selectedTocSections) {
    validateDraftPlanningSnapshot(reportState, draftBySectionId.get(section.id), section.id);
  }
  const documentContext = { numbering: [], nextListId: 0 };
  const approvalSummary = {
    approvedCount: approvedSectionIds.size,
    totalCount: API_STANDARD_REPORT_TOC.length,
    pendingCount: API_STANDARD_REPORT_TOC.length - approvedSectionIds.size,
    exportedCount: selectedTocSections.length,
  };

  const children = [
    ...buildCoverPage(reportState, approvalSummary),
    pageBreak(),
    ...buildTableOfContents(selectedTocSections),
  ];

  for (const tocSection of selectedTocSections) {
    children.push(pageBreak());
    children.push(...buildReportSection({
      reportState,
      tocSection,
      draft: draftBySectionId.get(tocSection.id),
      approved: true,
      documentContext,
    }));
  }

  const document = new Document({
    creator: "LAIQ Report Platform",
    description: "API 653 report-platform DOCX export compiled from LAIQ inspection app V3 field data.",
    title: `${reportState.reportJob.reportReference} ${reportState.reportJob.title}`,
    numbering: { config: documentContext.numbering },
    styles: {
      default: {
        document: {
          run: {
            font: "Arial",
            size: 21,
            color: "163250",
          },
          paragraph: {
            spacing: {
              after: 120,
              line: NARRATIVE_LINE_SPACING,
              lineRule: LineRuleType.AUTO,
            },
          },
        },
      },
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: {
            font: "Arial",
            size: 21,
            color: "163250",
          },
          paragraph: {
            spacing: {
              after: 120,
              line: NARRATIVE_LINE_SPACING,
              lineRule: LineRuleType.AUTO,
            },
          },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            font: "Arial",
            bold: true,
            color: BRAND_BLUE_DARK,
            size: 28,
          },
          paragraph: {
            keepNext: true,
            outlineLevel: 0,
            spacing: {
              before: 120,
              after: 180,
              line: NARRATIVE_LINE_SPACING,
              lineRule: LineRuleType.AUTO,
            },
          },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            font: "Arial",
            bold: true,
            color: BRAND_BLUE,
            size: 24,
          },
          paragraph: {
            keepNext: true,
            outlineLevel: 1,
            spacing: {
              before: 120,
              after: 140,
              line: NARRATIVE_LINE_SPACING,
              lineRule: LineRuleType.AUTO,
            },
          },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            font: "Arial",
            bold: true,
            color: BRAND_BLUE_DARK,
            size: 22,
          },
          paragraph: {
            keepNext: true,
            outlineLevel: 2,
            spacing: {
              before: 100,
              after: 100,
              line: NARRATIVE_LINE_SPACING,
              lineRule: LineRuleType.AUTO,
            },
          },
        },
        ...[4, 5, 6].map((level) => ({
          id: `Heading${level}`, name: `Heading ${level}`, basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: "Arial", bold: true, color: BRAND_BLUE_DARK, size: 21 },
          paragraph: { keepNext: true, outlineLevel: level - 1, spacing: { before: 80, after: 80, line: NARRATIVE_LINE_SPACING, lineRule: LineRuleType.AUTO } },
        })),
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: NORMAL_PAGE_MARGIN_TWIPS,
              right: NORMAL_PAGE_MARGIN_TWIPS,
              bottom: NORMAL_PAGE_MARGIN_TWIPS,
              left: NORMAL_PAGE_MARGIN_TWIPS,
            },
          },
        },
        children,
      },
    ],
  });

  return {
    filename: buildDocxFilename(reportState, selectedTocSections),
    buffer: await Packer.toBuffer(document),
    approvalSummary,
  };
}

function buildCoverPage(reportState, approvalSummary) {
  const { reportJob, exportPackage, authorizationContext } = reportState;
  const issueState =
    approvalSummary.pendingCount === 0
      ? `Final report package - ${approvalSummary.exportedCount} approved section${approvalSummary.exportedCount === 1 ? "" : "s"} selected`
      : `Selected approved-section export - ${approvalSummary.exportedCount} section${approvalSummary.exportedCount === 1 ? "" : "s"} included; ${approvalSummary.pendingCount} report section${approvalSummary.pendingCount === 1 ? "" : "s"} still pending approval`;

  return [
    paragraph("LAIQ REPORT PLATFORM", {
      color: BRAND_BLUE,
      bold: true,
      size: 22,
      spacingAfter: 220,
    }),
    paragraph(API_STANDARD_PRIMARY_REPORT.title.toUpperCase(), {
      heading: HeadingLevel.TITLE,
      color: BRAND_BLUE_DARK,
      bold: true,
      size: 42,
      spacingAfter: 240,
    }),
    paragraph(`${exportPackage.task.client.toUpperCase()}`, {
      color: BRAND_BLUE_DARK,
      bold: true,
      size: 30,
      alignment: AlignmentType.CENTER,
      spacingAfter: 120,
    }),
    paragraph(`Tank ${exportPackage.task.tankNumber}`, {
      color: BRAND_BLUE_DARK,
      bold: true,
      size: 26,
      alignment: AlignmentType.CENTER,
      spacingAfter: 280,
    }),
    keyValueTable([
      ["Report reference", reportJob.reportReference],
      ["Inspection reference", exportPackage.inspectionReference],
      ["Inspection date", reportJob.inspectedDate],
      ["Location", exportPackage.inspectionRecord.location],
      ["Compiled by", authorizationContext?.actorDisplayName ?? exportPackage.profile.displayName],
      ["Approval status", issueState],
    ]),
    paragraph(
      "This DOCX is compiled from the LAIQ inspection app V3 export and report-platform section drafts. Layout maps are positioned in the API-standard report order near the related UT measurement sections.",
      {
        italics: true,
        color: "52677E",
        spacingBefore: 260,
      },
    ),
  ];
}

function buildTableOfContents(selectedTocSections) {
  const rows = [
    tableRow(["No.", "Section", "Template page", "Approval"], { header: true }),
    ...selectedTocSections.map((section) =>
      tableRow(
        [
          section.number,
          section.title,
          String(section.pageStart),
          "Approved / selected",
        ],
      ),
    ),
  ];

  return [
    paragraph("Table of Contents", {
      heading: HeadingLevel.HEADING_1,
      color: BRAND_BLUE_DARK,
      bold: true,
    }),
    paragraph(
      "Formatting basis: API-standard vertical AST internal/external report template. This DOCX includes only approved sections selected by the user at export time.",
      { color: "52677E" },
    ),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
      borders: tableBorders(),
    }),
  ];
}

function buildReportSection({ reportState, tocSection, draft, approved, documentContext }) {
  const content = stripDuplicateSectionHeading(String(draft?.content ?? "").trim(), tocSection);
  const children = [
    paragraph(`${tocSection.number}  ${tocSection.title.toUpperCase()}`, {
      heading: HeadingLevel.HEADING_1,
      color: BRAND_BLUE_DARK,
      bold: true,
      spacingAfter: 120,
    }),
    approvalParagraph(approved, draft),
  ];

  if (content) {
    children.push(...contentToDocxBlocks(content, { tocSection, documentContext, planId: draft?.sectionPlanSnapshotId ?? draft?.planSnapshotId ?? null }));
  } else {
    children.push(
      paragraph(
        "Pending generation. This section is present in the API-standard report template but does not yet have an approved report-platform draft.",
        { italics: true, color: "52677E" },
      ),
    );
  }

  if (tocSection.kind === "map" && tocSection.layoutSurface) {
    children.push(...buildLayoutMapSection(reportState, tocSection));
  }

  return children;
}

function approvalParagraph(approved, draft) {
  if (approved) {
    return paragraph("Section approval: APPROVED", {
      color: BRAND_BLUE,
      bold: true,
      spacingAfter: 140,
    });
  }

  const reason = draft?.generated
    ? "Generated draft is pending user approval."
    : "Section output has not yet been generated and approved.";

  return paragraph(`Section approval: PENDING - ${reason}`, {
    color: BRAND_RED,
    bold: true,
    spacingAfter: 140,
  });
}

function buildLayoutMapSection(reportState, tocSection) {
  const surface = tocSection.layoutSurface;
  const targetKey = surface === "roof" ? "external_roof" : surface;
  const exportPackage = reportState.exportPackage;
  const config = exportPackage.layoutConfigs.find((item) => item.targetKey === targetKey);
  const figure = buildLayoutFigureSvg(reportState, tocSection);

  if (!config || !figure) {
    return [
      paragraph("Layout map source data is not available for this section.", {
        color: BRAND_RED,
        bold: true,
      }),
    ];
  }

  const surfaceMeasurements = exportPackage.utMeasurements.filter((item) => item.targetKey === targetKey);
  const surfaceFindings = exportPackage.findings.filter((item) => item.targetKey === targetKey);
  const surfaceElements = exportPackage.elements.filter((item) => item.targetKey === targetKey);
  const figurePng = renderLayoutFigurePng(figure.svg);

  return [
    paragraph(`${formatSurfaceLabel(surface)} Layout Map`, {
      heading: HeadingLevel.HEADING_2,
      color: BRAND_BLUE,
      bold: true,
      spacingBefore: 160,
    }),
    paragraph(
      "Position note: this layout block is intentionally placed in the same report region as the related UT / finding section.",
      { italics: true, color: "52677E" },
    ),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 80 },
      children: [
        new ImageRun({
          type: "svg",
          data: Buffer.from(figure.svg, "utf8"),
          fallback: {
            type: "png",
            data: figurePng,
          },
          transformation: {
            width: 620,
            height: Math.round(620 * (figure.height / figure.width)),
          },
          altText: {
            title: figure.title,
            description: `${formatSurfaceLabel(surface)} layout figure generated from LAIQ inspection app V3 layout data.`,
          },
        }),
      ],
    }),
    paragraph(`Figure: ${figure.title} generated from LAIQ inspection app V3 layout data.`, {
      alignment: AlignmentType.CENTER,
      color: "52677E",
      italics: true,
      spacingAfter: 140,
    }),
    keyValueTable([
      ["Surface", formatSurfaceLabel(surface)],
      ["Reference", config.referenceNote ?? config.referenceMode ?? "Pending confirmation"],
      ["Measurements linked", String(surfaceMeasurements.length)],
      ["Findings linked", String(surfaceFindings.length)],
      ["Elements linked", String(surfaceElements.length)],
    ]),
    ...buildLayoutEvidenceTable(surfaceElements, surfaceFindings),
  ];
}

function buildShellMapTable(config, measurements, findings) {
  const courseCount = Math.max(Number(config.shellCourseCount ?? 1), 1);
  const laneCount = Math.max(Number(config.shellLaneCount ?? 4), 1);
  const rows = [
    tableRow(["Course", ...Array.from({ length: laneCount }).map((_, index) => shellLaneLabel(index, laneCount))], {
      header: true,
    }),
  ];

  for (let course = courseCount; course >= 1; course -= 1) {
    rows.push(
      tableRow([
        `C${course}`,
        ...Array.from({ length: laneCount }).map((_, index) => {
          const laneId = `L${index + 1}`;
          const measurement = measurements.find((item) => item.course === course && item.laneId === laneId);
          const linkedFindings = findings.filter((finding) => finding.linkedUtItemKey === measurement?.itemKey);
          return [
            `${laneId}-C${course}`,
            measurement ? formatMeasurementRange(measurement) : "No UT",
            linkedFindings.length > 0 ? `Finding: ${linkedFindings.map((finding) => finding.itemLabel).join(", ")}` : "",
          ].filter(Boolean).join("\n");
        }),
      ]),
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: tableBorders(),
  });
}

function buildPlateMapTable(surface, config, measurements, findings) {
  const plateIds = [...new Set(
    measurements
      .filter((item) => item.itemKind === "region" && item.plateId)
      .map((item) => String(item.plateId)),
  )].sort((left, right) => Number(left) - Number(right));
  const columnCount =
    surface === "roof"
      ? Math.max(Number(config.roofWidestRowPlateCount ?? 8), 1)
      : Math.max(Number(config.floorPatternCountX ?? 6), 1);
  const rowCount =
    surface === "roof"
      ? Math.max(Number(config.roofRowCount ?? Math.ceil(plateIds.length / columnCount)), 1)
      : Math.max(Number(config.floorPatternCountY ?? Math.ceil(plateIds.length / columnCount)), 1);
  const rows = [];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const rowCells = [];

    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const plateId = plateIds[rowIndex * columnCount + columnIndex];
      if (!plateId) {
        rowCells.push("");
        continue;
      }

      const measurement = measurements.find((item) => String(item.plateId) === plateId);
      const linkedFindings = findings.filter((finding) => finding.linkedUtItemKey === measurement?.itemKey);
      rowCells.push([
        `P${plateId}`,
        measurement ? formatMeasurementRange(measurement) : "No UT",
        linkedFindings.length > 0 ? `Finding: ${linkedFindings.map((finding) => finding.itemLabel).join(", ")}` : "",
      ].filter(Boolean).join("\n"));
    }

    rows.push(tableRow(rowCells));
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: tableBorders(),
  });
}

function buildLayoutEvidenceTable(elements, findings) {
  const rows = [
    tableRow(["Type", "Label", "Source note"], { header: true }),
    ...elements.slice(0, 24).map((element) =>
      tableRow([
        "Element",
        element.elementLabel,
        `${humanizeKey(element.elementTypeKey)} at normalized position ${formatPercent(element.normalizedX)} / ${formatPercent(element.normalizedY)}`,
      ]),
    ),
    ...findings.slice(0, 24).map((finding) =>
      tableRow(["Finding", finding.itemLabel, finding.note]),
    ),
  ];

  if (rows.length === 1) return [];

  return [
    paragraph("Linked location / finding evidence", {
      heading: HeadingLevel.HEADING_3,
      color: BRAND_BLUE_DARK,
      bold: true,
      spacingBefore: 160,
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
      borders: tableBorders(),
    }),
  ];
}

function renderLayoutFigurePng(svg) {
  try {
    return new Resvg(svg, {
      background: "white",
      fitTo: {
        mode: "width",
        value: 1400,
      },
      font: {
        loadSystemFonts: true,
      },
    }).render().asPng();
  } catch {
    return TRANSPARENT_PNG;
  }
}

function validateDraftPlanningSnapshot(reportState, draft, sectionId) {
  const draftSnapshotId = draft?.sectionPlanSnapshotId ?? draft?.planSnapshotId;
  if (!draftSnapshotId) return; // Preserve historical unbound approved drafts.
  const planning = reportState.sectionPlanning;
  if (!planning?.snapshotId || planning.snapshotId !== draftSnapshotId) {
    throw new Error(`Section ${sectionId} was approved against a stale section plan. Review and approve the current plan before exporting.`);
  }
  const plan = (planning.sectionPlans ?? []).find((item) => item.sectionId === sectionId);
  if (!plan || plan.status !== "ready") {
    throw new Error(`Section ${sectionId} has unresolved section-plan requirements and cannot be exported.`);
  }
  const document = parseSectionDocument({ sectionId, html: draft.content, planId: plan.planId });
  const validation = validateSectionDocument(document);
  if (!validation.valid) throw new Error(`Section ${sectionId} is not export-ready: ${validation.issues.join(" ")}`);
}

function contentToDocxBlocks(content, { tocSection, documentContext, planId }) {
  const document = parseSectionDocument({ sectionId: tocSection.id, html: content, planId });
  removeDuplicateDocumentHeading(document.blocks, tocSection);
  return renderDocumentNodes(document.blocks, { documentContext });
}

function removeDuplicateDocumentHeading(nodes, tocSection) {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if ("text" in node) { if (!node.text.trim()) continue; return; }
    if (["section", "div"].includes(node.tag)) { removeDuplicateDocumentHeading(node.children, tocSection); return; }
    if (!/^h[1-6]$/.test(node.tag)) return;
    const actual = normalizeSectionHeading(reportNodeText(node));
    const alternatives = [tocSection.title, `${tocSection.number} ${tocSection.title}`].map(normalizeSectionHeading);
    if (alternatives.includes(actual)) nodes.splice(index, 1);
    return;
  }
}

const INLINE_TAGS = new Set(["strong", "b", "em", "i", "u", "span", "br"]);
function renderDocumentNodes(nodes, context = {}) {
  const result = [];
  let inline = [];
  const flush = () => {
    if (inline.some((node) => reportNodeText(node).trim() || node.tag === "br")) result.push(richParagraph(inline, context));
    inline = [];
  };
  for (const node of nodes) {
    if ("text" in node && node.text.trim() && /\n/.test(node.text)) {
      // Historical drafts sometimes contain plain-text report lines. The shared
      // tree retains those lines; preserve their paragraph boundaries in Word.
      for (const line of node.text.split(/\n+/).filter((part) => part.trim())) {
        flush();
        const bullet = parseReportBullet(line);
        result.push(bullet ? reportBulletParagraph(bullet.text) : paragraph(line.trim(), {
          heading: isHeadingLine(line.trim()) ? HeadingLevel.HEADING_3 : undefined,
          lineSpacing: context.inTable ? TABLE_LINE_SPACING : NARRATIVE_LINE_SPACING,
        }));
      }
      continue;
    }
    if ("text" in node || INLINE_TAGS.has(node.tag)) { inline.push(node); continue; }
    flush();
    if (/^h[1-6]$/.test(node.tag)) {
      result.push(richParagraph(node.children, { ...context, heading: HeadingLevel[`HEADING_${node.tag.slice(1)}`] }));
    } else if (["ul", "ol"].includes(node.tag)) {
      result.push(...renderDocumentList(node, context));
    } else if (node.tag === "table") {
      const table = renderDocumentTable(node, context);
      if (table) result.push(table);
    } else if (["p", "blockquote", "li"].includes(node.tag)) {
      result.push(richParagraph(node.children, { ...context, indentLeft: node.tag === "blockquote" ? 420 : context.indentLeft }));
    } else if (node.tag === "hr") {
      result.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: LINE } } }));
    } else {
      result.push(...renderDocumentNodes(node.children ?? [], context));
    }
  }
  flush();
  return result;
}

function richParagraph(nodes, context = {}) {
  return new Paragraph({
    heading: context.heading,
    numbering: context.numbering,
    keepNext: Boolean(context.heading),
    indent: context.indentLeft ? { left: context.indentLeft } : undefined,
    spacing: { before: context.heading ? 100 : 0, after: context.inTable ? 20 : 100, line: context.inTable ? TABLE_LINE_SPACING : NARRATIVE_LINE_SPACING, lineRule: LineRuleType.AUTO },
    children: inlineRuns(nodes, { bold: context.bold || Boolean(context.heading), color: context.heading ? BRAND_BLUE_DARK : "163250" }),
  });
}

function inlineRuns(nodes, style = {}) {
  return nodes.flatMap((node) => {
    if ("text" in node) return [new TextRun({ ...style, text: node.text })];
    if (node.tag === "br") return [new TextRun({ ...style, break: 1 })];
    const nextStyle = { ...style };
    if (["strong", "b"].includes(node.tag)) nextStyle.bold = true;
    if (["em", "i"].includes(node.tag)) nextStyle.italics = true;
    if (node.tag === "u") nextStyle.underline = { type: UnderlineType.SINGLE };
    return inlineRuns(node.children ?? [], nextStyle);
  });
}

function renderDocumentList(list, context) {
  const level = Math.min(context.listLevel ?? 0, 8);
  const reference = `report-list-${++context.documentContext.nextListId}`;
  context.documentContext.numbering.push({ reference, levels: Array.from({ length: 9 }, (_, index) => ({
    level: index,
    format: list.tag === "ol" ? LevelFormat.DECIMAL : LevelFormat.BULLET,
    text: list.tag === "ol" ? `%${index + 1}.` : "➢",
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 520 + index * 360, hanging: 280 } } },
  })) });
  const result = [];
  for (const item of list.children.filter((node) => node.tag === "li")) {
    let first = true;
    let inline = [];
    const flush = () => {
      if (inline.some((node) => reportNodeText(node).trim() || node.tag === "br")) {
        result.push(richParagraph(inline, { ...context, numbering: first ? { reference, level } : undefined, indentLeft: first ? undefined : 520 + level * 360 }));
        first = false;
      }
      inline = [];
    };
    for (const child of item.children) {
      if (["ul", "ol"].includes(child.tag)) {
        flush();
        result.push(...renderDocumentList(child, { ...context, listLevel: level + 1 }));
      } else if (child.tag === "p") {
        flush(); inline.push(...child.children); flush();
      } else if (child.tag === "table") {
        flush(); const table = renderDocumentTable(child, context); if (table) result.push(table);
      } else inline.push(child);
    }
    flush();
  }
  return result;
}

function renderDocumentTable(table, context) {
  const collectRows = (nodes, header = false) => nodes.flatMap((node) => {
    if (node.tag === "tr") return [{ node, header }];
    if (["thead", "tbody", "tfoot"].includes(node.tag)) return collectRows(node.children, node.tag === "thead");
    return [];
  });
  const rows = collectRows(table.children).map(({ node, header }) => {
    const cells = node.children.filter((child) => ["td", "th"].includes(child.tag));
    if (!cells.length) return null;
    return new TableRow({ tableHeader: header || cells.every((child) => child.tag === "th"), children: cells.map((child) => {
      const blocks = renderDocumentNodes(child.children, { ...context, inTable: true, bold: child.tag === "th" });
      return new TableCell({
        columnSpan: child.attrs?.colspan ? Number(child.attrs.colspan) : undefined,
        rowSpan: child.attrs?.rowspan ? Number(child.attrs.rowspan) : undefined,
        shading: child.tag === "th" ? { fill: SOFT_BLUE } : undefined,
        margins: { top: 80, right: 80, bottom: 80, left: 80 },
        children: blocks.length ? blocks : [richParagraph([{ text: "" }], { inTable: true })],
      });
    }) });
  }).filter(Boolean);
  return rows.length ? new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows, borders: tableBorders() }) : null;
}

function paragraph(text, options = {}) {
  return new Paragraph({
    heading: options.heading,
    alignment: options.alignment,
    spacing: {
      before: options.spacingBefore ?? 0,
      after: options.spacingAfter ?? 120,
      line: options.lineSpacing ?? NARRATIVE_LINE_SPACING,
      lineRule: LineRuleType.AUTO,
    },
    indent: options.indentLeft ? { left: options.indentLeft } : undefined,
    children: [
      new TextRun({
        text: String(text ?? ""),
        bold: Boolean(options.bold),
        italics: Boolean(options.italics),
        size: options.size,
        color: options.color,
      }),
    ],
  });
}

function reportBulletParagraph(text, options = {}) {
  return new Paragraph({
    spacing: {
      before: options.spacingBefore ?? 0,
      after: options.spacingAfter ?? 100,
      line: options.lineSpacing ?? NARRATIVE_LINE_SPACING,
      lineRule: LineRuleType.AUTO,
    },
    indent: {
      left: options.indentLeft ?? 520,
      hanging: options.hanging ?? 280,
    },
    children: [
      new TextRun({
        text: `${options.symbol ?? "➢"} `,
        color: options.color ?? "163250",
        font: "Arial",
      }),
      new TextRun({
        text: String(text ?? ""),
        color: options.color ?? "163250",
        font: "Arial",
      }),
    ],
  });
}

function keyValueTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders(),
    rows: rows.map(([key, value]) =>
      new TableRow({
        children: [
          cell(key, { width: 28, bold: true, fill: SOFT_BLUE }),
          cell(value || "Pending confirmation", { width: 72 }),
        ],
      }),
    ),
  });
}

function tableRow(values, options = {}) {
  return new TableRow({
    tableHeader: Boolean(options.header),
    children: values.map((value) =>
      cell(value, {
        bold: Boolean(options.header),
        fill: options.fill ?? (options.header ? SOFT_BLUE : undefined),
      }),
    ),
  });
}

function cell(value, options = {}) {
  const lines = String(value ?? "").split(/\n+/).filter((line) => line.trim().length > 0);
  return new TableCell({
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    shading: options.fill ? { fill: options.fill } : undefined,
    margins: {
      top: 80,
      right: 80,
      bottom: 80,
      left: 80,
    },
    children: (lines.length > 0 ? lines : [""]).map((line) =>
      paragraph(line, {
        bold: options.bold,
        color: options.bold ? BRAND_BLUE_DARK : "163250",
        spacingAfter: 20,
        lineSpacing: TABLE_LINE_SPACING,
      }),
    ),
  });
}

function tableBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 1, color: LINE },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: LINE },
    left: { style: BorderStyle.SINGLE, size: 1, color: LINE },
    right: { style: BorderStyle.SINGLE, size: 1, color: LINE },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: LINE },
    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: LINE },
  };
}

function pageBreak() {
  return new Paragraph({
    children: [new PageBreak()],
  });
}

function parseReportBullet(line) {
  const match = /^(➢|•|-|\*)\s*(.+)$/u.exec(String(line ?? "").trim());
  if (!match) return null;

  return {
    symbol: "➢",
    text: match[2].trim(),
  };
}

function stripDuplicateSectionHeading(content, tocSection) {
  if (!content || !tocSection) return content;

  const lines = content.split(/\n/);
  const firstContentLineIndex = lines.findIndex((line) => line.trim().length > 0);
  if (firstContentLineIndex < 0) return content;

  const firstLine = lines[firstContentLineIndex].trim();
  const expected = normalizeSectionHeading(`${tocSection.number} ${tocSection.title}`);
  const actual = normalizeSectionHeading(firstLine);
  if (actual !== expected) return content;

  lines.splice(firstContentLineIndex, 1);
  return lines.join("\n").replace(/^\s+/, "").trim();
}

function normalizeSectionHeading(value) {
  return String(value ?? "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isHeadingLine(line) {
  const clean = line.replace(/^[0-9A-Za-z ./-]+/, "").trim();
  const words = line.split(/\s+/);
  return (
    line.length <= 80 &&
    words.length <= 8 &&
    /[A-Z]/.test(line) &&
    line === line.toUpperCase() &&
    clean.length === 0
  );
}

function formatMeasurementRange(measurement) {
  const values = [
    measurement.value1,
    measurement.value2,
    measurement.value3,
    measurement.value4,
    measurement.value5,
    measurement.reinforcementPadReading,
  ].filter((value) => typeof value === "number");

  if (values.length === 0) return "UT pending";

  return `${Math.min(...values).toFixed(2)}-${Math.max(...values).toFixed(2)} mm`;
}

function shellLaneLabel(index, laneCount) {
  if (laneCount === 4) {
    return ["N / 0°", "E / 90°", "S / 180°", "W / 270°"][index] ?? `L${index + 1}`;
  }

  return `L${index + 1}`;
}

function formatSurfaceLabel(surface) {
  if (surface === "roof") return "Roof";
  if (surface === "shell") return "Shell";
  if (surface === "floor") return "Floor";
  return humanizeKey(surface);
}

function humanizeKey(value) {
  return String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatPercent(value) {
  return `${Math.round(Number(value ?? 0) * 100)}%`;
}

function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function buildDocxFilename(reportState, selectedTocSections) {
  const base = [
    reportState.reportJob.reportReference,
    reportState.exportPackage.task.tankNumber,
    `${selectedTocSections.length}-sections`,
    "approved-export",
  ]
    .filter(Boolean)
    .join("-");

  return `${base.replace(/[^a-z0-9._-]+/gi, "-").replace(/-+/g, "-")}.docx`;
}

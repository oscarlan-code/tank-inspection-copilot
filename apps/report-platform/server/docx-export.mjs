import { Resvg } from "@resvg/resvg-js";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  LineRuleType,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { buildLayoutFigureSvg } from "./layout-map-figure.mjs";
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
    }));
  }

  const document = new Document({
    creator: "LAIQ Report Platform",
    description: "API 653 report-platform DOCX export compiled from Android V2 Product field data.",
    title: `${reportState.reportJob.reportReference} ${reportState.reportJob.title}`,
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
      "This DOCX is compiled from the Android V2 Product export and report-platform section drafts. Layout maps are positioned in the API-standard report order near the related UT measurement sections.",
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
    tableRow(["No.", "Section", "Sample page", "Approval"], { header: true }),
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
      `Reference format: ${API_STANDARD_PRIMARY_REPORT.reference} ${API_STANDARD_PRIMARY_REPORT.sourceReportName}. This DOCX includes only approved sections selected by the user at export time.`,
      { color: "52677E" },
    ),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
      borders: tableBorders(),
    }),
  ];
}

function buildReportSection({ reportState, tocSection, draft, approved }) {
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
    children.push(...contentToDocxBlocks(content));
  } else {
    children.push(
      paragraph(
        "Pending generation. This section is present in the sample-report ToC but does not yet have an approved report-platform draft.",
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
      "Position note: this layout block is intentionally placed in the same ToC region as the sample report, adjacent to the related UT / finding section.",
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
            description: `${formatSurfaceLabel(surface)} layout figure generated from Android V2 Product layout data.`,
          },
        }),
      ],
    }),
    paragraph(`Figure: ${figure.title} generated from Android V2 Product layout data.`, {
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

function contentToDocxBlocks(content) {
  const blocks = [];
  const tableRegex = /<table[\s\S]*?<\/table>/gi;
  let lastIndex = 0;
  let match;

  while ((match = tableRegex.exec(content)) != null) {
    blocks.push(...textToParagraphs(content.slice(lastIndex, match.index)));
    const table = htmlTableToDocx(match[0]);
    if (table) blocks.push(table);
    lastIndex = match.index + match[0].length;
  }

  blocks.push(...textToParagraphs(content.slice(lastIndex)));

  return blocks.length > 0
    ? blocks
    : [paragraph("Pending content.", { italics: true, color: "52677E" })];
}

function htmlTableToDocx(html) {
  const rowMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const rows = rowMatches
    .map((rowHtml, rowIndex) => {
      const cells = [];
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowHtml)) != null) {
        cells.push(htmlToText(cellMatch[1]));
      }

      if (cells.length === 0) return null;
      return tableRow(cells, { header: rowIndex === 0 || /<th/i.test(rowHtml) });
    })
    .filter(Boolean);

  if (rows.length === 0) return null;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: tableBorders(),
  });
}

function textToParagraphs(value) {
  const text = htmlToText(value);
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const isHeading = isHeadingLine(line);
      const bullet = parseReportBullet(line);
      if (bullet) {
        return reportBulletParagraph(bullet.text, {
          symbol: bullet.symbol,
          spacingAfter: 95,
        });
      }

      return paragraph(line, {
        heading: isHeading ? HeadingLevel.HEADING_3 : undefined,
        bold: isHeading,
        color: isHeading ? BRAND_BLUE_DARK : "163250",
        spacingAfter: isHeading ? 90 : 100,
      });
    });
}

function htmlToText(value) {
  return decodeHtmlEntities(
    String(value ?? "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "➢ ")
      .replace(/<[^>]+>/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
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

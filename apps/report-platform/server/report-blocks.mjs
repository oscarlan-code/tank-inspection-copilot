const BLOCK_TAG_PATTERN = /<(h[1-6]|p|ul|ol|table|div|section)\b[^>]*>[\s\S]*?<\/\1>/gi;

export function buildReportBlockManifest(content, { sectionId = "section", includeHtml = false } = {}) {
  const html = String(content ?? "");
  const blocks = [];
  let match;
  let index = 0;

  while ((match = BLOCK_TAG_PATTERN.exec(html)) != null) {
    const blockHtml = match[0];
    const tagName = match[1].toLowerCase();
    const blockType = classifyReportBlock(blockHtml, tagName);
    index += 1;

    const block = {
      blockId: `${sectionId}:${blockType}:${index}`,
      blockType,
      tagName,
      startOffset: match.index,
      endOffset: match.index + blockHtml.length,
      label: buildReportBlockLabel(blockHtml, blockType, index),
      textPreview: stripHtml(blockHtml).slice(0, 360),
      htmlPreview: blockHtml.slice(0, 1200),
      capabilities: getReportBlockCapabilities(blockType),
      sourcePolicy: getReportBlockSourcePolicy(blockType),
    };

    if (includeHtml) {
      block.html = blockHtml;
    }

    blocks.push(block);
  }

  return blocks;
}

export function replaceReportBlockContent(content, blockId, replacementHtml, { sectionId = "section" } = {}) {
  const html = String(content ?? "");
  const blocks = buildReportBlockManifest(html, { sectionId });
  const block = blocks.find((item) => item.blockId === blockId);
  if (!block) {
    return html;
  }

  return `${html.slice(0, block.startOffset)}${replacementHtml}${html.slice(block.endOffset)}`;
}

export function findReportBlock(content, blockId, { sectionId = "section" } = {}) {
  return buildReportBlockManifest(content, { sectionId, includeHtml: true })
    .find((item) => item.blockId === blockId) ?? null;
}

export function stripHtml(value) {
  return String(value ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyReportBlock(blockHtml, tagName) {
  const normalized = String(blockHtml ?? "").toLowerCase();

  if (normalized.includes("checklist-report-table")) return "checklist_table";
  if (normalized.includes("report-measurement-table") || normalized.includes("measurement-report-table")) {
    return "measurement_table";
  }
  if (normalized.includes("layout-map") || normalized.includes("generated-map-figure")) return "layout_figure";
  if (/^h[1-6]$/.test(tagName)) return "heading";
  if (tagName === "p") return "paragraph";
  if (tagName === "ul" || tagName === "ol") return "bullet_list";
  if (tagName === "table") return "table";
  if (normalized.includes("data-laiq-provenance")) return "provenance_group";
  return "html_block";
}

function buildReportBlockLabel(blockHtml, blockType, index) {
  const text = stripHtml(blockHtml);
  const compact = text.length > 72 ? `${text.slice(0, 72)}...` : text;
  return compact || `${humanizeBlockType(blockType)} ${index}`;
}

function getReportBlockCapabilities(blockType) {
  const common = ["replace_text"];

  if (blockType === "checklist_table") {
    return ["set_checklist_marker", "resize_columns", "replace_text", "rebuild_from_app_data"];
  }

  if (blockType === "measurement_table") {
    return ["resize_columns", "add_derived_columns", "replace_text", "rebuild_from_app_data"];
  }

  if (blockType === "layout_figure") {
    return ["render_figure", "update_caption"];
  }

  if (blockType === "heading") {
    return [...common, "apply_heading_style"];
  }

  if (blockType === "paragraph" || blockType === "bullet_list" || blockType === "provenance_group") {
    return [...common, "rewrite_block", "apply_text_style"];
  }

  return [...common, "replace_block"];
}

function getReportBlockSourcePolicy(blockType) {
  if (blockType === "checklist_table" || blockType === "measurement_table") {
    return "app_structured_data_locked";
  }

  if (blockType === "layout_figure") {
    return "app_layout_geometry_locked";
  }

  if (blockType === "provenance_group") {
    return "preserve_visible_provenance";
  }

  return "editable_report_presentation";
}

function humanizeBlockType(value) {
  return String(value ?? "")
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

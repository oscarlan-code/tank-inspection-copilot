import DOMPurify from "dompurify";

export function normalizeSectionContent(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "<p></p>";
  }

  if (looksLikeHtml(trimmed)) {
    return trimmed;
  }

  return plainTextToHtml(trimmed);
}

export function sanitizeSectionContent(value: string): string {
  return DOMPurify.sanitize(ensureReportTableClasses(normalizeSectionContent(value)), {
    ADD_ATTR: ["class"],
    ADD_TAGS: ["table", "thead", "tbody", "tr", "th", "td"],
    USE_PROFILES: { html: true },
  });
}

function ensureReportTableClasses(value: string): string {
  return value
    .replace(/<div(?![^>]*class=)([^>]*)>\s*<table/gi, '<div class="report-table-wrap"$1><table')
    .replace(/<table(?![^>]*class=)([^>]*)>/gi, '<table class="report-measurement-table"$1>');
}

function plainTextToHtml(value: string): string {
  const blocks = value.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);

  return blocks
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.length === 0) {
        return "";
      }

      const bulletLines = lines.filter((line) => line.startsWith("- "));
      if (bulletLines.length === lines.length) {
        return `<ul>${bulletLines.map((line) => `<li>${escapeHtml(line.slice(2))}</li>`).join("")}</ul>`;
      }

      if (lines.length === 1 && isShortUppercaseHeading(lines[0])) {
        return `<h3>${escapeHtml(lines[0])}</h3>`;
      }

      return `<p>${lines.map(escapeHtml).join("<br />")}</p>`;
    })
    .join("");
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function isShortUppercaseHeading(value: string) {
  return value === value.toUpperCase() && value.length <= 72;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

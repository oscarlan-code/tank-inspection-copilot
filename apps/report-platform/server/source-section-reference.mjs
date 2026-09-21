import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

export const SOURCE_SECTION_REFERENCE_VERSION = "native-numbered-section-v1";
const execFileAsync = promisify(execFile);
const sectionTitles = {
  "inspection-report": /^inspection report$/i,
  "repair-recommendations": /^repair recommendations?(?:\s*\/.*)?$/i,
  "scope-of-inspection": /^scope(?: of inspection| of work)?$/i,
};

// Scoring-only source reconstruction. Never pass this result to generation.
export async function extractSourceSectionReference({ pdfPath, sectionId }) {
  const [{ stdout }, bytes] = await Promise.all([
    execFileAsync("pdftotext", ["-layout", pdfPath, "-"], { maxBuffer: 32 * 1024 * 1024 }),
    readFile(pdfPath),
  ]);
  return { ...parseNativeSectionReference(stdout, sectionId),
    sourceSha256: createHash("sha256").update(bytes).digest("hex"), sourcePath: pdfPath };
}

export function parseNativeSectionReference(nativeText, sectionId) {
  const titlePattern = sectionTitles[sectionId];
  if (!titlePattern) throw new Error(`Unsupported source reference section: ${sectionId}`);
  const pages = nativeText.split("\f");
  const marginOccurrences = new Map();
  for (const page of pages) {
    const pageLines = page.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const line of new Set([...pageLines.slice(0, 8), ...pageLines.slice(-8)])) {
      if (line.length > 8) marginOccurrences.set(line, (marginOccurrences.get(line) ?? 0) + 1);
    }
  }
  const headings = [];
  const lines = [];
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    for (const line of pages[pageIndex].split(/\r?\n/)) {
      const heading = line.trim().match(/^(\d+)(?:\.0)?[.)]?\s+([A-Z][A-Z /&()\d-]+)$/);
      if (heading) headings.push({ number: Number(heading[1]), title: heading[2].trim(),
        lineIndex: lines.length, pageNumber: pageIndex + 1 });
      lines.push({ text: line.trim(), pageNumber: pageIndex + 1 });
    }
  }
  const candidates = headings.filter((heading) => titlePattern.test(heading.title));
  if (candidates.length !== 1) throw new Error(`Expected one body heading for ${sectionId}; found ${candidates.length}`);
  const start = candidates[0];
  const end = headings.find((heading) => heading.lineIndex > start.lineIndex && heading.number === start.number + 1);
  if (!end) throw new Error(`No consecutive numbered closing boundary for ${sectionId}`);
  const selected = lines.slice(start.lineIndex, end.lineIndex).filter((line) => line.text);
  // Exclude repeated running metadata while retaining body text when sections share a page.
  const contentLines = selected.filter((line) => (marginOccurrences.get(line.text) ?? 0) < 3 && !/^(?:Client\s*:|Job No\.?\s*:|Tank No\.?\s*:|Page\s*:|Date Completed\s*:)/i.test(line.text));
  const content = contentLines.map((line) => line.text).join("\n");
  return { sectionId, content, pageNumbers: [...new Set(contentLines.map((line) => line.pageNumber))],
    contentSha256: createHash("sha256").update(content).digest("hex"),
    extractionVersion: SOURCE_SECTION_REFERENCE_VERSION,
    boundaries: { start, end } };
}

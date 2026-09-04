import { API_STANDARD_PRIMARY_REPORT, API_STANDARD_REPORT_TOC, getApiStandardTocSectionForPage } from "./report-toc.mjs";

const CANONICAL_SECTION_IDS = new Set(API_STANDARD_REPORT_TOC.map((section) => section.id));
export const REPORT_METADATA_SECTION_ID = "report-metadata";

function canonicalSectionId(value) {
  const sectionKey = String(value ?? "").trim().replace(/^\d+-/, "");
  if (CANONICAL_SECTION_IDS.has(sectionKey)) return sectionKey;
  if (sectionKey === "guidelines-for-the-interpretation-of-the-tru-flux-data-sheets") {
    return "guidelines-interpretation-tru-flux-data-sheets";
  }
  return null;
}

export function mapSourcePageToReportSection(sourcePageNumber) {
  return getApiStandardTocSectionForPage(
    { sourceReportName: API_STANDARD_PRIMARY_REPORT.sourceReportName },
    Number(sourcePageNumber),
  )?.id ?? "inspection-report";
}

export function buildReportSpecificSectionResolver(facts = []) {
  const anchorsByPage = new Map();
  for (const fact of facts) {
    const page = Number(fact.source_page_number ?? fact.sourcePageNumber);
    const sectionKey = canonicalSectionId(fact.section_key ?? fact.sectionKey);
    if (!Number.isFinite(page) || !sectionKey) continue;
    const existing = anchorsByPage.get(page) ?? [];
    if (!existing.includes(sectionKey)) existing.push(sectionKey);
    anchorsByPage.set(page, existing);
  }
  const anchorPages = [...anchorsByPage.keys()].sort((left, right) => left - right);

  return (fact) => {
    const sourceSectionKey = canonicalSectionId(fact.section_key ?? fact.sectionKey);
    if (sourceSectionKey) {
      return { sectionId: sourceSectionKey, basis: "source_section_key", aligned: true };
    }
    const page = Number(fact.source_page_number ?? fact.sourcePageNumber);
    if (!Number.isFinite(page)) {
      return { sectionId: REPORT_METADATA_SECTION_ID, basis: "report_metadata_without_page", aligned: false };
    }
    const samePage = anchorsByPage.get(page) ?? [];
    if (samePage.length === 1) {
      return { sectionId: samePage[0], basis: "same_report_same_page_anchor", aligned: true };
    }
    const priorPage = [...anchorPages].reverse().find((candidate) => candidate <= page);
    const priorSections = priorPage == null ? [] : anchorsByPage.get(priorPage) ?? [];
    if (priorSections.length === 1) {
      return { sectionId: priorSections[0], basis: "same_report_preceding_section_anchor", aligned: true };
    }
    return { sectionId: REPORT_METADATA_SECTION_ID, basis: "report_metadata_unresolved", aligned: false };
  };
}

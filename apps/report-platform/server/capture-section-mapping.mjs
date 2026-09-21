import { API_STANDARD_PRIMARY_REPORT, API_STANDARD_REPORT_TOC, getApiStandardTocSectionForPage } from "./report-toc.mjs";

const CANONICAL_SECTION_IDS = new Set(API_STANDARD_REPORT_TOC.map((section) => section.id));
export const REPORT_METADATA_SECTION_ID = "report-metadata";
export const CAPTURE_SECTION_MAPPING_CONTRACT_VERSION = "source_section_boundaries_v2";

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
    const boundary = fact.sourceSectionBoundary ?? fact.source_section_boundary;
    const parentSection = canonicalSectionId(boundary?.sectionId);
    if (boundary?.reviewStatus === "approved" && boundary?.sourceRevisionId && parentSection
      && Number.isFinite(Number(boundary.startPage)) && Number.isFinite(Number(boundary.endPage))
      && Number(boundary.startPage) <= page && page <= Number(boundary.endPage)) {
      return { sectionId: parentSection, basis: "reviewed_source_section_boundary", aligned: true };
    }
    // Page proximity is a review hint, not proof that an extracted subheading
    // belongs to a preceding section. Unknown intervening headings may be real
    // top-level boundaries, even on the same page.
    const samePage = anchorsByPage.get(page) ?? [];
    const priorPage = [...anchorPages].reverse().find((candidate) => candidate <= page);
    const priorSections = priorPage == null ? [] : anchorsByPage.get(priorPage) ?? [];
    return {
      sectionId: REPORT_METADATA_SECTION_ID,
      basis: "source_section_boundary_review_required",
      aligned: false,
      candidateSectionIds: samePage.length ? samePage : priorSections,
    };
  };
}

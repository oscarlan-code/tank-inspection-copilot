import { API_STANDARD_PRIMARY_REPORT, getApiStandardTocSectionForPage } from "./report-toc.mjs";

export function mapSourcePageToReportSection(sourcePageNumber) {
  return getApiStandardTocSectionForPage(
    { sourceReportName: API_STANDARD_PRIMARY_REPORT.sourceReportName },
    Number(sourcePageNumber),
  )?.id ?? "inspection-report";
}

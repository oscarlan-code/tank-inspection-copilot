import {
  API_STANDARD_MAP_SECTION_IDS,
  API_STANDARD_SHELL_MAP_SECTION_IDS,
  getApiStandardTocSection,
} from "./report-toc.mjs";

export function buildStandardRuleChecks({
  sectionId,
  exportPackage,
  reportClassification,
  mapArtifacts = [],
}) {
  const tocSection = getApiStandardTocSection(sectionId);
  const checks = [
    {
      ruleId: "classification.primary_code_basis",
      label: "Primary code basis classified",
      status: reportClassification?.primaryCodes?.some((code) => code.codeId === "api-653")
        ? "pass"
        : "review",
      source: "report-classification",
      message:
        reportClassification?.primaryCodes?.some((code) => code.codeId === "api-653")
          ? "Report classified with API 653 as the primary standard basis."
          : "Primary API 653 basis is not confirmed.",
    },
    {
      ruleId: "field_package.validation_results",
      label: "Android export validation results available",
      status: exportPackage.validationResults?.length > 0 ? "pass" : "review",
      source: "android-export",
      message:
        exportPackage.validationResults?.length > 0
          ? `${exportPackage.validationResults.filter((result) => result.passed).length}/${exportPackage.validationResults.length} Android export validation checks passed.`
          : "No Android export validation results were available.",
    },
  ];

  if (tocSection) {
    checks.push({
      ruleId: "template.api_standard_toc_match",
      label: "API-standard ToC section resolved",
      status: "pass",
      source: "template-resolver",
      message: `Section maps to ${tocSection.number} ${tocSection.title}.`,
    });
  }

  if (API_STANDARD_MAP_SECTION_IDS.has(sectionId)) {
    checks.push({
      ruleId: "layout.geometry_source_required",
      label: "Layout geometry source required",
      status: API_STANDARD_SHELL_MAP_SECTION_IDS.has(sectionId) && mapArtifacts.length > 0
        ? "pass"
        : "review",
      source: "layout-map-toolchain",
      message:
        API_STANDARD_SHELL_MAP_SECTION_IDS.has(sectionId) && mapArtifacts.length > 0
          ? "Shell layout geometry is available from the Android export baseline."
          : "This map section must remain in review until approved geometry/source data exists.",
    });
  }

  return checks;
}

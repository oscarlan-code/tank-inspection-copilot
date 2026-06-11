import { API_STANDARD_PRIMARY_REPORT } from "./report-toc.mjs";

export function classifyReportPackage(exportPackage) {
  const hasInternalExternalScope = true;
  const isVerticalAst = Boolean(exportPackage?.inspectionRecord?.heightM && exportPackage?.inspectionRecord?.diameterM);
  const hasShellEvidence = (exportPackage?.layoutConfigs ?? []).some((config) => config.targetKey === "shell");
  const hasMpiEvidence = (exportPackage?.findings ?? []).some((finding) => /mpi|hw|weld/i.test(finding.itemLabel));

  const primaryCodes = [
    {
      codeId: "api-653",
      label: "API 653",
      role: "primary",
      applicability: "applies",
      reason: "Primary standard for inspection, repair, alteration, and reconstruction of aboveground storage tanks.",
    },
  ];

  const supportingCodes = [
    {
      codeId: "eemua-159",
      label: "EEMUA 159",
      role: "supporting",
      applicability: "conditional",
      reason: "Useful supporting guidance for inspection and maintenance regime wording.",
    },
    {
      codeId: "api-650",
      label: "API 650",
      role: "supporting",
      applicability: "conditional",
      reason: "Useful where shell, roof, settlement, design basis, or minimum thickness context needs design-standard reference.",
    },
    {
      codeId: "api-575",
      label: "API 575",
      role: "supporting",
      applicability: "conditional",
      reason: "Useful for atmospheric and low-pressure tank inspection practice context.",
    },
  ];

  if (hasInternalExternalScope) {
    supportingCodes.push({
      codeId: "api-652",
      label: "API 652",
      role: "supporting",
      applicability: "conditional",
      reason: "Potentially relevant to floor/bottom lining and corrosion protection sections when lining data is present.",
    });
  }

  if (hasMpiEvidence || hasShellEvidence) {
    supportingCodes.push({
      codeId: "api-577",
      label: "API 577",
      role: "supporting",
      applicability: "conditional",
      reason: "Potentially relevant to welding inspection, repair welds, and NDT context.",
    });
  }

  return {
    reportFamilyId: hasInternalExternalScope ? "api653-internal-external" : "api653-general",
    reportFamilyLabel: hasInternalExternalScope
      ? "API 653 Internal & External AST Inspection"
      : "API 653 AST Inspection",
    inspectionMode: hasInternalExternalScope ? "Internal and external" : "General inspection",
    tankType: isVerticalAst ? "Vertical aboveground storage tank" : "Aboveground storage tank",
    primaryFormatPrecedent: `${API_STANDARD_PRIMARY_REPORT.reference} - ${API_STANDARD_PRIMARY_REPORT.title}`,
    formatRationale:
      "The Android export is classified as a vertical AST inspection package, so the platform follows the API-standard internal/external sample report ToC and formatting before applying section-specific edits.",
    primaryCodes,
    supportingCodes,
    excludedCodes: [
      {
        codeId: "api-620",
        label: "API 620",
        role: "not_applicable",
        applicability: "excluded",
        reason: "Not the default basis for this atmospheric vertical AST report unless the tank design basis proves API 620.",
      },
      {
        codeId: "sti-sp001",
        label: "STI SP001",
        role: "not_applicable",
        applicability: "excluded",
        reason: "More suitable for shop-fabricated tanks; this workspace is classified as field-erected API 653 style unless corrected by the user.",
      },
    ],
  };
}

export const EVALUATION_CASE_SCHEMA_VERSION = 1;

const V10_API_STANDARD_CASE = Object.freeze({
  caseId: "eval_case_v10_api653_internal_external_v1",
  displayName: "V10 API 653 internal and external inspection",
  inputInspectionIds: ["inspection-demo-api653-training-20220722"],
  inputPackageTypes: ["v3_product_export"],
  goldReference: Object.freeze({
    sourceReportName: "22PE1-4 TK V10 Internal & External Inspection Report",
    role: "gold_holdout",
    retrievalExclusionRequired: true,
  }),
  retrievalLabels: Object.freeze({
    mode: "gold_section_weak_supervision",
    maximumRelevantChunksPerSection: 12,
    reviewStatus: "machine_proposed",
  }),
  outputFactReference: Object.freeze({
    mode: "paired_app_capture",
    literalGoldFactComparison: false,
    reason:
      "The V3 training package preserves the report scenario but sanitizes client, tank, site, and identifiers. Current app facts are the literal source of truth; the hidden report provides structure, coverage, and retrieval relevance guidance.",
  }),
});

const EVALUATION_CASES = Object.freeze([V10_API_STANDARD_CASE]);

export function resolveEvaluationCase(reportState) {
  const exportPackage = reportState?.exportPackage ?? {};
  const sourceInspectionId = String(
    exportPackage.sourceInspectionId
      ?? exportPackage.inspectionId
      ?? exportPackage.task?.inspectionId
      ?? exportPackage.inspectionRecord?.inspectionId
      ?? "",
  );
  const packageType = String(exportPackage.packageType ?? "");

  return EVALUATION_CASES.find((evaluationCase) => (
    evaluationCase.inputInspectionIds.includes(sourceInspectionId)
      && evaluationCase.inputPackageTypes.includes(packageType)
  )) ?? null;
}

export function listEvaluationCases() {
  return EVALUATION_CASES.map((evaluationCase) => structuredClone(evaluationCase));
}

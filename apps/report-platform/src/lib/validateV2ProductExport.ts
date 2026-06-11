import type { V2ProductExportPackage } from "../domain/v2ProductExport";

export function validateV2ProductExportPackage(
  exportPackage: V2ProductExportPackage,
): string[] {
  const issues: string[] = [];

  if (exportPackage.packageType !== "v2_product_export") {
    issues.push(`packageType must be "v2_product_export", received "${exportPackage.packageType}".`);
  }

  if (exportPackage.schemaVersion !== 2) {
    issues.push(`schemaVersion must be 2 for the current adapter, received ${exportPackage.schemaVersion}.`);
  }

  if (!exportPackage.inspectionId.trim()) {
    issues.push("inspectionId is required.");
  }

  if (!exportPackage.inspectionReference.trim()) {
    issues.push("inspectionReference is required.");
  }

  if (exportPackage.task.inspectionId !== exportPackage.inspectionId) {
    issues.push("task.inspectionId must match the package inspectionId.");
  }

  if (exportPackage.inspectionRecord.inspectionId !== exportPackage.inspectionId) {
    issues.push("inspectionRecord.inspectionId must match the package inspectionId.");
  }

  if (exportPackage.profile.tenantId !== exportPackage.tenantId) {
    issues.push("profile.tenantId must match the package tenantId.");
  }

  if (exportPackage.profile.workspaceId !== exportPackage.workspaceId) {
    issues.push("profile.workspaceId must match the package workspaceId.");
  }

  if (exportPackage.task.tenantId !== exportPackage.tenantId) {
    issues.push("task.tenantId must match the package tenantId.");
  }

  if (exportPackage.task.workspaceId !== exportPackage.workspaceId) {
    issues.push("task.workspaceId must match the package workspaceId.");
  }

  if (!exportPackage.layoutTargets.some((target) => target.targetKey === "shell" && target.inLayoutScope)) {
    issues.push("At least one in-scope shell layout target is required for the shell-internal report preview.");
  }

  if (!exportPackage.layoutConfigs.some((config) => config.targetKey === "shell")) {
    issues.push("A shell layoutConfig is required for the shell-internal report preview.");
  }

  if (exportPackage.validationResults.length === 0) {
    issues.push("validationResults cannot be empty.");
  }

  if (exportPackage.taskSnapshots.length === 0) {
    issues.push("taskSnapshots cannot be empty.");
  }

  return issues;
}

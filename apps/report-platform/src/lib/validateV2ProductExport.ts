import type { V2ProductExportPackage } from "../domain/v2ProductExport";

export function validateV2ProductExportPackage(
  exportPackage: V2ProductExportPackage,
): string[] {
  const issues: string[] = [];

  if (exportPackage.packageType !== "v3_product_export") {
    issues.push(`packageType must be "v3_product_export", received "${exportPackage.packageType}".`);
  }

  if (exportPackage.schemaVersion !== 3) {
    issues.push(`schemaVersion must be 3 for the current adapter, received ${exportPackage.schemaVersion}.`);
  }

  if (!Array.isArray(exportPackage.voiceNotes)) {
    issues.push("voiceNotes[] is required for V3 report generation context routing.");
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
    issues.push("At least one in-scope shell layout target is required for the API-standard V10 report preview.");
  }

  if (!exportPackage.layoutConfigs.some((config) => config.targetKey === "shell")) {
    issues.push("A shell layoutConfig is required for the API-standard V10 report preview.");
  }

  const floorTarget = exportPackage.layoutTargets.find((target) => target.targetKey === "floor");
  const floorConfig = exportPackage.layoutConfigs.find((config) => config.targetKey === "floor");
  if (floorTarget?.inLayoutScope || floorConfig) {
    const layout = isRecord(floorConfig?.customCircularLayout)
      ? floorConfig.customCircularLayout
      : null;
    const mainGeometry = layout && Array.isArray(layout.resolvedMainPlateGeometry)
      ? layout.resolvedMainPlateGeometry
      : [];
    const annularGeometry = layout && Array.isArray(layout.resolvedAnnularPlateGeometry)
      ? layout.resolvedAnnularPlateGeometry
      : [];

    if (layout?.resolvedGeometryVersion !== 2 || mainGeometry.length === 0) {
      issues.push("The V3 floor layout must include resolvedGeometryVersion 2 and resolvedMainPlateGeometry from the LAIQ inspection app.");
    }

    const expectedAnnularCount = floorConfig?.floorTemplate === "circular_plate_ar"
      ? floorConfig.floorAnnularSectionCount ?? 0
      : 0;
    if (annularGeometry.length !== expectedAnnularCount) {
      issues.push(
        `The V3 floor layout must include ${expectedAnnularCount} app-resolved annular polygons; received ${annularGeometry.length}.`,
      );
    }

    if (floorConfig?.floorPlateCount && mainGeometry.length !== floorConfig.floorPlateCount) {
      issues.push(
        `The V3 floor layout resolved ${mainGeometry.length} main plates but floorPlateCount is ${floorConfig.floorPlateCount}.`,
      );
    }

    const floorFigure = exportPackage.layoutFigures?.find((figure) => figure.targetKey === "floor");
    if (!floorFigure) {
      issues.push("The V3 floor layout must include the app-owned floor SVG in layoutFigures[].");
    } else {
      issues.push(...validateAppOwnedFloorFigure(floorFigure));
    }
  }

  for (const element of exportPackage.elements) {
    if (
      !Number.isFinite(element.normalizedX) ||
      !Number.isFinite(element.normalizedY) ||
      element.normalizedX < 0 ||
      element.normalizedX > 1 ||
      element.normalizedY < 0 ||
      element.normalizedY > 1
    ) {
      issues.push(`Element ${element.elementId} has invalid normalized app-map coordinates.`);
    }
  }

  if (exportPackage.validationResults.length === 0) {
    issues.push("validationResults cannot be empty.");
  }

  if (exportPackage.taskSnapshots.length === 0) {
    issues.push("taskSnapshots cannot be empty.");
  }

  return issues;
}

function validateAppOwnedFloorFigure(figure: NonNullable<V2ProductExportPackage["layoutFigures"]>[number]): string[] {
  const issues: string[] = [];
  if (figure.mediaType !== "image/svg+xml") issues.push("The app-owned floor figure mediaType must be image/svg+xml.");
  if (figure.renderVersion !== 1 || figure.sourceGeometryVersion !== 2) {
    issues.push("The app-owned floor figure must use renderVersion 1 and sourceGeometryVersion 2.");
  }
  if (figure.width !== 1000 || figure.height !== 1000 || figure.viewBox !== "0 0 1000 1000") {
    issues.push("The app-owned floor figure must use the normalized 1000 x 1000 app viewport.");
  }
  if (!/^[a-f0-9]{64}$/i.test(figure.sha256)) issues.push("The app-owned floor figure requires a SHA-256 digest.");
  if (!isSafeAppOwnedSvg(figure.svg)) issues.push("The app-owned floor figure contains unsupported or unsafe SVG content.");
  return issues;
}

function isSafeAppOwnedSvg(svg: string): boolean {
  if (typeof svg !== "string" || svg.length === 0 || svg.length > 500_000 || !/^<svg\b/i.test(svg)) return false;
  const withoutInternalUrls = svg.replace(/url\(#[A-Za-z0-9_.:-]+\)/g, "");
  return !/<(?:script|foreignObject|image|use|a)\b/i.test(svg)
    && !/\bon[a-z]+\s*=/i.test(svg)
    && !/\b(?:href|xlink:href)\s*=/i.test(svg)
    && !/<!DOCTYPE|<!ENTITY/i.test(svg)
    && !/javascript:|data:/i.test(svg)
    && !/url\s*\(/i.test(withoutInternalUrls)
    && !/https?:\/\/(?!www\.w3\.org\/2000\/svg)/i.test(svg);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

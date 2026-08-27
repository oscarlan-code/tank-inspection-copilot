import { createHash } from "node:crypto";

export function buildApiStandardFixturePackage(exportPackage) {
  return exportPackage;
}

export function buildAccountScopedDemoFixturePackage({
  bootstrapKey,
  exportPackage,
  principal,
}) {
  const membership = principal.workspaceMemberships.find(
    (candidate) => candidate.workspaceId === principal.primaryWorkspaceId,
  ) ?? principal.workspaceMemberships[0];
  if (!membership) {
    return null;
  }

  const accountScopeKey = createHash("sha256")
    .update(principal.userId)
    .digest("hex")
    .slice(0, 16);
  const inspectionId = `${exportPackage.inspectionId}-account-${accountScopeKey}`;
  const replacements = new Map([
    [exportPackage.inspectionId, inspectionId],
    [exportPackage.tenantId, principal.tenantId],
    [exportPackage.workspaceId, membership.workspaceId],
    [exportPackage.profile?.tenantName, principal.tenantName],
    [exportPackage.profile?.workspaceName, membership.workspaceName],
    [exportPackage.profile?.userId, principal.userId],
    [exportPackage.profile?.displayName, principal.displayName],
  ].filter(([source]) => typeof source === "string" && source.length > 0));
  const scopedPackage = replaceExactValues(exportPackage, replacements);

  // Account scoping changes the operational inspection ID. Retain the immutable
  // source identity so evaluator-only training pairs remain resolvable.
  scopedPackage.sourceInspectionId = exportPackage.sourceInspectionId ?? exportPackage.inspectionId;

  scopedPackage.profile = {
    ...scopedPackage.profile,
    roleLabel: membership.roles[0] ?? scopedPackage.profile?.roleLabel ?? "Inspector",
  };

  return {
    bootstrapKey: `${bootstrapKey}:account:${accountScopeKey}`,
    exportPackage: scopedPackage,
  };
}

function replaceExactValues(value, replacements) {
  if (Array.isArray(value)) {
    return value.map((item) => replaceExactValues(item, replacements));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceExactValues(item, replacements)]),
    );
  }
  return replacements.has(value) ? replacements.get(value) : value;
}

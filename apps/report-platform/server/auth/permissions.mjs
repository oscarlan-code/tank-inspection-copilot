import { ApiError } from "../store.mjs";

export const REPORT_PERMISSIONS = Object.freeze({
  READ: "report:read",
  IMPORT: "report:import",
  EDIT: "report:edit",
  GENERATE: "report:generate",
  APPROVE: "report:approve",
  EXPORT: "report:export",
  KB_SEARCH: "knowledge-base:search",
  KB_MANAGE: "knowledge-base:manage",
});

const ROLE_PERMISSIONS = new Map([
  ["super_admin", new Set(["*"])],
  ["manager", new Set([
    REPORT_PERMISSIONS.READ,
    REPORT_PERMISSIONS.IMPORT,
    REPORT_PERMISSIONS.EDIT,
    REPORT_PERMISSIONS.GENERATE,
    REPORT_PERMISSIONS.APPROVE,
    REPORT_PERMISSIONS.EXPORT,
    REPORT_PERMISSIONS.KB_SEARCH,
  ])],
  ["inspector", new Set([
    REPORT_PERMISSIONS.READ,
    REPORT_PERMISSIONS.IMPORT,
    REPORT_PERMISSIONS.EDIT,
    REPORT_PERMISSIONS.GENERATE,
    REPORT_PERMISSIONS.APPROVE,
    REPORT_PERMISSIONS.EXPORT,
    REPORT_PERMISSIONS.KB_SEARCH,
  ])],
  ["reviewer", new Set([
    REPORT_PERMISSIONS.READ,
    REPORT_PERMISSIONS.EDIT,
    REPORT_PERMISSIONS.GENERATE,
    REPORT_PERMISSIONS.APPROVE,
    REPORT_PERMISSIONS.EXPORT,
    REPORT_PERMISSIONS.KB_SEARCH,
  ])],
  ["client_viewer", new Set([])],
]);

export function authorizePlatformPermission(principal, permission) {
  if (hasPermission(principal.platformRoles, permission)) {
    return;
  }

  throw forbidden(permission);
}

export function authorizeWorkspacePermission(principal, scope, permission) {
  if (!scope?.tenantId || !scope?.workspaceId) {
    throw new ApiError(404, "Requested product resource was not found.", "resource_not_found");
  }

  if (hasPermission(principal.platformRoles, permission)) {
    return;
  }

  if (principal.tenantId !== scope.tenantId) {
    throw forbidden(permission);
  }

  const membership = principal.workspaceMemberships.find(
    (candidate) => candidate.workspaceId === scope.workspaceId,
  );
  if (!membership || !hasPermission(membership.roles, permission)) {
    throw forbidden(permission);
  }
}

export function authorizeImportPackage(principal, exportPackage) {
  const scope = {
    tenantId: exportPackage?.tenantId,
    workspaceId: exportPackage?.workspaceId,
  };
  authorizeWorkspacePermission(principal, scope, REPORT_PERMISSIONS.IMPORT);
}

export function hasPermission(roles, permission) {
  return (roles ?? []).some((role) => {
    const permissions = ROLE_PERMISSIONS.get(normalizeRole(role));
    return permissions?.has("*") || permissions?.has(permission);
  });
}

export function normalizeRole(role) {
  return String(role ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function forbidden(permission) {
  return new ApiError(
    403,
    "You do not have permission to perform this action in the selected workspace.",
    `permission_denied:${permission}`,
  );
}

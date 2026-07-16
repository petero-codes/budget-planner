import type { User } from "@/domain/entities";

/** Portal persona used for dashboards, nav, and client UI. */
export type OrgRole =
  | "employee"
  | "manager"
  | "gm"
  | "finance"
  | "systemAdmin";

/**
 * Resolve org role from user identity fields.
 * Shared by AuthorizationService and client components (no duplicate logic).
 */
export function resolveOrgRole(
  user: Pick<User, "roleCodes" | "managerId" | "permissionCodes">
): OrgRole {
  if (user.roleCodes.includes("SystemAdmin")) return "systemAdmin";
  if (user.roleCodes.includes("FinanceAdministrator")) return "finance";
  if (
    user.managerId === null &&
    user.permissionCodes.includes("budget.approve")
  ) {
    return "gm";
  }
  if (user.permissionCodes.includes("budget.approve")) return "manager";
  return "employee";
}

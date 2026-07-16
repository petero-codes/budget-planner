import type { User } from "@/domain/entities";
import {
  isDevelopmentToolkitEnabled,
  isDevelopmentToolkitPath,
} from "@/lib/development-toolkit-access";

export type PortalAccessOptions = {
  /** From /api/v1/me — required on the client (env flag is not in the browser bundle). */
  developmentToolkitEnabled?: boolean;
};

/**
 * Live permission gate for portal paths (matches middleware coarse RBAC,
 * but evaluated from DB-backed /api/v1/me — not stale cookie claims).
 */
export function canAccessPath(
  pathname: string,
  user: User,
  options?: PortalAccessOptions
): boolean {
  if (isDevelopmentToolkitPath(pathname)) {
    const toolkitOn =
      options?.developmentToolkitEnabled ?? isDevelopmentToolkitEnabled();
    return toolkitOn && user.roleCodes.includes("SystemAdmin");
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (
      pathname === "/admin/users" ||
      pathname.startsWith("/admin/users/")
    ) {
      return user.permissionCodes.includes("admin.users");
    }
    if (
      pathname === "/admin/fiscal-years" ||
      pathname.startsWith("/admin/fiscal-years/")
    ) {
      return (
        user.permissionCodes.includes("fy.manage") ||
        user.permissionCodes.includes("admin.masterdata") ||
        user.permissionCodes.includes("admin.users")
      );
    }
    if (
      pathname === "/admin/support" ||
      pathname.startsWith("/admin/support/")
    ) {
      return user.roleCodes.includes("SystemAdmin");
    }
    return (
      user.permissionCodes.includes("admin.users") ||
      user.permissionCodes.includes("admin.masterdata")
    );
  }
  if (pathname === "/support" || pathname.startsWith("/support/")) {
    return true; // any authenticated portal user
  }
  if (pathname === "/finance" || pathname.startsWith("/finance/")) {
    return user.permissionCodes.includes("finance.view");
  }
  if (pathname === "/audit" || pathname.startsWith("/audit/")) {
    return user.permissionCodes.includes("audit.view");
  }
  if (pathname === "/reports" || pathname.startsWith("/reports/")) {
    return user.permissionCodes.includes("report.view");
  }
  return true;
}

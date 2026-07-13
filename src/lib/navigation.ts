import type { PermissionCode } from "@/domain/value-objects/budget-status";
import type { User } from "@/domain/entities";
import {
  Bell,
  ClipboardCheck,
  FilePlus2,
  FolderOpen,
  Home,
  ScrollText,
  UserRound,
  BarChart3,
  Settings,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  permission?: PermissionCode;
}

/**
 * Navigation is generated from permissions only.
 * Staff (SSO) never see Administration.
 * SystemAdmin only sees admin + audit (+ optional reports).
 */
export function getNavItems(user: User): NavItem[] {
  const isAdmin = user.roleCodes.includes("SystemAdmin");

  if (isAdmin) {
    return [
      { href: "/admin", label: "Administration", icon: Settings, permission: "admin.users" },
      { href: "/audit", label: "Audit Trail", icon: ScrollText, permission: "audit.view" },
      { href: "/reports", label: "Reports", icon: BarChart3, permission: "report.view" },
      { href: "/profile", label: "My Profile", icon: UserRound },
    ].filter(
      (item) =>
        !item.permission || user.permissionCodes.includes(item.permission)
    );
  }

  // Staff dashboard — only what this user is allowed to see
  const items: NavItem[] = [
    { href: "/home", label: "My Dashboard", icon: Home },
    {
      href: "/budgets",
      label: "My Budget Plans",
      icon: FolderOpen,
      permission: "budget.create",
    },
    {
      href: "/budgets/create",
      label: "Create Budget",
      icon: FilePlus2,
      permission: "budget.create",
    },
    {
      href: "/approvals",
      label: "Approvals",
      icon: ClipboardCheck,
      permission: "budget.approve",
    },
    {
      href: "/reports",
      label: "Reports",
      icon: BarChart3,
      permission: "report.view",
    },
    {
      href: "/audit",
      label: "Audit Trail",
      icon: ScrollText,
      permission: "audit.view",
    },
    { href: "/notifications", label: "Notifications", icon: Bell },
    { href: "/profile", label: "My Profile", icon: UserRound },
  ];

  return items.filter((item) => {
    if (!item.permission) return true;
    return user.permissionCodes.includes(item.permission);
  });
}

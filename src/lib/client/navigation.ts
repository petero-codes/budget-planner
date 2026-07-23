import "client-only";

import type { PermissionCode } from "@/domain/value-objects/budget-status";
import type { User } from "@/domain/entities";
import { isDevelopmentToolkitEnabled } from "@/lib/shared/development-toolkit-access";
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
  CalendarRange,
  Landmark,
  Wrench,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  permission?: PermissionCode;
}

export type NavOptions = {
  developmentToolkitEnabled?: boolean;
};

export function getNavItems(user: User, options?: NavOptions): NavItem[] {
  const isSystemAdmin = user.roleCodes.includes("SystemAdmin");
  const isFinance = user.roleCodes.includes("FinanceAdministrator");
  const toolkitOn =
    options?.developmentToolkitEnabled ?? isDevelopmentToolkitEnabled();

  if (isSystemAdmin) {
    const items: NavItem[] = [
      { href: "/admin", label: "Administration", icon: Settings, permission: "admin.users" },
      { href: "/audit", label: "Audit Trail", icon: ScrollText, permission: "audit.view" },
      { href: "/profile", label: "My Profile", icon: UserRound },
    ];
    if (toolkitOn) {
      items.splice(1, 0, {
        href: "/admin/development",
        label: "Development Toolkit",
        icon: Wrench,
      });
    }
    return items.filter(
      (item) =>
        !item.permission || user.permissionCodes.includes(item.permission)
    );
  }

  if (isFinance) {
    const items: NavItem[] = [
      {
        href: "/finance",
        label: "Finance Queue",
        icon: Landmark,
        permission: "finance.view",
      },
      {
        href: "/admin/fiscal-years",
        label: "Financial Years",
        icon: CalendarRange,
        permission: "fy.manage",
      },
      { href: "/reports", label: "Reports", icon: BarChart3, permission: "report.view" },
      { href: "/audit", label: "Audit Trail", icon: ScrollText, permission: "audit.view" },
      { href: "/profile", label: "My Profile", icon: UserRound },
    ];
    return items.filter(
      (item) =>
        !item.permission || user.permissionCodes.includes(item.permission)
    );
  }

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

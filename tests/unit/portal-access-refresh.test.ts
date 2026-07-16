import { describe, expect, it } from "vitest";
import type { User } from "@/domain/entities";
import { canAccessPath } from "@/lib/portal-access";
import { getNavItems } from "@/lib/navigation";

function user(partial: Partial<User> & Pick<User, "id" | "roleCodes" | "permissionCodes">): User {
  return {
    name: "Test",
    email: "test@kengen.co.ke",
    positionId: "p",
    managerId: null,
    departmentId: "d",
    primaryCostCenterId: "cc",
    active: true,
    ...partial,
  };
}

describe("R3 — permission refresh after Finance role revocation", () => {
  const finance = user({
    id: "fin",
    roleCodes: ["FinanceAdministrator"],
    permissionCodes: [
      "finance.view",
      "finance.claim",
      "finance.finalize",
      "finance.return",
      "report.view",
      "report.export",
      "audit.view",
      "fy.manage",
    ],
  });

  /** Admin removed FinanceAdministrator role and finance.* permissions. */
  const revoked = user({
    id: "fin",
    roleCodes: ["BudgetSubmitter"],
    permissionCodes: ["budget.create", "budget.submit"],
  });

  it("blocks Finance paths after finance.view is removed", () => {
    expect(canAccessPath("/finance", finance)).toBe(true);
    expect(canAccessPath("/finance/sap/abc", finance)).toBe(true);
    expect(canAccessPath("/finance", revoked)).toBe(false);
    expect(canAccessPath("/finance/sap/abc", revoked)).toBe(false);
  });

  it("removes Finance Dashboard from navigation after role revocation", () => {
    const before = getNavItems(finance).map((i) => i.href);
    expect(before).toContain("/finance");

    const after = getNavItems(revoked).map((i) => i.href);
    expect(after).not.toContain("/finance");
    expect(after).not.toContain("/admin/fiscal-years");
  });

  it("still allows non-privileged pages after revocation", () => {
    expect(canAccessPath("/home", revoked)).toBe(true);
    expect(canAccessPath("/profile", revoked)).toBe(true);
    expect(canAccessPath("/notifications", revoked)).toBe(true);
  });

  it("blocks admin/reports/audit without matching permissions", () => {
    expect(canAccessPath("/admin", revoked)).toBe(false);
    expect(canAccessPath("/reports", revoked)).toBe(false);
    expect(canAccessPath("/audit", revoked)).toBe(false);
  });
});

describe("Development Tools nav / access (client flag from /api/v1/me)", () => {
  const admin = user({
    id: "admin",
    roleCodes: ["SystemAdmin"],
    permissionCodes: ["admin.users", "admin.masterdata", "audit.view"],
  });

  it("shows Development Tools in nav when toolkit flag is on", () => {
    const hrefs = getNavItems(admin, {
      developmentToolkitEnabled: true,
    }).map((i) => i.href);
    expect(hrefs).toContain("/admin/development");
  });

  it("hides Development Tools in nav when toolkit flag is off", () => {
    const hrefs = getNavItems(admin, {
      developmentToolkitEnabled: false,
    }).map((i) => i.href);
    expect(hrefs).not.toContain("/admin/development");
  });

  it("allows /admin/development for SystemAdmin when flag is on", () => {
    expect(
      canAccessPath("/admin/development", admin, {
        developmentToolkitEnabled: true,
      })
    ).toBe(true);
    expect(
      canAccessPath("/admin/development", admin, {
        developmentToolkitEnabled: false,
      })
    ).toBe(false);
  });
});

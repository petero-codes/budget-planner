import { describe, expect, it } from "vitest";
import { AuthorizationService } from "@/application/authorization-service";
import type { BudgetPlan, CostCenter, User } from "@/domain/entities";
import type {
  IAuditLogRepository,
  ICostCenterRepository,
  IUserRepository,
} from "@/infrastructure/repositories/interfaces";
import type { AuditLogEntry } from "@/domain/entities";

const peter: User = {
  id: "peter",
  name: "Peter",
  email: "peter@test",
  positionId: "p",
  managerId: "gm",
  departmentId: "d",
  primaryCostCenterId: "cc-a",
  active: true,
  roleCodes: ["BudgetSubmitter", "BudgetApprover"],
  permissionCodes: [
    "budget.create",
    "budget.submit",
    "budget.approve",
    "report.view",
  ],
};

const employee: User = {
  ...peter,
  id: "emp",
  name: "Emp",
  managerId: "peter",
  primaryCostCenterId: "cc-a",
  roleCodes: ["BudgetSubmitter"],
  permissionCodes: ["budget.create", "budget.submit"],
};

const geoffrey: User = {
  ...peter,
  id: "geoff",
  name: "Geoffrey",
  primaryCostCenterId: "cc-c",
};

const finance: User = {
  ...peter,
  id: "fin",
  managerId: null,
  roleCodes: ["FinanceAdministrator"],
  permissionCodes: ["finance.view", "report.view", "report.export", "audit.view"],
};

const admin: User = {
  ...peter,
  id: "admin",
  managerId: null,
  roleCodes: ["SystemAdmin"],
  permissionCodes: ["admin.users", "audit.view", "fy.manage"],
};

const gm: User = {
  ...peter,
  id: "gm",
  managerId: null,
  roleCodes: ["BudgetSubmitter", "BudgetApprover"],
  permissionCodes: [
    "budget.create",
    "budget.submit",
    "budget.approve",
    "budget.reject",
    "report.view",
    "audit.view",
  ],
};

const centers: CostCenter[] = [
  {
    id: "cc-a",
    code: "A",
    sapCostCenterCode: null,
    name: "Cost Center A",
    departmentId: "d",
    managerId: "peter",
    responsiblePersonId: null,
    isActive: true,
  },
  {
    id: "cc-b",
    code: "B",
    sapCostCenterCode: null,
    name: "Cost Center B",
    departmentId: "d",
    managerId: "peter",
    responsiblePersonId: null,
    isActive: true,
  },
  {
    id: "cc-c",
    code: "C",
    sapCostCenterCode: null,
    name: "Cost Center C",
    departmentId: "d",
    managerId: "geoff",
    responsiblePersonId: null,
    isActive: true,
  },
];

function plan(partial: Partial<BudgetPlan> & { id: string; ownerId: string; costCenterId: string }): BudgetPlan {
  return {
    budgetType: "Primary",
    fiscalYearId: "fy",
    fromPeriod: "2026-07-01",
    toPeriod: "2027-06-30",
    description: null,
    status: "InApproval",
    currentApproverId: null,
    submittedAt: null,
    sapVersion: null,
    lines: [{ id: "l1", glAccountId: "g", amount: 100, lineNumber: 1 }],
    version: 1,
    createdAt: "",
    updatedAt: "",
    lineageId: null,
    parentBudgetPlanId: null,
    lineageRevision: 1,
    versionLabel: null,
    amendmentReason: null,
    isArchived: false,
    claimDueAt: null,
    reviewDueAt: null,
    escalationStatus: "None",
    financeClaimedAt: null,
    financeClaimedBy: null,
    ...partial,
  };
}

class FakeUsers implements IUserRepository {
  async getById() {
    return null;
  }
  async getAll() {
    return [peter, employee, geoffrey, finance, admin, gm];
  }
  async getUsersByIdMap() {
    return new Map();
  }
  async getDescendantIds() {
    return [];
  }
}

class FakeCCs implements ICostCenterRepository {
  async getById(id: string) {
    return centers.find((c) => c.id === id) ?? null;
  }
  async getAll() {
    return centers;
  }
}

class FakeAudits implements IAuditLogRepository {
  entries: AuditLogEntry[] = [];

  async append(entry: AuditLogEntry) {
    this.entries.push(entry);
  }

  async list() {
    return this.entries;
  }
}

describe("AuthorizationService role scopes", () => {
  const audits = new FakeAudits();
  const authz = new AuthorizationService(new FakeUsers(), new FakeCCs(), audits);

  it("resolves org roles", () => {
    expect(authz.resolveOrgRole(employee)).toBe("employee");
    expect(authz.resolveOrgRole(peter)).toBe("manager");
    expect(authz.resolveOrgRole(gm)).toBe("gm");
    expect(authz.resolveOrgRole(finance)).toBe("finance");
    expect(authz.resolveOrgRole(admin)).toBe("systemAdmin");
  });

  it("only finance can export", () => {
    expect(authz.canExport(finance)).toBe(true);
    expect(authz.canExport(gm)).toBe(false);
    expect(authz.canExport(peter)).toBe(false);
    expect(authz.canExport(admin)).toBe(false);
  });

  it("only GM can reject; managers can return", () => {
    expect(authz.canRejectBudget(gm)).toBe(true);
    expect(authz.canRejectBudget(peter)).toBe(false);
    expect(authz.canReturnBudget(peter)).toBe(true);
    expect(authz.canReturnBudget(gm)).toBe(true);
    expect(authz.canReturnBudget(employee)).toBe(false);
  });

  it("managers only see assigned cost centers", async () => {
    const plans = [
      plan({ id: "1", ownerId: "emp", costCenterId: "cc-a" }),
      plan({ id: "2", ownerId: "x", costCenterId: "cc-b" }),
      plan({ id: "3", ownerId: "y", costCenterId: "cc-c" }),
    ];
    const visible = await authz.filterVisiblePlans(peter, plans);
    expect(visible.map((p) => p.id).sort()).toEqual(["1", "2"]);
    expect(await authz.canViewBudget(peter, plans[2]!)).toBe(false);
  });

  it("employees only see own budgets", async () => {
    const plans = [
      plan({ id: "1", ownerId: "emp", costCenterId: "cc-a" }),
      plan({ id: "2", ownerId: "other", costCenterId: "cc-a" }),
    ];
    const visible = await authz.filterVisiblePlans(employee, plans);
    expect(visible.map((p) => p.id)).toEqual(["1"]);
  });

  it("GM and finance see all; system admin sees none", async () => {
    const plans = [
      plan({ id: "1", ownerId: "emp", costCenterId: "cc-a" }),
      plan({ id: "2", ownerId: "y", costCenterId: "cc-c" }),
    ];
    expect((await authz.filterVisiblePlans(gm, plans)).length).toBe(2);
    expect((await authz.filterVisiblePlans(finance, plans)).length).toBe(2);
    expect((await authz.filterVisiblePlans(admin, plans)).length).toBe(0);
  });

  it("audits denied permission and denied budget view attempts", async () => {
    const outsiderPlan = plan({ id: "x", ownerId: "other", costCenterId: "cc-c" });

    expect(() => authz.assertPermission(employee, "budget.approve")).toThrow(
      "Missing permission: budget.approve"
    );
    await expect(authz.assertCanView(employee, outsiderPlan)).rejects.toThrow(
      "You do not have access to this cost center or budget"
    );

    expect(audits.entries.some((e) => e.action === "AuthorizationDenied")).toBe(
      true
    );
    expect(audits.entries.some((e) => e.action === "BudgetViewDenied")).toBe(
      true
    );
  });
});

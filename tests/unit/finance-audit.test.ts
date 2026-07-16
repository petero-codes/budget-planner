import { describe, it, expect, beforeEach } from "vitest";
import { financeService, repos } from "@/infrastructure/di";
import { IDS } from "@/infrastructure/repositories/mock/seed";
import { mockStore, resetMockStore } from "@/infrastructure/repositories/mock/store";
import type { BudgetPlan } from "@/domain/entities";

function pendingFinancePlan(overrides: Partial<BudgetPlan> = {}): BudgetPlan {
  const now = "2026-01-15T10:00:00.000Z";
  return {
    id: "plan-finance-audit",
    ownerId: IDS.patrick,
    costCenterId: IDS.ccRelMgmt,
    fiscalYearId: IDS.fy2027,
    budgetType: "Primary",
    fromPeriod: "2026-07-01",
    toPeriod: "2027-06-30",
    description: "Finance audit test",
    status: "PendingFinanceReview",
    currentApproverId: null,
    submittedAt: now,
    sapVersion: null,
    lines: [
      {
        id: "line-1",
        glAccountId: mockStore.glAccounts[0]!.id,
        amount: 1000,
        lineNumber: 1,
      },
    ],
    version: 1,
    createdAt: now,
    updatedAt: now,
    lineageId: null,
    parentBudgetPlanId: null,
    lineageRevision: 1,
    versionLabel: "V1",
    amendmentReason: null,
    isArchived: false,
    claimDueAt: null,
    reviewDueAt: null,
    escalationStatus: "None",
    financeClaimedAt: null,
    financeClaimedBy: null,
    ...overrides,
  };
}

describe("FinanceService audit logging", () => {
  beforeEach(() => {
    resetMockStore();
  });

  it("writes AuditLogs on claim, finalize, and return", async () => {
    const finance = (await repos.users.getById(IDS.finance))!;
    mockStore.budgets.push(pendingFinancePlan());

    await financeService.claim("plan-finance-audit", finance, "corr-claim");
    expect(mockStore.audits.some((a) => a.action === "FinanceClaimed")).toBe(
      true
    );

    await financeService.finalize(
      "plan-finance-audit",
      finance,
      "corr-finalize"
    );
    expect(mockStore.audits.some((a) => a.action === "FinanceFinalized")).toBe(
      true
    );

    // Second plan for return path
    mockStore.budgets.push(
      pendingFinancePlan({ id: "plan-finance-return" })
    );
    await financeService.claim("plan-finance-return", finance, "corr-claim-2");
    await financeService.returnForRevision(
      "plan-finance-return",
      finance,
      "Needs more detail",
      "corr-return"
    );
    expect(mockStore.audits.some((a) => a.action === "FinanceReturned")).toBe(
      true
    );
  });
});

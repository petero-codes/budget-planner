import { describe, it, expect, beforeEach } from "vitest";
import { financeService, repos } from "@/infrastructure/di";
import { IDS } from "@/infrastructure/repositories/mock/seed";
import { mockStore, resetMockStore } from "@/infrastructure/repositories/mock/store";
import type { BudgetPlan } from "@/domain/entities";

describe("FinanceService.release", () => {
  beforeEach(() => {
    resetMockStore();
  });

  it("returns a claimed budget to the Finance queue", async () => {
    const finance = (await repos.users.getById(IDS.finance))!;
    const now = "2026-01-15T10:00:00.000Z";
    const plan: BudgetPlan = {
      id: "plan-release",
      ownerId: IDS.patrick,
      costCenterId: IDS.ccRelMgmt,
      fiscalYearId: IDS.fy2027,
      budgetType: "Primary",
      fromPeriod: "2026-07-01",
      toPeriod: "2027-06-30",
      description: null,
      status: "PendingFinanceReview",
      currentApproverId: null,
      submittedAt: now,
      sapVersion: null,
      lines: [
        {
          id: "line-1",
          glAccountId: mockStore.glAccounts[0]!.id,
          amount: 500,
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
    };
    mockStore.budgets.push(plan);

    await financeService.claim("plan-release", finance);
    const released = await financeService.release(
      "plan-release",
      finance,
      "corr-release"
    );
    expect(released.status).toBe("PendingFinanceReview");
    expect(released.financeClaimedBy).toBeNull();
    expect(mockStore.audits.some((a) => a.action === "FinanceReleased")).toBe(
      true
    );
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { financeService, repos } from "@/infrastructure/di";
import { IDS } from "@/infrastructure/repositories/mock/seed";
import { mockStore, resetMockStore } from "@/infrastructure/repositories/mock/store";
import type { BudgetPlan } from "@/domain/entities";

describe("FinanceService.processEscalations", () => {
  beforeEach(() => {
    resetMockStore();
  });

  it("marks overdue queue items Escalated and notifies Finance admins", async () => {
    const finance = (await repos.users.getById(IDS.finance))!;
    const past = "2020-01-01T00:00:00.000Z";
    const now = "2026-01-15T10:00:00.000Z";
    const plan: BudgetPlan = {
      id: "plan-overdue",
      ownerId: IDS.patrick,
      costCenterId: IDS.ccRelMgmt,
      fiscalYearId: IDS.fy2027,
      budgetCategory: "RECURRENT",
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
      claimDueAt: past,
      reviewDueAt: null,
      escalationStatus: "None",
      financeClaimedAt: null,
      financeClaimedBy: null,
    };
    mockStore.budgets.push(plan);

    const escalated = await financeService.processEscalations(finance);
    expect(escalated).toBe(1);
    expect(mockStore.budgets[0]!.escalationStatus).toBe("Escalated");
    expect(
      mockStore.notifications.some(
        (n) => n.type === "FinanceEscalation" && n.userId === IDS.finance
      )
    ).toBe(true);
  });
});

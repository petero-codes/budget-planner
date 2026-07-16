import { describe, it, expect, beforeEach } from "vitest";
import { budgetPlanService, repos } from "@/infrastructure/di";
import { IDS } from "@/infrastructure/repositories/mock/seed";
import { mockStore, resetMockStore } from "@/infrastructure/repositories/mock/store";
import type { BudgetPlan, BudgetLineage } from "@/domain/entities";

describe("createAmendment notifications", () => {
  beforeEach(() => {
    resetMockStore();
  });

  it("notifies the owner manager and Finance when an amendment is drafted", async () => {
    const patrick = (await repos.users.getById(IDS.patrick))!;
    const now = "2026-01-15T10:00:00.000Z";
    const lineage: BudgetLineage = {
      id: "lin-amend-notif",
      costCenterId: IDS.ccRelMgmt,
      fiscalYearId: IDS.fy2027,
      originalBudgetType: "Primary",
      budgetNumber: "FY2027-REL-009",
      currentVersionId: "plan-final-notif",
      latestFinalizedVersionId: "plan-final-notif",
      isArchived: false,
      createdAt: now,
    };
    const plan: BudgetPlan = {
      id: "plan-final-notif",
      ownerId: IDS.patrick,
      costCenterId: IDS.ccRelMgmt,
      fiscalYearId: IDS.fy2027,
      budgetType: "Primary",
      fromPeriod: "2026-07-01",
      toPeriod: "2027-06-30",
      description: null,
      status: "Finalized",
      currentApproverId: null,
      submittedAt: now,
      sapVersion: "SAP-1",
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
      lineageId: lineage.id,
      parentBudgetPlanId: null,
      lineageRevision: 1,
      versionLabel: "FY2027-REL-009-V1",
      amendmentReason: null,
      isArchived: false,
      claimDueAt: null,
      reviewDueAt: null,
      escalationStatus: "None",
      financeClaimedAt: null,
      financeClaimedBy: null,
    };
    mockStore.lineages.push(lineage);
    mockStore.budgets.push(plan);

    await budgetPlanService.createAmendment(
      patrick,
      plan.id,
      "Need additional licenses"
    );

    expect(
      mockStore.notifications.some(
        (n) =>
          n.type === "Amendment" &&
          n.userId === IDS.peter &&
          n.body.includes("Need additional licenses")
      )
    ).toBe(true);
    expect(
      mockStore.notifications.some(
        (n) => n.type === "Amendment" && n.userId === IDS.finance
      )
    ).toBe(true);
  });
});

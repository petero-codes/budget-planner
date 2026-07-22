import { describe, it, expect, beforeEach } from "vitest";
import { AuthorizationError } from "@/application/authorization-service";
import { budgetPlanService, repos } from "@/infrastructure/di";
import { IDS } from "@/infrastructure/repositories/mock/seed";
import { mockStore, resetMockStore } from "@/infrastructure/repositories/mock/store";
import type { BudgetPlan, BudgetLineage } from "@/domain/entities";

describe("BudgetPlanService.createAmendment ownership", () => {
  beforeEach(() => {
    resetMockStore();
  });

  it("rejects amendments from non-owners even on the same cost center", async () => {
    const peter = (await repos.users.getById(IDS.peter))!;
    const now = "2026-01-15T10:00:00.000Z";
    const lineage: BudgetLineage = {
      id: "lin-1",
      costCenterId: IDS.ccRelMgmt,
      fiscalYearId: IDS.fy2027,
      originalBudgetCategory: "RECURRENT",
      budgetNumber: "FY2027-REL-001",
      currentVersionId: "plan-final",
      latestFinalizedVersionId: "plan-final",
      isArchived: false,
      createdAt: now,
    };
    const plan: BudgetPlan = {
      id: "plan-final",
      ownerId: IDS.patrick,
      costCenterId: IDS.ccRelMgmt,
      fiscalYearId: IDS.fy2027,
      budgetCategory: "RECURRENT",
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
      versionLabel: "FY2027-REL-001-V1",
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

    // Peter shares Patrick's cost center in seed but is not the owner.
    await expect(
      budgetPlanService.createAmendment(peter, plan.id, "Need more funds")
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});

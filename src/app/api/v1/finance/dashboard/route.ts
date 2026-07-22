import { NextResponse } from "next/server";
import { AuthorizationError } from "@/application/authorization-service";
import {
  addToBudgetCategorySummary,
  addToLegacyBudgetCategorySummary,
  emptyBudgetCategorySummary,
  emptyLegacyBudgetCategorySummary,
  legacyBudgetCategoryDistribution,
} from "@/domain/constants/budget-types";
import {
  budgetPlanService,
  getCurrentUser,
  repos,
} from "@/infrastructure/di";
import { readApiError } from "@/lib/security/read-api-error";

/** Finance dashboard aggregates across all visible budgets. */
export async function GET() {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    if (!user.permissionCodes.includes("finance.view")) {
      throw new AuthorizationError("Missing permission: finance.view");
    }
    const [plans, years, centers] = await Promise.all([
      budgetPlanService.listVisible(user),
      repos.fiscalYears.getAll(),
      repos.costCenters.getAll(),
    ]);
    const yearMap = new Map(years.map((year) => [year.id, year]));
    const centerMap = new Map(centers.map((center) => [center.id, center]));

    const totalRequested = plans.reduce(
      (s, p) => s + p.lines.reduce((a, l) => a + l.amount, 0),
      0
    );
    const approved = plans.filter(
      (p) => p.status === "Finalized" || p.status === "Approved"
    );
    const totalApproved = approved.reduce(
      (s, p) => s + p.lines.reduce((a, l) => a + l.amount, 0),
      0
    );

    const byStatus: Record<string, number> = {};
    const byYear: Record<string, { count: number; amount: number }> = {};
    const byCostCenter: Record<string, { count: number; amount: number }> = {};
    const byBudgetCategory = emptyBudgetCategorySummary();
    const legacySummary = emptyLegacyBudgetCategorySummary();

    for (const p of plans) {
      byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
      const amount = p.lines.reduce((a, l) => a + l.amount, 0);
      addToBudgetCategorySummary(byBudgetCategory, p.budgetCategory, amount);
      addToLegacyBudgetCategorySummary(legacySummary, p.budgetCategory, amount);
      const fy = yearMap.get(p.fiscalYearId);
      const yKey = String(fy?.yearLabel ?? p.fiscalYearId);
      byYear[yKey] = byYear[yKey] ?? { count: 0, amount: 0 };
      byYear[yKey]!.count += 1;
      byYear[yKey]!.amount += amount;
      const cc = centerMap.get(p.costCenterId);
      const cKey = cc?.code ?? p.costCenterId;
      byCostCenter[cKey] = byCostCenter[cKey] ?? { count: 0, amount: 0 };
      byCostCenter[cKey]!.count += 1;
      byCostCenter[cKey]!.amount += amount;
    }

    return NextResponse.json({
      data: {
        totals: {
          submitted: plans.length,
          approved: (byStatus.Finalized ?? 0) + (byStatus.Approved ?? 0),
          rejected: byStatus.Rejected ?? 0,
          returned: byStatus.ReturnedForRevision ?? 0,
          pending:
            (byStatus.InApproval ?? 0) +
            (byStatus.PendingFinanceReview ?? 0) +
            (byStatus.Claimed ?? 0),
          draft: byStatus.Draft ?? 0,
          totalRequested,
          totalApproved,
          utilization:
            totalRequested > 0
              ? Math.round((totalApproved / totalRequested) * 1000) / 10
              : 0,
        },
        byYear,
        byCostCenter,
        byBudgetCategory,
        byLegacyBudgetCategory: legacyBudgetCategoryDistribution(legacySummary),
        years,
      },
      correlationId,
    });
  } catch (e) {
    return readApiError(e, correlationId);
  }
}

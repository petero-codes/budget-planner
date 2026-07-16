import type { BudgetPlan } from "@/domain/entities";
import type { ExistingActiveBudget } from "@/domain/existing-active-budget";

export type { ExistingActiveBudget };

/**
 * Raised before insert/update when another plan is still in play for the same
 * (CostCenter, FiscalYear, BudgetType). Mapped to HTTP 409 ACTIVE_BUDGET_EXISTS.
 */
export class ActiveBudgetConflictError extends Error {
  readonly code = "ACTIVE_BUDGET_EXISTS" as const;

  constructor(
    message: string,
    public readonly existing: ExistingActiveBudget
  ) {
    super(message);
    this.name = "ActiveBudgetConflictError";
  }
}

export function existingActiveBudgetFromPlan(
  plan: BudgetPlan,
  meta: {
    costCenterCode: string;
    costCenterName: string;
    fiscalYearLabel: number;
    ownerName: string | null;
  }
): ExistingActiveBudget {
  return {
    id: plan.id,
    status: plan.status,
    budgetType: plan.budgetType,
    costCenterId: plan.costCenterId,
    costCenterCode: meta.costCenterCode,
    costCenterName: meta.costCenterName,
    fiscalYearId: plan.fiscalYearId,
    fiscalYearLabel: meta.fiscalYearLabel,
    ownerId: plan.ownerId,
    ownerName: meta.ownerName,
    createdAt: plan.createdAt,
  };
}

/** Detect the filtered unique index violation as a last-resort race guard. */
export function isActiveBudgetUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("UX_BudgetPlans_ActiveUnique") ||
    /\b2601\b/.test(message) ||
    /\b2627\b/.test(message)
  );
}

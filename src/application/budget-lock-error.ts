import "server-only";

import { BudgetLockedError } from "@/domain/rules/budget-plan-invariants";

export class BudgetLockedApiError extends BudgetLockedError {
  readonly httpStatus = 403;
  readonly code = "BUDGET_LOCKED";

  constructor(message?: string) {
    super(message);
    this.name = "BudgetLockedApiError";
  }
}

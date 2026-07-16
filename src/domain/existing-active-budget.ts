import type { BudgetStatus } from "@/domain/value-objects/budget-status";

/** Payload returned on HTTP 409 when an active budget already occupies the key. */
export type ExistingActiveBudget = {
  id: string;
  status: BudgetStatus;
  budgetType: string;
  costCenterId: string;
  costCenterCode: string;
  costCenterName: string;
  fiscalYearId: string;
  fiscalYearLabel: number;
  ownerId: string;
  ownerName: string | null;
  createdAt: string;
};

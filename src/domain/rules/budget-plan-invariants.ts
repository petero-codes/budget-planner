import { Money } from "../value-objects/money";
import { PeriodRange } from "../value-objects/period-range";
import type { BudgetLineItem, BudgetPlan, CostCenter } from "../entities";

export interface ValidationIssue {
  field: string;
  message: string;
}

export function validateBudgetLines(
  lines: Pick<BudgetLineItem, "glAccountId" | "amount">[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!lines.length) {
    issues.push({ field: "lines", message: "At least one line item is required" });
    return issues;
  }
  lines.forEach((line, index) => {
    if (!line.glAccountId) {
      issues.push({
        field: `lines[${index}].glAccountId`,
        message: "Cost Element is required",
      });
    }
    try {
      Money.create(line.amount);
    } catch (e) {
      issues.push({
        field: `lines[${index}].amount`,
        message: e instanceof Error ? e.message : "Invalid amount",
      });
    }
  });
  return issues;
}

export function validateBudgetHeader(input: {
  budgetType: string;
  fiscalYearId: string;
  fromPeriod: string;
  toPeriod: string;
  costCenterId: string;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.budgetType?.trim()) {
    issues.push({ field: "budgetType", message: "Budget Type is required" });
  }
  if (!input.fiscalYearId) {
    issues.push({ field: "fiscalYearId", message: "Fiscal Year is required" });
  }
  if (!input.costCenterId) {
    issues.push({ field: "costCenterId", message: "Cost Center is required" });
  }
  try {
    PeriodRange.create(input.fromPeriod, input.toPeriod);
  } catch (e) {
    issues.push({
      field: "period",
      message: e instanceof Error ? e.message : "Invalid period range",
    });
  }
  return issues;
}

export function assertCanEditDraft(plan: BudgetPlan): void {
  if (plan.status !== "Draft") {
    throw new Error("Only Draft budgets can be edited");
  }
}

export function assertSapCodeForSubmit(costCenter: CostCenter): void {
  if (!costCenter.sapCostCenterCode?.trim()) {
    throw new Error(
      "Cost center must have a SAP cost center code before submit"
    );
  }
}

import "server-only";

import type { BudgetPlan, CostCenter, GlAccount } from "@/domain/entities";

export function buildSapCsv(
  plan: BudgetPlan,
  costCenter: CostCenter,
  glAccounts: Map<string, GlAccount>,
  fiscalYearLabel: number
): string {
  const header = "CostCenter,CostElement,Amount,Version,Fiscal_year,BudgetType";
  const version = plan.sapVersion ?? "V1";
  const ccCode = costCenter.sapCostCenterCode ?? costCenter.code;
  const rows = plan.lines.map((line) => {
    const gl = glAccounts.get(line.glAccountId);
    const costElement = gl?.code ?? "";
    return `${ccCode},${costElement},${line.amount},${version},${fiscalYearLabel},${plan.budgetCategory}`;
  });
  return [header, ...rows].join("\n");
}

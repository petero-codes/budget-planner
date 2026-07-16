import type { Department } from "../entities";

/**
 * Allocate a human-readable budget number: FY{year}-{deptCode}-{seq}
 */
export function formatBudgetNumber(
  yearLabel: number,
  departmentCode: string,
  sequence: number
): string {
  const dept = departmentCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "GEN";
  const seq = String(sequence).padStart(3, "0");
  return `FY${yearLabel}-${dept}-${seq}`;
}

export function formatVersionLabel(budgetNumber: string, revision: number): string {
  return `${budgetNumber}-V${revision}`;
}

export function nextSequenceForDepartment(
  existingNumbers: string[],
  yearLabel: number,
  departmentCode: string
): number {
  const prefix = `FY${yearLabel}-${departmentCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "GEN"}-`;
  let max = 0;
  for (const num of existingNumbers) {
    if (!num.startsWith(prefix)) continue;
    const tail = num.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (!Number.isNaN(n)) max = Math.max(max, n);
  }
  return max + 1;
}

export function departmentCodeForBudget(dept: Department | null): string {
  return dept?.code ?? "GEN";
}

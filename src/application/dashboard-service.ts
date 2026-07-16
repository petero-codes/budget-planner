import type { BudgetPlan, User } from "@/domain/entities";
import type {
  IApprovalHistoryRepository,
  ICostCenterRepository,
  IDepartmentRepository,
  IFiscalYearRepository,
  IUserRepository,
} from "@/infrastructure/repositories/interfaces";
import { latestApprovalOutcome } from "@/domain/rules/approval-outcome";
import {
  AuthorizationError,
  AuthorizationService,
  type OrgRole,
} from "./authorization-service";
import { BudgetPlanService } from "./budget-plan-service";

export type StatusCounts = {
  pending: number;
  returned: number;
  approved: number;
  rejected: number;
  draft: number;
  total: number;
  totalRequested: number;
  totalApproved: number;
  approvalRate: number;
};

export type CostCenterSummary = StatusCounts & {
  costCenterId: string;
  code: string;
  name: string;
};

export type PlanOutcome = {
  action: "Returned" | "Rejected";
  reason: string;
  performedBy: string;
  performedByName: string;
  timestamp: string;
};

export type DashboardPayload = {
  orgRole: OrgRole;
  canExport: boolean;
  summaries: CostCenterSummary[];
  totals: StatusCounts;
  byDepartment: Record<string, StatusCounts>;
  byYear: Record<string, StatusCounts>;
  byManager: Record<string, StatusCounts>;
  plans: BudgetPlan[];
  planOutcomes: Record<string, PlanOutcome>;
};

function emptyCounts(): StatusCounts {
  return {
    pending: 0,
    returned: 0,
    approved: 0,
    rejected: 0,
    draft: 0,
    total: 0,
    totalRequested: 0,
    totalApproved: 0,
    approvalRate: 0,
  };
}

function accumulate(counts: StatusCounts, plan: BudgetPlan): void {
  const amount = plan.lines.reduce((s, l) => s + l.amount, 0);
  counts.total += 1;
  counts.totalRequested += amount;
  switch (plan.status) {
    case "InApproval":
    case "PendingFinanceReview":
    case "Claimed":
      counts.pending += 1;
      break;
    case "ReturnedForRevision":
      counts.returned += 1;
      break;
    case "Finalized":
    case "Approved":
      counts.approved += 1;
      counts.totalApproved += amount;
      break;
    case "Rejected":
      counts.rejected += 1;
      break;
    case "Draft":
      counts.draft += 1;
      break;
  }
}

function finalize(counts: StatusCounts): StatusCounts {
  const decided = counts.approved + counts.rejected;
  counts.approvalRate =
    decided > 0 ? Math.round((counts.approved / decided) * 1000) / 10 : 0;
  return counts;
}

export class DashboardService {
  constructor(
    private readonly budgets: BudgetPlanService,
    private readonly users: IUserRepository,
    private readonly departments: IDepartmentRepository,
    private readonly costCenters: ICostCenterRepository,
    private readonly fiscalYears: IFiscalYearRepository,
    private readonly history: IApprovalHistoryRepository,
    private readonly authz: AuthorizationService
  ) {}

  async getDashboard(actor: User): Promise<DashboardPayload> {
    const orgRole = this.authz.resolveOrgRole(actor);
    if (orgRole === "systemAdmin") {
      throw new AuthorizationError(
        "System administrators use Administration, not the budget dashboard"
      );
    }

    const plans = await this.budgets.listVisible(actor);
    const centers = await this.costCenters.getAll();
    const years = await this.fiscalYears.getAll();
    const allUsers = await this.users.getAll();
    const depts = await this.departments.getAll();
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const ccMap = new Map(centers.map((c) => [c.id, c]));
    const deptMap = new Map(depts.map((d) => [d.id, d]));

    const totals = emptyCounts();
    const byCc = new Map<string, StatusCounts>();
    const byDepartment: Record<string, StatusCounts> = {};
    const byYear: Record<string, StatusCounts> = {};
    const byManager: Record<string, StatusCounts> = {};

    for (const plan of plans) {
      accumulate(totals, plan);

      if (!byCc.has(plan.costCenterId)) byCc.set(plan.costCenterId, emptyCounts());
      accumulate(byCc.get(plan.costCenterId)!, plan);

      const cc = ccMap.get(plan.costCenterId);
      const deptKey =
        (cc && deptMap.get(cc.departmentId)?.name) ?? "Unknown";
      byDepartment[deptKey] = byDepartment[deptKey] ?? emptyCounts();
      accumulate(byDepartment[deptKey]!, plan);

      const fy = years.find((y) => y.id === plan.fiscalYearId);
      const yKey = String(fy?.yearLabel ?? "Unknown");
      byYear[yKey] = byYear[yKey] ?? emptyCounts();
      accumulate(byYear[yKey]!, plan);

      const owner = userMap.get(plan.ownerId);
      const manager =
        (owner?.managerId && userMap.get(owner.managerId)) ||
        (cc?.managerId ? userMap.get(cc.managerId) : null);
      const mKey = manager?.name ?? "Unassigned";
      byManager[mKey] = byManager[mKey] ?? emptyCounts();
      accumulate(byManager[mKey]!, plan);
    }

    finalize(totals);
    for (const k of Object.keys(byDepartment)) finalize(byDepartment[k]!);
    for (const k of Object.keys(byYear)) finalize(byYear[k]!);
    for (const k of Object.keys(byManager)) finalize(byManager[k]!);

    let summaries: CostCenterSummary[] = [];
    if (orgRole === "manager") {
      const managed = await this.authz.listManagedCostCenters(actor);
      summaries = managed.map((c) => ({
        costCenterId: c.id,
        code: c.code,
        name: c.name,
        ...finalize({ ...(byCc.get(c.id) ?? emptyCounts()) }),
      }));
    } else if (orgRole === "employee") {
      const mine = centers.find((c) => c.id === actor.primaryCostCenterId);
      if (mine) {
        const own = emptyCounts();
        for (const p of plans) accumulate(own, p);
        finalize(own);
        summaries = [
          {
            costCenterId: mine.id,
            code: mine.code,
            name: mine.name,
            ...own,
          },
        ];
      }
    } else {
      summaries = centers
        .filter((c) => c.isActive)
        .map((c) => ({
          costCenterId: c.id,
          code: c.code,
          name: c.name,
          ...finalize({ ...(byCc.get(c.id) ?? emptyCounts()) }),
        }));
    }

    const planOutcomes: Record<string, PlanOutcome> = {};
    for (const plan of plans) {
      if (
        plan.status !== "ReturnedForRevision" &&
        plan.status !== "Rejected"
      ) {
        continue;
      }
      const entries = await this.history.listByBudgetId(plan.id);
      const outcome = latestApprovalOutcome(entries);
      if (!outcome) continue;
      planOutcomes[plan.id] = {
        ...outcome,
        performedByName:
          userMap.get(outcome.performedBy)?.name ?? outcome.performedBy,
      };
    }

    return {
      orgRole,
      canExport: this.authz.canExport(actor),
      summaries,
      totals,
      byDepartment,
      byYear,
      byManager,
      plans,
      planOutcomes,
    };
  }
}

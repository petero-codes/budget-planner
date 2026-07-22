import "server-only";

import type {
  ApprovalHistoryEntry,
  BudgetPlan,
  CostCenter,
  User,
} from "@/domain/entities";
import type {
  IApprovalHistoryRepository,
  IBudgetPlanRepository,
  ICostCenterRepository,
  IDepartmentRepository,
  IFiscalYearRepository,
  IUserRepository,
} from "@/infrastructure/repositories/interfaces";
import {
  AuthorizationError,
  AuthorizationService,
} from "./authorization-service";
import { submissionStatusForBudget } from "@/domain/rules/submission-status";

/** CC submission status for tracker views (extends budget status with NotSubmitted). */
export type SubmissionStatus =
  | "NotSubmitted"
  | "Draft"
  | "InApproval"
  | "ReturnedForRevision"
  | "Approved"
  | "Rejected";

export type DepartmentSummary = {
  departmentId: string;
  name: string;
  code: string;
  totalCostCenters: number;
  submitted: number;
  outstanding: number;
  completion: number;
  totalRequested: number;
  totalApproved: number;
};

export type CostCenterRow = {
  costCenterId: string;
  code: string;
  name: string;
  responsiblePerson: string | null;
  managerName: string | null;
  status: SubmissionStatus;
  glCount: number;
  totalRequested: number;
  totalApproved: number;
  lastUpdated: string | null;
  latestPlanId: string | null;
  currentApprover: string | null;
};

export type CostCenterDetail = CostCenterRow & {
  departmentName: string;
  fiscalYearLabel: number | null;
  revisionCount: number;
  returnedCount: number;
  rejectedCount: number;
  submissionHistory: (ApprovalHistoryEntry & { performedByName: string })[];
  plans: BudgetPlan[];
};

function planTotal(plan: BudgetPlan): number {
  return plan.lines.reduce((s, l) => s + l.amount, 0);
}

/** A CC counts as submitted once its latest budget left Draft. */
function isSubmittedStatus(status: SubmissionStatus): boolean {
  return status === "InApproval" || status === "Approved";
}

function isApprovedAmountStatus(status: BudgetPlan["status"]): boolean {
  return status === "Finalized" || status === "Approved";
}

/**
 * ExecutiveService
 *
 * Responsibility
 * --------------
 * Read-only executive / management reporting over budgets and org structure.
 *
 * Does NOT:
 * - mutate workflow state
 *
 * Workflows: read-only reporting (see WF-018 adjacent)
 * Dependencies: AuthorizationService, budget/org repositories
 */
export class ExecutiveService {
  constructor(
    private readonly budgets: IBudgetPlanRepository,
    private readonly users: IUserRepository,
    private readonly departments: IDepartmentRepository,
    private readonly costCenters: ICostCenterRepository,
    private readonly fiscalYears: IFiscalYearRepository,
    private readonly history: IApprovalHistoryRepository,
    private readonly authz: AuthorizationService
  ) {}

  private assertExecutive(actor: User): void {
    const role = this.authz.resolveOrgRole(actor);
    if (role !== "gm" && role !== "finance") {
      throw new AuthorizationError(
        "Executive overview is limited to the GM and Finance"
      );
    }
  }

  /** Latest (most relevant) plan per cost center for the open FY. */
  private latestPlanByCC(
    plans: BudgetPlan[],
    openFyId: string | null
  ): Map<string, BudgetPlan> {
    const map = new Map<string, BudgetPlan>();
    for (const p of plans) {
      if (openFyId && p.fiscalYearId !== openFyId) continue;
      const existing = map.get(p.costCenterId);
      if (!existing || p.updatedAt > existing.updatedAt) {
        map.set(p.costCenterId, p);
      }
    }
    return map;
  }

  private ccStatus(plan: BudgetPlan | undefined): SubmissionStatus {
    if (!plan) return "NotSubmitted";
    const mapped = submissionStatusForBudget(plan.status);
    switch (mapped) {
      case "NotStarted":
        return "NotSubmitted";
      case "InProgress":
        return "Draft";
      case "Submitted":
        return "InApproval";
      case "Returned":
        return "ReturnedForRevision";
      case "Approved":
        return "Approved";
      case "Rejected":
        return "Rejected";
    }
  }

  async getOverview(actor: User): Promise<{
    departments: DepartmentSummary[];
    fiscalYearLabel: number | null;
  }> {
    this.assertExecutive(actor);
    const [depts, centers, plans, openFy] = await Promise.all([
      this.departments.getAll(),
      this.costCenters.getAll(),
      this.budgets.list(),
      this.fiscalYears.getActive(),
    ]);
    const latest = this.latestPlanByCC(plans, openFy?.id ?? null);

    const summaries: DepartmentSummary[] = depts.map((d) => {
      const ccs = centers.filter((c) => c.departmentId === d.id && c.isActive);
      let submitted = 0;
      let totalRequested = 0;
      let totalApproved = 0;
      for (const cc of ccs) {
        const plan = latest.get(cc.id);
        const status = this.ccStatus(plan);
        if (isSubmittedStatus(status)) submitted += 1;
        if (plan) {
          const amt = planTotal(plan);
          totalRequested += amt;
          if (isApprovedAmountStatus(plan.status)) totalApproved += amt;
        }
      }
      const total = ccs.length;
      return {
        departmentId: d.id,
        name: d.name,
        code: d.code,
        totalCostCenters: total,
        submitted,
        outstanding: total - submitted,
        completion:
          total > 0 ? Math.round((submitted / total) * 1000) / 10 : 0,
        totalRequested,
        totalApproved,
      };
    });

    return {
      departments: summaries.sort((a, b) => a.name.localeCompare(b.name)),
      fiscalYearLabel: openFy?.yearLabel ?? null,
    };
  }

  private async buildRow(
    cc: CostCenter,
    plan: BudgetPlan | undefined,
    userMap: Map<string, User>
  ): Promise<CostCenterRow> {
    const responsible = plan
      ? userMap.get(plan.ownerId)
      : Array.from(userMap.values()).find(
          (u) => u.primaryCostCenterId === cc.id && u.active
        );
    const manager = cc.managerId ? userMap.get(cc.managerId) : null;
    return {
      costCenterId: cc.id,
      code: cc.code,
      name: cc.name,
      responsiblePerson: responsible?.name ?? null,
      managerName: manager?.name ?? null,
      status: this.ccStatus(plan),
      glCount: plan?.lines.length ?? 0,
      totalRequested: plan ? planTotal(plan) : 0,
      totalApproved: plan && isApprovedAmountStatus(plan.status) ? planTotal(plan) : 0,
      lastUpdated: plan?.updatedAt ?? null,
      latestPlanId: plan?.id ?? null,
      currentApprover: plan?.currentApproverId
        ? (userMap.get(plan.currentApproverId)?.name ?? null)
        : null,
    };
  }

  async getDepartmentCostCenters(
    actor: User,
    departmentId: string
  ): Promise<{ departmentName: string; costCenters: CostCenterRow[] }> {
    this.assertExecutive(actor);
    const dept = await this.departments.getById(departmentId);
    if (!dept) throw new Error("Department not found");
    const [centers, plans, openFy, userMap] = await Promise.all([
      this.costCenters.getAll(),
      this.budgets.list(),
      this.fiscalYears.getActive(),
      this.users.getUsersByIdMap(),
    ]);
    const latest = this.latestPlanByCC(plans, openFy?.id ?? null);
    const rows = await Promise.all(
      centers
        .filter((c) => c.departmentId === departmentId && c.isActive)
        .map((cc) => this.buildRow(cc, latest.get(cc.id), userMap))
    );
    return {
      departmentName: dept.name,
      costCenters: rows.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  async getCostCenterDetail(
    actor: User,
    costCenterId: string
  ): Promise<CostCenterDetail> {
    this.assertExecutive(actor);
    const cc = await this.costCenters.getById(costCenterId);
    if (!cc) throw new Error("Cost center not found");
    const [plans, openFy, userMap, dept] = await Promise.all([
      this.budgets.list(),
      this.fiscalYears.getActive(),
      this.users.getUsersByIdMap(),
      this.departments.getById(cc.departmentId),
    ]);
    const ccPlans = plans
      .filter((p) => p.costCenterId === costCenterId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const latestOpen = this.latestPlanByCC(ccPlans, openFy?.id ?? null).get(
      costCenterId
    );
    const row = await this.buildRow(cc, latestOpen, userMap);

    const historyEntries: (ApprovalHistoryEntry & {
      performedByName: string;
    })[] = [];
    let returnedCount = 0;
    let rejectedCount = 0;
    let revisionCount = 0;
    for (const p of ccPlans) {
      const entries = await this.history.listByBudgetId(p.id);
      for (const e of entries) {
        historyEntries.push({
          ...e,
          performedByName: userMap.get(e.performedBy)?.name ?? e.performedBy,
        });
        if (e.action === "Returned") returnedCount += 1;
        if (e.action === "Rejected") rejectedCount += 1;
        if (e.action === "Resubmitted") revisionCount += 1;
      }
    }
    historyEntries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return {
      ...row,
      departmentName: dept?.name ?? "Unknown",
      fiscalYearLabel: openFy?.yearLabel ?? null,
      revisionCount,
      returnedCount,
      rejectedCount,
      submissionHistory: historyEntries,
      plans: ccPlans,
    };
  }
}

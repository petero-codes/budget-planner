import {
  assertCanEditDraft,
  validateBudgetHeader,
  validateBudgetLines,
} from "@/domain/rules/budget-plan-invariants";
import type { BudgetLineItem, BudgetPlan, User } from "@/domain/entities";
import type {
  IAuditLogRepository,
  IBudgetPlanRepository,
  ICostCenterRepository,
  IUnitOfWork,
} from "@/infrastructure/repositories/interfaces";
import { newId } from "@/infrastructure/repositories/mock";
import {
  AuthorizationError,
  AuthorizationService,
} from "./authorization-service";
import { ApprovalService } from "./approval-service";

export interface CreateDraftInput {
  budgetType: string;
  fiscalYearId: string;
  fromPeriod: string;
  toPeriod: string;
  costCenterId: string;
  lines: { glAccountId: string; amount: number }[];
}

export class BudgetPlanService {
  constructor(
    private readonly budgets: IBudgetPlanRepository,
    private readonly costCenters: ICostCenterRepository,
    private readonly audits: IAuditLogRepository,
    private readonly authz: AuthorizationService,
    private readonly approvalService: ApprovalService,
    private readonly uow: IUnitOfWork
  ) {}

  async createDraft(actor: User, input: CreateDraftInput): Promise<BudgetPlan> {
    this.authz.assertPermission(actor, "budget.create");
    if (input.costCenterId !== actor.primaryCostCenterId) {
      throw new AuthorizationError(
        "You can only create budgets for your own cost center"
      );
    }
    const headerIssues = validateBudgetHeader(input);
    const lineIssues = validateBudgetLines(input.lines);
    const issues = [...headerIssues, ...lineIssues];
    if (issues.length) {
      throw new Error(issues.map((i) => i.message).join("; "));
    }

    const cc = await this.costCenters.getById(input.costCenterId);
    if (!cc?.isActive) throw new Error("Cost center not found or inactive");

    const now = new Date().toISOString();
    const lines: BudgetLineItem[] = input.lines.map((line, index) => ({
      id: newId("line"),
      glAccountId: line.glAccountId,
      amount: line.amount,
      lineNumber: index + 1,
    }));

    const plan: BudgetPlan = {
      id: newId("budget"),
      ownerId: actor.id,
      costCenterId: input.costCenterId,
      fiscalYearId: input.fiscalYearId,
      budgetType: input.budgetType.trim(),
      fromPeriod: input.fromPeriod,
      toPeriod: input.toPeriod,
      status: "Draft",
      currentApproverId: null,
      submittedAt: null,
      sapVersion: null,
      lines,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    return this.uow.runInTransaction(async () => {
      await this.budgets.save(plan);
      await this.audits.append({
        id: newId("audit"),
        entity: "BudgetPlan",
        entityId: plan.id,
        action: "CreatedDraft",
        performedBy: actor.id,
        ipAddress: null,
        correlationId: newId("corr"),
        beforeJson: null,
        afterJson: JSON.stringify({ status: "Draft" }),
        timestamp: now,
      });
      return plan;
    });
  }

  async updateDraft(
    planId: string,
    actor: User,
    input: CreateDraftInput
  ): Promise<BudgetPlan> {
    const plan = await this.budgets.getById(planId);
    if (!plan) throw new Error("Budget not found");
    if (plan.ownerId !== actor.id) {
      throw new AuthorizationError("Only the owner can edit this budget");
    }
    assertCanEditDraft(plan);
    this.authz.assertPermission(actor, "budget.create");

    const headerIssues = validateBudgetHeader(input);
    const lineIssues = validateBudgetLines(input.lines);
    const issues = [...headerIssues, ...lineIssues];
    if (issues.length) {
      throw new Error(issues.map((i) => i.message).join("; "));
    }
    if (input.costCenterId !== actor.primaryCostCenterId) {
      throw new AuthorizationError(
        "You can only assign your own cost center"
      );
    }

    plan.budgetType = input.budgetType.trim();
    plan.fiscalYearId = input.fiscalYearId;
    plan.fromPeriod = input.fromPeriod;
    plan.toPeriod = input.toPeriod;
    plan.costCenterId = input.costCenterId;
    plan.lines = input.lines.map((line, index) => ({
      id: newId("line"),
      glAccountId: line.glAccountId,
      amount: line.amount,
      lineNumber: index + 1,
    }));
    plan.updatedAt = new Date().toISOString();
    plan.version += 1;
    return this.budgets.save(plan);
  }

  async submit(planId: string, actor: User): Promise<BudgetPlan> {
    return this.approvalService.submit(planId, actor);
  }

  async listMine(actor: User): Promise<BudgetPlan[]> {
    return this.budgets.listByOwner(actor.id);
  }

  async getById(planId: string, actor: User): Promise<BudgetPlan> {
    const plan = await this.budgets.getById(planId);
    if (!plan) throw new Error("Budget not found");
    await this.authz.assertCanView(actor, plan);
    return plan;
  }

  async listVisible(actor: User): Promise<BudgetPlan[]> {
    const all = await this.budgets.list();
    const scope = await this.authz.visibleOwnerIds(actor);
    if (scope === "all") return all;
    return all.filter((b) => scope.includes(b.ownerId));
  }

  async listPendingApprovals(actor: User): Promise<BudgetPlan[]> {
    this.authz.assertPermission(actor, "budget.approve");
    return this.budgets.listPendingForApprover(actor.id);
  }
}

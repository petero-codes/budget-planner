import { buildApprovalRoute } from "@/domain/rules/build-approval-route";
import {
  assertCanEditDraft,
  assertSapCodeForSubmit,
  validateBudgetLines,
} from "@/domain/rules/budget-plan-invariants";
import type { BudgetPlan, User } from "@/domain/entities";
import type {
  IApprovalHistoryRepository,
  IApprovalRouteRepository,
  IAuditLogRepository,
  IBudgetPlanRepository,
  ICostCenterRepository,
  INotificationRepository,
  IUnitOfWork,
  IUserRepository,
} from "@/infrastructure/repositories/interfaces";
import { newId } from "@/infrastructure/repositories/mock";
import {
  AuthorizationError,
  AuthorizationService,
} from "./authorization-service";

export class ApprovalServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ApprovalServiceError";
  }
}

export class ApprovalService {
  constructor(
    private readonly users: IUserRepository,
    private readonly budgets: IBudgetPlanRepository,
    private readonly costCenters: ICostCenterRepository,
    private readonly routes: IApprovalRouteRepository,
    private readonly history: IApprovalHistoryRepository,
    private readonly audits: IAuditLogRepository,
    private readonly notifications: INotificationRepository,
    private readonly authz: AuthorizationService,
    private readonly uow: IUnitOfWork
  ) {}

  async submit(
    planId: string,
    actor: User,
    correlationId = newId("corr"),
    ipAddress: string | null = null
  ): Promise<BudgetPlan> {
    return this.uow.runInTransaction(async () => {
      const plan = await this.budgets.getById(planId);
      if (!plan) throw new ApprovalServiceError("Budget not found", "NOT_FOUND");
      if (plan.ownerId !== actor.id) {
        throw new AuthorizationError("Only the owner can submit this budget");
      }
      this.authz.assertPermission(actor, "budget.submit");
      assertCanEditDraft(plan);

      const lineIssues = validateBudgetLines(plan.lines);
      if (lineIssues.length) {
        throw new ApprovalServiceError(
          lineIssues.map((i) => i.message).join("; "),
          "VALIDATION"
        );
      }

      const cc = await this.costCenters.getById(plan.costCenterId);
      if (!cc) throw new ApprovalServiceError("Cost center not found", "NOT_FOUND");
      assertSapCodeForSubmit(cc);

      const duplicate = await this.budgets.findActiveDuplicate(
        plan.costCenterId,
        plan.fiscalYearId,
        plan.budgetType
      );
      if (duplicate && duplicate.id !== plan.id) {
        throw new ApprovalServiceError(
          "An active budget already exists for this cost center, fiscal year, and type",
          "DUPLICATE"
        );
      }

      const usersMap = await this.users.getUsersByIdMap();
      const draftRoute = buildApprovalRoute(plan.ownerId, usersMap);
      const now = new Date().toISOString();
      const previousStatus = plan.status;

      const routeSteps = draftRoute.map((step) => ({
        id: newId("route"),
        budgetPlanId: plan.id,
        approverId: step.approverId,
        sequence: step.sequence,
        status: "Pending" as const,
      }));
      await this.routes.replaceForBudget(plan.id, routeSteps);

      if (routeSteps.length === 0) {
        plan.status = "Approved";
        plan.currentApproverId = null;
        plan.submittedAt = now;
        plan.sapVersion = plan.sapVersion ?? "V1";
        plan.updatedAt = now;
        plan.version += 1;
        await this.budgets.save(plan);
        await this.history.append({
          id: newId("hist"),
          budgetPlanId: plan.id,
          performedBy: actor.id,
          action: "SubmittedAndCompleted",
          previousStatus,
          newStatus: "Approved",
          comment: null,
          timestamp: now,
        });
        await this.audits.append({
          id: newId("audit"),
          entity: "BudgetPlan",
          entityId: plan.id,
          action: "SubmittedAndCompleted",
          performedBy: actor.id,
          ipAddress,
          correlationId,
          beforeJson: JSON.stringify({ status: previousStatus }),
          afterJson: JSON.stringify({ status: "Approved" }),
          timestamp: now,
        });
        return plan;
      }

      plan.status = "InApproval";
      plan.currentApproverId = routeSteps[0].approverId;
      plan.submittedAt = now;
      plan.updatedAt = now;
      plan.version += 1;
      await this.budgets.save(plan);

      await this.history.append({
        id: newId("hist"),
        budgetPlanId: plan.id,
        performedBy: actor.id,
        action: "Submitted",
        previousStatus,
        newStatus: "InApproval",
        comment: null,
        timestamp: now,
      });
      await this.audits.append({
        id: newId("audit"),
        entity: "BudgetPlan",
        entityId: plan.id,
        action: "Submitted",
        performedBy: actor.id,
        ipAddress,
        correlationId,
        beforeJson: JSON.stringify({ status: previousStatus }),
        afterJson: JSON.stringify({
          status: "InApproval",
          currentApproverId: plan.currentApproverId,
        }),
        timestamp: now,
      });
      await this.notifications.create({
        id: newId("notif"),
        userId: routeSteps[0].approverId,
        type: "Approval",
        title: "Budget awaiting your approval",
        body: `${actor.name} submitted a budget for your review.`,
        relatedPlanId: plan.id,
        isRead: false,
        createdAt: now,
      });
      return plan;
    });
  }

  async approve(
    planId: string,
    actor: User,
    correlationId = newId("corr"),
    ipAddress: string | null = null
  ): Promise<BudgetPlan> {
    return this.uow.runInTransaction(async () => {
      const plan = await this.budgets.getById(planId);
      if (!plan) throw new ApprovalServiceError("Budget not found", "NOT_FOUND");
      if (plan.status !== "InApproval") {
        throw new ApprovalServiceError(
          "Budget is not awaiting approval",
          "INVALID_STATE"
        );
      }
      if (plan.currentApproverId !== actor.id) {
        throw new AuthorizationError(
          "You are not the current approver for this budget"
        );
      }
      this.authz.assertPermission(actor, "budget.approve");
      if (actor.id === plan.ownerId) {
        throw new AuthorizationError("Owner cannot approve their own budget");
      }

      const route = await this.routes.listByBudgetId(plan.id);
      const current = route.find(
        (r) => r.approverId === actor.id && r.status === "Pending"
      );
      if (!current) {
        return plan;
      }

      const now = new Date().toISOString();
      const previousStatus = plan.status;
      current.status = "Approved";
      await this.routes.saveStep(current);

      const next = route
        .filter((r) => r.status === "Pending" && r.sequence > current.sequence)
        .sort((a, b) => a.sequence - b.sequence)[0];

      if (next) {
        plan.currentApproverId = next.approverId;
        plan.updatedAt = now;
        plan.version += 1;
        await this.budgets.save(plan);
        await this.history.append({
          id: newId("hist"),
          budgetPlanId: plan.id,
          performedBy: actor.id,
          action: "Approved",
          previousStatus,
          newStatus: "InApproval",
          comment: null,
          timestamp: now,
        });
        await this.audits.append({
          id: newId("audit"),
          entity: "BudgetPlan",
          entityId: plan.id,
          action: "ApprovedStep",
          performedBy: actor.id,
          ipAddress,
          correlationId,
          beforeJson: JSON.stringify({ currentApproverId: actor.id }),
          afterJson: JSON.stringify({ currentApproverId: next.approverId }),
          timestamp: now,
        });
        await this.notifications.create({
          id: newId("notif"),
          userId: next.approverId,
          type: "Approval",
          title: "Budget awaiting your approval",
          body: `A budget approved by ${actor.name} is ready for your review.`,
          relatedPlanId: plan.id,
          isRead: false,
          createdAt: now,
        });
      } else {
        plan.status = "Approved";
        plan.currentApproverId = null;
        plan.sapVersion = plan.sapVersion ?? "V1";
        plan.updatedAt = now;
        plan.version += 1;
        await this.budgets.save(plan);
        await this.history.append({
          id: newId("hist"),
          budgetPlanId: plan.id,
          performedBy: actor.id,
          action: "Approved",
          previousStatus,
          newStatus: "Approved",
          comment: null,
          timestamp: now,
        });
        await this.audits.append({
          id: newId("audit"),
          entity: "BudgetPlan",
          entityId: plan.id,
          action: "ApprovedFinal",
          performedBy: actor.id,
          ipAddress,
          correlationId,
          beforeJson: JSON.stringify({ status: previousStatus }),
          afterJson: JSON.stringify({ status: "Approved" }),
          timestamp: now,
        });
        await this.notifications.create({
          id: newId("notif"),
          userId: plan.ownerId,
          type: "Approval",
          title: "Budget approved",
          body: `Your budget was approved by ${actor.name}.`,
          relatedPlanId: plan.id,
          isRead: false,
          createdAt: now,
        });
      }
      return plan;
    });
  }

  async reject(
    planId: string,
    actor: User,
    comment: string,
    correlationId = newId("corr"),
    ipAddress: string | null = null
  ): Promise<BudgetPlan> {
    return this.uow.runInTransaction(async () => {
      if (!comment?.trim()) {
        throw new ApprovalServiceError(
          "Rejection reason is required",
          "VALIDATION"
        );
      }
      const plan = await this.budgets.getById(planId);
      if (!plan) throw new ApprovalServiceError("Budget not found", "NOT_FOUND");
      if (plan.status !== "InApproval") {
        throw new ApprovalServiceError(
          "Budget is not awaiting approval",
          "INVALID_STATE"
        );
      }
      if (plan.currentApproverId !== actor.id) {
        throw new AuthorizationError(
          "You are not the current approver for this budget"
        );
      }
      this.authz.assertPermission(actor, "budget.reject");

      const now = new Date().toISOString();
      const previousStatus = plan.status;
      const route = await this.routes.listByBudgetId(plan.id);
      for (const step of route.filter((r) => r.status === "Pending")) {
        step.status = "Invalidated";
        await this.routes.saveStep(step);
      }

      plan.status = "Draft";
      plan.currentApproverId = null;
      plan.updatedAt = now;
      plan.version += 1;
      await this.budgets.save(plan);

      await this.history.append({
        id: newId("hist"),
        budgetPlanId: plan.id,
        performedBy: actor.id,
        action: "Rejected",
        previousStatus,
        newStatus: "Draft",
        comment: comment.trim(),
        timestamp: now,
      });
      await this.audits.append({
        id: newId("audit"),
        entity: "BudgetPlan",
        entityId: plan.id,
        action: "Rejected",
        performedBy: actor.id,
        ipAddress,
        correlationId,
        beforeJson: JSON.stringify({ status: previousStatus }),
        afterJson: JSON.stringify({ status: "Draft", comment }),
        timestamp: now,
      });
      await this.notifications.create({
        id: newId("notif"),
        userId: plan.ownerId,
        type: "Rejection",
        title: "Budget returned for revision",
        body: comment.trim(),
        relatedPlanId: plan.id,
        isRead: false,
        createdAt: now,
      });
      return plan;
    });
  }
}

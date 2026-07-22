import "server-only";

import { buildApprovalRoute } from "@/domain/rules/build-approval-route";
import { computeFinanceDueDates } from "@/domain/rules/finance-sla";
import {
  assertCanSubmit,
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
  IFiscalYearRepository,
  INotificationRepository,
  ISubmissionStatusRepository,
  IUnitOfWork,
  IUserRepository,
  IWorkflowHistoryRepository,
} from "@/infrastructure/repositories/interfaces";
import { newId } from "@/infrastructure/id";
import { submissionStatusForBudget } from "@/domain/rules/submission-status";
import { budgetCategoryLabel } from "@/domain/constants/budget-types";
import {
  AuthorizationError,
  AuthorizationService,
} from "./authorization-service";
import {
  ActiveBudgetConflictError,
  existingActiveBudgetFromPlan,
} from "./active-budget-conflict";
import {
  listFinanceAdministrators,
  notifyFinanceQueue,
  WorkflowRecorder,
} from "./workflow-recorder";

/**
 * ApprovalService
 *
 * Responsibility
 * --------------
 * Owns budget submission into the hierarchy, each approval step, return for
 * revision, and GM-only permanent reject. Builds the route from Users.managerId.
 *
 * Does NOT:
 * - claim / finalize / release finance work (FinanceService)
 * - edit budget lines (BudgetPlanService)
 * - send email (in-app notifications only)
 *
 * Business Rules: BR-02, BR-05, BR-14…23
 * Workflows: WF-002, WF-003, WF-004, WF-005
 * Dependencies: AuthorizationService, UnitOfWork, users/budgets/routes/history/
 *   audits/notifications/workflow/submissionStatus repositories
 *
 * Maintainer notes
 * ----------------
 * Manager/GM approve resolves the actor's approval task before creating the
 * next-step task. Finance never permanently rejects (see FinanceService).
 */
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
  private readonly workflow: WorkflowRecorder;

  constructor(
    private readonly users: IUserRepository,
    private readonly budgets: IBudgetPlanRepository,
    private readonly costCenters: ICostCenterRepository,
    private readonly fiscalYears: IFiscalYearRepository,
    private readonly routes: IApprovalRouteRepository,
    private readonly history: IApprovalHistoryRepository,
    private readonly audits: IAuditLogRepository,
    private readonly notifications: INotificationRepository,
    private readonly authz: AuthorizationService,
    private readonly uow: IUnitOfWork,
    private readonly submissionStatus: ISubmissionStatusRepository,
    workflowRepo: IWorkflowHistoryRepository
  ) {
    this.workflow = new WorkflowRecorder(workflowRepo);
  }

  private async recordDeniedAttempt(
    actor: User,
    planId: string,
    action: string,
    reason: string
  ): Promise<void> {
    await this.audits.append({
      id: newId("audit"),
      entity: "BudgetPlan",
      entityId: planId,
      action,
      performedBy: actor.id,
      ipAddress: null,
      correlationId: newId("corr"),
      beforeJson: null,
      afterJson: JSON.stringify({ denied: true, reason }),
      timestamp: new Date().toISOString(),
    });
  }

  private async recordSubmission(plan: BudgetPlan): Promise<void> {
    await this.submissionStatus.upsert({
      costCenterId: plan.costCenterId,
      fiscalYearId: plan.fiscalYearId,
      status: submissionStatusForBudget(plan.status),
      updatedAt: new Date().toISOString(),
    });
  }

  private async assertPlanFyOpen(plan: BudgetPlan) {
    const fy = await this.fiscalYears.getById(plan.fiscalYearId);
    if (!fy || fy.status !== "Open") {
      throw new ApprovalServiceError(
        `Financial year is ${fy?.status ?? "missing"} — workflow actions are blocked`,
        "FY_LOCKED"
      );
    }
  }

  /** GM-approved budgets enter Finance queue; SAP reference stamped on Finalize. */
  private async enterFinanceQueue(
    plan: BudgetPlan,
    actor: User,
    correlationId: string,
    now: string
  ): Promise<void> {
    const due = computeFinanceDueDates(now);
    plan.claimDueAt = due.claimDueAt;
    plan.reviewDueAt = due.reviewDueAt;
    plan.escalationStatus = "None";
  }

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
        await this.recordDeniedAttempt(
          actor,
          plan.id,
          "SubmitDenied",
          "Only the owner can submit this budget"
        );
        throw new AuthorizationError("Only the owner can submit this budget");
      }
      this.authz.assertPermission(actor, "budget.submit");
      assertCanSubmit(plan);
      await this.assertPlanFyOpen(plan);

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
        plan.budgetCategory
      );
      if (duplicate && duplicate.id !== plan.id) {
        const [dupCc, dupFy, owner] = await Promise.all([
          this.costCenters.getById(duplicate.costCenterId),
          this.fiscalYears.getById(duplicate.fiscalYearId),
          this.users.getById(duplicate.ownerId),
        ]);
        const costCenterCode = dupCc?.code ?? duplicate.costCenterId;
        const yearLabel = dupFy?.yearLabel ?? 0;
        throw new ActiveBudgetConflictError(
          `An active ${budgetCategoryLabel(duplicate.budgetCategory)} budget already exists for Cost Center ${costCenterCode} for FY${yearLabel}.`,
          existingActiveBudgetFromPlan(duplicate, {
            costCenterCode,
            costCenterName: dupCc?.name ?? "",
            fiscalYearLabel: yearLabel,
            ownerName: owner?.name ?? null,
          })
        );
      }

      const usersMap = await this.users.getUsersByIdMap();
      const draftRoute = buildApprovalRoute(
        plan.ownerId,
        usersMap,
        cc.managerId
      );
      const now = new Date().toISOString();
      const previousStatus = plan.status;
      const isResubmit = previousStatus === "ReturnedForRevision";
      const submitAction = isResubmit ? "Resubmitted" : "Submitted";

      const routeSteps = draftRoute.map((step) => ({
        id: newId("route"),
        budgetPlanId: plan.id,
        approverId: step.approverId,
        sequence: step.sequence,
        status: "Pending" as const,
      }));
      await this.routes.replaceForBudget(plan.id, routeSteps);

      if (routeSteps.length === 0) {
        const nowFinance = now;
        plan.status = "PendingFinanceReview";
        plan.currentApproverId = null;
        plan.submittedAt = nowFinance;
        await this.enterFinanceQueue(plan, actor, correlationId, nowFinance);
        plan.updatedAt = nowFinance;
        Object.assign(plan, await this.budgets.save(plan));
        await this.history.append({
          id: newId("hist"),
          budgetPlanId: plan.id,
          performedBy: actor.id,
          action: submitAction,
          previousStatus,
          newStatus: "PendingFinanceReview",
          comment: null,
          timestamp: nowFinance,
        });
        await this.workflow.record(
          plan.id,
          actor.id,
          "FinanceQueue",
          submitAction
        );
        const financeUsers = listFinanceAdministrators(
          await this.users.getAll()
        );
        await notifyFinanceQueue(
          this.notifications,
          financeUsers,
          plan,
          actor.name
        );
        await this.recordSubmission(plan);
        return plan;
      }

      plan.status = "InApproval";
      plan.currentApproverId = routeSteps[0]!.approverId;
      plan.submittedAt = now;
      plan.updatedAt = now;
      Object.assign(plan, await this.budgets.save(plan));

      await this.history.append({
        id: newId("hist"),
        budgetPlanId: plan.id,
        performedBy: actor.id,
        action: submitAction,
        previousStatus,
        newStatus: "InApproval",
        comment: null,
        timestamp: now,
      });
      await this.workflow.record(
        plan.id,
        actor.id,
        isResubmit ? "Submitted" : "Submitted",
        submitAction
      );
      await this.audits.append({
        id: newId("audit"),
        entity: "BudgetPlan",
        entityId: plan.id,
        action: submitAction,
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
        userId: routeSteps[0]!.approverId,
        type: "Approval",
        title: isResubmit
          ? "Budget resubmitted for your approval"
          : "Budget awaiting your approval",
        message: isResubmit
          ? `${actor.name} resubmitted a budget after revision.`
          : `${actor.name} submitted a budget for your review.`,
        priority: "High",
        category: "Approval",
        actionLabel: "Review Budget",
        relatedPlanId: plan.id,
        entityType: "Budget",
        entityId: plan.id,
        // Deep-link: the budget page focuses its Decision panel for ?action=approve.
        targetUrl: `/budgets/${plan.id}?action=approve`,
        isRead: false,
        createdAt: now,
      });
      await this.recordSubmission(plan);
      return plan;
    });
  }

  async approve(
    planId: string,
    actor: User,
    comment: string | null = null,
    correlationId = newId("corr"),
    ipAddress: string | null = null
  ): Promise<BudgetPlan> {
    return this.uow.runInTransaction(async () => {
      const plan = await this.assertCurrentApprover(planId, actor, "budget.approve");
      await this.assertPlanFyOpen(plan);
      const route = await this.routes.listByBudgetId(plan.id);
      const current = route.find(
        (r) => r.approverId === actor.id && r.status === "Pending"
      );
      if (!current) return plan;

      const now = new Date().toISOString();
      const previousStatus = plan.status;
      const note = comment?.trim() || null;
      current.status = "Approved";
      await this.routes.saveStep(current);

      const next = route
        .filter((r) => r.status === "Pending" && r.sequence > current.sequence)
        .sort((a, b) => a.sequence - b.sequence)[0];

      await this.notifications.resolveForPlan(plan.id, {
        userId: actor.id,
        types: ["Approval"],
        resolvedBy: actor.id,
      });

      if (next) {
        plan.currentApproverId = next.approverId;
        plan.updatedAt = now;
        Object.assign(plan, await this.budgets.save(plan));
        const stage =
          current.sequence === 1 && route.length > 1 ? "ManagerReview" : "GMReview";
        await this.history.append({
          id: newId("hist"),
          budgetPlanId: plan.id,
          performedBy: actor.id,
          action: "Approved",
          previousStatus,
          newStatus: "InApproval",
          comment: note,
          timestamp: now,
        });
        await this.workflow.record(plan.id, actor.id, stage, "Approved", note);
        await this.audits.append({
          id: newId("audit"),
          entity: "BudgetPlan",
          entityId: plan.id,
          action: "ApprovedStep",
          performedBy: actor.id,
          ipAddress,
          correlationId,
          beforeJson: JSON.stringify({
            status: previousStatus,
            currentApproverId: actor.id,
          }),
          afterJson: JSON.stringify({
            status: "InApproval",
            currentApproverId: next.approverId,
            comment: note,
          }),
          timestamp: now,
        });
        await this.notifications.create({
          id: newId("notif"),
          userId: next.approverId,
          type: "Approval",
          title: "Budget awaiting your approval",
          message: `A budget approved by ${actor.name} is ready for your review.`,
          priority: "High",
          category: "Approval",
          actionLabel: "Review Budget",
          relatedPlanId: plan.id,
          entityType: "Budget",
          entityId: plan.id,
          targetUrl: `/budgets/${plan.id}?action=approve`,
          isRead: false,
          createdAt: now,
        });
      } else {
        plan.status = "PendingFinanceReview";
        plan.currentApproverId = null;
        await this.enterFinanceQueue(plan, actor, correlationId, now);
        plan.updatedAt = now;
        Object.assign(plan, await this.budgets.save(plan));
        await this.notifications.resolveForPlan(plan.id, {
          types: ["Approval"],
          resolvedBy: actor.id,
        });
        await this.history.append({
          id: newId("hist"),
          budgetPlanId: plan.id,
          performedBy: actor.id,
          action: "Approved",
          previousStatus,
          newStatus: "PendingFinanceReview",
          comment: note,
          timestamp: now,
        });
        await this.workflow.record(
          plan.id,
          actor.id,
          "FinanceQueue",
          "GMApproved",
          note
        );
        await this.audits.append({
          id: newId("audit"),
          entity: "BudgetPlan",
          entityId: plan.id,
          action: "ApprovedToFinance",
          performedBy: actor.id,
          ipAddress,
          correlationId,
          beforeJson: JSON.stringify({ status: previousStatus }),
          afterJson: JSON.stringify({
            status: "PendingFinanceReview",
            comment: note,
          }),
          timestamp: now,
        });
        const financeUsers = listFinanceAdministrators(
          await this.users.getAll()
        );
        await notifyFinanceQueue(
          this.notifications,
          financeUsers,
          plan,
          actor.name
        );
      }
      await this.recordSubmission(plan);
      return plan;
    });
  }

  /** Return for revision — editable by owner, then resubmit. */
  async returnForRevision(
    planId: string,
    actor: User,
    reason: string,
    correlationId = newId("corr"),
    ipAddress: string | null = null
  ): Promise<BudgetPlan> {
    return this.uow.runInTransaction(async () => {
      if (!reason?.trim()) {
        throw new ApprovalServiceError(
          "A reason is required to return for revision",
          "VALIDATION"
        );
      }
      const plan = await this.assertCurrentApprover(
        planId,
        actor,
        "budget.approve"
      );
      if (!this.authz.canReturnBudget(actor)) {
        await this.recordDeniedAttempt(
          actor,
          plan.id,
          "ReturnDenied",
          "Only a Manager or General Manager may return a budget"
        );
        throw new AuthorizationError(
          "Only a Manager or General Manager may return a budget"
        );
      }
      await this.assertPlanFyOpen(plan);
      const now = new Date().toISOString();
      const previousStatus = plan.status;
      const comment = reason.trim();

      await this.invalidatePendingRoute(plan.id);

      plan.status = "ReturnedForRevision";
      plan.currentApproverId = null;
      plan.updatedAt = now;
      Object.assign(plan, await this.budgets.save(plan));

      await this.notifications.resolveForPlan(plan.id, {
        types: ["Approval"],
        resolvedBy: actor.id,
      });

      await this.history.append({
        id: newId("hist"),
        budgetPlanId: plan.id,
        performedBy: actor.id,
        action: "Returned",
        previousStatus,
        newStatus: "ReturnedForRevision",
        comment,
        timestamp: now,
      });
      const returnStage =
        this.authz.resolveOrgRole(actor) === "manager"
          ? "ManagerReview"
          : "GMReview";
      await this.workflow.record(
        plan.id,
        actor.id,
        returnStage,
        "Returned",
        comment
      );
      await this.audits.append({
        id: newId("audit"),
        entity: "BudgetPlan",
        entityId: plan.id,
        action: "ReturnedForRevision",
        performedBy: actor.id,
        ipAddress,
        correlationId,
        beforeJson: JSON.stringify({ status: previousStatus }),
        afterJson: JSON.stringify({
          status: "ReturnedForRevision",
          comment,
        }),
        timestamp: now,
      });
      await this.notifications.create({
        id: newId("notif"),
        userId: plan.ownerId,
        type: "Outcome",
        title: "Budget returned",
        message: comment,
        priority: "Medium",
        category: "Outcome",
        actionLabel: "View Budget",
        relatedPlanId: plan.id,
        entityType: "Budget",
        entityId: plan.id,
        targetUrl: `/budgets/${plan.id}`,
        isRead: false,
        createdAt: now,
      });
      await this.recordSubmission(plan);
      return plan;
    });
  }

  /** Permanent reject — irreversible, not editable. */
  async reject(
    planId: string,
    actor: User,
    reason: string,
    correlationId = newId("corr"),
    ipAddress: string | null = null
  ): Promise<BudgetPlan> {
    return this.uow.runInTransaction(async () => {
      if (!reason?.trim()) {
        throw new ApprovalServiceError(
          "Rejection reason is required",
          "VALIDATION"
        );
      }
      const plan = await this.assertCurrentApprover(
        planId,
        actor,
        "budget.approve"
      );
      if (!this.authz.canRejectBudget(actor)) {
        await this.recordDeniedAttempt(
          actor,
          plan.id,
          "RejectDenied",
          "Only the General Manager can reject a budget"
        );
        throw new AuthorizationError(
          "Only the General Manager can reject a budget"
        );
      }
      await this.assertPlanFyOpen(plan);
      const now = new Date().toISOString();
      const previousStatus = plan.status;
      const comment = reason.trim();

      await this.invalidatePendingRoute(plan.id);

      plan.status = "Rejected";
      plan.currentApproverId = null;
      plan.updatedAt = now;
      Object.assign(plan, await this.budgets.save(plan));

      await this.notifications.resolveForPlan(plan.id, {
        types: ["Approval"],
        resolvedBy: actor.id,
      });

      await this.history.append({
        id: newId("hist"),
        budgetPlanId: plan.id,
        performedBy: actor.id,
        action: "Rejected",
        previousStatus,
        newStatus: "Rejected",
        comment,
        timestamp: now,
      });
      await this.workflow.record(
        plan.id,
        actor.id,
        "Rejected",
        "Rejected",
        comment
      );
      await this.audits.append({
        id: newId("audit"),
        entity: "BudgetPlan",
        entityId: plan.id,
        action: "Rejected",
        performedBy: actor.id,
        ipAddress,
        correlationId,
        beforeJson: JSON.stringify({ status: previousStatus }),
        afterJson: JSON.stringify({ status: "Rejected", comment }),
        timestamp: now,
      });
      await this.notifications.create({
        id: newId("notif"),
        userId: plan.ownerId,
        type: "Outcome",
        title: "Budget rejected",
        message: comment,
        priority: "High",
        category: "Outcome",
        actionLabel: "View Budget",
        relatedPlanId: plan.id,
        entityType: "Budget",
        entityId: plan.id,
        targetUrl: `/budgets/${plan.id}`,
        isRead: false,
        createdAt: now,
      });
      await this.recordSubmission(plan);
      return plan;
    });
  }

  private async assertCurrentApprover(
    planId: string,
    actor: User,
    permission: "budget.approve" | "budget.reject"
  ): Promise<BudgetPlan> {
    const plan = await this.budgets.getById(planId);
    if (!plan) throw new ApprovalServiceError("Budget not found", "NOT_FOUND");
    if (plan.status !== "InApproval") {
      throw new ApprovalServiceError(
        "Budget is not awaiting approval",
        "INVALID_STATE"
      );
    }
    if (plan.currentApproverId !== actor.id) {
      await this.recordDeniedAttempt(
        actor,
        plan.id,
        "ApprovalDenied",
        "You are not the current approver for this budget"
      );
      throw new AuthorizationError(
        "You are not the current approver for this budget"
      );
    }
    this.authz.assertPermission(actor, permission);
    if (permission === "budget.approve" && actor.id === plan.ownerId) {
      await this.recordDeniedAttempt(
        actor,
        plan.id,
        "ApprovalDenied",
        "Owner cannot approve their own budget"
      );
      throw new AuthorizationError("Owner cannot approve their own budget");
    }
    return plan;
  }

  private async invalidatePendingRoute(planId: string): Promise<void> {
    const route = await this.routes.listByBudgetId(planId);
    for (const step of route.filter((r) => r.status === "Pending")) {
      step.status = "Invalidated";
      await this.routes.saveStep(step);
    }
  }
}

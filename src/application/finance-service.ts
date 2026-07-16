import { computeFinanceDueDates, isOverdue } from "@/domain/rules/finance-sla";
import { submissionStatusForBudget } from "@/domain/rules/submission-status";
import type { BudgetPlan, SapPackage, User } from "@/domain/entities";
import type {
  IApprovalHistoryRepository,
  IAuditLogRepository,
  IBudgetLineageRepository,
  IBudgetPlanRepository,
  IFinanceClaimRepository,
  IFiscalYearRepository,
  INotificationRepository,
  ISapPackageRepository,
  ISubmissionStatusRepository,
  IUnitOfWork,
  IUserRepository,
  IWorkflowHistoryRepository,
} from "@/infrastructure/repositories/interfaces";
import { newId } from "@/infrastructure/id";
import {
  AuthorizationError,
  AuthorizationService,
} from "./authorization-service";
import {
  listFinanceAdministrators,
  notifyFinanceQueue,
  WorkflowRecorder,
} from "./workflow-recorder";
import {
  buildSapReference,
  sapFormToCsv,
  type SapComplianceForm,
} from "./sap-compliance-service";
import type {
  ICostCenterRepository,
  IDepartmentRepository,
  IGlAccountRepository,
} from "@/infrastructure/repositories/interfaces";

export class FinanceServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "FinanceServiceError";
  }
}

export class FinanceService {
  private readonly workflow: WorkflowRecorder;

  constructor(
    private readonly users: IUserRepository,
    private readonly budgets: IBudgetPlanRepository,
    private readonly lineages: IBudgetLineageRepository,
    private readonly costCenters: ICostCenterRepository,
    private readonly departments: IDepartmentRepository,
    private readonly fiscalYears: IFiscalYearRepository,
    private readonly glAccounts: IGlAccountRepository,
    private readonly claims: IFinanceClaimRepository,
    private readonly sapPackages: ISapPackageRepository,
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

  async listQueue(actor: User): Promise<BudgetPlan[]> {
    this.authz.assertPermission(actor, "finance.view");
    return this.budgets.listPendingFinanceReview();
  }

  async listClaimed(actor: User): Promise<BudgetPlan[]> {
    this.authz.assertPermission(actor, "finance.view");
    const all = await this.budgets.listClaimed();
    if (actor.roleCodes.includes("SystemAdmin")) return all;
    return all.filter((p) => p.financeClaimedBy === actor.id);
  }

  async claim(
    planId: string,
    actor: User,
    correlationId = newId("corr")
  ): Promise<BudgetPlan> {
    return this.uow.runInTransaction(async () => {
      this.authz.assertPermission(actor, "finance.claim");
      const plan = await this.budgets.getById(planId);
      if (!plan) throw new FinanceServiceError("Budget not found", "NOT_FOUND");
      if (plan.status !== "PendingFinanceReview") {
        throw new FinanceServiceError(
          "Budget is not in the Finance queue",
          "INVALID_STATE"
        );
      }
      const existing = await this.claims.getActiveClaim(planId);
      if (existing) {
        throw new FinanceServiceError(
          "Budget is already claimed",
          "ALREADY_CLAIMED"
        );
      }

      const now = new Date().toISOString();
      const previousStatus = plan.status;
      plan.status = "Claimed";
      plan.financeClaimedBy = actor.id;
      plan.financeClaimedAt = now;
      plan.currentApproverId = actor.id;
      const reviewDue = computeFinanceDueDates(now);
      plan.reviewDueAt = reviewDue.reviewDueAt;
      plan.updatedAt = now;
      Object.assign(plan, await this.budgets.save(plan));

      await this.claims.claim({
        id: newId("claim"),
        budgetPlanId: plan.id,
        claimedBy: actor.id,
        claimedAt: now,
        releasedAt: null,
        isActive: true,
      });

      await this.history.append({
        id: newId("hist"),
        budgetPlanId: plan.id,
        performedBy: actor.id,
        action: "FinanceClaimed",
        previousStatus,
        newStatus: "Claimed",
        comment: null,
        timestamp: now,
      });
      await this.workflow.record(
        plan.id,
        actor.id,
        "FinanceClaimed",
        "FinanceClaimed"
      );
      await this.audits.append({
        id: newId("audit"),
        entity: "BudgetPlan",
        entityId: plan.id,
        action: "FinanceClaimed",
        performedBy: actor.id,
        ipAddress: null,
        correlationId,
        beforeJson: JSON.stringify({ status: previousStatus }),
        afterJson: JSON.stringify({
          status: "Claimed",
          financeClaimedBy: actor.id,
        }),
        timestamp: now,
      });
      await this.notifications.create({
        id: newId("notif"),
        userId: plan.ownerId,
        type: "Finance",
        title: "Finance is reviewing your budget",
        body: `${actor.name} claimed your budget for Finance review.`,
        relatedPlanId: plan.id,
        isRead: false,
        createdAt: now,
      });
      await this.recordSubmission(plan);
      return plan;
    });
  }

  async release(
    planId: string,
    actor: User,
    correlationId = newId("corr")
  ): Promise<BudgetPlan> {
    return this.uow.runInTransaction(async () => {
      const plan = await this.budgets.getById(planId);
      if (!plan) throw new FinanceServiceError("Budget not found", "NOT_FOUND");
      if (plan.status !== "Claimed") {
        throw new FinanceServiceError("Budget is not claimed", "INVALID_STATE");
      }
      const isClaimant = plan.financeClaimedBy === actor.id;
      const isAdmin = actor.roleCodes.includes("SystemAdmin");
      if (!isClaimant && !isAdmin) {
        await this.recordDeniedAttempt(
          actor,
          plan.id,
          "FinanceReleaseDenied",
          "Only the claimant or System Admin may release"
        );
        throw new AuthorizationError("Only the claimant or System Admin may release");
      }

      const now = new Date().toISOString();
      const previousStatus = plan.status;
      const previousClaimant = plan.financeClaimedBy;
      await this.claims.release(planId, now);
      plan.status = "PendingFinanceReview";
      plan.financeClaimedBy = null;
      plan.financeClaimedAt = null;
      plan.currentApproverId = null;
      plan.updatedAt = now;
      Object.assign(plan, await this.budgets.save(plan));

      await this.history.append({
        id: newId("hist"),
        budgetPlanId: plan.id,
        performedBy: actor.id,
        action: "FinanceReleased",
        previousStatus,
        newStatus: "PendingFinanceReview",
        comment: null,
        timestamp: now,
      });
      await this.workflow.record(
        plan.id,
        actor.id,
        "FinanceQueue",
        "FinanceReleased"
      );
      await this.audits.append({
        id: newId("audit"),
        entity: "BudgetPlan",
        entityId: plan.id,
        action: "FinanceReleased",
        performedBy: actor.id,
        ipAddress: null,
        correlationId,
        beforeJson: JSON.stringify({
          status: previousStatus,
          financeClaimedBy: previousClaimant,
        }),
        afterJson: JSON.stringify({ status: "PendingFinanceReview" }),
        timestamp: now,
      });
      await this.recordSubmission(plan);
      return plan;
    });
  }

  async finalize(
    planId: string,
    actor: User,
    correlationId = newId("corr")
  ): Promise<BudgetPlan> {
    return this.uow.runInTransaction(async () => {
      this.authz.assertPermission(actor, "finance.finalize");
      const plan = await this.assertClaimant(planId, actor);
      if (plan.status !== "Claimed") {
        throw new FinanceServiceError("Budget must be claimed to finalize", "INVALID_STATE");
      }

      const now = new Date().toISOString();
      const previousStatus = plan.status;
      const sapRef = await this.freezeSapPackage(plan, actor, now);

      plan.status = "Finalized";
      plan.sapVersion = sapRef;
      plan.currentApproverId = null;
      plan.updatedAt = now;
      Object.assign(plan, await this.budgets.save(plan));

      if (plan.lineageId) {
        await this.lineages.updatePointers(plan.lineageId, {
          currentVersionId: plan.id,
          latestFinalizedVersionId: plan.id,
        });
      }

      await this.claims.release(planId, now);

      await this.history.append({
        id: newId("hist"),
        budgetPlanId: plan.id,
        performedBy: actor.id,
        action: "FinanceFinalized",
        previousStatus,
        newStatus: "Finalized",
        comment: null,
        timestamp: now,
      });
      await this.workflow.record(
        plan.id,
        actor.id,
        "FinanceFinalized",
        "FinanceFinalized"
      );
      await this.audits.append({
        id: newId("audit"),
        entity: "BudgetPlan",
        entityId: plan.id,
        action: "FinanceFinalized",
        performedBy: actor.id,
        ipAddress: null,
        correlationId,
        beforeJson: JSON.stringify({ status: previousStatus }),
        afterJson: JSON.stringify({
          status: "Finalized",
          sapVersion: sapRef,
        }),
        timestamp: now,
      });

      await this.notifyFinalized(plan, actor, now);
      await this.recordSubmission(plan);
      return plan;
    });
  }

  async returnForRevision(
    planId: string,
    actor: User,
    reason: string,
    correlationId = newId("corr")
  ): Promise<BudgetPlan> {
    return this.uow.runInTransaction(async () => {
      if (!reason?.trim()) {
        throw new FinanceServiceError("Return reason is required", "VALIDATION");
      }
      this.authz.assertPermission(actor, "finance.return");
      const plan = await this.assertClaimant(planId, actor);
      if (plan.status !== "Claimed") {
        throw new FinanceServiceError("Budget must be claimed to return", "INVALID_STATE");
      }

      const now = new Date().toISOString();
      const previousStatus = plan.status;
      const comment = reason.trim();

      await this.claims.release(planId, now);
      plan.status = "ReturnedForRevision";
      plan.financeClaimedBy = null;
      plan.financeClaimedAt = null;
      plan.currentApproverId = null;
      plan.updatedAt = now;
      Object.assign(plan, await this.budgets.save(plan));

      await this.history.append({
        id: newId("hist"),
        budgetPlanId: plan.id,
        performedBy: actor.id,
        action: "FinanceReturned",
        previousStatus,
        newStatus: "ReturnedForRevision",
        comment,
        timestamp: now,
      });
      await this.workflow.record(
        plan.id,
        actor.id,
        "FinanceReturned",
        "FinanceReturned",
        comment
      );
      await this.audits.append({
        id: newId("audit"),
        entity: "BudgetPlan",
        entityId: plan.id,
        action: "FinanceReturned",
        performedBy: actor.id,
        ipAddress: null,
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
        title: "Budget returned by Finance",
        body: comment,
        relatedPlanId: plan.id,
        isRead: false,
        createdAt: now,
      });
      await this.recordSubmission(plan);
      return plan;
    });
  }

  async processEscalations(actor: User): Promise<number> {
    this.authz.assertPermission(actor, "finance.view");
    const queue = await this.budgets.listPendingFinanceReview();
    const claimed = await this.budgets.listClaimed();
    const all = [...queue, ...claimed];
    const financeAdmins = listFinanceAdministrators(await this.users.getAll());
    const now = new Date().toISOString();
    let escalated = 0;

    for (const plan of all) {
      const overdue =
        isOverdue(plan.claimDueAt) || isOverdue(plan.reviewDueAt);
      if (!overdue || plan.escalationStatus === "Escalated") continue;

      plan.escalationStatus = "Escalated";
      plan.updatedAt = now;
      await this.budgets.save(plan);
      escalated += 1;

      for (const admin of financeAdmins) {
        await this.notifications.create({
          id: newId("notif"),
          userId: admin.id,
          type: "FinanceEscalation",
          title: "Overdue Finance review",
          body: `Budget ${plan.versionLabel ?? plan.id} is overdue for Finance review.`,
          relatedPlanId: plan.id,
          isRead: false,
          createdAt: now,
        });
      }
    }
    return escalated;
  }

  private async assertClaimant(planId: string, actor: User): Promise<BudgetPlan> {
    const plan = await this.budgets.getById(planId);
    if (!plan) throw new FinanceServiceError("Budget not found", "NOT_FOUND");
    const isClaimant = plan.financeClaimedBy === actor.id;
    const isAdmin = actor.roleCodes.includes("SystemAdmin");
    if (!isClaimant && !isAdmin) {
      await this.recordDeniedAttempt(
        actor,
        plan.id,
        "FinanceClaimantDenied",
        "You are not the Finance claimant for this budget"
      );
      throw new AuthorizationError("You are not the Finance claimant for this budget");
    }
    return plan;
  }

  private async freezeSapPackage(
    plan: BudgetPlan,
    actor: User,
    now: string
  ): Promise<string> {
    const existing = await this.sapPackages.getByBudgetPlanId(plan.id);
    if (existing) return existing.sapReference;

    const form = await this.buildSapForm(plan);
    const csv = sapFormToCsv(form);
    const sapRef = form.sapReference;

    const pkg: SapPackage = {
      id: newId("sap"),
      budgetPlanId: plan.id,
      sapReference: sapRef,
      packageJson: JSON.stringify(form),
      csvContent: csv,
      generatedAt: now,
      generatedBy: actor.id,
    };
    await this.sapPackages.save(pkg);
    return sapRef;
  }

  private async buildSapForm(plan: BudgetPlan): Promise<SapComplianceForm> {
    const [cc, fy, userMap, gls, entries, lineage] = await Promise.all([
      this.costCenters.getById(plan.costCenterId),
      this.fiscalYears.getById(plan.fiscalYearId),
      this.users.getUsersByIdMap(),
      this.glAccounts.getAll(),
      this.history.listByBudgetId(plan.id),
      plan.lineageId ? this.lineages.getById(plan.lineageId) : null,
    ]);
    const dept = cc ? await this.departments.getById(cc.departmentId) : null;
    const glMap = new Map(gls.map((g) => [g.id, g]));
    const approvalEntries = entries
      .filter((e) =>
        ["Approved", "FinanceFinalized", "SubmittedAndCompleted"].includes(e.action)
      )
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const approvals = approvalEntries.map((e, i) => ({
      role: (i === approvalEntries.length - 1 ? "GM" : "Manager") as "Manager" | "GM",
      name: userMap.get(e.performedBy)?.name ?? e.performedBy,
      date: e.timestamp,
      comment: e.comment,
    }));
    const total = plan.lines.reduce((s, l) => s + l.amount, 0);
    const budgetNumber =
      plan.versionLabel ?? lineage?.budgetNumber ?? `BGT-${plan.id.slice(0, 8)}`;

    return {
      budgetNumber,
      sapReference: buildSapReference(
        fy?.yearLabel ?? 0,
        cc?.code ?? "CC",
        plan.id
      ),
      fiscalYear: fy?.yearLabel ?? 0,
      department: dept?.name ?? "Unknown",
      costCenterCode: cc?.code ?? "",
      costCenterName: cc?.name ?? "",
      responsiblePerson: userMap.get(plan.ownerId)?.name ?? plan.ownerId,
      glLines: plan.lines.map((l) => ({
        glCode: glMap.get(l.glAccountId)?.code ?? l.glAccountId,
        glDescription: glMap.get(l.glAccountId)?.description ?? "",
        amount: l.amount,
      })),
      requestedAmount: total,
      approvedAmount: total,
      approvals,
      submissionDate: plan.submittedAt,
      generationDate: new Date().toISOString(),
    };
  }

  private async notifyFinalized(
    plan: BudgetPlan,
    actor: User,
    now: string
  ): Promise<void> {
    const usersMap = await this.users.getUsersByIdMap();
    const owner = usersMap.get(plan.ownerId);
    const cc = await this.costCenters.getById(plan.costCenterId);
    const managerId = cc?.managerId ?? owner?.managerId ?? null;
    const gm = managerId ? usersMap.get(managerId) : null;

    const recipients = new Set<string>([plan.ownerId]);
    if (managerId) recipients.add(managerId);
    if (gm?.managerId) recipients.add(gm.managerId);
    recipients.add(actor.id);

    for (const userId of Array.from(recipients)) {
      await this.notifications.create({
        id: newId("notif"),
        userId,
        type: "Outcome",
        title: "Budget finalized",
        body: `Budget ${plan.versionLabel ?? ""} has been finalized by Finance.`,
        relatedPlanId: plan.id,
        isRead: false,
        createdAt: now,
      });
    }
  }

  private async recordSubmission(plan: BudgetPlan): Promise<void> {
    await this.submissionStatus.upsert({
      costCenterId: plan.costCenterId,
      fiscalYearId: plan.fiscalYearId,
      status: submissionStatusForBudget(plan.status),
      updatedAt: new Date().toISOString(),
    });
  }
}

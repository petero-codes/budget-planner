import {
  assertCanEditDraft,
  assertNotLocked,
  validateBudgetHeader,
  validateBudgetLines,
} from "@/domain/rules/budget-plan-invariants";
import {
  departmentCodeForBudget,
  formatBudgetNumber,
  formatVersionLabel,
  nextSequenceForDepartment,
} from "@/domain/rules/budget-number";
import {
  isOriginalBudgetType,
} from "@/domain/rules/build-approval-route";
import type {
  ApprovalHistoryEntry,
  BudgetAttachment,
  BudgetLineItem,
  BudgetLineage,
  BudgetPlan,
  User,
  WorkflowHistoryEntry,
} from "@/domain/entities";
import type {
  IApprovalHistoryRepository,
  IAuditLogRepository,
  IBudgetAttachmentRepository,
  IBudgetLineageRepository,
  IBudgetPlanRepository,
  ICostCenterRepository,
  IDepartmentRepository,
  IFiscalYearRepository,
  INotificationRepository,
  ISubmissionStatusRepository,
  IUnitOfWork,
  IUserRepository,
  IWorkflowHistoryRepository,
} from "@/infrastructure/repositories/interfaces";
import { newId } from "@/infrastructure/id";
import { submissionStatusForBudget } from "@/domain/rules/submission-status";
import {
  AuthorizationError,
  AuthorizationService,
} from "./authorization-service";
import { ApprovalService } from "./approval-service";
import {
  ActiveBudgetConflictError,
  existingActiveBudgetFromPlan,
  isActiveBudgetUniqueViolation,
} from "./active-budget-conflict";
import { BudgetLockedApiError } from "./budget-lock-error";
import { compareVersions } from "./version-compare-service";
import { listFinanceAdministrators } from "./workflow-recorder";

export interface CreateDraftInput {
  budgetType: string;
  fiscalYearId: string;
  fromPeriod: string;
  toPeriod: string;
  costCenterId: string;
  description?: string | null;
  lines: { glAccountId: string; amount: number }[];
}

export class BudgetPlanService {
  constructor(
    private readonly budgets: IBudgetPlanRepository,
    private readonly lineages: IBudgetLineageRepository,
    private readonly costCenters: ICostCenterRepository,
    private readonly departments: IDepartmentRepository,
    private readonly fiscalYears: IFiscalYearRepository,
    private readonly attachments: IBudgetAttachmentRepository,
    private readonly audits: IAuditLogRepository,
    private readonly history: IApprovalHistoryRepository,
    private readonly workflow: IWorkflowHistoryRepository,
    private readonly authz: AuthorizationService,
    private readonly approvalService: ApprovalService,
    private readonly uow: IUnitOfWork,
    private readonly submissionStatus: ISubmissionStatusRepository,
    private readonly users: IUserRepository,
    private readonly notifications: INotificationRepository
  ) {}

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

  private async assertFyOpen(fiscalYearId: string) {
    const fy = await this.fiscalYears.getById(fiscalYearId);
    if (!fy || fy.status !== "Open") {
      throw new Error(
        `Financial year is ${fy?.status ?? "missing"} — budgets cannot be created or edited`
      );
    }
  }

  private async assertNoActiveInLineage(
    lineageId: string,
    excludePlanId?: string
  ): Promise<void> {
    const duplicate = await this.budgets.findActiveInLineage(lineageId);
    if (!duplicate || duplicate.id === excludePlanId) return;
    throw new ActiveBudgetConflictError(
      `An active version already exists for this budget lineage.`,
      existingActiveBudgetFromPlan(duplicate, {
        costCenterCode: "",
        costCenterName: "",
        fiscalYearLabel: 0,
        ownerName: null,
      })
    );
  }

  private emptyPlanFields(): Pick<
    BudgetPlan,
    | "lineageId"
    | "parentBudgetPlanId"
    | "lineageRevision"
    | "versionLabel"
    | "amendmentReason"
    | "isArchived"
    | "claimDueAt"
    | "reviewDueAt"
    | "escalationStatus"
    | "financeClaimedAt"
    | "financeClaimedBy"
    | "isDemo"
    | "createdByToolkit"
    | "demoBatchId"
  > {
    return {
      lineageId: null,
      parentBudgetPlanId: null,
      lineageRevision: 1,
      versionLabel: null,
      amendmentReason: null,
      isArchived: false,
      claimDueAt: null,
      reviewDueAt: null,
      escalationStatus: "None",
      financeClaimedAt: null,
      financeClaimedBy: null,
      isDemo: false,
      createdByToolkit: false,
      demoBatchId: null,
    };
  }

  async createDraft(actor: User, input: CreateDraftInput): Promise<BudgetPlan> {
    this.authz.assertPermission(actor, "budget.create");
    if (input.costCenterId !== actor.primaryCostCenterId) {
      await this.recordDeniedAttempt(
        actor,
        newId("budget"),
        "DraftCreateDenied",
        "You can only create budgets for your own cost center"
      );
      throw new AuthorizationError(
        "You can only create budgets for your own cost center"
      );
    }
    const budgetType = input.budgetType.trim();
    if (!isOriginalBudgetType(budgetType)) {
      throw new Error(
        `Only original budget types (${["Primary", "Supplementary"].join(", ")}) may start a new lineage. Use Create Amendment for revisions.`
      );
    }

    const headerIssues = validateBudgetHeader(input);
    const lineIssues = validateBudgetLines(input.lines);
    const issues = [...headerIssues, ...lineIssues];
    if (issues.length) {
      throw new Error(issues.map((i) => i.message).join("; "));
    }
    await this.assertFyOpen(input.fiscalYearId);

    const cc = await this.costCenters.getById(input.costCenterId);
    if (!cc?.isActive) throw new Error("Cost center not found or inactive");

    const existingLineage = await this.lineages.getByKey(
      input.costCenterId,
      input.fiscalYearId,
      budgetType
    );
    if (existingLineage) {
      await this.assertNoActiveInLineage(existingLineage.id);
      throw new ActiveBudgetConflictError(
        "A budget lineage already exists for this cost center, year, and type.",
        existingActiveBudgetFromPlan(
          (await this.budgets.getById(existingLineage.currentVersionId!))!,
          { costCenterCode: cc.code, costCenterName: cc.name, fiscalYearLabel: 0, ownerName: actor.name }
        )
      );
    }

    const now = new Date().toISOString();
    const lines: BudgetLineItem[] = input.lines.map((line, index) => ({
      id: newId("line"),
      glAccountId: line.glAccountId,
      amount: line.amount,
      lineNumber: index + 1,
    }));

    const [fy, dept] = await Promise.all([
      this.fiscalYears.getById(input.fiscalYearId),
      this.departments.getById(cc.departmentId),
    ]);
    const seq = nextSequenceForDepartment(
      await this.lineages.listBudgetNumbers(),
      fy?.yearLabel ?? 0,
      departmentCodeForBudget(dept)
    );
    const budgetNumber = formatBudgetNumber(
      fy?.yearLabel ?? 0,
      departmentCodeForBudget(dept),
      seq
    );

    const lineageId = newId("lineage");
    const planId = newId("budget");
    const versionLabel = formatVersionLabel(budgetNumber, 1);

    const lineage: BudgetLineage = {
      id: lineageId,
      costCenterId: input.costCenterId,
      fiscalYearId: input.fiscalYearId,
      originalBudgetType: budgetType,
      budgetNumber,
      currentVersionId: planId,
      latestFinalizedVersionId: null,
      isArchived: false,
      createdAt: now,
    };

    const plan: BudgetPlan = {
      id: planId,
      ownerId: actor.id,
      costCenterId: input.costCenterId,
      fiscalYearId: input.fiscalYearId,
      budgetType,
      fromPeriod: input.fromPeriod,
      toPeriod: input.toPeriod,
      description: input.description?.trim() || null,
      status: "Draft",
      currentApproverId: null,
      submittedAt: null,
      sapVersion: null,
      lines,
      version: 1,
      createdAt: now,
      updatedAt: now,
      ...this.emptyPlanFields(),
      lineageId,
      lineageRevision: 1,
      versionLabel,
    };

    return this.uow.runInTransaction(async () => {
      // SQL circular FKs: insert lineage with null CurrentVersionId, then plan, then pointer.
      await this.lineages.save({
        ...lineage,
        currentVersionId: null,
      });
      try {
        await this.budgets.save(plan);
      } catch (error) {
        if (isActiveBudgetUniqueViolation(error)) {
          throw new ActiveBudgetConflictError(
            "An active version already exists for this lineage.",
            existingActiveBudgetFromPlan(plan, {
              costCenterCode: cc.code,
              costCenterName: cc.name,
              fiscalYearLabel: fy?.yearLabel ?? 0,
              ownerName: actor.name,
            })
          );
        }
        throw error;
      }
      await this.lineages.updatePointers(lineageId, {
        currentVersionId: planId,
      });
      await this.workflow.append({
        id: newId("wf"),
        budgetVersionId: plan.id,
        stage: "Draft",
        actorId: actor.id,
        action: "Created",
        comment: null,
        timestamp: now,
      });
      await this.recordSubmission(plan);
      await this.audits.append({
        id: newId("audit"),
        entity: "BudgetPlan",
        entityId: plan.id,
        action: "CreatedDraft",
        performedBy: actor.id,
        ipAddress: null,
        correlationId: newId("corr"),
        beforeJson: null,
        afterJson: JSON.stringify({ status: "Draft", budgetNumber }),
        timestamp: now,
      });
      return plan;
    });
  }

  async createAmendment(
    actor: User,
    parentPlanId: string,
    reason: string
  ): Promise<BudgetPlan> {
    if (!reason?.trim()) throw new Error("Amendment reason is required");
    this.authz.assertPermission(actor, "budget.create");

    const parent = await this.budgets.getById(parentPlanId);
    if (!parent?.lineageId) throw new Error("Parent budget not found");
    if (parent.id !== (await this.lineages.getById(parent.lineageId))?.latestFinalizedVersionId) {
      throw new Error("Amendments may only be created from the latest finalized version");
    }

    const lineage = await this.lineages.getById(parent.lineageId);
    if (!lineage) throw new Error("Lineage not found");

    const claimed = (await this.budgets.listClaimed()).some(
      (p) => p.lineageId === lineage.id
    );
    if (claimed) {
      throw new BudgetLockedApiError(
        "Cannot create an amendment while Finance is reviewing a claimed version"
      );
    }

    await this.assertNoActiveInLineage(lineage.id);
    await this.assertFyOpen(parent.fiscalYearId);

    if (parent.ownerId !== actor.id) {
      throw new AuthorizationError(
        "Only the budget owner may create an amendment"
      );
    }
    if (actor.primaryCostCenterId !== parent.costCenterId) {
      throw new AuthorizationError(
        "You can only amend budgets for your own cost center"
      );
    }

    const now = new Date().toISOString();
    const revision = parent.lineageRevision + 1;
    const planId = newId("budget");
    const versionLabel = formatVersionLabel(lineage.budgetNumber, revision);

    const plan: BudgetPlan = {
      ...structuredClone(parent),
      id: planId,
      status: "Draft",
      currentApproverId: null,
      submittedAt: null,
      sapVersion: null,
      parentBudgetPlanId: parent.id,
      lineageRevision: revision,
      versionLabel,
      amendmentReason: reason.trim(),
      version: 1,
      createdAt: now,
      updatedAt: now,
      claimDueAt: null,
      reviewDueAt: null,
      escalationStatus: "None",
      financeClaimedAt: null,
      financeClaimedBy: null,
      lines: parent.lines.map((l, i) => ({
        ...l,
        id: newId("line"),
        lineNumber: i + 1,
      })),
    };

    return this.uow.runInTransaction(async () => {
      await this.budgets.save(plan);
      await this.lineages.updatePointers(lineage.id, {
        currentVersionId: plan.id,
      });
      await this.inheritAttachments(parent.id, plan.id, actor.id);
      await this.workflow.append({
        id: newId("wf"),
        budgetVersionId: plan.id,
        stage: "Draft",
        actorId: actor.id,
        action: "AmendmentCreated",
        comment: reason.trim(),
        timestamp: now,
      });
      const recipientIds = new Set<string>();
      if (actor.managerId) recipientIds.add(actor.managerId);
      for (const fin of listFinanceAdministrators(await this.users.getAll())) {
        if (fin.id !== actor.id) recipientIds.add(fin.id);
      }
      for (const userId of Array.from(recipientIds)) {
        await this.notifications.create({
          id: newId("notif"),
          userId,
          type: "Amendment",
          title: "Budget amendment drafted",
          body: `${actor.name} created amendment ${versionLabel}: ${reason.trim()}`,
          relatedPlanId: plan.id,
          isRead: false,
          createdAt: now,
        });
      }
      await this.recordSubmission(plan);
      return plan;
    });
  }

  private async inheritAttachments(
    fromPlanId: string,
    toPlanId: string,
    actorId: string
  ): Promise<void> {
    const source = await this.attachments.listByBudgetId(fromPlanId);
    for (const att of source.filter((a) => !a.isArchived)) {
      const full = await this.attachments.getById(att.id);
      if (!full) continue;
      await this.attachments.save(
        {
          ...att,
          id: newId("att"),
          budgetPlanId: toPlanId,
          source: "Inherited",
          inheritedFromAttachmentId: att.id,
          uploadedBy: actorId,
          uploadedAt: new Date().toISOString(),
          isArchived: false,
        },
        full.content
      );
    }
  }

  async updateDraft(
    planId: string,
    actor: User,
    input: CreateDraftInput
  ): Promise<BudgetPlan> {
    const plan = await this.budgets.getById(planId);
    if (!plan) throw new Error("Budget not found");
    if (plan.ownerId !== actor.id) {
      await this.recordDeniedAttempt(
        actor,
        plan.id,
        "DraftEditDenied",
        "Only the owner can edit this budget"
      );
      throw new AuthorizationError("Only the owner can edit this budget");
    }
    assertCanEditDraft(plan);
    try {
      assertNotLocked(plan);
    } catch {
      throw new BudgetLockedApiError();
    }
    this.authz.assertPermission(actor, "budget.create");

    const headerIssues = validateBudgetHeader(input);
    const lineIssues = validateBudgetLines(input.lines);
    const issues = [...headerIssues, ...lineIssues];
    if (issues.length) {
      throw new Error(issues.map((i) => i.message).join("; "));
    }
    await this.assertFyOpen(input.fiscalYearId);
    if (input.costCenterId !== actor.primaryCostCenterId) {
      await this.recordDeniedAttempt(
        actor,
        plan.id,
        "DraftEditDenied",
        "You can only assign your own cost center"
      );
      throw new AuthorizationError(
        "You can only assign your own cost center"
      );
    }

    if (plan.lineageId) {
      await this.assertNoActiveInLineage(plan.lineageId, plan.id);
    }

    plan.budgetType = input.budgetType.trim();
    plan.fiscalYearId = input.fiscalYearId;
    plan.fromPeriod = input.fromPeriod;
    plan.toPeriod = input.toPeriod;
    plan.costCenterId = input.costCenterId;
    plan.description = input.description?.trim() || null;
    plan.lines = input.lines.map((line, index) => ({
      id: newId("line"),
      glAccountId: line.glAccountId,
      amount: line.amount,
      lineNumber: index + 1,
    }));
    plan.updatedAt = new Date().toISOString();
    return this.uow.runInTransaction(async () => {
      const saved = await this.budgets.save(plan);
      await this.recordSubmission(saved);
      return saved;
    });
  }

  async submit(planId: string, actor: User): Promise<BudgetPlan> {
    return this.approvalService.submit(planId, actor);
  }

  async listMine(actor: User): Promise<BudgetPlan[]> {
    const plans = await this.budgets.listByOwner(actor.id);
    return this.filterByVisibleFiscalYears(actor, plans);
  }

  async listVisible(actor: User): Promise<BudgetPlan[]> {
    const all = await this.budgets.list();
    const scope = await this.authz.filterVisiblePlans(actor, all);
    return this.filterByVisibleFiscalYears(actor, scope);
  }

  async listLineageVersions(
    planId: string,
    actor: User
  ): Promise<{ lineage: BudgetLineage; versions: BudgetPlan[] }> {
    const plan = await this.getById(planId, actor);
    if (!plan.lineageId) throw new Error("Budget has no lineage");
    const lineage = await this.lineages.getById(plan.lineageId);
    if (!lineage) throw new Error("Lineage not found");
    const versions = await this.budgets.listByLineage(plan.lineageId);
    return { lineage, versions };
  }

  async compareDefault(
    planId: string,
    actor: User
  ): Promise<ReturnType<typeof compareVersions>> {
    const plan = await this.getById(planId, actor);
    if (!plan.lineageId) throw new Error("No lineage");
    const lineage = await this.lineages.getById(plan.lineageId);
    const versions = await this.budgets.listByLineage(plan.lineageId);
    const sorted = [...versions].sort(
      (a, b) => a.lineageRevision - b.lineageRevision
    );
    const prev =
      sorted.find((v) => v.lineageRevision === plan.lineageRevision - 1) ??
      (lineage?.latestFinalizedVersionId
        ? await this.budgets.getById(lineage.latestFinalizedVersionId)
        : null);
    if (!prev) throw new Error("No prior version to compare");
    const [attFrom, attTo] = await Promise.all([
      this.attachments.listByBudgetId(prev.id),
      this.attachments.listByBudgetId(plan.id),
    ]);
    return compareVersions(prev, plan, attFrom, attTo);
  }

  async getWorkflowHistory(
    planId: string,
    actor: User
  ): Promise<WorkflowHistoryEntry[]> {
    await this.getById(planId, actor);
    return this.workflow.listByBudgetId(planId);
  }

  async search(actor: User, query: string): Promise<BudgetPlan[]> {
    const results = await this.budgets.search(query);
    return this.authz.filterVisiblePlans(actor, results);
  }

  private async filterByVisibleFiscalYears(
    actor: User,
    plans: BudgetPlan[]
  ): Promise<BudgetPlan[]> {
    if (this.authz.hasPermission(actor, "finance.view")) {
      return plans;
    }
    const openIds = new Set(
      (await this.fiscalYears.getAll())
        .filter((fy) => fy.status === "Open")
        .map((fy) => fy.id)
    );
    return plans.filter((p) => openIds.has(p.fiscalYearId));
  }

  async getById(planId: string, actor: User): Promise<BudgetPlan> {
    const plan = await this.budgets.getById(planId);
    if (!plan) throw new Error("Budget not found");
    await this.authz.assertCanView(actor, plan);
    if (!this.authz.hasPermission(actor, "finance.view")) {
      const fy = await this.fiscalYears.getById(plan.fiscalYearId);
      if (fy && fy.status !== "Open") {
        throw new AuthorizationError(
          "This budget belongs to a closed financial year"
        );
      }
    }
    return plan;
  }

  async getWithHistory(
    planId: string,
    actor: User
  ): Promise<{ plan: BudgetPlan; history: ApprovalHistoryEntry[] }> {
    const plan = await this.getById(planId, actor);
    const history = await this.history.listByBudgetId(planId);
    return { plan, history };
  }

  async listPendingApprovals(actor: User): Promise<BudgetPlan[]> {
    this.authz.assertPermission(actor, "budget.approve");
    const pending = await this.budgets.listPendingForApprover(actor.id);
    return this.filterByVisibleFiscalYears(actor, pending);
  }
}

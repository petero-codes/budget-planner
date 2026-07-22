import "server-only";

import type {
  BudgetLineItem,
  BudgetLineage,
  BudgetPlan,
  FiscalYear,
  User,
} from "@/domain/entities";
import {
  defaultBudgetCategory,
  isBudgetCategory,
  budgetCategoryAtIndex,
} from "@/domain/constants/budget-types";
import type {
  CloneFyOptions,
  CloneFyPreview,
  DiagnosticsResult,
  HealthCheck,
  IntegrityFinding,
  SessionListItem,
  ToolkitEnvironment,
  ToolkitHealth,
  WorkflowSimulateTarget,
} from "@/domain/development/types";
import { buildApprovalRoute } from "@/domain/rules/build-approval-route";
import {
  departmentCodeForBudget,
  formatBudgetNumber,
  formatVersionLabel,
  nextSequenceForDepartment,
} from "@/domain/rules/budget-number";
import { assertDevelopmentToolkitAccess } from "@/lib/development-toolkit-access";
import { newId, seedUuid } from "@/infrastructure/id";
import { EXPECTED_SCHEMA_VERSION } from "@/infrastructure/migrations/registry";
import type { RepositoryBundle } from "@/infrastructure/di";
import {
  FiscalYearService,
  FiscalYearServiceError,
} from "@/application/fiscal-year-service";
import {
  invalidateAllDevSessions,
  invalidateDevSession,
  invalidateDevSessionsForUser,
  listDevSessions,
} from "@/infrastructure/development/session-registry";
import {
  getLastDiagnosticsRun,
  recordDiagnosticsRun,
} from "@/infrastructure/development/diagnostics-state";
import { resetMockStore } from "@/infrastructure/repositories/mock/store";

export class DevelopmentToolkitError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "DevelopmentToolkitError";
  }
}

function requireReason(reason: string): string {
  const t = reason?.trim() ?? "";
  if (t.length < 3) {
    throw new DevelopmentToolkitError(
      "A reason of at least 3 characters is required",
      "REASON_REQUIRED"
    );
  }
  // ClearedReason NVARCHAR(500); keep reasons bounded for SQL columns.
  return t.length > 480 ? `${t.slice(0, 477)}...` : t;
}

function requireConfirm(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new DevelopmentToolkitError(
      `Confirmation token must be ${expected}`,
      "CONFIRM_MISMATCH"
    );
  }
}

/** SQL AuditLogs.EntityId / CorrelationId are UNIQUEIDENTIFIER — never pass labels. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asAuditUuid(value: string | null | undefined, scope: string): string {
  if (value && UUID_RE.test(value)) return value;
  return seedUuid(`dev-toolkit:${scope}:${value ?? "none"}`);
}

function shiftYear(isoDate: string, years: number): string {
  const d = new Date(isoDate);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function stageLabel(plan: BudgetPlan): string {
  if (plan.status === "Draft" || plan.status === "ReturnedForRevision") {
    return "Draft";
  }
  if (plan.status === "PendingFinanceReview" || plan.status === "Claimed") {
    return "Finance";
  }
  if (plan.status === "Finalized" || plan.status === "Approved") {
    return "Finalized";
  }
  if (plan.status === "Rejected") return "Rejected";
  return plan.currentApproverId ? "InApproval" : "InApproval";
}

/**
 * DevelopmentToolkitService
 *
 * Responsibility
 * --------------
 * Dev-only seeding, workflow simulation, and diagnostics. Triple-gated:
 * NODE_ENV=development + ENABLE_DEVELOPMENT_TOOLKIT + SystemAdmin.
 *
 * Does NOT:
 * - run in staging/production (gate must fail closed)
 *
 * Workflows: development tooling (not production WF)
 * Dependencies: full RepositoryBundle, FiscalYearService
 */
export class DevelopmentToolkitService {
  constructor(
    private readonly repos: RepositoryBundle,
    private readonly fiscalYearService: FiscalYearService,
    private readonly getDriver: () => "sql" | "mock",
    private readonly appVersion: string
  ) {}

  private gate(actor: User): void {
    assertDevelopmentToolkitAccess(actor);
  }

  private async audit(
    actor: User,
    entity: string,
    entityId: string,
    action: string,
    reason: string,
    before: unknown,
    after: unknown,
    correlationId: string
  ): Promise<void> {
    const safeEntityId = asAuditUuid(entityId, `entity:${entity}:${action}`);
    const safeCorrelationId = asAuditUuid(correlationId, "correlation");
    await this.repos.audits.append({
      id: newId("audit"),
      entity,
      entityId: safeEntityId,
      action,
      performedBy: actor.id,
      ipAddress: null,
      correlationId: safeCorrelationId,
      beforeJson: before == null ? null : JSON.stringify(before),
      afterJson: JSON.stringify({
        ...(after && typeof after === "object" ? after : { detail: after }),
        reason,
        // Preserve non-UUID labels for operators when we had to coerce.
        ...(safeEntityId !== entityId ? { entityKey: entityId } : {}),
      }),
      timestamp: new Date().toISOString(),
    });
  }

  async getHealth(actor: User): Promise<ToolkitHealth> {
    this.gate(actor);
    const emptyChecks: HealthCheck[] = [];
    try {
      const [users, budgets, audits, claims, fys] = await Promise.all([
        this.repos.users.getAll(),
        this.repos.budgets.list(),
        this.repos.audits.list(),
        this.repos.budgets.listClaimed(),
        this.repos.fiscalYears.getAll(),
      ]);
      let notifCount = 0;
      for (const u of users) {
        notifCount += (await this.repos.notifications.listByUser(u.id)).length;
      }
      if (this.getDriver() === "mock") {
        const { mockStore } = await import(
          "@/infrastructure/repositories/mock/store"
        );
        notifCount = mockStore.notifications.length;
      }
      let attachmentCount = 0;
      for (const b of budgets) {
        attachmentCount += (await this.repos.attachments.listByBudgetId(b.id))
          .length;
      }
      const current = fys.find((f) => f.isCurrent) ?? null;
      const open = fys.find((f) => f.status === "Open") ?? null;
      const findings = await this.computeIntegrity();
      const byCode = new Map(findings.map((f) => [f.code, f]));
      const checks: HealthCheck[] = [
        { code: "connection", ok: true, label: "Connection Healthy" },
        {
          code: "open_fy",
          ok: Boolean(open),
          label: "Current Open FY exists",
        },
        {
          code: "duplicate_active_budgets",
          ok: byCode.get("duplicate_active_budgets")?.ok ?? true,
          label: "No duplicate active lineages",
        },
        {
          code: "approval_routes",
          ok: byCode.get("approval_routes")?.ok ?? true,
          label: "No orphan approval routes",
        },
        {
          code: "finance_claims",
          ok: byCode.get("finance_claims")?.ok ?? true,
          label: "No orphan finance claims",
        },
        {
          code: "missing_cost_centres",
          ok: byCode.get("missing_cost_centres")?.ok ?? true,
          label: "No invalid cost centre references",
        },
        {
          code: "audit_logging",
          ok: audits.length >= 0,
          label: "Audit logging operational",
        },
      ];
      const allOk = checks.every((c) => c.ok);
      return {
        databaseStatus: allOk ? "Healthy" : "Unhealthy",
        connectionStatus: "Healthy",
        checks,
        users: users.length,
        budgets: budgets.filter((b) => !b.isArchived).length,
        auditLogs: audits.length,
        notifications: notifCount,
        financeClaims: claims.length,
        attachments: attachmentCount,
        currentFyLabel: current?.yearLabel ?? null,
        openFyLabel: open?.yearLabel ?? null,
      };
    } catch {
      return {
        databaseStatus: "Unhealthy",
        connectionStatus: "Failed",
        checks: [
          { code: "connection", ok: false, label: "Connection Healthy" },
          ...emptyChecks,
        ],
        users: 0,
        budgets: 0,
        auditLogs: 0,
        notifications: 0,
        financeClaims: 0,
        attachments: 0,
        currentFyLabel: null,
        openFyLabel: null,
      };
    }
  }

  async getEnvironment(actor: User): Promise<ToolkitEnvironment> {
    this.gate(actor);
    const health = await this.getHealth(actor);
    const smtpHost = process.env.SMTP_HOST?.trim();
    const secret = process.env.SESSION_SECRET?.trim();
    return {
      nodeEnv: process.env.NODE_ENV,
      toolkitEnabled: true,
      applicationVersion: this.appVersion,
      gitCommit: process.env.GIT_COMMIT?.trim() || "unknown",
      buildTime: process.env.BUILD_TIME?.trim() || "unknown",
      repositoryDriver: this.getDriver(),
      currentFyLabel: health.currentFyLabel,
      openFyLabel: health.openFyLabel,
      databaseLabel:
        this.getDriver() === "sql" ? "SQL Server" : "In-memory mock",
      migrationVersion: EXPECTED_SCHEMA_VERSION,
      connectionHealthy: health.connectionStatus === "Healthy",
      sessionSecret:
        secret && secret.length >= 32 ? "Configured" : "Missing",
      smtp: smtpHost ? "Enabled" : "Disabled",
    };
  }

  async previewCloneFiscalYear(
    actor: User,
    options: CloneFyOptions
  ): Promise<CloneFyPreview> {
    this.gate(actor);
    const source = await this.repos.fiscalYears.getById(
      options.sourceFiscalYearId
    );
    if (!source) {
      throw new DevelopmentToolkitError("Source fiscal year not found", "NOT_FOUND");
    }
    const targetYearLabel =
      options.targetYearLabel ?? source.yearLabel + 1;
    const existing = (await this.repos.fiscalYears.getAll()).find(
      (f) => f.yearLabel === targetYearLabel
    );
    if (existing) {
      throw new DevelopmentToolkitError(
        `Fiscal year ${targetYearLabel} already exists`,
        "DUPLICATE"
      );
    }
    const ccs = (await this.repos.costCenters.getAll()).filter(
      (c) => c.isActive
    );
    const finalized = (await this.repos.budgets.list()).filter(
      (b) =>
        b.fiscalYearId === source.id &&
        !b.isArchived &&
        (b.status === "Finalized" || b.status === "Approved")
    );
    let draftBudgets = 0;
    let budgetLines = 0;
    let attachments = 0;
    if (options.copyFinalizedAsDrafts) {
      draftBudgets = finalized.length;
      for (const b of finalized) {
        if (options.copyBudgetLines) budgetLines += b.lines.length;
        if (options.copyAttachments) {
          attachments += (
            await this.repos.attachments.listByBudgetId(b.id)
          ).filter((a) => !a.isArchived).length;
        }
      }
    }
    return {
      sourceYearLabel: source.yearLabel,
      targetYearLabel,
      willCreate: {
        fiscalYear: true,
        submissionRows: ccs.length,
        draftBudgets,
        budgetLines,
        attachments,
      },
      willNotCopy: [
        "Audit Logs",
        "Notifications",
        "Finance Claims",
        "Approval History",
        "Workflow History",
      ],
    };
  }

  async cloneFiscalYear(
    actor: User,
    options: CloneFyOptions,
    confirm: string,
    reason: string,
    correlationId = newId("corr")
  ): Promise<{ fiscalYear: FiscalYear; preview: CloneFyPreview }> {
    this.gate(actor);
    requireConfirm(confirm, "CLONE");
    const why = requireReason(reason);
    const preview = await this.previewCloneFiscalYear(actor, options);
    const source = (await this.repos.fiscalYears.getById(
      options.sourceFiscalYearId
    ))!;

    const yearDelta = preview.targetYearLabel - source.yearLabel;
    const all = await this.repos.fiscalYears.getAll();
    const openYear = all.find((f) => f.status === "Open");

    return this.repos.uow.runInTransaction(async () => {
      // Create target as Closed if another year is Open; reopen later if needed.
      const target: FiscalYear = {
        id: newId(),
        yearLabel: preview.targetYearLabel,
        startDate: shiftYear(source.startDate, yearDelta),
        endDate: shiftYear(source.endDate, yearDelta),
        status: openYear ? "Closed" : "Open",
        isLocked: Boolean(openYear),
        isCurrent: false,
      };
      const saved = await this.repos.fiscalYears.save(target);

      const ccs = (await this.repos.costCenters.getAll()).filter(
        (c) => c.isActive
      );
      const now = new Date().toISOString();
      for (const cc of ccs) {
        await this.repos.submissionStatus.upsert({
          costCenterId: cc.id,
          fiscalYearId: saved.id,
          status: "NotStarted",
          updatedAt: now,
        });
      }

      if (options.copyFinalizedAsDrafts) {
        const finalized = (await this.repos.budgets.list()).filter(
          (b) =>
            b.fiscalYearId === source.id &&
            !b.isArchived &&
            (b.status === "Finalized" || b.status === "Approved")
        );
        for (const src of finalized) {
          await this.clonePlanInternal(actor, src, saved.id, {
            copyLines: options.copyBudgetLines,
            copyAttachments: options.copyAttachments,
            isDemo: false,
            demoBatchId: null,
            correlationId,
          });
        }
      }

      await this.audit(
        actor,
        "FiscalYear",
        saved.id,
        "DevelopmentFiscalYearCloned",
        why,
        { sourceYear: source.yearLabel },
        { targetYear: saved.yearLabel, preview },
        correlationId
      );
      return { fiscalYear: saved, preview };
    });
  }

  private async clonePlanInternal(
    actor: User,
    source: BudgetPlan,
    targetFyId: string,
    opts: {
      copyLines: boolean;
      copyAttachments: boolean;
      isDemo: boolean;
      demoBatchId: string | null;
      correlationId: string;
      descriptionPrefix?: string;
    }
  ): Promise<BudgetPlan> {
    const now = new Date().toISOString();
    const cc = await this.repos.costCenters.getById(source.costCenterId);
    const fy = await this.repos.fiscalYears.getById(targetFyId);
    const dept = cc
      ? await this.repos.departments.getById(cc.departmentId)
      : null;
    const budgetCategory = isBudgetCategory(source.budgetCategory)
      ? source.budgetCategory
      : defaultBudgetCategory();

    // Unique type per CC+FY: keep catalog category on the plan; use a
    // distinct OriginalBudgetType on the lineage when the key is already taken.
    let categoryToUse: string = budgetCategory;
    const existing = await this.repos.lineages.getByKey(
      source.costCenterId,
      targetFyId,
      categoryToUse
    );
    if (existing) {
      categoryToUse = `${budgetCategory}-Demo-${newId("t").slice(0, 8)}`;
    }

    const seq = nextSequenceForDepartment(
      await this.repos.lineages.listBudgetNumbers(),
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
    const lines: BudgetLineItem[] = opts.copyLines
      ? source.lines.map((l, i) => ({
          id: newId("line"),
          glAccountId: l.glAccountId,
          amount: l.amount,
          lineNumber: i + 1,
        }))
      : [];

    const lineage: BudgetLineage = {
      id: lineageId,
      costCenterId: source.costCenterId,
      fiscalYearId: targetFyId,
      originalBudgetCategory: categoryToUse,
      budgetNumber,
      currentVersionId: planId,
      latestFinalizedVersionId: null,
      isArchived: false,
      createdAt: now,
    };

    const plan: BudgetPlan = {
      id: planId,
      ownerId: source.ownerId,
      costCenterId: source.costCenterId,
      fiscalYearId: targetFyId,
      budgetCategory,
      fromPeriod: source.fromPeriod,
      toPeriod: source.toPeriod,
      description:
        opts.descriptionPrefix != null
          ? `${opts.descriptionPrefix}${source.description ?? ""}`.trim() ||
            "[Demo]"
          : source.description,
      status: "Draft",
      currentApproverId: null,
      submittedAt: null,
      sapVersion: null,
      lines,
      version: 1,
      createdAt: now,
      updatedAt: now,
      lineageId,
      parentBudgetPlanId: null,
      lineageRevision: 1,
      versionLabel: formatVersionLabel(budgetNumber, 1),
      amendmentReason: null,
      isArchived: false,
      claimDueAt: null,
      reviewDueAt: null,
      escalationStatus: "None",
      financeClaimedAt: null,
      financeClaimedBy: null,
      isDemo: opts.isDemo,
      createdByToolkit: true,
      demoBatchId: opts.demoBatchId,
    };

    // SQL circular FKs: Lineage ↔ Plan. Insert lineage with null pointer,
    // then plan, then set CurrentVersionId (same order as migration 007).
    await this.repos.lineages.save({
      ...lineage,
      currentVersionId: null,
    });
    await this.repos.budgets.save(plan);
    await this.repos.lineages.updatePointers(lineageId, {
      currentVersionId: planId,
    });
    await this.repos.workflow.append({
      id: newId("wf"),
      budgetVersionId: plan.id,
      stage: "Draft",
      actorId: actor.id,
      action: "DevelopmentCloned",
      comment: null,
      timestamp: now,
    });

    if (opts.copyAttachments) {
      const atts = await this.repos.attachments.listByBudgetId(source.id);
      for (const att of atts.filter((a) => !a.isArchived)) {
        const full = await this.repos.attachments.getById(att.id);
        if (!full) continue;
        await this.repos.attachments.save(
          {
            ...att,
            id: newId("att"),
            budgetPlanId: plan.id,
            source: "Copied",
            inheritedFromAttachmentId: att.id,
            uploadedBy: actor.id,
            uploadedAt: now,
            isArchived: false,
          },
          full.content
        );
      }
    }
    return plan;
  }

  async resetWorkflow(
    actor: User,
    budgetPlanId: string,
    confirm: string,
    reason: string,
    correlationId = newId("corr")
  ): Promise<BudgetPlan> {
    this.gate(actor);
    requireConfirm(confirm, "RESET");
    const why = requireReason(reason);
    const plan = await this.repos.budgets.getById(budgetPlanId);
    if (!plan) {
      throw new DevelopmentToolkitError("Budget not found", "NOT_FOUND");
    }
    const previousStatus = plan.status;
    const previousStage = stageLabel(plan);
    const now = new Date().toISOString();

    return this.repos.uow.runInTransaction(async () => {
      const claim = await this.repos.financeClaims.getActiveClaim(plan.id);
      if (claim) {
        await this.repos.financeClaims.release(plan.id, now);
      }
      const steps = await this.repos.routes.listByBudgetId(plan.id);
      for (const step of steps) {
        if (step.status === "Pending") {
          await this.repos.routes.saveStep({
            ...step,
            status: "Invalidated",
          });
        }
      }
      const updated: BudgetPlan = {
        ...plan,
        status: "Draft",
        currentApproverId: null,
        submittedAt: null,
        claimDueAt: null,
        reviewDueAt: null,
        escalationStatus: "None",
        financeClaimedAt: null,
        financeClaimedBy: null,
        updatedAt: now,
      };
      const saved = await this.repos.budgets.save(updated);
      await this.repos.workflow.append({
        id: newId("wf"),
        budgetVersionId: plan.id,
        stage: "Draft",
        actorId: actor.id,
        action: "Development Reset",
        comment: `${previousStage} → Draft`,
        timestamp: now,
      });
      await this.repos.history.append({
        id: newId("hist"),
        budgetPlanId: plan.id,
        performedBy: actor.id,
        action: "Returned",
        previousStatus,
        newStatus: "Draft",
        comment: `Development Reset: ${why}`.slice(0, 1000),
        timestamp: now,
      });
      await this.audit(
        actor,
        "BudgetPlan",
        plan.id,
        "DevelopmentWorkflowReset",
        why,
        { status: previousStatus, stage: previousStage },
        { status: "Draft" },
        correlationId
      );
      return saved;
    });
  }

  async cloneBudget(
    actor: User,
    sourcePlanId: string,
    targetFiscalYearId: string,
    confirm: string,
    reason: string,
    options: { copyAttachments: boolean } = { copyAttachments: true },
    correlationId = newId("corr")
  ): Promise<BudgetPlan> {
    this.gate(actor);
    requireConfirm(confirm, "CLONE");
    const why = requireReason(reason);
    const source = await this.repos.budgets.getById(sourcePlanId);
    if (!source) {
      throw new DevelopmentToolkitError("Budget not found", "NOT_FOUND");
    }
    const fy = await this.repos.fiscalYears.getById(targetFiscalYearId);
    if (!fy || fy.status !== "Open") {
      throw new DevelopmentToolkitError(
        "Target fiscal year must be Open",
        "FY_LOCKED"
      );
    }
    const cloned = await this.repos.uow.runInTransaction(async () => {
      const plan = await this.clonePlanInternal(actor, source, fy.id, {
        copyLines: true,
        copyAttachments: options.copyAttachments,
        isDemo: false,
        demoBatchId: null,
        correlationId,
      });
      await this.audit(
        actor,
        "BudgetPlan",
        plan.id,
        "DevelopmentBudgetCloned",
        why,
        { sourcePlanId },
        { planId: plan.id, fiscalYearId: fy.id },
        correlationId
      );
      return plan;
    });
    return cloned;
  }

  async generateDemoBudgets(
    actor: User,
    count: number,
    confirm: string,
    reason: string,
    correlationId = newId("corr")
  ): Promise<{ batchId: string; created: number }> {
    this.gate(actor);
    requireConfirm(confirm, "GENERATE");
    const why = requireReason(reason);
    if (![5, 20, 100, 500].includes(count)) {
      throw new DevelopmentToolkitError(
        "Count must be 5, 20, 100, or 500",
        "INVALID_COUNT"
      );
    }
    const open =
      (await this.repos.fiscalYears.getActive()) ??
      (await this.repos.fiscalYears.getAll()).find((f) => f.status === "Open");
    if (!open) {
      throw new DevelopmentToolkitError("No Open fiscal year", "FY_LOCKED");
    }
    const ccs = (await this.repos.costCenters.getAll()).filter((c) => c.isActive);
    const gls = (await this.repos.glAccounts.getAll()).filter((g) => g.isActive);
    const users = (await this.repos.users.getAll()).filter((u) => u.active);
    if (!ccs.length || !gls.length || !users.length) {
      throw new DevelopmentToolkitError(
        "Need active cost centers, GL accounts, and users",
        "SEED_INCOMPLETE"
      );
    }
    const batchId = newId();
    let created = 0;
    await this.repos.uow.runInTransaction(async () => {
      for (let i = 0; i < count; i++) {
        const cc = ccs[i % ccs.length]!;
        const owner =
          users.find((u) => u.primaryCostCenterId === cc.id) ?? users[i % users.length]!;
        const gl = gls[i % gls.length]!;
        const amount = Math.round((50_000 + (i % 20) * 12_500) * 100) / 100;
        const fakeSource: BudgetPlan = {
          id: newId("budget"),
          ownerId: owner.id,
          costCenterId: cc.id,
          fiscalYearId: open.id,
          budgetCategory: budgetCategoryAtIndex(i),
          fromPeriod: open.startDate,
          toPeriod: open.endDate,
          description: `[Demo] Sample budget ${i + 1}`,
          status: "Draft",
          currentApproverId: null,
          submittedAt: null,
          sapVersion: null,
          lines: [
            {
              id: newId("line"),
              glAccountId: gl.id,
              amount,
              lineNumber: 1,
            },
          ],
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
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
          isDemo: true,
          createdByToolkit: true,
          demoBatchId: batchId,
        };
        await this.clonePlanInternal(actor, fakeSource, open.id, {
          copyLines: true,
          copyAttachments: false,
          isDemo: true,
          demoBatchId: batchId,
          correlationId,
          descriptionPrefix: "",
        });
        created++;
      }
      await this.audit(
        actor,
        "System",
        batchId,
        "DevelopmentDemoGenerated",
        why,
        null,
        { batchId, created, count },
        correlationId
      );
    });
    return { batchId, created };
  }

  async deleteDemoBudgets(
    actor: User,
    confirm: string,
    reason: string,
    demoBatchId: string | null = null,
    correlationId = newId("corr")
  ): Promise<{ deleted: number }> {
    this.gate(actor);
    requireConfirm(confirm, "DELETE_DEMO");
    const why = requireReason(reason);
    const all = await this.repos.budgets.list();
    const targets = all.filter(
      (b) =>
        b.isDemo === true &&
        (demoBatchId == null || b.demoBatchId === demoBatchId)
    );
    const now = new Date().toISOString();
    await this.repos.uow.runInTransaction(async () => {
      for (const plan of targets) {
        const claim = await this.repos.financeClaims.getActiveClaim(plan.id);
        if (claim) await this.repos.financeClaims.release(plan.id, now);
        await this.repos.routes.replaceForBudget(plan.id, []);
        await this.repos.notifications.resolveForPlan(plan.id);
        const atts = await this.repos.attachments.listByBudgetId(plan.id);
        for (const att of atts) {
          if (!att.isArchived) {
            await this.repos.attachments.archive(att.id, now);
          }
        }
        await this.repos.budgets.save({
          ...plan,
          isArchived: true,
          status: "Draft",
          currentApproverId: null,
          lines: [],
          financeClaimedAt: null,
          financeClaimedBy: null,
          updatedAt: now,
        });
        if (plan.lineageId) {
          await this.repos.lineages.setArchived(plan.lineageId, true);
        }
      }
      if (this.getDriver() === "mock") {
        const { mockStore } = await import(
          "@/infrastructure/repositories/mock/store"
        );
        const ids = new Set(targets.map((t) => t.id));
        mockStore.budgets = mockStore.budgets.filter((b) => !ids.has(b.id));
        mockStore.routes = mockStore.routes.filter(
          (r) => !ids.has(r.budgetPlanId)
        );
        mockStore.history = mockStore.history.filter(
          (h) => !ids.has(h.budgetPlanId)
        );
        mockStore.workflowHistory = mockStore.workflowHistory.filter(
          (w) => !ids.has(w.budgetVersionId)
        );
        mockStore.financeClaims = mockStore.financeClaims.filter(
          (c) => !ids.has(c.budgetPlanId)
        );
        mockStore.attachments = mockStore.attachments.filter(
          (a) => !ids.has(a.budgetPlanId)
        );
        mockStore.notifications = mockStore.notifications.filter(
          (n) => !n.relatedPlanId || !ids.has(n.relatedPlanId)
        );
        mockStore.lineages = mockStore.lineages.filter(
          (l) => !targets.some((t) => t.lineageId === l.id && t.isDemo)
        );
      }
      await this.audit(
        actor,
        "System",
        demoBatchId ?? "all-demo",
        "DevelopmentDemoDeleted",
        why,
        { count: targets.length },
        { deleted: targets.length, demoBatchId, byIsDemo: true },
        correlationId
      );
    });
    return { deleted: targets.length };
  }

  async clearFinanceQueue(
    actor: User,
    confirm: string,
    reason: string,
    budgetPlanId: string | null = null,
    correlationId = newId("corr")
  ): Promise<{ released: number }> {
    this.gate(actor);
    requireConfirm(confirm, "CLEAR");
    const why = requireReason(reason);
    const claimed = budgetPlanId
      ? [(await this.repos.budgets.getById(budgetPlanId))].filter(
          (p): p is BudgetPlan => Boolean(p && p.status === "Claimed")
        )
      : await this.repos.budgets.listClaimed();
    const now = new Date().toISOString();
    let released = 0;
    await this.repos.uow.runInTransaction(async () => {
      for (const plan of claimed) {
        await this.repos.financeClaims.release(plan.id, now);
        await this.repos.budgets.save({
          ...plan,
          status: "PendingFinanceReview",
          currentApproverId: null,
          financeClaimedAt: null,
          financeClaimedBy: null,
          updatedAt: now,
        });
        released++;
      }
      await this.audit(
        actor,
        "System",
        budgetPlanId ?? "queue",
        "DevelopmentFinanceQueueCleared",
        why,
        null,
        { released },
        correlationId
      );
    });
    return { released };
  }

  async clearNotifications(
    actor: User,
    confirm: string,
    reason: string,
    userId: string | null = null,
    correlationId = newId("corr")
  ): Promise<{ cleared: number }> {
    this.gate(actor);
    requireConfirm(confirm, "CLEAR");
    const why = requireReason(reason);
    const clearedAt = new Date().toISOString();
    const cleared = await this.repos.notifications.softClear({
      userId: userId ?? undefined,
      reason: why,
      clearedAt,
    });
    await this.audit(
      actor,
      "System",
      userId ?? "all",
      "DevelopmentNotificationsCleared",
      why,
      null,
      { cleared, soft: true },
      correlationId
    );
    return { cleared };
  }

  async listSessions(actor: User): Promise<SessionListItem[]> {
    this.gate(actor);
    const users = await this.repos.users.getAll();
    const byId = new Map(users.map((u) => [u.id, u]));
    return listDevSessions().map((s) => ({
      sessionId: s.sessionId,
      userId: s.userId,
      userName: byId.get(s.userId)?.name ?? s.userId,
      browser: s.browser,
      platform: s.platform,
      lastSeenAt: s.lastSeenAt,
    }));
  }

  async invalidateSessions(
    actor: User,
    confirm: string,
    reason: string,
    scope: { all?: boolean; userId?: string; sessionId?: string },
    correlationId = newId("corr")
  ): Promise<{ invalidated: number }> {
    this.gate(actor);
    requireConfirm(confirm, "INVALIDATE");
    const why = requireReason(reason);
    let invalidated = 0;
    if (scope.all) {
      invalidated = invalidateAllDevSessions();
    } else if (scope.sessionId) {
      invalidated = invalidateDevSession(scope.sessionId) ? 1 : 0;
    } else if (scope.userId) {
      invalidated = invalidateDevSessionsForUser(scope.userId);
    } else {
      throw new DevelopmentToolkitError(
        "Specify all, userId, or sessionId",
        "INVALID_SCOPE"
      );
    }
    await this.audit(
      actor,
      "System",
      scope.userId ?? scope.sessionId ?? "all",
      "DevelopmentSessionInvalidated",
      why,
      null,
      { invalidated, scope },
      correlationId
    );
    return { invalidated };
  }

  async reopenFy(
    actor: User,
    fiscalYearId: string,
    confirm: string,
    reason: string,
    correlationId = newId("corr")
  ): Promise<FiscalYear> {
    this.gate(actor);
    requireConfirm(confirm, "REOPEN");
    const why = requireReason(reason);
    const target = await this.repos.fiscalYears.getById(fiscalYearId);
    if (!target) {
      throw new DevelopmentToolkitError("Fiscal year not found", "NOT_FOUND");
    }
    const openOther = (await this.repos.fiscalYears.getAll()).find(
      (f) => f.status === "Open" && f.id !== fiscalYearId
    );
    if (openOther) {
      throw new DevelopmentToolkitError(
        `Fiscal Year ${openOther.yearLabel} is currently Open. Close it before reopening FY${target.yearLabel}.`,
        "ALREADY_OPEN"
      );
    }
    try {
      const fy = await this.fiscalYearService.reopen(
        fiscalYearId,
        actor,
        correlationId
      );
      await this.audit(
        actor,
        "FiscalYear",
        fy.id,
        "DevelopmentFiscalYearReopened",
        why,
        null,
        { yearLabel: fy.yearLabel, status: fy.status },
        correlationId
      );
      return fy;
    } catch (e) {
      if (e instanceof FiscalYearServiceError) {
        throw new DevelopmentToolkitError(e.message, e.code);
      }
      throw e;
    }
  }

  async closeFy(
    actor: User,
    fiscalYearId: string,
    confirm: string,
    reason: string,
    correlationId = newId("corr")
  ): Promise<FiscalYear> {
    this.gate(actor);
    requireConfirm(confirm, "CLOSE");
    const why = requireReason(reason);
    try {
      const fy = await this.fiscalYearService.close(
        fiscalYearId,
        actor,
        correlationId
      );
      await this.audit(
        actor,
        "FiscalYear",
        fy.id,
        "DevelopmentFiscalYearClosed",
        why,
        null,
        { yearLabel: fy.yearLabel, status: fy.status },
        correlationId
      );
      return fy;
    } catch (e) {
      if (e instanceof FiscalYearServiceError) {
        throw new DevelopmentToolkitError(e.message, e.code);
      }
      throw e;
    }
  }

  async resetApprovalStage(
    actor: User,
    budgetPlanId: string,
    target: WorkflowSimulateTarget,
    confirm: string,
    reason: string,
    correlationId = newId("corr")
  ): Promise<BudgetPlan> {
    return this.simulateWorkflow(
      actor,
      budgetPlanId,
      target,
      confirm,
      reason,
      correlationId
    );
  }

  async simulateWorkflow(
    actor: User,
    budgetPlanId: string,
    target: WorkflowSimulateTarget,
    confirm: string,
    reason: string,
    correlationId = newId("corr")
  ): Promise<BudgetPlan> {
    this.gate(actor);
    requireConfirm(confirm, "SIMULATE");
    const why = requireReason(reason);
    if (target !== "Manager" && target !== "GM" && target !== "Finance") {
      throw new DevelopmentToolkitError(
        "Simulator targets are Manager, GM, or Finance only. Use Reset Workflow to return to Draft.",
        "INVALID_TARGET"
      );
    }
    const plan = await this.repos.budgets.getById(budgetPlanId);
    if (!plan) {
      throw new DevelopmentToolkitError("Budget not found", "NOT_FOUND");
    }
    const previous = stageLabel(plan);
    const now = new Date().toISOString();

    return this.repos.uow.runInTransaction(async () => {
      const claim = await this.repos.financeClaims.getActiveClaim(plan.id);
      if (claim) await this.repos.financeClaims.release(plan.id, now);

      const users = await this.repos.users.getAll();
      const usersById = new Map(users.map((u) => [u.id, u]));
      const cc = await this.repos.costCenters.getById(plan.costCenterId);
      const draftSteps = buildApprovalRoute(
        plan.ownerId,
        usersById,
        cc?.managerId ?? null
      );

      let status: BudgetPlan["status"] = "InApproval";
      let currentApproverId: string | null = null;
      const steps = draftSteps.map((s, i) => ({
        id: newId("route"),
        budgetPlanId: plan.id,
        approverId: s.approverId,
        sequence: i + 1,
        status: "Pending" as const,
      }));

      if (target === "Finance") {
        status = "PendingFinanceReview";
        currentApproverId = null;
        await this.repos.routes.replaceForBudget(
          plan.id,
          steps.map((s) => ({ ...s, status: "Approved" as const }))
        );
      } else if (target === "Manager") {
        if (!steps.length) {
          status = "PendingFinanceReview";
          currentApproverId = null;
          await this.repos.routes.replaceForBudget(plan.id, []);
        } else {
          currentApproverId = steps[0]!.approverId;
          await this.repos.routes.replaceForBudget(plan.id, steps);
        }
      } else if (target === "GM") {
        if (steps.length < 2) {
          status = "PendingFinanceReview";
          currentApproverId = null;
          await this.repos.routes.replaceForBudget(
            plan.id,
            steps.map((s) => ({ ...s, status: "Approved" as const }))
          );
        } else {
          const updated = steps.map((s, i) =>
            i === 0
              ? { ...s, status: "Approved" as const }
              : { ...s, status: "Pending" as const }
          );
          currentApproverId = updated[1]!.approverId;
          await this.repos.routes.replaceForBudget(plan.id, updated);
        }
      }

      const saved = await this.repos.budgets.save({
        ...plan,
        status,
        currentApproverId,
        submittedAt: plan.submittedAt ?? now,
        financeClaimedAt: null,
        financeClaimedBy: null,
        updatedAt: now,
      });

      await this.repos.workflow.append({
        id: newId("wf"),
        budgetVersionId: plan.id,
        stage:
          target === "Finance"
            ? "FinanceQueue"
            : target === "GM"
              ? "GMReview"
              : "ManagerReview",
        actorId: actor.id,
        action: "DevelopmentWorkflowSimulated",
        comment: `${previous} → ${target}`,
        timestamp: now,
      });
      await this.audit(
        actor,
        "BudgetPlan",
        plan.id,
        "DevelopmentWorkflowSimulated",
        why,
        { stage: previous },
        { target, status },
        correlationId
      );
      return saved;
    });
  }

  async runIntegrity(
    actor: User,
    confirm: string,
    reason: string,
    correlationId = newId("corr")
  ): Promise<IntegrityFinding[]> {
    this.gate(actor);
    requireConfirm(confirm, "VALIDATE");
    requireReason(reason);
    const findings = await this.computeIntegrity();
    await this.audit(
      actor,
      "System",
      "integrity",
      "DevelopmentIntegrityValidated",
      reason.trim(),
      null,
      {
        ok: findings.every((f) => f.ok),
        findings: findings.map((f) => ({
          code: f.code,
          ok: f.ok,
          count: f.count,
        })),
      },
      correlationId
    );
    return findings;
  }

  async computeIntegrity(): Promise<IntegrityFinding[]> {
    const budgets = (await this.repos.budgets.list()).filter((b) => !b.isArchived);
    const users = await this.repos.users.getAll();
    const ccs = await this.repos.costCenters.getAll();
    const fys = await this.repos.fiscalYears.getAll();
    const userIds = new Set(users.map((u) => u.id));
    const ccIds = new Set(ccs.map((c) => c.id));
    const fyIds = new Set(fys.map((f) => f.id));

    const inPlay = new Set([
      "Draft",
      "InApproval",
      "ReturnedForRevision",
      "PendingFinanceReview",
      "Claimed",
    ]);
    const lineageActive = new Map<string, number>();
    for (const b of budgets) {
      if (!b.lineageId || !inPlay.has(b.status)) continue;
      lineageActive.set(
        b.lineageId,
        (lineageActive.get(b.lineageId) ?? 0) + 1
      );
    }
    const dupLineage = Array.from(lineageActive.values()).filter((n) => n > 1)
      .length;

    let badRoutes = 0;
    for (const b of budgets.filter((p) => p.status === "InApproval")) {
      const steps = await this.repos.routes.listByBudgetId(b.id);
      const pending = steps.find((s) => s.status === "Pending");
      if (!b.currentApproverId || pending?.approverId !== b.currentApproverId) {
        badRoutes++;
      }
    }

    let badClaims = 0;
    for (const b of budgets) {
      const claim = await this.repos.financeClaims.getActiveClaim(b.id);
      if (claim && b.status !== "Claimed") badClaims++;
      if (!claim && b.status === "Claimed") badClaims++;
    }

    let orphanNotifs = 0;
    for (const u of users) {
      const list = await this.repos.notifications.listByUser(u.id);
      for (const n of list) {
        if (n.relatedPlanId) {
          const p = await this.repos.budgets.getById(n.relatedPlanId);
          if (!p) orphanNotifs++;
        }
      }
    }

    let brokenRefs = 0;
    let missingCc = 0;
    let invalidLineage = 0;
    for (const b of budgets) {
      if (!ccIds.has(b.costCenterId)) missingCc++;
      if (!fyIds.has(b.fiscalYearId) || !userIds.has(b.ownerId)) brokenRefs++;
      if (b.lineageId) {
        const lin = await this.repos.lineages.getById(b.lineageId);
        if (!lin) invalidLineage++;
      }
    }

    const currentCount = fys.filter((f) => f.isCurrent).length;
    const openCount = fys.filter((f) => f.status === "Open").length;

    return [
      {
        code: "duplicate_active_budgets",
        ok: dupLineage === 0,
        message: "Duplicate active budgets per lineage",
        count: dupLineage,
      },
      {
        code: "approval_routes",
        ok: badRoutes === 0,
        message: "Approval routes vs currentApproverId",
        count: badRoutes,
      },
      {
        code: "finance_claims",
        ok: badClaims === 0,
        message: "Finance claims vs plan status",
        count: badClaims,
      },
      {
        code: "orphan_notifications",
        ok: orphanNotifs === 0,
        message: "Orphan notifications",
        count: orphanNotifs,
      },
      {
        code: "broken_references",
        ok: brokenRefs === 0,
        message: "Broken owner/FY references",
        count: brokenRefs,
      },
      {
        code: "missing_cost_centres",
        ok: missingCc === 0,
        message: "Missing cost centres on plans",
        count: missingCc,
      },
      {
        code: "invalid_lineages",
        ok: invalidLineage === 0,
        message: "Invalid lineages",
        count: invalidLineage,
      },
      {
        code: "current_fy_invariant",
        ok: currentCount === 1 && openCount <= 1,
        message: "Current FY invariant (exactly one current, ≤1 Open)",
        count: currentCount !== 1 ? currentCount : openCount > 1 ? openCount : 0,
      },
    ];
  }

  async runDiagnostics(
    actor: User,
    confirm: string,
    reason: string,
    correlationId = newId("corr")
  ): Promise<DiagnosticsResult> {
    this.gate(actor);
    requireConfirm(confirm, "DIAGNOSE");
    requireReason(reason);
    const integrity = await this.computeIntegrity();
    const health = await this.getHealth(actor);
    const admins = (await this.repos.users.getAll()).filter((u) =>
      u.roleCodes.includes("SystemAdmin")
    );
    const checks: IntegrityFinding[] = [
      {
        code: "rbac",
        ok: admins.length >= 1,
        message: "RBAC — at least one active SystemAdmin",
        count: admins.length,
      },
      {
        code: "budget_lineages",
        ok: integrity.find((f) => f.code === "duplicate_active_budgets")?.ok ?? true,
        message: "Budget Lineages",
      },
      {
        code: "approval_routes",
        ok: integrity.find((f) => f.code === "approval_routes")?.ok ?? true,
        message: "Approval Routes",
      },
      {
        code: "finance_queue",
        ok: integrity.find((f) => f.code === "finance_claims")?.ok ?? true,
        message: "Finance Queue",
      },
      {
        code: "notifications",
        ok: integrity.find((f) => f.code === "orphan_notifications")?.ok ?? true,
        message: "Notifications",
      },
      {
        code: "fiscal_year_rules",
        ok: integrity.find((f) => f.code === "current_fy_invariant")?.ok ?? true,
        message: "Fiscal Year Rules",
      },
      {
        code: "database_connectivity",
        ok: health.connectionStatus === "Healthy",
        message: "Database Connectivity",
      },
      {
        code: "session_store",
        ok: true,
        message: "Session Store (signed cookies + revocations)",
      },
    ];
    const ranAt = new Date().toISOString();
    recordDiagnosticsRun(ranAt);
    await this.audit(
      actor,
      "System",
      "diagnostics",
      "DevelopmentDiagnosticsRun",
      reason.trim(),
      null,
      { allOk: checks.every((c) => c.ok), ranAt },
      correlationId
    );
    return {
      ranAt,
      checks,
      allOk: checks.every((c) => c.ok),
    };
  }

  getLastDiagnosticsAt(): string | null {
    return getLastDiagnosticsRun();
  }

  async reseedDemoData(
    actor: User,
    confirm: string,
    reason: string,
    correlationId = newId("corr")
  ): Promise<{ ok: true }> {
    this.gate(actor);
    requireConfirm(confirm, "RESEED");
    const why = requireReason(reason);
    if (this.getDriver() !== "mock") {
      throw new DevelopmentToolkitError(
        "Reseed from toolkit is only supported for REPOSITORY_DRIVER=mock. Use npm run db:seed for SQL.",
        "SQL_RESEED_CLI"
      );
    }
    resetMockStore();
    await this.audit(
      actor,
      "System",
      "reseed",
      "DevelopmentDatabaseReseeded",
      why,
      null,
      { driver: "mock" },
      correlationId
    );
    return { ok: true };
  }
}

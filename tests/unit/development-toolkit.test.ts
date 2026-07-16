import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  assertDevelopmentToolkitAccess,
  isDevelopmentToolkitEnabled,
  DevelopmentToolkitNotFoundError,
} from "@/lib/development-toolkit-access";
import type { User } from "@/domain/entities";
import { DevelopmentToolkitService } from "@/application/development/development-toolkit-service";
import { FiscalYearService } from "@/application/fiscal-year-service";
import { AuthorizationService } from "@/application/authorization-service";
import { resetMockStore, mockStore } from "@/infrastructure/repositories/mock/store";
import {
  MockApprovalHistoryRepository,
  MockApprovalRouteRepository,
  MockAuditLogRepository,
  MockBudgetAttachmentCategoryRepository,
  MockBudgetAttachmentRepository,
  MockBudgetLineageRepository,
  MockBudgetPlanRepository,
  MockCostCenterRepository,
  MockDepartmentRepository,
  MockFinanceClaimRepository,
  MockFiscalYearRepository,
  MockGlAccountRepository,
  MockNotificationRepository,
  MockSapPackageRepository,
  MockSubmissionStatusRepository,
  MockSupportIssueRepository,
  MockUnitOfWork,
  MockUserRepository,
  MockWorkflowHistoryRepository,
} from "@/infrastructure/repositories/mock";
import { withDefaultPlanFields } from "@/infrastructure/repositories/mock/lineage-repos";
import type { RepositoryBundle } from "@/infrastructure/di";
import { IDS } from "@/infrastructure/repositories/mock/seed";
import { newId } from "@/infrastructure/id";
import {
  __resetDevSessionRegistry,
  isSessionRevoked,
  invalidateDevSessionsForUser,
} from "@/infrastructure/development/session-registry";
import { createSessionToken, verifySessionClaims } from "@/lib/security/session-token";

function adminUser(): User {
  return {
    id: IDS.admin,
    name: "Admin",
    email: "ict.admin@kengen.co.ke",
    positionId: IDS.posAdmin,
    managerId: null,
    departmentId: IDS.deptIct,
    primaryCostCenterId: IDS.ccNet,
    active: true,
    roleCodes: ["SystemAdmin"],
    permissionCodes: ["admin.users", "admin.masterdata", "audit.view", "fy.manage"],
  };
}

function staffUser(): User {
  return {
    ...adminUser(),
    id: IDS.peter,
    roleCodes: ["BudgetSubmitter"],
    permissionCodes: ["budget.create", "budget.submit"],
  };
}

function buildBundle(): RepositoryBundle {
  return {
    users: new MockUserRepository(),
    departments: new MockDepartmentRepository(),
    costCenters: new MockCostCenterRepository(),
    glAccounts: new MockGlAccountRepository(),
    fiscalYears: new MockFiscalYearRepository(),
    budgets: new MockBudgetPlanRepository(),
    lineages: new MockBudgetLineageRepository(),
    routes: new MockApprovalRouteRepository(),
    history: new MockApprovalHistoryRepository(),
    workflow: new MockWorkflowHistoryRepository(),
    audits: new MockAuditLogRepository(),
    notifications: new MockNotificationRepository(),
    submissionStatus: new MockSubmissionStatusRepository(),
    financeClaims: new MockFinanceClaimRepository(),
    attachments: new MockBudgetAttachmentRepository(),
    attachmentCategories: new MockBudgetAttachmentCategoryRepository(),
    sapPackages: new MockSapPackageRepository(),
    supportIssues: new MockSupportIssueRepository(),
    uow: new MockUnitOfWork(),
  };
}

describe("Development Toolkit", () => {
  const prevEnv = process.env.NODE_ENV;
  const prevFlag = process.env.ENABLE_DEVELOPMENT_TOOLKIT;

  beforeEach(() => {
    resetMockStore();
    __resetDevSessionRegistry();
    (process.env as { NODE_ENV?: string }).NODE_ENV = "development";
    process.env.ENABLE_DEVELOPMENT_TOOLKIT = "true";
  });

  afterEach(() => {
    (process.env as { NODE_ENV?: string }).NODE_ENV = prevEnv;
    if (prevFlag === undefined) delete process.env.ENABLE_DEVELOPMENT_TOOLKIT;
    else process.env.ENABLE_DEVELOPMENT_TOOLKIT = prevFlag;
  });

  it("dual gate requires NODE_ENV=development and ENABLE_DEVELOPMENT_TOOLKIT=true", () => {
    process.env.ENABLE_DEVELOPMENT_TOOLKIT = "false";
    expect(isDevelopmentToolkitEnabled()).toBe(false);
    process.env.ENABLE_DEVELOPMENT_TOOLKIT = "true";
    (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
    expect(isDevelopmentToolkitEnabled()).toBe(false);
    (process.env as { NODE_ENV?: string }).NODE_ENV = "development";
    expect(isDevelopmentToolkitEnabled()).toBe(true);
  });

  it("rejects non-SystemAdmin with NotFound", () => {
    expect(() => assertDevelopmentToolkitAccess(staffUser())).toThrow(
      DevelopmentToolkitNotFoundError
    );
  });

  it("reset workflow appends history and moves to Draft", async () => {
    const bundle = buildBundle();
    const authz = new AuthorizationService(bundle.users, bundle.costCenters, bundle.audits);
    const fyService = new FiscalYearService(
      bundle.fiscalYears,
      bundle.audits,
      authz,
      bundle.uow
    );
    const toolkit = new DevelopmentToolkitService(
      bundle,
      fyService,
      () => "mock",
      "0.0.0-test"
    );
    const actor = adminUser();
    const planId = newId();
    const plan = withDefaultPlanFields({
      id: planId,
      ownerId: IDS.peter,
      costCenterId: IDS.ccNet,
      fiscalYearId: IDS.fy2027,
      budgetType: "Primary",
      fromPeriod: "2027-01-01",
      toPeriod: "2027-12-31",
      description: "Test",
      status: "InApproval" as const,
      currentApproverId: IDS.geofrey,
      submittedAt: new Date().toISOString(),
      sapVersion: null,
      lines: [],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockStore.budgets.push(plan as never);
    mockStore.workflowHistory.push({
      id: newId(),
      budgetVersionId: planId,
      stage: "ManagerReview",
      actorId: IDS.peter,
      action: "Submitted",
      comment: null,
      timestamp: new Date().toISOString(),
    });

    const saved = await toolkit.resetWorkflow(
      actor,
      planId,
      "RESET",
      "Testing reset",
      newId()
    );
    expect(saved.status).toBe("Draft");
    expect(saved.currentApproverId).toBeNull();
    const wf = mockStore.workflowHistory.filter((w) => w.budgetVersionId === planId);
    expect(wf.length).toBeGreaterThanOrEqual(2);
    expect(wf.some((w) => w.action === "Development Reset")).toBe(true);
    expect(wf.some((w) => w.action === "Submitted")).toBe(true);
  });

  it("generate demo sets IsDemo and delete removes by IsDemo", async () => {
    const bundle = buildBundle();
    const authz = new AuthorizationService(bundle.users, bundle.costCenters, bundle.audits);
    const fyService = new FiscalYearService(
      bundle.fiscalYears,
      bundle.audits,
      authz,
      bundle.uow
    );
    const toolkit = new DevelopmentToolkitService(
      bundle,
      fyService,
      () => "mock",
      "0.0.0-test"
    );
    const actor = adminUser();
    const { batchId, created } = await toolkit.generateDemoBudgets(
      actor,
      5,
      "GENERATE",
      "Load test data",
      newId()
    );
    expect(created).toBe(5);
    expect(mockStore.budgets.filter((b) => b.isDemo && b.demoBatchId === batchId).length).toBe(5);
    const { deleted } = await toolkit.deleteDemoBudgets(
      actor,
      "DELETE_DEMO",
      "Cleanup demos",
      batchId,
      newId()
    );
    expect(deleted).toBe(5);
    expect(mockStore.budgets.filter((b) => b.isDemo && !b.isArchived).length).toBe(0);
  });

  it("soft-clears notifications without deleting rows", async () => {
    const bundle = buildBundle();
    const authz = new AuthorizationService(bundle.users, bundle.costCenters, bundle.audits);
    const fyService = new FiscalYearService(
      bundle.fiscalYears,
      bundle.audits,
      authz,
      bundle.uow
    );
    const toolkit = new DevelopmentToolkitService(
      bundle,
      fyService,
      () => "mock",
      "0.0.0-test"
    );
    await bundle.notifications.create({
      id: newId(),
      userId: IDS.peter,
      type: "Test",
      title: "Hello",
      body: "World",
      relatedPlanId: null,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
    const { cleared } = await toolkit.clearNotifications(
      adminUser(),
      "CLEAR",
      "Soft clear test",
      null,
      newId()
    );
    expect(cleared).toBe(1);
    expect(mockStore.notifications.length).toBe(1);
    expect(mockStore.notifications[0]!.isCleared).toBe(true);
    expect((await bundle.notifications.listByUser(IDS.peter)).length).toBe(0);
  });

  it("session revoke rejects tokens with earlier iat", async () => {
    const token = await createSessionToken(IDS.peter, {
      roleCodes: ["BudgetSubmitter"],
      permissionCodes: [],
    });
    const claims = await verifySessionClaims(token);
    expect(claims).not.toBeNull();
    invalidateDevSessionsForUser(IDS.peter);
    expect(isSessionRevoked(IDS.peter, claims!.iat)).toBe(true);
  });

  it("clone FY preview has no side effects", async () => {
    const bundle = buildBundle();
    const authz = new AuthorizationService(bundle.users, bundle.costCenters, bundle.audits);
    const fyService = new FiscalYearService(
      bundle.fiscalYears,
      bundle.audits,
      authz,
      bundle.uow
    );
    const toolkit = new DevelopmentToolkitService(
      bundle,
      fyService,
      () => "mock",
      "0.0.0-test"
    );
    const before = mockStore.fiscalYears.length;
    const preview = await toolkit.previewCloneFiscalYear(adminUser(), {
      sourceFiscalYearId: IDS.fy2027,
      copyFinalizedAsDrafts: true,
      copyBudgetLines: true,
      copyAttachments: false,
    });
    expect(preview.targetYearLabel).toBe(2028);
    expect(mockStore.fiscalYears.length).toBe(before);
  });

  it("integrity returns findings list", async () => {
    const bundle = buildBundle();
    const authz = new AuthorizationService(bundle.users, bundle.costCenters, bundle.audits);
    const fyService = new FiscalYearService(
      bundle.fiscalYears,
      bundle.audits,
      authz,
      bundle.uow
    );
    const toolkit = new DevelopmentToolkitService(
      bundle,
      fyService,
      () => "mock",
      "0.0.0-test"
    );
    const findings = await toolkit.runIntegrity(
      adminUser(),
      "VALIDATE",
      "Smoke check",
      newId()
    );
    expect(findings.length).toBeGreaterThanOrEqual(8);
    expect(findings.every((f) => typeof f.ok === "boolean")).toBe(true);
  });

  it("reopen FY refuses when another year is already Open", async () => {
    const bundle = buildBundle();
    const authz = new AuthorizationService(bundle.users, bundle.costCenters, bundle.audits);
    const fyService = new FiscalYearService(
      bundle.fiscalYears,
      bundle.audits,
      authz,
      bundle.uow
    );
    const toolkit = new DevelopmentToolkitService(
      bundle,
      fyService,
      () => "mock",
      "0.0.0-test"
    );
    const open = mockStore.fiscalYears.find((f) => f.status === "Open");
    expect(open).toBeTruthy();
    const closed = mockStore.fiscalYears.find(
      (f) => f.id !== open!.id && f.status !== "Open"
    );
    expect(closed).toBeTruthy();
    await expect(
      toolkit.reopenFy(
        adminUser(),
        closed!.id,
        "REOPEN",
        "Try reopen while another is open",
        newId()
      )
    ).rejects.toMatchObject({
      code: "ALREADY_OPEN",
      message: expect.stringMatching(
        new RegExp(
          `Fiscal Year ${open!.yearLabel} is currently Open\\. Close it before reopening FY${closed!.yearLabel}\\.`
        )
      ),
    });
  });

  it("workflow simulator rejects Draft; only Manager|GM|Finance", async () => {
    const bundle = buildBundle();
    const authz = new AuthorizationService(bundle.users, bundle.costCenters, bundle.audits);
    const fyService = new FiscalYearService(
      bundle.fiscalYears,
      bundle.audits,
      authz,
      bundle.uow
    );
    const toolkit = new DevelopmentToolkitService(
      bundle,
      fyService,
      () => "mock",
      "0.0.0-test"
    );
    const planId = newId();
    mockStore.budgets.push(
      withDefaultPlanFields({
        id: planId,
        ownerId: IDS.peter,
        costCenterId: IDS.ccNet,
        fiscalYearId: IDS.fy2027,
        budgetType: "Primary",
        fromPeriod: "2027-01-01",
        toPeriod: "2027-12-31",
        description: "Sim target",
        status: "Draft",
        currentApproverId: null,
        submittedAt: null,
        sapVersion: null,
        lines: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }) as never
    );
    await expect(
      toolkit.simulateWorkflow(
        adminUser(),
        planId,
        "Draft" as never,
        "SIMULATE",
        "Invalid target",
        newId()
      )
    ).rejects.toMatchObject({ code: "INVALID_TARGET" });
  });

  it("health includes validation checks and diagnostics runs", async () => {
    const bundle = buildBundle();
    const authz = new AuthorizationService(bundle.users, bundle.costCenters, bundle.audits);
    const fyService = new FiscalYearService(
      bundle.fiscalYears,
      bundle.audits,
      authz,
      bundle.uow
    );
    const toolkit = new DevelopmentToolkitService(
      bundle,
      fyService,
      () => "mock",
      "0.0.0-test"
    );
    const health = await toolkit.getHealth(adminUser());
    expect(health.checks.length).toBeGreaterThanOrEqual(7);
    expect(health.checks.some((c) => c.code === "connection" && c.ok)).toBe(
      true
    );
    const diag = await toolkit.runDiagnostics(
      adminUser(),
      "DIAGNOSE",
      "Pre-UAT check",
      newId()
    );
    expect(diag.checks.map((c) => c.code)).toEqual(
      expect.arrayContaining([
        "rbac",
        "budget_lineages",
        "approval_routes",
        "finance_queue",
        "notifications",
        "fiscal_year_rules",
        "database_connectivity",
        "session_store",
      ])
    );
    expect(toolkit.getLastDiagnosticsAt()).toBe(diag.ranAt);
  });

  it("integrity and diagnostics audit with UUID entity ids", async () => {
    const bundle = buildBundle();
    const authz = new AuthorizationService(bundle.users, bundle.costCenters, bundle.audits);
    const fyService = new FiscalYearService(
      bundle.fiscalYears,
      bundle.audits,
      authz,
      bundle.uow
    );
    const toolkit = new DevelopmentToolkitService(
      bundle,
      fyService,
      () => "mock",
      "0.0.0-test"
    );
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    await toolkit.runIntegrity(adminUser(), "VALIDATE", "TEST", newId());
    await toolkit.runDiagnostics(adminUser(), "DIAGNOSE", "TEST", newId());

    const systemAudits = mockStore.audits.filter((a) => a.entity === "System");
    expect(systemAudits.length).toBeGreaterThanOrEqual(2);
    for (const a of systemAudits) {
      expect(a.entityId).toMatch(uuidRe);
      expect(a.correlationId).toMatch(uuidRe);
    }
  });

  it("clone FY creates lineage pointer after plan (SQL-safe order)", async () => {
    const bundle = buildBundle();
    const authz = new AuthorizationService(bundle.users, bundle.costCenters, bundle.audits);
    const fyService = new FiscalYearService(
      bundle.fiscalYears,
      bundle.audits,
      authz,
      bundle.uow
    );
    const toolkit = new DevelopmentToolkitService(
      bundle,
      fyService,
      () => "mock",
      "0.0.0-test"
    );
    const actor = adminUser();
    const sourcePlanId = newId();
    const lineageId = newId();
    mockStore.lineages.push({
      id: lineageId,
      costCenterId: IDS.ccNet,
      fiscalYearId: IDS.fy2027,
      originalBudgetType: "Primary",
      budgetNumber: "BUD-2027-ICT-0001",
      currentVersionId: sourcePlanId,
      latestFinalizedVersionId: sourcePlanId,
      isArchived: false,
      createdAt: new Date().toISOString(),
    });
    mockStore.budgets.push(
      withDefaultPlanFields({
        id: sourcePlanId,
        ownerId: IDS.peter,
        costCenterId: IDS.ccNet,
        fiscalYearId: IDS.fy2027,
        budgetType: "Primary",
        fromPeriod: "2026-07-01",
        toPeriod: "2027-06-30",
        description: "Finalized source",
        status: "Finalized",
        currentApproverId: null,
        submittedAt: new Date().toISOString(),
        sapVersion: "V1",
        lines: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lineageId,
        lineageRevision: 1,
        versionLabel: "BUD-2027-ICT-0001-v1",
      }) as never
    );

    const { fiscalYear } = await toolkit.cloneFiscalYear(
      actor,
      {
        sourceFiscalYearId: IDS.fy2027,
        copyFinalizedAsDrafts: true,
        copyBudgetLines: true,
        copyAttachments: false,
      },
      "CLONE",
      "Clone for UAT",
      newId()
    );
    expect(fiscalYear.yearLabel).toBe(2028);
    const cloned = mockStore.budgets.filter(
      (b) => b.fiscalYearId === fiscalYear.id && b.status === "Draft"
    );
    expect(cloned.length).toBeGreaterThanOrEqual(1);
    for (const plan of cloned) {
      expect(plan.lineageId).toBeTruthy();
      const lin = mockStore.lineages.find((l) => l.id === plan.lineageId);
      expect(lin?.currentVersionId).toBe(plan.id);
    }
  });
});

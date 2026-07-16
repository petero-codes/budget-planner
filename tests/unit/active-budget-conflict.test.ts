import { beforeEach, describe, expect, it } from "vitest";
import { BudgetPlanService } from "@/application/budget-plan-service";
import { ActiveBudgetConflictError } from "@/application/active-budget-conflict";
import { AuthorizationService } from "@/application/authorization-service";
import { ApprovalService } from "@/application/approval-service";
import {
  MockApprovalHistoryRepository,
  MockApprovalRouteRepository,
  MockAuditLogRepository,
  MockBudgetAttachmentRepository,
  MockBudgetLineageRepository,
  MockBudgetPlanRepository,
  MockCostCenterRepository,
  MockDepartmentRepository,
  MockFiscalYearRepository,
  MockNotificationRepository,
  MockSubmissionStatusRepository,
  MockUnitOfWork,
  MockUserRepository,
  MockWorkflowHistoryRepository,
} from "@/infrastructure/repositories/mock";
import { resetMockStore, mockStore } from "@/infrastructure/repositories/mock/store";
import { IDS } from "@/infrastructure/repositories/mock/seed";

describe("createDraft active duplicate guard", () => {
  let budgets: MockBudgetPlanRepository;
  let service: BudgetPlanService;

  beforeEach(() => {
    resetMockStore();
    budgets = new MockBudgetPlanRepository();
    const users = new MockUserRepository();
    const costCenters = new MockCostCenterRepository();
    const departments = new MockDepartmentRepository();
    const fiscalYears = new MockFiscalYearRepository();
    const lineages = new MockBudgetLineageRepository();
    const attachments = new MockBudgetAttachmentRepository();
    const audits = new MockAuditLogRepository();
    const history = new MockApprovalHistoryRepository();
    const workflow = new MockWorkflowHistoryRepository();
    const routes = new MockApprovalRouteRepository();
    const notifications = new MockNotificationRepository();
    const submissionStatus = new MockSubmissionStatusRepository();
    const uow = new MockUnitOfWork();
    const authz = new AuthorizationService(users, costCenters);
    const approval = new ApprovalService(
      users,
      budgets,
      costCenters,
      fiscalYears,
      routes,
      history,
      audits,
      notifications,
      authz,
      uow,
      submissionStatus,
      workflow
    );
    service = new BudgetPlanService(
      budgets,
      lineages,
      costCenters,
      departments,
      fiscalYears,
      attachments,
      audits,
      history,
      workflow,
      authz,
      approval,
      uow,
      submissionStatus,
      users,
      notifications
    );
  });

  it("rejects a second active Primary for the same cost center and year", async () => {
    const actor = mockStore.users.find((u) => u.id === IDS.patrick)!;
    const input = {
      budgetType: "Primary",
      fiscalYearId: IDS.fy2027,
      fromPeriod: "2026-07-01",
      toPeriod: "2027-06-30",
      costCenterId: IDS.ccRelMgmt,
      description: null,
      lines: [{ glAccountId: mockStore.glAccounts[0]!.id, amount: 1000 }],
    };

    const first = await service.createDraft(actor, input);
    expect(first.status).toBe("Draft");

    await expect(service.createDraft(actor, input)).rejects.toBeInstanceOf(
      ActiveBudgetConflictError
    );
  });

  it("rejects Amendment as a free-standing budget type", async () => {
    const actor = mockStore.users.find((u) => u.id === IDS.patrick)!;
    await expect(
      service.createDraft(actor, {
        budgetType: "Amendment",
        fiscalYearId: IDS.fy2027,
        fromPeriod: "2026-07-01",
        toPeriod: "2027-06-30",
        costCenterId: IDS.ccRelMgmt,
        description: null,
        lines: [{ glAccountId: mockStore.glAccounts[0]!.id, amount: 1000 }],
      })
    ).rejects.toThrow(/original budget types/i);
  });

  it("allows Supplementary alongside an active Primary lineage key", async () => {
    const actor = mockStore.users.find((u) => u.id === IDS.patrick)!;
    await service.createDraft(actor, {
      budgetType: "Primary",
      fiscalYearId: IDS.fy2027,
      fromPeriod: "2026-07-01",
      toPeriod: "2027-06-30",
      costCenterId: IDS.ccRelMgmt,
      description: null,
      lines: [{ glAccountId: mockStore.glAccounts[0]!.id, amount: 1000 }],
    });

    const supplementary = await service.createDraft(actor, {
      budgetType: "Supplementary",
      fiscalYearId: IDS.fy2027,
      fromPeriod: "2026-07-01",
      toPeriod: "2027-06-30",
      costCenterId: IDS.ccRelMgmt,
      description: null,
      lines: [{ glAccountId: mockStore.glAccounts[0]!.id, amount: 2000 }],
    });
    expect(supplementary.budgetType).toBe("Supplementary");
  });
});

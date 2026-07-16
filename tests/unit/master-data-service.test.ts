import { beforeEach, describe, expect, it } from "vitest";
import {
  CostCenterService,
  DepartmentService,
  MasterDataServiceError,
} from "@/application/master-data-service";
import { FiscalYearService } from "@/application/fiscal-year-service";
import { AuthorizationService } from "@/application/authorization-service";
import {
  MockAuditLogRepository,
  MockBudgetPlanRepository,
  MockCostCenterRepository,
  MockDepartmentRepository,
  MockFiscalYearRepository,
  MockUnitOfWork,
  MockUserRepository,
} from "@/infrastructure/repositories/mock";
import { resetMockStore, mockStore } from "@/infrastructure/repositories/mock/store";
import { IDS } from "@/infrastructure/repositories/mock/seed";
import type { User } from "@/domain/entities";

function adminActor(): User {
  return mockStore.users.find((u) => u.id === IDS.admin)!;
}

describe("master data services", () => {
  let departments: MockDepartmentRepository;
  let costCenters: MockCostCenterRepository;
  let users: MockUserRepository;
  let budgets: MockBudgetPlanRepository;
  let fiscalYears: MockFiscalYearRepository;
  let audits: MockAuditLogRepository;
  let uow: MockUnitOfWork;
  let authz: AuthorizationService;
  let departmentService: DepartmentService;
  let costCenterService: CostCenterService;
  let fiscalYearService: FiscalYearService;

  beforeEach(() => {
    resetMockStore();
    departments = new MockDepartmentRepository();
    costCenters = new MockCostCenterRepository();
    users = new MockUserRepository();
    budgets = new MockBudgetPlanRepository();
    fiscalYears = new MockFiscalYearRepository();
    audits = new MockAuditLogRepository();
    uow = new MockUnitOfWork();
    authz = new AuthorizationService(users, costCenters);
    departmentService = new DepartmentService(
      departments,
      costCenters,
      audits,
      authz,
      uow
    );
    costCenterService = new CostCenterService(
      costCenters,
      departments,
      users,
      budgets,
      audits,
      authz,
      uow
    );
    fiscalYearService = new FiscalYearService(
      fiscalYears,
      audits,
      authz,
      uow
    );
  });

  it("creates and archives a department", async () => {
    const actor = adminActor();
    const created = await departmentService.create(
      { name: "Finance", code: "FIN", isActive: true },
      actor
    );
    expect(created.code).toBe("FIN");
    expect(created.isActive).toBe(true);

    const archived = await departmentService.update(
      created.id,
      { name: "Finance", code: "FIN", isActive: false },
      actor
    );
    expect(archived.isActive).toBe(false);
  });

  it("rejects archiving a department with active cost centers", async () => {
    await expect(
      departmentService.update(
        IDS.deptIct,
        { name: "ICT", code: "ICT", isActive: false },
        adminActor()
      )
    ).rejects.toMatchObject({
      code: "IN_USE",
    } satisfies Partial<MasterDataServiceError>);
  });

  it("creates a cost center with distinct manager and responsible person", async () => {
    const saved = await costCenterService.create(
      {
        code: "KGN70999",
        sapCostCenterCode: "606599",
        name: "Test Center",
        departmentId: IDS.deptIct,
        managerId: IDS.geofrey,
        responsiblePersonId: IDS.edwin,
        isActive: true,
      },
      adminActor()
    );
    expect(saved.managerId).toBe(IDS.geofrey);
    expect(saved.responsiblePersonId).toBe(IDS.edwin);
  });

  it("blocks mid-cycle ownership reassignment when a budget is active", async () => {
    const now = new Date().toISOString();
    await budgets.save({
      id: "budget-active",
      ownerId: IDS.edwin,
      costCenterId: IDS.ccSysAdmin,
      fiscalYearId: IDS.fy2027,
      budgetType: "OPEX",
      fromPeriod: "2026-07-01",
      toPeriod: "2027-06-30",
      description: null,
      status: "InApproval",
      currentApproverId: IDS.geofrey,
      submittedAt: now,
      sapVersion: null,
      lines: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
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
    });

    const current = (await costCenters.getById(IDS.ccSysAdmin))!;
    await expect(
      costCenterService.update(
        IDS.ccSysAdmin,
        {
          code: current.code,
          sapCostCenterCode: current.sapCostCenterCode,
          name: current.name,
          departmentId: current.departmentId,
          managerId: IDS.peter,
          responsiblePersonId: current.responsiblePersonId,
          isActive: true,
        },
        adminActor()
      )
    ).rejects.toMatchObject({ code: "HAS_ACTIVE_BUDGET" });
  });

  it("enforces exactly one Open financial year", async () => {
    await expect(
      fiscalYearService.openNew(
        {
          yearLabel: 2028,
          startDate: "2027-07-01",
          endDate: "2028-06-30",
        },
        adminActor()
      )
    ).rejects.toMatchObject({ code: "ALREADY_OPEN" });
  });

  it("sets exactly one Current financial year", async () => {
    const actor = adminActor();
    // Close FY2027 so we can still setCurrent (Closed is allowed).
    await fiscalYearService.close(IDS.fy2027, actor);
    const set = await fiscalYearService.setCurrent(IDS.fy2026, actor);
    expect(set.isCurrent).toBe(true);

    const all = await fiscalYears.getAll();
    expect(all.filter((fy) => fy.isCurrent)).toHaveLength(1);
    expect(all.find((fy) => fy.id === IDS.fy2026)?.isCurrent).toBe(true);
    expect(all.find((fy) => fy.id === IDS.fy2027)?.isCurrent).toBe(false);
  });
});

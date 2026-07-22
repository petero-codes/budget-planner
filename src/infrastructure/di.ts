import "server-only";

import { ApprovalService } from "@/application/approval-service";
import { AuthorizationService } from "@/application/authorization-service";
import { BudgetPlanService } from "@/application/budget-plan-service";
import { DashboardService } from "@/application/dashboard-service";
import { ExecutiveService } from "@/application/executive-service";
import { FinanceService } from "@/application/finance-service";
import { FiscalYearService } from "@/application/fiscal-year-service";
import { SapComplianceService } from "@/application/sap-compliance-service";
import { AdminUserService } from "@/application/admin-user-service";
import { DevelopmentToolkitService } from "@/application/development/development-toolkit-service";
import {
  CostCenterService,
  DepartmentService,
  SubmissionStatusService,
} from "@/application/master-data-service";
import packageJson from "../../package.json";
import type {
  IApprovalHistoryRepository,
  IApprovalRouteRepository,
  IAuditLogRepository,
  IBudgetAttachmentCategoryRepository,
  IBudgetAttachmentRepository,
  IBudgetLineageRepository,
  IBudgetPlanRepository,
  ICostCenterAdminRepository,
  IDepartmentAdminRepository,
  IFinanceClaimRepository,
  IFiscalYearRepository,
  IGlAccountRepository,
  INotificationRepository,
  ISapPackageRepository,
  ISubmissionStatusRepository,
  IUnitOfWork,
  IUserAdminRepository,
  IWorkflowHistoryRepository,
} from "@/infrastructure/repositories/interfaces";
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
  MockUnitOfWork,
  MockUserRepository,
  MockWorkflowHistoryRepository,
} from "@/infrastructure/repositories/mock";
import { readSessionUserId } from "@/infrastructure/session";
import {
  resolveRepositoryDriver,
  type RepositoryDriver,
} from "@/infrastructure/startup/env";

export type RepositoryBundle = {
  users: IUserAdminRepository;
  departments: IDepartmentAdminRepository;
  costCenters: ICostCenterAdminRepository;
  glAccounts: IGlAccountRepository;
  fiscalYears: IFiscalYearRepository;
  budgets: IBudgetPlanRepository;
  lineages: IBudgetLineageRepository;
  routes: IApprovalRouteRepository;
  history: IApprovalHistoryRepository;
  workflow: IWorkflowHistoryRepository;
  audits: IAuditLogRepository;
  notifications: INotificationRepository;
  submissionStatus: ISubmissionStatusRepository;
  financeClaims: IFinanceClaimRepository;
  attachments: IBudgetAttachmentRepository;
  attachmentCategories: IBudgetAttachmentCategoryRepository;
  sapPackages: ISapPackageRepository;
  uow: IUnitOfWork;
};

function createMockRepos(): RepositoryBundle {
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
    uow: new MockUnitOfWork(),
  };
}

function createSqlRepos(): RepositoryBundle {
  const sqlRepos = require("@/infrastructure/repositories/sql") as typeof import("@/infrastructure/repositories/sql");
  return {
    users: new sqlRepos.SqlUserRepository(),
    departments: new sqlRepos.SqlDepartmentRepository(),
    costCenters: new sqlRepos.SqlCostCenterRepository(),
    glAccounts: new sqlRepos.SqlGlAccountRepository(),
    fiscalYears: new sqlRepos.SqlFiscalYearRepository(),
    budgets: new sqlRepos.SqlBudgetPlanRepository(),
    lineages: new sqlRepos.SqlBudgetLineageRepository(),
    routes: new sqlRepos.SqlApprovalRouteRepository(),
    history: new sqlRepos.SqlApprovalHistoryRepository(),
    workflow: new sqlRepos.SqlWorkflowHistoryRepository(),
    audits: new sqlRepos.SqlAuditLogRepository(),
    notifications: new sqlRepos.SqlNotificationRepository(),
    submissionStatus: new sqlRepos.SqlSubmissionStatusRepository(),
    financeClaims: new sqlRepos.SqlFinanceClaimRepository(),
    attachments: new sqlRepos.SqlBudgetAttachmentRepository(),
    attachmentCategories: new sqlRepos.SqlBudgetAttachmentCategoryRepository(),
    sapPackages: new sqlRepos.SqlSapPackageRepository(),
    uow: new sqlRepos.SqlUnitOfWork(),
  };
}

/**
 * Single source of truth for the repository driver.
 * Read exactly once. Never instantiate repositories outside this module.
 * Client bundles always get mock stubs (browser cannot use SQL).
 */
const driver: RepositoryDriver =
  typeof window !== "undefined" ? "mock" : resolveRepositoryDriver();

const bundle: RepositoryBundle =
  typeof window !== "undefined"
    ? createMockRepos()
    : driver === "sql"
      ? createSqlRepos()
      : createMockRepos();

export const repos = {
  users: bundle.users,
  departments: bundle.departments,
  costCenters: bundle.costCenters,
  glAccounts: bundle.glAccounts,
  fiscalYears: bundle.fiscalYears,
  budgets: bundle.budgets,
  lineages: bundle.lineages,
  routes: bundle.routes,
  history: bundle.history,
  workflow: bundle.workflow,
  audits: bundle.audits,
  notifications: bundle.notifications,
  submissionStatus: bundle.submissionStatus,
  financeClaims: bundle.financeClaims,
  attachments: bundle.attachments,
  attachmentCategories: bundle.attachmentCategories,
  sapPackages: bundle.sapPackages,
};

export const authorizationService = new AuthorizationService(
  bundle.users,
  bundle.costCenters,
  bundle.audits
);
export const approvalService = new ApprovalService(
  bundle.users,
  bundle.budgets,
  bundle.costCenters,
  bundle.fiscalYears,
  bundle.routes,
  bundle.history,
  bundle.audits,
  bundle.notifications,
  authorizationService,
  bundle.uow,
  bundle.submissionStatus,
  bundle.workflow
);
export const budgetPlanService = new BudgetPlanService(
  bundle.budgets,
  bundle.lineages,
  bundle.costCenters,
  bundle.departments,
  bundle.fiscalYears,
  bundle.attachments,
  bundle.audits,
  bundle.history,
  bundle.workflow,
  authorizationService,
  approvalService,
  bundle.uow,
  bundle.submissionStatus,
  bundle.users,
  bundle.notifications
);
export const financeService = new FinanceService(
  bundle.users,
  bundle.budgets,
  bundle.lineages,
  bundle.costCenters,
  bundle.departments,
  bundle.fiscalYears,
  bundle.glAccounts,
  bundle.financeClaims,
  bundle.sapPackages,
  bundle.history,
  bundle.audits,
  bundle.notifications,
  authorizationService,
  bundle.uow,
  bundle.submissionStatus,
  bundle.workflow
);
export const fiscalYearService = new FiscalYearService(
  bundle.fiscalYears,
  bundle.audits,
  bundle.users,
  bundle.notifications,
  authorizationService,
  bundle.uow
);
export const departmentService = new DepartmentService(
  bundle.departments,
  bundle.costCenters,
  bundle.audits,
  authorizationService,
  bundle.uow
);
export const costCenterService = new CostCenterService(
  bundle.costCenters,
  bundle.departments,
  bundle.users,
  bundle.budgets,
  bundle.audits,
  authorizationService,
  bundle.uow
);
export const submissionStatusService = new SubmissionStatusService(
  bundle.submissionStatus,
  bundle.costCenters,
  bundle.fiscalYears,
  authorizationService
);
export const adminUserService = new AdminUserService(
  bundle.users,
  bundle.departments,
  bundle.costCenters,
  bundle.budgets,
  bundle.audits,
  bundle.notifications,
  authorizationService,
  bundle.uow
);
export const dashboardService = new DashboardService(
  budgetPlanService,
  bundle.users,
  bundle.departments,
  bundle.costCenters,
  bundle.fiscalYears,
  bundle.history,
  authorizationService
);
export const executiveService = new ExecutiveService(
  bundle.budgets,
  bundle.users,
  bundle.departments,
  bundle.costCenters,
  bundle.fiscalYears,
  bundle.history,
  authorizationService
);
export const sapComplianceService = new SapComplianceService(
  bundle.budgets,
  bundle.users,
  bundle.departments,
  bundle.costCenters,
  bundle.fiscalYears,
  bundle.glAccounts,
  bundle.history,
  bundle.audits,
  authorizationService,
  bundle.sapPackages
);

export function getRepositoryDriver(): RepositoryDriver {
  return driver;
}

export const developmentToolkitService = new DevelopmentToolkitService(
  bundle,
  fiscalYearService,
  getRepositoryDriver,
  typeof packageJson.version === "string" ? packageJson.version : "0.0.0"
);

export async function getCurrentUser() {
  const userId = await readSessionUserId();
  if (!userId) throw new Error("Not signed in");
  const user = await bundle.users.getById(userId);
  if (!user) throw new Error("Current user not found — sign in again");
  return user;
}

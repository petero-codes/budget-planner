import { ApprovalService } from "@/application/approval-service";
import { AuthorizationService } from "@/application/authorization-service";
import { BudgetPlanService } from "@/application/budget-plan-service";
import {
  MockApprovalHistoryRepository,
  MockApprovalRouteRepository,
  MockAuditLogRepository,
  MockBudgetPlanRepository,
  MockCostCenterRepository,
  MockFiscalYearRepository,
  MockGlAccountRepository,
  MockNotificationRepository,
  MockUnitOfWork,
  MockUserRepository,
} from "@/infrastructure/repositories/mock";
import { mockStore } from "@/infrastructure/repositories/mock/store";

const userRepo = new MockUserRepository();
const costCenterRepo = new MockCostCenterRepository();
const glRepo = new MockGlAccountRepository();
const fyRepo = new MockFiscalYearRepository();
const budgetRepo = new MockBudgetPlanRepository();
const routeRepo = new MockApprovalRouteRepository();
const historyRepo = new MockApprovalHistoryRepository();
const auditRepo = new MockAuditLogRepository();
const notificationRepo = new MockNotificationRepository();
const uow = new MockUnitOfWork();

export const authorizationService = new AuthorizationService(userRepo);
export const approvalService = new ApprovalService(
  userRepo,
  budgetRepo,
  costCenterRepo,
  routeRepo,
  historyRepo,
  auditRepo,
  notificationRepo,
  authorizationService,
  uow
);
export const budgetPlanService = new BudgetPlanService(
  budgetRepo,
  costCenterRepo,
  auditRepo,
  authorizationService,
  approvalService,
  uow
);

export const repos = {
  users: userRepo,
  costCenters: costCenterRepo,
  glAccounts: glRepo,
  fiscalYears: fyRepo,
  budgets: budgetRepo,
  routes: routeRepo,
  history: historyRepo,
  audits: auditRepo,
  notifications: notificationRepo,
};

export async function getCurrentUser() {
  const user = await userRepo.getById(mockStore.currentUserId);
  if (!user) throw new Error("Current user not found");
  return user;
}

export function setCurrentUserId(userId: string) {
  mockStore.currentUserId = userId;
}

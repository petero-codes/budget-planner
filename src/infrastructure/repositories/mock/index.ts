import type {
  IApprovalHistoryRepository,
  IApprovalRouteRepository,
  IAuditLogRepository,
  IBudgetPlanRepository,
  ICostCenterRepository,
  IFiscalYearRepository,
  IGlAccountRepository,
  INotificationRepository,
  IUnitOfWork,
  IUserRepository,
} from "../interfaces";
import type {
  ApprovalHistoryEntry,
  ApprovalRouteStep,
  AuditLogEntry,
  BudgetPlan,
  Notification,
  User,
} from "@/domain/entities";
import { mockStore, newId } from "./store";

export class MockUserRepository implements IUserRepository {
  async getById(id: string): Promise<User | null> {
    return mockStore.users.find((u) => u.id === id) ?? null;
  }

  async getAll(): Promise<User[]> {
    return [...mockStore.users];
  }

  async getUsersByIdMap(): Promise<Map<string, User>> {
    return new Map(mockStore.users.map((u) => [u.id, u]));
  }

  async getDescendantIds(userId: string): Promise<string[]> {
    const result: string[] = [];
    const queue = [userId];
    while (queue.length) {
      const current = queue.shift()!;
      const children = mockStore.users.filter((u) => u.managerId === current);
      for (const child of children) {
        result.push(child.id);
        queue.push(child.id);
      }
    }
    return result;
  }
}

export class MockCostCenterRepository implements ICostCenterRepository {
  async getById(id: string) {
    return mockStore.costCenters.find((c) => c.id === id) ?? null;
  }
  async getAll() {
    return [...mockStore.costCenters];
  }
}

export class MockGlAccountRepository implements IGlAccountRepository {
  async getById(id: string) {
    return mockStore.glAccounts.find((g) => g.id === id) ?? null;
  }
  async getAll() {
    return [...mockStore.glAccounts];
  }
  async search(query: string) {
    const q = query.toLowerCase();
    return mockStore.glAccounts.filter(
      (g) =>
        g.isActive &&
        (g.code.includes(q) || g.description.toLowerCase().includes(q))
    );
  }
}

export class MockFiscalYearRepository implements IFiscalYearRepository {
  async getById(id: string) {
    return mockStore.fiscalYears.find((f) => f.id === id) ?? null;
  }
  async getAll() {
    return [...mockStore.fiscalYears];
  }
  async getActive() {
    return mockStore.fiscalYears.find((f) => !f.isLocked) ?? null;
  }
}

export class MockBudgetPlanRepository implements IBudgetPlanRepository {
  async getById(id: string) {
    const plan = mockStore.budgets.find((b) => b.id === id);
    return plan ? structuredClone(plan) : null;
  }
  async list() {
    return structuredClone(mockStore.budgets);
  }
  async listByOwner(ownerId: string) {
    return structuredClone(
      mockStore.budgets.filter((b) => b.ownerId === ownerId)
    );
  }
  async listPendingForApprover(approverId: string) {
    return structuredClone(
      mockStore.budgets.filter(
        (b) => b.status === "InApproval" && b.currentApproverId === approverId
      )
    );
  }
  async findActiveDuplicate(
    costCenterId: string,
    fiscalYearId: string,
    budgetType: string
  ) {
    const plan = mockStore.budgets.find(
      (b) =>
        b.costCenterId === costCenterId &&
        b.fiscalYearId === fiscalYearId &&
        b.budgetType === budgetType &&
        b.status !== "Rejected" &&
        b.status !== "Approved"
    );
    return plan ? structuredClone(plan) : null;
  }
  async save(plan: BudgetPlan) {
    const idx = mockStore.budgets.findIndex((b) => b.id === plan.id);
    if (idx >= 0) {
      mockStore.budgets[idx] = structuredClone(plan);
    } else {
      mockStore.budgets.push(structuredClone(plan));
    }
    return structuredClone(plan);
  }
}

export class MockApprovalRouteRepository implements IApprovalRouteRepository {
  async listByBudgetId(budgetPlanId: string) {
    return structuredClone(
      mockStore.routes
        .filter((r) => r.budgetPlanId === budgetPlanId)
        .sort((a, b) => a.sequence - b.sequence)
    );
  }
  async replaceForBudget(budgetPlanId: string, steps: ApprovalRouteStep[]) {
    mockStore.routes = mockStore.routes.filter(
      (r) => r.budgetPlanId !== budgetPlanId
    );
    mockStore.routes.push(...structuredClone(steps));
  }
  async saveStep(step: ApprovalRouteStep) {
    const idx = mockStore.routes.findIndex((r) => r.id === step.id);
    if (idx >= 0) mockStore.routes[idx] = structuredClone(step);
    else mockStore.routes.push(structuredClone(step));
  }
}

export class MockApprovalHistoryRepository
  implements IApprovalHistoryRepository
{
  async append(entry: ApprovalHistoryEntry) {
    mockStore.history.push(structuredClone(entry));
  }
  async listByBudgetId(budgetPlanId: string) {
    return structuredClone(
      mockStore.history.filter((h) => h.budgetPlanId === budgetPlanId)
    );
  }
}

export class MockAuditLogRepository implements IAuditLogRepository {
  async append(entry: AuditLogEntry) {
    mockStore.audits.push(structuredClone(entry));
  }
  async list(filters?: { entity?: string; entityId?: string }) {
    return structuredClone(
      mockStore.audits.filter((a) => {
        if (filters?.entity && a.entity !== filters.entity) return false;
        if (filters?.entityId && a.entityId !== filters.entityId) return false;
        return true;
      })
    );
  }
}

export class MockNotificationRepository implements INotificationRepository {
  async create(notification: Notification) {
    mockStore.notifications.push(structuredClone(notification));
  }
  async listByUser(userId: string) {
    return structuredClone(
      mockStore.notifications
        .filter((n) => n.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
  }
  async markRead(id: string) {
    const n = mockStore.notifications.find((x) => x.id === id);
    if (n) n.isRead = true;
  }
}

export class MockUnitOfWork implements IUnitOfWork {
  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

export { newId };

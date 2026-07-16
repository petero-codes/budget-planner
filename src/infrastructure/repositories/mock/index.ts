import type {
  IApprovalHistoryRepository,
  IApprovalRouteRepository,
  IAuditLogRepository,
  IBudgetPlanRepository,
  ICostCenterAdminRepository,
  IDepartmentAdminRepository,
  IFiscalYearRepository,
  IGlAccountRepository,
  INotificationRepository,
  ISubmissionStatusRepository,
  IUnitOfWork,
  IUserAdminRepository,
} from "../interfaces";
import type {
  ApprovalHistoryEntry,
  ApprovalRouteStep,
  AuditLogEntry,
  BudgetPlan,
  CostCenter,
  CostCenterSubmissionStatus,
  Department,
  FiscalYear,
  Notification,
  User,
} from "@/domain/entities";
import {
  IN_PLAY,
  MockBudgetAttachmentCategoryRepository,
  MockBudgetAttachmentRepository,
  MockBudgetLineageRepository,
  MockFinanceClaimRepository,
  MockSapPackageRepository,
  MockWorkflowHistoryRepository,
  withDefaultPlanFields,
} from "./lineage-repos";
import { ConcurrencyConflictError } from "@/application/concurrency-error";
import {
  permissionCodesByRole,
  roleDefinitions,
} from "./seed";
import { mockStore } from "./store";

export class MockUserRepository implements IUserAdminRepository {
  async getById(id: string): Promise<User | null> {
    return mockStore.users.find((u) => u.id === id) ?? null;
  }

  async getAll(): Promise<User[]> {
    return structuredClone(mockStore.users);
  }

  async getByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    const user = mockStore.users.find(
      (u) => u.email.toLowerCase() === normalized
    );
    return user ? structuredClone(user) : null;
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

  async getPositionById(id: string) {
    return structuredClone(
      mockStore.positions.find((position) => position.id === id) ?? null
    );
  }

  async listPositions() {
    return structuredClone(mockStore.positions);
  }

  async listRoles() {
    return roleDefinitions.map((role) => ({ ...role }));
  }

  async create(user: User, passwordHash: string) {
    if (await this.getByEmail(user.email)) {
      throw new Error("A user with this email already exists");
    }
    const saved = this.withPermissions(user);
    mockStore.users.push(structuredClone(saved));
    mockStore.passwordHashes.set(saved.id, passwordHash);
    return structuredClone(saved);
  }

  async update(user: User) {
    const index = mockStore.users.findIndex((item) => item.id === user.id);
    if (index < 0) throw new Error("User not found");
    const saved = this.withPermissions(user);
    mockStore.users[index] = structuredClone(saved);
    return structuredClone(saved);
  }

  async setPasswordHash(userId: string, passwordHash: string) {
    if (!mockStore.users.some((user) => user.id === userId)) {
      throw new Error("User not found");
    }
    mockStore.passwordHashes.set(userId, passwordHash);
  }

  private withPermissions(user: User): User {
    const permissionCodes = Array.from(
      new Set(
        user.roleCodes.flatMap((role) => permissionCodesByRole[role] ?? [])
      )
    );
    return { ...structuredClone(user), permissionCodes };
  }
}

export class MockCostCenterRepository implements ICostCenterAdminRepository {
  async getById(id: string) {
    return mockStore.costCenters.find((c) => c.id === id) ?? null;
  }
  async getAll() {
    return [...mockStore.costCenters];
  }
  async getByCode(code: string) {
    const normalized = code.trim().toUpperCase();
    return (
      mockStore.costCenters.find(
        (c) => c.code.toUpperCase() === normalized
      ) ?? null
    );
  }
  async create(costCenter: CostCenter) {
    mockStore.costCenters.push(structuredClone(costCenter));
    return structuredClone(costCenter);
  }
  async update(costCenter: CostCenter) {
    const idx = mockStore.costCenters.findIndex((c) => c.id === costCenter.id);
    if (idx < 0) throw new Error("Cost center not found");
    mockStore.costCenters[idx] = structuredClone(costCenter);
    return structuredClone(costCenter);
  }
}

export class MockDepartmentRepository implements IDepartmentAdminRepository {
  async getById(id: string) {
    return mockStore.departments.find((d) => d.id === id) ?? null;
  }
  async getAll() {
    return [...mockStore.departments];
  }
  async getByCode(code: string) {
    const normalized = code.trim().toUpperCase();
    return (
      mockStore.departments.find(
        (d) => d.code.toUpperCase() === normalized
      ) ?? null
    );
  }
  async create(department: Department) {
    mockStore.departments.push(structuredClone(department));
    return structuredClone(department);
  }
  async update(department: Department) {
    const idx = mockStore.departments.findIndex((d) => d.id === department.id);
    if (idx < 0) throw new Error("Department not found");
    mockStore.departments[idx] = structuredClone(department);
    return structuredClone(department);
  }
}

export class MockSubmissionStatusRepository
  implements ISubmissionStatusRepository
{
  async get(costCenterId: string, fiscalYearId: string) {
    return (
      structuredClone(
        mockStore.submissionStatuses.find(
          (s) =>
            s.costCenterId === costCenterId && s.fiscalYearId === fiscalYearId
        )
      ) ?? null
    );
  }
  async listByFiscalYear(fiscalYearId: string) {
    return structuredClone(
      mockStore.submissionStatuses.filter(
        (s) => s.fiscalYearId === fiscalYearId
      )
    );
  }
  async upsert(status: CostCenterSubmissionStatus) {
    const idx = mockStore.submissionStatuses.findIndex(
      (s) =>
        s.costCenterId === status.costCenterId &&
        s.fiscalYearId === status.fiscalYearId
    );
    const copy = structuredClone(status);
    if (idx >= 0) mockStore.submissionStatuses[idx] = copy;
    else mockStore.submissionStatuses.push(copy);
    return structuredClone(copy);
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
    return structuredClone(mockStore.fiscalYears);
  }
  async getActive() {
    return (
      structuredClone(
        mockStore.fiscalYears.find((f) => f.status === "Open" || !f.isLocked)
      ) ?? null
    );
  }
  async getCurrent() {
    return (
      structuredClone(mockStore.fiscalYears.find((f) => f.isCurrent)) ?? null
    );
  }
  async save(fy: FiscalYear) {
    const idx = mockStore.fiscalYears.findIndex((f) => f.id === fy.id);
    const copy = structuredClone(fy);
    if (idx >= 0) mockStore.fiscalYears[idx] = copy;
    else mockStore.fiscalYears.push(copy);
    return structuredClone(copy);
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
        IN_PLAY.has(b.status)
    );
    return plan ? structuredClone(plan) : null;
  }
  async findActiveInLineage(lineageId: string) {
    const plan = mockStore.budgets.find(
      (b) => b.lineageId === lineageId && IN_PLAY.has(b.status)
    );
    return plan ? structuredClone(plan) : null;
  }
  async listByLineage(lineageId: string) {
    return structuredClone(
      mockStore.budgets
        .filter((b) => b.lineageId === lineageId)
        .sort((a, b) => a.lineageRevision - b.lineageRevision)
    );
  }
  async listPendingFinanceReview() {
    return structuredClone(
      mockStore.budgets.filter((b) => b.status === "PendingFinanceReview")
    );
  }
  async listClaimed() {
    return structuredClone(mockStore.budgets.filter((b) => b.status === "Claimed"));
  }
  async listFinalizedSince(since: string) {
    return structuredClone(
      mockStore.budgets.filter(
        (b) =>
          (b.status === "Finalized" || b.status === "Approved") &&
          b.updatedAt >= since
      )
    );
  }
  async listLatestFinalizedVersions() {
    const byLineage = new Map<string, (typeof mockStore.budgets)[0]>();
    for (const b of mockStore.budgets) {
      if (b.status !== "Finalized" && b.status !== "Approved") continue;
      if (!b.lineageId) continue;
      const prev = byLineage.get(b.lineageId);
      if (!prev || b.lineageRevision > prev.lineageRevision) {
        byLineage.set(b.lineageId, b);
      }
    }
    return structuredClone(Array.from(byLineage.values()));
  }
  async search(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return structuredClone(mockStore.budgets);
    return structuredClone(
      mockStore.budgets.filter(
        (b) =>
          b.versionLabel?.toLowerCase().includes(q) ||
          b.budgetType.toLowerCase().includes(q) ||
          b.status.toLowerCase().includes(q) ||
          b.sapVersion?.toLowerCase().includes(q) ||
          b.id.toLowerCase().includes(q)
      )
    );
  }
  async save(plan: BudgetPlan) {
    const idx = mockStore.budgets.findIndex((b) => b.id === plan.id);
    if (idx >= 0) {
      const existing = mockStore.budgets[idx]!;
      // Optimistic concurrency: plan.version is the expected loaded version.
      if (existing.version !== plan.version) {
        throw new ConcurrencyConflictError();
      }
      const next = structuredClone(plan);
      next.version = existing.version + 1;
      mockStore.budgets[idx] = next;
      return structuredClone(next);
    }
    mockStore.budgets.push(structuredClone(withDefaultPlanFields(plan)));
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
    mockStore.notifications.push(
      structuredClone({
        isCleared: false,
        clearedAt: null,
        clearedReason: null,
        ...notification,
      })
    );
  }
  async listByUser(userId: string) {
    return structuredClone(
      mockStore.notifications
        .filter((n) => n.userId === userId && !n.isCleared)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
  }
  async markRead(id: string) {
    const n = mockStore.notifications.find((x) => x.id === id);
    if (n) n.isRead = true;
  }
  async dismiss(id: string, userId: string) {
    const n = mockStore.notifications.find(
      (x) => x.id === id && x.userId === userId
    );
    if (n) {
      n.isCleared = true;
      n.clearedAt = new Date().toISOString();
      n.clearedReason = n.clearedReason ?? "Dismissed";
    }
  }
  async dismissForPlan(
    planId: string,
    options?: { userId?: string; types?: string[] }
  ) {
    const now = new Date().toISOString();
    for (const n of mockStore.notifications) {
      if (n.relatedPlanId !== planId) continue;
      if (options?.userId && n.userId !== options.userId) continue;
      if (options?.types && !options.types.includes(n.type)) continue;
      n.isCleared = true;
      n.clearedAt = now;
      n.clearedReason = n.clearedReason ?? "Plan cleared";
    }
  }
  async softClear(options: {
    userId?: string;
    reason: string;
    clearedAt: string;
  }) {
    let count = 0;
    for (const n of mockStore.notifications) {
      if (n.isCleared) continue;
      if (options.userId && n.userId !== options.userId) continue;
      n.isCleared = true;
      n.clearedAt = options.clearedAt;
      n.clearedReason = options.reason;
      count++;
    }
    return count;
  }
}

export class MockUnitOfWork implements IUnitOfWork {
  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

export {
  MockBudgetLineageRepository,
  MockWorkflowHistoryRepository,
  MockFinanceClaimRepository,
  MockBudgetAttachmentRepository,
  MockBudgetAttachmentCategoryRepository,
  MockSapPackageRepository,
};

export { MockSupportIssueRepository } from "./support-issue-repo";


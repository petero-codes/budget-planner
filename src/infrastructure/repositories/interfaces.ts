import type {
  ApprovalHistoryEntry,
  ApprovalRouteStep,
  AuditLogEntry,
  BudgetPlan,
  CostCenter,
  FiscalYear,
  GlAccount,
  Notification,
  User,
} from "@/domain/entities";

export interface IUserRepository {
  getById(id: string): Promise<User | null>;
  getAll(): Promise<User[]>;
  getUsersByIdMap(): Promise<Map<string, User>>;
  getDescendantIds(userId: string): Promise<string[]>;
}

export interface ICostCenterRepository {
  getById(id: string): Promise<CostCenter | null>;
  getAll(): Promise<CostCenter[]>;
}

export interface IGlAccountRepository {
  getById(id: string): Promise<GlAccount | null>;
  getAll(): Promise<GlAccount[]>;
  search(query: string): Promise<GlAccount[]>;
}

export interface IFiscalYearRepository {
  getById(id: string): Promise<FiscalYear | null>;
  getAll(): Promise<FiscalYear[]>;
  getActive(): Promise<FiscalYear | null>;
}

export interface IBudgetPlanRepository {
  getById(id: string): Promise<BudgetPlan | null>;
  list(): Promise<BudgetPlan[]>;
  listByOwner(ownerId: string): Promise<BudgetPlan[]>;
  listPendingForApprover(approverId: string): Promise<BudgetPlan[]>;
  findActiveDuplicate(
    costCenterId: string,
    fiscalYearId: string,
    budgetType: string
  ): Promise<BudgetPlan | null>;
  save(plan: BudgetPlan): Promise<BudgetPlan>;
}

export interface IApprovalRouteRepository {
  listByBudgetId(budgetPlanId: string): Promise<ApprovalRouteStep[]>;
  replaceForBudget(
    budgetPlanId: string,
    steps: ApprovalRouteStep[]
  ): Promise<void>;
  saveStep(step: ApprovalRouteStep): Promise<void>;
}

export interface IApprovalHistoryRepository {
  append(entry: ApprovalHistoryEntry): Promise<void>;
  listByBudgetId(budgetPlanId: string): Promise<ApprovalHistoryEntry[]>;
}

export interface IAuditLogRepository {
  append(entry: AuditLogEntry): Promise<void>;
  list(filters?: {
    entity?: string;
    entityId?: string;
  }): Promise<AuditLogEntry[]>;
}

export interface INotificationRepository {
  create(notification: Notification): Promise<void>;
  listByUser(userId: string): Promise<Notification[]>;
  markRead(id: string): Promise<void>;
}

export interface IUnitOfWork {
  runInTransaction<T>(fn: () => Promise<T>): Promise<T>;
}

import "server-only";

import type {
  ApprovalHistoryEntry,
  ApprovalRouteStep,
  AuditLogEntry,
  BudgetAttachment,
  BudgetAttachmentCategory,
  BudgetLineage,
  BudgetPlan,
  CostCenter,
  CostCenterSubmissionStatus,
  Department,
  FinanceQueueClaim,
  FiscalYear,
  GlAccount,
  Notification,
  Position,
  SapPackage,
  SupportIssue,
  User,
  WorkflowHistoryEntry,
} from "@/domain/entities";

/**
 * Repository interfaces (+ IUnitOfWork)
 *
 * Responsibility
 * --------------
 * Persistence contracts for the application layer. Implementations live in
 * mock/ and sql/. Application code must depend on these interfaces only.
 *
 * Does NOT:
 * - contain business workflows (services) or SQL (sql/)
 *
 * Related: docs/DEPENDENCY_MAP.md, docs/DATABASE.md
 */

export interface RoleDefinition {
  code: string;
  name: string;
}

export interface IDepartmentRepository {
  getById(id: string): Promise<Department | null>;
  getAll(): Promise<Department[]>;
}

export interface IDepartmentAdminRepository extends IDepartmentRepository {
  getByCode(code: string): Promise<Department | null>;
  create(department: Department): Promise<Department>;
  update(department: Department): Promise<Department>;
}

export interface IUserRepository {
  getById(id: string): Promise<User | null>;
  getAll(): Promise<User[]>;
  getUsersByIdMap(): Promise<Map<string, User>>;
  getDescendantIds(userId: string): Promise<string[]>;
}

export interface IUserAdminRepository extends IUserRepository {
  getByEmail(email: string): Promise<User | null>;
  getPositionById(id: string): Promise<Position | null>;
  listPositions(): Promise<Position[]>;
  listRoles(): Promise<RoleDefinition[]>;
  create(user: User, passwordHash: string): Promise<User>;
  update(user: User): Promise<User>;
  setPasswordHash(userId: string, passwordHash: string): Promise<void>;
}

export interface ICostCenterRepository {
  getById(id: string): Promise<CostCenter | null>;
  getAll(): Promise<CostCenter[]>;
}

export interface ICostCenterAdminRepository extends ICostCenterRepository {
  getByCode(code: string): Promise<CostCenter | null>;
  create(costCenter: CostCenter): Promise<CostCenter>;
  update(costCenter: CostCenter): Promise<CostCenter>;
}

export interface ISubmissionStatusRepository {
  get(
    costCenterId: string,
    fiscalYearId: string
  ): Promise<CostCenterSubmissionStatus | null>;
  listByFiscalYear(fiscalYearId: string): Promise<CostCenterSubmissionStatus[]>;
  upsert(status: CostCenterSubmissionStatus): Promise<CostCenterSubmissionStatus>;
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
  /** The single year flagged current (drives dashboards / default pickers). */
  getCurrent(): Promise<FiscalYear | null>;
  save(fy: FiscalYear): Promise<FiscalYear>;
}

export interface IBudgetLineageRepository {
  getById(id: string): Promise<BudgetLineage | null>;
  getByKey(
    costCenterId: string,
    fiscalYearId: string,
    originalBudgetCategory: string
  ): Promise<BudgetLineage | null>;
  listBudgetNumbers(): Promise<string[]>;
  save(lineage: BudgetLineage): Promise<BudgetLineage>;
  updatePointers(
    lineageId: string,
    pointers: {
      currentVersionId?: string | null;
      latestFinalizedVersionId?: string | null;
    }
  ): Promise<BudgetLineage>;
  setArchived(lineageId: string, isArchived: boolean): Promise<void>;
}

export interface IBudgetPlanRepository {
  getById(id: string): Promise<BudgetPlan | null>;
  list(): Promise<BudgetPlan[]>;
  listByOwner(ownerId: string): Promise<BudgetPlan[]>;
  listByLineage(lineageId: string): Promise<BudgetPlan[]>;
  listPendingForApprover(approverId: string): Promise<BudgetPlan[]>;
  listPendingFinanceReview(): Promise<BudgetPlan[]>;
  listClaimed(): Promise<BudgetPlan[]>;
  listFinalizedSince(since: string): Promise<BudgetPlan[]>;
  /** Latest finalized version per lineage (for reports). */
  listLatestFinalizedVersions(): Promise<BudgetPlan[]>;
  findActiveDuplicate(
    costCenterId: string,
    fiscalYearId: string,
    budgetCategory: string
  ): Promise<BudgetPlan | null>;
  findActiveInLineage(lineageId: string): Promise<BudgetPlan | null>;
  search(query: string): Promise<BudgetPlan[]>;
  save(plan: BudgetPlan): Promise<BudgetPlan>;
}

export interface IWorkflowHistoryRepository {
  append(entry: WorkflowHistoryEntry): Promise<void>;
  listByBudgetId(budgetVersionId: string): Promise<WorkflowHistoryEntry[]>;
}

export interface IFinanceClaimRepository {
  getActiveClaim(budgetPlanId: string): Promise<FinanceQueueClaim | null>;
  claim(claim: FinanceQueueClaim): Promise<FinanceQueueClaim>;
  release(budgetPlanId: string, releasedAt: string): Promise<void>;
}

export interface IBudgetAttachmentRepository {
  listByBudgetId(budgetPlanId: string): Promise<BudgetAttachment[]>;
  getById(id: string): Promise<(BudgetAttachment & { content: Buffer }) | null>;
  save(
    attachment: BudgetAttachment,
    content: Buffer
  ): Promise<BudgetAttachment>;
  archive(id: string, archivedAt: string): Promise<void>;
}

export interface IBudgetAttachmentCategoryRepository {
  listActive(): Promise<BudgetAttachmentCategory[]>;
  listRequiredForBudgetCategory(
    budgetCategory: string
  ): Promise<BudgetAttachmentCategory[]>;
  listAll(): Promise<BudgetAttachmentCategory[]>;
  save(category: BudgetAttachmentCategory): Promise<BudgetAttachmentCategory>;
  setRequirements(budgetCategory: string, categoryIds: string[]): Promise<void>;
}

export interface ISapPackageRepository {
  getByBudgetPlanId(budgetPlanId: string): Promise<SapPackage | null>;
  save(pkg: SapPackage): Promise<SapPackage>;
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
  /**
   * Active notifications for a user (unresolved and un-archived) newest-first.
   * Pass `includeResolved` to return resolved history instead.
   */
  listByUser(
    userId: string,
    options?: { includeResolved?: boolean }
  ): Promise<Notification[]>;
  /** Mark a single notification read (IDOR-safe). Read is not resolution. */
  markRead(id: string, userId: string): Promise<void>;
  /** Mark all of a user's active notifications read. */
  markAllRead(userId: string): Promise<void>;
  /**
   * Resolve (mark work complete) notifications tied to a budget plan.
   * If userId is set, only that user's; otherwise all users for the plan.
   * If types is set, only those notification types.
   */
  resolveForPlan(
    planId: string,
    options?: { userId?: string; types?: string[]; resolvedBy?: string | null }
  ): Promise<void>;
  /**
   * Resolve notifications tied to any business entity (User, FiscalYear, Issue…).
   * If userId is set, only that user's; otherwise all recipients.
   * If types is set, only those notification types.
   */
  resolveForEntity(
    entityType: string,
    entityId: string,
    options?: { userId?: string; types?: string[]; resolvedBy?: string | null }
  ): Promise<void>;
  /**
   * Resolve a single notification owned by userId (IDOR-safe). Used to
   * acknowledge informational notifications; callers must not expose this for
   * actionable (workflow-owned) notifications.
   */
  resolveOwn(id: string, userId: string, resolvedBy?: string | null): Promise<void>;
  /**
   * Archive a single, already-resolved notification owned by userId (IDOR-safe).
   * Refuses to archive unresolved (still-pending) work.
   */
  archiveResolved(id: string, userId: string): Promise<void>;
  /** Soft-clear (toolkit). Leaves rows for history inspection. */
  softClear(options: {
    userId?: string;
    reason: string;
    clearedAt: string;
  }): Promise<number>;
}

export interface ISupportIssueRepository {
  getById(id: string): Promise<SupportIssue | null>;
  getByReference(referenceNumber: string): Promise<SupportIssue | null>;
  listMine(userId: string): Promise<SupportIssue[]>;
  listAll(filters?: { status?: string }): Promise<SupportIssue[]>;
  /** Allocate next sequence for year and return it (1-based). */
  nextSequence(yearLabel: number): Promise<number>;
  save(issue: SupportIssue, screenshot?: Buffer | null): Promise<SupportIssue>;
  getScreenshot(
    id: string
  ): Promise<{ content: Buffer; fileName: string; contentType: string } | null>;
}

export interface IUnitOfWork {
  runInTransaction<T>(fn: () => Promise<T>): Promise<T>;
}

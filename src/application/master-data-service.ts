import type {
  CostCenter,
  CostCenterSubmissionStatus,
  Department,
  User,
} from "@/domain/entities";
import type {
  IAuditLogRepository,
  IBudgetPlanRepository,
  ICostCenterAdminRepository,
  IDepartmentAdminRepository,
  IFiscalYearRepository,
  ISubmissionStatusRepository,
  IUnitOfWork,
  IUserRepository,
} from "@/infrastructure/repositories/interfaces";
import { newId } from "@/infrastructure/id";
import { AuthorizationService } from "./authorization-service";

/** Budget statuses that keep a cost center "locked" against reassignment. */
const ACTIVE_BUDGET_STATUSES = new Set([
  "Draft",
  "InApproval",
  "ReturnedForRevision",
]);

export class MasterDataServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "DUPLICATE_CODE"
      | "INVALID_REFERENCE"
      | "ARCHIVED"
      | "HAS_ACTIVE_BUDGET"
      | "IN_USE"
      | "VALIDATION"
  ) {
    super(message);
    this.name = "MasterDataServiceError";
  }
}

export type DepartmentInput = {
  name: string;
  code: string;
  isActive: boolean;
};

export type CostCenterInput = {
  code: string;
  sapCostCenterCode: string | null;
  name: string;
  departmentId: string;
  managerId: string | null;
  responsiblePersonId: string | null;
  isActive: boolean;
};

async function audit(
  audits: IAuditLogRepository,
  entity: string,
  entityId: string,
  action: string,
  actor: User,
  correlationId: string,
  before: unknown,
  after: unknown
): Promise<void> {
  await audits.append({
    id: newId("audit"),
    entity,
    entityId,
    action,
    performedBy: actor.id,
    ipAddress: null,
    correlationId,
    beforeJson: before ? JSON.stringify(before) : null,
    afterJson: after ? JSON.stringify(after) : null,
    timestamp: new Date().toISOString(),
  });
}

export class DepartmentService {
  constructor(
    private readonly departments: IDepartmentAdminRepository,
    private readonly costCenters: ICostCenterAdminRepository,
    private readonly audits: IAuditLogRepository,
    private readonly authz: AuthorizationService,
    private readonly uow: IUnitOfWork
  ) {}

  async list(actor: User): Promise<Department[]> {
    this.authz.assertPermission(actor, "admin.masterdata");
    return this.departments.getAll();
  }

  async create(
    input: DepartmentInput,
    actor: User,
    correlationId = newId("corr")
  ): Promise<Department> {
    this.authz.assertPermission(actor, "admin.masterdata");
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    if (!code || !name) {
      throw new MasterDataServiceError("Name and code are required", "VALIDATION");
    }
    if (await this.departments.getByCode(code)) {
      throw new MasterDataServiceError(
        `A department with code ${code} already exists`,
        "DUPLICATE_CODE"
      );
    }
    const department: Department = {
      id: newId(),
      name,
      code,
      isActive: input.isActive,
    };
    return this.uow.runInTransaction(async () => {
      const saved = await this.departments.create(department);
      await audit(
        this.audits,
        "Department",
        saved.id,
        "DepartmentCreated",
        actor,
        correlationId,
        null,
        saved
      );
      return saved;
    });
  }

  async update(
    id: string,
    input: DepartmentInput,
    actor: User,
    correlationId = newId("corr")
  ): Promise<Department> {
    this.authz.assertPermission(actor, "admin.masterdata");
    const current = await this.departments.getById(id);
    if (!current) {
      throw new MasterDataServiceError("Department not found", "NOT_FOUND");
    }
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    if (!code || !name) {
      throw new MasterDataServiceError("Name and code are required", "VALIDATION");
    }
    const clash = await this.departments.getByCode(code);
    if (clash && clash.id !== id) {
      throw new MasterDataServiceError(
        `A department with code ${code} already exists`,
        "DUPLICATE_CODE"
      );
    }
    // Archiving is blocked while active cost centers still belong here.
    if (current.isActive && !input.isActive) {
      const activeCenters = (await this.costCenters.getAll()).filter(
        (cc) => cc.departmentId === id && cc.isActive
      );
      if (activeCenters.length > 0) {
        throw new MasterDataServiceError(
          "Archive or move this department's active cost centers first",
          "IN_USE"
        );
      }
    }
    const next: Department = { ...current, name, code, isActive: input.isActive };
    return this.uow.runInTransaction(async () => {
      const saved = await this.departments.update(next);
      await audit(
        this.audits,
        "Department",
        saved.id,
        current.isActive && !input.isActive
          ? "DepartmentArchived"
          : "DepartmentUpdated",
        actor,
        correlationId,
        current,
        saved
      );
      return saved;
    });
  }
}

export class CostCenterService {
  constructor(
    private readonly costCenters: ICostCenterAdminRepository,
    private readonly departments: IDepartmentAdminRepository,
    private readonly users: IUserRepository,
    private readonly budgets: IBudgetPlanRepository,
    private readonly audits: IAuditLogRepository,
    private readonly authz: AuthorizationService,
    private readonly uow: IUnitOfWork
  ) {}

  async list(actor: User): Promise<{
    costCenters: CostCenter[];
    departments: Department[];
    users: User[];
  }> {
    this.authz.assertPermission(actor, "admin.masterdata");
    const [costCenters, departments, users] = await Promise.all([
      this.costCenters.getAll(),
      this.departments.getAll(),
      this.users.getAll(),
    ]);
    return { costCenters, departments, users };
  }

  async create(
    input: CostCenterInput,
    actor: User,
    correlationId = newId("corr")
  ): Promise<CostCenter> {
    this.authz.assertPermission(actor, "admin.masterdata");
    const normalized = await this.normalizeAndValidate(input);
    if (await this.costCenters.getByCode(normalized.code)) {
      throw new MasterDataServiceError(
        `A cost center with code ${normalized.code} already exists`,
        "DUPLICATE_CODE"
      );
    }
    const costCenter: CostCenter = { id: newId(), ...normalized };
    return this.uow.runInTransaction(async () => {
      const saved = await this.costCenters.create(costCenter);
      await audit(
        this.audits,
        "CostCenter",
        saved.id,
        "CostCenterCreated",
        actor,
        correlationId,
        null,
        saved
      );
      return saved;
    });
  }

  async update(
    id: string,
    input: CostCenterInput,
    actor: User,
    correlationId = newId("corr")
  ): Promise<CostCenter> {
    this.authz.assertPermission(actor, "admin.masterdata");
    const current = await this.costCenters.getById(id);
    if (!current) {
      throw new MasterDataServiceError("Cost center not found", "NOT_FOUND");
    }
    const normalized = await this.normalizeAndValidate(input);
    const clash = await this.costCenters.getByCode(normalized.code);
    if (clash && clash.id !== id) {
      throw new MasterDataServiceError(
        `A cost center with code ${normalized.code} already exists`,
        "DUPLICATE_CODE"
      );
    }

    const ownershipChanged =
      current.managerId !== normalized.managerId ||
      current.responsiblePersonId !== normalized.responsiblePersonId;
    if (ownershipChanged && (await this.hasActiveBudget(id))) {
      throw new MasterDataServiceError(
        "This cost center has an active budget — reassignment is blocked until it is approved, rejected, or the year closes",
        "HAS_ACTIVE_BUDGET"
      );
    }

    // Archiving is blocked while an active budget or assigned users depend on it.
    if (current.isActive && !normalized.isActive) {
      if (await this.hasActiveBudget(id)) {
        throw new MasterDataServiceError(
          "Cannot archive a cost center with an active budget",
          "HAS_ACTIVE_BUDGET"
        );
      }
      const assigned = (await this.users.getAll()).filter(
        (u) => u.active && u.primaryCostCenterId === id
      );
      if (assigned.length > 0) {
        throw new MasterDataServiceError(
          "Reassign the users whose primary cost center is this one before archiving",
          "IN_USE"
        );
      }
    }

    const next: CostCenter = { ...current, ...normalized };
    return this.uow.runInTransaction(async () => {
      const saved = await this.costCenters.update(next);
      await audit(
        this.audits,
        "CostCenter",
        saved.id,
        current.isActive && !normalized.isActive
          ? "CostCenterArchived"
          : ownershipChanged
            ? "CostCenterReassigned"
            : "CostCenterUpdated",
        actor,
        correlationId,
        current,
        saved
      );
      return saved;
    });
  }

  private async hasActiveBudget(costCenterId: string): Promise<boolean> {
    const all = await this.budgets.list();
    return all.some(
      (plan) =>
        plan.costCenterId === costCenterId &&
        ACTIVE_BUDGET_STATUSES.has(plan.status)
    );
  }

  private async normalizeAndValidate(
    input: CostCenterInput
  ): Promise<CostCenterInput> {
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    if (!code || !name) {
      throw new MasterDataServiceError("Name and code are required", "VALIDATION");
    }
    const department = await this.departments.getById(input.departmentId);
    if (!department) {
      throw new MasterDataServiceError(
        "Selected department does not exist",
        "INVALID_REFERENCE"
      );
    }
    if (!department.isActive) {
      throw new MasterDataServiceError(
        "Selected department is archived",
        "ARCHIVED"
      );
    }
    await this.assertActiveUser(input.managerId, "manager");
    await this.assertActiveUser(input.responsiblePersonId, "responsible person");
    return {
      code,
      name,
      sapCostCenterCode: input.sapCostCenterCode?.trim() || null,
      departmentId: input.departmentId,
      managerId: input.managerId || null,
      responsiblePersonId: input.responsiblePersonId || null,
      isActive: input.isActive,
    };
  }

  private async assertActiveUser(
    userId: string | null,
    label: string
  ): Promise<void> {
    if (!userId) return;
    const user = await this.users.getById(userId);
    if (!user || !user.active) {
      throw new MasterDataServiceError(
        `The selected ${label} is missing or inactive`,
        "INVALID_REFERENCE"
      );
    }
  }
}

export class SubmissionStatusService {
  constructor(
    private readonly submissionStatus: ISubmissionStatusRepository,
    private readonly costCenters: ICostCenterAdminRepository,
    private readonly fiscalYears: IFiscalYearRepository,
    private readonly authz: AuthorizationService
  ) {}

  /** Stored status for every active cost center in a year (NotStarted default). */
  async listForFiscalYear(
    actor: User,
    fiscalYearId: string
  ): Promise<CostCenterSubmissionStatus[]> {
    this.authz.assertPermission(actor, "admin.masterdata");
    const [stored, centers] = await Promise.all([
      this.submissionStatus.listByFiscalYear(fiscalYearId),
      this.costCenters.getAll(),
    ]);
    const byCenter = new Map(stored.map((s) => [s.costCenterId, s]));
    return centers
      .filter((cc) => cc.isActive)
      .map(
        (cc) =>
          byCenter.get(cc.id) ?? {
            costCenterId: cc.id,
            fiscalYearId,
            status: "NotStarted" as const,
            updatedAt: new Date().toISOString(),
          }
      );
  }

  async getCurrentYear() {
    return this.fiscalYears.getCurrent();
  }
}

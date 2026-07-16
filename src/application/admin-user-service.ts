import type {
  CostCenter,
  Department,
  Position,
  User,
} from "@/domain/entities";
import { newId } from "@/infrastructure/id";
import type {
  IAuditLogRepository,
  IBudgetPlanRepository,
  ICostCenterRepository,
  IDepartmentRepository,
  IUnitOfWork,
  IUserAdminRepository,
  RoleDefinition,
} from "@/infrastructure/repositories/interfaces";
import { AuthorizationService } from "./authorization-service";

export type AdminUserInput = {
  name: string;
  email: string;
  positionId: string;
  managerId: string | null;
  departmentId: string;
  primaryCostCenterId: string;
  roleCodes: string[];
  active: boolean;
};

export type AdminUserReferenceData = {
  users: User[];
  positions: Position[];
  departments: Department[];
  costCenters: CostCenter[];
  roles: RoleDefinition[];
};

export class AdminUserServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "DUPLICATE_EMAIL"
      | "INVALID_REFERENCE"
      | "INVALID_ROLE"
      | "INVALID_HIERARCHY"
      | "SELF_LOCKOUT"
      | "LAST_ADMIN"
      | "HAS_DIRECT_REPORTS"
      | "HAS_PENDING_APPROVALS"
      | "INACTIVE_USER"
      | "LAST_ROLE_HOLDER"
  ) {
    super(message);
    this.name = "AdminUserServiceError";
  }
}

export class AdminUserService {
  constructor(
    private readonly users: IUserAdminRepository,
    private readonly departments: IDepartmentRepository,
    private readonly costCenters: ICostCenterRepository,
    private readonly budgets: IBudgetPlanRepository,
    private readonly audits: IAuditLogRepository,
    private readonly authz: AuthorizationService,
    private readonly uow: IUnitOfWork
  ) {}

  async list(actor: User): Promise<AdminUserReferenceData> {
    this.authz.assertPermission(actor, "admin.users");
    const [users, positions, departments, costCenters, roles] =
      await Promise.all([
        this.users.getAll(),
        this.users.listPositions(),
        this.departments.getAll(),
        this.costCenters.getAll(),
        this.users.listRoles(),
      ]);
    return { users, positions, departments, costCenters, roles };
  }

  async create(
    input: AdminUserInput,
    passwordHash: string,
    actor: User,
    correlationId = newId()
  ): Promise<User> {
    this.authz.assertPermission(actor, "admin.users");
    const normalized = this.normalize(input);
    const allUsers = await this.users.getAll();
    await this.validate(normalized, undefined, allUsers);
    if (
      allUsers.some((user) => user.email.toLowerCase() === normalized.email)
    ) {
      throw new AdminUserServiceError(
        "A user with this email already exists",
        "DUPLICATE_EMAIL"
      );
    }

    const user: User = {
      id: newId(),
      ...normalized,
      permissionCodes: [],
    };
    return this.uow.runInTransaction(async () => {
      const saved = await this.users.create(user, passwordHash);
      await this.audit("UserCreated", saved.id, actor, correlationId, null, saved);
      return saved;
    });
  }

  async update(
    userId: string,
    input: AdminUserInput,
    actor: User,
    correlationId = newId()
  ): Promise<User> {
    this.authz.assertPermission(actor, "admin.users");
    const current = await this.users.getById(userId);
    if (!current) {
      throw new AdminUserServiceError("User not found", "NOT_FOUND");
    }
    const normalized = this.normalize(input);
    const allUsers = await this.users.getAll();
    await this.validate(normalized, userId, allUsers);
    const duplicate = allUsers.find(
      (user) =>
        user.email.toLowerCase() === normalized.email && user.id !== userId
    );
    if (duplicate) {
      throw new AdminUserServiceError(
        "A user with this email already exists",
        "DUPLICATE_EMAIL"
      );
    }

    if (
      userId === actor.id &&
      (!normalized.active || !normalized.roleCodes.includes("SystemAdmin"))
    ) {
      throw new AdminUserServiceError(
        "You cannot deactivate your own account or remove your System Administrator role",
        "SELF_LOCKOUT"
      );
    }
    if (
      current.roleCodes.includes("SystemAdmin") &&
      (!normalized.active || !normalized.roleCodes.includes("SystemAdmin"))
    ) {
      this.assertAnotherActiveWithRoleInList(
        allUsers,
        userId,
        "SystemAdmin",
        "At least one active System Administrator must remain",
        "LAST_ADMIN"
      );
    }
    if (
      current.roleCodes.includes("GeneralManager") &&
      (!normalized.active || !normalized.roleCodes.includes("GeneralManager"))
    ) {
      this.assertAnotherActiveWithRoleInList(
        allUsers,
        userId,
        "GeneralManager",
        "This is the only active General Manager. Assign another GM first.",
        "LAST_ROLE_HOLDER"
      );
    }
    if (
      current.roleCodes.includes("FinanceAdministrator") &&
      (!normalized.active ||
        !normalized.roleCodes.includes("FinanceAdministrator"))
    ) {
      this.assertAnotherActiveWithRoleInList(
        allUsers,
        userId,
        "FinanceAdministrator",
        "This is the only active Finance Administrator. Assign another Finance Administrator first.",
        "LAST_ROLE_HOLDER"
      );
    }
    if (current.active && !normalized.active) {
      const pendingApprovals = await this.budgets.listPendingForApprover(userId);
      if (pendingApprovals.length > 0) {
        throw new AdminUserServiceError(
          "Resolve or reassign this user's pending approvals before deactivating the account",
          "HAS_PENDING_APPROVALS"
        );
      }
      const hasDirectReports = allUsers.some(
        (user) => user.active && user.managerId === userId
      );
      if (hasDirectReports) {
        throw new AdminUserServiceError(
          "Reassign this user's active direct reports before deactivating the account",
          "HAS_DIRECT_REPORTS"
        );
      }
    }

    const next: User = {
      ...current,
      ...normalized,
      id: current.id,
    };
    return this.uow.runInTransaction(async () => {
      const saved = await this.users.update(next);
      const action =
        !current.active && normalized.active
          ? "UserActivated"
          : current.active && !normalized.active
            ? "UserDeactivated"
            : "UserUpdated";
      await this.audit(action, saved.id, actor, correlationId, current, saved);
      return saved;
    });
  }

  async activate(
    userId: string,
    actor: User,
    correlationId = newId()
  ): Promise<User> {
    this.authz.assertPermission(actor, "admin.users");
    const current = await this.users.getById(userId);
    if (!current) {
      throw new AdminUserServiceError("User not found", "NOT_FOUND");
    }
    if (current.active) {
      return current;
    }
    return this.update(
      userId,
      {
        name: current.name,
        email: current.email,
        positionId: current.positionId,
        managerId: current.managerId,
        departmentId: current.departmentId,
        primaryCostCenterId: current.primaryCostCenterId,
        roleCodes: current.roleCodes,
        active: true,
      },
      actor,
      correlationId
    );
  }

  async getDetail(
    userId: string,
    actor: User
  ): Promise<{
    user: User;
    audits: Awaited<ReturnType<IAuditLogRepository["list"]>>;
  }> {
    this.authz.assertPermission(actor, "admin.users");
    const user = await this.users.getById(userId);
    if (!user) {
      throw new AdminUserServiceError("User not found", "NOT_FOUND");
    }
    const audits = await this.audits.list({
      entity: "User",
      entityId: userId,
    });
    return { user, audits };
  }

  async resetPassword(
    userId: string,
    passwordHash: string,
    actor: User,
    correlationId = newId()
  ): Promise<void> {
    this.authz.assertPermission(actor, "admin.users");
    const target = await this.users.getById(userId);
    if (!target) {
      throw new AdminUserServiceError("User not found", "NOT_FOUND");
    }
    if (!target.active) {
      throw new AdminUserServiceError(
        "Reactivate the account before resetting its password",
        "INACTIVE_USER"
      );
    }
    await this.uow.runInTransaction(async () => {
      await this.users.setPasswordHash(userId, passwordHash);
        await this.audit(
        "UserPasswordReset",
        userId,
        actor,
        correlationId,
        null,
        { passwordChanged: true, permanent: true }
      );
    });
  }

  async deactivate(
    userId: string,
    actor: User,
    correlationId = newId()
  ): Promise<User> {
    this.authz.assertPermission(actor, "admin.users");
    const current = await this.users.getById(userId);
    if (!current) {
      throw new AdminUserServiceError("User not found", "NOT_FOUND");
    }
    return this.update(
      userId,
      {
        name: current.name,
        email: current.email,
        positionId: current.positionId,
        managerId: current.managerId,
        departmentId: current.departmentId,
        primaryCostCenterId: current.primaryCostCenterId,
        roleCodes: current.roleCodes,
        active: false,
      },
      actor,
      correlationId
    );
  }

  private normalize(input: AdminUserInput): AdminUserInput {
    return {
      ...input,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      managerId: input.managerId || null,
      roleCodes: Array.from(new Set(input.roleCodes)),
    };
  }

  private async validate(
    input: AdminUserInput,
    userId?: string,
    allUsers?: User[]
  ): Promise<void> {
    const [position, department, costCenter, roles] = await Promise.all([
      this.users.getPositionById(input.positionId),
      this.departments.getById(input.departmentId),
      this.costCenters.getById(input.primaryCostCenterId),
      this.users.listRoles(),
    ]);
    if (!position || !department || !costCenter || !costCenter.isActive) {
      throw new AdminUserServiceError(
        "Position, department, or active cost center is invalid",
        "INVALID_REFERENCE"
      );
    }
    if (costCenter.departmentId !== department.id) {
      throw new AdminUserServiceError(
        "The selected cost center does not belong to the selected department",
        "INVALID_REFERENCE"
      );
    }
    const validRoles = new Set(roles.map((role) => role.code));
    if (
      input.roleCodes.length === 0 ||
      input.roleCodes.some((role) => !validRoles.has(role))
    ) {
      throw new AdminUserServiceError(
        "Select at least one valid role",
        "INVALID_ROLE"
      );
    }
    const directory = allUsers ?? (await this.users.getAll());
    if (input.roleCodes.includes("GeneralManager")) {
      const otherGm = directory.find(
        (user) =>
          user.active &&
          user.roleCodes.includes("GeneralManager") &&
          user.id !== userId
      );
      if (otherGm) {
        throw new AdminUserServiceError(
          "Only one active General Manager is allowed. Reassign or deactivate the current GM first.",
          "LAST_ROLE_HOLDER"
        );
      }
    }
    if (!input.managerId) return;
    if (input.managerId === userId) {
      throw new AdminUserServiceError(
        "A user cannot manage themselves",
        "INVALID_HIERARCHY"
      );
    }
    const byId = new Map(directory.map((user) => [user.id, user]));
    let currentId: string | null = input.managerId;
    const visited = new Set<string>(userId ? [userId] : []);
    while (currentId) {
      if (visited.has(currentId)) {
        throw new AdminUserServiceError(
          "Manager assignment would create a circular reporting line",
          "INVALID_HIERARCHY"
        );
      }
      visited.add(currentId);
      const manager = byId.get(currentId);
      if (!manager || !manager.active) {
        throw new AdminUserServiceError(
          "The selected manager is missing or inactive",
          "INVALID_HIERARCHY"
        );
      }
      currentId = manager.managerId;
    }
  }

  private assertAnotherActiveWithRoleInList(
    users: User[],
    excludedUserId: string,
    roleCode: string,
    message: string,
    code: "LAST_ADMIN" | "LAST_ROLE_HOLDER"
  ): void {
    const another = users.some(
      (user) =>
        user.id !== excludedUserId &&
        user.active &&
        user.roleCodes.includes(roleCode)
    );
    if (!another) {
      throw new AdminUserServiceError(message, code);
    }
  }

  private async audit(
    action: string,
    entityId: string,
    actor: User,
    correlationId: string,
    before: unknown,
    after: unknown
  ): Promise<void> {
    await this.audits.append({
      id: newId(),
      entity: "User",
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
}

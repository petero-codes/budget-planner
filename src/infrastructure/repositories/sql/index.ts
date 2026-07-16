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
  Position,
  User,
} from "@/domain/entities";
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
import {
  mapAudit,
  mapBudgetLine,
  mapBudgetPlan,
  mapCostCenter,
  mapDepartment,
  mapFiscalYear,
  mapGlAccount,
  mapHistory,
  mapNotification,
  mapPosition,
  mapRouteStep,
  mapSubmissionStatus,
  mapUser,
} from "./mappers";
import { ConcurrencyConflictError } from "@/application/concurrency-error";
import { getPool, sql, txStorage, withRetryOnRequest, type TxContext } from "./pool";
import { sqlRequest } from "./request";
import { seedUuid } from "@/infrastructure/id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUniqueIdentifier(value: string): boolean {
  return UUID_RE.test(value);
}

/** AuditLogs columns are UNIQUEIDENTIFIER — coerce labels to stable UUIDs. */
function coerceUniqueIdentifier(value: string, scope: string): string {
  if (isUniqueIdentifier(value)) return value;
  return seedUuid(`sql-audit:${scope}:${value}`);
}

const req = sqlRequest;

function buildUserRoleMap(
  roles: { UserId: string; Code: string }[],
  perms: { UserId: string; Code: string }[]
): Map<string, { roleCodes: string[]; permissionCodes: string[] }> {
  const map = new Map<string, { roleCodes: string[]; permissionCodes: string[] }>();
  for (const row of roles) {
    const id = String(row.UserId);
    const entry = map.get(id) ?? { roleCodes: [], permissionCodes: [] };
    if (!entry.roleCodes.includes(row.Code)) entry.roleCodes.push(row.Code);
    map.set(id, entry);
  }
  for (const row of perms) {
    const id = String(row.UserId);
    const entry = map.get(id) ?? { roleCodes: [], permissionCodes: [] };
    if (!entry.permissionCodes.includes(row.Code)) {
      entry.permissionCodes.push(row.Code);
    }
    map.set(id, entry);
  }
  return map;
}

function mapUserBatch(result: {
  recordsets: unknown;
}): User | null {
  const recordsets = result.recordsets as [
    Record<string, unknown>[],
    { Code: string }[],
    { Code: string }[],
  ];
  const row = recordsets[0]?.[0];
  if (!row) return null;
  return mapUser(
    row,
    recordsets[1]?.map((x) => x.Code) ?? [],
    recordsets[2]?.map((x) => x.Code) ?? []
  );
}

export class SqlUserRepository implements IUserAdminRepository {
  async getById(id: string): Promise<User | null> {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, id);
    const result = await r.query(`
      SELECT * FROM dbo.Users
      WHERE UserId = @id AND IsDeleted = 0;

      SELECT ro.Code
      FROM dbo.UserRoles ur
      INNER JOIN dbo.Roles ro ON ro.RoleId = ur.RoleId
      WHERE ur.UserId = @id;

      SELECT DISTINCT p.Code
      FROM dbo.UserRoles ur
      INNER JOIN dbo.RolePermissions rp ON rp.RoleId = ur.RoleId
      INNER JOIN dbo.Permissions p ON p.PermissionId = rp.PermissionId
      WHERE ur.UserId = @id;
    `);
    return mapUserBatch(result);
  }

  async getAll(): Promise<User[]> {
    const result = await (await req()).query(`
      SELECT * FROM dbo.Users WHERE IsDeleted = 0 ORDER BY Name;

      SELECT ur.UserId, ro.Code
      FROM dbo.UserRoles ur
      INNER JOIN dbo.Roles ro ON ro.RoleId = ur.RoleId;

      SELECT DISTINCT ur.UserId, p.Code
      FROM dbo.UserRoles ur
      INNER JOIN dbo.RolePermissions rp ON rp.RoleId = ur.RoleId
      INNER JOIN dbo.Permissions p ON p.PermissionId = rp.PermissionId;
    `);
    const recordsets = result.recordsets as unknown as [
      Record<string, unknown>[],
      { UserId: string; Code: string }[],
      { UserId: string; Code: string }[],
    ];
    const roleMap = buildUserRoleMap(recordsets[1] ?? [], recordsets[2] ?? []);
    return (recordsets[0] ?? []).map((row) => {
      const id = String(row.UserId);
      const rp = roleMap.get(id) ?? { roleCodes: [], permissionCodes: [] };
      return mapUser(row, rp.roleCodes, rp.permissionCodes);
    });
  }

  async getByEmail(email: string): Promise<User | null> {
    const r = await req();
    r.input("email", sql.NVarChar(256), email.trim().toLowerCase());
    const result = await r.query(`
      SELECT * FROM dbo.Users
      WHERE LOWER(Email) = @email AND IsDeleted = 0;

      SELECT ro.Code
      FROM dbo.UserRoles ur
      INNER JOIN dbo.Roles ro ON ro.RoleId = ur.RoleId
      INNER JOIN dbo.Users u ON u.UserId = ur.UserId
      WHERE LOWER(u.Email) = @email AND u.IsDeleted = 0;

      SELECT DISTINCT p.Code
      FROM dbo.UserRoles ur
      INNER JOIN dbo.RolePermissions rp ON rp.RoleId = ur.RoleId
      INNER JOIN dbo.Permissions p ON p.PermissionId = rp.PermissionId
      INNER JOIN dbo.Users u ON u.UserId = ur.UserId
      WHERE LOWER(u.Email) = @email AND u.IsDeleted = 0;
    `);
    return mapUserBatch(result);
  }

  async getUsersByIdMap(): Promise<Map<string, User>> {
    const all = await this.getAll();
    return new Map(all.map((u) => [u.id, u]));
  }

  async getDescendantIds(userId: string): Promise<string[]> {
    const r = await req();
    r.input("userId", sql.UniqueIdentifier, userId);
    const result = await r.query<{ UserId: string }>(`
      ;WITH Descendants AS (
        SELECT UserId FROM dbo.Users WHERE ManagerId = @userId AND IsDeleted = 0
        UNION ALL
        SELECT u.UserId
        FROM dbo.Users u
        INNER JOIN Descendants d ON u.ManagerId = d.UserId
        WHERE u.IsDeleted = 0
      )
      SELECT UserId FROM Descendants
    `);
    return result.recordset.map((x) => String(x.UserId));
  }

  async getPositionById(id: string): Promise<Position | null> {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, id);
    const result = await r.query(
      `SELECT * FROM dbo.Positions WHERE PositionId = @id`
    );
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    return row ? mapPosition(row) : null;
  }

  async listPositions(): Promise<Position[]> {
    const result = await (await req()).query(
      `SELECT * FROM dbo.Positions ORDER BY Level, Title`
    );
    return (result.recordset as Record<string, unknown>[]).map(mapPosition);
  }

  async listRoles(): Promise<{ code: string; name: string }[]> {
    const result = await (await req()).query<{ Code: string; Name: string }>(
      `SELECT Code, Name FROM dbo.Roles ORDER BY Name`
    );
    return result.recordset.map((role) => ({
      code: role.Code,
      name: role.Name,
    }));
  }

  async create(user: User, passwordHash: string): Promise<User> {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, user.id);
    r.input("name", sql.NVarChar(200), user.name);
    r.input("email", sql.NVarChar(256), user.email);
    r.input("positionId", sql.UniqueIdentifier, user.positionId);
    r.input("managerId", sql.UniqueIdentifier, user.managerId);
    r.input("departmentId", sql.UniqueIdentifier, user.departmentId);
    r.input("costCenterId", sql.UniqueIdentifier, user.primaryCostCenterId);
    r.input("active", sql.Bit, user.active);
    r.input("passwordHash", sql.NVarChar(500), passwordHash);
    await r.query(`
      INSERT INTO dbo.Users (
        UserId, Name, Email, PositionId, ManagerId, DepartmentId,
        PrimaryCostCenterId, Active, IsDeleted, PasswordHash, EmailVerifiedAt
      ) VALUES (
        @id, @name, @email, @positionId, @managerId, @departmentId,
        @costCenterId, @active, 0, @passwordHash, SYSUTCDATETIME()
      )
    `);
    await this.replaceRoles(user.id, user.roleCodes);
    return (await this.getById(user.id))!;
  }

  async update(user: User): Promise<User> {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, user.id);
    r.input("name", sql.NVarChar(200), user.name);
    r.input("email", sql.NVarChar(256), user.email);
    r.input("positionId", sql.UniqueIdentifier, user.positionId);
    r.input("managerId", sql.UniqueIdentifier, user.managerId);
    r.input("departmentId", sql.UniqueIdentifier, user.departmentId);
    r.input("costCenterId", sql.UniqueIdentifier, user.primaryCostCenterId);
    r.input("active", sql.Bit, user.active);
    const result = await r.query(`
      UPDATE dbo.Users SET
        Name = @name,
        Email = @email,
        PositionId = @positionId,
        ManagerId = @managerId,
        DepartmentId = @departmentId,
        PrimaryCostCenterId = @costCenterId,
        Active = @active,
        UpdatedAt = SYSUTCDATETIME()
      WHERE UserId = @id AND IsDeleted = 0
    `);
    if ((result.rowsAffected[0] ?? 0) === 0) throw new Error("User not found");
    await this.replaceRoles(user.id, user.roleCodes);
    return (await this.getById(user.id))!;
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, userId);
    r.input("passwordHash", sql.NVarChar(500), passwordHash);
    const result = await r.query(`
      UPDATE dbo.Users SET
        PasswordHash = @passwordHash,
        EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSUTCDATETIME()),
        UpdatedAt = SYSUTCDATETIME()
      WHERE UserId = @id AND IsDeleted = 0
    `);
    if ((result.rowsAffected[0] ?? 0) === 0) throw new Error("User not found");
  }

  private async replaceRoles(userId: string, roleCodes: string[]): Promise<void> {
    const del = await req();
    del.input("userId", sql.UniqueIdentifier, userId);
    await del.query(`DELETE FROM dbo.UserRoles WHERE UserId = @userId`);
    if (roleCodes.length === 0) return;

    const insert = await req();
    insert.input("userId", sql.UniqueIdentifier, userId);
    roleCodes.forEach((code, index) =>
      insert.input(`role${index}`, sql.NVarChar(50), code)
    );
    const params = roleCodes.map((_, index) => `@role${index}`).join(", ");
    await insert.query(`
      INSERT INTO dbo.UserRoles (UserId, RoleId)
      SELECT @userId, RoleId
      FROM dbo.Roles
      WHERE Code IN (${params})
    `);
  }
}

export class SqlDepartmentRepository implements IDepartmentAdminRepository {
  async getById(id: string) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, id);
    const result = await r.query(`
      SELECT * FROM dbo.Departments WHERE DepartmentId = @id
    `);
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    return row ? mapDepartment(row) : null;
  }

  async getAll() {
    const result = await (await req()).query(`
      SELECT * FROM dbo.Departments ORDER BY Name
    `);
    return (result.recordset as Record<string, unknown>[]).map(mapDepartment);
  }

  async getByCode(code: string) {
    const r = await req();
    r.input("code", sql.NVarChar(50), code.trim());
    const result = await r.query(`
      SELECT * FROM dbo.Departments WHERE UPPER(Code) = UPPER(@code)
    `);
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    return row ? mapDepartment(row) : null;
  }

  async create(department: Department) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, department.id);
    r.input("name", sql.NVarChar(200), department.name);
    r.input("code", sql.NVarChar(50), department.code);
    r.input("active", sql.Bit, department.isActive);
    await r.query(`
      INSERT INTO dbo.Departments (DepartmentId, Name, Code, IsActive)
      VALUES (@id, @name, @code, @active)
    `);
    return (await this.getById(department.id))!;
  }

  async update(department: Department) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, department.id);
    r.input("name", sql.NVarChar(200), department.name);
    r.input("code", sql.NVarChar(50), department.code);
    r.input("active", sql.Bit, department.isActive);
    const result = await r.query(`
      UPDATE dbo.Departments SET
        Name = @name,
        Code = @code,
        IsActive = @active
      WHERE DepartmentId = @id
    `);
    if ((result.rowsAffected[0] ?? 0) === 0) {
      throw new Error("Department not found");
    }
    return (await this.getById(department.id))!;
  }
}

export class SqlCostCenterRepository implements ICostCenterAdminRepository {
  async getById(id: string) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, id);
    const result = await r.query(`
      SELECT * FROM dbo.CostCenters WHERE CostCenterId = @id AND IsDeleted = 0
    `);
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    return row ? mapCostCenter(row) : null;
  }

  async getAll() {
    const result = await (await req()).query(`
      SELECT * FROM dbo.CostCenters WHERE IsDeleted = 0 ORDER BY Code
    `);
    return (result.recordset as Record<string, unknown>[]).map(mapCostCenter);
  }

  async getByCode(code: string) {
    const r = await req();
    r.input("code", sql.NVarChar(50), code.trim());
    const result = await r.query(`
      SELECT * FROM dbo.CostCenters
      WHERE UPPER(Code) = UPPER(@code) AND IsDeleted = 0
    `);
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    return row ? mapCostCenter(row) : null;
  }

  async create(costCenter: CostCenter) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, costCenter.id);
    r.input("code", sql.NVarChar(50), costCenter.code);
    r.input("sap", sql.NVarChar(50), costCenter.sapCostCenterCode);
    r.input("name", sql.NVarChar(200), costCenter.name);
    r.input("dept", sql.UniqueIdentifier, costCenter.departmentId);
    r.input("manager", sql.UniqueIdentifier, costCenter.managerId);
    r.input("responsible", sql.UniqueIdentifier, costCenter.responsiblePersonId);
    r.input("active", sql.Bit, costCenter.isActive);
    await r.query(`
      INSERT INTO dbo.CostCenters (
        CostCenterId, Code, SapCostCenterCode, Name, DepartmentId,
        ManagerId, ResponsiblePersonId, IsActive, IsDeleted
      ) VALUES (
        @id, @code, @sap, @name, @dept,
        @manager, @responsible, @active, 0
      )
    `);
    return (await this.getById(costCenter.id))!;
  }

  async update(costCenter: CostCenter) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, costCenter.id);
    r.input("code", sql.NVarChar(50), costCenter.code);
    r.input("sap", sql.NVarChar(50), costCenter.sapCostCenterCode);
    r.input("name", sql.NVarChar(200), costCenter.name);
    r.input("dept", sql.UniqueIdentifier, costCenter.departmentId);
    r.input("manager", sql.UniqueIdentifier, costCenter.managerId);
    r.input("responsible", sql.UniqueIdentifier, costCenter.responsiblePersonId);
    r.input("active", sql.Bit, costCenter.isActive);
    const result = await r.query(`
      UPDATE dbo.CostCenters SET
        Code = @code,
        SapCostCenterCode = @sap,
        Name = @name,
        DepartmentId = @dept,
        ManagerId = @manager,
        ResponsiblePersonId = @responsible,
        IsActive = @active
      WHERE CostCenterId = @id AND IsDeleted = 0
    `);
    if ((result.rowsAffected[0] ?? 0) === 0) {
      throw new Error("Cost center not found");
    }
    return (await this.getById(costCenter.id))!;
  }
}

export class SqlSubmissionStatusRepository
  implements ISubmissionStatusRepository
{
  async get(costCenterId: string, fiscalYearId: string) {
    const r = await req();
    r.input("cc", sql.UniqueIdentifier, costCenterId);
    r.input("fy", sql.UniqueIdentifier, fiscalYearId);
    const result = await r.query(`
      SELECT * FROM dbo.CostCenterSubmissionStatus
      WHERE CostCenterId = @cc AND FiscalYearId = @fy
    `);
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    return row ? mapSubmissionStatus(row) : null;
  }

  async listByFiscalYear(fiscalYearId: string) {
    const r = await req();
    r.input("fy", sql.UniqueIdentifier, fiscalYearId);
    const result = await r.query(`
      SELECT * FROM dbo.CostCenterSubmissionStatus WHERE FiscalYearId = @fy
    `);
    return (result.recordset as Record<string, unknown>[]).map(
      mapSubmissionStatus
    );
  }

  async upsert(status: CostCenterSubmissionStatus) {
    const r = await req();
    r.input("cc", sql.UniqueIdentifier, status.costCenterId);
    r.input("fy", sql.UniqueIdentifier, status.fiscalYearId);
    r.input("status", sql.NVarChar(30), status.status);
    r.input("updatedAt", sql.DateTime2, status.updatedAt);
    await r.query(`
      MERGE dbo.CostCenterSubmissionStatus AS t
      USING (SELECT @cc AS CostCenterId, @fy AS FiscalYearId) AS s
        ON t.CostCenterId = s.CostCenterId AND t.FiscalYearId = s.FiscalYearId
      WHEN MATCHED THEN UPDATE SET Status = @status, UpdatedAt = @updatedAt
      WHEN NOT MATCHED THEN
        INSERT (CostCenterId, FiscalYearId, Status, UpdatedAt)
        VALUES (@cc, @fy, @status, @updatedAt);
    `);
    return (await this.get(status.costCenterId, status.fiscalYearId))!;
  }
}

export class SqlGlAccountRepository implements IGlAccountRepository {
  async getById(id: string) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, id);
    const result = await r.query(`
      SELECT * FROM dbo.GlAccounts WHERE GlAccountId = @id AND IsDeleted = 0
    `);
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    return row ? mapGlAccount(row) : null;
  }

  async getAll() {
    const result = await (await req()).query(`
      SELECT * FROM dbo.GlAccounts WHERE IsDeleted = 0 ORDER BY Code
    `);
    return (result.recordset as Record<string, unknown>[]).map(mapGlAccount);
  }

  async search(query: string) {
    const r = await req();
    r.input("q", sql.NVarChar(100), `%${query}%`);
    const result = await r.query(`
      SELECT * FROM dbo.GlAccounts
      WHERE IsDeleted = 0 AND IsActive = 1
        AND (Code LIKE @q OR Description LIKE @q)
      ORDER BY Code
    `);
    return (result.recordset as Record<string, unknown>[]).map(mapGlAccount);
  }
}

export class SqlFiscalYearRepository implements IFiscalYearRepository {
  async getById(id: string) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, id);
    const result = await r.query(`
      SELECT * FROM dbo.FiscalYears WHERE FiscalYearId = @id
    `);
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    return row ? mapFiscalYear(row) : null;
  }

  async getAll() {
    const result = await (await req()).query(`
      SELECT * FROM dbo.FiscalYears ORDER BY YearLabel DESC
    `);
    return (result.recordset as Record<string, unknown>[]).map(mapFiscalYear);
  }

  async getActive() {
    const result = await (await req()).query(`
      SELECT TOP 1 * FROM dbo.FiscalYears
      WHERE Status = N'Open' OR (Status IS NULL AND IsLocked = 0)
      ORDER BY YearLabel DESC
    `);
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    return row ? mapFiscalYear(row) : null;
  }

  async getCurrent() {
    const result = await (await req()).query(`
      SELECT TOP 1 * FROM dbo.FiscalYears
      WHERE IsCurrent = 1
      ORDER BY YearLabel DESC
    `);
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    return row ? mapFiscalYear(row) : null;
  }

  async save(fy: FiscalYear) {
    const existing = await this.getById(fy.id);
    const r = await req();
    r.input("id", sql.UniqueIdentifier, fy.id);
    r.input("year", sql.Int, fy.yearLabel);
    r.input("start", sql.Date, fy.startDate);
    r.input("end", sql.Date, fy.endDate);
    r.input("locked", sql.Bit, fy.status !== "Open");
    r.input("status", sql.NVarChar(20), fy.status);
    r.input("current", sql.Bit, fy.isCurrent);
    if (!existing) {
      await r.query(`
        INSERT INTO dbo.FiscalYears (FiscalYearId, YearLabel, StartDate, EndDate, IsLocked, Status, IsCurrent)
        VALUES (@id, @year, @start, @end, @locked, @status, @current)
      `);
    } else {
      await r.query(`
        UPDATE dbo.FiscalYears SET
          YearLabel = @year,
          StartDate = @start,
          EndDate = @end,
          IsLocked = @locked,
          Status = @status,
          IsCurrent = @current
        WHERE FiscalYearId = @id
      `);
    }
    return (await this.getById(fy.id))!;
  }
}

async function loadLines(budgetPlanId: string) {
  const r = await req();
  r.input("budgetPlanId", sql.UniqueIdentifier, budgetPlanId);
  const result = await r.query(`
    SELECT * FROM dbo.BudgetItems
    WHERE BudgetPlanId = @budgetPlanId
    ORDER BY LineNumber
  `);
  return (result.recordset as Record<string, unknown>[]).map(mapBudgetLine);
}

/** Load lines for many plans in one query — avoids N parallel connections. */
async function loadLinesForPlans(
  planIds: string[]
): Promise<Map<string, ReturnType<typeof mapBudgetLine>[]>> {
  const map = new Map<string, ReturnType<typeof mapBudgetLine>[]>();
  for (const id of planIds) map.set(id, []);
  if (planIds.length === 0) return map;

  const r = await req();
  // msnodesqlv8 reserves @p0, @p1, … internally — use distinct names.
  planIds.forEach((id, i) => {
    r.input(`planId${i}`, sql.UniqueIdentifier, id);
  });
  const placeholders = planIds.map((_, i) => `@planId${i}`).join(", ");
  const result = await r.query(`
    SELECT * FROM dbo.BudgetItems
    WHERE BudgetPlanId IN (${placeholders})
    ORDER BY BudgetPlanId, LineNumber
  `);
  for (const row of result.recordset as Record<string, unknown>[]) {
    const planId = String(row.BudgetPlanId);
    const list = map.get(planId) ?? [];
    list.push(mapBudgetLine(row));
    map.set(planId, list);
  }
  return map;
}

async function mapPlanRow(row: Record<string, unknown>): Promise<BudgetPlan> {
  const lines = await loadLines(String(row.BudgetPlanId));
  return mapBudgetPlan(row, lines);
}

async function mapPlanRows(
  rows: Record<string, unknown>[]
): Promise<BudgetPlan[]> {
  const ids = rows.map((row) => String(row.BudgetPlanId));
  const linesByPlan = await loadLinesForPlans(ids);
  return rows.map((row) =>
    mapBudgetPlan(row, linesByPlan.get(String(row.BudgetPlanId)) ?? [])
  );
}

export class SqlBudgetPlanRepository implements IBudgetPlanRepository {
  async getById(id: string) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, id);
    const result = await r.query(`SELECT * FROM dbo.BudgetPlans WHERE BudgetPlanId = @id`);
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    return row ? mapPlanRow(row) : null;
  }

  async list() {
    const result = await (await req()).query(`
      SELECT * FROM dbo.BudgetPlans ORDER BY UpdatedAt DESC
    `);
    return mapPlanRows(result.recordset as Record<string, unknown>[]);
  }

  async listByOwner(ownerId: string) {
    const r = await req();
    r.input("ownerId", sql.UniqueIdentifier, ownerId);
    const result = await r.query(`
      SELECT * FROM dbo.BudgetPlans WHERE OwnerId = @ownerId ORDER BY UpdatedAt DESC
    `);
    return mapPlanRows(result.recordset as Record<string, unknown>[]);
  }

  async listPendingForApprover(approverId: string) {
    const r = await req();
    r.input("approverId", sql.UniqueIdentifier, approverId);
    const result = await r.query(`
      SELECT * FROM dbo.BudgetPlans
      WHERE Status = N'InApproval' AND CurrentApproverId = @approverId
      ORDER BY UpdatedAt DESC
    `);
    return mapPlanRows(result.recordset as Record<string, unknown>[]);
  }

  async findActiveDuplicate(
    costCenterId: string,
    fiscalYearId: string,
    budgetType: string
  ) {
    const r = await req();
    r.input("costCenterId", sql.UniqueIdentifier, costCenterId);
    r.input("fiscalYearId", sql.UniqueIdentifier, fiscalYearId);
    r.input("budgetType", sql.NVarChar(50), budgetType);
    const result = await r.query(`
      SELECT TOP 1 * FROM dbo.BudgetPlans
      WHERE CostCenterId = @costCenterId
        AND FiscalYearId = @fiscalYearId
        AND BudgetType = @budgetType
        AND Status NOT IN (N'Rejected', N'Finalized', N'Approved')
        AND IsArchived = 0
    `);
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    return row ? mapPlanRow(row) : null;
  }

  async findActiveInLineage(lineageId: string) {
    const r = await req();
    r.input("lineageId", sql.UniqueIdentifier, lineageId);
    const result = await r.query(`
      SELECT TOP 1 * FROM dbo.BudgetPlans
      WHERE LineageId = @lineageId
        AND Status NOT IN (N'Rejected', N'Finalized', N'Approved')
        AND IsArchived = 0
    `);
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    return row ? mapPlanRow(row) : null;
  }

  async listByLineage(lineageId: string) {
    const r = await req();
    r.input("lineageId", sql.UniqueIdentifier, lineageId);
    const result = await r.query(`
      SELECT * FROM dbo.BudgetPlans
      WHERE LineageId = @lineageId AND IsArchived = 0
      ORDER BY LineageRevision
    `);
    return mapPlanRows(result.recordset as Record<string, unknown>[]);
  }

  async listPendingFinanceReview() {
    const result = await (await req()).query(`
      SELECT * FROM dbo.BudgetPlans
      WHERE Status = N'PendingFinanceReview' AND IsArchived = 0
      ORDER BY UpdatedAt DESC
    `);
    return mapPlanRows(result.recordset as Record<string, unknown>[]);
  }

  async listClaimed() {
    const result = await (await req()).query(`
      SELECT * FROM dbo.BudgetPlans
      WHERE Status = N'Claimed' AND IsArchived = 0
      ORDER BY UpdatedAt DESC
    `);
    return mapPlanRows(result.recordset as Record<string, unknown>[]);
  }

  async listFinalizedSince(since: string) {
    const r = await req();
    r.input("since", sql.DateTime2, since);
    const result = await r.query(`
      SELECT * FROM dbo.BudgetPlans
      WHERE Status IN (N'Finalized', N'Approved')
        AND UpdatedAt >= @since AND IsArchived = 0
      ORDER BY UpdatedAt DESC
    `);
    return mapPlanRows(result.recordset as Record<string, unknown>[]);
  }

  async listLatestFinalizedVersions() {
    const result = await (await req()).query(`
      WITH Ranked AS (
        SELECT *, ROW_NUMBER() OVER (
          PARTITION BY LineageId ORDER BY LineageRevision DESC
        ) AS rn
        FROM dbo.BudgetPlans
        WHERE Status IN (N'Finalized', N'Approved')
          AND LineageId IS NOT NULL AND IsArchived = 0
      )
      SELECT * FROM Ranked WHERE rn = 1
    `);
    return mapPlanRows(result.recordset as Record<string, unknown>[]);
  }

  async search(query: string) {
    const r = await req();
    r.input("q", sql.NVarChar(200), `%${query.trim()}%`);
    const result = await r.query(`
      SELECT bp.* FROM dbo.BudgetPlans bp
      LEFT JOIN dbo.BudgetLineage bl ON bl.LineageId = bp.LineageId
      LEFT JOIN dbo.CostCenters cc ON cc.CostCenterId = bp.CostCenterId
      LEFT JOIN dbo.Departments d ON d.DepartmentId = cc.DepartmentId
      LEFT JOIN dbo.Users u ON u.UserId = bp.OwnerId
      LEFT JOIN dbo.FiscalYears fy ON fy.FiscalYearId = bp.FiscalYearId
      WHERE bp.IsArchived = 0 AND (
        bp.VersionLabel LIKE @q OR bl.BudgetNumber LIKE @q
        OR cc.Code LIKE @q OR cc.Name LIKE @q
        OR d.Name LIKE @q OR u.Name LIKE @q
        OR CAST(fy.YearLabel AS NVARCHAR(10)) LIKE @q
        OR bp.BudgetType LIKE @q OR bp.Status LIKE @q
        OR bp.SapVersion LIKE @q
      )
      ORDER BY bp.UpdatedAt DESC
    `);
    return mapPlanRows(result.recordset as Record<string, unknown>[]);
  }

  async save(plan: BudgetPlan) {
    const existing = await this.getById(plan.id);
    const r = await req();
    r.input("id", sql.UniqueIdentifier, plan.id);
    r.input("ownerId", sql.UniqueIdentifier, plan.ownerId);
    r.input("costCenterId", sql.UniqueIdentifier, plan.costCenterId);
    r.input("fiscalYearId", sql.UniqueIdentifier, plan.fiscalYearId);
    r.input("budgetType", sql.NVarChar(50), plan.budgetType);
    r.input("fromPeriod", sql.Date, plan.fromPeriod);
    r.input("toPeriod", sql.Date, plan.toPeriod);
    r.input("description", sql.NVarChar(1000), plan.description);
    r.input("status", sql.NVarChar(30), plan.status);
    r.input("currentApproverId", sql.UniqueIdentifier, plan.currentApproverId);
    r.input("submittedAt", sql.DateTime2, plan.submittedAt);
    r.input("sapVersion", sql.NVarChar(20), plan.sapVersion);
    r.input("updatedAt", sql.DateTime2, plan.updatedAt);
    r.input("lineageId", sql.UniqueIdentifier, plan.lineageId);
    r.input("parentId", sql.UniqueIdentifier, plan.parentBudgetPlanId);
    r.input("lineageRevision", sql.Int, plan.lineageRevision);
    r.input("versionLabel", sql.NVarChar(60), plan.versionLabel);
    r.input("amendmentReason", sql.NVarChar(1000), plan.amendmentReason);
    r.input("isArchived", sql.Bit, plan.isArchived);
    r.input("claimDueAt", sql.DateTime2, plan.claimDueAt);
    r.input("reviewDueAt", sql.DateTime2, plan.reviewDueAt);
    r.input("escalationStatus", sql.NVarChar(20), plan.escalationStatus);
    r.input("financeClaimedAt", sql.DateTime2, plan.financeClaimedAt);
    r.input("financeClaimedBy", sql.UniqueIdentifier, plan.financeClaimedBy);
    r.input("isDemo", sql.Bit, plan.isDemo ?? false);
    r.input("createdByToolkit", sql.Bit, plan.createdByToolkit ?? false);
    r.input("demoBatchId", sql.UniqueIdentifier, plan.demoBatchId);

    if (!existing) {
      r.input("version", sql.Int, plan.version);
      r.input("createdAt", sql.DateTime2, plan.createdAt);
      await r.query(`
        INSERT INTO dbo.BudgetPlans (
          BudgetPlanId, OwnerId, CostCenterId, FiscalYearId, BudgetType,
          FromPeriod, ToPeriod, Description, Status, CurrentApproverId, SubmittedAt,
          SapVersion, Version, CreatedAt, UpdatedAt,
          LineageId, ParentBudgetPlanId, LineageRevision, VersionLabel, AmendmentReason,
          IsArchived, ClaimDueAt, ReviewDueAt, EscalationStatus,
          FinanceClaimedAt, FinanceClaimedBy,
          IsDemo, CreatedByToolkit, DemoBatchId
        ) VALUES (
          @id, @ownerId, @costCenterId, @fiscalYearId, @budgetType,
          @fromPeriod, @toPeriod, @description, @status, @currentApproverId, @submittedAt,
          @sapVersion, @version, @createdAt, @updatedAt,
          @lineageId, @parentId, @lineageRevision, @versionLabel, @amendmentReason,
          @isArchived, @claimDueAt, @reviewDueAt, @escalationStatus,
          @financeClaimedAt, @financeClaimedBy,
          @isDemo, @createdByToolkit, @demoBatchId
        )
      `);
    } else {
      // Optimistic concurrency: expected version is the in-memory value as loaded.
      // Increment happens only in SQL (SET Version = Version + 1).
      r.input("expectedVersion", sql.Int, plan.version);
      const result = await r.query(`
        UPDATE dbo.BudgetPlans SET
          OwnerId = @ownerId,
          CostCenterId = @costCenterId,
          FiscalYearId = @fiscalYearId,
          BudgetType = @budgetType,
          FromPeriod = @fromPeriod,
          ToPeriod = @toPeriod,
          Description = @description,
          Status = @status,
          CurrentApproverId = @currentApproverId,
          SubmittedAt = @submittedAt,
          SapVersion = @sapVersion,
          Version = Version + 1,
          UpdatedAt = @updatedAt,
          LineageId = @lineageId,
          ParentBudgetPlanId = @parentId,
          LineageRevision = @lineageRevision,
          VersionLabel = @versionLabel,
          AmendmentReason = @amendmentReason,
          IsArchived = @isArchived,
          ClaimDueAt = @claimDueAt,
          ReviewDueAt = @reviewDueAt,
          EscalationStatus = @escalationStatus,
          FinanceClaimedAt = @financeClaimedAt,
          FinanceClaimedBy = @financeClaimedBy,
          IsDemo = @isDemo,
          CreatedByToolkit = @createdByToolkit,
          DemoBatchId = @demoBatchId
        WHERE BudgetPlanId = @id AND Version = @expectedVersion
      `);
      if ((result.rowsAffected[0] ?? 0) === 0) {
        throw new ConcurrencyConflictError();
      }
      const del = await req();
      del.input("id", sql.UniqueIdentifier, plan.id);
      await del.query(`DELETE FROM dbo.BudgetItems WHERE BudgetPlanId = @id`);
    }

    for (const line of plan.lines) {
      const lr = await req();
      lr.input("lineId", sql.UniqueIdentifier, line.id);
      lr.input("planId", sql.UniqueIdentifier, plan.id);
      lr.input("glId", sql.UniqueIdentifier, line.glAccountId);
      lr.input("amount", sql.Decimal(18, 2), line.amount);
      lr.input("lineNumber", sql.Int, line.lineNumber);
      await lr.query(`
        INSERT INTO dbo.BudgetItems (BudgetItemId, BudgetPlanId, GlAccountId, Amount, LineNumber)
        VALUES (@lineId, @planId, @glId, @amount, @lineNumber)
      `);
    }

    return (await this.getById(plan.id))!;
  }
}

export class SqlApprovalRouteRepository implements IApprovalRouteRepository {
  async listByBudgetId(budgetPlanId: string) {
    const r = await req();
    r.input("budgetPlanId", sql.UniqueIdentifier, budgetPlanId);
    const result = await r.query(`
      SELECT * FROM dbo.ApprovalRoute
      WHERE BudgetPlanId = @budgetPlanId
      ORDER BY Sequence
    `);
    return (result.recordset as Record<string, unknown>[]).map(mapRouteStep);
  }

  async replaceForBudget(budgetPlanId: string, steps: ApprovalRouteStep[]) {
    const del = await req();
    del.input("budgetPlanId", sql.UniqueIdentifier, budgetPlanId);
    await del.query(`DELETE FROM dbo.ApprovalRoute WHERE BudgetPlanId = @budgetPlanId`);
    for (const step of steps) {
      await this.saveStep(step);
    }
  }

  async saveStep(step: ApprovalRouteStep) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, step.id);
    r.input("budgetPlanId", sql.UniqueIdentifier, step.budgetPlanId);
    r.input("approverId", sql.UniqueIdentifier, step.approverId);
    r.input("sequence", sql.Int, step.sequence);
    r.input("status", sql.NVarChar(30), step.status);
    await r.query(`
      MERGE dbo.ApprovalRoute AS t
      USING (SELECT @id AS RouteId) AS s ON t.RouteId = s.RouteId
      WHEN MATCHED THEN UPDATE SET
        BudgetPlanId = @budgetPlanId,
        ApproverId = @approverId,
        Sequence = @sequence,
        Status = @status
      WHEN NOT MATCHED THEN INSERT (RouteId, BudgetPlanId, ApproverId, Sequence, Status)
        VALUES (@id, @budgetPlanId, @approverId, @sequence, @status);
    `);
  }
}

export class SqlApprovalHistoryRepository implements IApprovalHistoryRepository {
  async append(entry: ApprovalHistoryEntry) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, entry.id);
    r.input("budgetPlanId", sql.UniqueIdentifier, entry.budgetPlanId);
    r.input("performedBy", sql.UniqueIdentifier, entry.performedBy);
    r.input("action", sql.NVarChar(50), entry.action);
    r.input("previousStatus", sql.NVarChar(30), entry.previousStatus);
    r.input("newStatus", sql.NVarChar(30), entry.newStatus);
    r.input("comment", sql.NVarChar(1000), entry.comment);
    r.input("timestamp", sql.DateTime2, entry.timestamp);
    await r.query(`
      INSERT INTO dbo.ApprovalHistory (
        ApprovalHistoryId, BudgetPlanId, PerformedBy, Action,
        PreviousStatus, NewStatus, Comment, [Timestamp]
      ) VALUES (
        @id, @budgetPlanId, @performedBy, @action,
        @previousStatus, @newStatus, @comment, @timestamp
      )
    `);
  }

  async listByBudgetId(budgetPlanId: string) {
    const r = await req();
    r.input("budgetPlanId", sql.UniqueIdentifier, budgetPlanId);
    const result = await r.query(`
      SELECT * FROM dbo.ApprovalHistory
      WHERE BudgetPlanId = @budgetPlanId
      ORDER BY [Timestamp]
    `);
    return (result.recordset as Record<string, unknown>[]).map(mapHistory);
  }
}

export class SqlAuditLogRepository implements IAuditLogRepository {
  async append(entry: AuditLogEntry) {
    const r = await req();
    const entityId = coerceUniqueIdentifier(entry.entityId, "entityId");
    const correlationId = coerceUniqueIdentifier(
      entry.correlationId,
      "correlationId"
    );
    const id = coerceUniqueIdentifier(entry.id, "auditLogId");
    const performedBy = coerceUniqueIdentifier(entry.performedBy, "performedBy");
    r.input("id", sql.UniqueIdentifier, id);
    r.input("entity", sql.NVarChar(100), entry.entity);
    r.input("entityId", sql.UniqueIdentifier, entityId);
    r.input("action", sql.NVarChar(100), entry.action);
    r.input("performedBy", sql.UniqueIdentifier, performedBy);
    r.input("ipAddress", sql.NVarChar(64), entry.ipAddress);
    r.input("correlationId", sql.UniqueIdentifier, correlationId);
    r.input("beforeJson", sql.NVarChar(sql.MAX), entry.beforeJson);
    r.input("afterJson", sql.NVarChar(sql.MAX), entry.afterJson);
    r.input("timestamp", sql.DateTime2, entry.timestamp);
    await r.query(`
      INSERT INTO dbo.AuditLogs (
        AuditLogId, Entity, EntityId, Action, PerformedBy,
        IpAddress, CorrelationId, BeforeJson, AfterJson, [Timestamp]
      ) VALUES (
        @id, @entity, @entityId, @action, @performedBy,
        @ipAddress, @correlationId, @beforeJson, @afterJson, @timestamp
      )
    `);
  }

  async list(filters?: { entity?: string; entityId?: string }) {
    const r = await req();
    r.input("entity", sql.NVarChar(100), filters?.entity ?? null);
    const entityIdFilter =
      filters?.entityId && isUniqueIdentifier(filters.entityId)
        ? filters.entityId
        : null;
    r.input("entityId", sql.UniqueIdentifier, entityIdFilter);
    const result = await r.query(`
      SELECT * FROM dbo.AuditLogs
      WHERE (@entity IS NULL OR Entity = @entity)
        AND (@entityId IS NULL OR EntityId = @entityId)
      ORDER BY [Timestamp] DESC
    `);
    return (result.recordset as Record<string, unknown>[]).map(mapAudit);
  }
}

export class SqlNotificationRepository implements INotificationRepository {
  async create(notification: Notification) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, notification.id);
    r.input("userId", sql.UniqueIdentifier, notification.userId);
    r.input("type", sql.NVarChar(50), notification.type);
    r.input("title", sql.NVarChar(200), notification.title);
    r.input("body", sql.NVarChar(1000), notification.body);
    r.input("relatedPlanId", sql.UniqueIdentifier, notification.relatedPlanId);
    r.input("isRead", sql.Bit, notification.isRead);
    r.input("createdAt", sql.DateTime2, notification.createdAt);
    r.input("isCleared", sql.Bit, notification.isCleared ?? false);
    r.input("clearedAt", sql.DateTime2, notification.clearedAt ?? null);
    r.input("clearedReason", sql.NVarChar(500), notification.clearedReason ?? null);
    await r.query(`
      INSERT INTO dbo.Notifications (
        NotificationId, UserId, Type, Title, Body,
        RelatedBudgetPlanId, IsRead, CreatedAt,
        IsCleared, ClearedAt, ClearedReason
      ) VALUES (
        @id, @userId, @type, @title, @body,
        @relatedPlanId, @isRead, @createdAt,
        @isCleared, @clearedAt, @clearedReason
      )
    `);
  }

  async listByUser(userId: string) {
    const r = await req();
    r.input("userId", sql.UniqueIdentifier, userId);
    const result = await r.query(`
      SELECT * FROM dbo.Notifications
      WHERE UserId = @userId
        AND ISNULL(IsCleared, 0) = 0
      ORDER BY CreatedAt DESC
    `);
    return (result.recordset as Record<string, unknown>[]).map(mapNotification);
  }

  async markRead(id: string) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, id);
    await r.query(`UPDATE dbo.Notifications SET IsRead = 1 WHERE NotificationId = @id`);
  }

  async dismiss(id: string, userId: string) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, id);
    r.input("userId", sql.UniqueIdentifier, userId);
    r.input("clearedAt", sql.DateTime2, new Date().toISOString());
    await r.query(`
      UPDATE dbo.Notifications
      SET IsCleared = 1, ClearedAt = @clearedAt, ClearedReason = N'Dismissed'
      WHERE NotificationId = @id AND UserId = @userId
    `);
  }

  async dismissForPlan(
    planId: string,
    options?: { userId?: string; types?: string[] }
  ) {
    const r = await req();
    r.input("planId", sql.UniqueIdentifier, planId);
    r.input("userId", sql.UniqueIdentifier, options?.userId ?? null);
    r.input("clearedAt", sql.DateTime2, new Date().toISOString());
    if (options?.types?.length) {
      const placeholders = options.types.map((_, i) => `@t${i}`).join(", ");
      options.types.forEach((t, i) => r.input(`t${i}`, sql.NVarChar(50), t));
      await r.query(`
        UPDATE dbo.Notifications
        SET IsCleared = 1, ClearedAt = @clearedAt, ClearedReason = N'Plan cleared'
        WHERE RelatedBudgetPlanId = @planId
          AND (@userId IS NULL OR UserId = @userId)
          AND Type IN (${placeholders})
          AND ISNULL(IsCleared, 0) = 0
      `);
    } else {
      await r.query(`
        UPDATE dbo.Notifications
        SET IsCleared = 1, ClearedAt = @clearedAt, ClearedReason = N'Plan cleared'
        WHERE RelatedBudgetPlanId = @planId
          AND (@userId IS NULL OR UserId = @userId)
          AND ISNULL(IsCleared, 0) = 0
      `);
    }
  }

  async softClear(options: {
    userId?: string;
    reason: string;
    clearedAt: string;
  }) {
    const r = await req();
    r.input("userId", sql.UniqueIdentifier, options.userId ?? null);
    r.input("reason", sql.NVarChar(500), options.reason);
    r.input("clearedAt", sql.DateTime2, options.clearedAt);
    const result = await r.query(`
      UPDATE dbo.Notifications
      SET IsCleared = 1, ClearedAt = @clearedAt, ClearedReason = @reason
      WHERE ISNULL(IsCleared, 0) = 0
        AND (@userId IS NULL OR UserId = @userId)
    `);
    return result.rowsAffected[0] ?? 0;
  }
}

export class SqlUnitOfWork implements IUnitOfWork {
  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    // Nested call in the same async context: reuse the active transaction.
    if (txStorage.getStore()) return fn();

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    const ctx: TxContext = { transaction, chain: Promise.resolve() };
    try {
      const result = await txStorage.run(ctx, fn);
      await transaction.commit();
      return result;
    } catch (e) {
      try {
        await transaction.rollback();
      } catch {
        /* ignore */
      }
      throw e;
    }
  }
}

export async function getPositionById(id: string): Promise<Position | null> {
  const r = await req();
  r.input("id", sql.UniqueIdentifier, id);
  const result = await r.query(`SELECT * FROM dbo.Positions WHERE PositionId = @id`);
  const row = result.recordset[0] as Record<string, unknown> | undefined;
  return row ? mapPosition(row) : null;
}

export const SQL_REPOSITORY_STATUS = "Implemented: mssql + BudgetOperations";

export {
  SqlBudgetLineageRepository,
  SqlWorkflowHistoryRepository,
  SqlFinanceClaimRepository,
  SqlBudgetAttachmentRepository,
  SqlBudgetAttachmentCategoryRepository,
  SqlSapPackageRepository,
} from "./lineage-repos";

export { SqlSupportIssueRepository } from "./support-issue-repo";

/**
 * Server-side auth store backed by SQL Server (dbo.Users + dbo.AuthTokens).
 * All account data lives in the database — no in-memory user lists.
 */
import type { User } from "@/domain/entities";
import { newId } from "@/infrastructure/id";
import { getPool, sql } from "@/infrastructure/repositories/sql/pool";
import { mapUser } from "@/infrastructure/repositories/sql/mappers";

export type AuthTokenType = "verify-email" | "reset-password";

async function request() {
  const pool = await getPool();
  return pool.request();
}

export interface AuthUserRecord {
  user: User;
  passwordHash: string | null;
  emailVerifiedAt: string | null;
}

export async function findAuthUserByEmail(
  email: string
): Promise<AuthUserRecord | null> {
  const r = await request();
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
  const recordsets = result.recordsets as unknown as [
    Record<string, unknown>[],
    { Code: string }[],
    { Code: string }[],
  ];
  const row = recordsets[0]?.[0];
  if (!row) return null;
  const roleCodes = recordsets[1]?.map((x) => x.Code) ?? [];
  const permissionCodes = recordsets[2]?.map((x) => x.Code) ?? [];
  return {
    user: mapUser(row, roleCodes, permissionCodes),
    passwordHash: row.PasswordHash ? String(row.PasswordHash) : null,
    emailVerifiedAt: row.EmailVerifiedAt
      ? new Date(String(row.EmailVerifiedAt)).toISOString()
      : null,
  };
}

export async function createAccount(input: {
  name: string;
  email: string;
  passwordHash: string;
  costCenterId: string;
}): Promise<User> {
  const pool = await getPool();

  // Defaults for self-registered staff: Assistant position, ICT department, submitter role.
  const meta = await pool.request().query<{
    PositionId: string;
    DepartmentId: string;
    RoleId: string;
  }>(`
    SELECT
      (SELECT TOP 1 PositionId FROM dbo.Positions WHERE PositionCode = N'ASST') AS PositionId,
      (SELECT TOP 1 DepartmentId FROM dbo.Departments WHERE Code = N'ICT') AS DepartmentId,
      (SELECT TOP 1 RoleId FROM dbo.Roles WHERE Code = N'BudgetSubmitter') AS RoleId
  `);
  const row = meta.recordset[0];
  if (!row?.PositionId || !row.DepartmentId || !row.RoleId) {
    throw new Error("Reference data missing — run npm run db:seed first");
  }

  const userId = newId();
  const insert = pool.request();
  insert.input("id", sql.UniqueIdentifier, userId);
  insert.input("name", sql.NVarChar(200), input.name.trim());
  insert.input("email", sql.NVarChar(256), input.email.trim().toLowerCase());
  insert.input("positionId", sql.UniqueIdentifier, row.PositionId);
  insert.input("deptId", sql.UniqueIdentifier, row.DepartmentId);
  insert.input("ccId", sql.UniqueIdentifier, input.costCenterId);
  insert.input("passwordHash", sql.NVarChar(500), input.passwordHash);
  await insert.query(`
    INSERT INTO dbo.Users (
      UserId, Name, Email, PositionId, ManagerId, DepartmentId,
      PrimaryCostCenterId, Active, IsDeleted, PasswordHash
    ) VALUES (
      @id, @name, @email, @positionId, NULL, @deptId,
      @ccId, 1, 0, @passwordHash
    )
  `);

  const role = pool.request();
  role.input("userId", sql.UniqueIdentifier, userId);
  role.input("roleId", sql.UniqueIdentifier, row.RoleId);
  await role.query(
    `INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@userId, @roleId)`
  );

  const created = await findAuthUserByEmail(input.email);
  if (!created) throw new Error("Account creation failed");
  return created.user;
}

export async function setPassword(
  userId: string,
  passwordHash: string
): Promise<void> {
  const r = await request();
  r.input("id", sql.UniqueIdentifier, userId);
  r.input("hash", sql.NVarChar(500), passwordHash);
  await r.query(
    `UPDATE dbo.Users SET PasswordHash = @hash, UpdatedAt = SYSUTCDATETIME() WHERE UserId = @id`
  );
}

export async function markEmailVerified(userId: string): Promise<void> {
  const r = await request();
  r.input("id", sql.UniqueIdentifier, userId);
  await r.query(
    `UPDATE dbo.Users SET EmailVerifiedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME() WHERE UserId = @id`
  );
}

export async function storeToken(input: {
  userId: string;
  type: AuthTokenType;
  tokenHash: string;
  expiresAt: Date;
}): Promise<void> {
  // Invalidate previous tokens of this type before issuing a new one.
  const clear = await request();
  clear.input("userId", sql.UniqueIdentifier, input.userId);
  clear.input("type", sql.NVarChar(30), input.type);
  await clear.query(`
    UPDATE dbo.AuthTokens SET UsedAt = SYSUTCDATETIME()
    WHERE UserId = @userId AND Type = @type AND UsedAt IS NULL
  `);

  const r = await request();
  r.input("id", sql.UniqueIdentifier, newId());
  r.input("userId", sql.UniqueIdentifier, input.userId);
  r.input("type", sql.NVarChar(30), input.type);
  r.input("hash", sql.NVarChar(128), input.tokenHash);
  r.input("expiresAt", sql.DateTime2, input.expiresAt.toISOString());
  await r.query(`
    INSERT INTO dbo.AuthTokens (AuthTokenId, UserId, Type, TokenHash, ExpiresAt)
    VALUES (@id, @userId, @type, @hash, @expiresAt)
  `);
}

export async function consumeToken(input: {
  type: AuthTokenType;
  tokenHash: string;
}): Promise<{ userId: string } | null> {
  const r = await request();
  r.input("type", sql.NVarChar(30), input.type);
  r.input("hash", sql.NVarChar(128), input.tokenHash);
  const result = await r.query<{ AuthTokenId: string; UserId: string }>(`
    SELECT TOP 1 AuthTokenId, UserId FROM dbo.AuthTokens
    WHERE Type = @type AND TokenHash = @hash
      AND UsedAt IS NULL AND ExpiresAt > SYSUTCDATETIME()
  `);
  const row = result.recordset[0];
  if (!row) return null;

  const mark = await request();
  mark.input("id", sql.UniqueIdentifier, row.AuthTokenId);
  await mark.query(
    `UPDATE dbo.AuthTokens SET UsedAt = SYSUTCDATETIME() WHERE AuthTokenId = @id`
  );
  return { userId: String(row.UserId) };
}

export async function listActiveCostCenters(): Promise<
  { id: string; code: string; name: string }[]
> {
  const result = await (await request()).query<{
    CostCenterId: string;
    Code: string;
    Name: string;
  }>(`
    SELECT CostCenterId, Code, Name FROM dbo.CostCenters
    WHERE IsActive = 1 AND IsDeleted = 0 ORDER BY Code
  `);
  return result.recordset.map((r) => ({
    id: String(r.CostCenterId),
    code: r.Code,
    name: r.Name,
  }));
}

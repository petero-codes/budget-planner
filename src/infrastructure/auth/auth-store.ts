/**
 * Server-side auth lookup backed by SQL Server (dbo.Users).
 * Account provisioning is admin-only — no self-registration or token flows here.
 */

import "server-only";

import type { User } from "@/domain/entities";
import { getPool, sql } from "@/infrastructure/repositories/sql/pool";
import { mapUser } from "@/infrastructure/repositories/sql/mappers";

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

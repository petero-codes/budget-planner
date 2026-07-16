/**
 * Seeds BudgetOperations from the TypeScript mock seed (deterministic UUIDs).
 * Usage: npm run db:seed
 */
import sql from "mssql/msnodesqlv8";
import {
  costCenters,
  departments,
  fiscalYears,
  glAccounts,
  positions,
  users,
} from "../src/infrastructure/repositories/mock/seed";

const connectionString = [
  "Driver={ODBC Driver 17 for SQL Server}",
  "Server=localhost\\SQLEXPRESS",
  "Database=BudgetOperations",
  "Trusted_Connection=Yes",
  "TrustServerCertificate=Yes",
].join(";");

const roleDefs = [
  { code: "BudgetSubmitter", name: "Budget Submitter" },
  { code: "BudgetApprover", name: "Budget Approver" },
  { code: "GeneralManager", name: "General Manager" },
  { code: "SystemAdmin", name: "System Administrator" },
  { code: "FinanceAdministrator", name: "Finance Administrator" },
  { code: "AuditViewer", name: "Audit Viewer" },
] as const;

const permissionDefs = [
  { code: "budget.create", name: "Create budget" },
  { code: "budget.submit", name: "Submit budget" },
  { code: "budget.approve", name: "Approve budget" },
  { code: "budget.reject", name: "Reject budget" },
  { code: "report.view", name: "View reports" },
  { code: "report.export", name: "Export reports" },
  { code: "audit.view", name: "View audit" },
  { code: "admin.users", name: "Administer users" },
  { code: "admin.masterdata", name: "Manage organizational master data" },
  { code: "fy.manage", name: "Manage financial years" },
  { code: "finance.view", name: "Finance historical access" },
] as const;

const rolePermissions: Record<string, string[]> = {
  BudgetSubmitter: ["budget.create", "budget.submit"],
  BudgetApprover: [
    "budget.create",
    "budget.submit",
    "budget.approve",
    "report.view",
  ],
  GeneralManager: ["budget.reject"],
  SystemAdmin: ["admin.users", "admin.masterdata", "audit.view", "fy.manage"],
  FinanceAdministrator: [
    "finance.view",
    "report.view",
    "report.export",
    "audit.view",
    "fy.manage",
  ],
  AuditViewer: ["audit.view"],
};

async function ensureSchemaExtras(pool: sql.ConnectionPool) {
  await pool.request().batch(`
    IF COL_LENGTH('dbo.BudgetPlans', 'Version') IS NULL
      ALTER TABLE dbo.BudgetPlans ADD Version INT NOT NULL
        CONSTRAINT DF_BudgetPlans_Version DEFAULT (1);
    IF COL_LENGTH('dbo.FiscalYears', 'Status') IS NULL
      ALTER TABLE dbo.FiscalYears ADD Status NVARCHAR(20) NOT NULL
        CONSTRAINT DF_FiscalYears_Status DEFAULT (N'Open');
    IF COL_LENGTH('dbo.FiscalYears', 'IsCurrent') IS NULL
      ALTER TABLE dbo.FiscalYears ADD IsCurrent BIT NOT NULL
        CONSTRAINT DF_FiscalYears_IsCurrent DEFAULT (0);
    IF COL_LENGTH('dbo.CostCenters', 'ManagerId') IS NULL
      ALTER TABLE dbo.CostCenters ADD ManagerId UNIQUEIDENTIFIER NULL;
    IF COL_LENGTH('dbo.CostCenters', 'ResponsiblePersonId') IS NULL
      ALTER TABLE dbo.CostCenters ADD ResponsiblePersonId UNIQUEIDENTIFIER NULL;
    IF COL_LENGTH('dbo.Departments', 'IsActive') IS NULL
      ALTER TABLE dbo.Departments ADD IsActive BIT NOT NULL
        CONSTRAINT DF_Departments_IsActive DEFAULT (1);
  `);
  await pool.request().batch(`
    IF OBJECT_ID('dbo.CostCenterSubmissionStatus', 'U') IS NULL
      CREATE TABLE dbo.CostCenterSubmissionStatus (
        CostCenterId UNIQUEIDENTIFIER NOT NULL,
        FiscalYearId UNIQUEIDENTIFIER NOT NULL,
        Status NVARCHAR(30) NOT NULL CONSTRAINT DF_CCSubStatus_Status DEFAULT (N'NotStarted'),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_CCSubStatus_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_CCSubStatus PRIMARY KEY (CostCenterId, FiscalYearId)
      );
  `);
}

function seedUuidId(id: string) {
  return id;
}

async function main() {
  const pool = await new sql.ConnectionPool({
    connectionString,
  } as unknown as sql.config).connect();
  console.log("Connected. Ensuring schema extras…");
  await ensureSchemaExtras(pool);

  const tx = new sql.Transaction(pool);
  await tx.begin();
  const req = () => new sql.Request(tx);

  try {
    console.log("Clearing transactional + reference data…");
    await req().query(`
      DISABLE TRIGGER dbo.TR_AuditLogs_NoUpdateDelete ON dbo.AuditLogs;
      DISABLE TRIGGER dbo.TR_ApprovalHistory_NoUpdateDelete ON dbo.ApprovalHistory;
      DELETE FROM dbo.Notifications;
      DELETE FROM dbo.AuditLogs;
      DELETE FROM dbo.ApprovalHistory;
      DELETE FROM dbo.ApprovalRoute;
      DELETE FROM dbo.CostCenterSubmissionStatus;
      DELETE FROM dbo.BudgetItems;
      DELETE FROM dbo.BudgetPlans;
      DELETE FROM dbo.AuthTokens;
      DELETE FROM dbo.UserRoles;
      DELETE FROM dbo.RolePermissions;
      DELETE FROM dbo.Users;
      DELETE FROM dbo.Roles;
      DELETE FROM dbo.Permissions;
      DELETE FROM dbo.GlAccounts;
      DELETE FROM dbo.FiscalYears;
      DELETE FROM dbo.CostCenters;
      DELETE FROM dbo.Positions;
      DELETE FROM dbo.Departments;
      ENABLE TRIGGER dbo.TR_AuditLogs_NoUpdateDelete ON dbo.AuditLogs;
      ENABLE TRIGGER dbo.TR_ApprovalHistory_NoUpdateDelete ON dbo.ApprovalHistory;
    `);

    for (const d of departments) {
      const r = req();
      r.input("id", sql.UniqueIdentifier, seedUuidId(d.id));
      r.input("name", sql.NVarChar(200), d.name);
      r.input("code", sql.NVarChar(50), d.code);
      r.input("active", sql.Bit, d.isActive);
      await r.query(
        `INSERT INTO dbo.Departments (DepartmentId, Name, Code, IsActive) VALUES (@id, @name, @code, @active)`
      );
    }

    for (const p of positions) {
      const r = req();
      r.input("id", sql.UniqueIdentifier, p.id);
      r.input("title", sql.NVarChar(200), p.title);
      r.input("code", sql.NVarChar(50), p.positionCode);
      r.input("level", sql.Int, p.level);
      await r.query(
        `INSERT INTO dbo.Positions (PositionId, Title, PositionCode, Level) VALUES (@id, @title, @code, @level)`
      );
    }

    for (const c of costCenters) {
      const r = req();
      r.input("id", sql.UniqueIdentifier, c.id);
      r.input("code", sql.NVarChar(50), c.code);
      r.input("sap", sql.NVarChar(50), c.sapCostCenterCode);
      r.input("name", sql.NVarChar(200), c.name);
      r.input("dept", sql.UniqueIdentifier, c.departmentId);
      r.input("active", sql.Bit, c.isActive);
      await r.query(`
        INSERT INTO dbo.CostCenters
          (CostCenterId, Code, SapCostCenterCode, Name, DepartmentId, IsActive, IsDeleted, ManagerId)
        VALUES (@id, @code, @sap, @name, @dept, @active, 0, NULL)
      `);
    }

    const roleIds = new Map<string, string>();
    for (const role of roleDefs) {
      const id = crypto.randomUUID();
      roleIds.set(role.code, id);
      const r = req();
      r.input("id", sql.UniqueIdentifier, id);
      r.input("code", sql.NVarChar(50), role.code);
      r.input("name", sql.NVarChar(100), role.name);
      await r.query(
        `INSERT INTO dbo.Roles (RoleId, Code, Name) VALUES (@id, @code, @name)`
      );
    }

    const permIds = new Map<string, string>();
    for (const perm of permissionDefs) {
      const id = crypto.randomUUID();
      permIds.set(perm.code, id);
      const r = req();
      r.input("id", sql.UniqueIdentifier, id);
      r.input("code", sql.NVarChar(100), perm.code);
      r.input("name", sql.NVarChar(200), perm.name);
      await r.query(
        `INSERT INTO dbo.Permissions (PermissionId, Code, Name) VALUES (@id, @code, @name)`
      );
    }

    for (const [roleCode, perms] of Object.entries(rolePermissions)) {
      for (const pCode of perms) {
        const r = req();
        r.input("roleId", sql.UniqueIdentifier, roleIds.get(roleCode)!);
        r.input("permId", sql.UniqueIdentifier, permIds.get(pCode)!);
        await r.query(
          `INSERT INTO dbo.RolePermissions (RoleId, PermissionId) VALUES (@roleId, @permId)`
        );
      }
    }

    // Insert users without manager first, then set managers
    for (const u of users) {
      const r = req();
      r.input("id", sql.UniqueIdentifier, u.id);
      r.input("name", sql.NVarChar(200), u.name);
      r.input("email", sql.NVarChar(256), u.email);
      r.input("positionId", sql.UniqueIdentifier, u.positionId);
      r.input("managerId", sql.UniqueIdentifier, null);
      r.input("deptId", sql.UniqueIdentifier, u.departmentId);
      r.input("ccId", sql.UniqueIdentifier, u.primaryCostCenterId);
      r.input("active", sql.Bit, u.active);
      await r.query(`
        INSERT INTO dbo.Users (
          UserId, Name, Email, PositionId, ManagerId, DepartmentId,
          PrimaryCostCenterId, Active, IsDeleted
        ) VALUES (
          @id, @name, @email, @positionId, @managerId, @deptId,
          @ccId, @active, 0
        )
      `);

      for (const roleCode of u.roleCodes) {
        const rr = req();
        rr.input("userId", sql.UniqueIdentifier, u.id);
        rr.input("roleId", sql.UniqueIdentifier, roleIds.get(roleCode)!);
        await rr.query(
          `INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@userId, @roleId)`
        );
      }

      if (
        u.permissionCodes.includes("audit.view") &&
        !u.roleCodes.includes("SystemAdmin") &&
        !u.roleCodes.includes("FinanceAdministrator")
      ) {
        const rr = req();
        rr.input("userId", sql.UniqueIdentifier, u.id);
        rr.input("roleId", sql.UniqueIdentifier, roleIds.get("AuditViewer")!);
        await rr.query(
          `INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@userId, @roleId)`
        );
      }
    }

    for (const u of users) {
      if (!u.managerId) continue;
      const r = req();
      r.input("id", sql.UniqueIdentifier, u.id);
      r.input("managerId", sql.UniqueIdentifier, u.managerId);
      await r.query(`UPDATE dbo.Users SET ManagerId = @managerId WHERE UserId = @id`);
    }

    for (const c of costCenters) {
      const r = req();
      r.input("id", sql.UniqueIdentifier, c.id);
      r.input("managerId", sql.UniqueIdentifier, c.managerId);
      r.input("responsibleId", sql.UniqueIdentifier, c.responsiblePersonId);
      await r.query(
        `UPDATE dbo.CostCenters SET ManagerId = @managerId, ResponsiblePersonId = @responsibleId WHERE CostCenterId = @id`
      );
    }

    for (const fy of fiscalYears) {
      const r = req();
      r.input("id", sql.UniqueIdentifier, fy.id);
      r.input("year", sql.Int, fy.yearLabel);
      r.input("start", sql.Date, fy.startDate);
      r.input("end", sql.Date, fy.endDate);
      r.input("locked", sql.Bit, fy.isLocked);
      r.input("status", sql.NVarChar(20), fy.status);
      r.input("current", sql.Bit, fy.isCurrent);
      await r.query(`
        INSERT INTO dbo.FiscalYears (FiscalYearId, YearLabel, StartDate, EndDate, IsLocked, Status, IsCurrent)
        VALUES (@id, @year, @start, @end, @locked, @status, @current)
      `);
    }

    for (const g of glAccounts) {
      const r = req();
      r.input("id", sql.UniqueIdentifier, g.id);
      r.input("code", sql.NVarChar(20), g.code);
      r.input("desc", sql.NVarChar(300), g.description);
      r.input("active", sql.Bit, g.isActive);
      await r.query(`
        INSERT INTO dbo.GlAccounts (GlAccountId, Code, Description, IsActive, IsDeleted)
        VALUES (@id, @code, @desc, @active, 0)
      `);
    }

    await tx.commit();
    console.log(
      `Seeded: ${departments.length} depts, ${positions.length} positions, ${costCenters.length} CCs, ${users.length} users, ${glAccounts.length} GLs, ${fiscalYears.length} FYs.`
    );
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    await pool.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

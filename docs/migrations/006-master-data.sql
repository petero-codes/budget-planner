-- Organizational master data: cost-center ownership, financial-year currency,
-- and stored per-(CostCenter, FiscalYear) submission status.
-- Idempotent; safe to re-run.

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

USE [BudgetOperations];
GO

-- 1) Departments become archivable.
IF COL_LENGTH('dbo.Departments', 'IsActive') IS NULL
  ALTER TABLE dbo.Departments ADD IsActive BIT NOT NULL
    CONSTRAINT DF_Departments_IsActive DEFAULT (1);
GO

-- 2) Cost centers gain a Primary Responsible Person (Budget Holder / submitter),
--    distinct from the approving ManagerId.
IF COL_LENGTH('dbo.CostCenters', 'ResponsiblePersonId') IS NULL
  ALTER TABLE dbo.CostCenters ADD ResponsiblePersonId UNIQUEIDENTIFIER NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_CostCenters_ResponsiblePerson'
)
  ALTER TABLE dbo.CostCenters ADD CONSTRAINT FK_CostCenters_ResponsiblePerson
    FOREIGN KEY (ResponsiblePersonId) REFERENCES dbo.Users(UserId);
GO

-- 3) Financial years gain an explicit "current" flag (drives dashboards/pickers).
IF COL_LENGTH('dbo.FiscalYears', 'IsCurrent') IS NULL
  ALTER TABLE dbo.FiscalYears ADD IsCurrent BIT NOT NULL
    CONSTRAINT DF_FiscalYears_IsCurrent DEFAULT (0);
GO

-- Enforce: at most one OPEN year and at most one CURRENT year.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_FiscalYears_OneOpen' AND object_id = OBJECT_ID(N'dbo.FiscalYears'))
  CREATE UNIQUE INDEX UX_FiscalYears_OneOpen
    ON dbo.FiscalYears(Status) WHERE Status = N'Open';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_FiscalYears_OneCurrent' AND object_id = OBJECT_ID(N'dbo.FiscalYears'))
  CREATE UNIQUE INDEX UX_FiscalYears_OneCurrent
    ON dbo.FiscalYears(IsCurrent) WHERE IsCurrent = 1;
GO

-- Seed a current year if none set: prefer the (single) Open year, else newest.
IF NOT EXISTS (SELECT 1 FROM dbo.FiscalYears WHERE IsCurrent = 1)
BEGIN
  UPDATE dbo.FiscalYears
  SET IsCurrent = 1
  WHERE FiscalYearId = (
    SELECT TOP 1 FiscalYearId FROM dbo.FiscalYears
    ORDER BY CASE WHEN Status = N'Open' THEN 0 ELSE 1 END, YearLabel DESC
  );
END
GO

-- 4) Stored submission status per (CostCenter, FiscalYear).
IF OBJECT_ID('dbo.CostCenterSubmissionStatus', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CostCenterSubmissionStatus (
    CostCenterId UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT FK_CCSubStatus_CostCenter REFERENCES dbo.CostCenters(CostCenterId),
    FiscalYearId UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT FK_CCSubStatus_FiscalYear REFERENCES dbo.FiscalYears(FiscalYearId),
    Status NVARCHAR(30) NOT NULL CONSTRAINT DF_CCSubStatus_Status DEFAULT (N'NotStarted'),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_CCSubStatus_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_CCSubStatus PRIMARY KEY (CostCenterId, FiscalYearId)
  );
END
GO

-- 5) New permission: manage organizational master data.
IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE Code = N'admin.masterdata')
  INSERT INTO dbo.Permissions (PermissionId, Code, Name)
  VALUES (NEWID(), N'admin.masterdata', N'Manage organizational master data');
GO

IF NOT EXISTS (
  SELECT 1
  FROM dbo.RolePermissions rp
  JOIN dbo.Roles r ON r.RoleId = rp.RoleId
  JOIN dbo.Permissions p ON p.PermissionId = rp.PermissionId
  WHERE r.Code = N'SystemAdmin' AND p.Code = N'admin.masterdata'
)
  INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
  SELECT r.RoleId, p.PermissionId
  FROM dbo.Roles r, dbo.Permissions p
  WHERE r.Code = N'SystemAdmin' AND p.Code = N'admin.masterdata';
GO

-- Grant DML on the new table to the least-privilege app role (if present).
IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'app_budget_ops_role' AND type = 'R')
  GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.CostCenterSubmissionStatus TO [app_budget_ops_role];
GO

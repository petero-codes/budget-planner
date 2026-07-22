-- KenGen ICT Budget Operations — SQL Server schema
-- Phase 0b: run after Phase 1 mock validation
-- Tip: run with QUOTED_IDENTIFIER ON (SSMS default, or sqlcmd -I)

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.Departments', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Departments (
    DepartmentId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Departments PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    Name NVARCHAR(200) NOT NULL,
    Code NVARCHAR(50) NOT NULL CONSTRAINT UQ_Departments_Code UNIQUE,
    IsActive BIT NOT NULL CONSTRAINT DF_Departments_IsActive DEFAULT (1)
  );
END
GO

IF OBJECT_ID('dbo.Positions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Positions (
    PositionId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Positions PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    Title NVARCHAR(200) NOT NULL,
    PositionCode NVARCHAR(50) NOT NULL CONSTRAINT UQ_Positions_Code UNIQUE,
    Level INT NOT NULL
  );
END
GO

IF OBJECT_ID('dbo.CostCenters', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CostCenters (
    CostCenterId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CostCenters PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    Code NVARCHAR(50) NOT NULL CONSTRAINT UQ_CostCenters_Code UNIQUE,
    SapCostCenterCode NVARCHAR(50) NULL,
    Name NVARCHAR(200) NOT NULL,
    DepartmentId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_CostCenters_Department REFERENCES dbo.Departments(DepartmentId),
    IsActive BIT NOT NULL CONSTRAINT DF_CostCenters_IsActive DEFAULT (1),
    ManagerId UNIQUEIDENTIFIER NULL,
    -- Primary Responsible Person (Budget Holder / submitter) — distinct from ManagerId (approver).
    -- FK to dbo.Users added after Users table exists (see migration 006 for existing DBs).
    ResponsiblePersonId UNIQUEIDENTIFIER NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_CostCenters_IsDeleted DEFAULT (0),
    DeletedAt DATETIME2 NULL
  );
END
GO

IF OBJECT_ID('dbo.Users', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Users (
    UserId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Users PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    Name NVARCHAR(200) NOT NULL,
    Email NVARCHAR(256) NOT NULL CONSTRAINT UQ_Users_Email UNIQUE,
    PositionId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_Users_Position REFERENCES dbo.Positions(PositionId),
    ManagerId UNIQUEIDENTIFIER NULL CONSTRAINT FK_Users_Manager REFERENCES dbo.Users(UserId),
    DepartmentId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_Users_Department REFERENCES dbo.Departments(DepartmentId),
    PrimaryCostCenterId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_Users_CostCenter REFERENCES dbo.CostCenters(CostCenterId),
    Active BIT NOT NULL CONSTRAINT DF_Users_Active DEFAULT (1),
    IsDeleted BIT NOT NULL CONSTRAINT DF_Users_IsDeleted DEFAULT (0),
    DeletedAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT (SYSUTCDATETIME())
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Users_ManagerId' AND object_id = OBJECT_ID(N'dbo.Users'))
  CREATE INDEX IX_Users_ManagerId ON dbo.Users(ManagerId);
GO

IF OBJECT_ID('dbo.Roles', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Roles (
    RoleId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Roles PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    Code NVARCHAR(50) NOT NULL CONSTRAINT UQ_Roles_Code UNIQUE,
    Name NVARCHAR(100) NOT NULL
  );
END
GO

IF OBJECT_ID('dbo.Permissions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Permissions (
    PermissionId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Permissions PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    Code NVARCHAR(100) NOT NULL CONSTRAINT UQ_Permissions_Code UNIQUE,
    Name NVARCHAR(200) NOT NULL
  );
END
GO

IF OBJECT_ID('dbo.RolePermissions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.RolePermissions (
    RoleId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_RolePermissions_Role REFERENCES dbo.Roles(RoleId),
    PermissionId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_RolePermissions_Permission REFERENCES dbo.Permissions(PermissionId),
    CONSTRAINT PK_RolePermissions PRIMARY KEY (RoleId, PermissionId)
  );
END
GO

IF OBJECT_ID('dbo.UserRoles', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.UserRoles (
    UserId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_UserRoles_User REFERENCES dbo.Users(UserId),
    RoleId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_UserRoles_Role REFERENCES dbo.Roles(RoleId),
    CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId)
  );
END
GO

IF OBJECT_ID('dbo.GlAccounts', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.GlAccounts (
    GlAccountId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_GlAccounts PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    Code NVARCHAR(20) NOT NULL CONSTRAINT UQ_GlAccounts_Code UNIQUE,
    Description NVARCHAR(300) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_GlAccounts_IsActive DEFAULT (1),
    IsDeleted BIT NOT NULL CONSTRAINT DF_GlAccounts_IsDeleted DEFAULT (0),
    DeletedAt DATETIME2 NULL
  );
END
GO

IF OBJECT_ID('dbo.FiscalYears', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.FiscalYears (
    FiscalYearId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_FiscalYears PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    YearLabel INT NOT NULL CONSTRAINT UQ_FiscalYears_YearLabel UNIQUE,
    StartDate DATE NOT NULL,
    EndDate DATE NOT NULL,
    IsLocked BIT NOT NULL CONSTRAINT DF_FiscalYears_IsLocked DEFAULT (0),
    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_FiscalYears_Status DEFAULT (N'Open'),
    IsCurrent BIT NOT NULL CONSTRAINT DF_FiscalYears_IsCurrent DEFAULT (0)
  );
END
GO

-- Enforce at most one OPEN and at most one CURRENT financial year.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_FiscalYears_OneOpen' AND object_id = OBJECT_ID(N'dbo.FiscalYears'))
  CREATE UNIQUE INDEX UX_FiscalYears_OneOpen
    ON dbo.FiscalYears(Status) WHERE Status = N'Open';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_FiscalYears_OneCurrent' AND object_id = OBJECT_ID(N'dbo.FiscalYears'))
  CREATE UNIQUE INDEX UX_FiscalYears_OneCurrent
    ON dbo.FiscalYears(IsCurrent) WHERE IsCurrent = 1;
GO

IF OBJECT_ID('dbo.BudgetPlans', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.BudgetPlans (
    BudgetPlanId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_BudgetPlans PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    OwnerId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_BudgetPlans_Owner REFERENCES dbo.Users(UserId),
    CostCenterId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_BudgetPlans_CostCenter REFERENCES dbo.CostCenters(CostCenterId),
    FiscalYearId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_BudgetPlans_FiscalYear REFERENCES dbo.FiscalYears(FiscalYearId),
    BudgetType NVARCHAR(50) NOT NULL,
    FromPeriod DATE NOT NULL,
    ToPeriod DATE NOT NULL,
    Description NVARCHAR(1000) NULL,
    Status NVARCHAR(30) NOT NULL,
    CurrentApproverId UNIQUEIDENTIFIER NULL CONSTRAINT FK_BudgetPlans_CurrentApprover REFERENCES dbo.Users(UserId),
    SubmittedAt DATETIME2 NULL,
    SapVersion NVARCHAR(20) NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_BudgetPlans_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_BudgetPlans_UpdatedAt DEFAULT (SYSUTCDATETIME()),
  RowVersion ROWVERSION NOT NULL,
  Version INT NOT NULL CONSTRAINT DF_BudgetPlans_Version DEFAULT (1)
);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_BudgetPlans_Status_CostCenter' AND object_id = OBJECT_ID(N'dbo.BudgetPlans'))
  CREATE INDEX IX_BudgetPlans_Status_CostCenter ON dbo.BudgetPlans(Status, CostCenterId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_BudgetPlans_CurrentApproverId' AND object_id = OBJECT_ID(N'dbo.BudgetPlans'))
  CREATE INDEX IX_BudgetPlans_CurrentApproverId ON dbo.BudgetPlans(CurrentApproverId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_BudgetPlans_FiscalYear_Status' AND object_id = OBJECT_ID(N'dbo.BudgetPlans'))
  CREATE INDEX IX_BudgetPlans_FiscalYear_Status ON dbo.BudgetPlans(FiscalYearId, Status);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_BudgetPlans_ActiveUnique' AND object_id = OBJECT_ID(N'dbo.BudgetPlans'))
  -- Filtered unique: at most one "in play" plan per (CostCenter, FiscalYear, BudgetType).
  -- Participating statuses: Draft, InApproval, ReturnedForRevision (anything except Rejected/Approved).
  -- Does NOT block a new Draft after an Approved or Rejected plan for the same key
  -- (whether that should be blocked is an open product decision — see open-decisions / Bucket 2 #11).
  CREATE UNIQUE INDEX UX_BudgetPlans_ActiveUnique
    ON dbo.BudgetPlans(CostCenterId, FiscalYearId, BudgetType)
    WHERE [Status] <> N'Rejected' AND [Status] <> N'Approved';
GO

IF OBJECT_ID('dbo.BudgetItems', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.BudgetItems (
    BudgetItemId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_BudgetItems PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    BudgetPlanId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_BudgetItems_Plan REFERENCES dbo.BudgetPlans(BudgetPlanId) ON DELETE CASCADE,
    GlAccountId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_BudgetItems_Gl REFERENCES dbo.GlAccounts(GlAccountId),
    Amount DECIMAL(18,2) NOT NULL CONSTRAINT CK_BudgetItems_Amount CHECK (Amount > 0),
    LineNumber INT NOT NULL,
    CONSTRAINT UQ_BudgetItems_Plan_Line UNIQUE (BudgetPlanId, LineNumber)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_BudgetItems_BudgetPlanId' AND object_id = OBJECT_ID(N'dbo.BudgetItems'))
  CREATE INDEX IX_BudgetItems_BudgetPlanId ON dbo.BudgetItems(BudgetPlanId);
GO

IF OBJECT_ID('dbo.ApprovalRoute', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ApprovalRoute (
    RouteId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ApprovalRoute PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    BudgetPlanId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_ApprovalRoute_Plan REFERENCES dbo.BudgetPlans(BudgetPlanId),
    ApproverId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_ApprovalRoute_Approver REFERENCES dbo.Users(UserId),
    Sequence INT NOT NULL,
    Status NVARCHAR(30) NOT NULL,
    CONSTRAINT UQ_ApprovalRoute_Plan_Sequence UNIQUE (BudgetPlanId, Sequence)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ApprovalRoute_BudgetPlanId_Sequence' AND object_id = OBJECT_ID(N'dbo.ApprovalRoute'))
  CREATE INDEX IX_ApprovalRoute_BudgetPlanId_Sequence ON dbo.ApprovalRoute(BudgetPlanId, Sequence);
GO

IF OBJECT_ID('dbo.ApprovalHistory', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ApprovalHistory (
    ApprovalHistoryId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ApprovalHistory PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    BudgetPlanId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_ApprovalHistory_Plan REFERENCES dbo.BudgetPlans(BudgetPlanId),
    PerformedBy UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_ApprovalHistory_User REFERENCES dbo.Users(UserId),
    Action NVARCHAR(50) NOT NULL,
    PreviousStatus NVARCHAR(30) NOT NULL,
    NewStatus NVARCHAR(30) NOT NULL,
    Comment NVARCHAR(1000) NULL,
    [Timestamp] DATETIME2 NOT NULL CONSTRAINT DF_ApprovalHistory_Timestamp DEFAULT (SYSUTCDATETIME())
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ApprovalHistory_BudgetPlanId_Timestamp' AND object_id = OBJECT_ID(N'dbo.ApprovalHistory'))
  CREATE INDEX IX_ApprovalHistory_BudgetPlanId_Timestamp ON dbo.ApprovalHistory(BudgetPlanId, [Timestamp]);
GO

IF OBJECT_ID('dbo.AuditLogs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.AuditLogs (
    AuditLogId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_AuditLogs PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    Entity NVARCHAR(100) NOT NULL,
    EntityId UNIQUEIDENTIFIER NOT NULL,
    Action NVARCHAR(100) NOT NULL,
    PerformedBy UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_AuditLogs_User REFERENCES dbo.Users(UserId),
    IpAddress NVARCHAR(64) NULL,
    CorrelationId UNIQUEIDENTIFIER NOT NULL,
    BeforeJson NVARCHAR(MAX) NULL,
    AfterJson NVARCHAR(MAX) NULL,
    [Timestamp] DATETIME2 NOT NULL CONSTRAINT DF_AuditLogs_Timestamp DEFAULT (SYSUTCDATETIME())
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AuditLogs_CreatedAt' AND object_id = OBJECT_ID(N'dbo.AuditLogs'))
  CREATE INDEX IX_AuditLogs_CreatedAt ON dbo.AuditLogs([Timestamp] DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AuditLogs_Entity' AND object_id = OBJECT_ID(N'dbo.AuditLogs'))
  CREATE INDEX IX_AuditLogs_Entity ON dbo.AuditLogs(Entity, EntityId);
GO

IF OBJECT_ID('dbo.Notifications', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Notifications (
    NotificationId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Notifications PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    UserId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_Notifications_User REFERENCES dbo.Users(UserId),
    Type NVARCHAR(50) NOT NULL,
    Title NVARCHAR(200) NOT NULL,
    Body NVARCHAR(1000) NOT NULL,
    Priority NVARCHAR(20) NOT NULL CONSTRAINT DF_Notifications_Priority DEFAULT (N'Medium'),
    Category NVARCHAR(30) NOT NULL CONSTRAINT DF_Notifications_Category DEFAULT (N'Budget'),
    ActionLabel NVARCHAR(100) NOT NULL CONSTRAINT DF_Notifications_ActionLabel DEFAULT (N'View'),
    RelatedBudgetPlanId UNIQUEIDENTIFIER NULL,
    -- Task-oriented model: the business entity the notification represents,
    -- the route it navigates to, and read/resolution timestamps.
    EntityType NVARCHAR(30) NULL,
    EntityId NVARCHAR(100) NULL,
    TargetUrl NVARCHAR(400) NULL,
    IsRead BIT NOT NULL CONSTRAINT DF_Notifications_IsRead DEFAULT (0),
    ReadAt DATETIME2 NULL,
    ResolvedAt DATETIME2 NULL,
    ResolvedBy UNIQUEIDENTIFIER NULL
      CONSTRAINT FK_Notifications_ResolvedBy REFERENCES dbo.Users(UserId),
    ExpiresAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT (SYSUTCDATETIME())
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Notifications_UserId_IsRead' AND object_id = OBJECT_ID(N'dbo.Notifications'))
  CREATE INDEX IX_Notifications_UserId_IsRead ON dbo.Notifications(UserId, IsRead);
GO

-- Active-notification lookups (badge + active list) filter on the resolution state.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Notifications_UserId_Resolved' AND object_id = OBJECT_ID(N'dbo.Notifications'))
  CREATE INDEX IX_Notifications_UserId_Resolved ON dbo.Notifications(UserId, ResolvedAt);
GO

-- Schema version tracking (applied migrations).
IF OBJECT_ID('dbo.SchemaVersion', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.SchemaVersion (
    Version NVARCHAR(20) NOT NULL CONSTRAINT PK_SchemaVersion PRIMARY KEY,
    AppliedAt DATETIME2 NOT NULL CONSTRAINT DF_SchemaVersion_AppliedAt DEFAULT (SYSUTCDATETIME()),
    AppliedBy NVARCHAR(200) NULL,
    FileName NVARCHAR(260) NULL
  );
END
GO

-- Cost center ownership FK (Users must already exist).
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_CostCenters_ResponsiblePerson')
  ALTER TABLE dbo.CostCenters ADD CONSTRAINT FK_CostCenters_ResponsiblePerson
    FOREIGN KEY (ResponsiblePersonId) REFERENCES dbo.Users(UserId);
GO

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

-- Immutability (dual control):
-- 1) INSTEAD OF triggers below (always applied with this script)
-- 2) DENY UPDATE/DELETE for app_budget_ops_role — apply
--    docs/migrations/005-app-budget-ops-role.sql (creates login/user/role + DENY).
-- Runtime should connect as app_budget_ops (SQL auth), not a sysadmin Trusted_Connection.

CREATE OR ALTER TRIGGER dbo.TR_AuditLogs_NoUpdateDelete ON dbo.AuditLogs
INSTEAD OF UPDATE, DELETE
AS
BEGIN
  RAISERROR('AuditLogs are immutable', 16, 1);
  ROLLBACK TRANSACTION;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_ApprovalHistory_NoUpdateDelete ON dbo.ApprovalHistory
INSTEAD OF UPDATE, DELETE
AS
BEGIN
  RAISERROR('ApprovalHistory is immutable', 16, 1);
  ROLLBACK TRANSACTION;
END;
GO

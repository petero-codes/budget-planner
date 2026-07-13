-- KenGen ICT Budget Operations — SQL Server schema
-- Phase 0b: run after Phase 1 mock validation

IF OBJECT_ID('dbo.Departments', 'U') IS NULL
CREATE TABLE dbo.Departments (
  DepartmentId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Departments PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  Name NVARCHAR(200) NOT NULL,
  Code NVARCHAR(50) NOT NULL CONSTRAINT UQ_Departments_Code UNIQUE
);

IF OBJECT_ID('dbo.Positions', 'U') IS NULL
CREATE TABLE dbo.Positions (
  PositionId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Positions PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  Title NVARCHAR(200) NOT NULL,
  PositionCode NVARCHAR(50) NOT NULL CONSTRAINT UQ_Positions_Code UNIQUE,
  Level INT NOT NULL
);

IF OBJECT_ID('dbo.CostCenters', 'U') IS NULL
CREATE TABLE dbo.CostCenters (
  CostCenterId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CostCenters PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  Code NVARCHAR(50) NOT NULL CONSTRAINT UQ_CostCenters_Code UNIQUE,
  SapCostCenterCode NVARCHAR(50) NULL,
  Name NVARCHAR(200) NOT NULL,
  DepartmentId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_CostCenters_Department REFERENCES dbo.Departments(DepartmentId),
  IsActive BIT NOT NULL CONSTRAINT DF_CostCenters_IsActive DEFAULT (1),
  IsDeleted BIT NOT NULL CONSTRAINT DF_CostCenters_IsDeleted DEFAULT (0),
  DeletedAt DATETIME2 NULL
);

IF OBJECT_ID('dbo.Users', 'U') IS NULL
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
CREATE INDEX IX_Users_ManagerId ON dbo.Users(ManagerId);

IF OBJECT_ID('dbo.Roles', 'U') IS NULL
CREATE TABLE dbo.Roles (
  RoleId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Roles PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  Code NVARCHAR(50) NOT NULL CONSTRAINT UQ_Roles_Code UNIQUE,
  Name NVARCHAR(100) NOT NULL
);

IF OBJECT_ID('dbo.Permissions', 'U') IS NULL
CREATE TABLE dbo.Permissions (
  PermissionId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Permissions PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  Code NVARCHAR(100) NOT NULL CONSTRAINT UQ_Permissions_Code UNIQUE,
  Name NVARCHAR(200) NOT NULL
);

IF OBJECT_ID('dbo.RolePermissions', 'U') IS NULL
CREATE TABLE dbo.RolePermissions (
  RoleId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_RolePermissions_Role REFERENCES dbo.Roles(RoleId),
  PermissionId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_RolePermissions_Permission REFERENCES dbo.Permissions(PermissionId),
  CONSTRAINT PK_RolePermissions PRIMARY KEY (RoleId, PermissionId)
);

IF OBJECT_ID('dbo.UserRoles', 'U') IS NULL
CREATE TABLE dbo.UserRoles (
  UserId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_UserRoles_User REFERENCES dbo.Users(UserId),
  RoleId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_UserRoles_Role REFERENCES dbo.Roles(RoleId),
  CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId)
);

IF OBJECT_ID('dbo.GlAccounts', 'U') IS NULL
CREATE TABLE dbo.GlAccounts (
  GlAccountId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_GlAccounts PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  Code NVARCHAR(20) NOT NULL CONSTRAINT UQ_GlAccounts_Code UNIQUE,
  Description NVARCHAR(300) NOT NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_GlAccounts_IsActive DEFAULT (1),
  IsDeleted BIT NOT NULL CONSTRAINT DF_GlAccounts_IsDeleted DEFAULT (0),
  DeletedAt DATETIME2 NULL
);

IF OBJECT_ID('dbo.FiscalYears', 'U') IS NULL
CREATE TABLE dbo.FiscalYears (
  FiscalYearId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_FiscalYears PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  YearLabel INT NOT NULL CONSTRAINT UQ_FiscalYears_YearLabel UNIQUE,
  StartDate DATE NOT NULL,
  EndDate DATE NOT NULL,
  IsLocked BIT NOT NULL CONSTRAINT DF_FiscalYears_IsLocked DEFAULT (0)
);

IF OBJECT_ID('dbo.BudgetPlans', 'U') IS NULL
CREATE TABLE dbo.BudgetPlans (
  BudgetPlanId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_BudgetPlans PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  OwnerId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_BudgetPlans_Owner REFERENCES dbo.Users(UserId),
  CostCenterId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_BudgetPlans_CostCenter REFERENCES dbo.CostCenters(CostCenterId),
  FiscalYearId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_BudgetPlans_FiscalYear REFERENCES dbo.FiscalYears(FiscalYearId),
  BudgetType NVARCHAR(50) NOT NULL,
  FromPeriod DATE NOT NULL,
  ToPeriod DATE NOT NULL,
  Status NVARCHAR(30) NOT NULL,
  CurrentApproverId UNIQUEIDENTIFIER NULL CONSTRAINT FK_BudgetPlans_CurrentApprover REFERENCES dbo.Users(UserId),
  SubmittedAt DATETIME2 NULL,
  SapVersion NVARCHAR(20) NULL,
  CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_BudgetPlans_CreatedAt DEFAULT (SYSUTCDATETIME()),
  UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_BudgetPlans_UpdatedAt DEFAULT (SYSUTCDATETIME()),
  RowVersion ROWVERSION NOT NULL
);
CREATE INDEX IX_BudgetPlans_Status_CostCenter ON dbo.BudgetPlans(Status, CostCenterId);
CREATE INDEX IX_BudgetPlans_CurrentApproverId ON dbo.BudgetPlans(CurrentApproverId);
CREATE INDEX IX_BudgetPlans_FiscalYear_Status ON dbo.BudgetPlans(FiscalYearId, Status);
CREATE UNIQUE INDEX UX_BudgetPlans_ActiveUnique
  ON dbo.BudgetPlans(CostCenterId, FiscalYearId, BudgetType)
  WHERE Status NOT IN ('Rejected', 'Approved');

IF OBJECT_ID('dbo.BudgetItems', 'U') IS NULL
CREATE TABLE dbo.BudgetItems (
  BudgetItemId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_BudgetItems PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  BudgetPlanId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_BudgetItems_Plan REFERENCES dbo.BudgetPlans(BudgetPlanId) ON DELETE CASCADE,
  GlAccountId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_BudgetItems_Gl REFERENCES dbo.GlAccounts(GlAccountId),
  Amount DECIMAL(18,2) NOT NULL CONSTRAINT CK_BudgetItems_Amount CHECK (Amount > 0),
  LineNumber INT NOT NULL,
  CONSTRAINT UQ_BudgetItems_Plan_Line UNIQUE (BudgetPlanId, LineNumber)
);
CREATE INDEX IX_BudgetItems_BudgetPlanId ON dbo.BudgetItems(BudgetPlanId);

IF OBJECT_ID('dbo.ApprovalRoute', 'U') IS NULL
CREATE TABLE dbo.ApprovalRoute (
  RouteId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ApprovalRoute PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  BudgetPlanId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_ApprovalRoute_Plan REFERENCES dbo.BudgetPlans(BudgetPlanId),
  ApproverId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_ApprovalRoute_Approver REFERENCES dbo.Users(UserId),
  Sequence INT NOT NULL,
  Status NVARCHAR(30) NOT NULL,
  CONSTRAINT UQ_ApprovalRoute_Plan_Sequence UNIQUE (BudgetPlanId, Sequence)
);
CREATE INDEX IX_ApprovalRoute_BudgetPlanId_Sequence ON dbo.ApprovalRoute(BudgetPlanId, Sequence);

IF OBJECT_ID('dbo.ApprovalHistory', 'U') IS NULL
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
CREATE INDEX IX_ApprovalHistory_BudgetPlanId_Timestamp ON dbo.ApprovalHistory(BudgetPlanId, [Timestamp]);

IF OBJECT_ID('dbo.AuditLogs', 'U') IS NULL
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
CREATE INDEX IX_AuditLogs_CreatedAt ON dbo.AuditLogs([Timestamp] DESC);
CREATE INDEX IX_AuditLogs_Entity ON dbo.AuditLogs(Entity, EntityId);

IF OBJECT_ID('dbo.Notifications', 'U') IS NULL
CREATE TABLE dbo.Notifications (
  NotificationId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Notifications PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  UserId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_Notifications_User REFERENCES dbo.Users(UserId),
  Type NVARCHAR(50) NOT NULL,
  Title NVARCHAR(200) NOT NULL,
  Body NVARCHAR(1000) NOT NULL,
  RelatedBudgetPlanId UNIQUEIDENTIFIER NULL,
  IsRead BIT NOT NULL CONSTRAINT DF_Notifications_IsRead DEFAULT (0),
  CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT (SYSUTCDATETIME())
);
CREATE INDEX IX_Notifications_UserId_IsRead ON dbo.Notifications(UserId, IsRead);

-- Immutability: deny UPDATE/DELETE for app role (create role as needed)
-- GRANT SELECT, INSERT ON dbo.AuditLogs TO app_budget_ops;
-- DENY UPDATE, DELETE ON dbo.AuditLogs TO app_budget_ops;
-- GRANT SELECT, INSERT ON dbo.ApprovalHistory TO app_budget_ops;
-- DENY UPDATE, DELETE ON dbo.ApprovalHistory TO app_budget_ops;

GO
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

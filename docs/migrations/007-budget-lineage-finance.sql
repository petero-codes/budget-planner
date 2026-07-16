-- Budget lineage, Finance claim queue, workflow history, attachments, SAP packages.
-- Idempotent; safe to re-run.

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

USE [BudgetOperations];
GO

-- 1) Budget lineage (one per CostCenter + FiscalYear + OriginalBudgetType)
IF OBJECT_ID('dbo.BudgetLineage', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.BudgetLineage (
    LineageId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_BudgetLineage PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    CostCenterId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_BudgetLineage_CostCenter REFERENCES dbo.CostCenters(CostCenterId),
    FiscalYearId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_BudgetLineage_FiscalYear REFERENCES dbo.FiscalYears(FiscalYearId),
    OriginalBudgetType NVARCHAR(50) NOT NULL,
    BudgetNumber NVARCHAR(50) NOT NULL CONSTRAINT UQ_BudgetLineage_BudgetNumber UNIQUE,
    CurrentVersionId UNIQUEIDENTIFIER NULL,
    LatestFinalizedVersionId UNIQUEIDENTIFIER NULL,
    IsArchived BIT NOT NULL CONSTRAINT DF_BudgetLineage_IsArchived DEFAULT (0),
    ArchivedAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_BudgetLineage_CreatedAt DEFAULT (SYSUTCDATETIME())
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_BudgetLineage_Key' AND object_id = OBJECT_ID(N'dbo.BudgetLineage'))
  CREATE UNIQUE INDEX UX_BudgetLineage_Key
    ON dbo.BudgetLineage(CostCenterId, FiscalYearId, OriginalBudgetType)
    WHERE IsArchived = 0;
GO

-- 2) Extend BudgetPlans for versioning
IF COL_LENGTH('dbo.BudgetPlans', 'LineageId') IS NULL
  ALTER TABLE dbo.BudgetPlans ADD LineageId UNIQUEIDENTIFIER NULL;
GO

IF COL_LENGTH('dbo.BudgetPlans', 'ParentBudgetPlanId') IS NULL
  ALTER TABLE dbo.BudgetPlans ADD ParentBudgetPlanId UNIQUEIDENTIFIER NULL;
GO

IF COL_LENGTH('dbo.BudgetPlans', 'LineageRevision') IS NULL
  ALTER TABLE dbo.BudgetPlans ADD LineageRevision INT NOT NULL
    CONSTRAINT DF_BudgetPlans_LineageRevision DEFAULT (1);
GO

IF COL_LENGTH('dbo.BudgetPlans', 'VersionLabel') IS NULL
  ALTER TABLE dbo.BudgetPlans ADD VersionLabel NVARCHAR(60) NULL;
GO

IF COL_LENGTH('dbo.BudgetPlans', 'AmendmentReason') IS NULL
  ALTER TABLE dbo.BudgetPlans ADD AmendmentReason NVARCHAR(1000) NULL;
GO

IF COL_LENGTH('dbo.BudgetPlans', 'IsArchived') IS NULL
  ALTER TABLE dbo.BudgetPlans ADD IsArchived BIT NOT NULL
    CONSTRAINT DF_BudgetPlans_IsArchived DEFAULT (0);
GO

IF COL_LENGTH('dbo.BudgetPlans', 'ArchivedAt') IS NULL
  ALTER TABLE dbo.BudgetPlans ADD ArchivedAt DATETIME2 NULL;
GO

-- Finance SLA fields
IF COL_LENGTH('dbo.BudgetPlans', 'ClaimDueAt') IS NULL
  ALTER TABLE dbo.BudgetPlans ADD ClaimDueAt DATETIME2 NULL;
GO

IF COL_LENGTH('dbo.BudgetPlans', 'ReviewDueAt') IS NULL
  ALTER TABLE dbo.BudgetPlans ADD ReviewDueAt DATETIME2 NULL;
GO

IF COL_LENGTH('dbo.BudgetPlans', 'EscalationStatus') IS NULL
  ALTER TABLE dbo.BudgetPlans ADD EscalationStatus NVARCHAR(20) NOT NULL
    CONSTRAINT DF_BudgetPlans_EscalationStatus DEFAULT (N'None');
GO

IF COL_LENGTH('dbo.BudgetPlans', 'FinanceClaimedAt') IS NULL
  ALTER TABLE dbo.BudgetPlans ADD FinanceClaimedAt DATETIME2 NULL;
GO

IF COL_LENGTH('dbo.BudgetPlans', 'FinanceClaimedBy') IS NULL
  ALTER TABLE dbo.BudgetPlans ADD FinanceClaimedBy UNIQUEIDENTIFIER NULL;
GO

-- Replace active uniqueness: one in-play version per lineage
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_BudgetPlans_ActiveUnique' AND object_id = OBJECT_ID(N'dbo.BudgetPlans'))
  DROP INDEX UX_BudgetPlans_ActiveUnique ON dbo.BudgetPlans;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_BudgetPlans_LineageInPlay' AND object_id = OBJECT_ID(N'dbo.BudgetPlans'))
  CREATE UNIQUE INDEX UX_BudgetPlans_LineageInPlay
    ON dbo.BudgetPlans(LineageId)
    WHERE LineageId IS NOT NULL
      AND IsArchived = 0
      AND [Status] <> N'Rejected'
      AND [Status] <> N'Finalized'
      AND [Status] <> N'Approved';
GO

-- 3) Finance queue claims
IF OBJECT_ID('dbo.FinanceQueueClaims', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.FinanceQueueClaims (
    ClaimId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_FinanceQueueClaims PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    BudgetPlanId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_FinanceQueueClaims_Plan REFERENCES dbo.BudgetPlans(BudgetPlanId),
    ClaimedBy UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_FinanceQueueClaims_User REFERENCES dbo.Users(UserId),
    ClaimedAt DATETIME2 NOT NULL CONSTRAINT DF_FinanceQueueClaims_ClaimedAt DEFAULT (SYSUTCDATETIME()),
    ReleasedAt DATETIME2 NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_FinanceQueueClaims_IsActive DEFAULT (1)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_FinanceQueueClaims_ActivePlan' AND object_id = OBJECT_ID(N'dbo.FinanceQueueClaims'))
  CREATE UNIQUE INDEX UX_FinanceQueueClaims_ActivePlan
    ON dbo.FinanceQueueClaims(BudgetPlanId)
    WHERE IsActive = 1;
GO

-- 4) Workflow history (append-only timeline)
IF OBJECT_ID('dbo.WorkflowHistory', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.WorkflowHistory (
    WorkflowHistoryId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_WorkflowHistory PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    BudgetVersionId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_WorkflowHistory_Plan REFERENCES dbo.BudgetPlans(BudgetPlanId),
    Stage NVARCHAR(50) NOT NULL,
    ActorId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_WorkflowHistory_Actor REFERENCES dbo.Users(UserId),
    Action NVARCHAR(50) NOT NULL,
    Comment NVARCHAR(1000) NULL,
    [Timestamp] DATETIME2 NOT NULL CONSTRAINT DF_WorkflowHistory_Timestamp DEFAULT (SYSUTCDATETIME())
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_WorkflowHistory_BudgetVersion' AND object_id = OBJECT_ID(N'dbo.WorkflowHistory'))
  CREATE INDEX IX_WorkflowHistory_BudgetVersion
    ON dbo.WorkflowHistory(BudgetVersionId, [Timestamp]);
GO

CREATE OR ALTER TRIGGER dbo.TR_WorkflowHistory_NoUpdateDelete ON dbo.WorkflowHistory
INSTEAD OF UPDATE, DELETE
AS
BEGIN
  RAISERROR('WorkflowHistory is immutable', 16, 1);
  ROLLBACK TRANSACTION;
END;
GO

-- 5) Attachment categories and requirements
IF OBJECT_ID('dbo.BudgetAttachmentCategories', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.BudgetAttachmentCategories (
    CategoryId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_BudgetAttachmentCategories PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    Code NVARCHAR(50) NOT NULL CONSTRAINT UQ_BudgetAttachmentCategories_Code UNIQUE,
    Name NVARCHAR(200) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_BudgetAttachmentCategories_IsActive DEFAULT (1)
  );
END
GO

IF OBJECT_ID('dbo.BudgetTypeAttachmentRequirements', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.BudgetTypeAttachmentRequirements (
    BudgetType NVARCHAR(50) NOT NULL,
    CategoryId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_BudgetTypeAttachmentReq_Category REFERENCES dbo.BudgetAttachmentCategories(CategoryId),
    CONSTRAINT PK_BudgetTypeAttachmentRequirements PRIMARY KEY (BudgetType, CategoryId)
  );
END
GO

IF OBJECT_ID('dbo.BudgetAttachments', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.BudgetAttachments (
    AttachmentId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_BudgetAttachments PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    BudgetPlanId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_BudgetAttachments_Plan REFERENCES dbo.BudgetPlans(BudgetPlanId),
    CategoryId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_BudgetAttachments_Category REFERENCES dbo.BudgetAttachmentCategories(CategoryId),
    FileName NVARCHAR(260) NOT NULL,
    ContentType NVARCHAR(100) NOT NULL,
    FileSizeBytes INT NOT NULL,
    Sha256 NVARCHAR(64) NOT NULL,
    Content VARBINARY(MAX) NOT NULL,
    Source NVARCHAR(20) NOT NULL CONSTRAINT DF_BudgetAttachments_Source DEFAULT (N'Uploaded'),
    InheritedFromAttachmentId UNIQUEIDENTIFIER NULL,
    UploadedBy UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_BudgetAttachments_User REFERENCES dbo.Users(UserId),
    UploadedAt DATETIME2 NOT NULL CONSTRAINT DF_BudgetAttachments_UploadedAt DEFAULT (SYSUTCDATETIME()),
    IsArchived BIT NOT NULL CONSTRAINT DF_BudgetAttachments_IsArchived DEFAULT (0),
    ArchivedAt DATETIME2 NULL
  );
END
GO

-- 6) Frozen SAP packages (generated on Finalize)
IF OBJECT_ID('dbo.SapPackages', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.SapPackages (
    SapPackageId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SapPackages PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    BudgetPlanId UNIQUEIDENTIFIER NOT NULL CONSTRAINT UQ_SapPackages_BudgetPlan UNIQUE,
    SapReference NVARCHAR(50) NOT NULL,
    PackageJson NVARCHAR(MAX) NOT NULL,
    CsvContent NVARCHAR(MAX) NOT NULL,
    GeneratedAt DATETIME2 NOT NULL CONSTRAINT DF_SapPackages_GeneratedAt DEFAULT (SYSUTCDATETIME()),
    GeneratedBy UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_SapPackages_User REFERENCES dbo.Users(UserId)
  );
END
GO

-- 7) Finance permissions
IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE Code = N'finance.claim')
  INSERT INTO dbo.Permissions (PermissionId, Code, Name)
  VALUES (NEWID(), N'finance.claim', N'Claim budgets from Finance queue');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE Code = N'finance.finalize')
  INSERT INTO dbo.Permissions (PermissionId, Code, Name)
  VALUES (NEWID(), N'finance.finalize', N'Finalize budgets after Finance review');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE Code = N'finance.return')
  INSERT INTO dbo.Permissions (PermissionId, Code, Name)
  VALUES (NEWID(), N'finance.return', N'Return budgets from Finance for revision');
GO

-- Grant Finance permissions to FinanceAdministrator role
DECLARE @financeRoleId UNIQUEIDENTIFIER = (SELECT RoleId FROM dbo.Roles WHERE Code = N'FinanceAdministrator');
IF @financeRoleId IS NOT NULL
BEGIN
  INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
  SELECT @financeRoleId, p.PermissionId
  FROM dbo.Permissions p
  WHERE p.Code IN (N'finance.claim', N'finance.finalize', N'finance.return')
    AND NOT EXISTS (
      SELECT 1 FROM dbo.RolePermissions rp
      WHERE rp.RoleId = @financeRoleId AND rp.PermissionId = p.PermissionId
    );
END
GO

-- 8) Backfill: create lineage for existing plans, migrate Approved → Finalized
-- Budget number sequence per (FY, Dept)
IF OBJECT_ID('tempdb..#PlanLineage') IS NOT NULL DROP TABLE #PlanLineage;
GO

;WITH Numbered AS (
  SELECT
    bp.BudgetPlanId,
    bp.CostCenterId,
    bp.FiscalYearId,
    bp.BudgetType,
    bp.[Status],
    fy.YearLabel,
    d.Code AS DeptCode,
    ROW_NUMBER() OVER (
      PARTITION BY bp.CostCenterId, bp.FiscalYearId, bp.BudgetType
      ORDER BY bp.CreatedAt
    ) AS Rn
  FROM dbo.BudgetPlans bp
  INNER JOIN dbo.CostCenters cc ON cc.CostCenterId = bp.CostCenterId
  INNER JOIN dbo.Departments d ON d.DepartmentId = cc.DepartmentId
  INNER JOIN dbo.FiscalYears fy ON fy.FiscalYearId = bp.FiscalYearId
  WHERE bp.LineageId IS NULL
)
SELECT * INTO #PlanLineage FROM Numbered;
GO

INSERT INTO dbo.BudgetLineage (LineageId, CostCenterId, FiscalYearId, OriginalBudgetType, BudgetNumber, CreatedAt)
SELECT
  NEWID(),
  pl.CostCenterId,
  pl.FiscalYearId,
  pl.BudgetType,
  CONCAT(N'FY', pl.YearLabel, N'-', pl.DeptCode, N'-', RIGHT(N'000' + CAST(
    DENSE_RANK() OVER (PARTITION BY pl.FiscalYearId, pl.DeptCode ORDER BY pl.CostCenterId, pl.BudgetType) AS NVARCHAR(3)
  ), 3)),
  SYSUTCDATETIME()
FROM #PlanLineage pl
WHERE pl.Rn = 1
  AND NOT EXISTS (
    SELECT 1 FROM dbo.BudgetLineage bl
    WHERE bl.CostCenterId = pl.CostCenterId
      AND bl.FiscalYearId = pl.FiscalYearId
      AND bl.OriginalBudgetType = pl.BudgetType
      AND bl.IsArchived = 0
  );
GO

UPDATE bp SET
  LineageId = bl.LineageId,
  LineageRevision = 1,
  VersionLabel = CONCAT(bl.BudgetNumber, N'-V1'),
  [Status] = CASE WHEN bp.[Status] = N'Approved' THEN N'Finalized' ELSE bp.[Status] END
FROM dbo.BudgetPlans bp
INNER JOIN dbo.BudgetLineage bl
  ON bl.CostCenterId = bp.CostCenterId
  AND bl.FiscalYearId = bp.FiscalYearId
  AND bl.OriginalBudgetType = bp.BudgetType
WHERE bp.LineageId IS NULL;
GO

UPDATE bl SET
  CurrentVersionId = bp.BudgetPlanId,
  LatestFinalizedVersionId = CASE WHEN bp.[Status] = N'Finalized' THEN bp.BudgetPlanId ELSE NULL END
FROM dbo.BudgetLineage bl
INNER JOIN dbo.BudgetPlans bp
  ON bp.LineageId = bl.LineageId
WHERE bl.CurrentVersionId IS NULL;
GO

-- Add FK constraints after backfill
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_BudgetPlans_Lineage')
  ALTER TABLE dbo.BudgetPlans ADD CONSTRAINT FK_BudgetPlans_Lineage
    FOREIGN KEY (LineageId) REFERENCES dbo.BudgetLineage(LineageId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_BudgetLineage_CurrentVersion')
  ALTER TABLE dbo.BudgetLineage ADD CONSTRAINT FK_BudgetLineage_CurrentVersion
    FOREIGN KEY (CurrentVersionId) REFERENCES dbo.BudgetPlans(BudgetPlanId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_BudgetLineage_LatestFinalized')
  ALTER TABLE dbo.BudgetLineage ADD CONSTRAINT FK_BudgetLineage_LatestFinalized
    FOREIGN KEY (LatestFinalizedVersionId) REFERENCES dbo.BudgetPlans(BudgetPlanId);
GO

-- Seed default attachment categories
IF NOT EXISTS (SELECT 1 FROM dbo.BudgetAttachmentCategories WHERE Code = N'BusinessCase')
  INSERT INTO dbo.BudgetAttachmentCategories (CategoryId, Code, Name)
  VALUES (NEWID(), N'BusinessCase', N'Business Case');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.BudgetAttachmentCategories WHERE Code = N'VendorQuote')
  INSERT INTO dbo.BudgetAttachmentCategories (CategoryId, Code, Name)
  VALUES (NEWID(), N'VendorQuote', N'Vendor Quote');
GO

PRINT 'Migration 007 complete.';
GO

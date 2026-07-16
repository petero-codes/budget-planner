-- Development Toolkit columns (dev tooling only; safe no-ops if already applied).
-- Apply with: npx tsx scripts/apply-migration.ts docs/migrations/008-development-toolkit.sql

-- BudgetPlans demo markers
IF COL_LENGTH('dbo.BudgetPlans', 'IsDemo') IS NULL
  ALTER TABLE dbo.BudgetPlans ADD IsDemo BIT NOT NULL
    CONSTRAINT DF_BudgetPlans_IsDemo DEFAULT (0);
GO

IF COL_LENGTH('dbo.BudgetPlans', 'CreatedByToolkit') IS NULL
  ALTER TABLE dbo.BudgetPlans ADD CreatedByToolkit BIT NOT NULL
    CONSTRAINT DF_BudgetPlans_CreatedByToolkit DEFAULT (0);
GO

IF COL_LENGTH('dbo.BudgetPlans', 'DemoBatchId') IS NULL
  ALTER TABLE dbo.BudgetPlans ADD DemoBatchId UNIQUEIDENTIFIER NULL;
GO

IF COL_LENGTH('dbo.BudgetPlans', 'IsDemo') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_BudgetPlans_IsDemo' AND object_id = OBJECT_ID(N'dbo.BudgetPlans')
  )
  CREATE INDEX IX_BudgetPlans_IsDemo ON dbo.BudgetPlans(IsDemo)
    WHERE IsDemo = 1;
GO

-- Notifications soft-clear (toolkit Clear Notifications)
IF COL_LENGTH('dbo.Notifications', 'IsCleared') IS NULL
  ALTER TABLE dbo.Notifications ADD IsCleared BIT NOT NULL
    CONSTRAINT DF_Notifications_IsCleared DEFAULT (0);
GO

IF COL_LENGTH('dbo.Notifications', 'ClearedAt') IS NULL
  ALTER TABLE dbo.Notifications ADD ClearedAt DATETIME2 NULL;
GO

IF COL_LENGTH('dbo.Notifications', 'ClearedReason') IS NULL
  ALTER TABLE dbo.Notifications ADD ClearedReason NVARCHAR(500) NULL;
GO

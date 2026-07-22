-- Task metadata for workflow-oriented notifications.
-- Apply after 010-notification-tasks.sql.
-- Apply with: npx tsx scripts/apply-migration.ts docs/migrations/011-notification-task-metadata.sql

IF COL_LENGTH('dbo.Notifications', 'Priority') IS NULL
  ALTER TABLE dbo.Notifications ADD Priority NVARCHAR(20) NOT NULL
    CONSTRAINT DF_Notifications_Priority DEFAULT (N'Medium');
GO

IF COL_LENGTH('dbo.Notifications', 'Category') IS NULL
  ALTER TABLE dbo.Notifications ADD Category NVARCHAR(30) NOT NULL
    CONSTRAINT DF_Notifications_Category DEFAULT (N'Budget');
GO

IF COL_LENGTH('dbo.Notifications', 'ActionLabel') IS NULL
  ALTER TABLE dbo.Notifications ADD ActionLabel NVARCHAR(100) NOT NULL
    CONSTRAINT DF_Notifications_ActionLabel DEFAULT (N'View');
GO

IF COL_LENGTH('dbo.Notifications', 'ResolvedBy') IS NULL
  ALTER TABLE dbo.Notifications ADD ResolvedBy UNIQUEIDENTIFIER NULL;
GO

IF COL_LENGTH('dbo.Notifications', 'ExpiresAt') IS NULL
  ALTER TABLE dbo.Notifications ADD ExpiresAt DATETIME2 NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'FK_Notifications_ResolvedBy'
      AND parent_object_id = OBJECT_ID(N'dbo.Notifications')
  )
  ALTER TABLE dbo.Notifications ADD CONSTRAINT FK_Notifications_ResolvedBy
    FOREIGN KEY (ResolvedBy) REFERENCES dbo.Users(UserId);
GO

-- Backfill useful labels/categories for pre-migration rows.
UPDATE dbo.Notifications
SET
  Priority = CASE
    WHEN Type IN (N'Approval', N'FinanceClaim', N'FinanceEscalation') THEN N'High'
    ELSE ISNULL(Priority, N'Medium')
  END,
  Category = CASE
    WHEN Type = N'Approval' THEN N'Approval'
    WHEN Type IN (N'Finance', N'FinanceQueue', N'FinanceClaim', N'FinanceEscalation') THEN N'Finance'
    WHEN Type = N'SupportIssue' THEN N'Support'
    WHEN Type = N'AdminUser' THEN N'Administration'
    WHEN Type = N'FiscalYear' THEN N'FiscalYear'
    WHEN Type = N'Outcome' THEN N'Outcome'
    ELSE N'Budget'
  END,
  ActionLabel = CASE
    WHEN Type = N'Approval' THEN N'Review Budget'
    WHEN Type IN (N'FinanceQueue', N'FinanceClaim', N'FinanceEscalation') THEN N'Review Finance Item'
    WHEN Type = N'SupportIssue' THEN N'Open Issue'
    WHEN Type = N'AdminUser' THEN N'View User'
    WHEN Type = N'FiscalYear' THEN N'Manage Fiscal Years'
    ELSE N'View Details'
  END;
GO

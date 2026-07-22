-- Schema version tracking.
-- Every subsequent migration must INSERT its version after applying.
-- Apply with: npx tsx scripts/apply-migration.ts docs/migrations/012-schema-version.sql
--
-- On first apply this also backfills 001–011 as already-applied for databases
-- that were migrated before SchemaVersion existed.

IF OBJECT_ID('dbo.SchemaVersion', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.SchemaVersion (
    Version NVARCHAR(20) NOT NULL
      CONSTRAINT PK_SchemaVersion PRIMARY KEY,
    AppliedAt DATETIME2 NOT NULL
      CONSTRAINT DF_SchemaVersion_AppliedAt DEFAULT (SYSUTCDATETIME()),
    AppliedBy NVARCHAR(200) NULL,
    FileName NVARCHAR(260) NULL
  );
END
GO

-- Backfill prior migrations that were applied before this table existed.
-- Idempotent: skips versions already recorded.
MERGE dbo.SchemaVersion AS target
USING (VALUES
  (N'001', N'001-auth.sql'),
  (N'002', N'002-budget-description.sql'),
  (N'003', N'003-fiscal-year-status.sql'),
  (N'004', N'004-cost-center-manager.sql'),
  (N'005', N'005-app-budget-ops-role.sql'),
  (N'006', N'006-master-data.sql'),
  (N'007', N'007-budget-lineage-finance.sql'),
  (N'008', N'008-development-toolkit.sql'),
  (N'009', N'009-support-issues.sql'),
  (N'010', N'010-notification-tasks.sql'),
  (N'011', N'011-notification-task-metadata.sql'),
  (N'012', N'012-schema-version.sql')
) AS source (Version, FileName)
ON target.Version = source.Version
WHEN NOT MATCHED THEN
  INSERT (Version, AppliedAt, AppliedBy, FileName)
  VALUES (source.Version, SYSUTCDATETIME(), N'migration-012-backfill', source.FileName);
GO

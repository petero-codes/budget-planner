-- Task-oriented notifications: navigable entity + read/resolution lifecycle.
-- Notifications now behave like a to-do list: they stay active until the work
-- they represent is completed (ResolvedAt), independently of being read (ReadAt).
-- Apply with: npx tsx scripts/apply-migration.ts docs/migrations/010-notification-tasks.sql

IF COL_LENGTH('dbo.Notifications', 'EntityType') IS NULL
  ALTER TABLE dbo.Notifications ADD EntityType NVARCHAR(30) NULL;
GO

IF COL_LENGTH('dbo.Notifications', 'EntityId') IS NULL
  ALTER TABLE dbo.Notifications ADD EntityId NVARCHAR(100) NULL;
GO

IF COL_LENGTH('dbo.Notifications', 'TargetUrl') IS NULL
  ALTER TABLE dbo.Notifications ADD TargetUrl NVARCHAR(400) NULL;
GO

IF COL_LENGTH('dbo.Notifications', 'ReadAt') IS NULL
  ALTER TABLE dbo.Notifications ADD ReadAt DATETIME2 NULL;
GO

IF COL_LENGTH('dbo.Notifications', 'ResolvedAt') IS NULL
  ALTER TABLE dbo.Notifications ADD ResolvedAt DATETIME2 NULL;
GO

-- Backfill ReadAt for rows already flagged read so history stays coherent.
IF COL_LENGTH('dbo.Notifications', 'ReadAt') IS NOT NULL
  UPDATE dbo.Notifications
  SET ReadAt = COALESCE(ReadAt, CreatedAt)
  WHERE IsRead = 1 AND ReadAt IS NULL;
GO

-- Previously "cleared" notifications represented completed/dismissed work.
-- Treat them as resolved so history reflects the new lifecycle.
IF COL_LENGTH('dbo.Notifications', 'ResolvedAt') IS NOT NULL
  AND COL_LENGTH('dbo.Notifications', 'IsCleared') IS NOT NULL
  UPDATE dbo.Notifications
  SET ResolvedAt = COALESCE(ResolvedAt, ClearedAt, CreatedAt)
  WHERE ISNULL(IsCleared, 0) = 1 AND ResolvedAt IS NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_Notifications_UserId_Resolved' AND object_id = OBJECT_ID(N'dbo.Notifications')
  )
  CREATE INDEX IX_Notifications_UserId_Resolved ON dbo.Notifications(UserId, ResolvedAt);
GO

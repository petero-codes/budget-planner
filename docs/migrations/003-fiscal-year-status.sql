-- Fiscal year lifecycle status (Open / Closed / Archived)
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('dbo.FiscalYears', 'Status') IS NULL
BEGIN
  ALTER TABLE dbo.FiscalYears ADD Status NVARCHAR(20) NOT NULL
    CONSTRAINT DF_FiscalYears_Status DEFAULT (N'Open');
END
GO

-- Sync Status from legacy IsLocked for existing rows
UPDATE dbo.FiscalYears
SET Status = CASE WHEN IsLocked = 1 THEN N'Closed' ELSE N'Open' END
WHERE Status IS NULL OR (IsLocked = 1 AND Status = N'Open');
GO

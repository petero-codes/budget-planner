-- Assign supervising manager to cost centers (nullable; no FK to avoid seed order issues).
IF COL_LENGTH('dbo.CostCenters', 'ManagerId') IS NULL
BEGIN
  ALTER TABLE dbo.CostCenters ADD ManagerId UNIQUEIDENTIFIER NULL;
END
GO

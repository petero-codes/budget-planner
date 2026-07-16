-- Description text on budget plans
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('dbo.BudgetPlans', 'Description') IS NULL
  ALTER TABLE dbo.BudgetPlans ADD Description NVARCHAR(1000) NULL;
GO

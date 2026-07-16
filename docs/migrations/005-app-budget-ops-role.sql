-- Least-privilege app role for Budget Operations runtime.
-- Requires SQL Server mixed-mode authentication (SQL logins enabled).
-- Seed/admin scripts may continue to use a privileged Trusted_Connection login.
--
-- Default local password (override before production): BudgetOps_App_2026!
-- Connection string example:
--   Server=localhost\SQLEXPRESS;Database=BudgetOperations;User Id=app_budget_ops;Password=BudgetOps_App_2026!;TrustServerCertificate=True;

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

USE [BudgetOperations];
GO

-- Server login (no-op if already present)
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'app_budget_ops')
BEGIN
  CREATE LOGIN [app_budget_ops] WITH PASSWORD = N'BudgetOps_App_2026!',
    CHECK_POLICY = ON,
    CHECK_EXPIRATION = OFF;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'app_budget_ops')
BEGIN
  CREATE USER [app_budget_ops] FOR LOGIN [app_budget_ops];
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'app_budget_ops_role' AND type = 'R')
BEGIN
  CREATE ROLE [app_budget_ops_role];
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.database_role_members rm
  JOIN sys.database_principals r ON r.principal_id = rm.role_principal_id
  JOIN sys.database_principals m ON m.principal_id = rm.member_principal_id
  WHERE r.name = N'app_budget_ops_role' AND m.name = N'app_budget_ops'
)
BEGIN
  ALTER ROLE [app_budget_ops_role] ADD MEMBER [app_budget_ops];
END
GO

-- Least-privilege DML (no DDL)
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO [app_budget_ops_role];
GO

-- Independent immutability control (in addition to INSTEAD OF triggers)
DENY UPDATE, DELETE ON dbo.AuditLogs TO [app_budget_ops_role];
DENY UPDATE, DELETE ON dbo.ApprovalHistory TO [app_budget_ops_role];
GO

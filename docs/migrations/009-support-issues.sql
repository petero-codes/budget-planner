-- Support Issues (lightweight in-app ticketing)
-- Apply: npx tsx scripts/apply-migration.ts docs/migrations/009-support-issues.sql

IF OBJECT_ID(N'dbo.SupportIssues', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SupportIssues (
    SupportIssueId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SupportIssues PRIMARY KEY,
    ReferenceNumber NVARCHAR(32) NOT NULL,
    Title NVARCHAR(200) NOT NULL,
    Description NVARCHAR(4000) NOT NULL,
    Category NVARCHAR(40) NOT NULL,
    Priority NVARCHAR(20) NOT NULL,
    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_SupportIssues_Status DEFAULT (N'Open'),
    ReportedBy UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_SupportIssues_ReportedBy REFERENCES dbo.Users(UserId),
    AssignedTo UNIQUEIDENTIFIER NULL CONSTRAINT FK_SupportIssues_AssignedTo REFERENCES dbo.Users(UserId),
    PagePath NVARCHAR(500) NULL,
    PageLabel NVARCHAR(200) NULL,
    BudgetPlanId UNIQUEIDENTIFIER NULL,
    FiscalYearId UNIQUEIDENTIFIER NULL,
    CostCenterId UNIQUEIDENTIFIER NULL,
    Browser NVARCHAR(200) NULL,
    AppVersion NVARCHAR(40) NULL,
    CorrelationId NVARCHAR(64) NULL,
    AdminNotes NVARCHAR(4000) NULL,
    ScreenshotFileName NVARCHAR(260) NULL,
    ScreenshotContentType NVARCHAR(120) NULL,
    ScreenshotContent VARBINARY(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL,
    UpdatedAt DATETIME2 NOT NULL,
    ClosedAt DATETIME2 NULL,
    CONSTRAINT UX_SupportIssues_Reference UNIQUE (ReferenceNumber)
  );

  CREATE INDEX IX_SupportIssues_ReportedBy ON dbo.SupportIssues(ReportedBy, CreatedAt DESC);
  CREATE INDEX IX_SupportIssues_Status ON dbo.SupportIssues(Status, CreatedAt DESC);
END
GO

-- Sequence for reference numbers (year-scoped in app; this is a global counter helper)
IF OBJECT_ID(N'dbo.SupportIssueSequence', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SupportIssueSequence (
    YearLabel INT NOT NULL CONSTRAINT PK_SupportIssueSequence PRIMARY KEY,
    LastValue INT NOT NULL CONSTRAINT DF_SupportIssueSequence_LastValue DEFAULT (0)
  );
END
GO

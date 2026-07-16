-- Auth module migration: password sign-in, email verification, one-time tokens
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('dbo.Users', 'PasswordHash') IS NULL
  ALTER TABLE dbo.Users ADD PasswordHash NVARCHAR(500) NULL;
GO

IF COL_LENGTH('dbo.Users', 'EmailVerifiedAt') IS NULL
  ALTER TABLE dbo.Users ADD EmailVerifiedAt DATETIME2 NULL;
GO

IF OBJECT_ID('dbo.AuthTokens', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.AuthTokens (
    AuthTokenId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_AuthTokens PRIMARY KEY,
    UserId UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_AuthTokens_User REFERENCES dbo.Users(UserId),
    Type NVARCHAR(30) NOT NULL, -- 'verify-email' | 'reset-password'
    TokenHash NVARCHAR(128) NOT NULL,
    ExpiresAt DATETIME2 NOT NULL,
    UsedAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_AuthTokens_CreatedAt DEFAULT (SYSUTCDATETIME())
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AuthTokens_TokenHash' AND object_id = OBJECT_ID(N'dbo.AuthTokens'))
  CREATE INDEX IX_AuthTokens_TokenHash ON dbo.AuthTokens(TokenHash);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AuthTokens_UserId' AND object_id = OBJECT_ID(N'dbo.AuthTokens'))
  CREATE INDEX IX_AuthTokens_UserId ON dbo.AuthTokens(UserId);
GO

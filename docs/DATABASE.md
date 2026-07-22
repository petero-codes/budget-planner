# DATABASE.md — Schema reference

**Purpose:** Authoritative, evidence-backed reference for every table, index, constraint,
and trigger. Detailed companion to `docs/ENGINEERING_BRAIN.md`.

**Sources of truth (in priority order):** live SQL Server schema → `docs/schema.sql`
(master DDL) → `docs/migrations/*.sql` (incremental) → `src/infrastructure/migrations/registry.ts`
(ordered migration ledger). Every claim below cites `file · line`. Items that cannot be
proven from the repo are marked **UNKNOWN**.

**Engine:** Microsoft SQL Server, accessed via `msnodesqlv8` (ODBC) — see ADR-009.
All identifiers are `UNIQUEIDENTIFIER` with `NEWSEQUENTIALID()` defaults unless noted.

> Naming caveats (real object names differ from casual references):
> the table is **`dbo.ApprovalRoute`** (singular), submission status is
> **`dbo.CostCenterSubmissionStatus`**, budget lines are **`dbo.BudgetItems`**,
> lineage is **`dbo.BudgetLineage`**. There is **no `Sessions` table** — sessions are
> signed cookies, not table-backed (see `docs/ENGINEERING_BRAIN.md` §11).

---

## 1. Table catalogue

| Table | Defined in | Purpose |
|-------|-----------|---------|
| `Departments` | schema.sql:11 | Org departments (master data) |
| `Positions` | schema.sql:22 | Job positions with hierarchy `Level` (display only) |
| `CostCenters` | schema.sql:33 | Cost centers; approving manager + responsible person |
| `Users` | schema.sql:52 | Application users + org placement (+ auth cols via mig 001) |
| `Roles` | schema.sql:75 | RBAC roles |
| `Permissions` | schema.sql:85 | RBAC permission catalog |
| `RolePermissions` | schema.sql:95 | Role↔Permission join |
| `UserRoles` | schema.sql:105 | User↔Role join |
| `GlAccounts` | schema.sql:115 | General-ledger account catalog |
| `FiscalYears` | schema.sql:128 | Financial years + lifecycle status/current flags |
| `BudgetPlans` | schema.sql:153 | Core budget plan / version record |
| `BudgetItems` | schema.sql:198 | Budget line items (GL account + amount) |
| `ApprovalRoute` | schema.sql:215 | Per-plan ordered approver steps |
| `ApprovalHistory` | schema.sql:232 | Immutable approval action trail |
| `AuditLogs` | schema.sql:251 | Immutable system-wide audit log |
| `Notifications` | schema.sql:276 | Task-oriented user notifications |
| `SchemaVersion` | schema.sql:314 / mig 012 | Applied-migration ledger |
| `CostCenterSubmissionStatus` | schema.sql:331 / mig 006 | Per-(CC, FY) submission status |
| `AuthTokens` | mig 001:16 | Email-verify / reset one-time tokens |
| `BudgetLineage` | mig 007:14 | One lineage per (CC, FY, original type) |
| `FinanceQueueClaims` | mig 007:106 | Finance reviewer claims (one active per plan) |
| `WorkflowHistory` | mig 007:126 | Immutable workflow timeline per version |
| `BudgetAttachmentCategories` | mig 007:155 | Attachment category catalog |
| `BudgetTypeAttachmentRequirements` | mig 007:166 | Required categories per budget type |
| `BudgetAttachments` | mig 007:176 | In-DB `VARBINARY(MAX)` attachments (ADR-008) |
| `SapPackages` | mig 007:198 | Frozen SAP export package on finalize |
| `SupportIssues` | mig 009:6 | **Unused (MVP)** — in-app ticketing removed; email support only. Table retained. |
| `SupportIssueSequence` | mig 009:42 | **Unused (MVP)** — retained with mig 009. |

---

## 2. Master-data tables

### `dbo.Departments` — schema.sql:11
- Columns: `DepartmentId` PK; `Name NVARCHAR(200) NOT NULL`; `Code NVARCHAR(50) NOT NULL` (UNIQUE `UQ_Departments_Code`, :14); `IsActive BIT NOT NULL DEFAULT 1`.
- `IsActive` also added defensively for pre-existing DBs by mig 006:13.

### `dbo.Positions` — schema.sql:22
- Columns: `PositionId` PK; `Title NVARCHAR(200) NOT NULL`; `PositionCode NVARCHAR(50) NOT NULL` (UNIQUE `UQ_Positions_Code`, :25); `Level INT NOT NULL`.
- `Level` is **display-only**, not a capability (see `docs/domain-model.md`).

### `dbo.CostCenters` — schema.sql:33
- Columns: `CostCenterId` PK; `Code NVARCHAR(50)` (UNIQUE); `SapCostCenterCode NVARCHAR(50) NULL`; `Name`; `DepartmentId` NOT NULL; `IsActive BIT DEFAULT 1`; `ManagerId NULL`; `ResponsiblePersonId NULL`; `IsDeleted BIT DEFAULT 0`; `DeletedAt NULL`.
- FKs: `FK_CostCenters_Department → Departments` (:38); `FK_CostCenters_ResponsiblePerson → Users` (schema.sql:324, idempotent mig 006:24).
- `ManagerId` has **no FK** deliberately (mig 004:1) to avoid seed-order deadlocks. `ManagerId` = approver; `ResponsiblePersonId` = Budget Holder.

### `dbo.GlAccounts` — schema.sql:115
- Columns: `GlAccountId` PK; `Code NVARCHAR(20)` (UNIQUE); `Description NVARCHAR(300)`; `IsActive`; `IsDeleted`; `DeletedAt`.

### `dbo.FiscalYears` — schema.sql:128
- Columns: `FiscalYearId` PK; `YearLabel INT` (UNIQUE); `StartDate DATE`; `EndDate DATE`; `IsLocked BIT DEFAULT 0`; `Status NVARCHAR(20) DEFAULT 'Open'`; `IsCurrent BIT DEFAULT 0`.
- `Status`/`IsCurrent` retro-added by migs 003 and 006.
- **Filtered unique indexes:** `UX_FiscalYears_OneOpen` WHERE `Status='Open'` (:142); `UX_FiscalYears_OneCurrent` WHERE `IsCurrent=1` (:147). Enforce at most one Open and one Current year (K-006).

### `dbo.CostCenterSubmissionStatus` — schema.sql:331 / mig 006:63
- Composite PK `(CostCenterId, FiscalYearId)`; `Status NVARCHAR(30) DEFAULT 'NotStarted'`; `UpdatedAt`.
- FKs to `CostCenters` and `FiscalYears`. Derived projection of budget status (see `submissionStatusForBudget`, `docs/state-machines.md`).

---

## 3. Identity / RBAC tables

### `dbo.Users` — schema.sql:52
- Columns: `UserId` PK; `Name`; `Email NVARCHAR(256)` (UNIQUE `UQ_Users_Email`); `PositionId` NOT NULL; `ManagerId NULL` (self-ref); `DepartmentId` NOT NULL; `PrimaryCostCenterId` NOT NULL; `Active BIT DEFAULT 1`; `IsDeleted`; `DeletedAt`; `CreatedAt`; `UpdatedAt`.
- Auth columns via mig 001: `PasswordHash NVARCHAR(500) NULL`, `EmailVerifiedAt DATETIME2 NULL`.
- FKs: Position, **Manager → Users(UserId) self-reference** (the org tree — ADR-002), Department, CostCenter.
- Index: `IX_Users_ManagerId` (:69) — powers the `managerId` approval walk.
- **`ManagerId IS NULL` marks the org root (GM)** — ADR-007.

### `dbo.Roles` / `dbo.Permissions` — schema.sql:75 / :85
- Both `Code` UNIQUE catalogs. Seeded permissions include `admin.masterdata` (mig 006:76) and `finance.claim`/`finance.finalize`/`finance.return` (mig 007:211+).

### `dbo.RolePermissions` — schema.sql:95 / `dbo.UserRoles` — schema.sql:105
- Composite-PK join tables with FKs to both sides.

---

## 4. Budget tables

### `dbo.BudgetPlans` — schema.sql:153
Core record; one row per **budget version**.
- Base columns: `BudgetPlanId` PK; `OwnerId`; `CostCenterId`; `FiscalYearId`; `BudgetType NVARCHAR(50)` (catalog codes `RECURRENT`/`MAJOR`/`CAPEX` via `BUDGET_TYPE_CATALOG`; legacy strings read-only on historical rows; future v2 may add `dbo.BudgetTypes` lookup); `FromPeriod DATE`; `ToPeriod DATE`; `Description NVARCHAR(1000) NULL`; `Status NVARCHAR(30)`; `CurrentApproverId NULL`; `SubmittedAt NULL`; `SapVersion NULL`; `CreatedAt`; `UpdatedAt`; `RowVersion ROWVERSION`; `Version INT DEFAULT 1` (optimistic concurrency).
- Versioning/finance columns (mig 007): `LineageId NULL`; `ParentBudgetPlanId NULL`; `LineageRevision INT DEFAULT 1`; `VersionLabel NULL`; `AmendmentReason NULL`; `IsArchived BIT DEFAULT 0`; `ArchivedAt NULL`; `ClaimDueAt NULL`; `ReviewDueAt NULL`; `EscalationStatus NVARCHAR(20) DEFAULT 'None'`; `FinanceClaimedAt NULL`; `FinanceClaimedBy NULL`.
- Dev-toolkit columns (mig 008): `IsDemo`; `CreatedByToolkit`; `DemoBatchId`.
- FKs: Owner, CostCenter, FiscalYear, CurrentApprover (→ Users), Lineage (→ BudgetLineage, mig 007:312).
- Indexes: `IX_BudgetPlans_Status_CostCenter` (:174); `IX_BudgetPlans_CurrentApproverId` (:178); `IX_BudgetPlans_FiscalYear_Status` (:182); `IX_BudgetPlans_IsDemo` filtered WHERE `IsDemo=1` (mig 008:24).
- **Active-uniqueness index (evolved):** original `UX_BudgetPlans_ActiveUnique` on `(CostCenterId, FiscalYearId, BudgetType)` (schema.sql:191) was **dropped** by mig 007:89 and replaced with `UX_BudgetPlans_LineageInPlay` on `(LineageId)` WHERE `LineageId IS NOT NULL AND IsArchived=0 AND Status NOT IN (Rejected, Finalized, Approved)` (mig 007:93). This enforces one active version per lineage (K-002, ADR-006).
- `Status` values: see `docs/state-machines.md`. `Approved` is deprecated (migration-read only).

### `dbo.BudgetItems` — schema.sql:198
- Columns: `BudgetItemId` PK; `BudgetPlanId`; `GlAccountId`; `Amount DECIMAL(18,2)`; `LineNumber INT`.
- FKs: `Plan → BudgetPlans ON DELETE CASCADE` (:200); `Gl → GlAccounts` (:201).
- CHECK: `CK_BudgetItems_Amount CHECK (Amount > 0)` (:202). UNIQUE: `UQ_BudgetItems_Plan_Line (BudgetPlanId, LineNumber)` (:204). Index `IX_BudgetItems_BudgetPlanId` (:209).

### `dbo.BudgetLineage` — mig 007:14
- One lineage per (CostCenter, FiscalYear, OriginalBudgetType). Columns: `LineageId` PK; `CostCenterId`; `FiscalYearId`; `OriginalBudgetType`; `BudgetNumber` (UNIQUE); `CurrentVersionId NULL`; `LatestFinalizedVersionId NULL`; `IsArchived`; `ArchivedAt`; `CreatedAt`.
- FKs to CostCenter, FiscalYear, and both version pointers → BudgetPlans (mig 007:317/322).
- **Filtered unique:** `UX_BudgetLineage_Key` on `(CostCenterId, FiscalYearId, OriginalBudgetType)` WHERE `IsArchived=0` (mig 007:30) — one live lineage per business key (ADR-005).

### `dbo.FinanceQueueClaims` — mig 007:106
- Columns: `ClaimId` PK; `BudgetPlanId`; `ClaimedBy`; `ClaimedAt`; `ReleasedAt NULL`; `IsActive BIT DEFAULT 1`.
- FKs: Plan → BudgetPlans, User → Users.
- **Filtered unique:** `UX_FinanceQueueClaims_ActivePlan` on `(BudgetPlanId)` WHERE `IsActive=1` (mig 007:117) — at most one active claim per plan (ADR-004). Release sets `IsActive=0, ReleasedAt`.

### `dbo.ApprovalRoute` — schema.sql:215
- Columns: `RouteId` PK; `BudgetPlanId`; `ApproverId`; `Sequence INT`; `Status NVARCHAR(30)`.
- FKs: Plan, Approver → Users. UNIQUE `UQ_ApprovalRoute_Plan_Sequence` (:221). Index `IX_ApprovalRoute_BudgetPlanId_Sequence` (:226).
- Step status: `Pending → Approved | Rejected | Invalidated` (`docs/state-machines.md`).

---

## 5. Attachment / SAP tables

### `dbo.BudgetAttachmentCategories` — mig 007:155
- `CategoryId` PK; `Code` (UNIQUE); `Name`; `IsActive`. Seeded e.g. BusinessCase, VendorQuote (mig 007:328+).

### `dbo.BudgetTypeAttachmentRequirements` — mig 007:166
- Composite PK `(BudgetType, CategoryId)`; FK → categories. Maps required categories per budget type (finalize gating, ADR-008).

### `dbo.BudgetAttachments` — mig 007:176
- Columns: `AttachmentId` PK; `BudgetPlanId`; `CategoryId`; `FileName`; `ContentType`; `FileSizeBytes INT`; `Sha256 NVARCHAR(64)`; `Content VARBINARY(MAX)`; `Source NVARCHAR(20) DEFAULT 'Uploaded'`; `InheritedFromAttachmentId NULL`; `UploadedBy`; `UploadedAt`; `IsArchived`; `ArchivedAt`.
- FKs: Plan, Category, User. `InheritedFromAttachmentId` has **no FK** (intent UNKNOWN). Storage model = ADR-008 (`VARBINARY(MAX)` in SQL; DB backup is attachment backup). Upload UX/API may be deferred per ADR-008.

### `dbo.SapPackages` — mig 007:198
- Columns: `SapPackageId` PK; `BudgetPlanId` (UNIQUE `UQ_SapPackages_BudgetPlan`); `SapReference NVARCHAR(50)`; `PackageJson NVARCHAR(MAX)`; `CsvContent NVARCHAR(MAX)`; `GeneratedAt`; `GeneratedBy`.
- FK: User. **No explicit FK on `BudgetPlanId`** (unique only). Frozen at finalize (see WORKFLOWS WF-007/WF-018).

---

## 6. Immutable history & audit tables

### `dbo.ApprovalHistory` — schema.sql:232
- Columns: `ApprovalHistoryId` PK; `BudgetPlanId`; `PerformedBy`; `Action NVARCHAR(50)`; `PreviousStatus`; `NewStatus`; `Comment NULL`; `[Timestamp]`.
- FKs: Plan, User. Index `IX_ApprovalHistory_BudgetPlanId_Timestamp` (:245).
- **Immutable:** trigger `TR_ApprovalHistory_NoUpdateDelete` INSTEAD OF UPDATE, DELETE → RAISERROR + ROLLBACK (schema.sql:358); also `DENY UPDATE, DELETE` for `app_budget_ops_role` (mig 005:55). ADR-011.

### `dbo.WorkflowHistory` — mig 007:126
- Columns: `WorkflowHistoryId` PK; `BudgetVersionId`; `Stage NVARCHAR(50)`; `ActorId`; `Action NVARCHAR(50)`; `Comment NULL`; `[Timestamp]`.
- FKs: Plan (on `BudgetVersionId`), Actor → Users. Index `IX_WorkflowHistory_BudgetVersion` (:138).
- **Immutable:** trigger `TR_WorkflowHistory_NoUpdateDelete` (mig 007:143). No matching role DENY found (**UNKNOWN** whether intended).

### `dbo.AuditLogs` — schema.sql:251
- Columns: `AuditLogId` PK; `Entity NVARCHAR(100)`; `EntityId UNIQUEIDENTIFIER`; `Action NVARCHAR(100)`; `PerformedBy`; `IpAddress NVARCHAR(64) NULL`; `CorrelationId UNIQUEIDENTIFIER`; `BeforeJson NVARCHAR(MAX) NULL`; `AfterJson NVARCHAR(MAX) NULL`; `[Timestamp]`.
- FK: User. Indexes `IX_AuditLogs_CreatedAt` on `[Timestamp] DESC` (:266); `IX_AuditLogs_Entity (Entity, EntityId)` (:270).
- **Immutable:** trigger `TR_AuditLogs_NoUpdateDelete` (schema.sql:349); `DENY UPDATE, DELETE` for app role (mig 005:54). ADR-011.

> **Immutability triggers must be temporarily disabled only through
> `scripts/lib/test-database-cleaner.ts`** for test teardown — never inline. See
> `docs/ENGINEERING_BRAIN.md` §13.

---

## 7. Notifications

### `dbo.Notifications` — schema.sql:276
- Base columns: `NotificationId` PK; `UserId`; `Type NVARCHAR(50)`; `Title NVARCHAR(200)`; `Body NVARCHAR(1000)`; `Priority NVARCHAR(20) DEFAULT 'Medium'`; `Category NVARCHAR(30) DEFAULT 'Budget'`; `ActionLabel NVARCHAR(100) DEFAULT 'View'`; `RelatedBudgetPlanId NULL`; `EntityType NVARCHAR(30) NULL`; `EntityId NVARCHAR(100) NULL`; `TargetUrl NVARCHAR(400) NULL`; `IsRead BIT DEFAULT 0`; `ReadAt NULL`; `ResolvedAt NULL`; `ResolvedBy NULL`; `ExpiresAt NULL`; `CreatedAt`.
- Migration-added: `IsCleared`/`ClearedAt`/`ClearedReason` (mig 008:29+, **not** in schema.sql); task cols `EntityType/EntityId/TargetUrl/ReadAt/ResolvedAt` (mig 010); metadata `Priority/Category/ActionLabel/ResolvedBy(+FK)/ExpiresAt` (mig 011).
- FKs: User; ResolvedBy → Users. Indexes `IX_Notifications_UserId_IsRead` (:302); `IX_Notifications_UserId_Resolved` (:307 / mig 010:46).
- Lifecycle semantics (K-001, K-009): active = `ResolvedAt IS NULL AND IsCleared=0`. Badge counts active regardless of read state. Duplicate-task guard enforced in repository `create`, not by a DB constraint. See WORKFLOWS WF-011.

---

## 8. Auth / support tables

### `dbo.AuthTokens` — mig 001:16
- `AuthTokenId` PK; `UserId`; `Type NVARCHAR(30)` (`verify-email` | `reset-password`); `TokenHash NVARCHAR(128)`; `ExpiresAt`; `UsedAt NULL`; `CreatedAt`. FK → Users. Indexes on `TokenHash` and `UserId`.

### `dbo.SupportIssues` — mig 009:6
- Ticketing with screenshot blob + page/context refs + admin notes. Key columns: `SupportIssueId` PK; `ReferenceNumber NVARCHAR(32)` (UNIQUE `UX_SupportIssues_Reference`); `Title`; `Description NVARCHAR(4000)`; `Category`; `Priority`; `Status NVARCHAR(20) DEFAULT 'Open'`; `ReportedBy`; `AssignedTo NULL`; page/context (`PagePath`, `PageLabel`, `BudgetPlanId`, `FiscalYearId`, `CostCenterId`, `Browser`, `AppVersion`, `CorrelationId`); `AdminNotes`; screenshot (`ScreenshotFileName`, `ScreenshotContentType`, `ScreenshotContent VARBINARY(MAX)`); `CreatedAt`; `UpdatedAt`; `ClosedAt NULL`.
- FKs: ReportedBy, AssignedTo → Users. `BudgetPlanId/FiscalYearId/CostCenterId` nullable, **no FKs**. Indexes on `(ReportedBy, CreatedAt DESC)` and `(Status, CreatedAt DESC)`.

### `dbo.SupportIssueSequence` — mig 009:42
- `YearLabel INT` PK; `LastValue INT DEFAULT 0`. Per-year counter for reference numbers.

---

## 9. Migrations & schema version

### Migration ledger (`docs/migrations/`, in order)

| Ver | File | Adds |
|-----|------|------|
| 001 | `001-auth.sql` | `Users.PasswordHash`/`EmailVerifiedAt`; `AuthTokens` (+2 indexes) |
| 002 | `002-budget-description.sql` | `BudgetPlans.Description` (legacy DBs) |
| 003 | `003-fiscal-year-status.sql` | `FiscalYears.Status` (backfill from `IsLocked`) |
| 004 | `004-cost-center-manager.sql` | `CostCenters.ManagerId` (nullable, no FK) |
| 005 | `005-app-budget-ops-role.sql` | Least-privilege `app_budget_ops` login/role; DENY UPDATE/DELETE on AuditLogs + ApprovalHistory |
| 006 | `006-master-data.sql` | `Departments.IsActive`; `CostCenters.ResponsiblePersonId` (+FK); `FiscalYears.IsCurrent`; FY filtered indexes; `CostCenterSubmissionStatus`; `admin.masterdata` perm |
| 007 | `007-budget-lineage-finance.sql` | Versioning/finance columns; `BudgetLineage`, `FinanceQueueClaims`, `WorkflowHistory` (+trigger), attachment tables, `SapPackages`; swaps active-unique → lineage index; finance perms; lineage backfill |
| 008 | `008-development-toolkit.sql` | `BudgetPlans.IsDemo/CreatedByToolkit/DemoBatchId` (+index); `Notifications.IsCleared/ClearedAt/ClearedReason` |
| 009 | `009-support-issues.sql` | `SupportIssues` (+indexes, unique ref); `SupportIssueSequence` |
| 010 | `010-notification-tasks.sql` | `Notifications.EntityType/EntityId/TargetUrl/ReadAt/ResolvedAt`; `IX_Notifications_UserId_Resolved` |
| 011 | `011-notification-task-metadata.sql` | `Notifications.Priority/Category/ActionLabel/ResolvedBy(+FK)/ExpiresAt` |
| 012 | `012-schema-version.sql` | Creates `dbo.SchemaVersion`; backfills 001–012 |

### `dbo.SchemaVersion` mechanism
- Table `dbo.SchemaVersion(Version PK, AppliedAt, AppliedBy, FileName)` — schema.sql:314 / mig 012:10. Persisted ledger of applied versions.
- **Ordered source of truth (code):** `src/infrastructure/migrations/registry.ts` — `MIGRATIONS` array (registry.ts:11), `EXPECTED_SCHEMA_VERSION = "012"` (registry.ts:35), helpers `parseMigrationVersionFromPath`, `pendingMigrations`, `latestAppliedVersion`.
- **Apply path:** `scripts/apply-migration.ts` runs each `GO` batch, then records the version idempotently (`AppliedBy = %USERNAME%`). `npm run db:migrate` = `scripts/migrate-all.ts` applies all pending.
- **Startup validation:** `src/infrastructure/startup/database-health.ts` reads applied versions, computes `pendingMigrations`, and **refuses SQL startup** if migrations are pending or `schemaVersion < EXPECTED_SCHEMA_VERSION` (ADR-009; this subsystem is FROZEN).

---

## 10. Consolidated: constraints that enforce business rules

| DB object | Enforces | Business rule |
|-----------|----------|---------------|
| `UX_BudgetPlans_LineageInPlay` | one active version per lineage | K-002, ADR-006 |
| `UX_BudgetLineage_Key` | one live lineage per (CC,FY,type) | ADR-005 |
| `UX_FinanceQueueClaims_ActivePlan` | one active finance claim per plan | ADR-004 |
| `UX_FiscalYears_OneOpen` / `UX_FiscalYears_OneCurrent` | one Open / one Current FY | K-006 |
| `UQ_SapPackages_BudgetPlan` | one frozen SAP package per plan | ADR-004/008 |
| `CK_BudgetItems_Amount` | amount > 0 per line | domain invariant |
| `TR_AuditLogs_/ApprovalHistory_/WorkflowHistory_NoUpdateDelete` | append-only history | ADR-011 |
| `RowVersion` + `BudgetPlans.Version` | optimistic concurrency (409) | domain-model invariants |

## 11. UNKNOWN / absent (verified as such)
- No `Sessions` table (cookies, not table-backed).
- Missing FKs on: `BudgetAttachments.InheritedFromAttachmentId`, `SapPackages.BudgetPlanId` (unique only), `SupportIssues.BudgetPlanId/FiscalYearId/CostCenterId`, `CostCenters.ManagerId`, `BudgetPlans.ParentBudgetPlanId`, `BudgetPlans.FinanceClaimedBy` — intent UNKNOWN.
- No role-level DENY for `WorkflowHistory` (only the trigger) — intent UNKNOWN.

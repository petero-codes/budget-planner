# Changelog

## 2026-07-22 — Budget Category domain rename

### BREAKING CHANGE

JSON field `budgetType` renamed to `budgetCategory` on budget plan create/update and read APIs.
Finance dashboard aggregate `byBudgetType` renamed to `byBudgetCategory`.

**Affected endpoints:** `POST /api/v1/budget-plans`, `PATCH /api/v1/budget-plans/:id`, budget plan GET
responses, `GET /api/v1/finance/dashboard`, `GET /api/v1/finance/approved`.

See `docs/api-contracts.md` and `docs/release-notes/budget-category-rename.md`.

### Added

- Enriched budget category catalog (`order`, `color`, `shortLabel`, display helpers).
- Finance **Budget Category Distribution** with explicit **All** filter and legacy category section.
- Reports legacy category aggregates when historical rows exist.

### Changed

- Domain entities use `budgetCategory` / `originalBudgetCategory`; SQL columns `BudgetType` unchanged.

## 2026-07-18 — Notification bell dropdown, duplicate-task guard, approval deep-link

### Added

- Header bell now opens a dropdown of active tasks (priority dot, action label, relative time, "View all notifications"). Opening it never removes anything; clicking an item marks it read, refreshes the badge, and navigates to the work item.
- Duplicate-task guard (K-009): repositories refuse a second ACTIVE notification for the same recipient + type + plan/entity. SQL enforces it in one atomic `INSERT … WHERE NOT EXISTS`; informational types may still repeat; a resolved task never blocks a fresh one.
- Approval notifications deep-link to `/budgets/{id}?action=approve`; the budget page scrolls to and highlights the Decision panel when the pending approver arrives via that link.
- Unit tests: `tests/unit/notification-dedup.test.ts`. Harness: SQL-level duplicate-create no-op check (62 service-level checks total).

## 2026-07-18 — Startup fail-fast & schema versioning

### Changed

- `REPOSITORY_DRIVER` is now **required** (no silent default to mock). Production still requires `sql`. Development must choose `mock` **or** `sql` explicitly. Amended ADR-009.
- One DI singleton remains the only place repositories are constructed (`src/infrastructure/di.ts`).
- Startup (`src/instrumentation.ts`) validates environment + database readiness and prints an aligned `SYSTEM STARTUP` report before serving: environment, version + git commit/branch (env vars first; git commands are never spawned in production), repository driver, database driver/name/authenticated user (`SUSER_SNAME()`), connection + pool, schema vs expected, pending migrations, required tables **and required columns** (a table existing without its migration columns fails startup), seed presence across six core tables (Users, Roles, Permissions, Departments, CostCenters, FiscalYears — empty tables warn, they don't block), explicit `WARNING (Development Fallback in use)` wording for fallbacks, DI verification (repositories and critical services must be *verified* — constructed with callable methods — plus one cheapest-possible live read per critical repository: users, budgets, notifications, audits, fiscal years; optional services like the development toolkit only warn), connection pool state (connected + min/max, not just "OK"), a `Checks Passed / Warnings / Failures` summary derived dynamically from the graded checks, and startup time in ms with per-phase timings (database validation, DI initialization) logged separately. Pending migrations, missing columns, unusable critical services, or a failed smoke read refuse SQL startup; optional-service failures do not.
- `GET /api/v1/system/database-health` is now an authenticated diagnostics endpoint: unauthenticated probes get bare `{ status }` only; signed-in users get operational detail. Server hostname removed from the payload; connection strings, SQL version, and filesystem paths were never exposed.
- `dbo.SchemaVersion` tracks applied migrations (migration `012`). Registry: `src/infrastructure/migrations/registry.ts`. Apply with `npm run db:migrate`.
- Startup validation subsystem is **FROZEN (2026-07-18)** — see ADR-009 "Subsystem status". Further changes only for verified bugs, new migrations, deployment requirements, or regressions. Pool metrics are read via a single typed helper (`getConnectionPoolState` in `pool.ts`); the msnodesqlv8 typing cast stays inside that helper. Client **and edge** webpack builds alias `mssql`/`msnodesqlv8`/`child_process` to `false` so the native SQL driver cannot enter a browser or edge bundle (middleware forces an edge compilation that also compiles `instrumentation.ts`); `instrumentation.ts` imports `child_process` via the bare specifier so `next build`'s edge compiler does not choke on a `node:` URI.

### Added

- `npm run db:migrate`, `npm run db:reseed` (alias of seed).
- Unit tests: `tests/unit/startup-env.test.ts`.

### Still incomplete (documented, not in this pass)

- Repository contract tests against both mock and SQL.
- CI pipeline (migrate → seed → test).
- Scheduled / production integrity-check runner (toolkit integrity exists, not startup-wired for prod).

## 2026-07-18 — Task-oriented notifications

### Changed

- Notifications are now a to-do list, not a message feed. A notification stays active until the underlying work is complete for that recipient; reading it no longer removes it.
  - New task fields: `message`, `priority`, `category`, `entityType`, `entityId`, `targetUrl`, `actionLabel`, `readAt`, `resolvedAt`, `resolvedBy`, and optional `expiresAt` (see migrations `010` and `011`, plus `docs/schema.sql`).
  - Every notification carries a `targetUrl`; clicking marks it read and navigates directly (budgets → `/budgets/{id}`, finance queue → `/finance?planId={id}`, users → `/admin/users/{id}`, fiscal years → `/admin/fiscal-years`, issues → `/admin/support` or `/support`).
  - Workflow transitions auto-resolve the recipient's task and record `resolvedBy`: approve, final approval, return, reject, Finance claim/finalize/return/release, support ticket resolve, fiscal-year close.
  - Finance claim collapses the shared queue and raises a personal "Budget assigned to you" item; release re-opens the queue.
  - Actionable items (approval / finance queue / finance claim / escalation / support / fiscal-year closure) can never be manually cleared while pending; informational outcomes are acknowledged on read.
  - Badge counts active (unresolved) notifications regardless of read state.
- New notification sources: admin user created (to other System Admins) and fiscal-year "requires closure" task (on `setCurrent` when a prior year is still Open; resolved on close).
- Notifications page: To-do / History tabs, priority/category indicators, task-specific action labels, click-to-open, and "Mark all as read".
- Repository API: `dismissForPlan` → `resolveForPlan`; added `resolveForEntity`, `resolveOwn`, `markAllRead`, `archiveResolved`; `markRead`/`listByUser` signatures updated.

### Known gap

- A time-based "fiscal year period ended → requires closure" reminder needs a scheduled job (none exists); the closure task is currently raised only on the `setCurrent` event. Marked INCOMPLETE pending a scheduler.

## 2026-07-17 — Feature E2E proof standard

### Added

- `docs/feature-e2e-proof.md` — inventory of critical features with COMPLETE / INCOMPLETE under a 12-point trace (UI → API → service → domain → repo → DB → audit → notifications → permission → test → manual → expected).
- Cursor rule `.cursor/rules/feature-e2e-proof.mdc` — agents must not claim completeness without that trace.
- Definition of Done + governance updated to bind the proof rule.

### Explicit non-claim

- Western Region seed user is **not** implemented and will not be added unless requested.

## 2026-07-17 — ADR-009 sync & release execution framing

### Changed

- ADR-009 Consequences aligned with live `assertProductionSqlDriver()` fail-closed behavior in `di.ts` (ADR-013).
- Engineering governance and staging acceptance: formal critical spine + path to `v1.0.0` (execution only; no further architecture).
- Repository cleanup note: manual validation framed as release-gate evidence for `staging-e2e-acceptance.md`, not a personal checklist.

## 2026-07-17 — Repository cleanup (stabilization)

### Removed

- Public self-service auth surfaces (register / forgot / reset / verify-email pages and APIs) and unused `mailer.ts`.
- One-time button-audit scripts/dumps and dated agent audit markdown (not source of truth).
- Dead auth helpers (token generation, unused auth-store methods).

### Changed

- Auth schemas and middleware rate limits narrowed to login-only.
- Docs / README / `.env.example` updated for admin-provisioned accounts (no SMTP mail-link config).
- Empty `src/pages/` kept via `.gitkeep` (Next.js still scans the folder in dev).

### Added

- `docs/repository-cleanup.md` — removal inventory, rationale table, and verification gates.
- `src/lib/security/client-ip.ts` — shared client IP helper for rate limiting / audit.

See `docs/repository-cleanup.md` and `docs/security-checklist.md`.

## 2026-07-16 — Engineering governance & release milestones

### Added

- `docs/ENGINEERING_GOVERNANCE.md` — stabilization rules, Documentation Consistency Policy, and Milestones 1–4 (Code Complete → Production).
- ADR-013 / ADR-014 in `docs/ARCHITECTURE_DECISIONS.md` (documentation consistency; release milestones).

### Changed

- `docs/ai-guardrails.md`, `docs/definition-of-done.md`, and `README.md` now point at governance and the current **Milestone 2 — Stabilization** finish line.

## 2026-07-16 — Active budget conflict UX

### Changed

- Creating a budget draft now checks for an existing active plan
  `(CostCenter + FiscalYear + BudgetType)` before insert and returns
  **409 `ACTIVE_BUDGET_EXISTS`** with the existing budget’s id, status, and
  ownership details — never a raw SQL unique-index error.
- Create Budget form detects the conflict up front, disables Save/Submit, and
  offers **Open Existing Budget** / **Cancel**.

## 2026-07-15 — Organizational master data complete

### Added

- SystemAdmin can create, edit, and archive **Departments** and **Cost Centers**.
- Cost Center ownership is explicit: **Manager** (approver) and **Responsible Person** (Budget Holder / submitter) are independent fields.
- **Financial Years** now carry an explicit `IsCurrent` flag; at most one year may be Open and at most one may be Current (enforced in service + DB filtered unique indexes).
- Stored **CostCenterSubmissionStatus** per `(CostCenter, FiscalYear)`, updated on draft create/edit and every approval-workflow transition.
- Mid-cycle ownership reassignment is blocked while a budget is Draft / InApproval / ReturnedForRevision.
- Admin portal tabs: Users · Departments · Cost Centers · Financial Years.
- Migration `docs/migrations/006-master-data.sql` and permission `admin.masterdata`.

### Fixed

- Login 500 caused by SQL Server running in Windows Authentication-only mode. Mixed-mode auth was enabled and `MSSQL$SQLEXPRESS` restarted so the least-privilege `app_budget_ops` SQL login can authenticate. Migration `005-app-budget-ops-role.sql` was applied.

## 2026-07-15 — System Administrator account management

### Added

- SystemAdmin user administration for account creation, identity and reporting-line maintenance, cost-center and role assignment, activation/deactivation, and temporary-password resets.
- User-management audit entries and safeguards against hierarchy cycles, self-lockout, removing the last active administrator, and deactivating users who still have active direct reports or pending approvals.

### Changed

- Public account registration and self-service password reset are disabled; the login page directs users to the System Administrator.
- “Remove user” is a non-destructive deactivation so historical budgets, approvals, and audit identities remain intact.

## 2026-07-15 — Bucket 1 remediation (audit)

### Fixed

- **Optimistic concurrency on BudgetPlans:** updates now use `WHERE Version = @expectedVersion` and `SET Version = Version + 1` in SQL (and equivalent check-then-increment in the mock repository). Stale writers throw `ConcurrencyConflictError`, mapped to HTTP **409** with `error.code = BUDGET_CONFLICT`. Application code no longer increments `version` in memory before save.
- **SQL transient retry:** repository requests retry up to 3 times with 100/300/900ms backoff on transient SQL errors (-2, 1205, 40501, 40613, …). Non-transient errors (constraints, business logic) are not retried. Each retry is logged at WARN with `correlationId`.
- **Audit immutability second control:** added `docs/migrations/005-app-budget-ops-role.sql` creating `app_budget_ops` login/user/role with least-privilege grants and explicit `DENY UPDATE, DELETE` on `AuditLogs` and `ApprovalHistory` (alongside existing INSTEAD OF triggers). `.env.example` / README updated to use SQL auth for the app runtime.

### Documentation

- Documented actual `UX_BudgetPlans_ActiveUnique` semantics in `docs/schema.sql`, `docs/domain-model.md`, and `docs/strategies.md` (no index logic change — post-Approved second cycle remains Bucket 2).

### Tests

- `tests/unit/concurrency-and-retry.test.ts`: stale-version save conflict; concurrent approve (one success / one `BUDGET_CONFLICT`); transient retry helper behavior.

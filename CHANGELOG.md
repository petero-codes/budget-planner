# Changelog

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

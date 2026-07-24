# TRACKING_MAP.md — Find anything by category

**Purpose:** One-page index to locate files by **Frontend**, **UI**, **Backend**, or **Explanation**.
Use this for day-to-day tracking. Folder layout stays as-is (Next.js routes + Clean Architecture).

**Related:** `docs/FILE_INDEX.md` (deep detail) · `docs/DEPENDENCY_MAP.md` (import wiring)

---

## Quick legend

| Category | What it is | Where it lives |
|----------|------------|----------------|
| **Frontend** | Screens users open in the browser (URLs) | `src/app/**/page.tsx` |
| **UI** | Reusable React components (no routes) | `src/components/**` |
| **Backend — API** | HTTP handlers (thin; call services via DI) | `src/app/api/v1/**/route.ts` |
| **Backend — Application** | Use-case orchestration | `src/application/**` |
| **Backend — Domain** | Business rules & types (pure) | `src/domain/**` |
| **Backend — Infrastructure** | DB, auth, DI, migrations | `src/infrastructure/**` |
| **Backend — Lib** | Shared helpers (client vs server split) | `src/lib/**` |
| **Tests** | Vitest unit/integration | `tests/**` |
| **Scripts** | DB seed, migrations, CI guards | `scripts/**` |
| **Explanation** | Docs, ADRs, governance, schema | `docs/**` |

---

## Frontend — portal pages (authenticated)

| Route | File | Notes |
|-------|------|-------|
| `/home` | `src/app/(portal)/home/page.tsx` | Role dashboard entry |
| `/budgets` | `src/app/(portal)/budgets/page.tsx` | My budgets list (DataTable) |
| `/budgets/create` | `src/app/(portal)/budgets/create/page.tsx` | New budget form |
| `/budgets/[id]` | `src/app/(portal)/budgets/[id]/page.tsx` | Budget detail / edit |
| `/approvals` | `src/app/(portal)/approvals/page.tsx` | Pending approvals inbox |
| `/finance` | `src/app/(portal)/finance/page.tsx` | Finance queue (DataTable) |
| `/finance/sap/[id]` | `src/app/(portal)/finance/sap/[id]/page.tsx` | SAP export form |
| `/reports` | `src/app/(portal)/reports/page.tsx` | Reports (DataTable × 3 views) |
| `/audit` | `src/app/(portal)/audit/page.tsx` | Audit log viewer |
| `/notifications` | `src/app/(portal)/notifications/page.tsx` | Notification centre |
| `/profile` | `src/app/(portal)/profile/page.tsx` | User profile |
| `/admin` | `src/app/(portal)/admin/page.tsx` | Admin hub |
| `/admin/users/[id]` | `src/app/(portal)/admin/users/[id]/page.tsx` | User admin |
| `/admin/fiscal-years` | `src/app/(portal)/admin/fiscal-years/page.tsx` | Fiscal year admin |
| `/admin/development` | `src/app/(portal)/admin/development/page.tsx` | Dev toolkit UI |
| `/access-denied` | `src/app/(portal)/access-denied/page.tsx` | RBAC denial |

**Frontend — public**

| Route | File |
|-------|------|
| `/` | `src/app/page.tsx` (redirect) |
| `/login` | `src/app/login/page.tsx` |

**Frontend — shell & errors**

| File | Role |
|------|------|
| `src/app/(portal)/layout.tsx` | Portal chrome wrapper |
| `src/app/layout.tsx` | Root layout |
| `src/app/(portal)/error.tsx` | Portal error boundary |
| `src/app/error.tsx` | Global error boundary |
| `src/app/not-found.tsx` | 404 |
| `src/middleware.ts` | Session gate, rate limits, coarse RBAC |

---

## UI — components

### Primitives (`src/components/ui/`)

| File | Purpose |
|------|---------|
| `button.tsx` | KenGen semantic button variants |
| `data-table.tsx` | Enterprise table (search, sort, pagination, skeleton) |
| `text-field.tsx` | Form text input |
| `glass-select.tsx` | Styled select |

### Layout (`src/components/layout/`)

| File | Purpose |
|------|---------|
| `app-shell.tsx` | Main portal shell |
| `header.tsx` | Top bar |
| `sidebar.tsx` | Navigation sidebar |
| `footer.tsx` | Footer |
| `user-dropdown.tsx` | Account menu |
| `notification-bell.tsx` | Header notification icon |

### Shared (`src/components/shared/`)

| File | Purpose |
|------|---------|
| `page-shell.tsx` | Page wrapper + spacing |
| `page-header.tsx` | Title + actions row |
| `empty-state.tsx` | No-data placeholder |
| `status-chip.tsx` | Budget/workflow status badge |
| `skeleton-table.tsx` | Loading placeholder (legacy; DataTable has built-in skeleton) |

### Feature components

| Folder | Files | Used by |
|--------|-------|---------|
| `auth/` | `auth-shell.tsx`, `form-alert.tsx` | Login |
| `budget/` | `budget-plan-form.tsx`, `approval-timeline.tsx` | Budget create/detail |
| `dashboard/` | `gm-dashboard.tsx` | Home (GM view) |
| `admin/` | `confirm-dialog.tsx` | Admin destructive actions |

---

## Backend — API routes (`src/app/api/v1/`)

Grouped by domain. Each `route.ts` is thin → `src/infrastructure/di.ts`.

| Group | Endpoints (folder) |
|-------|-------------------|
| **Auth** | `auth/login`, `auth/logout`, `me` |
| **Budget plans** | `budget-plans/`, `budget-plans/[id]/` (+ submit, approve, reject, return, amend, compare, history, workflow, sap-form, sap-export, finance/*) |
| **Approvals** | `approvals/pending` |
| **Finance** | `finance/queue`, `finance/approved`, `finance/dashboard`, `finance/escalations` |
| **Fiscal years** | `fiscal-years/`, `fiscal-years/[id]/[action]` |
| **Admin** | `admin/users/`, `admin/departments/`, `admin/cost-centers/`, `admin/fiscal-years/`, `admin/submission-status` |
| **Executive** | `executive/overview`, `executive/departments/[id]`, `executive/cost-centers/[id]` |
| **Dashboard** | `dashboard` |
| **Reports** | `reports/budgets` |
| **Notifications** | `notifications` |
| **Audit** | `audit` |
| **Reference** | `reference` |
| **System** | `system/database-health` |
| **Development** | `development/*` (health, diagnostics, sessions, workflow simulate, fiscal-year tools, budget tools, reseed) |

---

## Backend — application services (`src/application/`)

| File | Responsibility |
|------|----------------|
| `authorization-service.ts` | Permissions & scope checks |
| `approval-service.ts` | Submit, approve, return, reject |
| `budget-plan-service.ts` | Draft CRUD, submit, amend |
| `finance-service.ts` | Claim, release, finalize, return, escalations |
| `fiscal-year-service.ts` | Open/close/reopen fiscal years |
| `master-data-service.ts` | Departments, cost centres, submission status |
| `admin-user-service.ts` | User provisioning & password reset |
| `dashboard-service.ts` | Role dashboards |
| `executive-service.ts` | Executive rollups |
| `sap-compliance-service.ts` | SAP form / CSV / Excel export |
| `version-compare-service.ts` | Budget version diff |
| `workflow-recorder.ts` | Workflow history + finance fan-out |
| `notification-task-actions.ts` | Mark read / navigation helpers |
| `development/development-toolkit-service.ts` | Dev-only tooling |
| `*-error.ts`, `active-budget-conflict.ts` | Typed application errors |

---

## Backend — domain (`src/domain/`)

| Area | Path | Examples |
|------|------|----------|
| Entities | `entities/index.ts` | Budget, User, Notification types |
| Value objects | `value-objects/` | `money.ts`, `budget-status.ts`, `period-range.ts` |
| Rules | `rules/` | `build-approval-route.ts`, `budget-plan-invariants.ts`, `finance-sla.ts` |
| Constants | `constants/budget-types.ts` | `RECURRENT` / `MAJOR` / `CAPEX` catalog |

---

## Backend — infrastructure (`src/infrastructure/`)

| Path | Role |
|------|------|
| `di.ts` | **Composition root** — wire all services & repos |
| `session.ts` | Signed session cookies |
| `auth/auth-store.ts` | Credential lookup |
| `repositories/interfaces.ts` | Repository ports |
| `repositories/sql/` | SQL Server implementations |
| `repositories/mock/` | In-memory driver (tests/dev) |
| `startup/` | Env validation, DB health (**Frozen**) |
| `migrations/registry.ts` | Schema version registry (**Frozen**) |
| `export/sap-csv-writer.ts` | Legacy SAP CSV writer |

**Boot (frozen):** `src/instrumentation.ts` → startup validation before serving.

---

## Backend — lib (`src/lib/`)

| Path | Client-safe? | Purpose |
|------|--------------|---------|
| `client-api.ts` | Yes | `apiGet` / `apiSend` fetch wrapper |
| `navigation.ts` | Yes | Nav items by role |
| `portal-access.ts` | Yes | Path access checks |
| `utils.ts` | Yes | `formatCurrency`, className helpers |
| `security/*` | Mixed | Schemas, rate limit, session token, same-origin |
| `server/*` | **Server only** | Server-side helpers |
| `shared/*` | Yes | App version, support contact, dev toolkit flags |

---

## Tests (`tests/`)

| File pattern | Covers |
|--------------|--------|
| `unit/architecture-guard.test.ts` | Layer import boundaries |
| `unit/docs-guard.test.ts` | Doc update matrix |
| `unit/data-table.test.ts` | DataTable export smoke |
| `unit/*-service.test.ts`, `unit/build-approval-route.test.ts` | Domain & application rules |
| `unit/finance-*.test.ts`, `unit/sap-*.test.ts` | Finance & SAP gates |
| `unit/session-token.test.ts`, `unit/sensitive-path.test.ts` | Security |
| `mocks/client-only.ts`, `mocks/server-only.ts` | Test environment shims |

Run: `npm test`

---

## Scripts (`scripts/`)

| Script | Purpose |
|--------|---------|
| `seed-sql.ts` | Seed reference data |
| `set-passwords.ts` | Set demo passwords |
| `migrate-all.ts`, `apply-migration.ts` | Apply SQL migrations |
| `architecture-guard/` | CI: block bad imports |
| `docs-guard/` | CI: enforce doc updates |
| `browser-safety-check.ts` | CI: production build safety |
| `e2e-notification-spine.ts` | Notification E2E helper |

---

## Explanation — documentation (`docs/`)

### Start here (onboarding)

| Doc | Why read it |
|-----|-------------|
| `TRACKING_MAP.md` | **This file** — find files by category |
| `FILE_INDEX.md` | Full folder/file inventory |
| `ENGINEERING_GOVERNANCE.md` | Process & change rules |
| `architecture.md` | Layer diagram |
| `DEPENDENCY_MAP.md` | What may import what |

### Domain & business rules

| Doc | Topic |
|-----|-------|
| `domain-model.md` | Entities & relationships |
| `state-machines.md` | Budget / approval statuses |
| `BUSINESS_RULES.md` | Numbered business rules |
| `WORKFLOWS.md` | End-to-end flows |
| `permission-matrix.md` | RBAC matrix |
| `api-contracts.md` | API shapes |
| `DOMAIN_GLOSSARY.md` | Terms |

### Database

| Doc | Topic |
|-----|-------|
| `schema.sql` | Full schema |
| `DATABASE.md` | Tables & conventions |
| `migrations/*.sql` | Incremental migrations |
| `DATA_FLOW.md` | Read/write paths |

### Governance & history

| Doc | Topic |
|-----|-------|
| `ARCHITECTURE_DECISIONS.md` | ADRs (locked decisions) |
| `KNOWLEDGE_LOG.md` | K-entries (immutable facts) |
| `CHANGE_HISTORY.md` | Every change + rollback |
| `open-decisions.md` | Unresolved items |
| `RELEASE_CHECKLIST.md` | MVP / UAT gate |

### UI & design

| Doc | Topic |
|-----|-------|
| `button-design-system.md` | Button variants |
| `feature-e2e-proof.md` | 12-point feature completeness |
| `staging-e2e-acceptance.md` | Staging UAT evidence |

### Operations

| Doc | Topic |
|-----|-------|
| `TROUBLESHOOTING.md` | Common fixes |
| `production-readiness.md` | Go-live checklist |
| `security-checklist.md` | Security evidence |
| `release-notes/` | Per-release notes |

---

## Current work in progress (2026-07-24)

| Category | Files | Status |
|----------|-------|--------|
| UI | `src/components/ui/data-table.tsx` | New — shared table primitive |
| Frontend | `finance/page.tsx`, `budgets/page.tsx`, `reports/page.tsx`, `home/page.tsx` | DataTable migration |
| Tests | `tests/unit/data-table.test.ts` | Smoke test |
| Explanation | `docs/CHANGE_HISTORY.md` (#030), `docs/RELEASE_CHECKLIST.md` | Updated |
| Hygiene | `.gitignore` | Ignores `.kilocode/`, `*.backup` |

---

## Why folders are not physically rearranged

- **Next.js App Router:** `src/app/(portal)/finance/page.tsx` *is* the `/finance` URL — moving it breaks routing.
- **Clean Architecture:** `domain` → `application` → `infrastructure` → `app/components` is enforced by CI guards.
- **Frozen subsystems:** `instrumentation.ts`, `startup/**`, `migrations/registry.ts` must not move without ADR.

For navigation, update **this map** and `FILE_INDEX.md` instead of renaming source trees.

# FILE_INDEX.md — Repository structure & key files

**Purpose:** Explain every folder and every important file so a new engineer (or AI)
can navigate the codebase without reverse-engineering it. Detailed companion to
`docs/ENGINEERING_BRAIN.md`. Evidence: exact paths. Uncertain items marked **UNKNOWN**.

**Stack:** Next.js 14 (App Router) · TypeScript · React 18 · Tailwind · Zod · Vitest ·
SQL Server via `msnodesqlv8`/`mssql`. Path alias `@/*` → `src/*`.

---

## 1. Top-level folders

| Folder | Purpose |
|--------|---------|
| `src/` | All application source (layered — see §2) |
| `docs/` | Authoritative docs & governance (ADRs, schema, migrations, this file) |
| `scripts/` | Ops/migration/seed/E2E scripts (`.ts` via `tsx`) |
| `tests/` | Unit/integration tests (`tests/unit/*.test.ts`) |
| `public/` | Static assets — **UNKNOWN/empty** (0 files matched) |
| `.cursor/` | Cursor rules (`rules/*.mdc`) — governance + frozen subsystems |
| `.next/` | Next.js build output (generated; not source) |
| `node_modules/`, `.git/` | Dependencies / VCS |

No `prisma/` directory — persistence is raw parameterized SQL, not an ORM (ADR-009).

---

## 2. `src/` layers (Clean Architecture — ADR-001)

Dependency direction points inward: **Presentation → Application → Domain**, with
**Infrastructure** implementing Domain/Application contracts and composing everything.

| Layer | Folder | May import | Must NOT import |
|-------|--------|-----------|-----------------|
| Domain | `src/domain/` | only `@/domain/*` | application, infrastructure, app, components, lib |
| Application | `src/application/` | domain + `@/infrastructure/id`, repository **interfaces**, DI types | concrete repos, `@/app`, `@/components` |
| Infrastructure | `src/infrastructure/` | domain, application (to instantiate) | `@/app`, `@/components` |
| Presentation | `src/app/`, `src/components/` | `@/infrastructure/di`, `@/lib`, `@/domain` types | raw SQL |

> Boundaries are enforced by import direction and convention (verified by grep:
> `src/domain` imports nothing from outer layers). A dedicated ESLint boundary
> rule was **not** located — **UNKNOWN**.

### `src/domain/`
- `entities/index.ts` — all entity interfaces + notification/support types (barrel; e.g. `Notification`, `ACTIONABLE_NOTIFICATION_TYPES`, `isActionableNotification`).
- `value-objects/money.ts` — `Money` (amount > 0, currency default KES).
- `value-objects/period-range.ts` — `PeriodRange`.
- `value-objects/budget-status.ts` — status/permission/role unions & labels (`BudgetStatus`, `PermissionCode`, `RoleCode`, `WorkflowStage`, `LOCKED_/EDITABLE_BUDGET_STATUSES`, `statusLabel`). **The canonical enum authority.**
- `rules/build-approval-route.ts` — `buildApprovalRoute`, `ApprovalRouteError` (ADR-002).
- `constants/budget-types.ts` — `BUDGET_CATEGORY_CATALOG`, `BudgetCategory` codes, `budgetCategoryLabel`, `isBudgetCategory` (BR-12 / K-010).
- `rules/budget-plan-invariants.ts` — `validateBudgetLines/Header`, `assertCanEditDraft/Submit/NotLocked`, `assertSapCodeForSubmit`, `BudgetLockedError`.
- `rules/approval-outcome.ts` — `latestApprovalOutcome`.
- `rules/org-role.ts` — `resolveOrgRole` (`systemAdmin > finance > gm > manager > employee`).
- `rules/budget-number.ts` — `formatBudgetNumber`, `formatVersionLabel`, `nextSequenceForDepartment`.
- `rules/submission-status.ts` — `submissionStatusForBudget`.
- `rules/finance-sla.ts` — `computeFinanceDueDates`, `isOverdue`, `addDays`.
- `support-issue.ts`, `existing-active-budget.ts` — domain helpers.
- `development/types.ts` — dev toolkit domain types.

### `src/application/` (use-case services — one file per bounded task)
| File | Main export | Responsibility |
|------|-------------|----------------|
| `authorization-service.ts` | `AuthorizationService` | permission/scope checks (`hasPermission`, `canReturnBudget`, `canRejectBudget`) |
| `approval-service.ts` | `ApprovalService` | submit, approve, return, reject; route building |
| `budget-plan-service.ts` | `BudgetPlanService` | draft CRUD, submit delegation, amendment |
| `finance-service.ts` | `FinanceService` | claim, release, finalize, return, escalations, SAP freeze |
| `fiscal-year-service.ts` | `FiscalYearService` | open/close/reopen/archive/setCurrent + closure task |
| `master-data-service.ts` | `DepartmentService`, `CostCenterService`, `SubmissionStatusService` | master data admin |
| `admin-user-service.ts` | `AdminUserService` | user create/update/activate/reset + admin notifications |
| `dashboard-service.ts` | `DashboardService` | role dashboards |
| `executive-service.ts` | `ExecutiveService` | executive overview/rollups |
| `sap-compliance-service.ts` | `SapComplianceService` (+ `buildSapReference`, `sapFormToCsv`, `sapFormToExcelHtml`) | SAP form generation |
| `support-issue-service.ts` | `SupportIssueService` | report/assign/resolve tickets |
| `version-compare-service.ts` | `compareVersions` | budget version diff |
| `workflow-recorder.ts` | `WorkflowRecorder`, `notifyFinanceQueue`, `listFinanceAdministrators` | workflow-history + finance fan-out helpers |
| `notification-task-actions.ts` | `notificationDestination`, `markNotificationRead`, `markAllNotificationsRead` | reusable notification read/nav logic |
| `development/development-toolkit-service.ts` | `DevelopmentToolkitService` | dev-only data/workflow tooling |
| `concurrency-error.ts` / `budget-lock-error.ts` / `active-budget-conflict.ts` | error classes | typed application errors |

### `src/infrastructure/`
| File/folder | Purpose |
|-------------|---------|
| `di.ts` | **Composition root** — resolves driver, builds `RepositoryBundle`, instantiates all service singletons; exports `getCurrentUser`, `getRepositoryDriver`, `repos`, `authorizationService`, etc. |
| `id.ts` | `newId`, `seedUuid` — the only infra module app services import directly |
| `session.ts` | signed session cookie read/verify (`SESSION_COOKIE`), memory fallback for tests/mock |
| `auth/auth-store.ts` | credential/password-hash lookup |
| `repositories/interfaces.ts` | all `I*Repository` + `IUnitOfWork` contracts (the ports) |
| `repositories/mock/` | in-memory repos + seed (`index.ts`, `store.ts`, `seed.ts`, `lineage-repos.ts`, `support-issue-repo.ts`) |
| `repositories/sql/` | mssql repos (`index.ts`, `pool.ts`, `request.ts`, `mappers.ts`, `sql-retry.ts`, `lineage-repos.ts`, `support-issue-repo.ts`) |
| `startup/env.ts` | env validation + `resolveRepositoryDriver` (**FROZEN**) |
| `startup/database-health.ts` | DB readiness + startup report (**FROZEN**) |
| `migrations/registry.ts` | `MIGRATIONS`, `EXPECTED_SCHEMA_VERSION`, pending-migration helpers (**FROZEN**) |
| `export/sap-csv-writer.ts` | legacy SAP CSV writer |
| `development/session-registry.ts`, `diagnostics-state.ts` | dev-only infra |

### `src/app/` (presentation — Next.js App Router)
- `(portal)/` — authenticated pages: `home`, `budgets` (`create`, `[id]`), `approvals`, `finance` (`sap/[id]`), `reports`, `audit`, `notifications`, `profile`, `admin` (`users/[id]`, `fiscal-years`, `support`, `development`), `access-denied`, `support`. Each is a `page.tsx` (+ `layout.tsx`/`error.tsx`).
- `login/` — login page.
- `api/v1/` — 68 REST route handlers (see §4).

### `src/components/`
`ui/` (primitives), `layout/` (`app-shell.tsx`, `header.tsx`, `notification-bell.tsx`, `sidebar.tsx`, `footer.tsx`, `user-dropdown.tsx`), `shared/`, `budget/` (`budget-plan-form.tsx`, `approval-timeline.tsx`), `auth/`, `admin/`, `dashboard/`, `support/` (`report-issue-modal.tsx`).

### `src/lib/`
- `client-api.ts` — `apiGet`/`apiSend` + `ApiError` (client fetch wrapper).
- `navigation.ts` — nav model by role/permission.
- `portal-access.ts` — `canAccessPath` client gate.
- `development-toolkit-access.ts` — `isDevelopmentToolkitEnabled` (server-only gate).
- `utils.ts` — `formatCurrency`, `clsx`/`tailwind-merge` helpers.
- `security/` — `session-token.ts`, `rate-limit.ts`, `same-origin.ts`, `client-ip.ts`, `passwords.ts`, `*-schemas.ts`, `read-api-error.ts`, `safe-error-message.ts`.

### Cross-cutting root files
- `src/middleware.ts` — edge middleware: same-origin/CSRF, per-IP rate limits (general/auth/workflow), session gate + coarse portal RBAC, Development Toolkit 404 gating.
- `src/instrumentation.ts` — Next.js `register()` startup hook: env + DB + DI validation before serving (**FROZEN**; ADR-009).
- `next.config.js` — security headers/CSP, `instrumentationHook`, externalizes `mssql`/`msnodesqlv8`, aliases native driver + `child_process` to `false` in browser/edge builds.

---

## 3. `scripts/`
| Script | npm alias | Purpose |
|--------|-----------|---------|
| `migrate-all.ts` | `db:migrate` | apply all pending migrations |
| `apply-migration.ts` | — | apply one migration + record in `SchemaVersion` |
| `seed-sql.ts` | `db:seed` / `db:reseed` | seed SQL DB (uses cleaner for wipe) |
| `set-passwords.ts` | `db:passwords` | set/refresh user password hashes |
| `backfill-master-data.ts` | — | backfill master data |
| `enable-mixed-mode.ts` | — | enable SQL mixed-mode auth |
| `e2e-notification-spine.ts` | `e2e:spine` | local SQL service-layer integration harness |
| `lib/test-database-cleaner.ts` | — | **sole** authorized site to disable immutability triggers for test teardown |
| `docs-guard/rules.ts` + `docs-guard/cli.ts` | `docs:check` | CI documentation-update enforcement (pure rule engine + git plumbing); workflow `.github/workflows/docs-guard.yml` |
| `patch-next-tsconfig-path.js` | `postinstall` | tsconfig path patch |

## 4. API routes (`src/app/api/v1/`) — 68 handlers, grouped
| Group | ~Count | Notes |
|-------|-------:|-------|
| `auth/` | 2 | login, logout |
| `me/` | 1 | current user + badge |
| `budget-plans/` | 16 | CRUD + approve/reject/return/submit/amend/compare/history/workflow/sap-form/sap-export + finance/{claim,finalize,return,release} |
| `admin/` | 11 | users (+[id]/activate/reset-password), departments, cost-centers, fiscal-years, submission-status |
| `finance/` | 4 | queue, dashboard, approved, escalations |
| `executive/` | 3 | overview, departments/[id], cost-centers/[id] |
| `fiscal-years/` | 2 | collection + [id]/[action] |
| `support-issues/` | 2 | collection + [id] |
| `development/` | 20 | fiscal-years, budgets, database/reseed, workflow/*, integrity/validate, diagnostics, sessions, environment, health |
| `system/` | 1 | database-health |
| `dashboard/`,`reference/`,`notifications/`,`audit/`,`approvals/`,`reports/` | 6 | one each |

## 5. `docs/` map
See `docs/ENGINEERING_BRAIN.md` §16 (governance layers) for which doc owns which job.
Key files: `ENGINEERING_BRAIN.md`, `FILE_INDEX.md` (this), `DEPENDENCY_MAP.md`, `WORKFLOWS.md`, `DATABASE.md`,
`BUSINESS_RULES.md`, `ARCHITECTURAL_INVARIANTS.md`, `DOMAIN_GLOSSARY.md`, `REJECTED_DECISIONS.md`,
`SYSTEM_HISTORY.md`, `DATA_FLOW.md`, `TROUBLESHOOTING.md`, `WHY_SQL_SERVER.md`, `FEATURE_REGISTRY.md`,
`ARCHITECTURE_DECISIONS.md`, `SYSTEM_DECISIONS.md`, `KNOWLEDGE_LOG.md`, `CHANGE_HISTORY.md`, `RELEASE_CHECKLIST.md`,
`domain-model.md`, `state-machines.md`, `permission-matrix.md`, `schema.sql`, `migrations/`,
`ENGINEERING_GOVERNANCE.md`, `feature-e2e-proof.md`, `open-decisions.md`, `release-notes/`.

---

## 6. Business-critical file cards (architectural map)

Per-file metadata for the load-bearing files. **Import permissions are not repeated per file** —
they derive from **Owner layer** via the canonical layer matrix in §2 (that is the single source
for "Can import / Must not import", INV-1). Each card adds the file-specific dimensions.

Columns: **Owner layer** · **Safe to modify?** (Free = normal · Care = guard invariants · Frozen =
frozen-subsystem rules apply) · **Business-critical?** · **Related ADR/K/INV** · **Related tests**.

| File | Owner layer | Safe to modify? | Business-critical? | Related ADR/K/INV | Related tests |
|------|-------------|-----------------|--------------------|-------------------|---------------|
| `src/infrastructure/di.ts` | Infrastructure | **Care** — single composition root; no duplicate repo construction | **Yes** | ADR-009 · K-007 · INV-2 | via service tests (all) |
| `src/infrastructure/startup/env.ts` | Infrastructure | **Frozen** | **Yes** | ADR-009 · K-007 · INV-3/4 | `startup-*`/env validation tests |
| `src/infrastructure/startup/database-health.ts` | Infrastructure | **Frozen** | **Yes** | ADR-009 · INV-4 | startup report tests |
| `src/infrastructure/migrations/registry.ts` | Infrastructure | **Frozen** (schema-migration exception) | **Yes** | ADR-009 · INV-4 | migration/registry tests |
| `src/instrumentation.ts` | Presentation/boot | **Frozen** | **Yes** | ADR-009 · INV-4 | boot path (runtime) |
| `next.config.js` (native-driver alias block) | Build | **Frozen** (that block) | **Yes** | ADR-009 · TROUBLESHOOTING | build |
| `src/domain/value-objects/budget-status.ts` | Domain | **Care** — canonical enum authority | **Yes** | `state-machines.md` · INV-12 | domain/status tests |
| `src/domain/rules/build-approval-route.ts` | Domain | **Care** — routing invariant | **Yes** | ADR-002 · BR-14/16 · INV-13 | approval-route tests |
| `src/domain/rules/budget-plan-invariants.ts` | Domain | **Care** — edit/submit invariants | **Yes** | BR-01..13 · INV-18 | budget-invariant tests |
| `src/application/approval-service.ts` | Application | **Care** — approve/return/reject authority | **Yes** | ADR-003 · K-004 · INV-10/11/12/15 | `e2e:spine` · approval tests |
| `src/application/finance-service.ts` | Application | **Care** — claim exclusivity, no-reject | **Yes** | ADR-004 · K-004 · INV-10/19 | `e2e:spine` · finance tests |
| `src/application/budget-plan-service.ts` | Application | **Care** — lineage/amendment | **Yes** | ADR-005/006 · K-002 · INV-17/18 | budget-plan tests |
| `src/application/authorization-service.ts` | Application | **Care** — RBAC decisions | **Yes** | ADR-010 · K-005 · INV-16/25 | authorization tests |
| `src/application/notification-task-actions.ts` | Application | **Care** — read≠resolve | **Yes** | K-001 · INV-21/22 | `notification-read-lifecycle.test.ts` |
| `src/application/fiscal-year-service.ts` | Application | **Care** — one Open/Current | **Yes** | K-006 · INV-20 | `fiscal-year`/master-data tests |
| `src/infrastructure/repositories/interfaces.ts` | Infrastructure | **Care** — the ports; changes ripple to both impls | **Yes** | ADR-001 · INV-1/5 | all repo-backed tests |
| `src/infrastructure/repositories/sql/index.ts` | Infrastructure | **Care** — dedup guard, mappers | **Yes** | K-009 · INV-23 | `notification-dedup.test.ts` · `e2e:spine` |
| `src/infrastructure/repositories/mock/index.ts` | Infrastructure | **Care** — must mirror SQL semantics | **Yes** | K-009 · INV-23 | `notification-dedup.test.ts` · most unit tests |
| `scripts/lib/test-database-cleaner.ts` | Scripts (test) | **Care** — sole trigger-disable site | **Yes** (test safety) | INV-9 · CHANGE_HISTORY #010 | `e2e:spine` teardown |
| `src/middleware.ts` | Presentation | **Care** — CSRF/rate-limit/RBAC gate | **Yes** | ADR-010 · INV-25 | middleware/security tests |
| `src/components/layout/notification-bell.tsx` | Presentation | **Free** (guard read≠resolve) | Medium | K-001 · INV-21 | (browser-pending) |
| `src/application/sap-compliance-service.ts` | Application | **Care** — freeze on finalize; legacy-gate smell (§17 BRAIN) | **Yes** | ADR-004 | SAP form tests |

> **UI primitives** (`src/components/ui/*`) and thin display components are **Free** to modify and
> **not** business-critical; they carry no invariants. They are intentionally omitted from the card
> table to avoid noise — their import rule is still governed by the Presentation row in §2.

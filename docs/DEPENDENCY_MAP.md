# DEPENDENCY_MAP.md — the wiring graph

> **Single responsibility.** This document answers one question: *what depends on what,
> and where is it wired?* It is the import/DI graph only. It deliberately does **not**
> describe runtime behavior (`WORKFLOWS.md`), per-file responsibilities (`FILE_INDEX.md`),
> business rules (`BUSINESS_RULES.md`), or schema (`DATABASE.md`). When refactoring or
> moving code, check this map first to see what breaks.
>
> Source of truth for the wiring is `src/infrastructure/di.ts`. If this file and `di.ts`
> disagree, `di.ts` wins — fix this document.

---

## 1. Layer dependency direction (never inverted)

Dependencies point **inward**. Outer layers may import inner layers; inner layers must never
import outward. This is `ARCHITECTURAL_INVARIANTS.md` (layering invariants) expressed as imports.

```
Presentation            Application            Domain           Infrastructure
(src/app/**,      →     (src/application/**) → (src/domain/**)   (src/infrastructure/**)
 components/**)                    │                                     ▲
        │                         └──── depends on repository ──────────┘
        │                               INTERFACES only
        └───────────── never imports src/infrastructure/** directly ────┘
```

- **Presentation** (`src/app/**`, API route handlers, React components): imports the
  **DI singletons** from `src/infrastructure/di.ts` and DTOs. It does not `new` services.
- **Application** (`src/application/**`): imports `src/domain/**` and repository **interfaces**
  (`src/infrastructure/repositories/interfaces.ts`). It must not import concrete
  `mock/` or `sql/` implementations.
- **Domain** (`src/domain/**`): imports nothing from application or infrastructure. Pure rules.
- **Infrastructure** (`src/infrastructure/**`): implements the interfaces (`mock/`, `sql/`)
  and provides the composition root (`di.ts`), session, startup, and driver resolution.

**Forbidden edges (enforceable code-review rules):**
- `src/domain/**` → `src/application/**` or `src/infrastructure/**` — never.
- `src/application/**` → `src/infrastructure/repositories/mock/**` or `.../sql/**` — never
  (depend on `interfaces.ts` instead).
- `src/app/**` → repository implementations — never (go through `di.ts` singletons).

---

## 2. Composition root — `src/infrastructure/di.ts`

Everything is instantiated **exactly once** here and exported as singletons. No other module
may `new` a repository or service. Wiring happens in three tiers:

```
resolveRepositoryDriver()            // env → "mock" | "sql"  (read once; browser is always mock)
        │
        ▼
RepositoryBundle                     // createSqlRepos() | createMockRepos()  — 18 repos + uow
        │
        ▼
Application services                 // constructed from the bundle + authorizationService
```

- **Driver decision (once):** `driver = window ? "mock" : resolveRepositoryDriver()`.
  Client bundles always get mock stubs (the browser cannot open a SQL connection).
- **Bundle:** `RepositoryBundle` holds all 18 repositories plus the `uow` (unit of work).
  `createSqlRepos()` uses a lazy `require("@/infrastructure/repositories/sql")` so the native
  SQL driver is never pulled into the client bundle.
- **Services:** every service receives repository **interfaces** (not implementations) via
  constructor injection, so swapping mock↔sql changes nothing above the bundle.

---

## 3. Service → dependency graph (from `di.ts`)

`authorizationService` is a dependency of **every** mutating service (it also takes
`users`, `costCenters`, `audits`). Two services depend on **other services**, not just repos:

```
authorizationService ──────────────┐  (used by every service below)
                                    │
approvalService ────────────────────┤  depends on: users, budgets, costCenters, fiscalYears,
        ▲                           │              routes, history, audits, notifications,
        │ (injected into)           │              authorizationService, uow, submissionStatus, workflow
budgetPlanService ──────────────────┤  depends on: budgets, lineages, costCenters, departments,
        ▲                           │              fiscalYears, attachments, audits, history, workflow,
        │ (injected into)           │              authorizationService, approvalService, uow,
dashboardService ───────────────────┤              submissionStatus, users, notifications
                                    │
financeService ─────────────────────┤  depends on: users, budgets, lineages, costCenters, departments,
fiscalYearService ──────────────────┤              fiscalYears, glAccounts, financeClaims, sapPackages,
departmentService ──────────────────┤              history, audits, notifications, authorizationService,
costCenterService ──────────────────┤              uow, submissionStatus, workflow
submissionStatusService ────────────┤
adminUserService ───────────────────┤
executiveService ───────────────────┤
sapComplianceService ───────────────┤
developmentToolkitService ──────────┘  depends on: the whole bundle + fiscalYearService +
                                                    getRepositoryDriver + package version
```

> **MVP note (Change #027):** `supportIssueService` removed — Help uses `mailto:ict-support@kengen.co.ke` (`src/lib/shared/support-contact.ts`).

**Service-to-service edges (the only ones that exist):**

| Service | Depends on service | Why |
|---------|--------------------|-----|
| `budgetPlanService` | `approvalService` | submit hands off into the approval chain |
| `dashboardService` | `budgetPlanService` | dashboard reuses budget read/query logic |
| `developmentToolkitService` | `fiscalYearService` | dev toolkit drives fiscal-year setup |
| *all mutating services* | `authorizationService` | permission checks before every mutation |

There are **no cycles**: `approvalService` → `budgetPlanService` → `dashboardService` is a
strict chain; nothing points back up.

---

## 4. Unit of work (`uow`)

`bundle.uow` (`IUnitOfWork`) is injected into every mutating service. Services wrap mutations in
`uow.runInTransaction(async () => { ... })`.

- **SQL** (`SqlUnitOfWork`): opens a real transaction via `AsyncLocalStorage`; every repository
  call inside the callback (including audit + notification writes) joins the same transaction and
  commits/rolls back together.
- **Mock** (`MockUnitOfWork`): calls the function directly — **no real rollback**. Mock is for
  unit tests and client stubs only.

Transaction semantics belong to `WORKFLOWS.md` (Baseline T). This map only records that the
`uow` edge exists on every mutating service.

---

## 5. Practical use — "what breaks if I touch X?"

- **Change a repository interface** (`interfaces.ts`): breaks every `mock/` + `sql/`
  implementation and every service that injects it. Update all three tiers together.
- **Add a service dependency**: add the constructor param **and** wire it in `di.ts`. Nowhere else
  constructs services, so the wiring change is localized to one file.
- **Add a new repository**: add it to `RepositoryBundle`, both `createMockRepos()` and
  `createSqlRepos()`, and inject it where used.
- **Client component pulling a service**: allowed only via `di.ts` exports; on the client the
  bundle is mock, so server-only logic must live behind API routes, not in components.

---

## Related documents

- `src/infrastructure/di.ts` — the wiring itself (source of truth)
- `docs/FILE_INDEX.md` — per-file responsibilities, owner layer, allowed imports
- `docs/ARCHITECTURAL_INVARIANTS.md` — the layering rules this map enforces
- `docs/WORKFLOWS.md` — runtime flow and transaction boundaries (Baseline T)
- `docs/ENGINEERING_BRAIN.md` — architecture overview and document index

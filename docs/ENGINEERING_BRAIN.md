# ENGINEERING_BRAIN.md — Permanent engineering memory

**This is the engineering brain of the KenGen ICT Budget Operations Portal.**
It exists so that months from now, another engineer — or another AI — can understand
every architectural decision, subsystem, workflow, table, and business rule without
reverse-engineering the code.

**This is NOT** a README, an API reference, or user documentation. It is the executive
guide and table of contents for the repository's knowledge. Detail lives in the companion
documents; this file explains *what exists, why, why alternatives were rejected, what
depends on it, and what breaks if it changes.*

**Evidence discipline (governance):** every technical claim cites a file/symbol, an ADR, or
a K-entry. Anything not provable from the repo is marked **UNKNOWN** — never guessed. See
`docs/ENGINEERING_GOVERNANCE.md`. **Update rule:** any change affecting architecture,
workflows, business rules, repositories, permissions, database, services, or decisions must
update this document (or the companion it points to) in the same task (ADR-013).

## Document map (the two-layer knowledge base)

| This brain's section | Companion (detail) |
|----------------------|--------------------|
| §4 Repository structure, §5 File inventory | `docs/FILE_INDEX.md` |
| §7 Workflow catalogue | `docs/WORKFLOWS.md` |
| §6 Database | `docs/DATABASE.md` + `docs/schema.sql` + `docs/migrations/` |
| §10 Business rules | `docs/BUSINESS_RULES.md` |
| §3 Technology, §9 Approval engine, decisions | `docs/ARCHITECTURE_DECISIONS.md` (ADRs) |
| §15 Knowledge log | `docs/KNOWLEDGE_LOG.md` |
| §16 Change log | `docs/CHANGE_HISTORY.md` + `CHANGELOG.md` |
| Domain model / state machine / permissions | `docs/domain-model.md`, `docs/state-machines.md`, `docs/permission-matrix.md` |

---

## 1. Project vision

**Business problem.** KenGen's ICT function must prepare, review, approve, and finalize
departmental budgets for a fiscal year, then hand clean figures to SAP for execution. The
manual/spreadsheet process lacked hierarchy-driven approval, an audit trail, and SAP-ready
output. This portal is the system of record for that end-to-end budgeting process.

**What the portal does.** Budget Holders create budgets against a cost center and fiscal
year; the budget walks the management hierarchy for approval; Finance reviews, claims, and
finalizes; a frozen SAP export package is produced; every action is audited and surfaced as
actionable notifications.

**Why SAP is not written directly.** The portal **generates a frozen SAP package** (JSON +
CSV, `dbo.SapPackages`, ADR-004) on finalize rather than writing to SAP live. This decouples
budgeting governance from SAP availability, preserves an immutable record of exactly what was
handed over, and lets Finance import on their own schedule. CSV/Excel generation exists as
the interchange format Finance uses to load SAP (`SapComplianceService`, `docs/WORKFLOWS.md` WF-018).

**The budgeting workflow (one line).** Draft → submit → hierarchical approval → Finance
queue (claim → finalize) → frozen SAP export, with Return-for-revision and Amendment as the
controlled change paths. Full state machine: `docs/state-machines.md`.

**Why Finance is outside the approval hierarchy.** Approval authority follows the org tree
(`Users.managerId`, ADR-002). Finance is a **separate governance gate** after the tree, with
its own claim/finalize/return/release semantics and a hard rule that **Finance can never
permanently reject** (K-004, ADR-004). This models real financial governance: the hierarchy
owns "should we spend this?"; Finance owns "is this correct and SAP-ready?".

---

## 2. Architectural philosophy

**Clean Architecture (ADR-001).** Strict layering **Presentation → Application → Domain**,
with **Infrastructure** implementing the inner layers' contracts. Dependencies point inward.

| Layer | Owns | Why it exists / what it prevents |
|-------|------|----------------------------------|
| **Domain** (`src/domain`) | entities, value objects, pure rules | business truth with zero framework coupling; keeps rules testable and un-leakable into UI |
| **Application** (`src/application`) | use-case services orchestrating rules + repos | one place per business operation; no SQL, no HTTP |
| **Infrastructure** (`src/infrastructure`) | repositories, DI, session, startup | swappable persistence (mock/sql); the composition root |
| **Presentation** (`src/app`, `src/components`) | routes, pages, components | delivery only; never talks to SQL |

- **Dependency Injection** — one composition root (`src/infrastructure/di.ts`) builds a
  `RepositoryBundle` and instantiates every service **once**. Rationale: a single wiring
  point makes the driver choice explicit and prevents duplicate/mismatched repositories
  (a real past outage — ADR-009, K-007).
- **Repository Pattern** — services depend on `I*Repository` **interfaces**
  (`src/infrastructure/repositories/interfaces.ts`), not concrete classes. Two
  implementations exist: `mock/` (in-memory, for tests/dev) and `sql/` (mssql). This is
  dependency inversion: the domain/application never know which store is behind them.
- **Application Services** — the only place a business use-case is orchestrated. They call
  domain rules and repositories; they never issue SQL or read HTTP.
- **Domain layer** — pure functions/classes. Verified to import nothing from outer layers.
- **Why this approach.** Enterprise maintainability + testability, and prevention of rule
  leakage into routes/UI. Alternatives rejected: fat controllers, ORM-from-UI, "service +
  SQL in one module" (ADR-001).

---

## 3. Technology decisions

Each row: decision · reason · alternatives rejected · where. Full rationale in ADRs.

| Tech | Why | Alternatives rejected | Evidence |
|------|-----|-----------------------|----------|
| **SQL Server** | KenGen enterprise standard; strong constraints, triggers, filtered unique indexes we rely on for invariants | PostgreSQL, MySQL — not the org standard; would re-implement immutability/filtered-index features | ADR-009; `docs/DATABASE.md` |
| **`msnodesqlv8` (ODBC)** | native Windows/SQL Server auth + driver; used for parameterized access | pure-TCP `tedious` (mssql default) — UNKNOWN why not chosen beyond ODBC/Windows-auth fit | `package.json`; `next.config.js` aliasing; ADR-009 |
| **`mssql`** | typings + connection-pool API layered over the driver | — | `package.json` |
| **Next.js 14 (App Router)** | unified server routes + React pages + middleware + instrumentation hook (startup validation) | separate API server + SPA — more moving parts | `package.json`; `src/app`, `src/middleware.ts`, `src/instrumentation.ts` |
| **React 18** | component model for the portal UI | — | `package.json` |
| **Tailwind CSS** | fast, consistent styling without bespoke CSS | CSS modules / styled-components — slower iteration | `tailwindcss` in `package.json` |
| **TypeScript** | type safety across all layers; enforces contracts | plain JS — no compile-time guarantees | `tsconfig` (path alias `@/*`) |
| **Zod** | runtime input validation at the API boundary matching TS types | manual validators — drift from types | `zod`; `src/lib/security/*-schemas.ts` |
| **Vitest** | fast unit/integration test runner | Jest — heavier config | `vitest`; `tests/unit/*` |
| **SQL authentication (least-privilege)** | app runs as `app_budget_ops`, not sa; DENY on audit tables | app-as-admin — over-privileged | mig 005; ADR-009/011 |
| **Mock repositories** | tests + local dev without a live DB; forces the interface boundary to stay honest | test doubles per test — duplication | `repositories/mock/`; vitest sets `REPOSITORY_DRIVER=mock` |
| **Repository drivers (`REPOSITORY_DRIVER`)** | explicit `mock|sql` choice, fail-fast, no silent default (a past outage) | `?? "mock"` default — hides misconfig | ADR-009, K-007; `startup/env.ts` |
| **DI singleton** | one wiring point; startup verifies every service is usable | ad-hoc `new` per route — duplicate/mismatched repos | `di.ts`; `instrumentation.ts` |

---

## 4. Repository structure

Full breakdown in **`docs/FILE_INDEX.md`**. Executive summary:

```
src/
├── domain/         pure business model & rules (imports nothing outward)
├── application/    use-case services (depend on domain + repo interfaces)
├── infrastructure/ di.ts (composition root), repositories (mock|sql),
│                   session, startup validation (FROZEN), migrations registry
├── app/            Next.js App Router — (portal) pages + api/v1 (68 routes)
├── components/     React UI (layout, budget, admin, support, ui primitives)
├── lib/            client-api, navigation, portal-access, security/*
├── middleware.ts   edge: same-origin/CSRF, rate limit, session + coarse RBAC
└── instrumentation.ts  startup env+DB+DI validation (FROZEN)
docs/ · scripts/ · tests/ · .cursor/rules/
```

Layer import rules (verified by grep, convention-enforced; a lint boundary rule is UNKNOWN):
domain imports only domain; application imports domain + `@/infrastructure/id` + repo
interfaces; infrastructure wires everything; presentation imports `@/infrastructure/di`.

---

## 5. File inventory (critical files)

Full inventory in **`docs/FILE_INDEX.md`**. The files that matter most:

| File | Criticality | Safe to modify? |
|------|-------------|-----------------|
| `src/infrastructure/di.ts` | **Critical** — composition root, all services | Only with impact analysis; changes ripple everywhere |
| `src/instrumentation.ts` | **Critical / FROZEN** — startup validation | Only for verified bug/deploy/migration/regression (ADR-009) |
| `src/infrastructure/startup/*`, `migrations/registry.ts` | **FROZEN** | Same as above |
| `src/infrastructure/repositories/interfaces.ts` | **Critical** — the ports | Add methods carefully; both mock+sql must implement |
| `src/domain/value-objects/budget-status.ts` | **Critical** — enum authority | Status/permission/role changes ripple to services + docs |
| `src/domain/rules/build-approval-route.ts` | **Critical** — ADR-002 routing | Never hardcode titles; keep fail-closed |
| `src/application/approval-service.ts` | **Critical** — approval workflow | Keep ADR-003/K-004 semantics |
| `src/application/finance-service.ts` | **Critical** — finance workflow | Keep ADR-004 (no reject; one active claim) |
| `src/application/budget-plan-service.ts` | **Critical** — lineage/amend | Keep ADR-005/006 |
| `src/middleware.ts` | **Critical** — security gate | Keep ADR-010; UI is never the security boundary |
| `next.config.js` | **Critical / FROZEN aliasing** — native-driver bundling | Aliasing block is part of the frozen startup subsystem |

---

## 6. Database

Full reference in **`docs/DATABASE.md`** (28 tables, indexes, triggers, migrations 001–012).
Highlights every engineer must know:

- **Core:** `Users` (self-referential `ManagerId` = org tree; `ManagerId IS NULL` = GM root),
  `BudgetPlans` (one row per version), `BudgetItems`, `BudgetLineage`, `ApprovalRoute`,
  `FinanceQueueClaims`, `FiscalYears`, master data.
- **Immutable history (ADR-011):** `AuditLogs`, `ApprovalHistory`, `WorkflowHistory` — protected
  by `INSTEAD OF UPDATE, DELETE` triggers (+ role DENY on the first two). Disable only via
  `scripts/lib/test-database-cleaner.ts`.
- **Invariant-enforcing indexes:** `UX_BudgetPlans_LineageInPlay` (one active version),
  `UX_FinanceQueueClaims_ActivePlan` (one active claim), `UX_FiscalYears_OneOpen/OneCurrent`,
  `UX_BudgetLineage_Key`, `UQ_SapPackages_BudgetPlan`.
- **Schema versioning:** `dbo.SchemaVersion` ledger + `src/infrastructure/migrations/registry.ts`
  (`EXPECTED_SCHEMA_VERSION = "012"`). Startup refuses to serve if migrations are pending (ADR-009).
- **Attachments (ADR-008):** stored in-DB as `VARBINARY(MAX)`; DB backup = attachment backup.

---

## 7. Workflow catalogue

Full traces (UI → API → service → rule → tables → status → audit → notifications) in
**`docs/WORKFLOWS.md`**. The twelve workflows:

1. Budget creation/update · 2. Submission + approval routing (managerId walk; GM empty-route
auto-complete) · 3. Approval step advancement · 4. Return vs Reject · 5. Finance
claim/release/return/finalize · 6. Amendment (lineage N+1) · 7. Notification task lifecycle ·
8. Fiscal year lifecycle + closure task · 9. Admin user management · 10. Support issue
report→assign→resolve · 11. SAP export/CSV · 12. Auth login/logout + session.

State machine summary (`docs/state-machines.md`):
```
Draft → InApproval → PendingFinanceReview → Claimed → Finalized
   ↘ (GM submit) ────────────↗          ↘ return → ReturnedForRevision → resubmit
InApproval → return → ReturnedForRevision → resubmit
InApproval → reject (GM) → Rejected (terminal)
Claimed → release → PendingFinanceReview
```

---

## 8. Notification system

Design and rationale in `docs/domain-model.md` (task lifecycle), `docs/WORKFLOWS.md` WF-011,
K-001, K-009.

- **Tasks, not alerts.** A notification represents outstanding work; it stays active until the
  work is complete for that recipient. Opening ≠ handling.
- **Read vs Resolved.** Clicking sets `readAt` and navigates; only the workflow action sets
  `resolvedAt` + `resolvedBy`. Informational FYIs (`Outcome` etc.) are acknowledged on read.
- **Badge.** Counts active (unresolved, uncleared) tasks regardless of read state
  (`GET /api/v1/me`). Header bell shows a dropdown of active tasks
  (`src/components/layout/notification-bell.tsx`).
- **Routing / target URLs.** Every notification carries `targetUrl`; Approval tasks deep-link to
  `/budgets/{id}?action=approve` (page scrolls to + highlights the Decision panel).
- **Duplicate prevention (K-009).** Repository `create` refuses a second ACTIVE actionable
  notification for `(recipient, type, plan/entity)` — atomic in SQL. Informational types may repeat.
- **Finance queue → claim → release.** Shared `FinanceQueue` fan-out; claim resolves it and
  creates a personal `FinanceClaim`; release resolves the personal item and re-fans-out the queue;
  finalize resolves all finance task types.
- **History & archive.** Resolved items move to History; only resolved items can be archived.

---

## 9. Approval engine

Rationale: ADR-002 / ADR-007. Implementation: `src/domain/rules/build-approval-route.ts`,
`src/application/approval-service.ts`, `src/domain/rules/org-role.ts`.

- **`managerId` walk.** Routes are built by walking `Users.managerId` upward — never by
  hardcoding "Manager"/"GM" titles or role names. The org chart is a tree of unlimited depth;
  titles change; routing must survive reorgs without code changes.
- **First approver preference.** `CostCenter.managerId` (if set and ≠ owner) is the first step,
  else the owner's `managerId`; then walk to the root.
- **GM is the root.** Exactly one active GM with `managerId IS NULL` (ADR-007). GM-as-root submit
  builds an **empty route** and goes straight to Finance — not a self-approve click.
- **Fail closed.** Broken/circular hierarchy, missing/inactive manager, or missing GM raise a
  route error (reject + notify admin) rather than silently mis-routing.
- **Inactive users / missing managers.** Guarded explicitly (`OWNER_INACTIVE`, `MANAGER_MISSING/
  INACTIVE`, `CIRCULAR_HIERARCHY`, `GM_MISSING`).
- **Finance excluded.** Finance is a post-tree gate, not a route step (see §1).

---

## 10. Business rules

Complete invariant catalogue in **`docs/BUSINESS_RULES.md`** (BR-01…BR-50, cross-referenced to
ADRs and K-entries). The load-bearing ones:

- One active budget version per lineage (Cost Centre + Fiscal Year + Original Budget Category) — K-002.
- Only Draft/ReturnedForRevision editable; Finalized immutable; post-finalize change = Amendment — ADR-005/006.
- Return (recoverable) vs Reject (terminal); only GM rejects; **Finance never rejects** — ADR-003, K-004.
- One active finance claim per plan — ADR-004.
- One Open and one Current fiscal year — K-006.
- Notification read ≠ resolved; no duplicate active tasks — K-001, K-009.
- SystemAdmin is not a budget approver by default — K-005.
- `REPOSITORY_DRIVER` required; startup validates readiness — ADR-009, K-007.

### 10.1 Canonical business language — Budget Category

| Layer | Term | Example |
|-------|------|---------|
| **Business / UI** | Budget Category | "Capital Expenditure" (label) |
| **Domain entity / API JSON** | `budgetCategory` | `"CAPEX"` (code) |
| **SQL column (legacy schema)** | `BudgetType` | `BudgetPlans.BudgetType` |
| **SAP interchange** | `BudgetType` column | code in CSV; human `Category` row in compliance export |

**Reason:** Finance users think in categories, not types. Renaming the domain field aligns code with
business language without a SQL migration — repositories map `budgetCategory` ↔ `BudgetType` at the
persistence boundary only.

Catalog: `src/domain/constants/budget-types.ts` (`BUDGET_CATEGORY_CATALOG`). Legacy values
(`Primary`, `Supplementary`, …) remain on historical rows and appear under **Legacy Categories** in
Finance/Reports when present — never silently converted.

Deprecated aliases (`isBudgetType`, `budgetTypeSelectOptions`, …) are marked `@deprecated` and will
be removed in the next major version.

---

## 11. Security

Detail in `docs/permission-matrix.md`, ADR-010, `src/middleware.ts`, `src/lib/security/*`.

- **RBAC** — role codes (`BudgetSubmitter, BudgetApprover, GeneralManager, FinanceAdministrator,
  SystemAdmin, AuditViewer`) grant permission codes; enforcement uses the user's stored
  `permissionCodes`. No `FinancialAnalyst` role exists (K-008).
- **Permission codes** — capability layer (`budget.*`, `finance.*`, `report.*`, `audit.view`,
  `admin.*`, `fy.manage`).
- **Ownership / assignee** — capability is necessary but not sufficient; approve/reject/finance
  also require `currentApproverId` / claim ownership. Both required (BR-43).
- **IDOR protection** — services load authoritative entities and enforce ownership/visibility;
  the UI is never the authorization boundary.
- **Rate limiting** — per-IP general/auth/workflow buckets in middleware (`src/lib/security/rate-limit.ts`).
- **Sessions & cookies** — signed httpOnly `SESSION_COOKIE`; production requires `SESSION_SECRET`
  (≥32). Session claims are read in middleware; APIs reload the authoritative user via
  `getCurrentUser` (role/permission changes may lag page gates until re-login — accepted residual).
- **CSRF / same-origin** — enforced in middleware (`same-origin.ts`).
- **Audit** — every meaningful mutation writes immutable audit (ADR-011).
- **Why UI is not security.** Menus/pages hidden client-side are convenience only; every gate is
  re-enforced server-side (middleware + API + service).
- **"Sessions" are not table-backed** — there is no `Sessions` table; sessions are signed cookies.

---

## 12. Startup validation (FROZEN subsystem)

Rationale: ADR-009, K-007. Scope: `src/instrumentation.ts`, `src/infrastructure/startup/*`,
`src/infrastructure/migrations/registry.ts`, the native-driver aliasing in `next.config.js`,
`GET /api/v1/system/database-health`.

- **Checks (on boot, before serving):** required env (`REPOSITORY_DRIVER`, `SESSION_SECRET`);
  SQL reachability; authenticated DB user (`SUSER_SNAME()`); schema version vs
  `EXPECTED_SCHEMA_VERSION` and pending migrations; required tables **and columns**; seed presence
  across core tables (warn, not block); DI verification — every repository/critical service must be
  constructed *and* usable (one cheap live read each); connection-pool state; startup timing.
- **Why each exists:** a config/schema mismatch previously surfaced as a false 401. Fail-fast turns
  that class of bug into a clear boot-time failure with a `SYSTEM STARTUP` report.
- **Failure handling:** pending migrations, missing columns, or an unusable critical service
  **refuse SQL startup**; optional-service failures only warn.
- **Health endpoint:** authenticated diagnostics; unauthenticated probes get bare status (no
  hostnames, connection strings, or paths).
- **Why frozen / when changes are allowed:** the subsystem is mature; accept changes **only** for a
  verified bug, deployment requirement, schema migration, or regression (`.cursor/rules/frozen-subsystems.mdc`).

---

## 13. Testing strategy

- **Unit/integration (Vitest)** — `tests/unit/*.test.ts` (~26 files). `vitest` runs with
  `REPOSITORY_DRIVER=mock`. Covers domain rules, services, notification lifecycle/dedup, master
  data, startup env, security helpers.
- **Service-level integration harness (local SQL)** — `scripts/e2e-notification-spine.ts`
  (`npm run e2e:spine`) drives the **real application service layer** against a live local SQL
  Server, verifying DB state (BudgetPlans, Notifications, ApprovalHistory, AuditLogs,
  FinanceQueueClaims) after each transition, plus negative cases. It is **not** a browser test —
  browser/HTTP/cookies/routing are out of scope by design.
- **Test-data teardown** — immutability triggers are disabled only inside
  `scripts/lib/test-database-cleaner.ts`, which re-enables them even on failure (self-tested).
- **Browser E2E / staging / UAT** — the remaining release-confidence layer (pending); executes the
  full role matrix through UI → middleware → API → services → DB.
- **12-point proof standard** — `docs/feature-e2e-proof.md` records per-feature evidence
  (UI, API, service, rule, repo, tables, audit, notifications, permission, test, manual steps,
  expected result).
- **Release criteria / coverage expectations** — see `docs/definition-of-done.md` and
  `docs/production-readiness.md` (UNKNOWN whether a numeric coverage gate is defined — not located).

---

## 14. Release process

Git flow (adopted): `main` (release-quality only) ← `develop` (integration) ← short-lived
`feature/…`, `bugfix/…`, `docs/…`, `hotfix/…` branches. Conventional commit prefixes
(`feat/fix/docs/test/refactor/perf/build/ci/chore/revert`).

- **Why main is protected.** Every commit on `main` should be tag-ready; merge only after lint,
  tests, build, local SQL E2E, browser smoke, staging E2E, and the doc/knowledge gates pass.
- **Why develop is integration.** Day-to-day verified work accumulates here before a release cut.
- **Per-branch record.** Each branch ends with `docs/release-notes/<branch>.md`
  (`docs/release-notes/TEMPLATE.md`) so the PR references a permanent record.
- **Milestones (ADR-014):** Code Complete ✅ → Stabilization (current) → Validation
  (staging/E2E/UAT) → Production (`v1.0.0`).

---

## 15. Knowledge log (summary)

Canonical operational facts live in **`docs/KNOWLEDGE_LOG.md`** (immutable IDs; supersede,
never rewrite). Current entries:

| ID | Fact |
|----|------|
| K-001 | Notification lifecycle: task not message; read ≠ resolved; badge counts active |
| K-002 | Active budget version & one-per-lineage uniqueness |
| K-003 | Budget ownership multiplicity |
| K-004 | Finance cannot permanently reject; only GM rejects |
| K-005 | SystemAdmin is not a budget approver by default |
| K-006 | Fiscal-year singletons (one Open, one Current) |
| K-007 | `REPOSITORY_DRIVER` required; startup validates readiness |
| K-008 | There is no `FinancialAnalyst` role |
| K-009 | No duplicate active task notifications |

---

## 16. Change log & governance layers

**History:** `docs/CHANGE_HISTORY.md` (concise, chronological, with rollback lines) + `CHANGELOG.md`
(user-visible detail). Whenever architecture changes, record: what changed · why · files ·
business impact · migration · rollback · ADR — in the same task (ADR-013).

**Each doc has one job** (see `docs/ENGINEERING_GOVERNANCE.md` → "Governance layers"):

| Doc | Job |
|-----|-----|
| `ENGINEERING_BRAIN.md` (this) | Executive guide + table of contents |
| `FILE_INDEX.md` | Every folder & key file (+ per-file architectural cards) |
| `DEPENDENCY_MAP.md` | The DI/import wiring graph only (what depends on what) |
| `WORKFLOWS.md` | Every workflow end-to-end (business steps/states) |
| `DATA_FLOW.md` | How data moves through the layers per feature (component traversal) |
| `DATABASE.md` | Every table/index/trigger |
| `BUSINESS_RULES.md` | Every invariant (full catalogue) |
| `ARCHITECTURAL_INVARIANTS.md` | Curated "never change these" list (points to BR/K/ADR) |
| `DOMAIN_GLOSSARY.md` | Business vocabulary (canonical terminology) |
| `ARCHITECTURE_DECISIONS.md` | Why decisions were made (ADRs) — the decision history |
| `SYSTEM_DECISIONS.md` | Why the system is this way *today* (onboarding Q&A → ADR/K/BR) |
| `REJECTED_DECISIONS.md` | Ideas deliberately rejected (negative space of the ADRs) |
| `WHY_SQL_SERVER.md` | Database-engine rationale (explains ADR-009/011) |
| `SYSTEM_HISTORY.md` | How the architecture evolved (phases + rationale) |
| `FEATURE_REGISTRY.md` | Feature status roll-up (links `feature-e2e-proof.md`) |
| `TROUBLESHOOTING.md` | Solved problems (symptom → cause → fix → verify) |
| `KNOWLEDGE_LOG.md` | Current canonical facts |
| `CHANGE_HISTORY.md` + `CHANGELOG.md` | What changed, when |
| `RELEASE_CHECKLIST.md` | Runnable release gates (branch→develop, develop→main) |
| `release-notes/` | Per-branch release note (one per feature branch) |

**Documentation-update matrix (part of Definition of Done — governance).** When a change touches
a dimension, update the owning doc **in the same task** (ADR-013):

| If the change affects… | Update |
|------------------------|--------|
| Architecture / layering | `ENGINEERING_BRAIN.md` (+ ADR + `ARCHITECTURAL_INVARIANTS.md` if an invariant) |
| A workflow | `WORKFLOWS.md` (+ `DATA_FLOW.md` if the data path changed) |
| Database schema | `DATABASE.md` (+ migration + `registry.ts`/`EXPECTED_SCHEMA_VERSION`) |
| A business rule | `BUSINESS_RULES.md` (+ ADR/K, `state-machines.md`/`permission-matrix.md` as applicable) |
| Permanent fact/decision | `KNOWLEDGE_LOG.md` (new immutable ID) / `ARCHITECTURE_DECISIONS.md` |
| Terminology | `DOMAIN_GLOSSARY.md` |
| Feature status | `FEATURE_REGISTRY.md` (+ `feature-e2e-proof.md`) |
| A newly diagnosed bug class | `TROUBLESHOOTING.md` |
| System evolution (new capability class / phase) | `SYSTEM_HISTORY.md` |
| Any change | `CHANGE_HISTORY.md` (always) + the branch `release-notes/` file |

> Deliberately **not** created: a separate `DECISION_HISTORY.md`. Decision history already lives
> in `ARCHITECTURE_DECISIONS.md`; a second file would duplicate and risk contradiction
> (governance: one job per doc).

---

## 17. Open items & contradictions (must be reconciled by a human)

Per the governance **Contradiction Detector**, these are surfaced, not silently resolved:

1. **CONTRADICTION — "Western Region" seed user.**
   - `.cursor/rules/feature-e2e-proof.mdc` and repeated stakeholder direction: **do not add a
     Western Region seed user** unless explicitly requested.
   - `docs/open-decisions.md` ("Western Region assistant") still says it is **in scope for seed**.
   - These disagree. **Action required:** a stakeholder decision to update/remove the
     `open-decisions.md` entry. Not changed here (out of this task's scope).
2. **Flagged code smells (ADR-012 — not silently changed):**
   - ~~`/sap-export` gates on deprecated `Approved`~~ — **resolved** Change #023 (accepts
     `Finalized` | legacy `Approved`, aligned with BR-28 / `SapComplianceService`).
   - `createAmendment` writes `WorkflowHistory` but no `AuditLogs` row (`docs/WORKFLOWS.md` WF-012) —
     possible gap against BR-44 (ADR-011). Confirm intent.
3. **UNKNOWNs to verify:** import-boundary lint rule; several nullable columns without FKs; numeric
   test-coverage gate; whether `public/` is intentionally empty (see companions for the list).

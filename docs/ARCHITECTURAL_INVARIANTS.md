# ARCHITECTURAL_INVARIANTS.md — Things that must never change

**Purpose:** A short, high-signal list of the guarantees that must never be silently
altered. If a change would break any of these, **STOP** and require a superseding ADR/K-entry
and explicit stakeholder approval (governance Contradiction Detector, ADR-012).

**Single responsibility (entropy control):** this file does **not** restate rules — it
*curates* the load-bearing ones and points to the canonical source. Full invariant catalogue:
`docs/BUSINESS_RULES.md`. Facts: `docs/KNOWLEDGE_LOG.md`. Decisions: `docs/ARCHITECTURE_DECISIONS.md`.

Each row: the invariant · why it is inviolable · canonical source (edit *there* to change meaning).

---

## Structural invariants

| # | Invariant | Why inviolable | Canonical source |
|---|-----------|----------------|------------------|
| INV-1 | **Clean Architecture direction is fixed:** Presentation → Application → Domain; Infrastructure implements contracts. Presentation never issues SQL; Domain imports nothing outward. | The entire testability/maintainability model depends on it | ADR-001; `docs/ENGINEERING_BRAIN.md` §2 |
| INV-2 | **One DI composition root.** All repositories/services are constructed once in `src/infrastructure/di.ts`. No ad-hoc `new` of repos in routes. | Duplicate/mismatched repositories caused a real outage | ADR-009; K-007 |
| INV-3 | **`REPOSITORY_DRIVER` is required, no silent default; production refuses non-`sql`.** | A silent `?? "mock"` default masked misconfig as a false 401 | ADR-009; K-007; BR-47 |
| INV-4 | **Startup Validation subsystem is FROZEN.** Change only for verified bug, deployment need, schema migration, or regression. | Mature safety net; polish here risks the boot path | ADR-009; `.cursor/rules/frozen-subsystems.mdc`; BR-50 |
| INV-5 | **Persistence only via repository interfaces.** No inline SQL from UI/application; both `mock` and `sql` implement the same contracts. | Dependency inversion; swappable store; honest boundary | ADR-001/009 |

## History & audit invariants

| # | Invariant | Why inviolable | Canonical source |
|---|-----------|----------------|------------------|
| INV-6 | **Approval history is immutable — never updated, never deleted.** | Financial dispute/forensics integrity | ADR-011; BR-45; `TR_ApprovalHistory_NoUpdateDelete` |
| INV-7 | **Audit logs are immutable — never updated, never deleted.** | Compliance; every meaningful mutation is auditable | ADR-011; BR-44/45; `TR_AuditLogs_NoUpdateDelete` |
| INV-8 | **Workflow history is append-only.** | Reconstructable workflow timeline | ADR-011; `TR_WorkflowHistory_NoUpdateDelete` |
| INV-9 | **Immutability triggers are disabled only inside `scripts/lib/test-database-cleaner.ts`** (test teardown, re-enabled even on failure). | One auditable choke point for a dangerous operation | CHANGE_HISTORY #010; BR-46 |

## Workflow & authority invariants

| # | Invariant | Why inviolable | Canonical source |
|---|-----------|----------------|------------------|
| INV-10 | **Finance can never permanently reject** — only return or finalize (+ claim/release). | Rejection is a hierarchy authority; Finance governs correctness | ADR-004; K-004; BR-24 |
| INV-11 | **Only the GM may permanently reject.** | Terminal authority sits with the org apex | ADR-003; K-004; BR-22 |
| INV-12 | **Return ≠ Reject.** Return → `ReturnedForRevision` (recoverable); Reject → `Rejected` (terminal). Never collapse them. | Separates "needs revision" from "closed permanently" | ADR-003; BR-21 |
| INV-13 | **Approval routing walks `Users.managerId` only** — never hardcode titles/role names; fail closed on broken/circular hierarchy. | Survives reorgs without code changes | ADR-002; BR-14/16 |
| INV-14 | **Exactly one active GM = org root (`managerId IS NULL`).** GM submit is empty-route auto-complete, not a self-approve click. | Single apex; routing correctness | ADR-007; BR-17/18 |
| INV-15 | **Owner cannot approve their own budget; only `currentApproverId` may act on the chain.** | Separation of duties | BR-19/20; `docs/state-machines.md` |
| INV-16 | **SystemAdmin is not a budget approver by default** and has no budget visibility via authz. | Separation of administration from budget authority | K-005; BR-39 |

## Data-shape invariants

| # | Invariant | Why inviolable | Canonical source |
|---|-----------|----------------|------------------|
| INV-17 | **One active budget version per lineage** (Cost Centre + Fiscal Year + Original Budget Type). | Prevents duplicate/competing submissions | ADR-005/006; K-002; `UX_BudgetPlans_LineageInPlay` |
| INV-18 | **Post-finalize changes only via Amendment** (new version, same lineage); `Finalized` is immutable. | Preserves budget history for SAP/compliance | ADR-005; BR-13 |
| INV-19 | **One active finance claim per plan.** | No two officers process one budget | ADR-004; `UX_FinanceQueueClaims_ActivePlan`; BR-25 |
| INV-20 | **One Open and one Current fiscal year at a time.** | Deterministic period; no parallel cycles | K-006; `UX_FiscalYears_OneOpen/OneCurrent` |

## Notification invariants

| # | Invariant | Why inviolable | Canonical source |
|---|-----------|----------------|------------------|
| INV-21 | **Read ≠ Resolved. Never merge them.** Reading navigates; only the workflow action resolves. | Notifications model outstanding work, not messages | K-001; BR-33 |
| INV-22 | **Badge counts active (unresolved) tasks**, not unread messages. | To-do semantics | K-001; BR-34 |
| INV-23 | **No two ACTIVE actionable notifications for the same `(recipient, type, plan/entity)`.** | A duplicate lets a user "complete" work while a twin lingers | K-009; BR-36 |
| INV-24 | **Pending actionable tasks cannot be manually deleted** — only resolved history archived. | Prevents hiding un-done work | K-001; BR-35 |

## Security invariants

| # | Invariant | Why inviolable | Canonical source |
|---|-----------|----------------|------------------|
| INV-25 | **Authorization enforced server-side (middleware + API + service); UI is never the security boundary.** | Defense in depth against IDOR/privilege escalation | ADR-010; BR-38/43 |
| INV-26 | **Accounts are admin-provisioned only** (no public register/forgot/reset). | Enterprise credential model | ADR-010; BR-40 |
| INV-27 | **App DB login is least-privilege (`app_budget_ops`)**, with DENY on audit tables. | Blast-radius containment | ADR-009/011; BR-42 |

## AI-032 — Browser Safety Contract v2

**Core invariant:** No Client Component / browser module may **directly or transitively**
reach a server-only dependency.

Server-only means: Application, Infrastructure (including SQL/DI/startup), `lib/server`,
`lib/security`, native SQL drivers (`mssql`, `msnodesqlv8`), Node built-ins, or any module
that value-imports those (fixed-point classification), including modules stamped with
`import "server-only"`.

**Domain is browser-safe when pure.** `src/domain/**` may be imported by the client when it
has no value-import of Application, Infrastructure, React, or Next.js. Prefer
`import type` for domain types when only types are needed (erased at compile time — no
runtime reachability).

### Enforcement levels

| Level | What | Tool |
|-------|------|------|
| **1 — Fast path** | Reject direct client/shared imports of known server roots and native packages | Architecture Guard Level 1 |
| **2 — Reachability** | Import graph + server-only classification + BFS from `"use client"` / `lib/client`; report shortest chain + suggested fix | Architecture Guard Level 2 |
| **3 — Runtime markers** | `server-only` / `client-only` stamps; webpack aliases (`mssql`/`msnodesqlv8` → false on client/edge) | `scripts/stamp-server-only.ts`, `next.config.js` |
| **4 — CI + bundle** | Guard + dependency-cruiser + browser artifact scan | `lint:boundaries`, `lint:deps`, `lint:browser`, `.github/workflows/architecture-guard.yml` |

### Allowed client imports

- `components`, `hooks`, `lib/shared` (pure TS), `lib/client` (`client-only`)
- Pure `domain/**` (value or `import type`)
- Generated / shared types (`lib/shared/**`)
- Never: Application, Infrastructure, SQL, DI, `lib/server`, `lib/security`, `package.json`, Node built-ins

### Diagnostics

Violations print an **import chain** (client → … → server-only) and a **suggested fix**
(API route, move helper to `lib/shared`, keep SQL on server).

### Roadmap

| Version | Status |
|---------|--------|
| **v1** | Direct bans + stamps + CI (Change #020) |
| **v2** | Transitive reachability + chains + domain purity + type-only handling (**this**) |
| **v3** | Richer suggested fixes / autofix hints (planned) |
| **v4** | IDE / pre-commit integration (planned) |

**Remaining risks:**

1. Architecture Guard CLI remains authoritative over ESLint for client boundary scans.
2. Compatibility shims under `src/lib/*` — migrate gradually to `lib/shared` / `lib/client`.
3. Browser runtime verification (`/admin`, notification bell, reports, finance) remains on
   the staging E2E matrix per `docs/RELEASE_CHECKLIST.md`.

### Detail (INV-28…31)

| # | Invariant | Why inviolable | Canonical source |
|---|-----------|----------------|------------------|
| INV-28 | **Browser Safety Rule** — see AI-032 v2. Client / `lib/client` must not reach server-only code (direct or transitive). Pure domain + `lib/shared` + `lib/client` + components/hooks are allowed. | Prevents native SQL drivers leaking into the browser bundle | **AI-032**; ADR-001 |
| INV-29 | **`application/**`, `infrastructure/**`, `lib/server/**`, `lib/security/**` are server-only** (`import "server-only"`). **`lib/client/**` is browser-only** (`import "client-only"`). **`lib/shared/**` is pure TypeScript**. Domain stays free of Application/Infrastructure/React/Next. | Build-time and CI enforcement | **AI-032**; `scripts/stamp-server-only.ts` |
| INV-30 | **SQL exists only under `src/infrastructure/repositories/sql/**`.** | Persistence behind repository interfaces | **AI-032**; INV-1; ADR-009 |
| INV-31 | **App version in the browser uses `NEXT_PUBLIC_APP_VERSION` / `@/lib/shared/app-version`**, never `package.json` in client code. | Keeps build metadata out of client bundles | **AI-032**; `next.config.js` |

**CI commands:** `npm run lint:boundaries`, `npm run lint:deps`, `npm run verify:browser`.

---

**To change any invariant:** edit the canonical source (ADR or K-entry), record a superseding
entry (never rewrite meaning), update `docs/BUSINESS_RULES.md`, and note it in
`docs/CHANGE_HISTORY.md`. This file is then updated to point at the new source.

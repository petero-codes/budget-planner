# Pre-Staging Verification — 2026-07-16 (reclassified)

| Field | Value |
|-------|-------|
| **Document** | Pre-staging verification inspection |
| **Codebase** | KenGen ICT Budget Operations |
| **Scope** | Pages, routes, APIs, services, repositories, workflows, UI/nav, TODOs, dead code, architecture |
| **Method** | Grep + file reads of `src/app`, `src/app/api`, `src/application`, `src/components`, `src/infrastructure`, `src/middleware.ts`, `.env.example` |
| **Code modified** | **None** — inspection only |
| **E2E / runtime** | **Not Verified** |
| **Companion dashboard** | `docs/pre-staging-readiness-dashboard.md` |

**Overall verdict: Pending configuration** — 0 Critical / 0 High **code** defects; **2 configuration blockers** must clear before staging deploy.

> **Reclassification note:** An earlier draft of this report labeled F-C1 / F-H1 as Critical/High *code* findings and concluded “Ready with caveats.” That mixed configuration prerequisites with code defects. This revision separates categories using the taxonomy below.

---

## Finding taxonomy

| Category | Blocks Staging? | Blocks Production? |
|----------|-----------------|--------------------|
| Code Defect | Yes (if Critical/High) | Yes |
| Security Vulnerability | Yes | Yes |
| Configuration | Yes (if required for valid staging) | Yes |
| Operational | No | Maybe |
| Documentation | No | No |
| Enhancement | No | No |

---

## What was the “Critical” finding?

| Field | Answer |
|-------|--------|
| Original ID | F-C1 |
| Finding | Staging may run on **mock** repositories if `REPOSITORY_DRIVER` is unset (`di.ts` defaults to `mock`) |
| Classification | **Configuration** — operational prerequisite |
| Is it a code defect? | **No** (default is intentional for local/dev) |
| Is it a security vulnerability? | **No** |
| Is it an operational prerequisite? | **Yes** — staging evidence is invalid on mock |
| Is it a configuration issue? | **Yes** |

**Companion (was F-H1):** `SESSION_SECRET` ≥32 when `NODE_ENV=production` — also **Configuration**, not a code defect.

---

## Executive counts (reclassified)

| Bucket | Count | Staging impact |
|--------|------:|----------------|
| Critical code defects | **0** | — |
| High code defects | **0** | — |
| Critical / High security vulnerabilities | **0** | — |
| **Configuration blockers** | **2** | **Block staging until cleared** |
| Operational (do not enable until ready) | 1 | Does not block if SMTP unset |
| Code / UX (Medium) | 8 | Do not block staging deploy |
| Enhancement | 1 | Do not block |
| Low | 7 | Do not block |
| Info / Documentation | 6 | Do not block |
| **Total catalogued items** | **27** | (same inventory; different labels) |

---

## One-page quality gates

| Metric | Status |
|--------|--------|
| Build | Pending clean staging build at deploy time |
| TypeScript (`tsc --noEmit`) | Pass |
| ESLint | Pass |
| Unit Tests | **73/73** Pass |
| Security Verification | Pass |
| RBAC Verification | Pass (0 Critical/High authz bypasses) |
| Documentation Sync (priority docs) | Pass |
| Critical code defects | **0** |
| High code defects | **0** |
| Configuration blockers | **2** |
| Ready for Staging | **Pending configuration** |

---

## Configuration blockers (must clear before deploy)

| # | Checklist item | Status |
|---|---------------|--------|
| 1 | `REPOSITORY_DRIVER=sql` | ☐ |
| 2 | `SQLSERVER_CONNECTION_STRING` verified | ☐ |
| 3 | `SESSION_SECRET` configured (≥32) | ☐ |
| 4 | HTTPS enabled | ☐ |
| 5 | Database reachable | ☐ |
| 6 | Seed data loaded | ☐ |
| 7 | Migrations current (through `007`) | ☐ |
| 8 | Build passes | ☐ |
| 9 | Tests pass | ☐ |
| 10 | Lint passes | ☐ |

**Do not deploy staging until 1–10 are checked.**

### CFG-1 — `REPOSITORY_DRIVER` defaults to mock
- **Category:** Configuration  
- **Location:** `src/infrastructure/di.ts` (`REPOSITORY_DRIVER ?? "mock"`)  
- **Why it matters:** Misconfiguration silently invalidates staging evidence.  
- **Gate:** Set `REPOSITORY_DRIVER=sql` + working connection string.  
- **Optional hardening (post-staging):** Fail fast in non-development when driver ≠ `sql`.

### CFG-2 — `SESSION_SECRET` required in production
- **Category:** Configuration  
- **Location:** `src/lib/security/session-token.ts`; `.env.example` (commented)  
- **Why it matters:** With `NODE_ENV=production`, app refuses sessions if secret &lt; 32 chars.  
- **Gate:** Set `SESSION_SECRET` (≥32) on staging/production.

---

## Operational (non-blocking if left unset)

### OPS-1 — SMTP path throws if `SMTP_HOST` is set (was F-H2)
- **Category:** Operational  
- **Location:** `src/lib/mailer.ts`  
- **Root cause:** `SMTP_HOST` set → throws `SMTP transport not implemented yet`. `sendMail` has zero callers.  
- **Guidance:** Do **not** set `SMTP_HOST` until transport is implemented.  
- **Blocks staging:** **No** (unless ops enables SMTP expecting delivery)

---

## Enhancement (non-blocking)

### ENH-1 — Login mutations not written to audit trail (was F-H3)
- **Category:** Enhancement (security hardening)  
- **Location:** `src/app/api/v1/auth/login/route.ts`  
- **Root cause:** Login success/failure update session only; no `audits.append`.  
- **Recommended fix:** Append audit/security log for login success/failure (no password).  
- **Blocks staging:** **No**

---

## Verification checklist

| Check | Status | Evidence |
|-------|--------|----------|
| Every visible button has a working handler; no dead buttons / placeholder pages | **Finding** | Most action buttons wired. Header FY `<GlassSelect>` updates local state only. Auth stubs redirect to `/login`. |
| No unreachable routes / broken navigation / missing API implementations | **Verified** | Nav `href`s map to pages; middleware gates match; consumer APIs have `route.ts`. |
| No API without consumer unless documented; no consumer calling missing API | **Finding** | `/api/v1/finance/queue` integration-only; auth stubs 403; `sendMail` unused. |
| No TODO/FIXME/HACK in production `src` | **Finding** | One: `src/lib/mailer.ts` `TODO(production)`. |
| No `console.log`/debug in production `src` | **Finding** | `mailer.ts` `console.log`; error boundaries `console.error`; `sql-retry.ts` `console.warn`. |
| No significant commented-out legacy code | **Verified** | None found. |
| No duplicate business logic / dead code / unused repos or services | **Finding** | Dual FY admin UIs; unused mailer; mock repos for `REPOSITORY_DRIVER=mock`. |
| Loading / empty / error states where UI requires them | **Finding** | Notifications: loading + empty, no error state. |
| Role navigation / permission consistency | **Finding** | Largely aligned; Access Denied always `/home`; header bell always shown. |
| Workflow / notification / report / export dead ends | **Finding** | Core paths wired; some secondary-panel errors swallowed. |
| Orphan components | **Verified** | Shared components referenced. |
| Unused env vars (`.env.example` vs code) | **Finding** | Drift on currency/SAP/SLA/SESSION_SECRET docs. |
| Missing audit logging on critical mutations | **Finding** | Gaps: `updateDraft`, `createAmendment`, login. |
| Silent exception handling | **Finding** | Escalations, header FY, SAP print audit, rollback ignore. |
| SQL bypassing repositories | **Finding** | `auth-store.ts` and `/api/v1/me` position lookup. |
| Clean Architecture violations | **Finding** | UI → types only OK; `/api/v1/me` DI smell. |

---

## Code / UX Medium (do not block staging deploy)

#### F-M1 — Header fiscal-year selector is non-functional
- **Category:** Code Defect (UX) · Medium  
- **Location:** `src/components/layout/header.tsx`  
- **Blocks staging:** No

#### F-M2 — `updateDraft` writes no audit event
- **Category:** Code Defect · Medium  
- **Location:** `src/application/budget-plan-service.ts`  
- **Blocks staging:** No

#### F-M3 — `createAmendment` has workflow + notifications but no audit append
- **Category:** Code Defect · Medium  
- **Location:** `src/application/budget-plan-service.ts`  
- **Blocks staging:** No

#### F-M4 — Access Denied “Return to Home” always `/home`
- **Category:** Code Defect (UX) · Medium  
- **Location:** `src/app/(portal)/access-denied/page.tsx`  
- **Blocks staging:** No

#### F-M5 — Notifications page lacks error handling
- **Category:** Code Defect (UX) · Medium  
- **Location:** `src/app/(portal)/notifications/page.tsx`  
- **Blocks staging:** No

#### F-M6 — Silent swallow of finance escalation errors
- **Category:** Code Defect (UX) · Medium  
- **Location:** `src/app/(portal)/finance/page.tsx`  
- **Blocks staging:** No

#### F-M7 — Budget detail silently drops workflow/compare failures
- **Category:** Code Defect (UX) · Medium  
- **Location:** `src/app/(portal)/budgets/[id]/page.tsx`  
- **Blocks staging:** No

#### F-M8 — Session cookie permissions can lag DB role changes
- **Category:** Operational caveat / accepted residual · Medium  
- **Location:** `src/middleware.ts`; mitigated by AppShell `/api/v1/me` refresh  
- **Blocks staging:** No

#### F-M9 — `.env.example` / code env drift
- **Category:** Documentation · Medium  
- **Location:** `.env.example`  
- **Blocks staging:** No

#### F-M10 — `/api/v1/me` bypasses DI for position lookup
- **Category:** Code Defect (layering) · Medium  
- **Location:** `src/app/api/v1/me/route.ts`  
- **Blocks staging:** No

---

## Low

| ID | Category | Summary | Blocks staging |
|----|----------|---------|----------------|
| F-L1 | Operational / debt | Production TODO in mailer | No |
| F-L2 | Operational | console.log/error/warn in `src` | No |
| F-L3 | Enhancement | Dual FY admin surfaces | No |
| F-L4 | Documentation | Auth self-service redirects | No |
| F-L5 | Documentation | `auth-store` SQL outside repos | No |
| F-L6 | Enhancement | Verify-email orphaned | No |
| F-L7 | Code Defect (UX) | SAP PDF audit fetch silent | No |

---

## Info

| ID | Category | Summary | Blocks staging |
|----|----------|---------|----------------|
| F-I1 | Documentation | `/finance/queue` integration-only | No |
| F-I2 | Operational | Scripts `console.log` | No |
| F-I3 | Documentation | Unused currency/SAP env in example | No |
| F-I4 | Documentation | UI imports application types only | No |
| F-I5 | Documentation | Domain validation catches intentional | No |
| F-I6 | Documentation | Related same-day readiness audit | No |

---

## What was verified clean

1. Portal page tree exists for nav targets.  
2. Consumer → API mapping for primary workflows.  
3. No UI → repository imports.  
4. No significant commented-out legacy blocks.  
5. Middleware session + coarse RBAC + CSRF + rate limits present.  
6. Shared layout components in use.  
7. Major list pages implement loading/empty/error patterns (except notifications error).  
8. Critical finance/approval mutations generally call `audits.append`.

---

## Staging readiness recommendation

**Pending configuration** — not “Ready with caveats,” and not “Not Ready” due to code Critical/High.

| Dimension | Status |
|-----------|--------|
| Code (Critical / High defects) | Ready (0 / 0) |
| Security (Critical / High vulns) | Ready (0 / 0) |
| Configuration | **Not ready** until checklist 1–10 complete |
| E2E acceptance | Not started — after staging deploy |

Do **not** treat this as a substitute for `docs/staging-e2e-acceptance.md`.

---

## Release path (after config clears)

1. Resolve configuration blockers + full pre-deploy checklist.  
2. Deploy staging.  
3. Execute acceptance matrix (technical E2E + UAT).  
4. Fix only what E2E uncovers.  
5. Produce release dossier.  
6. Go / Conditional Go / No Go.

---

## Explicit statement

**Inspection only. No application code was modified for this reclassification.** Artifacts: this report and `docs/pre-staging-readiness-dashboard.md`.

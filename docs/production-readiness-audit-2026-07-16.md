# Production Readiness Audit — 2026-07-16

| Field | Value |
|-------|-------|
| **Document** | Independent code re-verification (supersedes claims in `docs/production-readiness.md` where they conflict) |
| **Scope** | KenGen ICT Budget Operations portal — production readiness (no new features) |
| **Evidence** | Source inspection of `src/`, `docs/migrations/`, `tests/unit/`; `npm test` **67/67**; `npx tsc --noEmit` clean; `npm run lint` clean |
| **E2E** | **Not Verified** (no automated browser E2E in repo; acceptance checklist remains manual) |
| **Interim label** | CONDITIONAL GO (audit language) |
| **Binding release decision** | **GO** only when objective exit criteria in `docs/ENGINEERING_GOVERNANCE.md` / `docs/production-readiness.md` are met |

**Governance freeze (2026-07-16):** Priority Documentation Drift is a Milestone 2 release gate; Known Accepted Technical Debt is tracked by ID; Business Rule Freeze and numeric exit criteria are binding in `docs/ENGINEERING_GOVERNANCE.md`.

---

## Production Readiness Score

**72 / 100 — interim CONDITIONAL GO** (not a GO until objective gates pass)

### Objective exit criteria (from governance)

| Gate | Requirement | This audit |
|------|-------------|------------|
| M2 Complete | 0 Critical · 0 High · ≤5 Medium | **Not met** — open Critical ops (C2–C3); open High (H5–H7) |
| Security | No known open RBAC/IDOR/auth/audit issues | Residual H6; ops C2 |
| Quality | tsc · ESLint · tests green | **Met** (67/67) |
| E2E | 100% critical workflow | **Not Verified** |
| Documentation | No Priority Documentation Drift | **Cleared** 2026-07-16 |
| Operations | SESSION_SECRET, backups, HTTPS, deploy guide | **Not Verified** |

### Justification

Core workflow (auth, RBAC, budget lifecycle, finance claim/finalize, lineage, audit, CSRF, optimistic concurrency, parameterized SQL) is implemented and wired in code. Unit coverage of critical paths is green (67 tests). Blocking operational conditions and Priority Documentation Drift remain human/engineering gates — not opinions.

---

## Critical Issues

| ID | Finding | Status | Evidence |
|----|---------|--------|----------|
| C1 | **API INTERNAL responses leaked raw exception messages** (SQL/path/stack risk in production) | **Fixed** | `budgetApiError` / `adminApiError` / login + major GET routes now use `safeInternalMessage`. New helper: `src/lib/security/safe-error-message.ts`. |
| C2 | **Production deploy without `SESSION_SECRET` (≥32)** | Open (ops) | `session-token.ts` throws in production if unset — correct, but must be configured before go-live. |
| C3 | **Blocking acceptance conditions unmet** | Open (ops) | HTTPS, least-privilege DB login, E2E approval spine — not verifiable from code alone. |

---

## High Issues

| ID | Finding | Status | Evidence |
|----|---------|--------|----------|
| H1 | **Report Issue button was a silent no-op** | **Fixed** | `footer.tsx` — now shows status text directing users to System Admin / ICT Support. No helpdesk API exists; full ticketing not invented. |
| H2 | **`/access-denied` not in middleware portal gate** | **Fixed** | Added to `PORTAL_PREFIXES` + matcher — unauthenticated users redirect to login. |
| H3 | **Finance `release` wrote no audit / history / workflow** | **Fixed** | `finance-service.ts` now appends `FinanceReleased` audit, history, workflow; route passes `correlationId`. |
| H4 | **Executive / Reports treated only `Approved`, missing post-finance `Finalized`** | **Fixed** | `executive-service.ts` `totalApproved`; reports approved/turnaround filters include `Finalized`; Approvals “Approved” tab includes finance-pipeline statuses. |
| H5 | **SMTP_HOST set → `sendMail` throws** (“not implemented”) | Open | `src/lib/mailer.ts` — unused by live routes (public forgot/register stubbed 403). **Risk if ops enables SMTP without shipping transport.** Defer or implement before enabling. |
| H6 | **Session cookie embeds permissions; role changes require re-login** | Open (by design / residual) | Middleware RBAC uses signed claims; API uses DB user via `getCurrentUser`. Portal page gate can lag until cookie refresh. |
| H7 | **E2E workflow not executed in this audit** | Not Verified | Code paths exist for submit → approve → finance claim/finalize; staging acceptance still required. |

---

## Medium Issues

| ID | Finding | Status | Evidence |
|----|---------|--------|----------|
| M1 | Reports “Export Excel” duplicated CSV; “Export PDF” was `window.print` | **Fixed** | Reports: CSV + Print only. SAP page: “Download PDF” → “Print”. |
| M2 | `.env.example` contained a concrete SQL password | **Fixed** | Replaced with `CHANGE_ME`. |
| M3 | `listFinanceAdministrators` / several services call `users.getAll()` | Open | Perf/N+1 risk as user count grows (`approval-service`, `finance-service`, `reference`). |
| M4 | Finance escalations mutate without dedicated transaction wrapping per plan | Open | `processEscalations` — sequential saves; acceptable for single-node v1. |
| M5 | Access Denied “Return to Home” always `/home` | Open | SystemAdmin primary landing is `/admin`; `/home` still allowed by middleware. |
| M6 | `markRead(id)` repository method has no user ownership filter | Open | Not exposed by API today (dismiss is ownership-scoped). Do not wire without userId. |
| M7 | In-memory rate limit only | Accepted for single-instance | Documented deferred Redis. |
| M8 | Attachments UX/API deferred | Accepted | Schema exists; product deferred. |

---

## Low Issues

| ID | Finding | Status |
|----|---------|--------|
| L1 | `mailer.ts` unused scaffolding + TODO | Keep; document as deferred |
| L2 | Public register / forgot / reset pages redirect to login; APIs return 403 | Intentional admin-provisioned accounts |
| L3 | `REPOSITORY_DRIVER` defaults to `mock` if unset | Ops must set `sql` in production |
| L4 | Button audit scripts under `scripts/` are tooling, not runtime dead code | Leave |
| L5 | GM org-role heuristic (`managerId === null` + `budget.approve`) | Fragile if data model changes; works with seed |

---

## Technical Debt

Canonical register: **Known Accepted Technical Debt** in `docs/production-readiness.md` (TD-001 … TD-009).

| ID | Item | Status |
|----|------|--------|
| TD-001 | SMTP implementation | Deferred |
| TD-002 | Attachment upload UI | Deferred |
| TD-003 | SAP PDF generation | Deferred |
| TD-004 | Redis rate limiting | Deferred |
| TD-005 | Automated E2E | Deferred (M3) |
| — | Priority Documentation Drift gate | **CLEARED** 2026-07-16 |

Do not scatter deferred items only across narrative sections; keep the ID register current when Status changes.

---

## Security Findings

### Verified controls (code)

| Control | Evidence |
|---------|----------|
| CSRF | Middleware `assertSameOrigin` on mutating `/api` |
| Session | HMAC-SHA256 signed cookie; production requires `SESSION_SECRET` |
| Password verify | Constant-time style compare in session MAC; login avoids email enumeration |
| SQLi | Parameterized `mssql` inputs in SQL repos |
| XSS | No `dangerouslySetInnerHTML` in app source |
| Security headers | CSP, HSTS, frame deny, nosniff in `next.config.js` |
| IDOR budgets | `AuthorizationService.assertCanView` / visibility scopes |
| Notification dismiss | `DELETE ... AND UserId = @userId` |
| Finance claim race | Unique filtered index `UX_FinanceQueueClaims_ActivePlan` |
| Optimistic concurrency | `Version = Version + 1 WHERE Version = @expectedVersion` |
| Admin / finance / audit APIs | Permission checks in services/routes |
| Public auth self-service | Stubbed 403 |

### Residual risks

| Risk | Severity | Notes |
|------|----------|-------|
| INTERNAL message leakage on any route missed by sanitization pass | Medium→Low | Shared helpers + majority of routes updated; grep shows no remaining `"Unexpected error"` raw pattern on API routes |
| Stale middleware permission claims | Medium | See H6 |
| Enabling SMTP without transport | High | See H5 |
| AuditViewer / Viewer naming | Info | Role is `AuditViewer` (not literal “Viewer”); Budget Holder ≈ `BudgetSubmitter` |

---

## Dead Code Removed

**None deleted.** Removals require proven-unused + no deferred scaffolding value.

| Candidate | Decision |
|-----------|----------|
| `src/lib/mailer.ts` | **Keep** — deferred SMTP; unused by live routes |
| Auth register/forgot/reset pages | **Keep** — redirect stubs for URL hygiene |
| Attachment repositories | **Keep** — schema-backed deferred feature |

---

## Duplicate Logic Removed

**None removed this pass.** Org-role resolution already centralized in `domain/rules/org-role.ts`.

---

## Broken Buttons Fixed

| Control | Before | After |
|---------|--------|-------|
| Footer “Report an issue” | Empty `onClick` | Shows ICT Support guidance (`role="status"`) |
| Reports “Export Excel” | Same as CSV | Removed (misleading) |
| Reports “Export PDF” | `window.print` labeled PDF | Relabeled **Print** |
| SAP “Download PDF” | Print dialog labeled PDF | Relabeled **Print** |

---

## Broken Navigation Fixed

| Item | Fix |
|------|-----|
| `/access-denied` reachable without session | Middleware session gate |
| Approvals “Approved” tab empty after Finance flow | Include `Finalized` / finance queue statuses |

---

## Role Issues Fixed

No privilege-escalation bugs proven and fixed beyond metrics/nav accuracy.

| Role (capability) | Code mapping | Nav / gate |
|-------------------|--------------|------------|
| SystemAdmin | `SystemAdmin` | `/admin`, audit; middleware `admin.*` |
| FinanceAdministrator | `FinanceAdministrator` | `/finance`, FY, reports, audit |
| GM | `managerId === null` + `budget.approve` | Home + approvals + executive APIs |
| Manager | `budget.approve` | Approvals + managed CCs |
| Budget Holder | `BudgetSubmitter` | Create/submit own |
| Viewer | `AuditViewer` → `audit.view` | Audit trail only |

Hidden routes: middleware coarse RBAC + service-level asserts. Direct API without cookie → 401.

---

## Performance Improvements

**None implemented** (no proven safe hot-path change without broader redesign). Findings logged under Medium (M3).

---

## Accessibility Improvements

| Change | Why |
|--------|-----|
| Report Issue status uses `role="status"` | Screen-reader feedback for previously silent control |
| Existing Button `aria-busy` / focus rings | Preserved |

---

## Files Modified

| File | Why |
|------|-----|
| `src/lib/security/safe-error-message.ts` | **New** — production-safe INTERNAL messages |
| `src/lib/security/budget-api-error.ts` | Use sanitizer for unexpected errors |
| `src/lib/security/admin-api-error.ts` | Same |
| `src/app/api/v1/auth/login/route.ts` | Same |
| Multiple `src/app/api/v1/**/route.ts` | Sanitize INTERNAL responses |
| `src/components/layout/footer.tsx` | Fix Report Issue no-op |
| `src/middleware.ts` | Gate `/access-denied` |
| `src/application/finance-service.ts` | Audit Finance release |
| `src/domain/value-objects/budget-status.ts` | Add `FinanceReleased` action |
| `src/app/api/v1/budget-plans/[id]/finance/release/route.ts` | Pass correlationId |
| `src/application/executive-service.ts` | Count Finalized in approved amounts |
| `src/app/(portal)/approvals/page.tsx` | Approved tab includes post-GM statuses |
| `src/app/(portal)/reports/page.tsx` | Finalized filters; honest export labels |
| `src/app/(portal)/finance/sap/[id]/page.tsx` | Print label |
| `.env.example` | Remove concrete password |
| `tests/unit/budget-api-error.test.ts` | Cover sanitization |
| `tests/unit/finance-release.test.ts` | Assert release audit |
| `docs/production-readiness-audit-2026-07-16.md` | This report |
| `docs/production-readiness.md` | Supersession note |

---

## Tests Added

| Test | Purpose |
|------|---------|
| `budget-api-error` production sanitization (via `forceProduction`) | Prevent regression of info disclosure |
| `finance-release` asserts `FinanceReleased` audit | Prevent silent release |

**Verified:** `npm test` → **67/67**; `tsc --noEmit` → **0**; `npm run lint` → **clean**.

---

## Regression Risks

1. Approvals “Approved” tab now includes Pending Finance / Claimed / Finalized — intentional; confirm with Product that this is desired for managers/GM.
2. Report Issue no longer silent — copy may need Product/ICT contact wording tweak.
3. INTERNAL messages in production are generic — correlating via `correlationId` in logs remains required (ops).
4. Finance release now writes history/audit — consumers of approval history should tolerate `FinanceReleased`.

---

## Phase Verification Summary

| Phase | Result |
|-------|--------|
| 1 Code audit | Complete — TODO only in deferred mailer; no proven-unused deletions |
| 2 Buttons/UI | Inventory + fixes above; E2E hover/focus **Not Verified** in browser |
| 3 Functionality | Code paths wired; E2E **Not Verified** |
| 4 Roles | Code + middleware + nav reviewed |
| 5 Security | Critical leakage fixed; residual ops items open |
| 6 Database | Constraints/indexes/concurrency verified in schema + SQL repos |
| 7 UX | Misleading export labels fixed; Report Issue guidance added |
| 8 Performance | Findings only (M3) |
| 9 Report Issue | Stub confirmed; remediated to honest UX (no fake helpdesk) |
| 10 Report | This document |

---

## Human Decisions / Blockers

1. Confirm SESSION_SECRET, HTTPS, DB credentials, and run Production Acceptance Tests (items 1–17 in prior readiness doc).
2. Clear **Priority Documentation Drift** release gate (`state-machines`, `domain-model`, `permission-matrix`, `approval-engine`) before marking Milestone 2 Complete.
3. Keep Known Accepted Technical Debt (TD-001 … TD-009) consciously deferred — or schedule before go-live if Product re-opens scope.
4. Confirm Approvals “Approved” tab semantics (include Finance pipeline?).
5. Do **not** set `SMTP_HOST` until mailer is implemented (TD-001).
6. Prefer staging E2E of full GM → Finance → Finalize spine before production traffic.
7. Respect **Business Rule Freeze** — no unapproved changes to workflow, RBAC, schema, or API contracts.

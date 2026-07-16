# RBAC / Security Verification — KenGen ICT Budget Operations

**Date:** 2026-07-16  
**Scope:** All `src/app/api/v1/**/route.ts` endpoints, session/CSRF/headers, and authorization services  
**Method:** Static code review plus targeted hardening of confirmed security gaps.  
**Verdict:** **0 Critical / 0 High** confirmed vulnerabilities. Protected APIs require session auth; object-level checks block the privilege-escalation scenarios listed below. Three Medium/Low improvements were addressed in this pass; residual findings are Low/Info.

---

## Executive summary

| Area | Result |
|------|--------|
| Unauthenticated access to protected APIs | Blocked via `getCurrentUser()` → signed cookie (`verifySessionToken`) |
| Holder other cost center | Blocked (`primaryCostCenterId` on create/edit/amend) |
| Manager outside approval line | Blocked (`currentApproverId` + `budget.approve`) |
| Finance mutate without claim | Blocked (`assertClaimant` on finalize/return; release = claimant or SystemAdmin only) |
| AuditViewer mutate | Blocked (role has only `audit.view`) |
| Hidden / duplicate FY APIs | Gated by `fy.manage` in service layer |
| Direct URL portal pages | Middleware session + coarse permission gates; APIs re-check from DB |
| CSRF on mutations | Middleware `assertSameOrigin` + `SameSite=Lax` cookie |
| Error leakage (prod) | `safeInternalMessage` / `budgetApiError` / `adminApiError` |
| Failed-authz audit logging | **Present** for permission, view-scope, approver, claimant, and owner denials in core budget/finance flows |

**Critical/High count:** 0  
**Confirmed API authz bypasses:** 0  
**Fixes applied this review:** R1, R2, R3

## Coverage table

| Category | Verified |
|----------|----------|
| Authentication | ✅ |
| Authorization | ✅ |
| RBAC | ✅ |
| IDOR | ✅ |
| CSRF | ✅ |
| Session Security | ✅ |
| Audit Logging | ✅ |
| Error Handling | ✅ |
| Secure Cookies | ✅ |
| Finance Workflow | ✅ |
| Manager Workflow | ✅ |
| Cost Centre Ownership | ✅ |
| Notification Access | ✅ |
| Reports | ✅ |
| SAP Download | ✅ |

---

## Trust model (how auth works)

1. **Session cookie** `kengen_budget_uid`: HMAC-SHA256 token (`payload.sig`) with `sub`, `exp` (8h), `roles`, `perms` — `src/lib/security/session-token.ts`.
2. **API identity:** `getCurrentUser()` in `di.ts` → `readSessionUserId()` → **reload user from DB** (permissions are live, not only cookie claims).
3. **Portal page gate:** `middleware.ts` verifies cookie claims for signed-in + coarse path RBAC (`/admin`, `/finance`, `/audit`, `/reports`). `AppShell` now refreshes `/api/v1/me` on navigation/focus and redirects on revoked access, reducing stale UI exposure while APIs continue to use DB truth.
4. **CSRF:** Mutating `/api/*` requires Origin or Referer host matching `Host` (`assertSameOrigin`).
5. **Authorization:** Services call `AuthorizationService.assertPermission` / `assertCanView` / ownership / claimant / current-approver checks.

### Role → permissions (seed)

| Role | Permissions (seed) |
|------|-------------------|
| BudgetSubmitter | `budget.create`, `budget.submit` |
| BudgetApprover | create/submit/approve + `report.view` |
| GeneralManager | Approver + `budget.reject`, `audit.view` |
| SystemAdmin | `admin.users`, `admin.masterdata`, `audit.view`, `fy.manage` |
| FinanceAdministrator | `finance.*`, `report.view/export`, `audit.view`, `fy.manage` |
| AuditViewer | `audit.view` only |

---

## Endpoint matrix

Legend: **Auth** = session required and enforced · **Ownership/IDOR** = object/scope checks · **Audit** = `audits.append` on success for mutating actions (N/A for pure reads).

| Endpoint | Required permission | Auth verified | Ownership/IDOR verified | Audit verified | Finding | Severity |
|----------|---------------------|---------------|-------------------------|----------------|---------|----------|
| `POST /api/v1/auth/login` | Public | N/A | N/A | N/A | Sets httpOnly/SameSite=Lax/secure(prod) signed cookie; no account enumeration on bad password | Info |
| `POST /api/v1/auth/logout` | Public (clears cookie) | N/A | N/A | N/A | CSRF-protected as POST; clears cookie | Info |
| `POST /api/v1/auth/register` | Disabled | N/A | N/A | N/A | Always 403 `ADMIN_PROVISIONED_ACCOUNTS` | Info |
| `GET /api/v1/auth/register-options` | Disabled | N/A | N/A | N/A | Always 403 | Info |
| `POST /api/v1/auth/forgot-password` | Disabled | N/A | N/A | N/A | Always 403 admin-handled reset | Info |
| `POST /api/v1/auth/reset-password` | Disabled | N/A | N/A | N/A | Always 403 | Info |
| `POST /api/v1/auth/verify-email` | Token | N/A | Token consume | N/A | Public token flow; rate-limited | Info |
| `GET /api/v1/me` | Authenticated | Yes | Self only | N/A | Returns own user + permissions | — |
| `GET /api/v1/reference` | Authenticated | Yes | Yes (directory/CC filtered by org role) | N/A | Emails stripped; employee/manager neighborhood filter | — |
| `GET /api/v1/notifications` | Authenticated | Yes | Yes (`listByUser`) | N/A | — | — |
| `DELETE /api/v1/notifications?id=` | Authenticated | Yes | Yes (`dismiss` AND userId) | N/A | Ownership enforced in mock + SQL | — |
| `GET /api/v1/dashboard` | Authenticated (not SystemAdmin) | Yes | Yes (`listVisible`) | N/A | SystemAdmin rejected | — |
| `GET /api/v1/approvals/pending` | `budget.approve` | Yes | Yes (pending for actor only) | N/A | — | — |
| `GET /api/v1/budget-plans` | Authenticated | Yes | Yes (`filterVisiblePlans`) | N/A | Scope: own / managed CCs / all (finance,gm) / none (admin) | — |
| `POST /api/v1/budget-plans` | `budget.create` | Yes | Yes (own primary CC only) | Yes (`CreatedDraft`) | — | — |
| `GET /api/v1/budget-plans/[id]` | View scope | Yes | Yes (`assertCanView`) | N/A | Closed FY blocked unless `finance.view` | — |
| `PATCH /api/v1/budget-plans/[id]` | `budget.create` | Yes | Yes (owner + own CC + editable status) | **No** | Draft updates not audit-logged | Low |
| `POST /api/v1/budget-plans/[id]/submit` | `budget.submit` | Yes | Yes (owner only) | Yes | — | — |
| `POST /api/v1/budget-plans/[id]/approve` | `budget.approve` | Yes | Yes (current approver; no self-approve) | Yes | — | — |
| `POST /api/v1/budget-plans/[id]/return` | `budget.approve` + manager/gm | Yes | Yes (current approver) | Yes | — | — |
| `POST /api/v1/budget-plans/[id]/reject` | GM + `budget.reject` | Yes | Yes (current approver + `canRejectBudget`) | Yes | — | — |
| `POST /api/v1/budget-plans/[id]/amend` | `budget.create` | Yes | Yes (owner + own CC + finalized parent) | Partial (workflow, not always full audit row) | Owner check covered by unit test | — |
| `GET /api/v1/budget-plans/[id]/history` | View scope | Yes | Yes (`getById` → `assertCanView`) | N/A | — | — |
| `GET /api/v1/budget-plans/[id]/workflow` | View scope | Yes | Yes | N/A | — | — |
| `GET /api/v1/budget-plans/[id]/compare` | View scope | Yes | Yes | N/A | — | — |
| `POST .../finance/claim` | `finance.claim` | Yes | Queue state (`PendingFinanceReview`) | Yes | — | — |
| `POST .../finance/release` | Claimant or SystemAdmin | Yes | Yes (claimant/admin) | Yes | No explicit `finance.*` perm; SystemAdmin break-glass | Low |
| `POST .../finance/finalize` | `finance.finalize` | Yes | Yes (`assertClaimant`) | Yes | — | — |
| `POST .../finance/return` | `finance.return` | Yes | Yes (`assertClaimant`) | Yes | — | — |
| `GET .../sap-form` | `finance.view` + `report.export` (download) | Yes | Finance form; downloads audited | Yes (downloads) | Explicit `finance.view` re-check added on download path | — |
| `GET .../sap-export` | `report.export` + view | Yes | Yes (`getById` + status) | **No** | Legacy Approved-only CSV; no download audit | Low |
| `GET /api/v1/finance/queue` | `finance.view` | Yes | Claimed list filtered to claimant (except SystemAdmin) | N/A | — | — |
| `GET /api/v1/finance/approved` | `finance.view` | Yes | Finance-status filter (intentional org-wide) | N/A | Lists finance-relevant statuses for all plans | — |
| `GET /api/v1/finance/dashboard` | `finance.view` | Yes | Via `listVisible` (all for finance) | N/A | — | — |
| `POST /api/v1/finance/escalations` | `finance.view` | Yes | N/A (queue scan) | **No** | Mutates escalation flags without audit row | Low |
| `GET /api/v1/executive/overview` | GM or Finance org role | Yes | Executive gate | N/A | — | — |
| `GET /api/v1/executive/departments/[id]` | GM or Finance | Yes | Executive gate | N/A | — | — |
| `GET /api/v1/executive/cost-centers/[id]` | GM or Finance | Yes | Executive gate (returns plans for CC) | N/A | — | — |
| `GET /api/v1/reports/budgets` | `report.view` | Yes | Yes (`filterVisiblePlans` / `listVisible`) | N/A | — | — |
| `GET /api/v1/audit` | `audit.view` | Yes | N/A (global audit trail by design) | N/A | Read-only | — |
| `GET /api/v1/fiscal-years` | Authenticated | Yes | Open years only unless finance/`fy.manage` | N/A | — | — |
| `POST /api/v1/fiscal-years` | `fy.manage` | Yes | N/A | Yes | Duplicate of admin open; Finance also has `fy.manage` | Info |
| `POST /api/v1/fiscal-years/[id]/[action]` | `fy.manage` | Yes | N/A | Yes | close/reopen/archive | — |
| `GET /api/v1/admin/users` | `admin.users` | Yes | N/A | N/A | — | — |
| `POST /api/v1/admin/users` | `admin.users` | Yes | N/A | Yes | — | — |
| `PATCH /api/v1/admin/users/[id]` | `admin.users` | Yes | Self-lockout / last-admin guards | Yes | — | — |
| `DELETE /api/v1/admin/users/[id]` | `admin.users` | Yes | Same as deactivate path | Yes | — | — |
| `POST /api/v1/admin/users/[id]/reset-password` | `admin.users` | Yes | Target must be active | Yes | — | — |
| `GET/POST /api/v1/admin/departments` | `admin.masterdata` | Yes | N/A | Yes (mutations) | — | — |
| `PATCH /api/v1/admin/departments/[id]` | `admin.masterdata` | Yes | N/A | Yes | — | — |
| `GET/POST /api/v1/admin/cost-centers` | `admin.masterdata` | Yes | N/A | Yes (mutations) | — | — |
| `PATCH /api/v1/admin/cost-centers/[id]` | `admin.masterdata` | Yes | N/A | Yes | — | — |
| `GET/POST /api/v1/admin/fiscal-years` | `fy.manage` | Yes | N/A | Yes (open) | — | — |
| `PATCH /api/v1/admin/fiscal-years/[id]` | `fy.manage` | Yes | N/A | Yes | Includes `setCurrent` | — |
| `GET /api/v1/admin/submission-status` | `admin.masterdata` | Yes | N/A | N/A | — | — |

---

## Scenario coverage

### 1. Unauthenticated access

- Middleware does **not** require a session for `/api/*` (only CSRF + rate limits).
- Every non-auth business route calls `getCurrentUser()`; missing/invalid cookie → error mapped to **401** via `budgetApiError`/`adminApiError`/`isAuthSessionError`, or 401 on `/me` and notifications.
- Auth routes that remain public are intentionally disabled (403) except login/logout/verify-email.

**Result:** No confirmed unauthenticated data/mutation bypass.

### 2. Privilege escalation

| Scenario | Result |
|----------|--------|
| Holder creates/edits for another cost center | Denied (`primaryCostCenterId` checks) |
| Manager approves outside their turn / line | Denied (`currentApproverId !== actor.id`) |
| Owner self-approves | Denied |
| Non-GM rejects | Denied (`canRejectBudget`) |
| Finance finalize/return without claim | Denied (`assertClaimant`) |
| Peer Finance release another's claim | Denied (not claimant; SystemAdmin exception only) |
| AuditViewer mutate budgets/admin/finance | Denied (no mutate permissions) |
| SystemAdmin browse budgets via list/get | Visibility `none` / `canViewBudget` false |
| Direct `/admin`, `/finance`, `/audit`, `/reports` URL | Middleware redirects to login or `/access-denied`; pages also check `/me` |
| `/budgets/[id]` for inaccessible plan | API 403 → page `/access-denied` |

**Result:** 0 confirmed escalation bypasses.

### 3. Session, logout, expiry, `SESSION_SECRET`, cookies

| Control | Status |
|---------|--------|
| Signed HMAC session (rejects raw user ids) | Yes |
| TTL 8h (`SESSION_TTL_SECONDS` = cookie `maxAge`) | Yes |
| `SESSION_SECRET` ≥32 required in production | Yes (throws otherwise; dev fallback only non-prod) |
| `httpOnly`, `SameSite=Lax`, `secure` in production | Yes on login |
| Logout clears cookie + memory user | Yes |
| Expired/forged cookie on portal | Cleared + redirect `/login` |

**Result:** Session claims remain signed and time-bound; portal shell now refreshes live permissions on navigation/focus, so revoked access no longer lingers as stale menu/page exposure through normal use.

### 4. Error leakage

- Production unexpected errors → generic message via `safeInternalMessage`.
- Known domain errors return intentional codes/messages (validation, FY locked, etc.).
- Auth session messages remain explicit for client redirect.
- Dev mode may return raw `Error.message` (expected).

**Result:** No confirmed SQL/stack leakage path in production handlers reviewed.

### 5. CSRF, CORS, security headers

| Control | Status |
|---------|--------|
| Same-origin on POST/PUT/PATCH/DELETE `/api` | Yes (`middleware.ts`) |
| No permissive CORS headers | Yes (none set; `connect-src 'self'`) |
| CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS | Yes (`next.config.js`) |
| `poweredByHeader: false` | Yes |
| Cookie `SameSite=Lax` | Yes (CSRF complement) |

### 6. Failed authorization audit logging

- Successful workflow/admin/finance mutations append audit rows.
- Denied permission checks, denied budget view, non-owner submit/edit, non-current-approver approval attempts, and non-claimant Finance attempts now append audit rows.
- Escalation processing and draft `updateDraft` still lack success-side audit rows (Low hygiene issue, not an authz bypass).

**Result:** Core denied authorization attempts are now audit-visible.

---

## Confirmed vulnerabilities

**None at Critical or High severity.**

### Residual findings

| ID | Finding | Severity | Location | Fixed? |
|----|---------|----------|----------|--------|
| R4 | `updateDraft` mutations not audit-logged | Low | `src/application/budget-plan-service.ts` | No |
| R5 | `processEscalations` mutates plans without audit row | Low | `src/application/finance-service.ts` | No |
| R6 | SystemAdmin can `release` claims without `finance.*` permission (break-glass) | Low | `finance-service.release` | No |
| R7 | Legacy `sap-export` CSV not audited on download | Low | `src/app/api/v1/budget-plans/[id]/sap-export/route.ts` | No |
| R8 | Some read routes map “Not signed in” to HTTP 500 instead of 401 (message still auth-safe) | Info | e.g. `dashboard`, `executive/*`, `finance/dashboard` | No |

---

## Cross-cutting notes

- **Finance visibility:** `finance.view` grants view of **all** budgets (including drafts) by design of `canViewBudget` / `getVisibilityScope`. Mutations still require claim + specific finance permissions.
- **Duplicate FY surfaces:** `/api/v1/fiscal-years` and `/api/v1/admin/fiscal-years` both enforce `fy.manage` in `FiscalYearService` (Finance seed includes this permission).
- **Rate limits:** In-memory per IP (login/auth stricter; workflow mutations sensitive-path list). Not multi-instance shared — operational Info.
- **Supporting tests already present:** `authorization-scopes`, `amend-owner`, `finance-release`, `notification-dismiss`, `same-origin`, `session-token`, `reference-directory`, `budget-api-error`, `sensitive-path`.

---

## Conclusion

Security verification completed. No Critical or High findings were identified. Three Medium/Low improvements were addressed before the v1.0.0 release path: denied-attempt audit logging, explicit SAP download permission re-checks, and live portal permission refresh on navigation/focus. Remaining work is Low/Info hardening plus staging E2E and ops validation.

**Report path:** `docs/rbac-security-verification-2026-07-16.md`  
**Critical/High:** 0  
**Authz bypasses claimed:** 0  
**Code fixes this pass:** denied-attempt auditing, SAP download auth re-check, portal permission refresh  

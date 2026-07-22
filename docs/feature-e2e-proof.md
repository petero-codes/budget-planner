# Feature end-to-end proof inventory

**Rule:** A feature is **COMPLETE** only if proof points **1–10** are present with evidence. Points **11–12** are the manual validation protocol (staging matrix).  
**Last traced:** 2026-07-17 against `main` codebase.  
**Out of scope:** Western Region seed user — **not claimed; do not add** unless stakeholder requests.

Binding process: `.cursor/rules/feature-e2e-proof.mdc`, `docs/definition-of-done.md`, `docs/ENGINEERING_GOVERNANCE.md`.

---

## Proof checklist (every claim)

| # | Point |
|---|--------|
| 1 | UI entry point |
| 2 | API endpoint |
| 3 | Application service |
| 4 | Domain rule (or none) |
| 5 | Repository |
| 6 | DB tables modified / read-only |
| 7 | Audit events (or none) |
| 8 | Notifications (or none) |
| 9 | Permission |
| 10 | Automated test |
| 11 | Manual steps |
| 12 | Expected result |

If any of **1–10** is **MISSING**, status = **INCOMPLETE**.

---

## Summary

| Feature | Status | Blocking gap (1–10) |
|---------|--------|---------------------|
| Login | **INCOMPLETE** | No application service; no automated test; no audit |
| Logout | **INCOMPLETE** | No application service; no automated test; no audit |
| Admin create user | COMPLETE | — |
| Admin update user | COMPLETE | — |
| Admin reset password | **INCOMPLETE** | No automated test for `resetPassword` |
| Admin activate / deactivate | COMPLETE | — |
| Budget create draft | COMPLETE | — |
| Budget edit draft | **INCOMPLETE** | No automated test for `updateDraft`; no audit on edit |
| Budget submit | COMPLETE | — |
| Manager/GM approve | COMPLETE | — |
| Manager/GM return | COMPLETE | — |
| GM reject | COMPLETE | — |
| Finance claim | COMPLETE | — |
| Finance finalize | COMPLETE | — |
| Finance return | COMPLETE | — |
| Finance release | COMPLETE | — |
| Active budget conflict (409) | COMPLETE | — |
| Amendment after finalized | COMPLETE* | *No `AuditLogs` append (workflow history only) — document as residual if audit required |
| Notification task lifecycle | COMPLETE | Unit coverage for read vs resolve + destination URLs; staging matrix still records browser evidence |
| Reports view | **INCOMPLETE** | No automated test for reports API |
| Reports client CSV export | **INCOMPLETE** | No dedicated API/audit/test (client Blob only) |
| SAP form download (CSV) | COMPLETE* | *Auth tested; sap-export alternate path weaker |
| Fiscal year manage | COMPLETE* | *`setCurrent` only on admin master-data UI / admin API |
| Development Toolkit | COMPLETE | Dual/triple gate + tests |
| Audit log view | **INCOMPLETE** | No application service; no dedicated list test |

\* = implemented path exists; residual called out — do not market as “fully audited” without fixing residuals.

---

## Incomplete features (detail)

### Login — INCOMPLETE

| # | Evidence |
|---|----------|
| 1 | `/login` — **Sign in** (`src/app/login/page.tsx`) |
| 2 | `POST /api/v1/auth/login` |
| 3 | **MISSING** (route-only) |
| 4 | none — orchestration in route |
| 5 | `findAuthUserByEmail` (`auth-store.ts`) |
| 6 | none (session cookie only) |
| 7 | **none** |
| 8 | none |
| 9 | public |
| 10 | **MISSING** |
| 11 | Open `/login` → email → password → Sign in |
| 12 | 200 + cookie + redirect; bad creds → 401 |

### Logout — INCOMPLETE

| # | Evidence |
|---|----------|
| 1 | Header user menu — **Log Out** |
| 2 | `POST /api/v1/auth/logout` |
| 3 | **MISSING** |
| 4 | none |
| 5 | none |
| 6 | none |
| 7 | **none** |
| 8 | none |
| 9 | authenticated (no permission code) |
| 10 | **MISSING** |
| 11 | Sign in → user menu → Log Out |
| 12 | Cookie cleared; `/login` |

### Admin reset password — INCOMPLETE

| # | Evidence |
|---|----------|
| 1 | `/admin` **Reset password** / profile **Reset Password** |
| 2 | `POST /api/v1/admin/users/[id]/reset-password` |
| 3 | `AdminUserService.resetPassword` |
| 4 | Service: inactive → `INACTIVE_USER` |
| 5 | `IUserAdminRepository.setPasswordHash` |
| 6 | `dbo.Users`, `dbo.AuditLogs` |
| 7 | `UserPasswordReset` |
| 8 | none |
| 9 | `admin.users` |
| 10 | **MISSING** |
| 11 | Admin → Reset password → enter password → confirm |
| 12 | `{ reset: true }`; user signs in with new password |

### Budget edit draft — INCOMPLETE

| # | Evidence |
|---|----------|
| 1 | Detail **Edit Draft** → `/budgets/create?edit=` → **Save** |
| 2 | `PATCH /api/v1/budget-plans/[id]` |
| 3 | `BudgetPlanService.updateDraft` |
| 4 | `assertCanEditDraft`, `validateBudgetHeader/Lines` |
| 5 | `IBudgetPlanRepository`, submission status |
| 6 | `dbo.BudgetPlans`, `dbo.BudgetItems`, `dbo.CostCenterSubmissionStatus` |
| 7 | **none** |
| 8 | none |
| 9 | `budget.create` + owner + editable status |
| 10 | **MISSING** |
| 11 | Open draft → Edit → Save |
| 12 | Draft updated |

### Notification task lifecycle — COMPLETE

| # | Evidence |
|---|----------|
| 1 | `/notifications` (+ header bell **dropdown** — active tasks with priority dot / action label / relative time, "View all notifications"; `src/components/layout/notification-bell.tsx`); **To-do**, **History**, **Mark all as read**, task action labels |
| 2 | `GET /api/v1/notifications`, `GET /api/v1/notifications?view=history`, `POST /api/v1/notifications?action=read&id={id}`, `POST /api/v1/notifications?action=readAll`, `DELETE /api/v1/notifications?id={id}` (resolved history only) |
| 3 | `markNotificationRead` / `markAllNotificationsRead` / `notificationDestination` in `src/application/notification-task-actions.ts`; workflow resolution orchestrated by `ApprovalService`, `FinanceService`, `SupportIssueService`, `FiscalYearService` |
| 4 | `isActionableNotification`; read does not resolve actionable work; unresolved actionable work cannot be manually archived; duplicate-task guard — no second ACTIVE task per recipient+type+plan/entity (K-009, repository `create`) |
| 5 | `INotificationRepository` |
| 6 | `dbo.Notifications` (`ReadAt`, `ResolvedAt`, `ResolvedBy`, `IsCleared`, task metadata); migrations `010-notification-tasks.sql`, `011-notification-task-metadata.sql` |
| 7 | none |
| 8 | Approval, Finance queue/claim/escalation, support issue, fiscal-year closure, admin-user and outcome notifications |
| 9 | authenticated only |
| 10 | Click→read→destination + read≠resolve: `tests/unit/notification-read-lifecycle.test.ts`; duplicate-task guard: `tests/unit/notification-dedup.test.ts` + SQL harness check "NEG duplicate active Approval create is a no-op"; archive ownership/resolvedBy: `tests/unit/notification-dismiss.test.ts`; Finance queue→personal→resolved: `tests/unit/finance-audit.test.ts`; support resolution: `tests/unit/support-issue-service.test.ts` |
| 11 | Submit budget → sign in as approver → open bell dropdown → click **Review Budget** → verify URL `/budgets/{id}?action=approve` with the Decision panel focused, and the task remains in To-do as read → approve → verify it leaves To-do and appears in History with `resolvedAt`/`resolvedBy`; repeat Finance claim/finalize (staging matrix) |
| 12 | Read state changes without completing work; workflow action resolves it; active badge drops; resolved item moves to History; pending work cannot be deleted |

### Reports view / client CSV — INCOMPLETE

| # | Evidence |
|---|----------|
| 1 | `/reports`; **Export CSV** if `report.export` |
| 2 | `GET /api/v1/reports/budgets` (CSV is client-side Blob — **no export API**) |
| 3 | `filterVisiblePlans` / `listVisible` |
| 4 | none |
| 5 | budget repos (read) |
| 6 | read-only |
| 7 | none |
| 8 | none |
| 9 | `report.view` (+ `report.export` for button) |
| 10 | **MISSING** for reports API / client CSV |
| 11 | Staging H9 |
| 12 | Scoped rows; CSV downloads in browser |

### Audit log view — INCOMPLETE

| # | Evidence |
|---|----------|
| 1 | `/audit` |
| 2 | `GET /api/v1/audit` |
| 3 | **MISSING** (route → repo) |
| 4 | none |
| 5 | `IAuditLogRepository.list` |
| 6 | read-only `dbo.AuditLogs` |
| 7 | none (view only) |
| 8 | none |
| 9 | `audit.view` |
| 10 | **MISSING** dedicated list test |
| 11 | Staging H11 |
| 12 | Chronological audit rows |

---

## Complete critical-path features (condensed)

Evidence lives in code; do not re-claim without re-checking.

| Feature | UI | API | Service | Perm | Test |
|---------|----|-----|---------|------|------|
| Admin create | `/admin` Create user | `POST /api/v1/admin/users` | `AdminUserService.create` | `admin.users` | `admin-user-service.test.ts` |
| Admin update | `/admin/users/[id]` Save | `PATCH …/admin/users/[id]` | `update` | `admin.users` | same |
| Activate/Deactivate | Activate / Deactivate | `POST …/activate` / `DELETE …/[id]` | `activate` / `deactivate` | `admin.users` | same |
| Create draft | `/budgets/create` Save | `POST /api/v1/budget-plans` | `createDraft` | `budget.create` | `active-budget-conflict.test.ts` |
| Submit | Submit for Approval | `POST …/submit` | `ApprovalService.submit` | `budget.submit` | `build-approval-route.test.ts` |
| Approve | Decision Approve | `POST …/approve` | `approve` | `budget.approve` | same |
| Return | Decision Return | `POST …/return` | `returnForRevision` | `budget.approve` + org | same |
| Reject | Reject | `POST …/reject` | `reject` | `budget.reject` + GM | same |
| Finance claim | Finance Claim | `POST …/finance/claim` | `FinanceService.claim` | `finance.claim` | `finance-audit.test.ts` |
| Finalize | Finalize | `POST …/finance/finalize` | `finalize` | `finance.finalize` | same |
| Finance return | Return | `POST …/finance/return` | `returnForRevision` | `finance.return` | same |
| Finance release | Release | `POST …/finance/release` | `release` | claimant / SystemAdmin | `finance-release.test.ts` |
| Active conflict | Create form banner | 409 on create/submit | `ActiveBudgetConflictError` | create/submit | `active-budget-conflict.test.ts` |
| Amendment | Create Amendment | `POST …/amend` | `createAmendment` | `budget.create` | `amend-*.test.ts` |
| FY manage | Admin FY / fiscal-years | admin + `/api/v1/fiscal-years` | `FiscalYearService` | `fy.manage` | `master-data-service.test.ts` |
| Dev toolkit | `/admin/development` | `/api/v1/development/*` | `DevelopmentToolkitService` | SystemAdmin + env | `development-toolkit.test.ts` |
| SAP form CSV | Finance SAP Download CSV | `GET …/sap-form?format=csv` | `SapComplianceService.getFormForDownload` | `finance.view` + `report.export` | `sap-download-auth.test.ts` |

---

## Explicit non-claims

| Item | Status |
|------|--------|
| Western Region holder (`western.region@…`) | **Not seeded. Not a feature. Do not add unless requested.** |
| Public register / forgot / reset / verify | **Removed** — see `docs/repository-cleanup.md` |
| “All foundation features complete” | **False** — see Incomplete table above |

---

## How to use this document

1. Before saying a feature works in chat, release notes, or UAT scripts: find its row here.  
2. If **INCOMPLETE**, say so and list the missing proof point(s).  
3. Closing an Incomplete item requires code + this doc update + (for mutations) staging evidence in `docs/staging-e2e-acceptance.md`.

# Release Note — feature/notification-task-runtime

- Branch: `feature/notification-task-runtime`
- Target: `develop`
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Notification Engine (Active), Approval Engine (Active — `targetUrl` string only), Presentation (Active). Startup Validation (Frozen): confirmed untouched.

## Problem solved
Three gaps remained between the notification-task specification and the code: the header bell was a plain link (no dropdown), the repositories could create two active notifications for the same task, and approval notifications linked to a generic budget page instead of the exact task.

## Why this solution
- **Bell dropdown** rendered from the existing active-notifications API; opening it never resolves anything, clicking marks read + refreshes the badge + navigates via the shared `notificationDestination` helper (upholds K-001: read ≠ resolved).
- **Duplicate-task guard as a repository invariant (K-009)** rather than a per-service pre-check, so every caller inherits it and no race can create twins. SQL uses a single atomic `INSERT … SELECT … WHERE NOT EXISTS` with `UPDLOCK, HOLDLOCK`; the mock mirrors the predicate. Only actionable types are deduped; informational outcomes may repeat; resolved/archived rows never block a fresh task.
  - Invariant: *at most one ACTIVE actionable notification for `(recipient userId, notification type, entity)` where `resolvedAt IS NULL AND isCleared = 0`; entity key = `relatedPlanId` else `entityId`.*
- **Deep-link** `/budgets/{id}?action=approve`: the budget page loads the budget, and if the viewer is the pending approver, scrolls the Decision panel into view and highlights it. Chosen a query param over a new route to avoid touching routing/RBAC.

## Files changed
- Added: `src/components/layout/notification-bell.tsx`, `tests/unit/notification-dedup.test.ts`
- Modified: `src/components/layout/header.tsx`, `src/components/layout/app-shell.tsx`, `src/infrastructure/repositories/sql/index.ts`, `src/infrastructure/repositories/mock/index.ts`, `src/application/approval-service.ts`, `src/app/(portal)/budgets/[id]/page.tsx`, `scripts/e2e-notification-spine.ts`
- Deleted: none

## Repository Impact
| Dimension | Value |
|---|---|
| Files modified | 8 |
| Files added | 2 |
| Files deleted | 0 |
| Public APIs changed | No (notification `targetUrl` gains a query param; no route/contract change) |
| Database schema changed | No (query-level guard, no migration) |
| Business rules changed | No |
| Permissions changed | No |
| Configuration changed | No |
| ADR updated | No |
| Knowledge Log updated | K-009 |
| Tests added | 7 |
| Tests updated | Harness (deep-link expectations + SQL dedup check) |
| Documentation updated | 5 — `CHANGELOG.md`, `docs/CHANGE_HISTORY.md`, `docs/feature-e2e-proof.md`, `docs/domain-model.md`, `docs/KNOWLEDGE_LOG.md` |

## Verification evidence (layered)
- Code (lint/build): `next lint` clean; `next build` clean (63 routes).
- Tests (unit): 121/121 passing, incl. `notification-dedup.test.ts` (7).
- Application Service Runtime (service layer + local SQL DB): 62/62 harness checks passing, incl. "NEG duplicate active Approval create is a no-op (SQL dedup guard)".
- Browser Runtime (UI/HTTP/cookies/routing): **Pending** — dropdown rendering/UX belongs to the staging browser matrix.
- Docs: 5 files updated (listed above).

## Known limitations
- **Historical duplicates remain.** Reason: no cleanup migration requested. Impact: none for new notifications — the guard prevents all new duplicates. Future recommendation: an optional cleanup migration if historical duplicate removal becomes a business requirement.
- **Pre-existing Approval notifications** created before this change keep plain `/budgets/{id}` URLs — still valid; they simply skip the Decision-panel focus.

## Rollback plan
Revert the commit — no schema migration, no data loss, no business-rule change.

## Follow-up work
- Staging browser verification of the bell dropdown, deep-link focus, and badge live-update.
- Branch also carries earlier notification-runtime / startup / governance WIP; review whether to split before the PR to `develop`.

---

## Addendum 2026-07-22 — MVP email support (Change #027)

- **Problem:** In-app Report Issue / SupportIssue module delayed MVP focus.
- **Change:** Removed support pages, APIs, service, repos, and tests. Help is `mailto:ict-support@kengen.co.ke`.
- **Docs:** FEATURE_REGISTRY, WORKFLOWS WF-015 retired, DATABASE unused tables, DEPENDENCY_MAP, BUSINESS_RULES BR-37 note, K-011, RELEASE_CHECKLIST MVP gate.
- **APIs removed:** `GET/POST /api/v1/support-issues`, `GET/PATCH /api/v1/support-issues/[id]`.
- **Schema:** No migration; mig 009 tables retained unused.
- **Rollback:** restore deleted files from git before Change #027.

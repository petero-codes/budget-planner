# Staging E2E Acceptance Matrix

**Milestone:** Milestone 2 — Stabilization → Milestone 3 — Validation  
**Purpose:** Technical E2E + business UAT before the release dossier.  
**Status:** **Not executed** until staging is deployed. Unit tests alone do not satisfy this gate.

**Browsers (minimum):** Chrome · Edge  
**Evidence:** Every Pass requires Expected / Actual / Pass-Fail / Evidence / Tester / Date (see template below).

### Validation progression (do not skip)

1. Staging deployment  
2. Technical E2E validation (this document — happy path, negatives, R3, DB)  
3. Business / UAT sign-off (matrix below)  
4. Operational verification (backups, HTTPS, secrets, deployment)  
5. Release dossier  
6. Go / Conditional Go / No Go decision  
7. Production deployment (`v1.0.0`) only after Go  

**No new features** until this progression completes. New features expand the test surface and delay a stable release.

### Critical spine (browser / role verification)

Record Pass/Fail with evidence in this document (happy path, negatives, and UAT matrices). Informal personal checklists are not release evidence.

| Area | Scope |
|------|--------|
| Auth session | Login / logout |
| Administration | User management; administrator password reset; fiscal year management |
| Budget path | Create / edit / submit |
| Approval path | Manager approve/return; GM approve/return/reject |
| Finance path | Claim / finalize / return (release where applicable) |
| Observability | Notifications; reports; CSV / SAP export |
| Dev-only | Development Toolkit — confirm unavailable unless dual/triple gate is met |

After spine + full matrix + ops checks: release dossier → **Go / Conditional Go / No Go** → tag `v1.0.0` only on Go. Resist indefinite polish once acceptance criteria are met (ADR-012 / ADR-014).

---

## Local SQL pre-staging execution (automated) — Step 0

Run the critical spine on **local SQL first**; only repeat the browser matrix on
staging once this passes. This is an automated harness that drives the **real
application service layer** (no HTTP, no mocks, no browser) against local SQL
Server and verifies the **database** after every transition (BudgetPlans,
Notifications, ApprovalHistory, AuditLogs, FinanceQueueClaims). It is
re-runnable: pre-cleans and tears down exactly its own lineage via
`scripts/lib/test-database-cleaner.ts` (the sole module allowed to disable
immutability triggers).

**Command:** `npm run e2e:spine` (script: `scripts/e2e-notification-spine.ts`; sets `REPOSITORY_DRIVER=sql`)
**Stable chain:** Budget Holder `edwin.omondi` → Manager `geofrey.kimutai` → GM `joyce.mwaniki` → Finance `finance.admin` (cost centre `KGN70020`).

| Step | Actor | Verified (DB-level) | Result |
|------|-------|---------------------|--------|
| 1 | Budget Holder | Draft→Submit; status `InApproval`; Manager gets 1 active `Approval` notif → `/budgets/{id}`; ApprovalHistory+Audit `Submitted` | Pass |
| 2 | Manager | Click marks **read but not resolved** (still active); Approve → Manager notif resolved→history, GM gets 1 active `Approval`; no duplicate | Pass |
| 3 | General Manager | Approve → status `PendingFinanceReview`, no approver; GM notif resolved | Pass |
| 4 | Finance | Queue notif appears: 1 active `FinanceQueue` → `/finance?planId={id}`; FinanceQueueClaims: 0 active | Pass |
| 5 | Finance | Claim → status `Claimed`; exactly 1 active FinanceQueueClaim; `FinanceQueue` resolved; personal `FinanceClaim` → `/budgets/{id}` | Pass |
| 6 | Finance | Release → `PendingFinanceReview`; 0 active claims (ReleasedAt retained); `FinanceClaim` resolved; `FinanceQueue` recreated | Pass |
| 7 | Finance | Re-claim → 1 active claim; Finalize → `Finalized`, 0 active claims; Finance task notifs resolved; ApprovalHistory+Audit `FinanceFinalized` | Pass |
| 8 | Budget Holder | Owner gets active `Outcome` (Budget finalized) → `/budgets/{id}` | Pass |

**Negative / state-machine (same run):**

| Scenario | Expected | Result |
|----------|----------|--------|
| Owner edits after submit | Denied ("Only Draft or Returned…") | Pass |
| GM approves before Manager | Denied (not current approver) | Pass |
| Manager approves twice | Denied (not current approver) | Pass |
| Finance finalizes without claiming | Denied (not claimant) | Pass |
| Return-for-revision | Owner gets `Outcome`, Manager `Approval` resolved, budget editable again | Pass |
| Finance B cannot release/finalize Finance A's claim | **Skipped** — only 1 `FinanceAdministrator` seeded; add peer Finance user later | N/A |

**Latest run:** 2026-07-18 — **57 automated service-level checks passed against the local SQL environment** (0 failures). Teardown via `TestDatabaseCleaner`; re-run confirmed idempotent. No defects uncovered. Observation: informational `Finance` (Low) "is reviewing your budget" notifications to the owner are not auto-resolved (by design — only actionable task notifications auto-resolve).

> The table above is the **local service-layer** gate. Browser, cookies, routing, middleware, API serialization, and UI rendering still belong to **staging** — this pass does not prove the full application.

---

## Prerequisites

| # | Gate | Pass |
|---|------|------|
| P1 | Staging app deployed from clean build (no reused `.next`) | ☐ |
| P2 | `REPOSITORY_DRIVER=sql` + migrations through `007` applied | ☐ |
| P3 | `SESSION_SECRET` ≥32 configured on staging | ☐ |
| P4 | HTTPS enabled on staging URL | ☐ |
| P5 | Least-privilege SQL app login (no dbo/sysadmin) | ☐ |
| P6 | Seed / provisioned users for every role available | ☐ |

---

## Role map (UAT actors)

| Actor label | Seed / role code | Primary landing |
|-------------|------------------|-----------------|
| System Administrator | `SystemAdmin` | `/admin` |
| Finance Administrator | `FinanceAdministrator` | `/finance` |
| General Manager | `GeneralManager` (root `managerId`) | `/home` |
| Manager | `BudgetApprover` + managed CCs | `/home` |
| Budget Holder | `BudgetSubmitter` | `/home` |
| Financial Analyst | Use **FinanceAdministrator** (no separate role) | `/finance` |
| Audit Viewer | `AuditViewer` | `/audit` |

---

## UAT sign-off matrix (business)

E2E proves the software works technically. **UAT proves it works for the business.**  
Sign off a role only after **all** listed scenarios pass on **staging** with evidence.

| Role | Scenarios | Status | Sign-off (name) | Date |
|------|-----------|--------|-----------------|------|
| Budget Holder | Create, Edit, Submit, View History, Notifications | ☐ | | |
| Manager | Review, Return, Approve, Dashboard | ☐ | | |
| General Manager | Review All, Return, Reject, Approve | ☐ | | |
| Finance Administrator | Claim, Finalize, Return, SAP Export, CSV | ☐ | | |
| System Administrator | Users, Roles, Fiscal Years, Cost Centres, Master Data | ☐ | | |
| Audit Viewer | Reports (if permitted), Audit Logs, Read-only Access | ☐ | | |

**Business owner overall UAT:** ☐ Pass · ☐ Fail · Name: ________ · Date: ________

---

## Acceptance test exit criteria (every scenario)

Do **not** tick Pass without completing this record (copy per scenario ID, e.g. H2, N3, R3.5, UAT-BH-Submit):

| Field | Value |
|-------|-------|
| Scenario ID | |
| Expected result | |
| Actual result | |
| Pass / Fail | ☐ Pass · ☐ Fail |
| Evidence | Screenshot path / audit log ID / correlation ID / DB query note |
| Tester | |
| Date | |

Failed scenarios either become release blockers (if listed below) or tracked defects with severity before Conditional Go.

---

## Release blockers (automatic No-Go)

If **any** of the following occur during staging, release status is **No Go** until resolved and re-validated:

| Blocker |
|---------|
| Any Critical or High security issue |
| RBAC bypass |
| IDOR vulnerability |
| Workflow dead end |
| Data corruption |
| Missing audit record for a critical action |
| Finance workflow failure |
| Approval workflow failure |
| Failed backup or restore |
| Production / staging configuration failure (`SESSION_SECRET`, HTTPS, least-privilege SQL, etc.) |
| Failing critical E2E scenario (happy-path spine or R3 permission refresh) |

Conditional Go is only allowed for **documented Low/Info** residuals that are consciously accepted — never for the table above.

---

## Happy-path spine (every role)

| # | Scenario | Actor | Expected | Pass | DB evidence |
|---|----------|-------|----------|------|-------------|
| H1 | Login | Each role | Lands on correct home; session cookie set | ☐ | — |
| H2 | Create → submit budget | Budget Holder | Status `InApproval` or Finance queue if GM | ☐ | BudgetPlans, ApprovalRoute, Audit, Notification |
| H3 | Manager approve | Manager | Advances or queues; history/audit | ☐ | ApprovalHistory, Audit |
| H4 | GM approve → Finance | GM | `PendingFinanceReview`; Finance notified | ☐ | Status + Notification |
| H5 | Finance claim | Finance | `Claimed`; exclusive claim | ☐ | FinanceQueueClaims |
| H6 | Finance finalize | Finance | `Finalized`; SAP package frozen | ☐ | SapPackages, Audit |
| H7 | Finance return | Finance | `ReturnedForRevision`; owner notified | ☐ | Status + Notification |
| H8 | Amendment | Budget Holder | New lineage revision from Finalized | ☐ | BudgetLineage |
| H9 | Reports + CSV | Finance / Manager (scoped) | Visible rows only; CSV downloads | ☐ | — |
| H10 | Notifications | Any | List/dismiss own only | ☐ | Notifications |
| H11 | Audit trail | GM / Finance / Admin / Viewer | Read-only list | ☐ | — |
| H12 | Admin user lifecycle | System Admin | Create / edit / reset password | ☐ | Users + Audit |

---

## Negative / regression matrix (required)

| # | Scenario | Expected | Pass | Notes |
|---|----------|----------|------|-------|
| N1 | Budget Holder approves budget | Denied (403 / no Approve control) | ☐ | |
| N2 | Manager approves wrong cost centre / not currentApprover | Denied (403) | ☐ | |
| N3 | Finance finalizes without claim | Denied (403 / invalid state) | ☐ | |
| N4 | Audit Viewer edits anything (budget/admin/finance) | Denied; no mutate UI; APIs 403 | ☐ | |
| N5 | System Admin views all users | Allowed (`GET /api/v1/admin/users`) | ☐ | |
| N6 | Budget Holder downloads Finance-only SAP / export | Denied (403) | ☐ | |
| N7 | Direct URL to `/admin` as non-admin | Redirect `/access-denied` or login | ☐ | |
| N8 | Call admin API manually without `admin.users` | 403 | ☐ | |
| N9 | Submit duplicate active budget | Structured **409** with existing budget payload | ☐ | |
| N10 | Edit budget in closed financial year | Denied | ☐ | |
| N11 | Owner self-approve | Denied | ☐ | |
| N12 | Non-GM permanent reject | Denied | ☐ | |
| N13 | Peer Finance release another's claim | Denied | ☐ | |
| N14 | Direct URL `/finance` without `finance.view` | Redirect `/access-denied` | ☐ | |
| N15 | Unauthenticated call to protected API | 401 | ☐ | |

---

## R3 — Permission refresh (mandatory)

**Why:** Validates live `/api/v1/me` refresh after admin revokes Finance access (stale UI / privileged actions).

| Step | Action | Expected | Pass |
|------|--------|----------|------|
| R3.1 | Browser A: log in as Finance Administrator | Finance dashboard loads; Finance menu visible | ☐ |
| R3.2 | Browser A: open Finance dashboard and leave tab open | Session remains | ☐ |
| R3.3 | Browser B (Admin): remove Finance role / `finance.*` from that user; save | User update succeeds; audit row | ☐ |
| R3.4 | Browser A: navigate to another page **or** refocus the tab | Shell reloads `/api/v1/me` | ☐ |
| R3.5 | Confirm Finance menu item gone | No Finance Dashboard in nav | ☐ |
| R3.6 | Confirm `/finance` redirects | `/access-denied` (or equivalent) | ☐ |
| R3.7 | Confirm Finance API (`/api/v1/finance/dashboard`, claim, finalize) | **403** (or 401 if signed out) | ☐ |
| R3.8 | Confirm no stale privileged actions usable | Claim / Finalize / Release controls not available | ☐ |

**Unit coverage (not a substitute for staging):** `tests/unit/portal-access-refresh.test.ts` — path gate + nav after revocation.

---

## Database verification (per happy-path run)

For at least one full GM → Finance → Finalize spine, verify in SQL:

| Check | Pass |
|-------|------|
| Exactly one audit row per successful state transition (submit/approve/claim/finalize) | ☐ |
| Denied attempts produce AuthorizationDenied / *Denied audit rows when exercised | ☐ |
| ApprovalHistory matches UI timeline | ☐ |
| WorkflowHistory stages coherent | ☐ |
| Notifications delivered to owner / approver / Finance as designed | ☐ |
| Active finance claim unique (no double claim) | ☐ |
| Lineage pointers updated on finalize / amend | ☐ |

---

## Browser matrix

| Browser | Happy path | Negatives | R3 refresh | UAT roles | Pass |
|---------|------------|-----------|------------|-----------|------|
| Chrome (current) | ☐ | ☐ | ☐ | ☐ | ☐ |
| Edge (current) | ☐ | ☐ | ☐ | ☐ | ☐ |

---

## Operational readiness (staging / pre-prod)

| # | Requirement | Pass |
|---|-------------|------|
| O1 | `SESSION_SECRET` verified | ☐ |
| O2 | HTTPS verified | ☐ |
| O3 | Least-privilege SQL account verified | ☐ |
| O4 | Backup taken | ☐ |
| O5 | Restore rehearsed to non-prod target | ☐ |
| O6 | Deployment guide followed | ☐ |
| O7 | Rollback procedure rehearsed | ☐ |

---

## Exit criteria for this document

Milestone 2 / Validation is **not** complete until:

1. All Prerequisites (P1–P6) pass  
2. Happy-path spine (H1–H12) pass for every role where applicable  
3. Negative matrix (N1–N15) pass  
4. R3.1–R3.8 pass on Chrome and Edge  
5. Database verification checks pass for one full spine  
6. **UAT sign-off matrix** complete (every role signed)  
7. Operational readiness (O1–O7) pass  
8. **No open Automatic No-Go blockers**

Only then produce the **release dossier** and record **Go / Conditional Go / No Go**.

---

## Run log

| Field | Value |
|-------|-------|
| Staging URL | |
| Build / commit | |
| Technical E2E executed by | |
| UAT business owner | |
| Date | |
| Overall result | ☐ Pass · ☐ Fail · ☐ Not started · ☐ **No Go** (blocker) |
| Blockers | |
| Release recommendation | ☐ Go · ☐ Conditional Go · ☐ No Go |

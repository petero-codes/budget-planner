# DATA_FLOW.md — How data moves through the layers

**Purpose:** Show, per major feature, the *path a request takes through the layers* — actor →
API → service → domain → repository → SQL → audit/notifications → UI refresh. This complements
`docs/WORKFLOWS.md` (business steps/states) by focusing on **which components touch the data**.

**Single responsibility:** component/layer traversal. Business rules → `BUSINESS_RULES.md`;
states → `state-machines.md`; endpoints → `api-contracts.md`; files → `FILE_INDEX.md`.

Evidence: `src/application/*.ts`, `src/app/api/v1/**/route.ts`, `src/infrastructure/repositories/**`.

**Legend:** `↓` = calls/hands to · every mutating flow ends by writing **Audit** and (where
applicable) **Notifications**, then the UI re-fetches `/api/v1/me` to refresh the badge.

---

## Common request pipeline (all authenticated writes)

```
Browser (portal page / form)
  ↓  fetch /api/v1/...
middleware.ts                     ← session cookie verified, route-level RBAC
  ↓
app/api/v1/**/route.ts            ← Zod DTO validation, permission check
  ↓
src/infrastructure/di.ts          ← single composition root hands the service instance
  ↓
Application service               ← orchestration + authorization (AuthorizationService)
  ↓
Domain entity / value object      ← invariant enforcement (pure, no I/O)
  ↓
Repository interface → Sql*|Mock* ← persistence
  ↓
SQL Server (transaction)          ← rows + immutable Audit/History via triggers/inserts
  ↓
Audit + (Notifications)           ← recorded
  ↓
Response → page re-render → /api/v1/me → badge refresh
```

---

## 1. Budget submit for approval

```
Budget Holder → /budgets/[id] "Submit"
  ↓ POST /api/v1/budget-plans/[id]/submit
budget-plan-service.ts (submit)
  ↓ domain: BudgetPlan invariants (lines > 0, valid SAP/GL), status Draft→InApproval
approval-service.ts (build route)
  ↓ walk Users.managerId → ApprovalRoute steps (or empty route → Finance)
  ↓ IBudgetPlanRepository + IApprovalRepository  (Sql*/Mock*)
  ↓ SQL: BudgetPlans, ApprovalRoutes/Steps
workflow-recorder.ts → WorkflowHistory (append)
audit → AuditLogs (immutable)
notification-task-actions → Approval task for first currentApproverId (dedup per K-009)
  ↓ UI: budget status + approver's bell/badge refresh
```

## 2. Approve / Return / Reject (hierarchy)

```
Approver → /budgets/[id] (Decision panel; deep-link ?action=approve)
  ↓ POST /api/v1/budget-plans/[id]/{approve|return|reject}
approval-service.ts
  ↓ authorization: actor === currentApproverId; owner≠approver
  ↓ domain: state transition (approve→advance/handoff; return→ReturnedForRevision; reject→Rejected [GM only])
  ↓ IApprovalRepository, IBudgetPlanRepository
  ↓ SQL: ApprovalSteps, BudgetPlans
ApprovalHistory (immutable insert) + WorkflowHistory (append) + AuditLogs (immutable)
notifications: resolve actor's Approval task; create next-approver task OR Finance-queue task OR Outcome to owner
  ↓ UI refresh + badge
```

## 3. Finance claim → finalize / return / release

```
Finance officer → /finance (queue) or /finance/sap/[id]
  ↓ POST /api/v1/budget-plans/[id]/finance/{claim|finalize|return|release}
finance-service.ts
  ↓ authorization: FinanceAdministrator; claim exclusive (FinanceQueueClaims one-active)
  ↓ domain: PendingFinanceReview→Claimed→(Finalized|ReturnedForRevision|PendingFinanceReview)
  ↓ IFinanceRepository / IBudgetPlanRepository
  ↓ SQL: FinanceQueueClaims, BudgetPlans
  ↓ on finalize: sap-compliance-service → frozen SAP package → SapPackages
WorkflowHistory (append) + AuditLogs (immutable)
notifications: resolve FinanceQueue/FinanceClaim task; Outcome to owner on finalize/return
  ↓ UI refresh + badge
```

## 4. Amendment (post-finalize change)

```
Budget Holder → /budgets/[id] "Amend"
  ↓ POST /api/v1/budget-plans/[id]/amend  (amendment reason required)
budget-plan-service.ts (createAmendment)
  ↓ domain: new version N+1 in same BudgetLineage; prior finalized stays immutable
  ↓ IBudgetPlanRepository + lineage guard (UX_BudgetPlans_LineageInPlay)
  ↓ SQL: BudgetPlans (new version), BudgetLineage
WorkflowHistory (append)   [NOTE: AuditLogs coverage flagged — see ENGINEERING_BRAIN §17]
  ↓ new version enters submit flow (§1)
```

## 5. Notification lifecycle (read vs resolve)

```
Any user → header bell (notification-bell.tsx) or /notifications
  ↓ GET /api/v1/notifications (active | history)
  ↓ click item → PATCH read (readAt set)  ── read ≠ resolved (K-001)
notification-task-actions.ts → targetUrl navigation (deep-link)
  ↓ user performs the real workflow action (§1–§4)
  ↓ that action sets resolvedAt/resolvedBy (task leaves Active → History)
GET /api/v1/me → unreadNotifications = active/unresolved count → badge
```

## 6. Master data / fiscal year / users (admin)

```
SystemAdmin → /admin/* forms
  ↓ POST|PUT|DELETE /api/v1/admin/{departments|cost-centers|fiscal-years|users}
master-data-service.ts | fiscal-year-service.ts | admin-user-service.ts
  ↓ authorization: SystemAdmin; domain singletons (one Open/Current FY — K-006)
  ↓ I{MasterData|FiscalYear|User}Repository
  ↓ SQL: Departments/CostCenters/FiscalYears/Users
AuditLogs (immutable) + notifications (AdminUser/FiscalYear where applicable)
  ↓ UI refresh
```

## 7. Login / session bootstrap

```
Browser → /login
  ↓ POST /api/v1/auth/login (email+password)
auth route → verify (bcrypt) → signed session cookie
  ↓ redirect → (portal) → GET /api/v1/me
  ↓ me route: profile + permissions + unreadNotifications (active count)
  ↓ app-shell loads; header badge set
   (If REPOSITORY_DRIVER/schema mismatch → non-auth error → 500, not a false 401 — K-007)
```

---

*Add a flow here whenever a new feature introduces a new actor→data path. Keep each flow to the
component traversal; do not restate business rules — link them.*

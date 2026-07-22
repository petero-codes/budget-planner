# Domain Model

**Source of truth:** `src/domain/entities/index.ts`, `src/domain/value-objects/budget-status.ts`, repositories under `src/infrastructure/repositories/`.  
**Last synced:** 2026-07-17 (multiplicity / Active Budget Version clarified for holders & testers).

## Aggregates

| Aggregate | Root | Children / VOs | Repository |
|-----------|------|----------------|------------|
| BudgetPlan | BudgetPlan | BudgetLineItem, Money, period fields | IBudgetPlanRepository |
| BudgetLineage | BudgetLineage | version pointers | IBudgetLineageRepository |
| User | User | RoleAssignment (codes on user) | IUserRepository |
| CostCenter | CostCenter | — | ICostCenterRepository |
| Department | Department | — | IDepartmentRepository |
| FiscalYear | FiscalYear | — | IFiscalYearRepository |
| CostCenterSubmissionStatus | (CostCenterId, FiscalYearId) | — | ISubmissionStatusRepository |
| GlAccount | GlAccount | — | IGlAccountRepository |
| Approval route / history | ApprovalRouteStep, ApprovalHistoryEntry | — | route + history repos |
| Finance claim | FinanceQueueClaim | — | claim repo |
| Audit / Notification / Workflow | entries | — | respective repos |

## Entities

```text
User              — id, name, email, positionId, managerId, departmentId, primaryCostCenterId, active,
                    roleCodes[], permissionCodes[]
Position          — id, title, positionCode, level (display only; not a capability)
Role              — BudgetSubmitter | BudgetApprover | GeneralManager | SystemAdmin
                    | FinanceAdministrator | AuditViewer
Permission        — PermissionCode (see budget-status.ts)
Department        — code, name, isActive
CostCenter        — code (KGNxxxxx), sapCostCenterCode, name, departmentId,
                    managerId (approver), responsiblePersonId (Budget Holder), isActive
GlAccount         — code, description, isActive
FiscalYear        — yearLabel, startDate, endDate, status (Open|Closed|Archived), isCurrent, isLocked
CostCenterSubmissionStatus — costCenterId, fiscalYearId, status, updatedAt
BudgetLineage     — costCenterId, fiscalYearId, originalBudgetType, budgetNumber,
                    currentVersionId, latestFinalizedVersionId, isArchived
BudgetPlan        — ownerId, costCenterId, fiscalYearId, budgetCategory, fromPeriod, toPeriod,
                    description, status, currentApproverId, submittedAt, sapVersion, lines[],
                    version (optimistic concurrency), lineageId, parentBudgetPlanId,
                    lineageRevision, versionLabel, amendmentReason, isArchived,
                    claimDueAt, reviewDueAt, escalationStatus, financeClaimedAt, financeClaimedBy
BudgetLineItem    — glAccountId, amount, lineNumber
ApprovalRouteStep — budgetPlanId, approverId, sequence, status
ApprovalHistoryEntry — budgetPlanId, performedBy, action, previousStatus, newStatus, comment, timestamp
FinanceQueueClaim — budgetPlanId, claimedBy, claimedAt, releasedAt, isActive
WorkflowHistoryEntry — budgetVersionId, actor, stage, action, …
AuditLogEntry     — entity, entityId, action, performedBy, ip, correlationId, before/after JSON, timestamp
Notification      — userId, type, title, message, priority, category, actionLabel,
                    entityType, entityId, targetUrl, relatedPlanId, isRead,
                    readAt, resolvedAt, resolvedBy, expiresAt
```

## Notification task lifecycle

Notifications model assigned work, not disposable alerts:

```text
Created / Unread → Read (still active) → workflow action completed
                                      → Resolved (history) → Archived
```

- Clicking sets `readAt` and navigates to `targetUrl`; it does not complete actionable work.
- Approval, Finance, support, and fiscal-year services set `resolvedAt` and `resolvedBy` when the represented workflow action is completed.
- Active lists and the header badge include unresolved tasks, whether read or unread.
- Pending actionable tasks cannot be manually deleted. Only resolved history can be archived.
- No duplicate active tasks (K-009): repository `create` refuses a second ACTIVE notification for the same recipient + type + plan/entity key. Informational types may repeat; a resolved task never blocks a fresh one.
- `expiresAt` is optional metadata for future deadline/escalation behavior; expiry does not itself resolve work.

### Notification deep-links

Every notification carries a `targetUrl`; clicking marks it read and navigates there directly. Approval tasks add an `?action=approve` query parameter so the destination page can open the recipient on the exact task rather than a generic page:

```text
open /budgets/{id}?action=approve
        ↓
load the budget
        ↓
if action=approve AND the viewer is the pending approver
        ↓
scroll the Decision panel into view
        ↓
highlight it (ring) so the primary action is unmistakable
```

The focus/highlight only fires for the current approver with `budget.approve`; for anyone else the parameter is inert (the page renders normally). Behavior lives in `src/app/(portal)/budgets/[id]/page.tsx`; the URL is produced in `src/application/approval-service.ts`.

## Value objects / enums

- **Money** — amount > 0, currency (default KES)
- **BudgetStatus** — `Draft` | `InApproval` | `ReturnedForRevision` | `PendingFinanceReview` | `Claimed` | `Finalized` | `Rejected` | deprecated `Approved`
- **ApprovalAction** — Submitted, SubmittedAndCompleted, Resubmitted, Approved, Returned, Rejected, FinanceClaimed, FinanceReleased, FinanceReturned, FinanceFinalized
- **WorkflowStage** — Draft, Submitted, ManagerReview, GMReview, FinanceQueue, FinanceClaimed, FinanceReturned, FinanceFinalized, Rejected
- **SubmissionStatus** — NotStarted | InProgress | Submitted | Returned | Approved | Rejected
- **EscalationStatus** — None | Warning | Escalated
- **Budget categories** — codes `RECURRENT` | `MAJOR` | `CAPEX` with UI labels from `BUDGET_CATEGORY_CATALOG` (amendments are new versions, not a separate type)

## Budget ownership & multiplicity (user-facing)

Budget Holders often ask whether they may submit more than one budget. Define the rule once:

| Rule | Result |
|------|--------|
| One user | Can own **multiple** budgets |
| One cost centre | Can have **multiple** catalog categories (`RECURRENT`, `MAJOR`, `CAPEX`) |
| One original budget type (for a given CC + FY) | Only **one active** version at a time |
| Finalized budget | **Cannot** be edited, deleted, or overwritten |
| Changes after finalization | Create an **Amendment** (new version in the **same** lineage) |
| One budget | Can contain **unlimited** GL line items (`BudgetLineItem` / BudgetItems) |

**Example — allowed**

Peter is responsible for an ICT cost centre. He may submit:

- ICT · FY2027 · Recurrent ✅  
- ICT · FY2027 · Major ✅  
- ICT · FY2027 · CAPEX ✅  

**Example — blocked**

- ICT · FY2027 · Recurrent (Draft)  
- ICT · FY2027 · Recurrent (another Draft)  

…because **only one active budget version** is allowed for each **Cost Centre + Fiscal Year + Original Budget Type** (Budget Lineage).

**Change paths (no production “reset”)**

| When | How |
|------|-----|
| Before Finance finalization | Manager / GM / Finance **Return for Revision** → edit → resubmit. History, audit, and notifications are retained. |
| After Finance finalization | **Amendment** (new version). Finalized versions stay immutable. |
| Development / testing only | Development Toolkit may force a workflow reset. **Never** available in production. |

### Active Budget Version (definition)

**Active Budget Version:** A budget version that is currently editable or progressing through approval / finance.  

**Active statuses:** `Draft`, `InApproval`, `ReturnedForRevision`, `PendingFinanceReview`, and `Claimed` (finance has claimed the plan; still in-play).  

Only **one** active version may exist for a budget lineage keyed by **Cost Centre + Fiscal Year + Original Budget Type**.  

`Finalized` (and legacy `Approved`) versions are **immutable** and **inactive**. `Rejected` versions are inactive (a new original draft for the same key may start a new lineage only when product rules allow; amendments attach to an existing finalized lineage).

Do **not** say only “lineage” in requirements or UAT scripts. Prefer:

> Only one active budget version is allowed for each **Cost Centre + Fiscal Year + Original Budget Type** (Budget Lineage).

**Current catalog note:** Implemented types are `Recurrent`, `Major`, and `CAPEX` (`src/domain/constants/budget-types.ts`). A future `BudgetTypes` lookup table may replace application-level validation (not v1).

## Invariants

| Rule | Enforcement |
|------|-------------|
| Amount > 0 on every line | Money / item constraints |
| At least one line to submit | BudgetPlan / ApprovalService |
| Cannot edit when not Draft / ReturnedForRevision | BudgetPlanService |
| Circular hierarchy | buildApprovalRoute / AdminUserService |
| SAP code required at submit | ApprovalService |
| Owner cannot approve own | ApprovalService |
| Only currentApproverId may approve/return/reject on chain | ApprovalService |
| Only GM may permanently reject | AuthorizationService.canRejectBudget |
| Finance cannot permanently reject | FinanceService return/finalize only |
| Optimistic concurrency | `BudgetPlans.Version` WHERE Version = @expected → 409 |
| Lineage in-play uniqueness | `UX_BudgetPlans_LineageInPlay` (migration 007): one non-archived, non-Rejected/Finalized/Approved plan per LineageId |
| Active finance claim | `UX_FinanceQueueClaims_ActivePlan` |
| Exactly one Open FY / one Current FY | FiscalYearService + filtered unique indexes |
| Closed/Archived FY read-only for budget work | FiscalYearService / ApprovalService |
| Cost center ownership locked while budget active | CostCenter / master-data services |
| Approval routing | Users.managerId + CostCenter.managerId preference; Finance after route |
| Amend only from latest finalized version; owner + same CC | BudgetPlanService.amend |

## Active uniqueness (technical)

Prefer **Budget Lineage** uniqueness after migration `007` — business key **Cost Centre + Fiscal Year + Original Budget Type**:

`UX_BudgetPlans_LineageInPlay` on `(LineageId)` WHERE `LineageId IS NOT NULL AND IsArchived = 0 AND Status NOT IN (Rejected, Finalized, Approved)`.

Legacy `UX_BudgetPlans_ActiveUnique` on `(CostCenterId, FiscalYearId, BudgetType)` excluding Rejected/Approved may still appear in base `schema.sql`; deployed DBs that applied `007` use the lineage index. New environments should apply migrations through `007` (and `008` for Development Toolkit columns).

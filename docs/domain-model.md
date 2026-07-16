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
BudgetPlan        — ownerId, costCenterId, fiscalYearId, budgetType, fromPeriod, toPeriod,
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
Notification      — userId, type, title, body, relatedPlanId, isRead
```

## Value objects / enums

- **Money** — amount > 0, currency (default KES)
- **BudgetStatus** — `Draft` | `InApproval` | `ReturnedForRevision` | `PendingFinanceReview` | `Claimed` | `Finalized` | `Rejected` | deprecated `Approved`
- **ApprovalAction** — Submitted, SubmittedAndCompleted, Resubmitted, Approved, Returned, Rejected, FinanceClaimed, FinanceReleased, FinanceReturned, FinanceFinalized
- **WorkflowStage** — Draft, Submitted, ManagerReview, GMReview, FinanceQueue, FinanceClaimed, FinanceReturned, FinanceFinalized, Rejected
- **SubmissionStatus** — NotStarted | InProgress | Submitted | Returned | Approved | Rejected
- **EscalationStatus** — None | Warning | Escalated
- **Original budget types** — Primary, Supplementary (amendments are new versions, not a separate type inventing lineage)

## Budget ownership & multiplicity (user-facing)

Budget Holders often ask whether they may submit more than one budget. Define the rule once:

| Rule | Result |
|------|--------|
| One user | Can own **multiple** budgets |
| One cost centre | Can have **multiple** original budget types (e.g. Primary, Supplementary — and any future catalog entries such as OPEX / CAPEX / Training) |
| One original budget type (for a given CC + FY) | Only **one active** version at a time |
| Finalized budget | **Cannot** be edited, deleted, or overwritten |
| Changes after finalization | Create an **Amendment** (new version in the **same** lineage) |
| One budget | Can contain **unlimited** GL line items (`BudgetLineItem` / BudgetItems) |

**Example — allowed**

Peter is responsible for an ICT cost centre. He may submit:

- ICT · FY2027 · Primary ✅  
- ICT · FY2027 · Supplementary ✅  

(If the original-type catalog later includes OPEX / CAPEX / Training, each is its own lineage the same way.)

**Example — blocked**

- ICT · FY2027 · Primary (Draft)  
- ICT · FY2027 · Primary (another Draft)  

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

**Current catalog note:** Implemented original budget types are `Primary` and `Supplementary` (`ORIGINAL_BUDGET_TYPES`). Expanding the catalog does not change the uniqueness rule above.

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

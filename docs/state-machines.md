# State Machines — BudgetPlan

**Source of truth:** `src/domain/value-objects/budget-status.ts`, `src/application/approval-service.ts`, `src/application/finance-service.ts`.  
**Last synced:** 2026-07-16 (Milestone 2 — Priority Documentation Drift gate).

## Status set (`BudgetStatus`)

| Code | UI label | Notes |
|------|----------|-------|
| `Draft` | Draft | Editable |
| `InApproval` | In Review | Manager / GM chain; progress via route + `currentApproverId` |
| `ReturnedForRevision` | Returned | Editable; owner may resubmit |
| `PendingFinanceReview` | Pending Finance | Finance queue (unclaimed) |
| `Claimed` | Finance Review | Exclusive finance claim |
| `Finalized` | Finalized | Terminal success; SAP-eligible; locked |
| `Rejected` | Rejected | Terminal failure; not editable |
| `Approved` | Approved | **Deprecated** — migration reads only; treat as `Finalized` |

Editable statuses: `Draft`, `ReturnedForRevision` only.  
Locked (no line edits): `Claimed`, `Finalized`, legacy `Approved`.

## Happy path

```text
Draft
  → submit (route non-empty)     → InApproval
  → submit (route empty / GM)    → PendingFinanceReview

InApproval
  → approve (more steps)         → InApproval (advance currentApproverId)
  → approve (last / GM)          → PendingFinanceReview
  → return (Mgr/GM + reason)     → ReturnedForRevision
  → reject (GM only + reason)    → Rejected

ReturnedForRevision
  → resubmit                     → InApproval | PendingFinanceReview (same as submit)

PendingFinanceReview
  → finance claim                → Claimed

Claimed
  → finance finalize             → Finalized
  → finance return (+ reason)    → ReturnedForRevision
  → finance release              → PendingFinanceReview (clears claim)
```

Progress within **InApproval** is tracked by `ApprovalRoute.sequence` + `currentApproverId`, not by status names like ManagerApproved.

## Allowed transitions

| From | Action | To |
|------|--------|-----|
| Draft | submit (route non-empty) | InApproval |
| Draft | submit (route empty) | PendingFinanceReview |
| ReturnedForRevision | resubmit (route non-empty) | InApproval |
| ReturnedForRevision | resubmit (route empty) | PendingFinanceReview |
| InApproval | approve (more steps) | InApproval |
| InApproval | approve (last step) | PendingFinanceReview |
| InApproval | return (Manager or GM; reason required) | ReturnedForRevision |
| InApproval | reject (GM only; reason required) | Rejected |
| PendingFinanceReview | claim (`finance.claim`) | Claimed |
| Claimed | finalize (`finance.finalize`) | Finalized |
| Claimed | return (`finance.return`; reason) | ReturnedForRevision |
| Claimed | release (claimant or SystemAdmin) | PendingFinanceReview |

## Disallowed

- Edit when not `Draft` / `ReturnedForRevision`
- Owner approving own budget
- Actor ≠ `currentApproverId` approving / returning / rejecting on manager–GM path
- Manager permanently rejecting (GM + `budget.reject` only)
- Finance permanently rejecting (return or finalize only)
- Mutate after `Finalized` / `Rejected` (except amendment creating a **new** version)
- Reject / return without comment
- Double active finance claim (unique filtered index on claims)

## ApprovalRoute step status

`Pending` → `Approved` | `Rejected` | `Invalidated` (when plan returned/rejected)

## Workflow stages (history)

`Draft` · `Submitted` · `ManagerReview` · `GMReview` · `FinanceQueue` · `FinanceClaimed` · `FinanceReturned` · `FinanceFinalized` · `Rejected`

## Cost-center submission status (derived)

Mapped from plan status via `submissionStatusForBudget` (`src/domain/rules/submission-status.ts`):

| BudgetStatus | SubmissionStatus |
|--------------|------------------|
| (no plan) | NotStarted |
| Draft | InProgress |
| InApproval / PendingFinanceReview / Claimed | Submitted |
| ReturnedForRevision | Returned |
| Finalized / Approved | Approved |
| Rejected | Rejected |

## Lineage / amendments

**Budget Lineage** = **Cost Centre + Fiscal Year + Original Budget Type**.

Only **one active budget version** is allowed for that key. See **Active Budget Version** and **Budget ownership & multiplicity** in `docs/domain-model.md`.

Amendments create a **new** `BudgetPlan` version in the same lineage after the prior version is `Finalized`. Finalized versions are immutable. Active uniqueness is enforced by `UX_BudgetPlans_LineageInPlay` (migration `007`), excluding `Rejected` / `Finalized` / legacy `Approved`.

Before finalization, corrections use **Return for Revision** → edit → resubmit (no delete of history). After finalization, corrections use **Amendment** only. Production must not “reset” workflow; Development Toolkit reset is development-only.

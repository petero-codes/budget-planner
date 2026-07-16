# Approval Engine

**Source of truth:** `src/domain/rules/build-approval-route.ts`, `src/application/approval-service.ts`, `src/application/finance-service.ts`, `src/application/authorization-service.ts`.  
**Last synced:** 2026-07-16 (Milestone 2 — Priority Documentation Drift gate).

## Mental model

```text
Owner → CostCenter.managerId (preferred) or Users.managerId → … → root (managerId IS NULL = GM)
         ↓ after last manager/GM approve
      Finance queue (PendingFinanceReview → Claimed → Finalized)
```

- Manager/GM approvals travel **UP** the tree (sequential, no skips, no parallel).
- Finance is **not** on the managerId route — it starts after the route completes (or immediately if route is empty).
- Visibility for managers is primarily **managed cost centers**; GM/Finance see all; submitters see own.
- **Positions** = display only. **Roles/Permissions** = capability. **managerId / CostCenter.managerId** = routing.
- **Never** hardcode titles or `if (role == "Manager")` for routing.

## Algorithm

### `buildApprovalRoute(ownerId, usersById, costCenterManagerId?)`

1. Load owner; fail if missing or inactive.
2. If owner is GM (`managerId === null`) → return **empty** route (submit goes straight to Finance).
3. First hop: `costCenterManagerId` if set and ≠ owner, else `owner.managerId`.
4. Walk upward until a user with `managerId === null` (GM) is included.
5. Each hop: fail if missing, inactive, or cycle.
6. Append `{ approverId, sequence, role: "manager" | "gm" }` for each hop.
7. Fail with `GM_MISSING` if the chain never reaches a root GM.

### Submit / resubmit

1. Validate owner, open FY, SAP cost center code, lines (Amount > 0), no conflicting active plan/lineage version.
2. `route = buildApprovalRoute(ownerId, …)`; replace `ApprovalRoute` rows.
3. If route empty → `PendingFinanceReview`, enter finance queue, notify Finance Administrators.
4. Else → `InApproval`, `currentApproverId = route[0].approverId`, notify first approver.
5. History action: `Submitted` or `Resubmitted`.

### Approve (Manager / GM)

1. Assert `actor.id === currentApproverId`.
2. Assert permission `budget.approve`.
3. Assert `actor.id !== ownerId`.
4. Mark current route step `Approved`; audit + history + workflow (transaction).
5. If next pending step → stay `InApproval`, set `currentApproverId`, notify next.
6. If no next → `PendingFinanceReview`, clear `currentApproverId`, enter finance queue, notify Finance.

### Return (Manager / GM)

1. Same assignee guards; require non-empty reason.
2. Org role must be `manager` or `gm` with `budget.approve` (`canReturnBudget`).
3. Status → `ReturnedForRevision`; invalidate pending route steps; notify owner.

### Reject (GM only)

1. Same assignee guards; require non-empty reason.
2. Org role must be `gm` with `budget.reject` (`canRejectBudget`).
3. Status → `Rejected` (terminal, not editable); invalidate pending route; notify owner.

### Finance (after queue)

| Action | Permission | From | To |
|--------|------------|------|-----|
| Claim | `finance.claim` | PendingFinanceReview | Claimed |
| Finalize | `finance.finalize` | Claimed (claimant) | Finalized |
| Return | `finance.return` | Claimed (claimant) | ReturnedForRevision |
| Release | claimant or SystemAdmin | Claimed | PendingFinanceReview |

Finance does **not** permanently reject.

## Example routes (ICT seed)

| Submitter | Chain | After last approve |
|-----------|-------|--------------------|
| Assistant under Peter | → Peter → Joyce (GM) | Finance queue |
| Peter (manager) | → Joyce | Finance queue |
| Joyce (GM / root) | `[]` | Finance queue on submit |

## Error conditions

| Condition | Action |
|-----------|--------|
| Owner missing / inactive | Reject submit |
| Manager / GM missing / inactive in chain | Reject submit; log |
| No GM in chain | Reject submit (`GM_MISSING`) |
| Circular hierarchy | Reject submit |
| Duplicate active plan / lineage version | 409 conflict |
| Locked / Finalized mutate | Reject mutate |
| Actor ≠ currentApproverId | 403 |
| Owner approving own | 403 |
| Non-GM reject | 403 |
| Duplicate approve | Idempotent safe response |

## Fallbacks

- Never guess another approver.
- If hierarchy broken → stop workflow; do not invent a substitute.

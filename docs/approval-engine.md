# Approval Engine

## Mental model

```text
Node → managerId → managerId → … → NULL (root)
```

- Approvals travel **UP** the tree (sequential, no skips, no parallel).
- Visibility travels **DOWN** (subtree).
- **Positions** = display only. **Roles/Permissions** = capability only. **managerId** = routing only.
- **Never** hardcode titles or `if (role == "Manager")`.

## Algorithm

### `buildApprovalRoute(ownerId)`

1. Load owner; fail if missing or inactive.
2. Walk `managerId` upward.
3. For each manager: fail if missing, inactive, or cycle detected.
4. Append `{ approverId, sequence, status: Pending }` for each hop.
5. Return route (may be empty for root node).

### Submit

1. Validate owner, SAP cost center code, lines (Amount > 0), no duplicate active plan.
2. `route = buildApprovalRoute(ownerId)`; persist `ApprovalRoute` rows.
3. If route empty → status `Approved` (root auto-complete).
4. Else → status `InApproval`, `currentApproverId = route[0].approverId`, notify.

### Approve

1. Assert `actor.id === currentApproverId`.
2. Assert permission `budget.approve`.
3. Assert `actor.id !== ownerId`.
4. Mark current route step Approved; append history + audit (transaction).
5. Advance to next pending step, or set `Approved` and clear `currentApproverId` (SAP eligible).

### Reject

1. Same guards as Approve; require non-empty comment.
2. Status → `Draft`; clear `currentApproverId`; invalidate pending route steps.
3. Notify owner.

## Example routes (ICT seed)

| Submitter | Chain | ApprovalRoute |
|---|---|---|
| Assistant under Peter | → Peter → Joyce | [Peter, Joyce] |
| Peter (manager) | → Joyce | [Joyce] |
| Direct report to Joyce | → Joyce | [Joyce] |
| Joyce (root) | (none) | [] → auto-Approved |

## Error conditions

| Condition | Action |
|---|---|
| Owner missing / inactive | Reject submit |
| Manager missing / inactive in chain | Reject submit; log; notify admin |
| Circular hierarchy | Reject submit |
| Duplicate active plan | Reject submit (409) |
| Already approved / locked | Reject mutate |
| Actor ≠ currentApproverId | 403 + audit |
| Owner approving own | 403 |
| Duplicate approve | Idempotent safe response |

## Fallbacks

- Never guess another approver.
- If hierarchy broken → stop workflow, log incident, notify administrator.

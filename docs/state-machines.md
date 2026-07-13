# State Machines — BudgetPlan

## Status flow

```text
Draft → InApproval → Approved (terminal, locked)
  ↑         |
  └─ Reject ┘  (comment required)
```

Progress within **InApproval** is tracked by `ApprovalRoute.sequence` + `currentApproverId`, not by status names like ManagerApproved.

## Allowed transitions

| From | Action | To |
|---|---|---|
| Draft | submit (route non-empty) | InApproval |
| Draft | submit (route empty / root) | Approved |
| InApproval | approve (last step) | Approved |
| InApproval | approve (more steps) | InApproval (advance currentApproverId) |
| InApproval | reject | Draft |
| Draft | edit | Draft |

## Disallowed

- Approved → any (except future Amendment workflow)
- Owner approving own budget
- Actor ≠ currentApproverId approving
- Edit when not Draft
- Reject without comment

## ApprovalRoute step status

Pending → Approved | Rejected | Invalidated (on reject of plan)

# Permission Matrix

**Capability vs routing:** Permissions answer "may this user approve at all?" Routing answers "who is next?" via `managerId` only.

## Roles (capability)

| Role | Meaning |
|---|---|
| BudgetSubmitter | Create, edit draft, submit own budgets |
| BudgetApprover | Approve/reject when `currentApproverId` matches |
| SystemAdmin | User/CC management, audit view |

Users may hold multiple roles (e.g. Manager has BudgetSubmitter + BudgetApprover).

## Matrix

| Resource | Action | BudgetSubmitter | BudgetApprover | SystemAdmin |
|---|---|:---:|:---:|:---:|
| Own BudgetPlan | create | ✓ | ✓ | ✗ |
| Own BudgetPlan | edit (Draft) | ✓ | ✓ | ✗ |
| Own BudgetPlan | submit | ✓ | ✓ | ✗ |
| Own BudgetPlan | view | ✓ | ✓ | ✗ |
| BudgetPlan (subtree) | view | ✗* | ✓ | ✓ |
| BudgetPlan | approve (when currentApprover) | ✗ | ✓ | ✗ |
| BudgetPlan | reject (when currentApprover) | ✗ | ✓ | ✗ |
| Reports | view (scoped) | ✗* | ✓ | ✓ |
| AuditLog | view | ✗ | ✓ (root/GM typically) | ✓ |
| User / CostCenter | manage | ✗ | ✗ | ✓ |
| SAP Export | download | ✗ | ✓ (when Approved + visible) | ✓ |

\*Submitters without reports see own only. Visibility is computed from the org tree (own / descendants / all if root).

## Permission codes

`budget.create`, `budget.submit`, `budget.approve`, `budget.reject`, `report.view`, `audit.view`, `admin.users`

## Enforcement

1. `AuthorizationService.hasPermission(user, action)` — capability
2. Visibility / `currentApproverId` check — assignee
3. Both required for approve/reject. Failure → 403 + audit.

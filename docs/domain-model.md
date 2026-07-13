# Domain Model

## Aggregates

| Aggregate | Root | Children / VOs | Repository |
|---|---|---|---|
| BudgetPlan | BudgetPlan | BudgetLineItem, PeriodRange, Money | IBudgetPlanRepository |
| User | User | RoleAssignment | IUserRepository |
| CostCenter | CostCenter | — | ICostCenterRepository |
| GlAccount | GlAccount | — | IGlAccountRepository |
| Approval | ApprovalRecord | — | IApprovalHistoryRepository |

## Entities

```text
User              — id, name, email, positionId, managerId, departmentId, primaryCostCenterId, active
Position          — id, title, positionCode, level (display only)
Role              — BudgetSubmitter | BudgetApprover | SystemAdmin (capability)
Permission        — code, resource, action
CostCenter        — code (KGN70xxx), sapCostCenterCode, name, departmentId, isActive
GlAccount         — code, description, isActive
FiscalYear        — yearLabel, startDate, endDate, isLocked
BudgetPlan        — ownerId, costCenterId, fiscalYearId, budgetType, periodRange, status, currentApproverId, lines[], version
BudgetLineItem    — glAccountId, amount (Money), lineNumber
ApprovalRouteStep — budgetId, approverId, sequence, status
ApprovalRecord    — budgetId, performedBy, action, previousStatus, newStatus, comment, timestamp
AuditEntry        — entity, entityId, action, performedBy, ip, correlationId, timestamp
Notification      — userId, type, title, body, relatedPlanId, isRead
```

## Value objects

- **Money** — amount > 0, currency (default KES)
- **PeriodRange** — from ≤ to, within fiscal year
- **BudgetStatus** — Draft | InApproval | Approved | Rejected

## Invariants

| Rule | Enforcement |
|---|---|
| Amount > 0 on every line | Money VO |
| At least one line to submit | BudgetPlan.submit() |
| Cannot edit when not Draft | BudgetPlan.updateLines() |
| Circular hierarchy | buildApprovalRoute() |
| SAP code required at submit | BudgetPlan.submit() |
| Owner cannot approve own | ApprovalService |
| Only currentApproverId may approve | ApprovalService |
| Period within fiscal year | PeriodRange VO |
| Optimistic concurrency | RowVersion / version |

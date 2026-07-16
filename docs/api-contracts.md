# API Contracts — `/api/v1`

## Error envelope

```json
{
  "error": {
    "code": "BUDGET_CONFLICT",
    "message": "Budget was modified by another user.",
    "correlationId": "uuid",
    "details": [{ "field": "version", "message": "Stale version" }]
  }
}
```

## Status codes

| Code | When |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Malformed |
| 401 | Unauthenticated |
| 403 | Unauthorized / IDOR |
| 404 | Not found (same visibility) |
| 409 | Conflict |
| 422 | Business rule |
| 500 | Unexpected |
| 503 | DB unavailable |

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | /api/v1/budget-plans | create draft |
| PATCH | /api/v1/budget-plans/:id | update draft |
| POST | /api/v1/budget-plans/:id/submit | submit + build route |
| GET | /api/v1/budget-plans | list (visibility filtered) |
| GET | /api/v1/budget-plans/:id | detail |
| POST | /api/v1/budget-plans/:id/approve | approve current step |
| POST | /api/v1/budget-plans/:id/reject | `{ "reason": "..." }` |
| GET | /api/v1/approvals/pending | my approval queue |
| GET | /api/v1/reports/budgets | role-scoped reports |
| GET | /api/v1/budget-plans/:id/sap-export | CSV when Approved |
| GET | /api/v1/admin/users | SystemAdmin user list + role/position/org reference data |
| POST | /api/v1/admin/users | SystemAdmin creates an account with a temporary password |
| PATCH | /api/v1/admin/users/:id | SystemAdmin updates identity, hierarchy, cost center, roles, or active state |
| DELETE | /api/v1/admin/users/:id | Deactivate account; historical user records are retained |
| POST | /api/v1/admin/users/:id/reset-password | SystemAdmin sets a temporary password |
| GET | /api/v1/admin/departments | List departments (active + archived) |
| POST | /api/v1/admin/departments | Create department |
| PATCH | /api/v1/admin/departments/:id | Update / archive / restore department |
| GET | /api/v1/admin/cost-centers | List cost centers + dep/user reference data |
| POST | /api/v1/admin/cost-centers | Create cost center (Manager + Responsible Person) |
| PATCH | /api/v1/admin/cost-centers/:id | Update / archive / reassign; mid-cycle ownership changes blocked |
| GET | /api/v1/admin/fiscal-years | List FYs + current year id |
| POST | /api/v1/admin/fiscal-years | Open a new FY (fails if another is already Open) |
| PATCH | /api/v1/admin/fiscal-years/:id | `{ action: close \| reopen \| archive \| setCurrent }` |
| GET | /api/v1/admin/submission-status | Stored cost-center submission statuses for current (or requested) FY |

Public self-registration and forgot-password reset are disabled. Account creation
and password resets require `admin.users`.

### POST /api/v1/budget-plans

Request:

```json
{
  "budgetType": "Primary",
  "fiscalYearId": "…",
  "fromPeriod": "2026-07-01",
  "toPeriod": "2027-06-30",
  "costCenterId": "…",
  "lines": [{ "glAccountId": "…", "amount": 1000 }]
}
```

Response `201`: BudgetPlan JSON.

Response `409` when an active budget already exists for the same
`(CostCenter, FiscalYear, BudgetType)` (statuses Draft / InApproval /
ReturnedForRevision):

```json
{
  "error": {
    "code": "ACTIVE_BUDGET_EXISTS",
    "message": "An active Amendment budget already exists for Cost Center KGN70010 for FY2027.",
    "correlationId": "…",
    "existingBudget": {
      "id": "…",
      "status": "ReturnedForRevision",
      "budgetType": "Amendment",
      "costCenterCode": "KGN70010",
      "fiscalYearLabel": 2027,
      "ownerId": "…",
      "ownerName": "…",
      "createdAt": "…"
    }
  }
}
```

### POST /api/v1/budget-plans/:id/reject

```json
{ "reason": "Reduce software licences" }
```

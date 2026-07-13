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

### POST /api/v1/budget-plans/:id/reject

```json
{ "reason": "Reduce software licences" }
```

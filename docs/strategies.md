# Strategies

## Concurrency

- Optimistic locking via `BudgetPlans.Version` (application expected version) and SQL Server `RowVersion` column (storage).
- On update: `WHERE BudgetPlanId = @id AND Version = @expectedVersion` with `SET Version = Version + 1` in the same statement.
- Zero rows affected → `ConcurrencyConflictError` → HTTP **409** with `error.code = BUDGET_CONFLICT`; client refreshes.
- Submit/approve/reject/return in Unit of Work transaction.
- Duplicate approve when the route step is already handled → idempotent safe response (no Pending step).

## Audit

Every mutating action writes ApprovalHistory (workflow) and AuditLogs (system).

| Field | Required |
|---|---|
| Who | performedBy |
| What | action, entity, entityId |
| Old / New | previousStatus / newStatus or BeforeJson / AfterJson |
| IP | IpAddress |
| Timestamp | UTC |
| Comment | On reject / return |
| Correlation ID | Per request |

Immutable: **DENY UPDATE/DELETE** on AuditLogs and ApprovalHistory for `app_budget_ops_role` **and** INSTEAD OF triggers (`TR_*_NoUpdateDelete`). Runtime connects as `app_budget_ops` (see `docs/migrations/005-app-budget-ops-role.sql`).

## Validation (three layers)

| Layer | Validates |
|---|---|
| Client | UX, required fields, Amount > 0 |
| API DTO | Schema, types, enums |
| Domain | Invariants, state transitions, route build |

Domain is authoritative.

## Failure

| Failure | Policy |
|---|---|
| Validation | 400 / 422 |
| AuthZ / IDOR | 403 + audit |
| Concurrency | 409 `BUDGET_CONFLICT` |
| SQL transient | Retry 3× backoff (100, 300, 900ms) on codes -2, 1205, 40501, 40613, … — WARN log each attempt with correlationId |
| SQL hard down | 503 |
| Event handler fail | Rollback UoW |
| Broken hierarchy | Reject; log; notify admin — never guess |

## Active plan unique index

`UX_BudgetPlans_ActiveUnique`: one in-play plan per `(CostCenterId, FiscalYearId, BudgetType)` among non-terminal statuses (`Draft` / `InApproval` / `ReturnedForRevision`). Does **not** prevent a new cycle after `Approved` or `Rejected`.

## Logging

INFO (submit/approve/reject), WARN (retries, 403), ERROR (exceptions), FATAL (DB down), AUDIT (→ AuditLogs), PERF (queries > 500ms).

Structured JSON with correlationId. Never log secrets.

## Configuration (env)

DEFAULT_CURRENCY=KES, FISCAL_YEAR_ACTIVE, SAP_EXPORT_VERSION_DEFAULT=V1, PAGINATION_DEFAULT_SIZE=25, RETRY_MAX_ATTEMPTS=3, SESSION_TIMEOUT_MINUTES=30, RATE_LIMIT_APPROVE_PER_MIN=10, REPOSITORY_DRIVER=mock|sql

`SQLSERVER_CONNECTION_STRING` for the app should use `User Id=app_budget_ops` (least privilege). Admin seed scripts may use Trusted_Connection.

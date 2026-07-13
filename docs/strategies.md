# Strategies

## Concurrency

- Optimistic locking via `BudgetPlans.RowVersion` / version field.
- Submit/approve/reject in Unit of Work transaction.
- Second concurrent writer → 409 Conflict; client refreshes.
- Duplicate approve → idempotent safe response.

## Audit

Every mutating action writes ApprovalHistory (workflow) and AuditLogs (system).

| Field | Required |
|---|---|
| Who | performedBy |
| What | action, entity, entityId |
| Old / New | previousStatus / newStatus or BeforeJson / AfterJson |
| IP | IpAddress |
| Timestamp | UTC |
| Comment | On reject |
| Correlation ID | Per request |

Immutable: DENY UPDATE/DELETE on AuditLogs and ApprovalHistory for app role + triggers.

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
| Concurrency | 409 |
| SQL transient | Retry 3× backoff (100, 300, 900ms) |
| SQL hard down | 503 |
| Event handler fail | Rollback UoW |
| Broken hierarchy | Reject; log; notify admin — never guess |

## Logging

INFO (submit/approve/reject), WARN (retries, 403), ERROR (exceptions), FATAL (DB down), AUDIT (→ AuditLogs), PERF (queries > 500ms).

Structured JSON with correlationId. Never log secrets.

## Configuration (env)

DEFAULT_CURRENCY=KES, FISCAL_YEAR_ACTIVE, SAP_EXPORT_VERSION_DEFAULT=V1, PAGINATION_DEFAULT_SIZE=25, RETRY_MAX_ATTEMPTS=3, SESSION_TIMEOUT_MINUTES=30, RATE_LIMIT_APPROVE_PER_MIN=10, REPOSITORY_DRIVER=mock|sql

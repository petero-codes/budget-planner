# Release Note — Budget category domain rename

- Branch: `feature/notification-task-runtime` (or merge branch containing Change #026)
- Target: `develop`
- Date: 2026-07-22
- Author: engineering
- Subsystems: Budget Plan domain (Active); Finance; Reports; SAP Export (Active). Startup Validation (Frozen) — untouched.

## Problem solved

Domain code used `budgetType` while the business speaks **Budget Category**. API clients had no prominent breaking-change notice for the JSON field rename.

## Why this solution

Align entity/DTO/API language with finance users (`budgetCategory`) while keeping `BudgetType` only at SQL and SAP interchange boundaries — avoids a schema migration while making the model easier to reason about.

## BREAKING CHANGE

| Before | After |
|--------|-------|
| `budgetType` | `budgetCategory` |

**Affected endpoints:**

| Method | Path |
|--------|------|
| `POST` | `/api/v1/budget-plans` |
| `PATCH` | `/api/v1/budget-plans/:id` |
| `GET` | `/api/v1/budget-plans`, `/api/v1/budget-plans/:id` |
| `GET` | `/api/v1/finance/dashboard` (`byBudgetCategory`, `byLegacyBudgetCategory`) |
| `GET` | `/api/v1/finance/approved` |

**Not changed:** SQL column `BudgetPlans.BudgetType`; SAP CSV column header `BudgetType` (value = catalog code).

## Files changed

- Modified: `src/domain/constants/budget-types.ts`, entities, services, repositories, API schemas, finance/reports UI, tests, docs

## Repository Impact

| Dimension | Value |
|---|---|
| Public APIs changed | **Yes** — `budgetCategory` rename |
| Database schema changed | No |
| Business rules changed | No (BR-12 / K-010 terminology) |

## Verification evidence (layered)

- Code: YES
- Tests: YES (unit suite)
- Browser Runtime: **Pending** — see checklist in `docs/CHANGE_HISTORY.md` Change #026

### Browser verification checklist

1. Create budgets for **Recurrent**, **Major**, and **CAPEX**.
2. Confirm labels on: Finance dashboard, Reports, CSV export, SAP export, notifications, budget detail, approvals.
3. Finance: **All** + RECURRENT/MAJOR/CAPEX cards filter inbox and status counts.
4. Legacy rows (`Primary`, etc.): appear under **Legacy Categories** when present.

## Rollback plan

Revert Change #026 commits. API clients must restore `budgetType` in request bodies if rolled back.

## Follow-up work

- Remove `@deprecated` `budgetType*` aliases in next major version.
- Optional: SQL column rename migration when business approves downtime.

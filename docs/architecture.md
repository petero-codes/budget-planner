# Architecture

## Clean Architecture

```text
Presentation (Next.js) → Application (services) → Domain (rules)
                              ↓
                    Infrastructure (repos, UoW, CSV)
```

## Key modules

| Module | Responsibility |
|---|---|
| `domain/rules/build-approval-route.ts` | managerId walk |
| `application/approval-service.ts` | submit, approve, reject |
| `application/budget-plan-service.ts` | draft CRUD |
| `application/authorization-service.ts` | permissions + visibility |
| `infrastructure/repositories/*` | persistence (mock → SQL) |

## Design tokens

- Primary `#00693E`, Navy `#003865`
- Amber pending, Red rejected, Blue info
- Brand font: **InspireTWDC** (from [KenGen Staff Portal](https://www.kengen.co.ke/staff-portal/))
- Dense ERP tables, 12–13px body

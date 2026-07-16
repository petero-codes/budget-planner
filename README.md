# KenGen ICT Budgeting Portal

Secure web portal for KenGen ICT annual budgeting: tree-based approvals via `Users.managerId`, SAP CSV export after final approval.

## Stack

- Next.js 14 (App Router) · TypeScript · Tailwind CSS · Vitest
- Clean Architecture: domain → application → infrastructure (mock or SQL Server)
- SQL Server schema: `docs/schema.sql`

## Setup

```bash
npm install
cp .env.example .env.local
npm run db:seed
npm run db:passwords
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login).

Sign in with seeded email/password accounts (default password from `db:passwords`: `KenGen@2026`). Examples:

- GM: `joyce.mwaniki@kengen.co.ke`
- Staff: `patrick.njoroge@kengen.co.ke`
- Finance: `finance.admin@kengen.co.ke`
- Admin: `ict.admin@kengen.co.ke`

Accounts are provisioned by the System Administrator. The Administration screen
supports account creation, role/manager/cost-center assignment, activation,
deactivation, and temporary-password resets. Public registration and
self-service password reset are disabled.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests |
| `npm run lint` | ESLint |
| `npm run db:seed` | Seed SQL Server reference data |
| `npm run db:passwords` | Set initial passwords for seeded users |

## Environment

| Variable | Purpose |
|---|---|
| `REPOSITORY_DRIVER` | `mock` (default) or `sql` |
| `SQLSERVER_CONNECTION_STRING` | App runtime: SQL auth as `app_budget_ops` (see `.env.example` and `docs/migrations/005-app-budget-ops-role.sql`). Seed/admin scripts may use Trusted_Connection. |
| `DEFAULT_CURRENCY` | KES |
| `SAP_EXPORT_VERSION_DEFAULT` | V1 |
| `APP_BASE_URL` | Base URL used by any retained system email links |

### SQL Server

1. Create DB and apply schema: run `docs/schema.sql` (plus `docs/migrations/` for existing DBs) against `BudgetOperations` on `localhost\SQLEXPRESS`.
2. Apply least-privilege app role: `docs/migrations/005-app-budget-ops-role.sql` (requires mixed-mode SQL auth).
3. Copy `.env.example` → `.env.local`, set `REPOSITORY_DRIVER=sql`, and use the `app_budget_ops` connection string for the Next.js app.
4. Seed with a privileged connection (Trusted_Connection is fine for seed scripts): `npm run db:seed` then `npm run db:passwords`
5. Restart `npm run dev`

Requires **ODBC Driver 17 for SQL Server** (`msnodesqlv8`).

## Documentation

| Document | Purpose |
|---|---|
| `docs/ENGINEERING_GOVERNANCE.md` | Process, milestones, documentation consistency |
| `docs/ARCHITECTURE_DECISIONS.md` | ADR log (locked decisions) |
| `docs/definition-of-done.md` | Completion checklist |
| `docs/open-decisions.md` | Unresolved items |
| `docs/domain-model.md` · `docs/state-machines.md` · `docs/api-contracts.md` · `docs/permission-matrix.md` | Domain / workflow / API / RBAC |
| `docs/production-readiness.md` | Go-live gates |
| `CHANGELOG.md` | User-visible changes |

## Release milestones

1. **Code Complete** ✅ — core + Finance workflow, RBAC, SQL Server  
2. **Stabilization** (current) — blockers, security, doc sync, attachment decision  
3. **Validation** — staging, E2E, role UAT, performance/security verification  
4. **Production** — tag `v1.0.0`, deploy, monitoring, backup/restore, rollback tested  

Details: `docs/ENGINEERING_GOVERNANCE.md`.

## Architecture note

Approval routing **never** hardcodes titles. It walks `managerId` and builds `ApprovalRoute`.

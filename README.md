# KenGen ICT Budgeting Portal

Secure web portal for KenGen ICT annual budgeting: tree-based approvals via `Users.managerId`, SAP CSV export after final approval.

## Stack

- Next.js 14 (App Router) · TypeScript · Tailwind CSS · Vitest
- Clean Architecture: domain → application → infrastructure (mock repos; SQL Server ready)
- SQL Server schema: `docs/schema.sql`

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login).

### Demo staff SSO: pick Patrick / Peter / Joyce on the Staff tab.  
Admin (separate): `ict.admin@kengen.co.ke` / any password → Administration only.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests (approval route + service) |
| `npm run lint` | ESLint |

## Environment

| Variable | Purpose |
|---|---|
| `REPOSITORY_DRIVER` | `mock` (default) or `sql` |
| `SQLSERVER_CONNECTION_STRING` | Phase 4 SQL Server |
| `DEFAULT_CURRENCY` | KES |
| `SAP_EXPORT_VERSION_DEFAULT` | V1 |

## Documentation

See `docs/` — approval-engine, domain-model, schema.sql, api-contracts, security-checklist.

## Architecture note

Approval routing **never** hardcodes titles. It walks `managerId` and builds `ApprovalRoute`.

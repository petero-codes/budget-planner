# WHY_SQL_SERVER.md — Why SQL Server, and why not the alternatives

**Purpose:** Answer the question every future engineer eventually asks — *"Why SQL Server and not
PostgreSQL / MySQL / MongoDB?"* — in one place, so the choice is never re-litigated from memory.

**Canonical decision:** ADR-009 (repository driver + SQL access path) and ADR-011 (audit/history
immutability). This document *explains the rationale*; the *decision of record* lives in those
ADRs. Rejected alternatives are catalogued in `docs/REJECTED_DECISIONS.md`.

---

## The short answer

The product is a **financial governance system**: multi-step approvals, immutable audit and
approval history, strict uniqueness invariants, and management reporting. Those requirements are
exactly what a mature relational engine with strong transactional guarantees and server-side
integrity is best at. SQL Server was chosen for that fit plus fit with the target operating
environment.

## What the domain actually requires

1. **ACID transactions across multiple tables.** Submitting/approving a budget writes the plan,
   approval route/steps, workflow history, audit log, and notifications together. A partial write
   is a correctness violation. → Requires real multi-statement transactions.
2. **Foreign-key integrity.** Budgets → line items → GL accounts; users → managers; cost centres →
   departments. Referential integrity must be enforced by the engine, not hoped for in app code.
3. **Immutable history at the storage layer.** `AuditLogs`, `ApprovalHistory`, and
   `WorkflowHistory` must never be updated or deleted — enforced by DB triggers *and* least-
   privilege DENY, so even the app cannot rewrite them (ADR-011, INV-6/7/8).
4. **Hard uniqueness invariants.** "One active budget version per lineage", "one active finance
   claim per plan", "one Open / one Current fiscal year" are enforced with **filtered unique
   indexes** — a first-class relational feature (K-002/K-006, `docs/DATABASE.md`).
5. **Reporting / analytics.** Executive and finance reporting need ad-hoc SQL, joins, and
   aggregation over normalized data.
6. **Schema evolution with a ledger.** Ordered, idempotent migrations tracked in
   `dbo.SchemaVersion` with startup validation (ADR-009).

## Why not the alternatives

| Option | Why it was not chosen |
|--------|------------------------|
| **MongoDB / document store** | No cross-document ACID by default; FK integrity and filtered-unique invariants become app-enforced (fragile); immutable audit/approval history can't be guaranteed at storage; SQL reporting is awkward. Rejected — see `REJECTED_DECISIONS.md`. |
| **PostgreSQL** | Technically capable (transactions, FKs, partial unique indexes, triggers). Not chosen for **environment fit**: the target operations use the Microsoft/Windows stack and SQL Server tooling, backup, and authentication that the team already runs. This is an operational fit decision, not a claim that Postgres is inferior. |
| **MySQL / MariaDB** | Historically weaker for the specific mix of filtered indexes, trigger-based immutability guarantees, and enterprise Windows-integrated operations targeted here; less aligned with the deployment environment. |
| **SQLite** | Single-writer/embedded; unfit for concurrent multi-user approval workloads and enterprise backup/HA. |

> **Honesty note.** PostgreSQL could satisfy the *technical* requirements. The deciding factor is
> **operational/environment fit** (Windows-integrated infrastructure, existing SQL Server tooling
> and auth). If that environment assumption ever changes, this is a valid trigger to revisit via a
> new ADR — not something to change silently.

## How the choice shows up in the code

- **Two repository implementations** behind one interface (`mock` for tests/dev, `sql` for
  production) — persistence is swappable, but production is fail-closed to `sql` (ADR-009, K-007).
- **Native driver** `msnodesqlv8`/`mssql`, aliased out of browser/edge bundles (`next.config.js`;
  see `TROUBLESHOOTING.md`).
- **Least-privilege login** `app_budget_ops` with DENY on audit tables (ADR-009/011).
- **Connection pooling** via a singleton pool; **health endpoint** `/api/v1/system/database-health`.
- **Attachments in SQL** as `VARBINARY(MAX)` for a single backup/restore boundary (ADR-008).

## Environment-fit factors (verify per deployment — some **UNKNOWN** here)

- Windows-integrated / existing SQL Server infrastructure and DBA tooling — **assumed**, confirm
  with ops.
- Windows authentication support — supported by the driver; whether it's used in prod is a
  deployment choice (**UNKNOWN** in-repo; `.env.example` shows connection settings).
- Stored procedures — **not currently used**; the app uses parameterized SQL via repositories.
  Could be added later without changing this rationale.

---

*To change the database engine: write a new ADR superseding ADR-009, re-evaluate ADR-011
immutability guarantees on the new engine, and update `DATABASE.md`, `REJECTED_DECISIONS.md`, and
`KNOWLEDGE_LOG.md`. Do not switch engines as an "optimization".*

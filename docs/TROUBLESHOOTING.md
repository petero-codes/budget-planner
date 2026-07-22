# TROUBLESHOOTING.md — Solved problems, written once

**Purpose:** Capture problems that have already been diagnosed and fixed, with symptom → cause →
fix → verification, so nobody re-solves them. Every entry is a *real* issue encountered in this
repo (evidence: `docs/CHANGE_HISTORY.md`, ADR-009, K-007).

**Single responsibility:** operational symptoms & fixes. Rules → `BUSINESS_RULES.md`; decisions →
ADRs. When a new class of bug is diagnosed, add it here (governance DoD).

Format per entry: **Symptom → Cause → Fix → Verify**.

---

## Auth / session

### Login succeeds but `GET /api/v1/me` returns 401
- **Cause:** repository/schema mismatch — most often `REPOSITORY_DRIVER` unset or `mock` while the
  app expects SQL, or the SQL schema missing columns the code reads. A previous silent
  `?? "mock"` default masked this as a generic 401. (K-007, ADR-009)
- **Fix:** set `REPOSITORY_DRIVER=sql` explicitly; apply pending migrations (below). Non-auth
  failures now surface as **500**, not a misleading 401.
- **Verify:** log in in a browser, load a portal page; `/api/v1/me` returns 200 with profile +
  permissions + `unreadNotifications`.

### Every request is unauthorized after deploy
- **Cause:** missing or rotated session secret or cookie config, or middleware misconfig.
- **Fix:** ensure the session secret env var is set (see `.env.example`); confirm cookies are
  issued on login.
- **Verify:** login sets a session cookie; protected routes return 200.

## Startup / configuration

### App refuses to start / startup validation fails — "pending migration"
- **Cause:** database schema version behind `EXPECTED_SCHEMA_VERSION`; a migration in the registry
  has not been applied. (Startup Validation subsystem, ADR-009 — **FROZEN**)
- **Fix:** apply migrations in order from `docs/migrations/` (e.g. `npm run migrate` /
  `scripts/apply-migrations.ts`); confirm `dbo.SchemaVersion` matches expected.
- **Verify:** startup report prints schema version = expected and "no pending migrations".

### Startup fails: `REPOSITORY_DRIVER` invalid / missing in production
- **Cause:** fail-fast config — production refuses any driver other than `sql` and refuses an
  unset driver (no silent default). (ADR-009, K-007)
- **Fix:** set `REPOSITORY_DRIVER=sql` and provide SQL connection settings.
- **Verify:** startup report shows driver = `sql` and DB connectivity OK.

### `Cannot assign to 'NODE_ENV' because it is a read-only property` during `next build`
- **Cause:** assigning `process.env.NODE_ENV` (typed read-only).
- **Fix:** set it only when unset, via a guarded type assertion.
- **Verify:** `npm run build` completes.

## Build / bundling

### Build error: `msnodesqlv8/.../sqlserver.node` not supported in browser/edge
- **Cause:** the native SQL driver leaked into client/edge webpack bundles.
- **Fix:** alias `mssql`, `msnodesqlv8`, and `child_process` to `false` for non-server and edge
  builds in `next.config.js`. (Startup Validation subsystem — change only per frozen rules)
- **Verify:** `npm run build` passes; pages load without native-module errors.

### Edge compiler fails on `node:child_process`
- **Cause:** the edge compiler can't parse `node:` URIs.
- **Fix:** import `child_process` (not `node:child_process`) and alias it `false` for edge.
- **Verify:** build passes.

### TypeScript: `Property 'config' does not exist on type 'ConnectionPool'`
- **Cause:** reading `pool.config` which isn't in the type.
- **Fix:** narrow type assertion encapsulated in a `getConnectionPoolState` helper.
- **Verify:** typecheck clean.

## Notifications

### Notifications duplicated (same task appears twice)
- **Possible causes:** (1) two active actionable notifications created for the same
  `(recipient, type, plan/entity)`; (2) historical duplicates created before the guard existed.
- **Fix:** new duplicates are prevented by the repository duplicate-task guard
  (`INSERT ... WHERE NOT EXISTS`, mock + SQL) — K-009. Historical duplicates are **not**
  auto-removed (no cleanup migration by decision — CHANGE_HISTORY #011).
- **Verify:** trigger the same task twice via the harness (`npm run e2e:spine`); only one ACTIVE
  row exists; `notification-dedup.test.ts` passes.

### Badge count looks wrong
- **Cause:** expecting unread-message semantics. The badge counts **active/unresolved tasks**
  (`resolvedAt IS NULL`), not unread items — reading never changes it. (K-001)
- **Fix:** none — this is by design. Resolve the underlying work to decrement.
- **Verify:** read a task (badge unchanged); complete its workflow action (badge decrements).

### Approval notification doesn't focus the Decision panel
- **Cause:** notification created before deep-links existed keeps a plain `/budgets/{id}` URL.
- **Fix:** none needed — backward-compatible; new Approval tasks use `?action=approve` and the
  budget page scrolls/highlights the Decision panel. (CHANGE_HISTORY #011)
- **Verify:** open a new Approval task from the bell → lands on the highlighted panel.

## Database / E2E tooling

### `AuditLogs are immutable` (or ApprovalHistory/WorkflowHistory) during test teardown
- **Cause:** `DELETE` on trigger-protected immutable tables (INV-6/7/8).
- **Fix:** teardown disables/re-enables triggers **only** via
  `scripts/lib/test-database-cleaner.ts` (the sole authorized site), which re-enables even on
  failure. Never disable these triggers elsewhere. (CHANGE_HISTORY #010, INV-9)
- **Verify:** `npm run e2e:spine` cleans up; a post-run check confirms triggers re-enabled.

### PowerShell mangles inline `npx tsx` string literals / `&&` chains
- **Cause:** PowerShell quoting and lack of `&&` (older versions).
- **Fix:** put the code in a small `.ts` file and run it, or chain with `;` instead of `&&`.
- **Verify:** command runs as written.

## UI / dev server

### Dev server crashes: `ENOENT ... scandir '...src\pages'`
- **Cause:** Next.js expected a `src/pages` directory that was removed.
- **Fix:** keep an (empty) `src/pages` directory present.
- **Verify:** `npm run dev` starts clean.

### `npx knip` fails: `npm error code ECOMPROMISED`
- **Cause:** corrupted npm cache.
- **Fix:** `npm cache clean --force`, then re-run.
- **Verify:** `npx knip` runs.

---

*When you diagnose a new issue, add it here (Symptom → Cause → Fix → Verify) as part of the
change's Definition of Done. Do not restate rules — link the K-entry/ADR/INV that explains why.*

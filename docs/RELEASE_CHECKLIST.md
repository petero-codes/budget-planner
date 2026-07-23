# RELEASE_CHECKLIST.md — runnable release gates

> **Single responsibility.** This is the *operational runbook* for shipping: the exact,
> ordered gates for merging a branch into `develop` and promoting `develop` into `main`.
> It does **not** restate governance policy (`ENGINEERING_GOVERNANCE.md`), the definition
> of done (`definition-of-done.md`), or the release-note format (`release-notes/TEMPLATE.md`)
> — it links to them. If a step here disagrees with governance, governance wins; fix this file.

---

## MVP Release Gate (current priority)

**If every box below is checked, stop building and release to staging / production as planned.**  
Do not add architecture, docs, renames, aliases, or new modules while this gate is open.

### Automated

- [ ] Build passes (`npm run build`)
- [ ] Tests pass (`npm run test`)

### Browser — core flows

- [ ] Login works
- [ ] Logout works
- [ ] Create budget
- [ ] Edit budget
- [ ] Submit budget
- [ ] Return budget
- [ ] Approve budget
- [ ] Finance claim
- [ ] Finance finalize
- [ ] Reports load
- [ ] Budget category filter works (Recurrent / Major / CAPEX)
- [ ] SAP export downloads
- [ ] Notifications work
- [ ] Audit logs recorded
- [ ] Browser console has zero errors

### Roles — each completes its journey without errors

- [ ] System Admin
- [ ] Budget Holder
- [ ] Assistant Manager
- [ ] Manager
- [ ] General Manager
- [ ] Finance Administrator

### Staging

- [ ] Staging passes (login → create → submit → approve → finance claim → finalize → reports → notifications → SAP)

---

Two independent gate sets, run in order:

- **Gate A — merge a feature/bugfix/hotfix branch → `develop`** (per PR).
- **Gate B — promote `develop` → `main`** (per release; the production line).

Copy the relevant block into the PR description and tick each box. An unchecked box blocks the merge.

---

## Gate A — branch → `develop`

Branch names: `feature/*`, `bugfix/*`, `hotfix/*` (the Docs Guard `release-note` rule keys off this).

### A1. Automated (must pass locally *and* in CI)

```bash
npm run lint          # next lint — no errors
npm run test          # vitest run — all suites green
npm run build         # next build — production compile succeeds
npm run docs:check    # Docs Guard — no violations (or justified waivers)
```

- [ ] `npm run lint` clean
- [ ] `npm run test` all green
- [ ] `npm run build` succeeds
- [ ] `npm run docs:check` passes (any waiver marker is justified and visible in the PR)

### A2. Database (only if schema/migrations changed)

```bash
npm run db:migrate    # applies pending migrations against a local SQL Server
```

- [ ] New migration is **idempotent** (safe to re-run) and registered so
      `EXPECTED_SCHEMA_VERSION` matches (see `DATABASE.md` + migration registry)
- [ ] `docs/DATABASE.md` updated (tables/indexes/triggers/constraints)
- [ ] N/A — no schema change this branch

### A3. Documentation (the doc-update matrix)

Follow the **Documentation-update matrix** in `ENGINEERING_GOVERNANCE.md`; the Docs Guard
enforces the mechanical subset. Confirm the *content* is real, not just co-changed files.

- [ ] `docs/CHANGE_HISTORY.md` — new entry on top, **with a Rollback line**
- [ ] `docs/WORKFLOWS.md` and/or `docs/BUSINESS_RULES.md` — if behavior/rules changed
- [ ] `docs/KNOWLEDGE_LOG.md` — if a permanent business rule/invariant changed (new/superseded K-entry)
- [ ] `docs/ENGINEERING_BRAIN.md` — if architecture/configuration surface changed
- [ ] `docs/FEATURE_REGISTRY.md` — if a feature's status changed
- [ ] `docs/TROUBLESHOOTING.md` — if a new failure mode was discovered and solved
- [ ] Relevant ADR added/updated — if a decision, workflow, permission, or status machine changed
- [ ] `docs/release-notes/<branch>.md` — created from `TEMPLATE.md` (problem · solution · files ·
      layered evidence · Repository Impact · known limitations · rollback · follow-up)

### A4. Evidence & review

- [ ] Feature completeness traced end-to-end per `feature-e2e-proof.md` (the 12-point standard);
      **Application Service Runtime** and **Browser Runtime** each marked YES / NO / Pending — never a bare "Runtime: YES"
- [ ] Frozen-subsystem check: no frozen code touched, or the four-justification note is in the PR
- [ ] Self-critique / end-of-task report attached (per `ENGINEERING_GOVERNANCE.md`)
- [ ] At least one human review approval

> Merge into `develop` only when **every** A-box is ticked or explicitly marked N/A with a reason.

---

## Gate B — `develop` → `main` (production promotion)

`main` is protected. Gate B is the only path in. It assumes all merged branches already cleared Gate A.

### B1. Re-run the automated gates on the merge commit

- [ ] `npm run lint` clean
- [ ] `npm run test` all green
- [ ] `npm run build` succeeds
- [ ] `npm run docs:check` passes

### B2. Staging verification (real environment)

- [ ] Migrations applied to staging (`npm run db:migrate`) and **startup validation passes**
      (schema version matches, no pending migrations — see `ENGINEERING_BRAIN.md` startup report)
- [ ] Notification spine E2E run against staging: `npm run e2e:spine` — green
- [ ] Staging browser E2E matrix executed and recorded in `docs/staging-e2e-acceptance.md`
- [ ] Role-based UAT (Budget Holder · Manager · GM · Finance · System Admin) — results recorded
- [ ] Access-control spot check: each role sees only permitted actions (no IDOR, no missing DENY)

### B3. Data safety (must be proven, not assumed)

- [ ] Fresh database **backup** taken before promotion
- [ ] **Restore test** performed from that backup (backup is only real if restore works)
- [ ] Rollback plan for this release written down (schema + app), including any **irreversible**
      steps (immutable audit logs cannot be un-written — note the compensating action instead)

### B4. Release record

- [ ] `CHANGELOG.md` updated for the release
- [ ] Release notes for all included branches present under `docs/release-notes/`
- [ ] Version bumped in `package.json`
- [ ] Git tag created for the release after merge to `main`

> Promote to `main` only when **every** B-box is ticked. If a B-box cannot be satisfied,
> stop and record why in the release notes — do not merge around a failed gate.

---

## Related documents

- `docs/ENGINEERING_GOVERNANCE.md` — governance loop, doc-update matrix, Docs Guard table
- `docs/definition-of-done.md` — per-change completeness checklist
- `docs/release-notes/TEMPLATE.md` — per-branch release-note format
- `docs/staging-e2e-acceptance.md` — where staging browser E2E evidence lives
- `docs/feature-e2e-proof.md` — the 12-point end-to-end proof standard
- `docs/DATABASE.md` — schema, migrations, schema-version expectations

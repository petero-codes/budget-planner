# RELEASE_CHECKLIST.md — runnable release gates

> **Single responsibility.** This is the *operational runbook* for shipping: the exact,
> ordered gates for merging a branch into `develop` and promoting `develop` into `main`.
> It does **not** restate governance policy (`ENGINEERING_GOVERNANCE.md`), the definition
> of done (`definition-of-done.md`), or the release-note format (`release-notes/TEMPLATE.md`)
> — it links to them. If a step here disagrees with governance, governance wins; fix this file.

---

## MVP Release Gate (current priority)

**If every Phase 1 box below is checked, stop building and release to staging.**  
Do not add architecture, docs, renames, aliases, or new modules while this gate is open.

**Legend:** `[x]` verified with evidence · `[ ]` still owed · `[~]` partially done — re-confirm in browser

### Already shipped (engineering — not a substitute for browser UAT)

- [x] In-app support tickets removed → email Help (`ict-support@kengen.co.ke`) — Change #027
- [x] CI green on `feature/notification-task-runtime` (Docs Guard + Architecture Guard) — Change #028
- [x] Unit tests pass — **163/163** (2026-07-23)
- [x] Production build passes on CI (browser-safety job) and locally
- [x] Local SQL driver startup PASS (schema 012); mock-vs-SQL login mismatch fixed (restart with `REPOSITORY_DRIVER=sql`)

---

### 1. Critical authentication

- [~] Login (SQL path works after restart — **re-confirm** in browser after hard refresh)
- [ ] Logout
- [ ] Session persistence (refresh / new tab while logged in)
- [ ] SQL restart while logged in (expect re-auth or clean recovery — document actual behaviour)
- [ ] Unauthorized route protection (signed-out → `/login`; wrong role → `/access-denied`)

### 2. Budget lifecycle (highest business risk)

For **each** category — Recurrent · Major · CAPEX:

- [ ] Create
- [ ] Save draft
- [ ] Edit
- [ ] Submit
- [ ] Return for revision
- [ ] Edit again
- [ ] Resubmit
- [ ] Approve (through hierarchy)
- [ ] Finance finalize (after claim)

### 3. Finance

- [ ] Queue shows correct budgets
- [ ] Category filter works (All / Recurrent / Major / CAPEX)
- [ ] Claim
- [ ] Release
- [ ] Finalize
- [ ] Return
- [ ] Dashboard totals update correctly *(polish pass queued — see Working list below)*

### 4. Reports

- [ ] Category filter
- [ ] Fiscal year filter
- [ ] Cost center filter
- [ ] Export
- [ ] Totals equal SQL data

### 5. Notifications

- [ ] Badge count
- [ ] Bell dropdown
- [ ] Deep links
- [ ] Mark read
- [ ] Resolution after workflow completes

### 6. Audit — important actions write a record

- [ ] Create budget
- [ ] Edit
- [ ] Submit
- [ ] Return
- [ ] Approve
- [ ] Finance claim
- [ ] Finance finalize
- [ ] Login (if applicable)

*Who can open `/audit` is a separate product decision — see Working list.*

### 7. SAP

- [ ] Export downloads
- [ ] Budget category codes (`RECURRENT` / `MAJOR` / `CAPEX`)
- [ ] Amounts
- [ ] Fiscal year
- [ ] Cost center

### 8. Browser quality (every page touched in UAT)

- [ ] No console errors
- [ ] No failed network requests
- [ ] No hydration warnings
- [ ] No React warnings
- [ ] Responsive layout
- [ ] Loading states
- [ ] Empty states

### 9. Role walkthroughs (full journeys, not permission-only)

- [ ] System Administrator
- [ ] General Manager ICT
- [ ] Manager
- [ ] Assistant Manager / Budget Holder
- [ ] Finance Administrator
- [ ] Office Administrator (if seeded / applicable)

### After Phase 1 only

- [ ] Merge feature branch
- [ ] Deploy staging
- [ ] Real-user smoke
- [ ] Fix only issues found
- [ ] Promote to `main`

---

## Working list — next product polish (after / alongside UAT findings)

Do **not** expand architecture. Only user-visible dashboards and access:

1. **Finance dashboard** — layout, totals, category cards/filters, empty states (start here)
2. **Admin dashboard / admin home** — clarity for System Admin daily work
3. **Audit visibility** — confirm who should see `/audit`
   - Today (`permission-matrix.md`): `audit.view` is granted to GM, Finance Administrator, System Admin, and Audit Viewer (seed defaults — verify live)
   - Decide: keep as-is vs tighten/widen; then align UI + matrix in one pass

---
Two independent gate sets, run in order:

- **Gate A â€” merge a feature/bugfix/hotfix branch â†’ `develop`** (per PR).
- **Gate B â€” promote `develop` â†’ `main`** (per release; the production line).

Copy the relevant block into the PR description and tick each box. An unchecked box blocks the merge.

---

## Gate A â€” branch â†’ `develop`

Branch names: `feature/*`, `bugfix/*`, `hotfix/*` (the Docs Guard `release-note` rule keys off this).

### A1. Automated (must pass locally *and* in CI)

```bash
npm run lint          # next lint â€” no errors
npm run test          # vitest run â€” all suites green
npm run build         # next build â€” production compile succeeds
npm run docs:check    # Docs Guard â€” no violations (or justified waivers)
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
- [ ] N/A â€” no schema change this branch

### A3. Documentation (the doc-update matrix)

Follow the **Documentation-update matrix** in `ENGINEERING_GOVERNANCE.md`; the Docs Guard
enforces the mechanical subset. Confirm the *content* is real, not just co-changed files.

- [ ] `docs/CHANGE_HISTORY.md` â€” new entry on top, **with a Rollback line**
- [ ] `docs/WORKFLOWS.md` and/or `docs/BUSINESS_RULES.md` â€” if behavior/rules changed
- [ ] `docs/KNOWLEDGE_LOG.md` â€” if a permanent business rule/invariant changed (new/superseded K-entry)
- [ ] `docs/ENGINEERING_BRAIN.md` â€” if architecture/configuration surface changed
- [ ] `docs/FEATURE_REGISTRY.md` â€” if a feature's status changed
- [ ] `docs/TROUBLESHOOTING.md` â€” if a new failure mode was discovered and solved
- [ ] Relevant ADR added/updated â€” if a decision, workflow, permission, or status machine changed
- [ ] `docs/release-notes/<branch>.md` â€” created from `TEMPLATE.md` (problem Â· solution Â· files Â·
      layered evidence Â· Repository Impact Â· known limitations Â· rollback Â· follow-up)

### A4. Evidence & review

- [ ] Feature completeness traced end-to-end per `feature-e2e-proof.md` (the 12-point standard);
      **Application Service Runtime** and **Browser Runtime** each marked YES / NO / Pending â€” never a bare "Runtime: YES"
- [ ] Frozen-subsystem check: no frozen code touched, or the four-justification note is in the PR
- [ ] Self-critique / end-of-task report attached (per `ENGINEERING_GOVERNANCE.md`)
- [ ] At least one human review approval

> Merge into `develop` only when **every** A-box is ticked or explicitly marked N/A with a reason.

---

## Gate B â€” `develop` â†’ `main` (production promotion)

`main` is protected. Gate B is the only path in. It assumes all merged branches already cleared Gate A.

### B1. Re-run the automated gates on the merge commit

- [ ] `npm run lint` clean
- [ ] `npm run test` all green
- [ ] `npm run build` succeeds
- [ ] `npm run docs:check` passes

### B2. Staging verification (real environment)

- [ ] Migrations applied to staging (`npm run db:migrate`) and **startup validation passes**
      (schema version matches, no pending migrations â€” see `ENGINEERING_BRAIN.md` startup report)
- [ ] Notification spine E2E run against staging: `npm run e2e:spine` â€” green
- [ ] Staging browser E2E matrix executed and recorded in `docs/staging-e2e-acceptance.md`
- [ ] Role-based UAT (Budget Holder Â· Manager Â· GM Â· Finance Â· System Admin) â€” results recorded
- [ ] Access-control spot check: each role sees only permitted actions (no IDOR, no missing DENY)

### B3. Data safety (must be proven, not assumed)

- [ ] Fresh database **backup** taken before promotion
- [ ] **Restore test** performed from that backup (backup is only real if restore works)
- [ ] Rollback plan for this release written down (schema + app), including any **irreversible**
      steps (immutable audit logs cannot be un-written â€” note the compensating action instead)

### B4. Release record

- [ ] `CHANGELOG.md` updated for the release
- [ ] Release notes for all included branches present under `docs/release-notes/`
- [ ] Version bumped in `package.json`
- [ ] Git tag created for the release after merge to `main`

> Promote to `main` only when **every** B-box is ticked. If a B-box cannot be satisfied,
> stop and record why in the release notes â€” do not merge around a failed gate.

---

## Related documents

- `docs/ENGINEERING_GOVERNANCE.md` â€” governance loop, doc-update matrix, Docs Guard table
- `docs/definition-of-done.md` â€” per-change completeness checklist
- `docs/release-notes/TEMPLATE.md` â€” per-branch release-note format
- `docs/staging-e2e-acceptance.md` â€” where staging browser E2E evidence lives
- `docs/feature-e2e-proof.md` â€” the 12-point end-to-end proof standard
- `docs/DATABASE.md` â€” schema, migrations, schema-version expectations


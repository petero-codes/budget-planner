# Change History

Chronological, **concise** long-term memory of implemented changes. This is
project memory — do not rely on chat history.

**Keep entries short.** One-paragraph summary + links to `CHANGELOG.md`,
ADRs, and key files. Not a narrative. If a change is user-visible, the detail
lives in `CHANGELOG.md`; this log records *what/why/verified* at a glance.

Governing policy: `docs/ENGINEERING_GOVERNANCE.md` → "Engineering Change Log
Policy". Newest entries at the top.

## Change #028 — Unblock PR CI (Docs Guard + Architecture Guard install)

- Date: 2026-07-23
- Author: agent
- Subsystems: Development Toolkit (Active); documentation matrix only. Frozen: none.
- Task / Reason: PR #3 failed Docs Guard (5 matrix violations after support removal) and Architecture Guard at Install dependencies / production build. Satisfy docs matrix for Change #027 surface; harden CI install (`npm install --ignore-scripts`, no npm cache); omit `REPOSITORY_DRIVER=mock` on CI build so production+mock fail-fast in `env.ts` does not abort outside `NEXT_PHASE`.
- Files: `docs/BUSINESS_RULES.md`, `ENGINEERING_BRAIN.md`, `DEPENDENCY_MAP.md`, `KNOWLEDGE_LOG.md` (K-011), `release-notes/feature-notification-task-runtime.md`, `.github/workflows/architecture-guard.yml`
- Business rules changed: No (doc alignment; WF-015 already retired in product)
- Knowledge: K-011 added; K-001 evidence re-verified
- Verification: Code YES · Tests NO (docs/CI only) · Runtime pending CI · Docs YES
- Rollback: revert this commit

---

## Change #027 — Remove in-app Issue Reporting (MVP email support)

- Date: 2026-07-22
- Author: agent
- Subsystems: Presentation; Notification Engine (Active). Startup Validation (Frozen) — DI probe only (see Frozen note).
- Task / Reason: MVP simplification — users report problems by email (`ict-support@kengen.co.ke`) instead of in-app tickets. Removes UI/API/services/repos/tests for SupportIssue. Migrations `009` left in place (already in schema history); tables unused. Adds short **MVP Release Gate** checklist at top of `docs/RELEASE_CHECKLIST.md` (browser/role/staging boxes only — no new infra).
- Files deleted: support pages, API routes, `support-issue-service.ts`, `domain/support-issue.ts`, SQL/mock support repos, `support-issue-service.test.ts`, report-issue modal
- Files modified: footer (mailto), user-dropdown Help, navigation, middleware, portal-access, DI, repository interfaces/mock store, notification destination test
- Business rules changed: No (WF-015 retired from product surface; email-only)
- APIs removed: `GET/POST /api/v1/support-issues`, `GET/PATCH /api/v1/support-issues/[id]`, `GET .../screenshot`
- Tests: support-issue unit test removed; suite re-run
- Docs: FEATURE_REGISTRY / CHANGE_HISTORY / RELEASE_CHECKLIST MVP gate / this entry
- Verification: Code YES · Tests YES (163/163) · Runtime YES (build) · Docs YES
- Frozen note: `instrumentation.ts` — removed DI probe for deleted `supportIssueService` (deployment requirement; build failed without it). Startup Validation remains frozen.
- Rollback: restore deleted files from git history before this commit

---

## Change #026 — `budgetCategory` domain rename + enriched catalog

- Date: 2026-07-22
- Author: agent
- Subsystems: Budget Plan domain; Finance; Reports; SAP Export (Active)
- Task / Reason: Rename domain field `budgetType` → `budgetCategory` across entities, DTOs, API payloads, services, and UI; keep SQL column `BudgetType` and SAP interchange column `BudgetType` at integration boundary only; enrich catalog with `order`, `color`, `shortLabel`, display helpers; finance distribution shows count-first cards + explicit **All** filter; legacy categories visible when historical rows exist.
- Files: `src/domain/constants/budget-types.ts`, entities, services, repos (mappers), API schemas/routes, portal pages, tests, `scripts/e2e-notification-spine.ts`, docs
- Business rules changed: No (terminology alignment with BR-12 / K-010)

### BREAKING CHANGE

| Before | After |
|--------|-------|
| `budgetType` | `budgetCategory` |

**Affected endpoints:** `POST /api/v1/budget-plans`, `PATCH /api/v1/budget-plans/:id`, budget plan GET responses, `GET /api/v1/finance/dashboard` (`byBudgetCategory`), `GET /api/v1/finance/approved`.

See `docs/api-contracts.md` → Breaking changes and `docs/release-notes/budget-category-rename.md`.

- DB impact: None (`BudgetPlans.BudgetType` / `BudgetLineage.OriginalBudgetType` columns unchanged; mapped in SQL layer)
- Tests: 165/165 pass; legacy distribution helper tested
- Docs: api-contracts BREAKING section, release notes, ENGINEERING_BRAIN §10.1
- Verification: Code YES · Tests YES · Runtime pending · Docs YES
- Browser verification checklist (manual):
  - Create **Recurrent**, **Major**, and **CAPEX** budgets; confirm correct labels on: Finance dashboard, Reports, CSV export, SAP export (`BudgetType` code + compliance `Category` label), notifications, budget detail, approvals queue
  - Finance: **All** card clears category filter (same behaviour as status filters); RECURRENT/MAJOR/CAPEX cards filter inbox + status counts
  - Legacy: if `Primary`/`Supplementary` rows exist, **Legacy Categories** section appears on Finance + Reports (not hidden from distribution)
- Rollback: revert field rename commits; API clients must send `budgetType` again if rolled back

---

## Change #025 — Budget category codes vs UI labels

- Date: 2026-07-22
- Author: agent
- Subsystems: Budget Plan domain; Finance; Reports; SAP Export (Active)
- Task / Reason: Richer `BUDGET_TYPE_CATALOG` (code + label); UI uses "Budget Category" not "Budget Type"; stored codes `RECURRENT`/`MAJOR`/`CAPEX`; legacy values read-only for audit.
- Files: `src/domain/constants/budget-types.ts`, UI pages (form, finance, reports, budgets, home, approvals), `sap-compliance-service.ts`, tests, docs
- Business rules changed: No (refines BR-12 presentation; K-010 updated)
- APIs changed: Request/response `budgetType` values are now codes (`RECURRENT`, `MAJOR`, `CAPEX`)
- DB impact: None (still NVARCHAR; new rows use codes)
- Tests: `budget-types.test.ts` updated; 160+ pass
- Docs: K-010 legacy note; browser verification checklist in Change #024 follow-up
- Verification: Code YES · Tests YES (161/161) · Runtime pending · Docs YES
- Browser verification checklist (manual):
  - **Budget creation:** only Recurrent / Major / Capital Expenditure in dropdown; default = Recurrent; API rejects invalid codes
  - **Finance:** distribution totals match DB; click category card filters inbox + status cards; "Show all categories" clears filter
  - **Reports:** category filter works; CSV respects filter; distribution % bar updates; "Budget by category" view groups correctly
  - **SAP:** CSV column `BudgetType` with code (`RECURRENT`/`MAJOR`/`CAPEX`); compliance export includes `BudgetType` + human `Category` row
- Legacy: `Primary`/`Supplementary`/old strings on historical rows are read-only display only — app will not generate them
- Rollback: revert to title-case stored values from Change #024

---

## Change #024 — Budget type catalog: Recurrent, Major, CAPEX (BR-12)

- Date: 2026-07-22
- Author: agent
- Subsystems: Budget Plan domain (Active); Finance UI (Active); Reports (Active); SAP Export (Active)
- Task / Reason: Replace legacy Primary/Supplementary catalog with KenGen Finance types; add Finance distribution cards, Reports type filter/grouping, SAP Budget Type column.
- Files: `src/domain/constants/budget-types.ts`, `budget-plan-service.ts`, `budget-plan-form.tsx`, `api-schemas.ts`, `finance/dashboard` + `finance/page.tsx`, `reports/page.tsx`, `sap-csv-writer.ts`, `sap-compliance-service.ts`, `finance-service.ts`, tests, `docs/BUSINESS_RULES.md`, `KNOWLEDGE_LOG.md` (K-010; K-003 superseded), `domain-model.md`, `DOMAIN_GLOSSARY.md`, `api-contracts.md`, `WORKFLOWS.md`, `FILE_INDEX.md`
- Business rules changed: **Yes** — BR-12; K-003 superseded by K-010
- APIs changed: `POST/PATCH` budget bodies validate `z.enum(BUDGET_TYPES)`; Finance dashboard adds `byBudgetType`; inbox rows include `budgetType`
- DB impact: **None** (no migration — seed/demo uses new values only; production remap requires business owner)
- Tests: `budget-types.test.ts` (new); all fixtures updated; 160/160 pass
- Docs updated: BR-12, K-010, domain-model, glossary, api-contracts, WORKFLOWS, FILE_INDEX
- Knowledge: K-010 added; K-003 superseded
- Verification: Code YES · Tests YES (160/160) · Runtime pending · Docs YES
- Rollback: revert code; reseed with legacy types if needed; no schema rollback

---

## Change #023 — Fix sap-export Finalized gate (422)

- Date: 2026-07-20
- Author: agent
- Subsystems: SAP Export (Active); Startup Validation (Frozen — untouched)
- Task / Reason: Budget detail "Export SAP Package" returned 422 on Finalized plans because `/sap-export` still required legacy `Approved` (BR-28 / WF-018 stale gate).
- Files: `src/app/api/v1/budget-plans/[id]/sap-export/route.ts`, `src/domain/rules/sap-exportable-status.ts`, `src/app/(portal)/budgets/[id]/page.tsx` (error detail), `tests/unit/sap-export-status-gate.test.ts`, `docs/WORKFLOWS.md`, `docs/BUSINESS_RULES.md`, `docs/ENGINEERING_BRAIN.md`, `docs/api-contracts.md`, `docs/FEATURE_REGISTRY.md`
- Business rules changed: No (aligned route with existing BR-28); resolved flagged smell
- APIs changed: `GET …/sap-export` accepts `Finalized` | legacy `Approved`
- DB impact: None
- Tests: `sap-export-status-gate.test.ts`; runtime re-test Export on Finalized plan
- Docs updated: WF-018, BUSINESS_RULES flagged→resolved, ENGINEERING_BRAIN §17, api-contracts, FEATURE_REGISTRY
- Knowledge: No new K-entry (enforces existing BR-28)
- Verification: Code YES · Tests YES (sap-export-status-gate) · Runtime pending (retry Export on FY2027-ICT-003-V3) · Docs YES
- Rollback: revert route gate to `Approved`-only — restores prior 422 on Finalized; no schema/data impact

---

## Change #022 — Browser Safety Contract v2 (reachability guard)

- Date: 2026-07-20
- Author: agent
- Subsystems: Development Toolkit / CI tooling (Active); Startup Validation (Frozen — untouched)
- Task / Reason: Upgrade AI-032 from direct-import bans to transitive reachability with import chains and suggested fixes.
- Files: `scripts/architecture-guard/rules.ts`, `scripts/architecture-guard/cli.ts`, `tests/unit/architecture-guard.test.ts`, `docs/ARCHITECTURAL_INVARIANTS.md` (AI-032 v2), this entry
- Business rules changed: None
- APIs changed: None
- DB impact: None
- Tests: architecture-guard unit tests extended (transitive chain, type-only domain, domain purity, suggested fixes)
- Docs updated: `ARCHITECTURAL_INVARIANTS.md` — Browser Safety Contract v2 (levels 1–4, domain purity, roadmap)
- Knowledge: No permanent knowledge introduced (enforcement model only)
- Verification: Code YES · Tests YES (154/154) · Runtime N/A (tooling) · Docs YES
- Rollback: revert this change — restores v1 Level-1-only guard behavior; no schema/data impact

---

## Change #021 — UI identity deduplication (header / dropdown / profile)

- Date: 2026-07-20
- Author: agent
- Subsystems: Layout / shared UI (Active)
- Task / Reason: First UI deduplication pass — header owns identity, dropdown actions-only, profile owns personal information.
- Files: `src/components/layout/header.tsx`, `src/components/layout/user-dropdown.tsx`, `src/app/(portal)/profile/page.tsx`
- Business rules changed: None
- APIs changed: None
- DB impact: None
- Tests: existing suite (no new tests)
- Docs updated: this entry only
- Knowledge: No permanent knowledge introduced
- Verification: Code YES · Tests pending · Runtime pending · Docs YES
- Known UI inconsistency (deferred): profile Security says "SSO in a later phase" — reconcile when auth architecture is confirmed with product.
- Rollback: revert commit — presentation only; no schema/data impact

---

## Change #020 — Browser Safety multi-layer enforcement (AI-032)

- Date: 2026-07-20
- Author: agent
- Subsystems: Development Toolkit (Active); Startup Validation (Frozen — untouched)
- Task / Reason: Enforce hard client/server architectural boundaries after `/admin` SQL driver leak via client imports.
- Files: `src/lib/shared/**`, `src/lib/client/**`, `src/lib/server/**`, `scripts/architecture-guard/**`, `scripts/browser-safety-check.ts`, `scripts/stamp-server-only.ts`, `.dependency-cruiser.cjs`, `.eslintrc.json`, `.github/workflows/architecture-guard.yml`, `vitest.config.ts`, `docs/ARCHITECTURAL_INVARIANTS.md` (AI-032, INV-28…31), `package.json`
- Business rules changed: None
- APIs changed: None
- DB impact: None
- Tests: `tests/unit/architecture-guard.test.ts` (4); vitest aliases for `server-only`/`client-only`
- Docs updated: `ARCHITECTURAL_INVARIANTS.md` — **AI-032 Browser Safety** architectural contract
- Knowledge: No permanent knowledge introduced (structural enforcement only)
- Verification: Code YES · Tests YES (150/150) · Runtime pending staging E2E · Docs YES
- Remaining risks: (1) Architecture Guard CLI is authoritative over ESLint for client boundary scans; (2) `src/lib/*` shims → migrate to `lib/shared`/`lib/client`; (3) browser pass `/login` → `/admin` → `/budgets` → `/finance` → `/reports` in staging E2E
- Rollback: revert commit — removes guards and `server-only` stamps; no schema/data impact

---


```
## Change #NNN — <short title>
- Date: YYYY-MM-DD
- Author:
- Subsystems: <name (Active|Frozen)>
- Task / Reason: <one sentence each>
- Files: <key files or globs>
- Business rules changed: <or None>
- APIs changed: <or None>
- DB impact: <migration id / None>
- Tests: <added/updated, or None>
- Docs updated: <or None>
- Knowledge: <K-NNN added/superseded, or "No permanent knowledge introduced">
- Verification: Code YES/NO · Tests YES/NO · Runtime YES/NO · Docs YES/NO
- Rollback: <e.g. revert commit — no schema migration, no data loss; or
  "requires migration NNN rollback script">
- Backward compatibility / risk: <or None>
```

---

## Change #019 — Docs accuracy: change→docs matrix, PR impact template, code headers, SYSTEM_DECISIONS
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: CI/docs-guard (Active); Governance docs (Active); Application/Domain/Repos/API (headers only). Startup Validation (Frozen): not touched.
- Task / Reason: Stop expanding reference docs; make the repo *tell* developers what must change, require PR impact answers, put context in code headers, and add one onboarding "why today" page — then pivot to product validation.

### Repository Impact
| Dimension | Value |
|---|---|
| Files modified | Docs Guard rules/tests; governance matrix; application/domain/repo/API headers; indexes |
| Files added | `.github/PULL_REQUEST_TEMPLATE.md`, `docs/SYSTEM_DECISIONS.md` |
| Public APIs / schema / BR / permissions | No behavioral change (comments + process only) |
| Tests | docs-guard.test.ts rewritten (25 cases) |

- Docs Guard now detects subsystems more precisely: application/UI/API → WORKFLOWS; domain → BUSINESS_RULES; approval/finance cores → **both**; notifications surface → KNOWLEDGE_LOG; `di.ts` → DEPENDENCY_MAP; plus existing CHANGE_HISTORY / DATABASE / ENGINEERING_BRAIN / release-note rules.
- PR template forces YES/NO answers for BR / WF / DB / K / ADR + doc checklist.
- Responsibility headers on application services, key domain modules, repository modules, and major workflow API routes.
- Verification: Code YES · Tests YES (25/25 docs-guard) · Runtime NO (headers/docs only) · Docs YES
- Rollback: revert commit — removes template/SYSTEM_DECISIONS and restores prior guard rules; no schema impact
- Knowledge: No permanent product knowledge introduced (process/accuracy only)

## Change #018 — Docs Guard stage 2 + RELEASE_CHECKLIST + DEPENDENCY_MAP
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: CI / repo tooling (Active); Governance docs (Active). No runtime/product code touched. Startup Validation (Frozen): not touched.
- Task / Reason: Close the last three documentation-process gaps — extend the Docs Guard beyond file co-changes to long-term memory, add a runnable release runbook, and add a thin wiring map — so code changes cannot drift from engineering knowledge and releases follow a fixed gate.

### Repository Impact
| Dimension | Value |
|---|---|
| Files modified | 6 (`scripts/docs-guard/rules.ts`, `scripts/docs-guard/cli.ts`, `.github/workflows/docs-guard.yml`, `tests/unit/docs-guard.test.ts`, `docs/ENGINEERING_GOVERNANCE.md`, `docs/ENGINEERING_BRAIN.md`) + `docs/FILE_INDEX.md`, `docs/CHANGE_HISTORY.md` |
| Files added | 2 (`docs/RELEASE_CHECKLIST.md`, `docs/DEPENDENCY_MAP.md`) |
| Files deleted | 0 |
| Public APIs changed | No |
| Database schema changed | No |
| Business rules changed | No (process/tooling only) |
| Permissions changed | No |
| Configuration changed | Yes — Docs Guard workflow now passes `DOCS_GUARD_BRANCH` (`github.head_ref`) |
| ADR updated | No |
| Knowledge Log updated | No |
| Tests added | 10 (`docs-guard.test.ts` now 24 total, all passing) |
| Documentation updated | 5 |

- Docs Guard stage 2: added rule `knowledge-log` (`src/domain/**` change → `docs/KNOWLEDGE_LOG.md`, waiver `[no-knowledge-change]`) and rule `release-note` (branch `feature|bugfix|hotfix/*` → a per-branch note under `docs/release-notes/`, waiver `[no-release-note]`). `cli.ts` resolves branch from `DOCS_GUARD_BRANCH` then `git rev-parse --abbrev-ref HEAD`; the input type gained optional `branchName` (backward-compatible — existing callers unaffected).
- `RELEASE_CHECKLIST.md`: runnable Gate A (branch→develop: lint/test/build/docs:check, migrations, doc-matrix, e2e proof) and Gate B (develop→main: staging E2E, UAT, backup+restore, tag/version). Links out; restates no policy.
- `DEPENDENCY_MAP.md`: thin DI/import graph only — layer direction, forbidden edges, the `di.ts` composition root, service→service edges (`budgetPlan→approval`, `dashboard→budgetPlan`, `devToolkit→fiscalYear`, all→authorization), and the `uow` edge. Verified against `src/infrastructure/di.ts`.
- Verification: Code YES · Tests YES (24/24 pass) · Runtime YES (unit) · **CI runtime on GitHub: Pending first PR** · Docs YES
- Rollback: revert commit — deletes the 2 new docs, reverts the 2 new guard rules + tests + doc wiring; no schema/runtime impact
- Known limitations: the release-note rule keys off a changed file under `docs/release-notes/` (not semantic quality); the knowledge-log rule fires on any `src/domain/**` change, so trivial domain edits need the `[no-knowledge-change]` waiver.

## Change #017 — Docs Guard: CI enforcement of the documentation-update matrix
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: CI / repo tooling (new, Active); Governance docs (Active). No runtime/product code touched. Startup Validation (Frozen): not touched.
- Task / Reason: Make the documentation-update matrix enforceable instead of advisory — a PR now fails CI when required docs aren't updated, removing reliance on memory.

### Repository Impact
| Dimension | Value |
|---|---|
| Files modified | 4 (`package.json` `docs:check` script; `docs/ENGINEERING_GOVERNANCE.md` enforcement table; `docs/FILE_INDEX.md`; `docs/CHANGE_HISTORY.md`) |
| Files added | 4 (`scripts/docs-guard/rules.ts`, `scripts/docs-guard/cli.ts`, `tests/unit/docs-guard.test.ts`, `.github/workflows/docs-guard.yml`) |
| Files deleted | 0 |
| Public APIs changed | No |
| Database schema changed | No |
| Business rules changed | No (process enforcement only) |
| Permissions changed | No |
| Configuration changed | Yes — new GitHub Actions workflow (PRs into develop/main) |
| ADR updated | No |
| Knowledge Log updated | No |
| Tests added | 14 (`docs-guard.test.ts`, all passing) |
| Documentation updated | 3 |

- Rules enforced: (1) every PR requires a `CHANGE_HISTORY.md` entry (waiver `[non-functional]`); (2) `src/application/**`/`src/domain/**` change requires `WORKFLOWS.md` or `BUSINESS_RULES.md` (waiver `[no-behavior-change]`); (3) migrations/`schema.sql` require `DATABASE.md` (waiver `[no-schema-change]`); (4) `.env.example`/`next.config.js`/`src/middleware.ts` require `ENGINEERING_BRAIN.md` (waiver `[no-architecture-change]`). Waivers live in PR title/body/commit messages — visible and audited in review.
- Design: pure rule engine (`rules.ts`, no I/O) unit-tested separately from git plumbing (`cli.ts` — merge-base diff + commit-message markers). Workflow installs only `tsx` (avoids the native `msnodesqlv8` build in CI).
- Verification: Code YES · Tests YES (14/14 pass) · Runtime YES (CLI smoke-tested against real commit ranges: empty diff → PASS; 17-file range → PASS) · **CI runtime on GitHub: Pending first PR** · Docs YES
- Rollback: revert commit — deletes the workflow + scripts + test; no schema/runtime impact
- Known limitations: the guard detects *file co-changes*, not semantic correctness — a token doc edit satisfies it; review remains the semantic gate. First live GitHub Actions execution still to be observed.

## Change #016 — WORKFLOWS.md: transaction boundaries, dependency matrix, failure injection
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Documentation only. No code touched. All product subsystems (incl. Startup Validation Frozen) unaffected.
- Task / Reason: Add the remaining maintainability layers requested — verified transaction boundary + repository chain, workflow dependency matrix, failure-injection ("what if SQL dies here?"), DB-objects-by-workflow matrix, complexity/risk/change-frequency heat-map, a top-of-file Living Documentation Rule, business-rule lifecycle/history linkage, and explicit rejected-alternative rationale for Finance-cannot-reject.

### Repository Impact
| Dimension | Value |
|---|---|
| Files modified | 3 (`docs/WORKFLOWS.md`, `docs/BUSINESS_RULES.md`, `docs/CHANGE_HISTORY.md`) |
| Files added | 0 |
| Files deleted | 0 |
| Public APIs changed | No |
| Database schema changed | No |
| Business rules changed | No (added lifecycle/history guidance; no rule meaning changed) |
| Permissions changed | No |
| Configuration changed | No |
| ADR updated | No |
| Knowledge Log updated | No (references K-001..K-009) |
| Tests added/updated | None |
| Documentation updated | 3 |

- **Code-verified transaction facts (evidence rule):** confirmed all mutating services wrap work in `uow.runInTransaction` (`approval/finance/budget-plan/fiscal-year/admin-user/master-data/support-issue/development-toolkit`); `SqlUnitOfWork` (`sql/index.ts:1232`) uses AsyncLocalStorage + commit-after-callback so **AuditLogs + Notifications are written INSIDE the transaction** (via `sql/request.ts:sqlRequest`), rolling back together on any throw; **`MockUnitOfWork` has no real rollback** (`mock/index.ts:548`) — documented as a driver caveat. There is **no separate controller layer** — the Next.js route handler is the controller.
- Additions (WORKFLOWS.md): Living Documentation Rule (top), §1a dependency matrix, §1b complexity/risk/change-frequency, Baseline T (transaction boundary + repo chain), Baseline FI (failure injection table), enhanced §18a DB-objects matrix, WF-005 rejected-alternative bullets. BUSINESS_RULES.md: "Rule lifecycle & history" linking ADR (introduced) + CHANGE_HISTORY (modified) + supersession.
- Honesty: complexity/risk ratings labeled engineering judgment (no incident data); metrics still UNKNOWN; mock non-atomicity called out.
- Verification: Code YES (transaction/UoW/repo-chain inspected) · Tests n/a · Runtime n/a · Docs YES
- Rollback: revert this commit — no code/schema/runtime impact
- Known limitations: point-in-time snapshot; maintained per the Living Documentation Rule + doc-update matrix.

## Change #015 — WORKFLOWS.md depth pass: WF-IDs + ops dimensions
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Documentation only. No code touched. All product subsystems (incl. Startup Validation Frozen) unaffected.
- Task / Reason: Add the maintenance-critical dimensions requested — stable **WF-IDs** (WF-001..WF-020) so references never break, plus per-workflow decision rationale (why), permission matrix (allowed/denied), performance envelope, concurrency, security, observability, rollback **scope** (DB/App/Notifications/Audit/Impossible), failure **ownership**, recovery scenarios, cross-workflow refs, version headers, checklists (Dev/QA/UAT), and Mermaid diagrams alongside ASCII.

### Repository Impact
| Dimension | Value |
|---|---|
| Files modified | 5 (`docs/WORKFLOWS.md` rewrite; `docs/BUSINESS_RULES.md`, `docs/DATABASE.md`, `docs/ENGINEERING_BRAIN.md` cross-ref fixes; `docs/CHANGE_HISTORY.md`) |
| Files added | 0 |
| Files deleted | 0 |
| Public APIs changed | No |
| Database schema changed | No |
| Business rules changed | No (referenced only) |
| Permissions changed | No |
| Configuration changed | No |
| ADR updated | No |
| Knowledge Log updated | No (references K-001..K-009) |
| Tests added/updated | None |
| Documentation updated | 5 |

- Stable IDs: introduced a WF registry (WF-001..WF-020); converted all inbound cross-references from section numbers to WF-IDs (`BUSINESS_RULES` BR-32/flagged, `DATABASE` Notifications/SapPackages, `ENGINEERING_BRAIN` §1/§notifications/§17) so future section renumbering can't break links.
- Shared baselines (entropy control): Security / Observability / Performance / Resilience-recovery / Rollback-principle / Checklists documented **once** in §2; each WF states only its delta.
- Honesty (evidence rule): confirmed `409 BUDGET_CONFLICT` is the real concurrency code (`concurrency-error.ts`); **no APM/metrics tooling exists** (only `sql/pool.ts` diagnostics) so metrics marked UNKNOWN and response-time "targets" labeled unmeasured design conventions (Baseline P); finance-escalation scheduler marked UNKNOWN; `fiscal-year-service.test.ts` gap marked. Re-surfaced (unchanged) the two flagged smells: WF-018 stale `Approved` gate, WF-012 missing `AuditLogs`.
- Verification: Code n/a · Tests n/a · Runtime n/a · Docs YES (paths/tests/BR-ids/error-codes cross-checked against repo)
- Rollback: revert this commit — restores prior `WORKFLOWS.md` + cross-refs; no code/schema/runtime impact
- Known limitations: point-in-time snapshot; per ADR-013 + doc-update matrix it tracks future workflow/data-path changes.

## Change #014 — WORKFLOWS.md rebuilt as the operational manual
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Documentation only. No code touched. All product subsystems (incl. Startup Validation Frozen) unaffected.
- Task / Reason: Deepen `WORKFLOWS.md` from a compact reference into a 20-section operational manual so a developer can trace any workflow UI→API→service→domain→repo→tables→audit→notifications→failure→tests without reading code. Adds a standardized per-workflow template, ASCII sequence diagrams + state machines, negative cases, recovery, timing, rollback, ownership, and a workflow dependency map.

### Repository Impact
| Dimension | Value |
|---|---|
| Files modified | 2 (`docs/WORKFLOWS.md` full rewrite; `docs/CHANGE_HISTORY.md`) |
| Files added | 0 |
| Files deleted | 0 |
| Public APIs changed | No |
| Database schema changed | No |
| Business rules changed | No (referenced existing BR-01..50; none restated/changed) |
| Permissions changed | No |
| Configuration changed | No |
| ADR updated | No |
| Knowledge Log updated | No (references K-001..K-009) |
| Tests added/updated | None |
| Documentation updated | 2 |

- Evidence basis: verified real API paths (`/api/v1/budget-plans/[id]/...`, `/api/v1/notifications` GET/POST/DELETE), actual test filenames (`tests/unit/*.test.ts` + `scripts/e2e-notification-spine.ts`), and BR ids against `BUSINESS_RULES.md`. Corrected earlier `/api/v1/budgets/{id}` shorthand to the real `[id]` routes.
- Entropy control: rules/tables/APIs are **referenced** (canonical: `BUSINESS_RULES.md`, `DATABASE.md`, `state-machines.md`, `ARCHITECTURAL_INVARIANTS.md`), not restated.
- Honesty notes: marked UNKNOWNs (no dedicated `fiscal-year-service.test.ts`; finance-escalation scheduler unconfirmed; exact per-action transaction boundaries to verify in `sql/index.ts`). Re-surfaced the two flagged code smells (§16): `/sap-export` stale `Approved` gate and `createAmendment` missing `AuditLogs` — unchanged, still need a stakeholder decision (`ENGINEERING_BRAIN.md` §17).
- Verification: Code n/a · Tests n/a · Runtime n/a · Docs YES (paths/tests/BR-ids cross-checked against repo)
- Rollback: revert this commit — restores the previous `WORKFLOWS.md`; no code/schema/runtime impact
- Known limitations: point-in-time snapshot; per ADR-013 + the doc-update matrix it must track future workflow/data-path changes.

## Change #013 — Engineering Brain: knowledge companions + doc-update matrix
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Documentation only. No code touched. All product subsystems (incl. Startup Validation Frozen) unaffected.
- Task / Reason: Complete the "understand this system years later without asking me" goal by adding the remaining knowledge documents and, critically, making documentation updates a Definition-of-Done requirement so docs evolve with code instead of drifting.

### Repository Impact
| Dimension | Value |
|---|---|
| Files modified | 4 (`docs/ENGINEERING_BRAIN.md` §16, `docs/ENGINEERING_GOVERNANCE.md` layers + doc-update matrix, `docs/definition-of-done.md`, `docs/FILE_INDEX.md`) |
| Files added | 8 (`ARCHITECTURAL_INVARIANTS.md`, `DOMAIN_GLOSSARY.md`, `REJECTED_DECISIONS.md`, `SYSTEM_HISTORY.md`, `DATA_FLOW.md`, `TROUBLESHOOTING.md`, `WHY_SQL_SERVER.md`, `FEATURE_REGISTRY.md`) |
| Files deleted | 0 |
| Public APIs changed | No |
| Database schema changed | No |
| Business rules changed | No (documented existing rules only) |
| Permissions changed | No |
| Configuration changed | No |
| ADR updated | No |
| Knowledge Log updated | No (references existing K-001…K-009) |
| Tests added/updated | None |
| Documentation updated | 12 total (8 new + 4 edited) |

- Entropy control: each new doc has a single responsibility and *references* the canonical owner instead of restating facts (e.g. `ARCHITECTURAL_INVARIANTS.md` points to BR/K/ADR; `WHY_SQL_SERVER.md` explains ADR-009/011; `FEATURE_REGISTRY.md` links `feature-e2e-proof.md`). The doc-update matrix (in `ENGINEERING_GOVERNANCE.md` + `ENGINEERING_BRAIN.md` §16, enforced via `definition-of-done.md`) now names one owner per fact-type.
- Honesty notes: `SYSTEM_HISTORY.md` phases are derived from ADR dates + migration order + CHANGE_HISTORY (no release tags cut yet; version 0.1.0). `FEATURE_REGISTRY.md` uses an evidence-based status vocabulary (Code+Unit / Service-verified / Browser-pending / Deferred) — no "Complete/Production-ready" claims. Flagged code smells and the Western Region contradiction re-surfaced (unchanged; still need stakeholder decision — `ENGINEERING_BRAIN.md` §17).
- Verification: Code n/a · Tests n/a · Application Service Runtime n/a · Docs YES (evidence-cited, cross-checked against ADRs/K-entries/existing docs)
- Rollback: delete the 8 new docs + revert the 4 edits — no code/schema/runtime impact
- Known limitations: docs are a point-in-time snapshot; per ADR-013 + the new matrix they must be updated alongside future behavior changes. UNKNOWNs remain listed (import-boundary lint rule; Windows-auth usage in prod; test-coverage gate).

## Change #012 — Engineering Brain: two-layer knowledge base
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Documentation only. No code touched. All product subsystems (incl. Startup Validation Frozen) unaffected.
- Task / Reason: Create a permanent "engineering brain" so any future engineer/AI can understand the system without reverse-engineering it. Split into an executive guide + detailed reference companions rather than one monolith.

### Repository Impact
| Dimension | Value |
|---|---|
| Files modified | 2 (`docs/ENGINEERING_GOVERNANCE.md` governance-layers table; `docs/CHANGE_HISTORY.md`) |
| Files added | 5 (`docs/ENGINEERING_BRAIN.md`, `docs/FILE_INDEX.md`, `docs/WORKFLOWS.md`, `docs/DATABASE.md`, `docs/BUSINESS_RULES.md`) |
| Files deleted | 0 |
| Public APIs changed | No |
| Database schema changed | No |
| Business rules changed | No (documented existing rules only) |
| Permissions changed | No |
| Configuration changed | No |
| ADR updated | No |
| Knowledge Log updated | No (references existing K-001…K-009) |
| Tests added/updated | None |
| Documentation updated | 7 total |

- Approach: gathered evidence via repo exploration (file inventory, full schema, all 12 workflows) cross-checked against `domain-model.md`, `state-machines.md`, `permission-matrix.md`, ADRs, and `KNOWLEDGE_LOG.md`. Every claim cites file/symbol or ADR/K-entry; unprovable items marked UNKNOWN. Deliberately did NOT create a competing `DECISION_HISTORY.md` (ADRs own that job).
- Contradictions surfaced (not resolved — need stakeholder decision): (1) `open-decisions.md` still lists a "Western Region" seed user as in-scope, contradicting `.cursor/rules/feature-e2e-proof.mdc` and stakeholder direction. (2) Flagged code smells: `/sap-export` gates on deprecated `Approved`; `createAmendment` writes WorkflowHistory but no AuditLogs row. Recorded in `ENGINEERING_BRAIN.md` §17.
- Verification: Code n/a · Tests n/a · Application Service Runtime n/a · Docs YES (evidence-cited, cross-checked against canonical docs)
- Rollback: delete the 5 new docs + revert the 2 edits — no code/schema/runtime impact
- Known limitations: docs are a point-in-time snapshot; per ADR-013 they must be updated alongside future behavior changes. Several UNKNOWNs remain listed for verification.

## Change #011 — Bell dropdown, duplicate-task guard, approval deep-link
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Notification Engine (Active), Approval Engine (Active — targetUrl string only, no workflow/state change), Presentation (Active). Startup Validation (Frozen): not touched.
- Task / Reason: Close the three gaps against the notification-task spec: (1) header bell now opens a dropdown of active tasks (click = read + navigate, never resolves; badge counts unresolved per K-001); (2) repositories atomically refuse a second ACTIVE notification for the same task (K-009); (3) Approval notifications deep-link to `/budgets/{id}?action=approve` and the budget page scrolls to / highlights the Decision panel for the pending approver.

### Repository Impact
| Dimension | Value |
|---|---|
| Files modified | 8 |
| Files added | 2 |
| Files deleted | 0 |
| Public APIs changed | No (notification `targetUrl` string gains a query param; no route/contract change) |
| Database schema changed | No (dedup is a query-level guard, no migration) |
| Business rules changed | No (no workflow/permission/status-machine change) |
| Permissions changed | No |
| Configuration changed | No |
| ADR updated | No |
| Knowledge Log updated | K-009 added |
| Tests added | 7 (`notification-dedup.test.ts`) |
| Tests updated | Harness (`e2e-notification-spine.ts`) — deep-link expectations + SQL dedup check |
| Documentation updated | 5 files |

- Files modified: `src/components/layout/header.tsx`, `src/components/layout/app-shell.tsx`, `src/infrastructure/repositories/sql/index.ts`, `src/infrastructure/repositories/mock/index.ts`, `src/application/approval-service.ts`, `src/app/(portal)/budgets/[id]/page.tsx`, `scripts/e2e-notification-spine.ts`, plus doc files
- Files added: `src/components/layout/notification-bell.tsx`, `tests/unit/notification-dedup.test.ts`
- Docs updated (filenames): `CHANGELOG.md`, `docs/CHANGE_HISTORY.md`, `docs/feature-e2e-proof.md`, `docs/domain-model.md`, `docs/KNOWLEDGE_LOG.md`
- Knowledge: K-009 added (supports existing K-001)
- Verification: Code YES · Tests YES (121 unit + 62 harness) · **Application Service Runtime YES** (local SQL harness) · **Browser Runtime: Pending** (staging matrix) · Docs YES
- Rollback: revert commit — no schema migration, no data loss

### Known limitations
- **Historical duplicates remain.** Reason: no cleanup migration requested. Impact: none for new notifications (guard prevents all new duplicates). Future recommendation: an optional cleanup migration if historical duplicate removal becomes a business requirement.
- **Backward compatibility:** Approval notifications created before this change keep plain `/budgets/{id}` URLs — still valid, they simply skip the Decision-panel focus.

## Change #010 — Isolate E2E teardown; add FinanceQueueClaims verification
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Development Toolkit / E2E tooling (Active). Startup Validation (Frozen): not touched.
- Task / Reason: Isolate DISABLE TRIGGER into a single auditable module; verify FinanceQueueClaims across claim/release/finalize; prove the cleaner re-enables triggers even on failure; correct service-level wording (not "whole system proven").
- Files: `scripts/lib/test-database-cleaner.ts` (new — sole authorized trigger-disable site), `scripts/e2e-notification-spine.ts` (adds FinanceQueueClaims checks + cleaner leak-proof precheck), `scripts/seed-sql.ts` (delegates wipe to cleaner), `docs/staging-e2e-acceptance.md` (explicit service-layer scope; count no longer hardcoded), `docs/CHANGE_HISTORY.md`
- Business rules changed: No
- APIs changed: None
- DB impact: None
- Tests: Harness now asserts FinanceQueueClaims active-claim invariant; wording = "automated service-level checks … local SQL environment"
- Docs updated: `docs/staging-e2e-acceptance.md`
- Knowledge: No permanent knowledge introduced
- Verification: Code YES · Tests YES (re-run harness) · Runtime YES · Docs YES
- Rollback: revert commit — removes cleaner; restore inline teardown in harness/seed if needed
- Backward compatibility / risk: None — scripts only

## Change #009 — Local SQL E2E harness for the notification task spine
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Approval Engine (Active), Finance Workflow (Active), Notification Engine (Active). Startup Validation (Frozen): not touched.
- Task / Reason: Execute the critical workflow spine + notification task model on local SQL first (before staging), driving the real application service layer with DB-level verification after each transition.
- Files: `scripts/e2e-notification-spine.ts` (new), `package.json` (`e2e:spine` script), `docs/staging-e2e-acceptance.md` (Local SQL pre-staging Step 0 section)
- Business rules changed: No
- APIs changed: None
- DB impact: None (harness is self-cleaning via TestDatabaseCleaner as of Change #010)
- Tests: Reproducible service-layer harness against local SQL (not a vitest unit test)
- Docs updated: `docs/staging-e2e-acceptance.md`
- Knowledge: No permanent knowledge introduced (re-verifies K-001 notification lifecycle against runtime; no new fact)
- Verification: Code YES · Tests YES (automated service-level checks vs live local SQL) · Runtime YES · Docs YES
- Rollback: revert commit — deletes harness and `e2e:spine` script; no schema migration, no data loss
- Backward compatibility / risk: None — additive script; does not run in app runtime or CI

---

## Change #008 — Notification click→read→destination verified
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Notification Engine (Active)
- Task / Reason: Close feature-e2e-proof gap for notification task lifecycle (point 10): extract shared read/destination actions and add unit coverage for click→read≠resolve + portal targetUrls.
- Files: `src/application/notification-task-actions.ts` (new), `src/app/api/v1/notifications/route.ts`, `src/app/(portal)/notifications/page.tsx`, `tests/unit/notification-read-lifecycle.test.ts` (new), `docs/feature-e2e-proof.md`, `docs/KNOWLEDGE_LOG.md` (K-001 re-verified)
- Business Rules Changed: No
- APIs changed: None (behavior unchanged; route delegates to shared helpers)
- DB impact: None
- Tests: `notification-read-lifecycle.test.ts` (5 cases)
- Docs updated: feature-e2e-proof (Notification → COMPLETE), K-001 evidence
- Knowledge: No permanent knowledge introduced (K-001 re-verified, not superseded)
- Verification: Code YES · Tests YES · Runtime NO · Docs YES
- Rollback: revert commit — no schema migration, no data loss, no business-rule changes
- Backward compatibility / risk: None. Browser/staging evidence for points 11–12 still required in staging matrix.

## Change #007 — Evidence links + explicit Business Rules Changed
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Governance (docs/process) — no runtime code
- Task / Reason: Quality-control polish on existing governance only: Proof of Reading must cite verified-against files (not bare ✓ K-ids); every report must answer Business Rules Changed (No | Yes + BR ids). No new governance documents — next improvements are CI automation and product quality.
- Files: `docs/ENGINEERING_GOVERNANCE.md`, `.cursor/rules/engineering-governance.mdc`
- Business Rules Changed: No
- APIs changed: None
- DB impact: None
- Tests: None (docs/process)
- Docs updated: ENGINEERING_GOVERNANCE §4b + Changed Business Rules; rule report format
- Knowledge: No permanent knowledge introduced
- Verification: Code N/A · Tests N/A · Runtime N/A · Docs YES
- Rollback: revert commit — no schema migration, no data loss, no business-rule changes
- Backward compatibility / risk: None. Governance expansion stops here; next work is staging E2E / UAT / release.

## Change #006 — Contradiction detector + evidence-hardening of governance
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Governance (docs/process) — no runtime code
- Task / Reason: Close the "AI silently fixes architecture" gap: mandatory Contradiction Detector (STOP protocol), Proof of Reading (named K/ADR entries), Verified split by level (Code/Tests/Runtime/Docs), immutable Knowledge IDs (supersede like ADRs), Repository Health footer, evidence-based confidence, rollback plan per change, knowledge coverage check.
- Files: `docs/ENGINEERING_GOVERNANCE.md`, `docs/KNOWLEDGE_LOG.md`, `.cursor/rules/engineering-governance.mdc`, `docs/CHANGE_HISTORY.md` (template)
- Business rules changed: None (process only)
- APIs changed: None
- DB impact: None
- Tests: None (docs/process)
- Docs updated: governance, knowledge log header/template, change-history template
- Knowledge: No permanent business knowledge introduced (process rules only)
- Verification: Code N/A · Tests N/A · Runtime N/A · Docs YES (cross-references reviewed)
- Rollback: revert commit — no schema migration, no data loss, no business-rule changes
- Backward compatibility / risk: None.

## Change #005 — Knowledge Log + truthfulness/evidence governance
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Governance (docs/process) — no runtime code
- Task / Reason: Add operational memory (canonical facts) and enforce truthfulness/evidence, source-of-truth priority, full impact analysis, scope-creep detection, and confidence scoring so future sessions don't re-derive or contradict decisions.
- Files: `docs/KNOWLEDGE_LOG.md` (new, K-001..K-008), `docs/ENGINEERING_GOVERNANCE.md`, `.cursor/rules/engineering-governance.mdc`
- Business rules changed: None (facts recorded, not changed; verified against code-synced docs)
- APIs changed: None
- DB impact: None
- Tests: None (docs/process)
- Docs updated: KNOWLEDGE_LOG (created), ENGINEERING_GOVERNANCE (truthfulness/evidence + governance-layers), rule
- Verification: [x] doc links/consistency reviewed [x] facts traced to cited code symbols/docs [x] no runtime artifacts changed
- Backward compatibility / risk: None. K-entries are "Verified via code-synced doc" except K-007 (verified in code); re-verify against raw source when convenient.

## Change #004 — Subsystem governance + change-memory policy
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Governance (docs/process) — no runtime code
- Task / Reason: Establish persistent project memory and evidence rules so future sessions reconstruct reasoning from the repo, not chat.
- Files: `docs/CHANGE_HISTORY.md` (new), `docs/ENGINEERING_GOVERNANCE.md`, `.cursor/rules/frozen-subsystems.mdc`, `.cursor/rules/engineering-governance.mdc` (new)
- Business rules changed: None (process only)
- APIs changed: None
- DB impact: None
- Tests: None (docs/process)
- Docs updated: ENGINEERING_GOVERNANCE (new policy section), CHANGE_HISTORY (created)
- Verification: [x] doc links/consistency reviewed [x] no runtime artifacts changed
- Backward compatibility / risk: None.

## Change #003 — Client/edge bundling fix for native SQL driver
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Startup Validation (**Frozen**) — verified bug + regression fix
- Task / Reason: `msnodesqlv8` native module was pulled into browser/edge bundles (route 404s, webpack fallback 500s); `next build` also failed on a `node:child_process` URI in the edge compiler.
- Files: `next.config.js` (webpack alias for client + edge), `src/instrumentation.ts` (bare `child_process` specifier)
- Business rules changed: None
- APIs changed: None
- DB impact: None
- Tests: existing suite (109) re-run
- Docs updated: `CHANGELOG.md`, ADR-009
- Verification: [x] lint [x] build [x] tests [x] manual (login 200 / portal pages redirect; no native-module or fallback errors on startup or navigation)
- Backward compatibility / risk: None. Justification: verified bug (browser error) + build regression.

## Change #002 — Startup report hardening + FROZEN
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Startup Validation (now **Frozen**)
- Task / Reason: Make the startup report answer "can this app safely serve requests?" — explicit fallback wording, git commit/branch, phase timings, per-repository smoke reads, column-level schema verification, DI usability checks, pool state, checks/warnings/failures summary; then freeze.
- Files: `src/infrastructure/startup/**`, `src/instrumentation.ts`, `src/app/api/v1/system/database-health/route.ts`, `tests/unit/startup-env.test.ts`
- Business rules changed: None
- APIs changed: `/api/v1/system/database-health` now authenticated diagnostics (bare status when unauthenticated)
- DB impact: None (reads only)
- Tests: `startup-env.test.ts` expanded
- Docs updated: `CHANGELOG.md`, ADR-009 (Subsystem status: FROZEN)
- Verification: [x] lint [x] build [x] tests [x] manual (live startup report)
- Backward compatibility / risk: None.

## Change #001 — Startup fail-fast, schema versioning, task notifications
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Startup Validation, Notification Engine (Active)
- Task / Reason: Root-caused false 401s (schema/code drift masked as auth failure); added required `REPOSITORY_DRIVER`, `dbo.SchemaVersion` + migration registry, startup validation via `instrumentation.ts`; reworked notifications into a task/to-do model.
- Files: `src/infrastructure/di.ts`, `src/infrastructure/startup/env.ts`, `src/infrastructure/migrations/registry.ts`, `docs/migrations/010-012*.sql`, notification services/repos/UI
- Business rules changed: Notifications resolve on workflow completion, not on read (see `docs/domain-model.md`)
- APIs changed: `/api/v1/notifications` (active/history, readAll, archive), `/api/v1/me` (500 vs 401 separation)
- DB impact: migrations 010, 011, 012
- Tests: notification + startup unit tests
- Docs updated: `CHANGELOG.md`, ADR-009, `domain-model.md`, `feature-e2e-proof.md`
- Verification: [x] lint [x] build [x] tests [x] manual
- Backward compatibility / risk: Existing notifications migrated with `ResolvedAt = NULL`.

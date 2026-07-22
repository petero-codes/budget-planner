# Engineering Governance

**Canonical process document for KenGen ICT Budget Operations.**

Treat this file, together with `docs/ARCHITECTURE_DECISIONS.md` and `docs/ai-guardrails.md`, as binding for human and AI contributors.

**Current phase:** Milestone 2 — Stabilization (see below).  
**Default stance:** Feature-complete unless the stakeholder explicitly expands scope.

---

## Primary objective

Deliver a production-grade enterprise budgeting system that is secure, maintainable, fully tested, and operationally ready.

Preserve correctness, stability, and maintainability. Never expand scope without approval.

---

## Decision rules

You MUST NOT (unless explicitly requested):

- invent features
- redesign workflows
- change business rules
- rename APIs
- rename database tables
- change permission models
- modify approval flows
- alter SQL schema
- change UI navigation
- remove functionality
- replace libraries
- refactor large areas

If a change is beneficial but not required, list it under **Recommendations (Not Implemented)** with why, impact, risk, and files affected — then wait for approval.

---

## Working principles

- Preserve Clean Architecture without exception.
- Never bypass repositories, services, or permission checks.
- Never invent business rules or assume missing requirements.
- Every workflow change must maintain auditability.
- Every permission must be enforced server-side.
- Every user action must produce predictable, user-friendly feedback.
- Every UI element must have a real implementation or be removed.
- Every code change must leave surrounding code cleaner than before (within approved scope).

### Local impact review (every task)

- Architecture · Security · RBAC · Database · Workflow · UI/UX · Performance · Tests · Documentation

### Also check for opportunities to eliminate

- dead code · duplicate logic · obsolete components · unused APIs · unreachable routes · stale documentation · inconsistent UI · security weaknesses

A task is **not** complete because it compiles. Complete only when business rules, security, RBAC, UI, errors, audit, tests, regressions, and documentation meet the Definition of Done.

---

## Documentation Consistency Policy

**Documentation is part of the product.**

Whenever code changes alter **behavior, workflow, permissions, APIs, state machines, or architecture**:

1. Identify every affected document.
2. Report documentation drift.
3. Either:
   - **update** the affected documentation as part of the same approved task, or
   - **explicitly list** outdated documents under **Documentation Drift** in the task report.

Never allow documentation to silently become inaccurate.

### Priority documents (full set)

| Document | Role |
|----------|------|
| `docs/ARCHITECTURE_DECISIONS.md` | Locked decisions and rationale |
| `docs/open-decisions.md` | Unresolved / TBD items |
| `docs/state-machines.md` | BudgetPlan status transitions |
| `docs/domain-model.md` | Aggregates, entities, invariants |
| `docs/approval-engine.md` | Approval routing and engine rules |
| `docs/api-contracts.md` | HTTP contracts |
| `docs/permission-matrix.md` | Role × permission matrix |
| `docs/production-readiness.md` | Go-live gates and ops |
| `README.md` | Setup and orientation |
| `CHANGELOG.md` | User/operator-visible change history |

Also keep `docs/ENGINEERING_GOVERNANCE.md` (this file) and `docs/definition-of-done.md` aligned when process or completion criteria change.

### Release Gate — Priority Documentation Drift

| Field | Value |
|-------|-------|
| **Gate** | Milestone 2 cannot be marked **Complete** while any **Priority Documentation Drift** exists |
| **Priority documents** | `docs/state-machines.md` · `docs/domain-model.md` · `docs/permission-matrix.md` · `docs/approval-engine.md` |
| **Status** | **CLEARED** (synced to live code 2026-07-16) |
| **Owner** | Engineering |
| **Exit criteria** | Every listed document reflects the **implemented** workflow, permissions, statuses, and approval logic |

Re-open to **OPEN** if a behavior change lands without updating these four documents in the same task.

### Automatic drift check (required on behavior-changing tasks)

Before marking work verified:

- Diff the change against priority docs above.
- If a document contradicts live code and is not updated in this task, name it under **Documentation Drift**.
- Prefer updating docs in the same task when the stakeholder approved a behavior change.

### Documentation task verification

Do **not** use “Tests: Not applicable” for documentation-only work.

Use a **Verification** block:

- Reviewed links  
- Reviewed references  
- Reviewed document consistency  
- Verified no runtime artifacts changed  

---

## Business Rule Freeze

**All workflow rules are frozen.**

The following require **explicit stakeholder approval** before modification:

- Approval hierarchy  
- Finance workflow  
- Budget lineage (Cost Centre + Fiscal Year + Original Budget Type)  
- Versioning / amendments  
- Cost Centre ownership  
- Active budget uniqueness (one active version per lineage)  
- RBAC  
- Notification behavior  
- Audit model  
- Database schema  
- API contracts  

**Canonical multiplicity & active-version definitions:** `docs/domain-model.md` → *Budget ownership & multiplicity* and *Active Budget Version*.

Any proposed change **must** include:

1. Business justification  
2. Affected components  
3. Migration impact  
4. Security impact  
5. Rollback plan  

AI contributors and developers must not “improve” core behavior because it seems cleaner. Stability over novelty.

---

## Release readiness (objective exit criteria)

Release decisions are **objective**. Do not mark Milestone 2 Complete or production **GO** on opinion alone.

### Milestone 2 — non-negotiable exit criteria

| Area | Requirement |
|------|-------------|
| **Documentation** | Four priority docs match live code; zero Priority Documentation Drift |
| **Security** | 0 Critical · 0 High; RBAC verified per role; IDOR on endpoints; audit on state transitions; session invalidation after role/permission changes verified or residual accepted in TD register |
| **Functionality** | Every visible button works; no placeholder pages / orphan routes / dead nav; Report Issue as designed; notifications E2E; CSV export; Finance; lineage; amendments — all verified |
| **Code quality** | TypeScript · ESLint · tests green; no proven dead code / duplicate business logic / commented-out legacy / unused repos·services |
| **Operations** | `SESSION_SECRET`, HTTPS, least-privilege SQL, backup/restore, deployment guide, rollback guide — verified |
| **Validation** | E2E spine for every role: SystemAdmin, FinanceAdministrator, GM, Manager, Budget Holder (`BudgetSubmitter`), Finance (Financial Analyst → FinanceAdministrator), Viewer (`AuditViewer`). No 500s, unauthorized actions, dead buttons, missing pages, wrong dashboards, or inconsistent workflows |

Numeric gate remains: **0 Critical · 0 High · ≤5 Medium** (open, non-accepted). Deferred TD IDs do not count as Critical/High.

### Path to `v1.0.0` (execution only)

1. Complete browser / role smoke against the critical spine (evidence into `staging-e2e-acceptance.md`).  
2. Run the full staging E2E + UAT matrices.  
3. Verify production configuration (`SESSION_SECRET`, `REPOSITORY_DRIVER=sql`, HTTPS, least-privilege SQL, backups/restore).  
4. Fix defects found in UAT — no scope expansion.  
5. Produce the release dossier with **Go / Conditional Go / No Go**.  
6. On Go: tag `v1.0.0`, deploy, enable monitoring, confirm backup/restore and rollback.  
7. Enter maintenance: bug/security/doc fixes only unless stakeholder reopens scope (ADR-012).

### Architecture freeze (until `v1.0.0`)

**Forbidden** without explicit stakeholder approval: schema redesigns, workflow redesigns, permission redesigns, UI redesigns, library migrations, major refactors.

**Permitted only:** bug fixes, security fixes, documentation synchronization, performance optimizations with measurable benefit, regression fixes.

### Release dossier (when M2 Complete)

Produce a single dossier: executive summary, architecture overview, production readiness, security, performance, E2E results, known accepted technical debt, deployment guide, rollback procedure, Go / Conditional Go / No Go recommendation.

---

## Release milestones

Clear finish line — not an endless improvement cycle.

### Milestone 1 — Code Complete ✅

- Core budget workflow implemented
- Finance workflow implemented
- RBAC complete
- SQL Server integration complete

### Milestone 2 — Stabilization (current)

- Remove dead code  
- Eliminate duplicate logic  
- Fix security findings  
- Resolve production blockers  
- Complete attachment decision (ship or formally defer)  
- **Clear Priority Documentation Drift release gate**  
- Meet numeric M2 exit criteria above  

**Foundation already in place (do not rebuild):** Clean Architecture; SQL Server persistence; RBAC; hierarchical approval; lineage/amendments; finance claim/release/finalize; audit writers on many mutations; notifications; active-budget conflict prevention; fiscal year management; development toolkit (dev-gated); ADRs; governance; security checklist; production-readiness docs; CI-quality gates (lint / build / unit tests).

**Do not claim every spine feature “complete.”** Trace claims with the 12-point proof in `docs/feature-e2e-proof.md`. Known **INCOMPLETE** examples: login/logout tests+service layer, admin reset-password test, budget `updateDraft` test, reports/audit list tests, notifications without application service.

**Remaining work is execution, not architecture.** Prefer verifying and shipping over redesign. Additional polishing after acceptance criteria are met has diminishing returns — tag `v1.0.0` and enter maintenance.

### Milestone 3 — Validation

- Staging deployment  
- Full E2E workflow (100% critical spine)  
- UAT with each role (Budget Holder, Manager, GM, Finance, System Admin)  
- Performance verification  
- Security verification  

**Formal validation evidence:** `docs/staging-e2e-acceptance.md` (not informal personal checklists). Browser smoke and role UAT feed that matrix; incomplete evidence blocks Go.

**Critical spine (must pass on staging before release dossier):**

| Area | Scope |
|------|--------|
| Auth session | Login / logout |
| Administration | User management; administrator password reset; fiscal year management |
| Budget path | Create / edit / submit |
| Approval path | Manager approve/return; GM approve/return/reject |
| Finance path | Claim / finalize / return (and release where applicable) |
| Observability | Notifications; reports; CSV / SAP export paths |
| Dev-only | Development Toolkit — verify dual/triple gate; must remain unavailable outside development |

### Milestone 4 — Production

- Tag `v1.0.0`  
- Production deployment  
- Monitoring enabled  
- Backup/restore verified  
- Rollback plan tested  

Work outside the current milestone requires explicit stakeholder approval.

---

## Before every commit

Verify:

- Project builds
- TypeScript clean
- ESLint clean
- Tests pass
- No new warnings introduced by the change
- No dead code introduced
- No duplicated business logic introduced
- No RBAC / workflow / UI / audit regression
- Documentation updated **or** drift listed
- `CHANGELOG.md` updated when user-visible behavior changes

---

## Bug fix policy

Fix the root cause. Do not patch symptoms.

Trace: UI → API → Application → Domain → Repository → SQL until the real cause is identified.

---

## Refactoring policy

Refactor only when one of these is true:

- duplicate logic
- security improvement
- maintainability improvement
- measurable performance improvement
- architecture violation

Never refactor because “it looks cleaner.”

---

## Production mindset

Assume: thousands of users, financial data, audit requirements, compliance review, and future maintainers. Prefer the more maintainable correct solution.

---

## Task report format

After every completed task report:

1. What was requested  
2. What was changed  
3. Why it was changed  
4. Files modified  
5. Risks introduced (if any)  
6. Tests executed **or** (for documentation-only) **Verification** checklist  
7. Remaining known issues  
8. Production impact  
9. **Documentation Drift** (or “None — docs updated”)  
10. **Recommendations (Not Implemented)** (if any)  

Never say only “Done.”

Never write “Tests: Not applicable” for documentation work — use **Verification** (links, references, consistency, no runtime artifacts changed).

State: **Verified according to the project's Definition of Done.**

---

## Engineering Change Log Policy

**Project memory lives in the repository, never in chat history.**

### Before every task — read (in order)

1. `docs/ENGINEERING_GOVERNANCE.md` (this file)
2. `docs/ARCHITECTURE_DECISIONS.md`
3. `docs/CHANGE_HISTORY.md`
4. `docs/open-decisions.md`

Only then begin implementation. Also run the **Subsystem Impact Analysis**
(see `.cursor/rules/frozen-subsystems.mdc`).

### After every task — append to `docs/CHANGE_HISTORY.md`

A task is **not complete** until a concise entry is appended (newest on top),
using the template in that file. Keep it short: summary + links; detail belongs
in `CHANGELOG.md`/ADRs.

Answer, in the entry or task report: what changed · why · which files · which
business rules · which APIs · which DB tables · which tests · docs updated ·
future risk. If you cannot answer these, the task is not done.

### Decision rule (business-rule changes)

If a business rule changes, also update, in the same task: the relevant **ADR**
(if architectural), `docs/domain-model.md`, `docs/state-machines.md`, and
`docs/permission-matrix.md` (if permissions changed). Never change behavior
without updating canonical documentation.

### Anti-regression checklist (before modifying existing code)

Ask: Why was this written? Does it implement an ADR? Does it enforce a business
rule? Will my change weaken security, break RBAC, affect approvals, or affect
audit logs? **If unsure, stop and ask.**

---

## Evidence Verification Policy (mandatory)

Before claiming any change — in a report, changelog, README, ADR, or docs —
verify the code actually implements it:

1. Identify the exact file(s) implementing the behavior.
2. Confirm the implementation exists and compiles.
3. Confirm no contradictory implementation exists elsewhere.
4. State the evidence (file + location).

Never infer implementation from comments, TODOs, docs, filenames, or
assumptions. If evidence cannot be found, mark it **INCOMPLETE**,
**PARTIALLY IMPLEMENTED**, **PLANNED**, or **NOT VERIFIED** — do not claim it.

### Hallucination prevention (banned unless evidenced)

Do not say "Complete", "Production-ready", "Enterprise-ready", "Fully
implemented", or "Verified" without evidence. Prefer precise phrasing:
*Verified in code* · *Verified by unit tests* · *Verified manually* ·
*Verified by staging E2E* · *Not verified* · *Evidence unavailable*.

### Changelog validation

Every changelog bullet must answer: implemented? which files? tested?
user-visible? needs migration? breaking? verified? If any answer is "No" or
"Unknown", rewrite it or move it under **Known Limitations** / **Planned Work**.

---

## Self-Critique Pass (required after every task)

Do a second pass as a reviewer who did not write the code. Review every changed
file, task-report claim, changelog entry, and doc update. Classify each claim:
**✅ Verified** · **⚠️ Partially Verified** · **❌ Unsupported**. For each
unsupported claim, state why it's unsupported, what evidence is missing, and the
correction.

### Contradiction check

Search for behavior that contradicts documentation (e.g. docs say notifications
auto-resolve but code dismisses on read; ADR says Finance never rejects but the
service allows it; permission matrix vs. middleware). Report every contradiction.

### Documentation accuracy review (before updating docs)

Verify APIs/routes/services still exist; permissions match code; status values
match enums; schema matches migrations; UI labels match the app. Never document
behavior that cannot be traced to code.

### Final consistency audit (before finishing larger tasks)

Scan for: duplicate implementations · dead code · unreachable routes · orphan
APIs · stale docs · unused exports · broken imports · TODO/FIXME/HACK ·
permission inconsistencies · status-machine inconsistencies · terminology drift
(e.g. "Approved" vs "Finalized"). Report findings with **severity**
(Critical/High/Medium/Low), **evidence** (file + location), and **recommended
action**.

---

## Truthfulness & evidence (highest priority)

### 1. Truthfulness gate

Before reporting completion, classify **every** statement as exactly one of —
never mixed:

- **Verified** — personally confirmed via code, tests, logs, or runtime.
- **Inferred** — logically concluded but not directly verified.
- **Assumed** — requires user confirmation.

**"Verified" must be split by level** — one blanket "Verified" is not allowed:

```
Verified
  Code ............ YES/NO
  Tests ........... YES/NO
  Runtime ......... YES/NO
  Documentation ... YES/NO
```

### 2. Evidence rule

Every technical claim needs evidence. Not "Fixed." Instead: **File · Symbol/
Method · Verification (test/command) · Result.** No evidence → not a claim.

### 3. Unknown > hallucination

If information cannot be proven from the repository, say **"Unknown"**. Never
invent routes, services, files, database columns, permissions, or workflows.

### 4. Repository as source of truth

Priority when sources disagree: **Code → DB schema → ADRs → governance docs →
README → user assumptions.** If they conflict: **stop, report the conflict, do
not silently choose.**

### 4a. Contradiction Detector (mandatory STOP)

When the Knowledge Log / ADRs and the code disagree, do **not** pick a side
and do **not** "fix" either silently. Emit:

```
CONTRADICTION DETECTED
Knowledge Log: <entry + claim>
Current code:  <file + symbol + observed behavior>
Status: STOP
Required: explain the contradiction; do not overwrite either source;
request user decision or create a reconciliation task.
```

This applies to every canonical source (Knowledge Log, ADRs, permission
matrix, state machines, domain model).

### 4b. Proof of Reading

"Consulted the Knowledge Log" is not acceptable. For each entry checked,
show **why** it is still believed valid:

```
Knowledge consulted
Evidence
  K-004 — Finance cannot reject.
  Verified against: src/application/finance-service.ts · docs/state-machines.md
  Result: Consistent.

  ADR-009 — repository driver / startup.
  Verified against: src/infrastructure/startup/env.ts · src/instrumentation.ts
  Result: Consistent.

No conflicts found.   (or: CONTRADICTION DETECTED → see §4a)
```

A bare `✓ K-004` without the verified-against path is insufficient.

### 5. Confidence score (end of every report)

End completion reports with a confidence line, e.g.: Architecture: High ·
Implementation: High · Tests: High · Runtime: Medium · Production: Unknown.

**Confidence must be justified**, not asserted. Each rating cites its basis
(code inspected / tests passed / no conflicting ADR or K-entry / runtime
assumptions present). Unjustified confidence is treated as **Unknown**.

---

## Impact analysis (every task, not only frozen code)

State Affected / Not affected for each dimension, plus the Subsystem Impact
Analysis from `.cursor/rules/frozen-subsystems.mdc`:

- Architecture · Security · RBAC · Database · Workflow · Notifications · Audit ·
  Performance
- Documentation: needs update? Yes/No

### Scope-creep detector

Before editing, declare the **Requested task**, the **files you will modify**,
and the **subsystems you will not touch**. If another file becomes necessary,
**stop and explain** before continuing (autonomous expansion is allowed only
when justified in-line and within approved scope).

### Rollback plan (every change)

Every change states how to undo it, e.g.: *Revert commit — no schema
migration, no data loss, no business-rule changes.* For schema changes, state
the truth: *Rollback impossible without a migration NNN rollback script* (and
whether data written since would be lost).

### Repository Impact (one-page change summary, every report)

Every end-of-task report includes a Repository Impact table so a reviewer can
grasp the whole change in under a minute. Use concrete counts, not prose:

```
Repository Impact
Files modified ........... N
Files added .............. N
Files deleted ............ N
Public APIs changed ...... No | <list>
Database schema changed .. No | migration NNN
Business rules changed ... No | BR-NNN
Permissions changed ...... No | <codes>
Configuration changed .... No | <keys>
ADR updated .............. No | ADR-NNN
Knowledge Log updated .... No | K-NNN
Tests added .............. N
Tests updated ............ N
Documentation updated .... N  (list filenames)
```

### Runtime verification is layered — never say "Runtime: YES" unbounded

State which runtime was exercised. `Runtime: YES` alone is too broad because it
reads as "the whole application". Split it:

```
Application Service Runtime ... YES | NO | Pending   (service layer + DB)
Browser Runtime ............... YES | NO | Pending   (UI, HTTP, cookies, routing)
```

### Known limitations (separate from remaining risks)

Deferred work is not a bug. Record each deliberate limitation as
*Limitation · Reason · Impact · Future recommendation* so reviewers see it was
decided, not forgotten.

### Per-branch release note (before opening a PR)

Every feature/bugfix branch ends with a standardized note under
`docs/release-notes/<branch>.md` before the PR is opened, using
`docs/release-notes/TEMPLATE.md`. It captures: problem solved · why this
solution · files changed · verification evidence (layered) · Repository Impact ·
known limitations · rollback plan · follow-up work. The PR description then
references this file instead of duplicating it, leaving a permanent engineering
record that survives after the branch is deleted.

### Repository Health (end of every report)

```
Repository Health
Architecture Drift ....... None
Dead Code ................ None introduced
Circular Dependencies .... None introduced
Frozen Violations ........ None
Technical Debt ........... +0   (or +N with the TD register reference)
```

### Knowledge coverage check (before closing any task)

Answer explicitly: *Does this introduce or change a permanent business rule?*
If **yes** → Knowledge Log updated? ADR needed? (answer both). If **no** →
state "No permanent knowledge introduced." Otherwise the Knowledge Log goes
stale.

### Changed Business Rules (every report)

Every end-of-task report must answer this section explicitly — never omit it:

```
Business Rules Changed: No
```

or

```
Business Rules Changed: Yes
Affected rules:
  BR-004 — Return for Revision
  Reason: <what changed and why>
```

Accidental business-rule drift becomes obvious when this is always present.
If a rule changed, also update Knowledge Log / ADR / domain-model /
state-machines / permission-matrix as required by the Decision rule above.

---

## Governance layers (each doc has one job)

| Layer | Document | Purpose |
|-------|----------|---------|
| Executive guide | `docs/ENGINEERING_BRAIN.md` | Table of contents + why the system is built this way |
| Structure | `docs/FILE_INDEX.md` | Every folder & key file (+ per-file architectural cards) |
| Wiring | `docs/DEPENDENCY_MAP.md` | The DI/import graph only (what depends on what) |
| Workflows | `docs/WORKFLOWS.md` | Every workflow end-to-end (business steps/states) |
| Data flow | `docs/DATA_FLOW.md` | How data moves through the layers per feature |
| Database | `docs/DATABASE.md` | Every table, index, trigger, relationship |
| Business rules | `docs/BUSINESS_RULES.md` | Every invariant (indexed to ADRs/K-entries) |
| Invariants | `docs/ARCHITECTURAL_INVARIANTS.md` | Curated "never change these" (points to BR/K/ADR) |
| Glossary | `docs/DOMAIN_GLOSSARY.md` | Canonical business vocabulary |
| Process | `docs/ENGINEERING_GOVERNANCE.md` | Workflow & rules (this file) |
| Completion | `docs/definition-of-done.md` | When work is "done" |
| Architecture | `docs/ARCHITECTURE_DECISIONS.md` | Permanent decisions (the decision history) |
| System shape today | `docs/SYSTEM_DECISIONS.md` | Onboarding Q&A — why it is this way now (links ADRs) |
| Rejected ideas | `docs/REJECTED_DECISIONS.md` | Ideas deliberately rejected (don't re-propose) |
| DB rationale | `docs/WHY_SQL_SERVER.md` | Engine choice rationale (explains ADR-009/011) |
| Evolution | `docs/SYSTEM_HISTORY.md` | How the architecture evolved (phases + rationale) |
| Evidence | `docs/feature-e2e-proof.md` | 12-point implementation proof |
| Feature status | `docs/FEATURE_REGISTRY.md` | Status roll-up (links the 12-point proof) |
| Troubleshooting | `docs/TROUBLESHOOTING.md` | Solved problems (symptom → cause → fix → verify) |
| Protection | `.cursor/rules/frozen-subsystems.mdc` | Freeze gate + registry |
| Canonical facts | `docs/KNOWLEDGE_LOG.md` | Operational memory — how things work |
| History | `docs/CHANGE_HISTORY.md` + `CHANGELOG.md` | What changed, when |
| Release gates | `docs/RELEASE_CHECKLIST.md` | Runnable gates: branch→develop, develop→main |
| Per-branch record | `docs/release-notes/<branch>.md` (`TEMPLATE.md`) | One-page PR record: problem, solution, impact, evidence, rollback |
| Onboarding | study/README notes | Non-authoritative orientation |

**Consult `docs/KNOWLEDGE_LOG.md` before proposing changes.** If a change
contradicts an entry, reconcile it (update entry + ADR) in the same task.

### Documentation-update matrix (Definition of Done)

Documentation is now a subsystem in its own right; keep it from drifting by treating updates as
part of *done*. Each fact has **one canonical owner** — update the owner, and let other docs
reference it (never restate). When a change affects a dimension, update the owning doc in the
**same task** (ADR-013):

| If the change affects… | Update (canonical owner) |
|------------------------|--------------------------|
| Architecture / layering | `ENGINEERING_BRAIN.md` (+ ADR; `ARCHITECTURAL_INVARIANTS.md` if an invariant moved) |
| A workflow | `WORKFLOWS.md` (+ `DATA_FLOW.md` if the data path changed) |
| Database schema | `DATABASE.md` (+ new migration + `migrations/registry.ts` + `EXPECTED_SCHEMA_VERSION`) |
| A business rule | `BUSINESS_RULES.md` (+ ADR/K; `state-machines.md`/`permission-matrix.md` as applicable) |
| Permanent fact / decision | `KNOWLEDGE_LOG.md` (new immutable ID) / `ARCHITECTURE_DECISIONS.md` |
| A rejected alternative | `REJECTED_DECISIONS.md` |
| Terminology | `DOMAIN_GLOSSARY.md` |
| Feature status | `FEATURE_REGISTRY.md` (+ `feature-e2e-proof.md`) |
| A newly diagnosed bug class | `TROUBLESHOOTING.md` |
| System evolution (new capability class / phase) | `SYSTEM_HISTORY.md` |
| **Any change** | `CHANGE_HISTORY.md` (always) + the branch `release-notes/<branch>.md` |

A change is **not done** until the applicable rows above are satisfied (or the drift is explicitly
listed under the Documentation Consistency Policy).

**Enforced by CI (no longer advisory-only).** The `Docs Guard` workflow
(`.github/workflows/docs-guard.yml` → `scripts/docs-guard/cli.ts` + `rules.ts`;
locally: `npm run docs:check`) fails a PR into `develop`/`main` when:

| Detected change | Required doc | Waiver marker |
|-----------------|--------------|---------------|
| any change at all | `docs/CHANGE_HISTORY.md` | `[non-functional]` |
| `src/application/**`, portal UI (`budgets`/`approvals`/`finance`/`notifications`), or those API routes | `docs/WORKFLOWS.md` | `[no-behavior-change]` |
| `src/domain/**` | `docs/BUSINESS_RULES.md` | `[no-behavior-change]` |
| `approval-service.ts` or `finance-service.ts` | **both** `WORKFLOWS.md` **and** `BUSINESS_RULES.md` | `[no-behavior-change]` |
| `src/domain/**`, notification task surface (`notification-task-actions`, bell, notifications API, `/me`) | `docs/KNOWLEDGE_LOG.md` | `[no-knowledge-change]` |
| `docs/migrations/*.sql` or `docs/schema.sql` | `docs/DATABASE.md` | `[no-schema-change]` |
| `.env.example`, `next.config.js`, `src/middleware.ts` | `docs/ENGINEERING_BRAIN.md` | `[no-architecture-change]` |
| `src/infrastructure/di.ts` | `docs/DEPENDENCY_MAP.md` | `[no-architecture-change]` |
| branch `feature/*`, `bugfix/*`, `hotfix/*` | a per-branch note under `docs/release-notes/` | `[no-release-note]` |

**Flow:** CODE CHANGE → Subsystem Detection (path patterns above) → Required Documentation →
Validation (`npm run docs:check` / Docs Guard CI) → Commit / merge allowed.

Every PR must also answer the human checklist in `.github/PULL_REQUEST_TEMPLATE.md`
(Business rules? Workflows? Database? Knowledge? Architecture? Docs ticked?). CI checks file
co-change; reviewers check semantic correctness against the YES/NO answers.

Branch detection uses `DOCS_GUARD_BRANCH` (CI passes `github.head_ref`; locally it falls back
to the current branch).

Waiver markers go in the PR title/body or a commit message; they are **visible and audited in
review** — using one falsely is a governance violation. The rule engine is unit-tested
(`tests/unit/docs-guard.test.ts`).

---

## Related documents

- `docs/ARCHITECTURE_DECISIONS.md` — ADR log  
- `docs/KNOWLEDGE_LOG.md` — canonical business/technical facts (operational memory)  
- `docs/CHANGE_HISTORY.md` — chronological change memory  
- `docs/definition-of-done.md` — completion checklist  
- `docs/ai-guardrails.md` — AI-specific hard rules  
- `docs/production-readiness.md` — release evidence and ops gates  
- `docs/open-decisions.md` — undecided items  
- `.cursor/rules/frozen-subsystems.mdc` — subsystem governance + freeze gate  

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

## Related documents

- `docs/ARCHITECTURE_DECISIONS.md` — ADR log  
- `docs/definition-of-done.md` — completion checklist  
- `docs/ai-guardrails.md` — AI-specific hard rules  
- `docs/production-readiness.md` — release evidence and ops gates  
- `docs/open-decisions.md` — undecided items  

# SYSTEM_HISTORY.md — How the system evolved (and why)

**Purpose:** Record the *evolution* of the architecture — why it became what it is — as
distinct from `docs/CHANGE_HISTORY.md` (which records individual changes) and
`ARCHITECTURE_DECISIONS.md` (which records decisions). Read this to understand the arc.

**Single responsibility:** narrative of phases + rationale. It cites evidence (ADR dates,
migration order, CHANGE_HISTORY entries) rather than restating them.

> **Evidence basis, honestly stated.** No git release tags have been cut yet
> (`package.json` version = `0.1.0`; `main` protected, `develop` integration). The phases
> below are **derived from evidence** — ADR dates in `ARCHITECTURE_DECISIONS.md`, the ordered
> migrations `001→012`, and `CHANGE_HISTORY.md` #005–#012. They are not tagged releases.
> Exact chronology before ADR-001 (2026-07-13) is **UNKNOWN**.

---

## Phase 1 — Foundation & Clean Architecture (ADRs dated 2026-07-13)

- **What:** Established Clean Architecture layering (ADR-001), approval routing by `managerId`
  walk (ADR-002), repository driver + SQL access path (ADR-009), session auth + server-side
  RBAC (ADR-010), and audit immutability (ADR-011).
- **Why:** Build an enterprise-maintainable core where business rules live in the domain, the
  org tree drives approvals, and every mutation is auditable — from day one, not retrofitted.
- **Persistence duality:** mock repositories for speed of development/testing; SQL Server for
  production transactional consistency (ADR-009). This is why two repository implementations
  exist behind one interface.

## Phase 2 — Workflow depth (ADRs dated 2026-07-16; migrations 003–008)

- **Return vs Reject (ADR-003).** Separated recoverable "return for revision" from terminal
  "reject" so financial governance and audit stay clear. *Why:* collapsing them lost the
  distinction between "needs work" and "closed permanently".
- **Finance queue (ADR-004; migration 007).** Introduced claim → finalize/return/release with a
  one-active-claim invariant (`UX_FinanceQueueClaims_ActivePlan`). *Why:* prevent multiple
  Finance officers processing one budget, and forbid Finance from killing a budget without a
  revision path.
- **Lineage & amendments (ADR-005/006; migration 007).** Made a budget a *lineage* of versions
  with one active version at a time. *Why:* preserve history for SAP/compliance while allowing
  controlled mid-cycle changes.
- **GM root identity (ADR-007).** Exactly one org root (`managerId IS NULL`). *Why:* a single
  apex keeps routing and executive ownership deterministic.
- **Attachments in SQL (ADR-008; migration 007).** `VARBINARY(MAX)` storage. *Why:* a single
  backup/restore boundary for v1 (UI/API may be deferred).
- **Master data + fiscal-year lifecycle (migrations 003, 006).** Fiscal-year status/current
  singletons and submission-status projection.
- **Development Toolkit (migration 008).** Dev-only data/workflow simulation, triple-gated.

## Phase 3 — Stabilization & documentation discipline (ADRs 012–014, dated 2026-07-16)

- **Feature freeze (ADR-012).** Treat the product as feature-complete; prioritize production
  blockers, security, and readiness. *Why:* the project moved from build-out to enterprise
  readiness; scope creep undermines correctness.
- **Documentation Consistency Policy (ADR-013).** Docs are part of the product; behavior changes
  must update docs in the same task. *Why:* prevent stale rules misleading future maintainers/AIs.
- **Release milestones (ADR-014).** Code Complete → Stabilization → Validation → Production.

## Phase 4 — Reliability hardening (2026-07-18; migrations 010–012; CHANGE_HISTORY #005–#012)

- **Task-based notifications (CHANGE_HISTORY #001/#008/#011; migrations 010–011; K-001, K-009).**
  Replaced message-feed notifications with actionable tasks (read ≠ resolved; badge counts active
  work; duplicate-task guard; bell dropdown; approval deep-links). *Why:* users cleared messages
  without completing the underlying work.
- **Startup fail-fast + schema versioning (ADR-009 amended; migration 012; K-007).** Required
  `REPOSITORY_DRIVER`, `dbo.SchemaVersion` ledger, and a startup validation subsystem that refuses
  to serve on config/schema mismatch. *Why:* a config drift had surfaced as a false 401; fail-fast
  eliminates that class of bug. Subsequently **FROZEN**.
- **Native-driver bundling fix (part of ADR-009 subsystem).** Aliased `msnodesqlv8`/`mssql`/
  `child_process` out of browser/edge bundles. *Why:* the native SQL driver was leaking into client/
  edge builds and breaking pages.
- **Governance framework (CHANGE_HISTORY #005–#007).** Knowledge Log, Contradiction Detector,
  evidence/truthfulness gates, rollback discipline, frozen-subsystem registry. *Why:* keep project
  memory in the repo so AI/engineering sessions don't re-derive or contradict decisions.
- **Local SQL integration harness (CHANGE_HISTORY #009/#010).** Service-layer E2E against live SQL
  with safe, single-choke-point trigger teardown. *Why:* uncover real workflow/DB issues before staging.
- **Engineering knowledge base (CHANGE_HISTORY #012).** The two-layer `ENGINEERING_BRAIN.md` + detail
  companions. *Why:* make the system understandable years later without asking the original authors.

---

## Where evolution is heading (from ADR-014 + open items)

- **Validation milestone:** browser/staging E2E across every role; backup/restore drill; performance.
- **Production milestone:** release dossier; tag `v1.0.0`; deploy + smoke test.
- **Deferred by decision (not forgotten):** v2 monthly/quarterly per-line amounts; attachment upload
  UX/API ship; approval delegation (`docs/open-decisions.md`).
- **Unreconciled item:** "Western Region" seed user contradiction (`docs/ENGINEERING_BRAIN.md` §17).

*Update this file only when a change alters the system's evolution story (a new capability class, a
persistence/architecture shift, or a milestone transition) — not for every commit.*

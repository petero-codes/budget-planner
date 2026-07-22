# REJECTED_DECISIONS.md — Ideas we deliberately rejected

**Purpose:** Record ideas that were considered and **rejected**, so future engineers (and AIs)
do not re-propose or accidentally re-introduce them. This is the negative space of the ADRs:
the ADR "Alternatives" fields, consolidated and made searchable.

**Single responsibility:** each entry states the rejected idea · why · the decision taken ·
the governing ADR (canonical). To *revive* a rejected idea, write a new superseding ADR — do
not quietly implement it.

Evidence: `docs/ARCHITECTURE_DECISIONS.md` (Alternatives fields), `docs/KNOWLEDGE_LOG.md`.

---

## Persistence & data model

- **Rejected: a NoSQL / document store (e.g. MongoDB).**
  - Why: the system needs transactions, foreign-key integrity, immutable `ApprovalHistory`/
    `AuditLogs`, filtered unique indexes for invariants, and SQL reporting.
  - Decision: **SQL Server** (see `docs/WHY_SQL_SERVER.md`, ADR-009).
- **Rejected: an ORM (e.g. Prisma) used from the Application/UI layer.**
  - Why: violates Clean Architecture; couples business logic to a query builder; hides the
    repository boundary that keeps rules testable.
  - Decision: **repository pattern over parameterized SQL** (ADR-001/009).
- **Rejected: a silent `REPOSITORY_DRIVER ?? "mock"` default.**
  - Why: it masked a SQL/schema mismatch as a false 401 — a recurring outage.
  - Decision: **`REPOSITORY_DRIVER` is required; production refuses non-`sql`** (ADR-009, K-007).
- **Rejected: app connecting as `sa`/admin DB credentials.**
  - Why: over-privileged; audit tables must be un-mutable even by the app.
  - Decision: **least-privilege `app_budget_ops` with DENY on audit tables** (ADR-009/011).

## Budget structure & uniqueness

- **Rejected: multiple active budgets for the same cost centre / FY / type.**
  - Why: allows duplicate/competing submissions.
  - Decision: **one active version per lineage**, enforced by `UX_BudgetPlans_LineageInPlay`
    (ADR-006, K-002).
- **Rejected: a new independent plan after finalize (no lineage), or overwriting finalized rows.**
  - Why: destroys budget history needed for SAP/compliance.
  - Decision: **budget lineage + amendments** (new version, same lineage) (ADR-005).
- **Rejected: blocking any new plan forever after finalize.**
  - Why: budgets legitimately need mid-cycle changes.
  - Decision: **amendment path** from the latest finalized version (ADR-005).
- **Rejected: monthly/quarterly per-line period amounts (v1).**
  - Why: added complexity not required for v1.
  - Decision: **plan-level `FromPeriod`/`ToPeriod` only**; deferred to v2 (`docs/open-decisions.md`).

## Approval routing

- **Rejected: fixed Assistant→Manager→GM stages, or role/title-based routing.**
  - Why: the org chart is a tree of unlimited depth; titles change; hardcoded stages break on reorg.
  - Decision: **route by walking `Users.managerId`** (ADR-002).
- **Rejected: cost-center named approver as the sole authority / role-based queue routing.**
  - Why: breaks hierarchy integrity and multi-level approval.
  - Decision: `CostCenter.managerId` is the *preferred first step*, then walk to root (ADR-002).
- **Rejected: multiple org roots / role-only GM without hierarchy root.**
  - Why: multiple apexes break routing and executive ownership.
  - Decision: **exactly one active GM (`managerId IS NULL`)** (ADR-007).
- **Rejected: GM "self-approve" click when GM submits.**
  - Why: it's not a real approval action.
  - Decision: **empty route auto-completes to Finance** (ADR-007, open-decisions "Root node submit").

## Approval & finance semantics

- **Rejected: Reject → Draft (older interpretation).**
  - Why: conflates "needs revision" with "permanently closed".
  - Decision: **Return → `ReturnedForRevision`; Reject → terminal `Rejected`** (ADR-003).
- **Rejected: Finance permanently rejecting a budget; auto-finalize after GM; shared finance
  queue without claim.**
  - Why: financial governance forbids killing a budget without a revision path and requires
    exclusive ownership of in-review work.
  - Decision: **Finance claim/finalize/return/release, never reject**; one active claim per plan
    (ADR-004, K-004).

## Attachments & SAP

- **Rejected: external object storage (Azure Blob / S3) or filesystem for attachments (v1).**
  - Why: adds separate ops/backup surface; v1 wants a single restore boundary.
  - Decision: **attachments in SQL as `VARBINARY(MAX)`** (ADR-008). May be revisited via a new ADR.
- **Rejected (implicitly): writing to SAP live.**
  - Why: couples budgeting governance to SAP availability; loses an immutable record of the handover.
  - Decision: **generate a frozen SAP package (JSON+CSV) on finalize** (`docs/WHY_SQL_SERVER.md`,
    `docs/WORKFLOWS.md` WF-018, ADR-004).

## Notifications

- **Rejected: message-feed notifications (clearable alerts).**
  - Why: users cleared notifications without completing the underlying work.
  - Decision: **task-based notifications** — active until resolved by a workflow action;
    read ≠ resolved; badge counts active work (K-001).
- **Rejected: allowing duplicate active tasks for the same work.**
  - Why: a duplicate lets a user "complete" a task while a twin lingers, mis-stating the badge.
  - Decision: **duplicate-task guard in the repository** — one active actionable notification per
    `(recipient, type, plan/entity)` (K-009).

## Auth & authorization

- **Rejected: JWT-in-localStorage-only; UI-only menu hiding for authorization; open
  registration / self-service reset.**
  - Why: exposes IDOR/privilege-escalation; the frontend cannot be the security boundary.
  - Decision: **signed session cookies + server-side RBAC (middleware + API + service);
    admin-provisioned accounts only** (ADR-010).

## Process

- **Rejected: open-ended continuous feature development.**
  - Why: the product moved from build-out to enterprise readiness; scope creep undermines correctness.
  - Decision: **stabilization mode + explicit release milestones** (ADR-012/014).
- **Rejected: a separate `DECISION_HISTORY.md`.**
  - Why: decision history already lives in `ARCHITECTURE_DECISIONS.md`; a second file duplicates
    and risks contradiction.
  - Decision: **ADRs remain the single decision-history source** (`docs/ENGINEERING_BRAIN.md` §16).

---

*To revive any rejected idea: open a new ADR that supersedes the governing one, record the new
rationale, and update `docs/KNOWLEDGE_LOG.md`. Do not re-introduce a rejected idea silently.*

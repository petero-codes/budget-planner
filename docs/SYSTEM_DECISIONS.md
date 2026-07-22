# SYSTEM_DECISIONS.md — why the system is this way *today*

> **Single responsibility.** One onboarding page answering the questions a senior engineer
> asks in the first week. This is **not** an ADR log (those record *when* a decision was made
> and what alternatives were considered). This is the **current shape** of the system, with
> pointers to the ADR / BR / K / INV that owns the detail.
>
> Prefer linking over restating. If this file and an ADR disagree, the ADR wins — fix this page.

| # | Question | Answer (today) | Detail |
|---|----------|----------------|--------|
| 1 | Why SQL Server, not PostgreSQL / MySQL / MongoDB? | Financial governance needs ACID multi-table transactions, FK integrity, immutable audit history, and hard uniqueness indexes. SQL Server fits the domain **and** the KenGen operating environment. | `WHY_SQL_SERVER.md`, ADR-009, `REJECTED_DECISIONS.md` |
| 2 | Why Clean Architecture? | Presentation → Application → Domain ← Infrastructure keeps business rules independent of Next.js and the SQL driver. Repositories are swappable (`mock`/`sql`) behind one DI root. | `ENGINEERING_BRAIN.md`, `DEPENDENCY_MAP.md`, INV layering |
| 3 | Why notifications are tasks, not a message feed? | A feed is cleared without completing work. Tasks stay active until the workflow step finishes (`resolvedAt`). Read ≠ resolved. Badge = unresolved count. | K-001, K-009, BR-33…37, WF-011 |
| 4 | Why Finance cannot reject budgets? | Permanent reject after GM approval would bypass the governance chain. Finance validates compliance: **Finalize**, **Return**, or **Release** only. | ADR-004, BR-24, K-004, WF-006…010 |
| 5 | Why Startup Validation is frozen? | Fail-fast env + schema-version checks are load-bearing. Uncontrolled edits risk silent mock/SQL mismatch or shipping with pending migrations. Touch only for verified bug / deployment / migration / regression. | ADR-009 subsystem status, `frozen-subsystems.mdc`, WF-019 |
| 6 | Why `develop` integrates and `main` releases? | Short-lived feature branches merge to `develop` after Gate A. `main` is promotion-only after Gate B (staging E2E, UAT, backup+restore). | `RELEASE_CHECKLIST.md`, `ENGINEERING_GOVERNANCE.md` |
| 7 | Why documentation is enforced in CI? | Docs drift is the failure mode of a mature doc set. Docs Guard blocks PRs that change code without the matching docs (or an explicit waiver). | Docs Guard matrix in `ENGINEERING_GOVERNANCE.md`, ADR-013 |
| 8 | Why audit / approval / workflow history are immutable? | Governance evidence must survive mistakes and privilege misuse. DB triggers + role DENY block UPDATE/DELETE; app never "fixes" history by rewriting it. | ADR-011, INV-6/7/8 |
| 9 | Why release notes are per branch? | The PR description dies with the branch; `docs/release-notes/<branch>.md` is permanent engineering memory (problem · solution · evidence · rollback). | `release-notes/TEMPLATE.md`, Docs Guard `release-note` rule |
| 10 | Why one active budget version per lineage? | Multiple actives created duplicate approvals and conflicting ownership. Exactly one in-play version; post-finalize change is an amendment. | K-002, BR-08…13, WF-012 |
| 11 | Why approval routes walk `Users.managerId`? | Titles and role names change; the reporting hierarchy does not. Route is built from the manager chain, never hard-coded role labels. | ADR-002, BR-14…16, WF-002/003 |
| 12 | Why System Admin never approves budgets? | Separation of duties. Admin owns users/master data/fiscal years; budget authority stays with the hierarchy + Finance. | permission-matrix, BR-38+, K entries on RBAC |

## Related documents

- `ARCHITECTURE_DECISIONS.md` — decision history (ADRs)
- `REJECTED_DECISIONS.md` — ideas deliberately not chosen
- `ARCHITECTURAL_INVARIANTS.md` — never-break rules
- `KNOWLEDGE_LOG.md` — operational facts with evidence
- `ENGINEERING_BRAIN.md` — executive TOC

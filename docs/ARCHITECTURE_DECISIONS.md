# Architecture Decision Records (ADR Log)

**Purpose:** Preserve the *why* behind deliberate architectural and business-rule choices so future contributors and AI sessions do not undo them.

**Rules:**
- Add a new entry for every significant architectural or business-rule decision.
- Do not invent decisions here — only record what was explicitly decided or is locked in live implementation with stakeholder confirmation.
- Open / unresolved items belong in `docs/open-decisions.md` until locked; then promote a short ADR entry and update that file.
- Changing a locked decision requires an explicit stakeholder request and a new ADR that supersedes the prior one.

**Status values:** `Accepted` | `Superseded` | `Deferred` | `Proposed`

**Related governance:** `docs/ENGINEERING_GOVERNANCE.md` (canonical), `docs/ai-guardrails.md`, `docs/definition-of-done.md`, `docs/production-readiness.md`.

---

## ADR-001 — Clean Architecture layering

| Field | Value |
|-------|-------|
| **Date** | 2026-07-13 |
| **Status** | Accepted |
| **Decision** | Strict Clean Architecture: Presentation → Application → Domain → Infrastructure. Presentation never talks to SQL. Domain/Application own business rules. Infrastructure implements repository interfaces only. |
| **Why** | Enterprise maintainability, testability, and prevention of rule leakage into UI/routes. |
| **Alternatives** | Fat controllers; Prisma/ORM from UI; “service + SQL in one module.” |
| **Consequences** | All persistence goes through repositories/DI. New features must place rules in Domain/Application. Violations are defects. |

---

## ADR-002 — Approval routing via `Users.managerId` walk

| Field | Value |
|-------|-------|
| **Date** | 2026-07-13 |
| **Status** | Accepted |
| **Decision** | Approval routes are built only by walking `Users.managerId` upward. Never hardcode titles (“Manager”, “GM”) or role names in routing logic. `CostCenter.managerId` is for dashboards/visibility assignment, not route construction. |
| **Why** | Org chart is a tree of unlimited depth; titles change; routing must survive reorgs without code changes. |
| **Alternatives** | Fixed Assistant→Manager→GM stages; cost-center named approver as sole authority; role-based queue routing. |
| **Consequences** | Broken/circular hierarchy must fail closed (reject, notify admin). See `domain/rules/build-approval-route.ts`, `docs/ai-guardrails.md`. |

---

## ADR-003 — Return vs Reject (terminal Rejected)

| Field | Value |
|-------|-------|
| **Date** | 2026-07-16 |
| **Status** | Accepted (live product + stakeholder charter) |
| **Decision** | **Return** → `ReturnedForRevision` (editable, resubmittable). **Reject** → terminal `Rejected` (immutable). Manager/GM may return; permanent reject follows workflow permissions (GM may reject). Finance must not permanently reject. |
| **Why** | Separates “needs revision” from “closed permanently,” matching financial governance and audit clarity. |
| **Alternatives** | Reject → Draft only (older `state-machines.md` Interpretation A). |
| **Consequences** | Docs that still describe Reject→Draft are stale and must be aligned to code when updated. Do not “simplify” by collapsing Return into Reject. Tracked historically in `docs/bucket-2-decision-brief.md` item 5. |

---

## ADR-004 — Finance queue: claim, finalize, return, release (no Finance reject)

| Field | Value |
|-------|-------|
| **Date** | 2026-07-16 |
| **Status** | Accepted |
| **Decision** | After GM approval, plans enter Finance: `PendingFinanceReview` → claim (`Claimed`) → **Finalize** (`Finalized`) or **Return** (`ReturnedForRevision`) or **Release** (return to queue). Only the claimant (or SystemAdmin reassignment path) may finalize/return/release. Finance cannot permanently reject. All actions audited. Concurrent claims prevented by `UX_FinanceQueueClaims_ActivePlan`. |
| **Why** | Financial governance requires exclusive ownership of in-review work and forbids Finance from killing a budget without revision path. |
| **Alternatives** | Shared queue without claim; Finance reject as terminal; auto-finalize after GM. |
| **Consequences** | `Approved` is legacy/migration; post-GM success path ends at `Finalized`. Metrics/reports must include `Finalized` where “approved amount” is meant. |

---

## ADR-005 — Budget lineage and amendments

| Field | Value |
|-------|-------|
| **Date** | 2026-07-16 |
| **Status** | Accepted |
| **Decision** | Lineage key = Cost Center + Fiscal Year + Original Budget Type. Version 1 finalizes; amendments create Version N+1 in the same lineage with required amendment reason, copying from the prior finalized version. Only one active (in-play) version per lineage at a time. |
| **Why** | Preserve budget history for SAP/compliance while allowing controlled mid-cycle changes. |
| **Alternatives** | New independent plan after finalize with no lineage; overwrite finalized rows; unbounded parallel active versions. |
| **Consequences** | Schema/migration `007-budget-lineage-finance.sql`. Amendment is not a free-form duplicate create. |

---

## ADR-006 — Duplicate / active budget uniqueness

| Field | Value |
|-------|-------|
| **Date** | 2026-07-16 |
| **Status** | Accepted |
| **Decision** | Only one **active** budget may exist per lineage (or business key). Active = `Draft`, `InApproval`, `ReturnedForRevision` (and finance in-play statuses while that version is open). Terminal/inactive for uniqueness purposes include `Finalized` and `Rejected`. Users get friendly validation; never raw SQL unique-index errors. |
| **Why** | Prevent parallel conflicting submissions for the same cost center / FY / type. |
| **Alternatives** | Allow multiple drafts; block any new plan forever after finalize (no amendment). |
| **Consequences** | Filtered unique indexes + domain validation. Post-finalize changes go through amendment (ADR-005), not a second primary draft. |

---

## ADR-007 — GM uniqueness and root identity

| Field | Value |
|-------|-------|
| **Date** | 2026-07-16 |
| **Status** | Accepted |
| **Decision** | Exactly one active General Manager (org root): `managerId IS NULL` with approve capability. Admin must prevent creation of multiple active GMs. Root (GM) submit builds an empty approval route and auto-completes to Finance path per workflow (not a “self-approve” click). |
| **Why** | Org tree has a single apex; multiple roots break routing and executive ownership. |
| **Alternatives** | Role-only GM without hierarchy root; multiple roots with special-case routing. |
| **Consequences** | Org-role heuristics (`managerId === null` + permissions) must stay consistent with seed and admin validation. Fragile if data model changes — change only with a superseding ADR. |

---

## ADR-008 — Attachment storage in SQL Server (`VARBINARY`)

| Field | Value |
|-------|-------|
| **Date** | 2026-07-16 |
| **Status** | Accepted (storage model) / Deferred (UI/API ship for v1 go-live) |
| **Decision** | When enabled, attachments are stored in SQL Server as `VARBINARY(MAX)` on `BudgetAttachments`, with type allow-list (PDF, XLSX, DOCX, CSV, PNG, JPG), 10MB max, admin-configurable required categories. Finance finalize must block if required attachments are missing. DB backup is attachment backup. |
| **Why** | Single restore boundary for plans + evidence; avoids separate object-store ops for v1. |
| **Alternatives** | Azure Blob / S3 + metadata in SQL; filesystem store. |
| **Consequences** | Schema exists; full upload UX/API may be deferred for a release but must not be replaced silently with external storage without a new ADR. See `docs/production-readiness.md`. |

---

## ADR-009 — Repository driver and SQL access path

| Field | Value |
|-------|-------|
| **Date** | 2026-07-13 |
| **Status** | Accepted |
| **Decision** | Persistence via `REPOSITORY_DRIVER=mock|sql`. Production uses `sql` against SQL Server (Express supported) through parameterized queries / ODBC (`msnodesqlv8` as configured). Never bypass repositories; never inline SQL from UI. App login should be least-privilege (`app_budget_ops`). |
| **Why** | Testability (mock) and production safety (SQL + least privilege). |
| **Alternatives** | ORM from Application layer; always-on SQL only; sa/admin app credentials. |
| **Consequences** | Ops must set `REPOSITORY_DRIVER=sql` and connection string before production. Default `mock` if unset is a known residual risk (document in deploy checklist). |

---

## ADR-010 — Session auth and server-side RBAC

| Field | Value |
|-------|-------|
| **Date** | 2026-07-13 |
| **Status** | Accepted |
| **Decision** | Signed session cookies; production requires `SESSION_SECRET` (≥32). Permissions enforced in middleware, API routes, and application services. Frontend never trusted for authorization. Public self-service register/forgot/reset remain stubbed (admin-provisioned accounts). |
| **Why** | Enterprise credential model + defense in depth against IDOR and privilege escalation. |
| **Alternatives** | JWT in localStorage only; UI-only hiding of menus; open registration. |
| **Consequences** | Role/permission changes may lag until re-login if claims are embedded in the session cookie (known residual). APIs must still load authoritative user from persistence. |

---

## ADR-011 — Audit immutability

| Field | Value |
|-------|-------|
| **Date** | 2026-07-13 |
| **Status** | Accepted |
| **Decision** | Every meaningful mutating action writes audit (and workflow history where applicable). Audit tables deny UPDATE/DELETE for the app role (triggers + permissions). No silent operations. |
| **Why** | Compliance, dispute resolution, and operational forensics for financial data. |
| **Alternatives** | Best-effort logging; mutable audit rows; log only errors. |
| **Consequences** | New workflow actions must extend audit/history enums and writers in the same change set. |

---

## ADR-012 — Stabilization mode (feature freeze)

| Field | Value |
|-------|-------|
| **Date** | 2026-07-16 |
| **Status** | Accepted |
| **Decision** | Treat the product as feature-complete unless the stakeholder explicitly requests expansion. Primary work is production blockers, security/audit findings, incomplete workflow (e.g. attachments gating), safe tech debt, consistency, and deploy/UAT readiness. Beneficial-but-optional work is listed under **Recommendations (Not Implemented)** and waits for approval. |
| **Why** | Project has moved from build-out to enterprise readiness; scope creep undermines correctness. |
| **Alternatives** | Continue open-ended feature development. |
| **Consequences** | AI/engineering sessions must not invent features, redesign workflows, rename APIs/tables, change permission models, or alter schema without explicit request. |

---

## ADR-013 — Documentation Consistency Policy

| Field | Value |
|-------|-------|
| **Date** | 2026-07-16 |
| **Status** | Accepted |
| **Decision** | Documentation is part of the product. Any code change that alters behavior, workflow, permissions, APIs, state machines, or architecture must identify affected docs, report drift, and either update those docs in the same task or list them under **Documentation Drift** in the task report. Silent doc inaccuracy is forbidden. |
| **Why** | Prevents future maintainers and AI sessions from following stale rules; keeps ADRs and contracts trustworthy. |
| **Alternatives** | Docs-only cleanup sprints; “update docs later”; treating README as optional. |
| **Consequences** | Priority docs listed in `docs/ENGINEERING_GOVERNANCE.md`. Behavior-changing PRs without doc update or explicit drift list fail process review. |

---

## ADR-014 — Release milestones (stabilize → validate → production)

| Field | Value |
|-------|-------|
| **Date** | 2026-07-16 |
| **Status** | Accepted |
| **Decision** | Explicit milestones: (1) Code Complete ✅, (2) Stabilization — **current**, (3) Validation (staging/E2E/UAT), (4) Production (`v1.0.0`). Work is scoped to the current milestone unless the stakeholder expands scope. |
| **Why** | Gives a clear finish line instead of endless incremental improvements after feature development. |
| **Alternatives** | Open-ended continuous feature work; phase numbers only in older `ai-guardrails.md` without a release finish line. |
| **Consequences** | Milestone 2 priorities: dead code, duplicates, security findings, production blockers, attachment decision, doc sync. Do not start Milestone 3/4 work as “drive-by” without approval. |

---

## Template for new entries

```markdown
## ADR-NNN — Title

| Field | Value |
|-------|-------|
| **Date** | YYYY-MM-DD |
| **Status** | Accepted \| Superseded by ADR-XXX \| Deferred \| Proposed |
| **Decision** | One paragraph: what we chose. |
| **Why** | Business/technical rationale. |
| **Alternatives** | What we rejected (brief). |
| **Consequences** | What maintainers must not undo; follow-on work. |
```

---

## Index

| ID | Title | Status |
|----|-------|--------|
| ADR-001 | Clean Architecture layering | Accepted |
| ADR-002 | Approval routing via managerId walk | Accepted |
| ADR-003 | Return vs Reject | Accepted |
| ADR-004 | Finance queue behavior | Accepted |
| ADR-005 | Budget lineage and amendments | Accepted |
| ADR-006 | Active budget uniqueness | Accepted |
| ADR-007 | GM uniqueness and root identity | Accepted |
| ADR-008 | Attachment storage in SQL | Accepted / Deferred ship |
| ADR-009 | Repository driver and SQL access | Accepted |
| ADR-010 | Session auth and server-side RBAC | Accepted |
| ADR-011 | Audit immutability | Accepted |
| ADR-012 | Stabilization mode | Accepted |
| ADR-013 | Documentation Consistency Policy | Accepted |
| ADR-014 | Release milestones | Accepted |

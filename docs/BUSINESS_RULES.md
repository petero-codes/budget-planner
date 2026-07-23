# BUSINESS_RULES.md — Invariants catalogue

**Purpose:** One place listing every enforced business invariant, where it is enforced, and
which decision governs it. Detailed companion to `docs/ENGINEERING_BRAIN.md`. Evidence:
file/symbol + ADR/K-entry. Uncertain items marked **UNKNOWN**.

**How to read the ID column:** `BR-NN` is a stable local id for this catalogue. Where a rule
already has canonical memory it cross-references the **K-entry** (`docs/KNOWLEDGE_LOG.md`) and/or
**ADR** (`docs/ARCHITECTURE_DECISIONS.md`). Those remain the source of truth; this file is the index.

> **Do not weaken or "simplify" any rule below without a superseding ADR/K-entry**
> (ADR-012 stabilization mode; governance Contradiction Detector).

## Rule lifecycle & history (how to track a BR over time)

Rather than duplicate a version history per rule (which would drift), each BR's history is
**reconstructable from linked canonical sources**:

- **Introduced in / governed by:** the **ADR** (and/or **K-entry**) in the rule's "Governs"
  column is the decision that introduced and owns it. That ADR's date = when the rule became law.
- **Modified in:** search `docs/CHANGE_HISTORY.md` for the rule's enforcing symbol/table — every
  change that touched enforcement is logged there (newest on top) with a Rollback line.
- **Superseded by:** BR meanings are **immutable like ADRs/K-ids** — never rewrite a rule's
  meaning in place. To change it, supersede the governing ADR/K-entry (record `Superseded by
  K-NNN`/new ADR), then update the BR row to point at the new source.
- **Currently flagged (see "Flagged" at the bottom):** BR-44 has a known gap (WF-012 amendment
  writes no `AuditLogs`); the SAP legacy gate (WF-018) is a related smell. Both are surfaced, not
  silently changed (ADR-012).

*So "history of BR-22" = ADR-003 (introduced) + K-004 (canonical fact) + any `CHANGE_HISTORY`
entries mentioning `canRejectBudget`/`reject`.*

---

## 1. Budget authoring & editing

| ID | Rule | Enforced by | Governs |
|----|------|-------------|---------|
| BR-01 | Every line amount must be **> 0** | `Money.create`; `CK_BudgetItems_Amount` | domain-model |
| BR-02 | At least one line required to submit | `validateBudgetLines`; `ApprovalService.submit` | domain-model |
| BR-03 | Editable only in `Draft` or `ReturnedForRevision` | `assertCanEditDraft` / `EDITABLE_BUDGET_STATUSES` | state-machines |
| BR-04 | Locked (no line edits) in `Claimed`, `Finalized`, legacy `Approved` | `LOCKED_BUDGET_STATUSES` / `assertNotLocked` | state-machines |
| BR-05 | SAP cost-center code required at submit | `assertSapCodeForSubmit` (`ApprovalService`) | domain-model |
| BR-06 | Owner-only + own cost center for create/edit/submit/amend | `BudgetPlanService` (`costCenterId === actor.primaryCostCenterId`) | permission-matrix |
| BR-07 | Optimistic concurrency: stale writes → 409 | `BudgetPlans.Version` / `RowVersion`; `ConcurrencyConflictError` | domain-model |

## 2. Budget lineage & uniqueness

| ID | Rule | Enforced by | Governs |
|----|------|-------------|---------|
| BR-08 | **One active version per lineage** (Cost Centre + Fiscal Year + Original Budget Type) | `assertNoActiveInLineage`; `UX_BudgetPlans_LineageInPlay` (mig 007) | **K-002**, ADR-006 |
| BR-09 | One live lineage per business key | `UX_BudgetLineage_Key` (mig 007) | ADR-005 |
| BR-10 | Active statuses = `Draft, InApproval, ReturnedForRevision, PendingFinanceReview, Claimed` | `docs/domain-model.md` "Active Budget Version" | **K-002** |
| BR-11 | `Finalized`/legacy `Approved` are immutable & inactive; `Rejected` inactive | state-machines; lineage index filter | K-002 |
| BR-12 | One user may own many budgets; one CC may have up to three catalog categories (`RECURRENT`, `MAJOR`, `CAPEX` codes); unlimited GL lines per budget | `src/domain/constants/budget-types.ts`; `isBudgetCategory`; `docs/domain-model.md` | **K-010** (supersedes K-003) |
| BR-13 | Post-finalize changes only via **Amendment** (new version, same lineage); amend only from `latestFinalizedVersionId` | `BudgetPlanService.createAmendment` | ADR-005 |

## 3. Approval workflow

| ID | Rule | Enforced by | Governs |
|----|------|-------------|---------|
| BR-14 | Approval route built **only** by walking `Users.managerId`; never hardcode titles/roles | `buildApprovalRoute` | ADR-002 |
| BR-15 | `CostCenter.managerId` is the preferred first approver (dashboards/visibility), not the whole route | `buildApprovalRoute` | ADR-002 |
| BR-16 | Broken/circular hierarchy fails closed (route error, notify admin) | `buildApprovalRoute` guards (`CIRCULAR_HIERARCHY`, `MANAGER_MISSING`, `GM_MISSING`) | ADR-002 |
| BR-17 | Exactly one active GM = org root (`managerId IS NULL` + approve) | `AdminUserService.validate`; `resolveOrgRole` | **ADR-007** |
| BR-18 | GM-as-root submit → empty route → straight to Finance (not a self-approve click) | `ApprovalService.submit` (`isGm`) | ADR-007; open-decisions "Root node submit" |
| BR-19 | Only the `currentApproverId` may approve/return/reject on the chain | `assertCurrentApprover` | state-machines |
| BR-20 | Owner cannot approve own budget | `assertCurrentApprover` (not-owner check) | domain-model |
| BR-21 | **Return** → `ReturnedForRevision` (editable/resubmittable); **Reject** → terminal `Rejected` | `ApprovalService.returnForRevision` / `reject` | **ADR-003** |
| BR-22 | Manager or GM may return; **only GM** may permanently reject | `canReturnBudget` / `canRejectBudget` | permission-matrix, **K-004** |
| BR-23 | Return and Reject both require a comment/reason | `ApprovalService` (reason required) | state-machines |

## 4. Finance workflow

| ID | Rule | Enforced by | Governs |
|----|------|-------------|---------|
| BR-24 | Finance actions: claim → finalize / return / release. **Finance never permanently rejects** | `FinanceService`; `canRejectBudget` excludes finance | **ADR-004**, **K-004** |
| BR-25 | At most one active finance claim per plan | `claim()` `ALREADY_CLAIMED`; `UX_FinanceQueueClaims_ActivePlan` | ADR-004 |
| BR-26 | Only the claimant may finalize/return; claimant or SystemAdmin may release | `assertClaimant`; `FinanceService.release` | ADR-004 |
| BR-27 | Finalize freezes an immutable SAP package (one per plan) | `freezeSapPackage`; `UQ_SapPackages_BudgetPlan` | ADR-004/008 |
| BR-28 | Post-GM success path ends at `Finalized` (`Approved` is legacy) | state-machines; metrics must count `Finalized` | ADR-004 |
| BR-29 | Overdue finance items escalate (SLA due dates) | `computeFinanceDueDates`/`isOverdue`; `processEscalations` | domain rule `finance-sla.ts` |

## 5. Fiscal year

| ID | Rule | Enforced by | Governs |
|----|------|-------------|---------|
| BR-30 | At most one `Open` and one `Current` fiscal year | `FiscalYearService`; `UX_FiscalYears_OneOpen`/`OneCurrent` | **K-006** |
| BR-31 | Closed/Archived years are read-only for budget work | `assertFyOpen`/`assertPlanFyOpen` | K-006 |
| BR-32 | Setting current off a still-Open prior year raises a closure task to SystemAdmins; closing it auto-resolves | `FiscalYearService.notifyClosureRequired` / `transition` | WORKFLOWS WF-013 |

## 6. Notifications

| ID | Rule | Enforced by | Governs |
|----|------|-------------|---------|
| BR-33 | Notification stays active until the work is complete; **read ≠ resolved** | `notification-task-actions.markNotificationRead` | **K-001** |
| BR-34 | Badge counts active (unresolved, uncleared) tasks regardless of read state | `GET /api/v1/me`; `listByUser` | K-001 |
| BR-35 | Pending actionable tasks cannot be manually deleted; only resolved history archived | `archiveResolved` (refuses unresolved) | K-001 |
| BR-36 | No two ACTIVE actionable notifications for `(recipient, type, plan/entity)` | repository `create` (atomic SQL guard); mock mirror | **K-009** |
| BR-37 | Workflow terminal step for a recipient resolves their task (`resolvedAt` + `resolvedBy`) | approval/finance/fiscal-year services (in-app support tickets removed — MVP email help only; Change #027) | K-001 |

## 7. Security & RBAC

| ID | Rule | Enforced by | Governs |
|----|------|-------------|---------|
| BR-38 | Authorization enforced in middleware **and** API **and** services; UI never trusted | `middleware.ts`, `AuthorizationService` | **ADR-010** |
| BR-39 | `SystemAdmin` is not a budget approver by default and has no budget visibility via authz | `permission-matrix`; `AuthorizationService` | **K-005** |
| BR-40 | Accounts are admin-provisioned only; no public register/forgot/reset | auth routes; ADR-010 | ADR-010 |
| BR-41 | Production requires `SESSION_SECRET` (≥32); signed httpOnly cookies | `session-token.ts`; startup env validation | ADR-010 |
| BR-42 | App DB login is least-privilege (`app_budget_ops`) | mig 005 | ADR-009 |
| BR-43 | Capability + assignee both required for approve/reject/finance mutations | `AuthorizationService` + `currentApproverId`/claim checks | permission-matrix |

## 8. Audit & history immutability

| ID | Rule | Enforced by | Governs |
|----|------|-------------|---------|
| BR-44 | Every meaningful mutation writes audit (+ workflow history where applicable) | services append `AuditLogs`/`WorkflowHistory` | **ADR-011** |
| BR-45 | `AuditLogs`, `ApprovalHistory`, `WorkflowHistory` are append-only (UPDATE/DELETE denied) | immutability triggers + role DENY (audit/approval) | ADR-011 |
| BR-46 | Immutability triggers disabled only via `scripts/lib/test-database-cleaner.ts` (test teardown) | test cleaner module | CHANGE_HISTORY #010 |

## 9. Configuration & platform

| ID | Rule | Enforced by | Governs |
|----|------|-------------|---------|
| BR-47 | `REPOSITORY_DRIVER` required (`mock|sql`); production refuses non-`sql`; no silent default | `resolveRepositoryDriver`; startup env | **ADR-009**, **K-007** |
| BR-48 | Startup refuses to serve on pending migrations / missing columns / unusable critical DI | `instrumentation.ts` + `database-health.ts` | ADR-009, K-007 |
| BR-49 | Development Toolkit is triple-gated (`NODE_ENV` + `ENABLE_DEVELOPMENT_TOOLKIT` + `SystemAdmin`); never in production | `isDevelopmentToolkitEnabled`; middleware 404 gate | FILE_INDEX §2 |
| BR-50 | Startup Validation subsystem is FROZEN — change only for verified bug/deploy/migration/regression | `.cursor/rules/frozen-subsystems.mdc` | ADR-009 |

## 10. Roles that do not exist (guardrails)
- There is **no `FinancialAnalyst` role** — map "Financial Analyst" in UAT scripts to `FinanceAdministrator` (**K-008**, permission-matrix).
- **No "Western Region" seed user** unless the stakeholder explicitly requests it (`.cursor/rules/feature-e2e-proof.mdc`). ⚠️ See `docs/ENGINEERING_BRAIN.md` §17 "Open items & contradictions" — `docs/open-decisions.md` currently still lists a Western Region assistant as in-scope; this is unreconciled and needs a stakeholder decision.

## Flagged (not silently changed — ADR-012)
- `createAmendment` writes WorkflowHistory but no `AuditLogs` row (WORKFLOWS WF-012) — potential BR-44 gap.

## Resolved smells
- `/sap-export` stale `Approved`-only gate → accepts `Finalized` | `Approved` (BR-28; Change #023).

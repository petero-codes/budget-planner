# DOMAIN_GLOSSARY.md — Business vocabulary

**Purpose:** Define what each term *means to the business*, so words mean the same thing to
everyone. This is the canonical source for **terminology**. It maps a business term to the
code artifact that implements it, but the definition here is the business meaning, not the
table shape (schema → `docs/DATABASE.md`; rules → `docs/BUSINESS_RULES.md`).

Evidence: `src/domain/entities/index.ts`, `src/domain/value-objects/budget-status.ts`,
`docs/domain-model.md`, `docs/permission-matrix.md`. Uncertain items **UNKNOWN**.

---

## People & roles

- **Budget Holder** — the person responsible for a cost centre's budget; creates and submits
  budgets. Implemented as a `User` who is a cost centre's `ResponsiblePersonId` and holds the
  `BudgetSubmitter` role. Not a distinct table.
- **Manager (approver)** — a `User` in the approval chain for a budget; approves or returns
  when they are the `currentApproverId`. Role `BudgetApprover`. The cost centre's approver is
  `CostCenter.managerId`.
- **General Manager (GM)** — the single org root: `User` with `managerId IS NULL` and approve
  capability (role `GeneralManager`). The only role that may **permanently reject**. (K-004, ADR-007)
- **Finance / Finance Administrator** — reviews approved budgets in the Finance queue; claims,
  finalizes, returns, or releases. Role `FinanceAdministrator`. **Outside** the approval
  hierarchy and **cannot permanently reject** (K-004).
- **System Administrator** — manages users, master data, fiscal years, audit. **Not a budget
  approver by default** and has no budget visibility via authorization (K-005). Role `SystemAdmin`.
- **Audit Viewer** — read-only access to the audit trail. Role `AuditViewer`.
- **There is no "Financial Analyst" role** — treat that term as `FinanceAdministrator` unless
  Product adds one (K-008).

## Budget concepts

- **Budget** — the business object a Budget Holder prepares for a cost centre and fiscal year.
  Implemented as a **`BudgetPlan`** (one row per *version*). "Budget" in conversation usually
  means the *lineage* (the ongoing budget for that CC+FY+type), while `BudgetPlan` is a specific version.
- **Budget Version** — a single `BudgetPlan` row. Version 1 is the original; amendments create
  version N+1 in the same lineage.
- **Budget Lineage** — the identity of a budget across versions, keyed by **Cost Centre +
  Fiscal Year + Original Budget Type**. Implemented as `BudgetLineage`. Only **one active
  version** may exist per lineage (K-002).
- **Original Budget Category** — lineage-starting category code: `RECURRENT`, `MAJOR`, or `CAPEX` (`BUDGET_CATEGORY_CATALOG`). Entity field `originalBudgetCategory`; DB column `OriginalBudgetType`. UI label e.g. CAPEX → "Capital Expenditure". Legacy values on old rows are read-only audit history.
- **Amendment** — a controlled change to a budget *after* it is finalized: a new version in the
  same lineage, requiring an amendment reason (ADR-005). Not a free-form duplicate.
- **Line item (GL line)** — one `BudgetItem`: a GL account + amount (> 0) on a budget. A budget
  may hold unlimited line items.
- **GL Account** — a general-ledger account (`GlAccount`) a line item is charged to.
- **Active Budget Version** — a version that is editable or progressing: statuses `Draft`,
  `InApproval`, `ReturnedForRevision`, `PendingFinanceReview`, `Claimed`. `Finalized`/legacy
  `Approved` are immutable & inactive; `Rejected` is inactive. (K-002)

## Workflow concepts

- **Approval** — the act of a `currentApproverId` advancing a budget one step up the chain.
  - *Non-terminal states of a budget in approval:* `InApproval` (advancing), `PendingFinanceReview`,
    `Claimed`, `ReturnedForRevision`.
  - *Terminal states:* `Finalized` (success), `Rejected` (failure).
  - *Responsible role:* `BudgetApprover`/`GeneralManager` for the hierarchy; `FinanceAdministrator`
    for the finance gate.
- **Return (for revision)** — sending a budget back to the owner for edits; status
  `ReturnedForRevision` (editable, resubmittable). Any approver (Manager/GM) or Finance may return.
- **Reject** — permanently closing a budget; status `Rejected` (terminal, immutable). **GM only.** (ADR-003)
- **Approval Route** — the ordered list of approvers for a budget (`ApprovalRoute`), built by
  walking `Users.managerId` (ADR-002). Steps have status `Pending → Approved | Rejected | Invalidated`.
- **Finance Queue** — the pool of budgets in `PendingFinanceReview` awaiting a Finance officer.
- **Claim** — a Finance officer taking exclusive ownership of a queued budget (`Claimed`); one
  active claim per plan (`FinanceQueueClaims`, ADR-004).
- **Release** — a Finance officer returning a claimed budget to the shared queue (`PendingFinanceReview`).
- **Finalize** — Finance completing review; status `Finalized`, and a frozen SAP package is produced.
- **Escalation** — a Finance SLA breach (`EscalationStatus`: `None | Warning | Escalated`) flagged
  when claim/review due dates pass (`finance-sla.ts`).

## Fiscal & organizational

- **Fiscal Year** — a budgeting period (`FiscalYear`) with lifecycle `Open | Closed | Archived`
  and an `isCurrent` flag. At most one Open and one Current at a time (K-006).
- **Cost Centre** — an organizational spending unit (`CostCenter`) belonging to a Department,
  with an approving `managerId` and a `ResponsiblePersonId` (Budget Holder).
- **Department** — an organizational grouping of cost centres (`Department`).
- **Position** — a job title with a display-only `Level` (`Position`); **not** a capability.
- **Submission Status** — a derived per-(Cost Centre, Fiscal Year) view of budgeting progress
  (`CostCenterSubmissionStatus`: `NotStarted | InProgress | Submitted | Returned | Approved |
  Rejected`), projected from budget status by `submissionStatusForBudget`.

## Notification concepts

- **Notification (task)** — an item of outstanding work assigned to a user; stays active until
  the work is complete for that recipient (K-001). Not a message.
- **Actionable notification** — a task type that must be resolved by a workflow action
  (`Approval, FinanceQueue, FinanceClaim, FinanceEscalation, SupportIssue, FiscalYear`).
- **Informational notification (FYI / Outcome)** — an outcome/notice (`Outcome, Finance,
  Amendment, AdminUser`) acknowledged on read.
- **Read** — the recipient opened the notification (`readAt` set); does **not** complete work.
- **Resolved** — the underlying work is done (`resolvedAt` + `resolvedBy` set); moves to History.
- **Badge** — the count of active (unresolved) tasks for the current user.

## Platform terms

- **Repository driver** — `REPOSITORY_DRIVER=mock|sql`, the persistence backend selection
  (ADR-009). `mock` = in-memory (tests/dev); `sql` = SQL Server.
- **SAP package** — the frozen JSON+CSV export produced on finalize (`SapPackages`), Finance's
  SAP-load interchange. See `docs/WHY_SQL_SERVER.md` and `docs/WORKFLOWS.md` WF-018.
- **Development Toolkit** — dev-only tooling (data/workflow simulation), triple-gated and never
  available in production.

---

*Terminology owner: this file. If a term's business meaning changes, update it here first, then
any doc that uses it. If a code artifact is renamed, update the mapping here in the same task (ADR-013).*

# Knowledge Log

**Canonical business & technical facts — the AI's operational memory.**

Distinct from other layers: ADRs record *decisions*, `CHANGE_HISTORY.md` records
*history*, this log records *current truth* — the answers to "how does X work?"
Consult this log before proposing changes; if a change contradicts an entry,
stop and reconcile (update the entry + its ADR in the same task) rather than
silently diverging.

**Every entry must be evidence-backed** (file + symbol). If a fact cannot be
traced to code/schema, it does not belong here — mark it Unknown elsewhere.
When code changes, update the affected entry and its `Last verified` date.

**Knowledge IDs are immutable — never rewrite meaning.** Like ADRs, an entry's
meaning never changes after publication. If a fact changes:

1. Mark the old entry `Status: Superseded by K-NNN` (keep its text intact).
2. Create a new entry with a **new** ID carrying the new fact.

Re-verification (bumping `Last verified`, refining evidence for the *same*
fact) is allowed; changing what the entry asserts is not.

**Contradictions:** if code disagrees with an entry, do not edit either —
follow the Contradiction Detector protocol in `ENGINEERING_GOVERNANCE.md`
(STOP, report, reconcile via user decision or a reconciliation task).

Source-of-truth priority: **Code → DB schema → ADRs → governance docs → README**.
Facts below were confirmed against the cited code symbols via the code-synced
canonical docs (`domain-model.md`, `permission-matrix.md`, dated headers).

## Entry template

```
### K-NNN — <topic>
- Fact:
- Reason:
- Evidence: <file + symbol>
- ADR: <id or None>
- Status: Verified in code | Verified via code-synced doc | Not verified
         | Superseded by K-NNN
- Last verified: YYYY-MM-DD
```

---

### K-001 — Notification lifecycle (task, not message)
- Fact: A notification stays **active** until the represented work is complete. Clicking sets `readAt` and navigates to `targetUrl` but does **not** resolve it; the workflow action sets `resolvedAt` + `resolvedBy`. The header badge counts unresolved tasks (read or unread). Pending actionable tasks cannot be manually deleted; only resolved history can be archived.
- Reason: Notifications model assigned work, so opening ≠ handling.
- Evidence: `src/domain/entities/index.ts` (`Notification`, `isActionableNotification`); `src/application/notification-task-actions.ts` (`markNotificationRead`, `notificationDestination`); resolution in approval/finance/fiscal-year services; `tests/unit/notification-read-lifecycle.test.ts`.
- ADR: None (behavioral; recorded in CHANGE_HISTORY #001)
- Status: Verified in code
- Last verified: 2026-07-23

### K-002 — Active Budget Version & uniqueness
- Fact: An **active** version is one editable or progressing: statuses `Draft`, `InApproval`, `ReturnedForRevision`, `PendingFinanceReview`, `Claimed`. Only **one** active version may exist per **Cost Centre + Fiscal Year + Original Budget Type** (Budget Lineage). `Finalized`/legacy `Approved` are immutable & inactive; `Rejected` is inactive.
- Reason: Prevent duplicate/competing budgets for the same business key.
- Evidence: `docs/domain-model.md` → "Active Budget Version"; index `UX_BudgetPlans_LineageInPlay` (migration `007`); `BudgetPlanService`.
- ADR: See ADR log (lineage) + `docs/domain-model.md`
- Status: Verified via code-synced doc
- Last verified: 2026-07-18

### K-003 — Budget ownership multiplicity
- Fact: One user can own **multiple** budgets. One cost centre can have **multiple** original budget types (`Primary`, `Supplementary` today). Per CC+FY+type, only **one active** version. Finalized budgets cannot be edited/deleted — changes become an **Amendment** (new version, same lineage). One budget holds unlimited GL line items.
- Reason: Real budgeting needs several budget types per CC while keeping one in-play version each.
- Evidence: `docs/domain-model.md` → "Budget ownership & multiplicity"; `ORIGINAL_BUDGET_TYPES`; `BudgetPlanService.amend`.
- ADR: None (product rule)
- Status: **Superseded by K-010** (catalog replaced Recurrent/Major/CAPEX — Change #024)
- Last verified: 2026-07-18

### K-010 — Budget category catalog (Recurrent, Major, CAPEX)
- Fact: The only valid **original budget categories** use codes `RECURRENT`, `MAJOR`, and `CAPEX` (`BUDGET_CATEGORY_CATALOG` in `src/domain/constants/budget-types.ts`). Domain field `budgetCategory`; DB column `BudgetType`. UI labels are separate (e.g. CAPEX → "Capital Expenditure"). Legacy values (`Primary`, `Supplementary`, etc.) are **read-only** on historical rows — the application will not generate them anymore; they remain for audit only.
- Reason: KenGen Finance classification for reporting and SAP handover.
- Evidence: `budget-types.ts`; `isBudgetCategory`; `budget-plan-service.ts` create gate; Finance `byBudgetCategory` dashboard; Reports category filter/grouping; SAP CSV `BudgetType` column (code) + compliance `Category` row (label).
- ADR: None (product rule — Change #024)
- Status: Verified via code
- Last verified: 2026-07-22

### K-011 — MVP support is email-only (no in-app tickets)
- Fact: Users report problems via `mailto:ict-support@kengen.co.ke` (`SUPPORT_MAILTO` in `src/lib/shared/support-contact.ts`). In-app SupportIssue UI/API/services are **removed**. Migration `009` tables `SupportIssues` / `SupportIssueSequence` remain in the schema but are unused.
- Reason: MVP simplification — ship workflow product; ticketing is out of scope.
- Evidence: footer + user-dropdown Help links; deleted `support-issue-service.ts` / `/api/v1/support-issues*`; FEATURE_REGISTRY "Removed (MVP)"; CHANGE_HISTORY #027.
- ADR: None
- Status: Verified in code
- Last verified: 2026-07-23

### K-004 — Finance cannot permanently reject
- Fact: Finance may **return** or **finalize** (and claim/release) — never permanently reject. Only the **GM** may permanently reject a budget.
- Reason: Rejection is a hierarchy authority; Finance handles review outcomes via return/finalize.
- Evidence: `docs/domain-model.md` Invariants ("Finance cannot permanently reject", "Only GM may permanently reject"); `AuthorizationService.canRejectBudget`; `FinanceService` (return/finalize only).
- ADR: None (invariant)
- Status: Verified via code-synced doc
- Last verified: 2026-07-18

### K-005 — SystemAdmin is not a budget approver by default
- Fact: `SystemAdmin` manages users, master data, fiscal years, and audit — it does **not** carry `budget.approve` by default and has no budget visibility via authorization. Approval requires `budget.approve` + matching `currentApproverId` + not-owner.
- Reason: Separation of duties between administration and budget authority.
- Evidence: `docs/permission-matrix.md` (role table + default permissions; SystemAdmin lacks `budget.approve`); `AuthorizationService`.
- ADR: ADR-010 (session auth & server-side RBAC)
- Status: Verified via code-synced doc
- Last verified: 2026-07-18

### K-006 — Fiscal year singletons
- Fact: At most **one Open** fiscal year and at most **one Current** fiscal year at a time. Closed/Archived years are read-only for budget work.
- Reason: Deterministic default period and prevention of parallel open cycles.
- Evidence: `docs/domain-model.md` Invariants; `FiscalYearService`; filtered unique indexes `UX_FiscalYears_OneOpen`, `UX_FiscalYears_OneCurrent` (`docs/schema.sql`).
- ADR: None (invariant)
- Status: Verified via code-synced doc
- Last verified: 2026-07-18

### K-007 — Repository driver is required; startup validates readiness
- Fact: `REPOSITORY_DRIVER` must be set explicitly (`mock`|`sql`); no silent default. Production refuses non-`sql`. Startup (`instrumentation.ts`) validates env + SQL reachability + schema version and refuses to start on pending migrations, missing migration columns, or unusable critical DI services.
- Reason: Config drift previously surfaced as false 401s; fail-fast removes that class of bug.
- Evidence: `src/infrastructure/startup/env.ts` (`resolveRepositoryDriver`), `src/instrumentation.ts`, `src/infrastructure/startup/database-health.ts`; ADR-009.
- ADR: ADR-009 (Subsystem status: Startup Validation FROZEN)
- Status: Verified in code
- Last verified: 2026-07-18

### K-008 — There is no FinancialAnalyst role
- Fact: Role codes are `BudgetSubmitter`, `BudgetApprover`, `GeneralManager`, `FinanceAdministrator`, `SystemAdmin`, `AuditViewer`. "Financial Analyst" in UAT scripts maps to **FinanceAdministrator** unless Product adds a distinct role.
- Reason: Avoid inventing a non-existent role in tests/docs.
- Evidence: `src/domain/value-objects/budget-status.ts` (`RoleCode`); `docs/permission-matrix.md`.
- ADR: None
- Status: Verified via code-synced doc
- Last verified: 2026-07-18

### K-009 — No duplicate active task notifications
- **Repository invariant.** At most one ACTIVE actionable notification may exist for the tuple `(recipient userId, notification type, entity)` where `resolvedAt IS NULL AND isCleared = 0`. The entity key is `relatedPlanId`, falling back to `entityId` when there is no plan. The guard applies only to actionable types (`ACTIONABLE_NOTIFICATION_TYPES`); informational types (e.g. `Outcome`) are exempt and may repeat. A resolved or archived task never counts, so a fresh task for the same plan is allowed (e.g. resubmit after return).
- Enforcement: repository `create`. SQL enforces it in a single atomic statement — `INSERT … SELECT … WHERE @dedupe = 0 OR NOT EXISTS (… WITH (UPDLOCK, HOLDLOCK) …)` — so no race can create twins; the mock mirrors the same predicate. Every caller inherits the rule; no service needs a pre-check.
- Reason: Duplicate to-do entries misstate the badge count and let a user "complete" a task while a stale twin remains active.
- Evidence: `src/infrastructure/repositories/sql/index.ts` (`SqlNotificationRepository.create`), `src/infrastructure/repositories/mock/index.ts` (`MockNotificationRepository.create`), `tests/unit/notification-dedup.test.ts`, harness check "NEG duplicate active Approval create is a no-op" in `scripts/e2e-notification-spine.ts`.
- Scope note (deliberately deferred): this guard prevents *new* duplicates only. Any historical duplicate rows created before this change are not retro-removed. A future migration may include an optional cleanup step if historical duplicate removal becomes a business requirement.
- ADR: None (repository invariant supporting K-001)
- Status: Verified in code + unit tests + local SQL harness
- Last verified: 2026-07-18

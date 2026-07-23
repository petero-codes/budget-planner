# FEATURE_REGISTRY.md — Feature status at a glance

**Purpose:** One high-level table of what the system does and how well-proven each feature is.

**Single responsibility:** status roll-up only. The *evidence* for each status is the 12-point
proof in `docs/feature-e2e-proof.md` (canonical). Rules → `BUSINESS_RULES.md`; workflows →
`WORKFLOWS.md`. This file must not restate proofs — it links them.

**Honesty policy (governance):** no "Complete/Production-ready" without evidence. Status reflects
the *highest verification level actually reached*, using this vocabulary:

- **Code+Unit** — implemented with passing unit tests.
- **Service-verified** — additionally exercised end-to-end against **local SQL** (harness).
- **Browser-pending** — code/tests done; **browser/staging UAT (proof points 11–12) still owed**.
- **Deferred** — intentionally not shipped in v1 (see `open-decisions.md`).

Owner = the subsystem in `.cursor/rules/frozen-subsystems.mdc`.

---

| Feature | Status | Owner subsystem | Docs | Tests | Evidence |
|---------|--------|-----------------|------|-------|----------|
| Authentication & session | Browser-pending | Authentication & Session Security (Active) | ✓ | ✓ | ADR-010; `feature-e2e-proof.md`; K-007 |
| RBAC / authorization | Code+Unit | Authentication & Session Security (Active) | ✓ | ✓ | ADR-010; `permission-matrix.md`; `authorization-service.ts` |
| Budget create / edit / submit | Browser-pending | Approval Engine (Active) | ✓ | ✓ | `budget-plan-service.ts`; `feature-e2e-proof.md` |
| Approval routing (managerId walk) | Service-verified | Approval Engine (Active) | ✓ | ✓ | ADR-002; `approval-service.ts`; `e2e:spine` |
| Approve / Return / Reject | Service-verified | Approval Engine (Active) | ✓ | ✓ | ADR-003; K-004; `e2e:spine` |
| Budget lineage & amendments | Code+Unit | Approval Engine (Active) | ✓ | ✓ | ADR-005/006; K-002; **audit-on-amend flagged, §17 BRAIN** |
| Finance queue: claim/finalize/return/release | Service-verified | Finance Workflow (Active) | ✓ | ✓ | ADR-004; K-004; `finance-service.ts`; `e2e:spine` |
| Finance SLA / escalation | Code+Unit | Finance Workflow (Active) | ✓ | ~ | `finance-sla.ts` (escalation states) |
| SAP export package | Code+Unit | SAP Export (Active) | ✓ | ~ | ADR-004; `sap-compliance-service.ts`; `sap-export` accepts Finalized (Change #023) |
| Notifications (task-based) | Service-verified | Notification Engine (Active) | ✓ | ✓ | K-001/K-009; `notification-*` tests; `e2e:spine` |
| Notification bell + deep-links | Code+Unit | Notification Engine (Active) | ✓ | ✓ | CHANGE_HISTORY #011; `notification-bell.tsx` |
| Fiscal year lifecycle | Code+Unit | Master Data (Active) | ✓ | ✓ | K-006; `fiscal-year-service.ts` |
| Master data (dept/CC/GL/users) | Code+Unit | Master Data (Active) | ✓ | ✓ | `master-data-service.ts`; `admin-user-service.ts` |
| Audit trail (immutable) | Code+Unit | (cross-cutting) | ✓ | ✓ | ADR-011; INV-6/7/8 |
| Reports (executive/finance) | Browser-pending | Reports (Active) | ~ | ~ | `executive-service.ts`; `dashboard-service.ts` |
| Support issues | **Removed (MVP)** — email `ict-support@kengen.co.ke` | — | — | Tables from mig 009 retained unused |
| Startup validation & health | Service-verified | **Startup Validation (FROZEN)** | ✓ | ✓ | ADR-009; K-007; `database-health` route |
| Development Toolkit | Code+Unit | Development Toolkit (Active) | ✓ | ~ | migration 008; triple-gated |
| Attachments (upload UX/API) | Deferred | Approval Engine (Active) | ✓ | — | ADR-008; `open-decisions.md` |
| Monthly/quarterly line amounts | Deferred | Approval Engine (Active) | ✓ | — | v2; `open-decisions.md` |
| Approval delegation | Deferred | Approval Engine (Active) | ~ | — | `open-decisions.md` |

Legend: **✓** present · **~** partial / thin · **—** none/not applicable.

---

## Notes

- **Browser-pending is the current release gate.** Milestone: Validation (ADR-014) — browser/
  staging UAT across every role closes proof points 11–12 for the flows above. Track in
  `docs/staging-e2e-acceptance.md`.
- **Tests "~"** means the area has some coverage but not the full unit+integration set expected by
  the Definition of Done; treat as a known gap, not a claim of completeness.
- **Flagged items (§17 of `ENGINEERING_BRAIN.md`):** amendment audit-log coverage.
  (SAP export `Approved`-only gate resolved Change #023.)

*Update a row's status only when its `feature-e2e-proof.md` evidence changes. This is a
requirement on every feature change (governance doc-update matrix).*

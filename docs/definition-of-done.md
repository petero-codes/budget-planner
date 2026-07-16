# Definition of Done

A change is complete only when all applicable items pass.

**Process:** `docs/ENGINEERING_GOVERNANCE.md`  
**Current milestone:** Milestone 2 — Stabilization (Milestone 1 Code Complete ✅)

## Checklist (every change)

- [ ] Business rules in domain/service (not UI/controller)
- [ ] Validation: client + DTO + domain (where applicable)
- [ ] Authorization: permission + currentApproverId / visibility / claim ownership
- [ ] Audit + ApprovalHistory / workflow history on mutating actions
- [ ] Transaction/UoW or equivalent atomicity for multi-write paths
- [ ] Loading, empty, and error UI states (when UI touched)
- [ ] TypeScript clean · ESLint clean · unit tests pass
- [ ] Documentation updated **or** drift listed per Documentation Consistency Policy
- [ ] No TODOs, dead code, or unrelated file changes outside approved scope
- [ ] No RBAC / workflow / audit regressions

## Stabilization additions (Milestone 2)

- [ ] No new features unless explicitly requested
- [ ] Security findings addressed or residual risk documented
- [ ] Production blockers tracked in `docs/production-readiness.md` / audit
- [ ] Attachment decision: shipped **or** formally deferred
- [ ] No Priority Documentation Drift on: `state-machines.md`, `domain-model.md`, `permission-matrix.md`, `approval-engine.md`
- [ ] Business Rule Freeze respected (no unapproved workflow / RBAC / schema / API contract changes)
- [ ] Numeric M2 gate aware: 0 Critical · 0 High · ≤5 Medium (see `ENGINEERING_GOVERNANCE.md`)

## Documentation-only changes

Do **not** mark “Tests: Not applicable.”

**Verification** (all required):

- [ ] Reviewed links  
- [ ] Reviewed references  
- [ ] Reviewed document consistency  
- [ ] Verified no runtime artifacts changed  


## Feature-specific examples

### Budget Submit

- Domain invariant tests pass
- ApprovalService builds route via managerId
- SAP code validated
- Amount > 0 on all lines
- Audit + history written
- Root (empty route) completes per locked workflow (not a self-approve click)

### Approve / Return / Reject

- Actor === currentApproverId (manager/GM path)
- Owner cannot approve own
- Return → `ReturnedForRevision` (editable); Reject → terminal `Rejected` (comment required)
- Route advances or hands off to Finance when GM path completes
- Finance does not permanently reject (return or finalize only)

### Finance claim / finalize

- Claim exclusive (claimant or SystemAdmin reassignment)
- Finalize → `Finalized`; Return → `ReturnedForRevision`; Release audited
- Required attachments enforced when attachment feature is enabled

### SAP Export

- Eligible when plan is **Finalized** (legacy `Approved` only for migration reads)
- Columns per `docs/api-contracts.md` / export implementation
- Visibility / permission enforced

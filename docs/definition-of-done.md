# Definition of Done

A feature is complete only when all applicable items pass.

## Checklist (every feature)

- [ ] Business rules in domain/service (not UI/controller)
- [ ] Validation: client + DTO + domain
- [ ] Authorization: permission + currentApproverId / visibility
- [ ] Audit + ApprovalHistory on mutating actions
- [ ] Transaction/UoW (Phase 4) or mock atomicity (Phases 1–3)
- [ ] Loading, empty, and error UI states
- [ ] Unit tests pass; integration tests (Phase 4)
- [ ] Documentation updated
- [ ] No TODOs, dead code, or unrelated file changes

## Feature-specific examples

### Budget Submit

- Domain invariant tests pass
- ApprovalService builds route via managerId
- SAP code validated
- Amount > 0 on all lines
- Audit + history written
- Root auto-Approves when route empty

### Approve / Reject

- Actor === currentApproverId
- Owner cannot approve own
- Reject requires comment
- Route advances or completes
- SAP eligible only when Approved

### SAP Export

- Only Approved plans
- Columns: CostCenter, CostElement, Amount, Version, Fiscal_year
- Visibility enforced

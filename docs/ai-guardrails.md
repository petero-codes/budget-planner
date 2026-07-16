# AI Guardrails

**Canonical process:** `docs/ENGINEERING_GOVERNANCE.md`  
**Decisions:** `docs/ARCHITECTURE_DECISIONS.md`  
**Current milestone:** Milestone 2 — Stabilization (see governance)

## Mandatory

- Operate in **stabilization mode**: no new features unless the stakeholder explicitly requests them.
- Execute work within the **current milestone**; stop and ask before jumping ahead.
- Never hardcode titles or roles in approval logic — use `managerId` walk only.
- Never rewrite stable modules without stating justification.
- Never modify unrelated files.
- Never change API contracts without updating `docs/api-contracts.md` and consumers.
- Never duplicate logic across layers.
- Never invent business rules — ask if not in docs / ADRs.
- Ask before introducing new dependencies.
- Complete Definition of Done before marking work verified.
- Implement happy path **and** error/loading/empty states together when UI is touched.
- No TODOs in merged code; delete dead code; no placeholder / fake UI.
- **Documentation Consistency Policy:** on any behavior/workflow/permission/API/state-machine/architecture change, update priority docs in the same task **or** list them under **Documentation Drift** in the task report. Never leave docs silently wrong.
- **Priority Documentation Drift release gate:** Milestone 2 is not Complete while `docs/state-machines.md`, `docs/domain-model.md`, `docs/permission-matrix.md`, or `docs/approval-engine.md` contradict live behavior.
- **Business Rule Freeze:** do not change approval hierarchy, finance workflow, lineage, versioning, CC ownership, RBAC, notifications, audit model, schema, or API contracts without explicit approval plus justification, impact, security, and rollback.
- Documentation-only work uses a **Verification** checklist — never “Tests: Not applicable.”

## Approval engine rule

```text
NEVER: if (role === "Manager") / if (title === "GM")
ALWAYS: walk Users.managerId → ApprovalRoute
```

## Historical build phases (reference only)

These were the original build gates. **Release progress is now tracked by milestones in `docs/ENGINEERING_GOVERNANCE.md`**, not by continuing Phase 0–4 feature expansion.

1. Phase 0a docs → review  
2. Phase 1 foundation + routing tests → review (no schema.sql yet)  
3. Phase 0b schema → review  
4. Phase 2 budget create → review  
5. Phase 3 approval UI → review  
6. Phase 4 SQL + API + SAP → release  

Milestone 1 (Code Complete) covers the intent of those build phases. Further work follows Milestones 2–4.

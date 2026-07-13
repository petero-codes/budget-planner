# AI Guardrails

## Mandatory

- Execute **one phase at a time**; stop for human review at each gate.
- Never hardcode titles or roles in approval logic — use `managerId` walk only.
- Never rewrite stable modules without stating justification.
- Never modify unrelated files.
- Never change API contracts without updating `docs/api-contracts.md` and consumers.
- Never duplicate logic across layers.
- Never invent business rules — ask if not in docs.
- Ask before introducing new dependencies.
- Complete Definition of Done before marking a feature done.
- Implement happy path **and** error/loading/empty states together.
- No TODOs in merged code; delete dead code; no placeholder files.

## Approval engine rule

```text
NEVER: if (role === "Manager") / if (title === "GM")
ALWAYS: walk Users.managerId → ApprovalRoute
```

## Phase gates

1. Phase 0a docs → review
2. Phase 1 foundation + routing tests → review (no schema.sql yet)
3. Phase 0b schema → review
4. Phase 2 budget create → review
5. Phase 3 approval UI → review
6. Phase 4 SQL + API + SAP → release

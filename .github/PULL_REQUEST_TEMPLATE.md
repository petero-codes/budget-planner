## Summary

<!-- 1–3 bullets: what this PR does and why -->

-

## Change impact (required — answer every question)

### Business rules changed?

- [ ] NO
- [ ] YES — BR IDs: <!-- e.g. BR-12, BR-19 -->
  - Reason:

### Workflow changed?

- [ ] NO
- [ ] YES — WF IDs: <!-- e.g. WF-006, WF-009 -->
  - Reason:

### Database changed?

- [ ] NO
- [ ] YES — Migration: <!-- e.g. 013 -->
  - Tables / indexes / triggers:

### Knowledge introduced?

- [ ] NO
- [ ] YES — K entries: <!-- e.g. K-010 (new) or "K-004 superseded by K-011" -->

### Architecture changed?

- [ ] NO
- [ ] YES — ADR: <!-- e.g. ADR-013 updated / new ADR-014 -->

### Documentation updated? (tick what this PR co-changed)

- [ ] `WORKFLOWS.md`
- [ ] `BUSINESS_RULES.md`
- [ ] `DATABASE.md`
- [ ] `KNOWLEDGE_LOG.md`
- [ ] `ENGINEERING_BRAIN.md` / `SYSTEM_DECISIONS.md`
- [ ] `DEPENDENCY_MAP.md`
- [ ] `CHANGE_HISTORY.md`
- [ ] `docs/release-notes/<branch>.md`
- [ ] N/A — waiver marker used: <!-- e.g. [no-behavior-change] -->

> Docs Guard CI enforces the mechanical co-change matrix
> (`docs/ENGINEERING_GOVERNANCE.md` → Change → docs matrix). Fill this section so
> reviewers can check **semantic** correctness, not just file presence.

## Test plan

- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `npm run docs:check`
- [ ] Gate A items from `docs/RELEASE_CHECKLIST.md` (as applicable)

## Rollback

<!-- How to undo this PR if it ships wrong. Note irreversible audit writes. -->

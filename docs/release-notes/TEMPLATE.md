# Release Note — <branch name>

> Standardized per-branch engineering record. Fill this in before opening the PR.
> The PR description should reference this file rather than duplicate it.

- Branch: `feature|bugfix|docs/<name>`
- Target: `develop`
- Date:
- Author:
- Subsystems: `<name (Active|Frozen)>` — and which frozen ones you confirmed untouched

## Problem solved
<one or two sentences: the concrete gap/defect this branch closes>

## Why this solution
<the chosen approach and why, including alternatives rejected and any invariant introduced>

## Files changed
- Added:
- Modified:
- Deleted:

## Repository Impact
| Dimension | Value |
|---|---|
| Files modified | |
| Files added | |
| Files deleted | |
| Public APIs changed | No / list |
| Database schema changed | No / migration NNN |
| Business rules changed | No / BR-NNN |
| Permissions changed | No / codes |
| Configuration changed | No / keys |
| ADR updated | No / ADR-NNN |
| Knowledge Log updated | No / K-NNN |
| Tests added | |
| Tests updated | |
| Documentation updated | (list filenames) |

## Verification evidence (layered)
- Code (lint/build):
- Tests (unit):
- Application Service Runtime (service layer + DB):
- Browser Runtime (UI/HTTP/cookies/routing): Pending / YES / NO
- Docs:

## Known limitations
- Limitation · Reason · Impact · Future recommendation

## Rollback plan
<revert instructions; note whether a schema migration or data loss is involved>

## Follow-up work
<explicitly deferred items, with where they are tracked>

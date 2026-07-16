# Pre-Staging Readiness Dashboard

**Date:** 2026-07-16  
**Source:** `docs/pre-staging-verification-2026-07-16.md` (reclassified) · automated quality gates  
**Code modified for this dashboard:** None

## Executive summary

| Metric | Status |
|--------|--------|
| Build | Pending clean staging build at deploy time |
| TypeScript (`tsc --noEmit`) | Pass |
| ESLint | Pass |
| Unit Tests | **73/73** Pass |
| Security Verification | Pass (`docs/rbac-security-verification-2026-07-16.md`) |
| RBAC Verification | Pass (0 Critical/High authz bypasses) |
| Documentation Sync (priority docs) | Pass |
| **Critical code defects** | **0** |
| **High code defects** | **0** |
| **Configuration blockers** | **2** |
| **Ready for Staging** | Pending configuration checklist |

## What was the “Critical” finding?

| Field | Answer |
|-------|--------|
| Original ID | F-C1 |
| Finding | Staging may run on **mock** repositories if `REPOSITORY_DRIVER` is unset (`di.ts` defaults to `mock`) |
| Classification | **Configuration** (operational prerequisite) — **not** a code security vulnerability and **not** a functional defect when env is set correctly |
| Why it was over-labeled | Misconfiguration would silently invalidate staging evidence; that is a deploy gate, not a codebase Critical |

**Companion config item (was F-H1):** `SESSION_SECRET` ≥32 required when `NODE_ENV=production` — also **Configuration**, not a code defect.

## Finding taxonomy (use for all future reports)

| Category | Blocks Staging? | Blocks Production? |
|----------|-----------------|--------------------|
| Code Defect | Yes (if Critical/High) | Yes |
| Security Vulnerability | Yes | Yes |
| Configuration | Yes (if required for valid staging) | Yes |
| Operational | No | Maybe |
| Documentation | No | No |
| Enhancement | No | No |

## Configuration blockers (must clear before deploy)

| # | Item | Status |
|---|------|--------|
| 1 | `REPOSITORY_DRIVER=sql` | ☐ |
| 2 | `SQLSERVER_CONNECTION_STRING` verified | ☐ |
| 3 | `SESSION_SECRET` configured (≥32) | ☐ |
| 4 | HTTPS enabled | ☐ |
| 5 | Database reachable | ☐ |
| 6 | Seed data loaded | ☐ |
| 7 | Migrations current (through `007`) | ☐ |
| 8 | Build passes | ☐ |
| 9 | Tests pass | ☐ |
| 10 | Lint passes | ☐ |

**Do not deploy staging until 1–10 are checked.**

## Residual (non-blocking for staging deploy)

| Category | Count | Examples |
|----------|------:|----------|
| Code / UX Medium | ~8 | Non-functional header FY selector; draft/amendment audit gaps; silent secondary-panel catches |
| Operational | 1 | Do not set `SMTP_HOST` until mailer implemented |
| Enhancement | 1 | Login success/failure audit trail |
| Low / Info | ~13 | Env example drift, access-denied home link, dual FY admin entry points |

## Verdict

**Codebase:** Ready for staging from a Critical/High **code and security** perspective (0 / 0).  
**Environment:** Not ready until the configuration checklist above is complete.  
**Overall:** **Pending configuration** — then deploy and execute `docs/staging-e2e-acceptance.md`.

## Next steps

1. Resolve the two primary configuration blockers (`REPOSITORY_DRIVER=sql`, `SESSION_SECRET` as required).  
2. Complete the full pre-deploy checklist.  
3. Deploy staging.  
4. Execute the acceptance matrix (technical E2E + UAT).  
5. Fix only what E2E uncovers.  
6. Produce the release dossier.  
7. Go / Conditional Go / No Go.

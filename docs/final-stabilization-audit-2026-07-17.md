# Final Stabilization & Production Audit

| Field | Value |
|-------|-------|
| **Date** | 2026-07-17 |
| **Scope** | Full repository — feature-frozen stabilization |
| **Business rules** | **LOCKED** — no approval / lineage / finance / amendment / FY / RBAC model changes |
| **Git** | Report first — **await approval** before commit / push |

---

## Repository Health Score

**82 / 100 — CONDITIONAL GO**

| Area | Score | Notes |
|------|-------|-------|
| Correctness (unit) | 95 | 91/91 tests pass |
| TypeScript | 100 | 0 errors |
| Lint | 100 | Clean |
| Security (app layer) | 82 | Sound RBAC/session/CSRF/SQL params; ops High items remain |
| Architecture | 72 | Clean domain; API error drift reduced; ports still under infra |
| Production build | 90 | Green with `REPOSITORY_DRIVER=sql` |
| Ops readiness | 55 | Secrets, TLS, SQL password rotation, E2E not verified |
| Documentation | 75 | Prior audits exist; some drift vs current toolkit work |

---

## Critical Issues

| ID | Finding | Status | Action |
|----|---------|--------|--------|
| C1 | `REPOSITORY_DRIVER` defaulting to `mock` in a misconfigured production deploy | **Mitigated in code** | Fail-closed when `NODE_ENV=production` and driver ≠ `sql` (skips `next build` phase only) |
| C2 | `SESSION_SECRET` unset / weak in production | **Ops gate** (code already throws if missing/short in prod) | Set ≥32-char secret before go-live |
| C3 | Default SQL login password in migration 005 (`BudgetOps_App_2026!`) | **Ops gate** | Rotate before any network-reachable deploy |

No Critical **code defects** remaining in the locked business workflows under correct configuration.

---

## High Issues

| ID | Finding | Status | Recommendation |
|----|---------|--------|----------------|
| H1 | SQL `TrustServerCertificate=Yes` always on (`pool.ts`) | Open (ops/config) | Production: trusted CA cert; trust-bypass only for local/dev |
| H2 | Unused `mailer.ts` throws if `SMTP_HOST` set when later wired | Open (dead code) | Do not set `SMTP_HOST` until transport implemented; or remove dead module after approval |
| H3 | Duplicate Fiscal Year UIs (`/admin` tab vs `/admin/fiscal-years`) | Open (maintainability) | Consolidate later — **do not delete blindly** (behavior may differ by role) |
| H4 | Half-removed self-service auth (`/register`, `/verify-email`, stubs) | Open (dead surface) | Safe to remove after approval if product stays admin-provisioned |
| H5 | Read API routes returned **500** for session expiry | **Fixed this audit** | Shared `readApiError` → 401 for session errors |
| H6 | Development Toolkit destructive on any budget when enabled | Accepted (dev-only) | Keep `ENABLE_DEVELOPMENT_TOOLKIT=false` in staging/prod |

---

## Medium Issues

| ID | Finding |
|----|---------|
| M1 | Middleware cookie claims vs `/api/v1/me` DB permissions can drift until re-login |
| M2 | Application layer imports repository ports from `infrastructure/` (Clean Architecture inversion) |
| M3 | Some routes still orchestrate `repos` directly (audit, reports, me) |
| M4 | Migration `USE` inconsistency (001–004, 008–009 vs 005–007) |
| M5 | `BudgetLineage.ArchivedAt` column unused by `setArchived` |
| M6 | Dual FY APIs (`/api/v1/fiscal-years` vs `/api/v1/admin/fiscal-years`) |
| M7 | CSP allows `'unsafe-inline'` scripts (typical Next.js tradeoff) |

---

## Low Issues

| ID | Finding |
|----|---------|
| L1 | Duplicate `en-GB` date formatting helpers across pages |
| L2 | `newId(prefix)` ignores prefix (always UUID) — misleading but safe |
| L3 | Deprecated `Approved` status still referenced alongside `Finalized` |
| L4 | Finance SLA uses calendar days (business-day logic deferred — product note, not a defect to “fix” under freeze) |

---

## Security Findings

**Solid**

- HMAC signed sessions; `httpOnly` / `sameSite=lax` / `secure` in production
- Same-origin CSRF on mutating APIs; rate limits on auth + sensitive paths
- Parameterized SQL throughout repositories
- No `dangerouslySetInnerHTML` found
- Development Toolkit dual-gated (`NODE_ENV=development` **and** flag) + SystemAdmin + middleware 404
- Audit immutability (DENY + triggers) for AuditLogs / ApprovalHistory
- API permission checks reload from DB via `getCurrentUser()`

**Residual / ops**

- H1 TLS trust bypass  
- C3 default SQL password  
- Cookie claim lag after role revocation (accepted debt)  
- Toolkit must never be enabled against production data  

**Business rules:** No security finding required changing approval, lineage, finance queue, amendments, or FY rules. **Stopped** — no rule changes made.

---

## Architecture Findings

- Domain layer remains pure (no outward infra imports).
- Application → infrastructure port imports remain (known debt; not refactored for style).
- Toolkit lineage insert order and audit UUID coercion are correct for SQL FKs.
- Toolkit SQL/domain errors map to 400/403/409 instead of opaque 500s.
- Production build must not statically prerender authenticated client shells → `dynamic = "force-dynamic"` on root + portal layouts.

---

## Performance Findings

- No Critical N+1 introduced in this audit window.
- Unit suite ~11s — acceptable.
- Bundle/lazy-loading not deeply profiled; no emergency changes.
- Mock UoW is non-transactional — cannot catch partial-failure bugs in tests (Medium test gap).

---

## Dead Code / Duplicates

| Item | Verdict |
|------|---------|
| `src/lib/mailer.ts` | Unused; dangerous if SMTP_HOST set — **recommend remove after approval** |
| Auth stub pages/APIs (register/forgot/reset/verify) | Dead / 403 shells — **recommend remove after approval** |
| Duplicate FY admin surfaces | **Do not remove without product decision** |
| `as any` / `@ts-ignore` | **None found** in `src/` / `tests/` |
| Active `TODO`/`FIXME`/`HACK` in live paths | Essentially clean (mailer TODO only) |

**Not removed in this pass** — awaiting your approval before deleting files.

---

## Files Modified (this audit — correctness / stability / security only)

| Area | Files |
|------|-------|
| Production driver gate | `src/infrastructure/di.ts` |
| Auth error envelope | `src/lib/security/read-api-error.ts` + 16 API routes |
| Build/prerender | `src/app/layout.tsx`, `src/app/(portal)/layout.tsx` |
| Prior session work (already in tree) | Development Toolkit UX, lineage FK order, audit UUID coercion, toolkit SQL error mapping, migration 008 applied |

**Business-rule files:** untouched (approval-service, finance queue rules, lineage uniqueness rules, FY state machine logic beyond error mapping wrappers).

---

## Files Removed

**None** (pending approval).

---

## Tests Executed

| Suite | Result |
|-------|--------|
| `npm test` (vitest) | **91/91 passed** (21 files) |
| Skipped tests | **0** |

---

## TypeScript Result

`npx tsc --noEmit` → **0 errors**

---

## Lint Result

`npm run lint` → **No ESLint warnings or errors**

---

## Build Result

| Attempt | Result |
|---------|--------|
| Initial failures | Static prerender `useContext` on client pages; production mock-driver throw during build; null-safe `useParams`/`usePathname`/`useSearchParams` |
| Mitigations | `force-dynamic` on portal + auth layouts; production SQL gate skips `phase-production-build`; nullish guards on navigation hooks; `pages/_error` + `app/not-found` |
| **Final `npm run build`** | **SUCCESS** (exit 0) with `REPOSITORY_DRIVER=sql` |

**Runtime path:** `next start` with `REPOSITORY_DRIVER=sql` + `SESSION_SECRET` (≥32 chars) + `ENABLE_DEVELOPMENT_TOOLKIT=false`.

---

## Git Commits

**None yet.** Awaiting your approval to stage, commit, and push.

Proposed commit split (if approved):

1. `fix: map session failures to 401 on read APIs and fail closed on mock driver in production`
2. `fix: force-dynamic layouts to stabilize production build prerender`
3. (If already uncommitted from toolkit work) `fix: development toolkit SQL lineage order, audit UUIDs, and error mapping`

---

## Remaining Risks

1. No automated browser E2E in CI — critical workflows still manual (`docs/staging-e2e-acceptance.md`).
2. Ops: rotate SQL password; configure real TLS; set `SESSION_SECRET`; never enable toolkit in prod.
3. SMTP not implemented — password-reset email path depends on admin tooling / future mailer.
4. Middleware vs live permission lag until re-login.
5. Duplicate FY admin UX — drift risk.

---

## Production Readiness

| Gate | Status |
|------|--------|
| 0 Critical code defects (configured deploy) | **Met** |
| 0 High code defects (app layer) | **Mostly met** — H1/H2/H3/H4 are ops or deliberate deferrals |
| tsc / lint / unit tests | **Met** |
| E2E 100% | **Not verified** |
| Secrets & TLS | **Ops pending** |
| Feature freeze honored | **Yes** |

**Verdict:** **CONDITIONAL GO** — code quality gates are green; release still requires ops checklist (secrets, SQL password, TLS, toolkit off, staging E2E sign-off).

---

## Definition of Done Verification

| Criterion | Met? |
|-----------|------|
| No new features | Yes |
| Business rules unchanged | Yes |
| Critical correctness/security fixes only | Yes |
| Tests green | Yes |
| Lint/tsc green | Yes |
| Report produced before git | Yes |
| Commit/push only after approval | **Waiting** |

---

## Approval Request

Please review and reply with one of:

1. **Approve commit & push** (I will stage relevant source files only — not `.next` / secrets)
2. **Approve commit only** (no push)
3. **Also delete** dead auth shells + unused mailer, then commit
4. **Hold** — request changes

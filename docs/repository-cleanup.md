# Repository Cleanup Summary

**Date:** 2026-07-17  
**Milestone:** 2 — Stabilization  
**Scope:** Remove non-production artifacts and unused public-auth surfaces without changing locked business rules.

---

## Removed

### Generated artifacts

- `scripts/button-audit-*`
- `scripts/audit-buttons.js`
- `scripts/check-button-compliance.js`

### Obsolete documentation

- `docs/button-compliance-audit.md`
- `docs/production-readiness-audit-2026-07-16.md`
- `docs/pre-staging-verification-2026-07-16.md`
- `docs/pre-staging-readiness-dashboard.md`
- `docs/rbac-security-verification-2026-07-16.md`
- `docs/final-stabilization-audit-2026-07-17.md`

### Unused public authentication surfaces

- Pages: register, forgot-password, reset-password, verify-email
- Public API routes under `/api/v1/auth/` for the same flows

### Unused infrastructure

- `src/lib/mailer.ts`

### Dead code

- Unused token helpers in `passwords.ts` (`generateToken`, `hashToken`, `generateTemporaryPassword`)
- Unused authentication store methods (self-registration / token issuance)
- `SQL_REPOSITORY_STATUS`
- `touchDevSession`
- Vestigial Pages Router `src/pages/_error.tsx` (App Router error boundaries remain)

> **Note:** An empty `src/pages/` directory is retained (`.gitkeep`) because Next.js still scans it in development. Removing the folder caused `ENOENT` / Internal Server Error on portal routes.

---

## Simplified

- Authentication Zod schemas reduced to **login-only**
- Middleware auth rate limiting restricted to `POST /api/v1/auth/login`
- Client IP extraction centralized in `src/lib/security/client-ip.ts` (rate limiting / audit only — not RBAC)
- Documentation, `README.md`, and `.env.example` updated to remove references to deleted public auth flows and SMTP mail-link configuration

---

## Retained (intentional)

| Surface | Reason |
|---------|--------|
| Login / logout | Production session entry and exit |
| Administrator password reset | Only supported password-change path (`admin.users`) |
| Canonical documentation | Schema, ADRs, domain model, state machines, permission matrix, API contracts, DoD, engineering governance, production readiness |
| Security checklist | Binding pre-release security evidence |

---

## Why removed

Stabilization cleanups must record **why** so the removals remain auditable.

| Item | Reason |
|------|--------|
| Public register pages / APIs | Accounts are administrator-managed only |
| Forgot / reset / verify-email pages & APIs | Replaced by administrator password-reset workflow |
| `mailer.ts` | SMTP / email verification out of v1 release scope (TD-001 deferred) |
| Button audit scripts & JSON dumps | One-time development artifacts |
| Dated agent audit reports | Historical notes; not source-of-truth documentation |
| Token helpers / auth-store registration | No remaining callers after public auth removal |
| Vestigial `_error.tsx` | App Router provides `error.tsx` / `not-found.tsx` |

---

## Security posture (post-cleanup)

Aligned with `docs/security-checklist.md`:

- No secrets in git (`.env*` ignored except `.env.example`; example contains placeholders only)
- No public self-service account creation or password reset
- Login remains rate-limited; sessions remain HMAC-signed
- Admin password reset requires `admin.users` and audited actions
- Password hashing retained (`scrypt` via `passwords.ts`)

---

## Verification

### Automated gates (2026-07-17)

| Check | Command | Result |
|-------|---------|--------|
| Lint | `npm run lint` | Pass |
| Unit tests | `npm test` | Pass (93/93) |
| Production build | `npm run build` | Pass (after null-safe admin user edit fix) |
| Unused export scan | `npx knip@5` | Reviewed — no deleted public-auth leftovers; remaining “unused” hits are DI exports, ops CLIs, and shared types (accepted) |

Static checks:

- [x] No imports of deleted modules (`mailer`, public auth routes)
- [x] No navigation links to `/register`, `/forgot-password`, `/reset-password`, `/verify-email`
- [x] No broken doc links to deleted audit markdown files
- [x] Build route table includes `/login` only for public auth; no register/forgot/reset/verify routes
- [x] `.env.example` has placeholders only (no production secrets); `.env*` gitignored except example

Manual smoke (operator):

- [ ] Login / logout
- [ ] Admin password reset
- [ ] Role-based navigation
- [ ] User management
- [ ] Budget workflow
- [ ] Finance workflow
- [ ] Reports page loads when authenticated

---

## Status

Cleanup verified and published to `origin/main` on [petero-codes/budget-planner](https://github.com/petero-codes/budget-planner).

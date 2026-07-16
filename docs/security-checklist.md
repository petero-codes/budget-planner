# Security Checklist

- [x] IDOR: every budget query filtered by visibility / currentApproverId
- [x] XSS: React escaping; no dangerouslySetInnerHTML
- [x] Business rules never trust frontend (services enforce)
- [x] SQLi: parameterized queries only (SQL repos)
- [x] CSRF: same-origin enforcement on mutating API routes via Origin or Referer (`src/middleware.ts` / `same-origin.ts`); upgrade to CSRF tokens if cross-site cookies are ever needed
- [x] Session cookies: HMAC-signed (`SESSION_SECRET`), httpOnly, sameSite=lax, secure in production, 8h maxAge
- [x] Rate limiting: per-IP, 100 req/min on /api plus 10/min on submit/approve/reject/return/claim/finalize/release/amend; move store to Redis when multi-instance
- [x] CORS: cross-origin mutating requests rejected with 403
- [x] Security headers: CSP, X-Frame-Options DENY, HSTS, nosniff, Referrer-Policy, Permissions-Policy
- [x] Input validation: zod schemas on API request bodies
- [x] Secrets in env only (`.env.local` gitignored; `.env.example` has no secrets)
- [x] Password hashing for local auth (`src/lib/security/passwords.ts`)
- [x] Audit of unauthorized access attempts
- [x] Owner cannot approve own budget
- [x] Amount > 0 enforced domain + DB CHECK
- [ ] Redis-backed rate limit for multi-instance production
- [ ] Production SMTP for verification / password-reset emails

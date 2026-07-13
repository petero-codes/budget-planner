# Security Checklist

- [x] IDOR: every budget query filtered by visibility / currentApproverId
- [x] XSS: React escaping; no dangerouslySetInnerHTML
- [x] Business rules never trust frontend (services enforce)
- [ ] SQLi: parameterized queries only (SQL repos Phase 4)
- [ ] CSRF: tokens on mutating routes when cookie auth lands
- [ ] Session expiry / secure cookies (SSO phase)
- [ ] Rate limiting: login, submit, approve
- [ ] CORS: allowlist production origin only
- [ ] Security headers: CSP, X-Frame-Options, HSTS
- [ ] Secrets in env only
- [ ] Password hashing if local auth
- [x] Audit of unauthorized access attempts
- [x] Owner cannot approve own budget
- [x] Amount > 0 enforced domain + DB CHECK

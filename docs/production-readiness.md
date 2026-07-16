# Production Readiness Review

KenGen ICT Budget Operations — v1 release package.

> **Supersession (2026-07-16):** For the independent code re-audit, findings, remediations, and updated score, see **[`docs/production-readiness-audit-2026-07-16.md`](./production-readiness-audit-2026-07-16.md)**. Where this document and the audit conflict, prefer the audit. Operational blocking conditions below remain in force.

| Field | Value |
|-------|-------|
| **Document Version** | 1.3 |
| **Status** | Conditionally approved — see audit · governance frozen 2026-07-16 |
| **Last Updated** | 2026-07-16 |
| **Owner** | ICT Budgeting Platform Team |
| **Release milestone** | **Milestone 2 — Stabilization** (Milestone 1 Code Complete ✅). See `docs/ENGINEERING_GOVERNANCE.md`. |
| **Evidence base** | Unit tests (67/67 after 2026-07-16 audit remediations), security checklist, lineage/finance migration (`007`), audit report |

**Document freeze:** Do not expand feature scope in this review. Stabilization work and Milestone 3 validation (staging/E2E/UAT) are the next gates — not further product expansion.

**Process freeze:** Release gates, Business Rule Freeze, Priority Documentation Drift, and Known Accepted Technical Debt are defined in `docs/ENGINEERING_GOVERNANCE.md` and this document. Treat them as binding.

---

## Release Decision

| Field | Value |
|-------|-------|
| **Interim label** | CONDITIONAL GO (audit language only) |
| **Decision Owner** | _\<Name / Role\>_ |
| **Binary outcome** | **GO** only if **all objective exit criteria** and blocking conditions are satisfied; otherwise **NO GO** |

### Objective exit criteria (binding)

| Gate | Requirement | Met? |
|------|-------------|------|
| **M2 Complete** | 0 Critical · 0 High · ≤5 Medium (open, non-accepted) | ☐ |
| **Security** | No known open RBAC, IDOR, auth, or audit integrity issues | ☑ RBAC report 2026-07-16 (0 Critical/High; residual Medium: failed-authz audit, SAP download defense-in-depth) |
| **Quality** | TypeScript, ESLint, unit tests all green | ☑ Unit/lint/tsc (re-verify at cutover) |
| **E2E** | 100% of critical workflow passes (Production Acceptance) | ☐ See `docs/staging-e2e-acceptance.md` (not started) |
| **Documentation** | No Priority Documentation Drift (`state-machines`, `domain-model`, `permission-matrix`, `approval-engine`) | ☑ Cleared 2026-07-16 |
| **Operations** | `SESSION_SECRET`, backups, HTTPS, deployment guide verified | ☐ |

Deferred items listed under **Known Accepted Technical Debt** do not count as open Critical/High when Status is Deferred.

### Blocking Conditions

| # | Condition | Met? |
|---|-----------|------|
| 1 | `SESSION_SECRET` configured (≥32 characters) in production | ☐ |
| 2 | Production database configured (least-privilege app login) | ☐ |
| 3 | HTTPS enabled | ☐ |
| 4 | E2E approval workflow passes (see Production Acceptance) | ☐ |
| 5 | Release scope approved (attachments shipped **or** formally deferred — currently deferred) | ☑ Deferred |
| 6 | Priority Documentation Drift release gate cleared | ☑ Cleared 2026-07-16 |

**Otherwise: NO GO.** Do not deploy.

---

## Assumptions

This review is based on the following frozen assumptions:

- Single SQL Server deployment  
- Single application instance (in-memory rate limiting is acceptable)  
- Attachments stored in SQL Server (`VARBINARY`) when the feature is enabled  
- Windows Authentication and/or a configured SQL login for the app role  
- Finance workflow is mandatory (GM approval → Finance claim → finalize)  

If any assumption changes (multi-instance, external object storage, optional Finance), re-open this document and reassess.

---

## Release Scope

### Included (v1)

| Capability | In scope |
|------------|----------|
| User management (admin create / edit / reset password) | ✓ |
| Budget creation & editing | ✓ |
| Approval workflow (Manager → GM) | ✓ |
| Finance review (claim / return / finalize / release) | ✓ |
| Budget amendment (lineage versions) | ✓ |
| Reporting & CSV export | ✓ |
| In-app notifications | ✓ |
| Audit logging | ✓ |
| RBAC / visibility | ✓ |
| Signed sessions | ✓ |

### Deferred (out of v1) — see Known Accepted Technical Debt

| Item | TD ID | Rationale |
|------|-------|-----------|
| Attachment upload UI/API | TD-002 | Schema + inherit-on-amend exist; product UX deferred. |
| SMTP email delivery | TD-001 | Optional; do not enable until implemented. |
| Redis-backed rate limiting | TD-004 | In-memory store accepted for single-node deployment. |
| Public self-register / forgot / reset password | — | Stubbed 403; admin-managed accounts only. |
| Native PDF SAP export | TD-003 | Print / JSON stub only. |

Reviewers: **v1 means the Included table only.** Deferred items are not release blockers unless Product re-opens scope.

---

## Verification already completed

| Gate | Result |
|------|--------|
| `npm test` | 67/67 pass (post 2026-07-16 audit) |
| `npm run build` | Pass (re-verify on clean `.next` before release) |
| `npm run lint` | Clean |
| Session HMAC signing | Implemented |
| CSRF (Origin or Referer) | Implemented |
| Finance claim / finalize / return / **release** audit | Implemented |
| Notification dismiss ownership | Implemented |
| Middleware portal RBAC | Implemented (+ `/access-denied` gated) |
| Production INTERNAL error sanitization | Implemented |

---

## Deployment hygiene (not an application defect)

A corrupted `.next` build artifact (`Cannot find module './9276.js'`) was observed during mixed `dev` / `start` testing.

**Mitigation:**

1. Stop all Node processes  
2. Delete `.next`  
3. `npm ci`  
4. `npm run build`  
5. `npm run start` with production env  

Do **not** reuse development artifacts in production.

---

## Disaster Recovery

### Recovery objectives

| Metric | Target | Notes |
|--------|--------|-------|
| **RPO** | 15 minutes | Maximum acceptable data loss |
| **RTO** | 2 hours | Maximum acceptable downtime to restore service |

### Backups

| Item | Requirement | Verified |
|------|-------------|----------|
| Daily full backup | Required | ☐ Yes / ☐ No |
| Transaction log backup | Every 15 minutes | ☐ Yes / ☐ No |
| Attachment recovery | Covered by DB restore (`VARBINARY` in SQL) | ☐ Yes / ☐ No |
| Restore tested on non-prod copy | Required before go-live | ☐ Yes / ☐ No |

Attachments live in SQL Server (`BudgetAttachments.Content`). Database backup **is** attachment backup. Restore procedure must confirm plans, lineage, workflow history, and attachments after recovery.

---

## Monitoring

### Application

| Signal | Why |
|--------|-----|
| HTTP 500 rate | Unhandled failures |
| Login failures | Auth / session / secret misconfig |
| Finance queue failures (claim / finalize / return) | Core business path |
| Background jobs (SLA escalation, claim release) | Stale locks / overdue approvals |

### SQL Server

| Signal | Why |
|--------|-----|
| Deadlocks | Concurrent claim / amend contention |
| Slow queries (>2 s) | List / visibility / audit hotspots |
| Blocking sessions | Claim lock / migration windows |

### Server / host

| Signal | Why |
|--------|-----|
| CPU | Sustained high load |
| RAM | Node memory growth |
| Disk | Log / backup volume |

### Alerts (minimum)

| Alert | Severity |
|-------|----------|
| Authentication failure spike | High |
| Failed deployment / health check down | Critical |
| Backup job failure | Critical |
| Finance finalize error rate | High |

---

## Rollback Plan

If deployment fails:

1. **Restore previous application deployment** (prior build artifact / container / IIS site).  
2. **If a migration failed or data is inconsistent:** restore previous database backup (full + logs to last good point).  
3. **Restore application configuration** (env: `SESSION_SECRET`, DB connection, SMTP flags).  
4. **Smoke-verify:**
   - [ ] Login  
   - [ ] Finance queue loads  
   - [ ] Reports load  
   - [ ] Audit logging still appends  

Do not leave a half-applied migration in production. Prefer restore + re-run after fix.

---

## Migration Validation

Migration `007-budget-lineage-finance.sql` includes backfill: existing **Approved** plans → **Finalized**, lineage rows created.

### Pre / post checks (must be 100%)

| Check | Pass criteria |
|-------|---------------|
| Status migration | 100% of former `Approved` plans are `Finalized` (or documented exceptions) |
| Version | Migrated plans have lineage version `1` |
| Orphan lineage | No `BudgetLineages` without a valid plan pointer |
| Duplicate lineage | No duplicate lineage for same business key |
| Foreign keys | No broken FKs (plans ↔ lineage ↔ workflow ↔ attachments) |
| Workflow history | Plans that completed approval have expected history rows (or documented gaps for legacy data) |

Record results in the go-live runbook before cutting traffic.

---

## Performance Targets

| Operation | Target (p95) |
|-----------|----------------|
| Login | < 500 ms |
| Budget list (≤500 rows) | < 2 s |
| Create budget | < 2 s |
| Submit budget | < 2 s |
| Finance queue | < 2 s |
| Reports page | < 5 s |
| CSV export (≤5,000 rows) | < 10 s |

### Scale checkpoints (measure before claiming capacity)

| Dataset size | Budget list TTFB | UI usable? |
|--------------|------------------|------------|
| 100 | ___ ms | ☐ |
| 500 | ___ ms | ☐ |
| 5,000 | ___ ms | ☐ |
| 10,000 | ___ ms | ☐ |

Fill during load testing; do not ship “unknown” as success.

---

## Production Acceptance Tests

Manual or automated gate before go-live. **Unit tests alone do not satisfy this gate.**

Canonical matrix (technical E2E + **UAT sign-off** + negatives + R3 + DB + browsers + ops + **automatic No-Go blockers**):

→ **[`docs/staging-e2e-acceptance.md`](./staging-e2e-acceptance.md)**

Summary checklist (expanded detail lives in that document):

| # | Scenario | Pass |
|---|----------|------|
| 1–12 | Happy-path spine (login through admin lifecycle) | ☐ |
| N1–N15 | Negative / regression matrix (denied privilege, IDOR, 409, closed FY, etc.) | ☐ |
| R3 | Finance role revocation → menu gone, `/finance` redirected, APIs 403 | ☐ |
| UAT | Role sign-off matrix (Budget Holder → Audit Viewer) | ☐ |
| DB | Audit / workflow / notifications / claims verified for one full spine | ☐ |
| Browsers | Chrome + Edge | ☐ |
| Ops | SESSION_SECRET, HTTPS, least-privilege SQL, backup/restore, deploy/rollback | ☐ |
| Blockers | No Automatic No-Go items open | ☐ |

**Do not mark Milestone 2 / Validation complete until `staging-e2e-acceptance.md` exit criteria pass.**  
**Do not start the release dossier until UAT sign-off and ops verification are complete.**  
**Automated E2E** (Playwright or equivalent) remains High priority for repeatability (TD-005).

**Phase:** Verification only — no new features until Go/No-Go.

---

## Security Checklist

| Control | Status |
|---------|--------|
| CSRF | ✓ Origin or Referer on mutations |
| XSS | ✓ React escaping; no `dangerouslySetInnerHTML` |
| SQL injection | ✓ Parameterized queries |
| IDOR | ✓ Visibility + notification ownership (re-verify in acceptance) |
| Authorization / RBAC | ✓ Service + middleware claims |
| File upload validation | ✗ N/A until attachments ship |
| Audit integrity | ✓ Append-only pattern; Finance audited |
| Session expiry | ✓ 8h signed cookie |
| Password reset (public) | ✓ Disabled |
| Rate limiting | ✓ In-memory (single node) |
| Security Headers | ✓ CSP, HSTS, frame deny, etc. |

Detail: `docs/security-checklist.md`.

---

## Final Go-Live Checklist

### Infrastructure

- [ ] `SESSION_SECRET` configured  
- [ ] Production database configured  
- [ ] SQL backups configured (RPO/RTO above)  
- [ ] HTTPS enabled  
- [ ] SMTP configured **or** deferred accepted  
- [ ] Logging enabled  
- [ ] Clean build pipeline (no reused `.next` from dev)

### Application

- [x] Build passes  
- [x] Unit tests pass  
- [ ] E2E / Production Acceptance pass  
- [x] Attachment upload formally deferred (or ☐ shipped)  
- [ ] Finance workflow verified  
- [ ] Reports verified  
- [ ] Notifications verified  

### Security

- [ ] RBAC verified in acceptance  
- [ ] Audit logs verified  
- [ ] File validation (when attachments ship)  
- [x] Rate limiting (single-node)

### Operations

- [ ] Monitoring signals wired  
- [ ] Error logging aggregation  
- [ ] Health endpoint  
- [ ] Deployment guide followed  
- [ ] Rollback plan rehearsed  

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Missing `SESSION_SECRET` | High | Medium | Block deployment; fail closed in production |
| No automated E2E | High | High | Complete acceptance + automate before production |
| Attachment feature deferred | Medium | Certain | Document in release notes; schema ready for later |
| SMTP unavailable | Low | Medium | Log notification events; admin-managed accounts |
| Redis deferred | Low | Certain | Accept single-node; revisit for HA |
| Corrupted `.next` / mixed artifacts | Medium | Medium | Clean build SOP; never promote dev artifacts |
| Migration data gaps (legacy Approved) | High | Low | Migration validation checklist; restore if fail |
| Duplicate SAP form builders diverge | Medium | Medium | Tech-debt backlog; freeze package after finalize |
| Large budget lists untested at 5k–10k | Medium | Medium | Performance targets + scale checkpoints |

---

## Known Accepted Technical Debt

Conscious deferrals for v1. These are **accepted**, not forgotten. Changing Status to Active requires scheduling work; they are not silent Critical/High unless Product re-opens scope.

| ID | Item | Status | Reason | Target |
|----|------|--------|--------|--------|
| TD-001 | SMTP / Graph mailer implementation | Deferred | Feature not enabled; public auth mail paths stubbed 403. Do not set `SMTP_HOST` until shipped. | v1.1 |
| TD-002 | Attachment upload UI/API | Deferred | Schema + inherit-on-amend exist; product UX formally deferred for v1. | v1.1 |
| TD-003 | Native SAP PDF generation | Deferred | Print / audited stub only; honest UI labels. | v1.1 |
| TD-004 | Redis-backed rate limiting | Deferred | In-memory accepted for single-node deployment. | HA / multi-instance |
| TD-005 | Automated E2E (Playwright or equivalent) | Deferred (M3 gate) | Manual Production Acceptance required before first production cutover. | Milestone 3 |
| TD-006 | Consolidate `FinanceService.buildSapForm` vs `SapComplianceService.getForm` | Deferred | Dual builders; freeze package after finalize. | v1.1 |
| TD-007 | Unify dual fiscal-year admin APIs | Deferred | Stabilization backlog. | v1.1 |
| TD-008 | Health endpoint + deployment / rollback runbooks | Deferred | Ops hardening. | Milestone 3–4 |
| TD-009 | Render or drop unused compare `attachmentDiffs` | Deferred | Depends on TD-002. | v1.1 |

### Priority Documentation Drift (release gate)

| Field | Value |
|-------|-------|
| **Status** | **CLEARED** (2026-07-16) |
| **Owner** | Engineering |
| **Documents** | `docs/state-machines.md` · `docs/domain-model.md` · `docs/permission-matrix.md` · `docs/approval-engine.md` |
| **Exit criteria** | Each document reflects implemented workflow, permissions, statuses, and approval logic |
| **Rule** | Milestone 2 cannot be marked Complete while drift exists; re-open if behavior changes without a doc sync |

### Business Rule Freeze

See `docs/ENGINEERING_GOVERNANCE.md`. Workflow, finance, lineage, versioning, CC ownership, RBAC, notifications, audit, schema, and API contracts require explicit approval before change.

---

## Overall Verdict

| Area | Status |
|------|--------|
| Architecture | Ready |
| Code quality | Ready |
| Testing | Unit Ready · **E2E Pending** |
| Security | Ready (pending attachment validation when feature ships) |
| Operations | Pending deployment configuration |

| Field | Value |
|-------|-------|
| **Production recommendation** | Interim **CONDITIONAL GO** → binary **GO** only when objective exit criteria met |
| **If exit criteria unmet** | **NO GO** |

Deployment is **GO** only after objective gates in `docs/ENGINEERING_GOVERNANCE.md` and blocking conditions in this document are satisfied (including Priority Documentation Drift cleared).

### Final assessment

Documentation and process have reached a governed standard: architecture decisions are recorded, technical debt is consciously accepted by ID, workflow rules are frozen, and release decisions use numeric exit criteria.

**Stop expanding product scope.** Higher return on effort:

1. Clear Priority Documentation Drift (release gate).  
2. Build / execute E2E critical spine.  
3. Staging deployment + Production Acceptance.  
4. Fix only issues found during staging.  
5. Ops: SESSION_SECRET, HTTPS, backups, deployment guide.

---

## Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Prepared By** | | | |
| **Reviewed By** | | | |
| **Approved By** | | | |

| Field | Value |
|-------|-------|
| **Deployment Date** | |
| **Release Version** | v1.0 |
| **Final decision** | ☐ APPROVED (GO) · ☐ NO GO |
| **Decision Owner** | |

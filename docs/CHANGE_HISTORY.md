# Change History

Chronological, **concise** long-term memory of implemented changes. This is
project memory — do not rely on chat history.

**Keep entries short.** One-paragraph summary + links to `CHANGELOG.md`,
ADRs, and key files. Not a narrative. If a change is user-visible, the detail
lives in `CHANGELOG.md`; this log records *what/why/verified* at a glance.

Governing policy: `docs/ENGINEERING_GOVERNANCE.md` → "Engineering Change Log
Policy". Newest entries at the top.

## Entry template

```
## Change #NNN — <short title>
- Date: YYYY-MM-DD
- Author:
- Subsystems: <name (Active|Frozen)>
- Task / Reason: <one sentence each>
- Files: <key files or globs>
- Business rules changed: <or None>
- APIs changed: <or None>
- DB impact: <migration id / None>
- Tests: <added/updated, or None>
- Docs updated: <or None>
- Knowledge: <K-NNN added/superseded, or "No permanent knowledge introduced">
- Verification: Code YES/NO · Tests YES/NO · Runtime YES/NO · Docs YES/NO
- Rollback: <e.g. revert commit — no schema migration, no data loss; or
  "requires migration NNN rollback script">
- Backward compatibility / risk: <or None>
```

---

## Change #010 — Isolate E2E teardown; add FinanceQueueClaims verification
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Development Toolkit / E2E tooling (Active). Startup Validation (Frozen): not touched.
- Task / Reason: Isolate DISABLE TRIGGER into a single auditable module; verify FinanceQueueClaims across claim/release/finalize; correct service-level wording (not "whole system proven").
- Files: `scripts/lib/test-database-cleaner.ts` (new — sole authorized trigger-disable site), `scripts/e2e-notification-spine.ts`, `scripts/seed-sql.ts` (delegates wipe to cleaner), `docs/staging-e2e-acceptance.md`, `docs/CHANGE_HISTORY.md`
- Business rules changed: No
- APIs changed: None
- DB impact: None
- Tests: Harness now asserts FinanceQueueClaims active-claim invariant; wording = "automated service-level checks … local SQL environment"
- Docs updated: `docs/staging-e2e-acceptance.md`
- Knowledge: No permanent knowledge introduced
- Verification: Code YES · Tests YES (re-run harness) · Runtime YES · Docs YES
- Rollback: revert commit — removes cleaner; restore inline teardown in harness/seed if needed
- Backward compatibility / risk: None — scripts only

## Change #009 — Local SQL E2E harness for the notification task spine
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Approval Engine (Active), Finance Workflow (Active), Notification Engine (Active). Startup Validation (Frozen): not touched.
- Task / Reason: Execute the critical workflow spine + notification task model on local SQL first (before staging), driving the real application service layer with DB-level verification after each transition.
- Files: `scripts/e2e-notification-spine.ts` (new), `package.json` (`e2e:spine` script), `docs/staging-e2e-acceptance.md` (Local SQL pre-staging Step 0 section)
- Business rules changed: No
- APIs changed: None
- DB impact: None (harness is self-cleaning via TestDatabaseCleaner as of Change #010)
- Tests: Reproducible service-layer harness against local SQL (not a vitest unit test)
- Docs updated: `docs/staging-e2e-acceptance.md`
- Knowledge: No permanent knowledge introduced (re-verifies K-001 notification lifecycle against runtime; no new fact)
- Verification: Code YES · Tests YES (automated service-level checks vs live local SQL) · Runtime YES · Docs YES
- Rollback: revert commit — deletes harness and `e2e:spine` script; no schema migration, no data loss
- Backward compatibility / risk: None — additive script; does not run in app runtime or CI

---

## Change #008 — Notification click→read→destination verified
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Notification Engine (Active)
- Task / Reason: Close feature-e2e-proof gap for notification task lifecycle (point 10): extract shared read/destination actions and add unit coverage for click→read≠resolve + portal targetUrls.
- Files: `src/application/notification-task-actions.ts` (new), `src/app/api/v1/notifications/route.ts`, `src/app/(portal)/notifications/page.tsx`, `tests/unit/notification-read-lifecycle.test.ts` (new), `docs/feature-e2e-proof.md`, `docs/KNOWLEDGE_LOG.md` (K-001 re-verified)
- Business Rules Changed: No
- APIs changed: None (behavior unchanged; route delegates to shared helpers)
- DB impact: None
- Tests: `notification-read-lifecycle.test.ts` (5 cases)
- Docs updated: feature-e2e-proof (Notification → COMPLETE), K-001 evidence
- Knowledge: No permanent knowledge introduced (K-001 re-verified, not superseded)
- Verification: Code YES · Tests YES · Runtime NO · Docs YES
- Rollback: revert commit — no schema migration, no data loss, no business-rule changes
- Backward compatibility / risk: None. Browser/staging evidence for points 11–12 still required in staging matrix.

## Change #007 — Evidence links + explicit Business Rules Changed
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Governance (docs/process) — no runtime code
- Task / Reason: Quality-control polish on existing governance only: Proof of Reading must cite verified-against files (not bare ✓ K-ids); every report must answer Business Rules Changed (No | Yes + BR ids). No new governance documents — next improvements are CI automation and product quality.
- Files: `docs/ENGINEERING_GOVERNANCE.md`, `.cursor/rules/engineering-governance.mdc`
- Business Rules Changed: No
- APIs changed: None
- DB impact: None
- Tests: None (docs/process)
- Docs updated: ENGINEERING_GOVERNANCE §4b + Changed Business Rules; rule report format
- Knowledge: No permanent knowledge introduced
- Verification: Code N/A · Tests N/A · Runtime N/A · Docs YES
- Rollback: revert commit — no schema migration, no data loss, no business-rule changes
- Backward compatibility / risk: None. Governance expansion stops here; next work is staging E2E / UAT / release.

## Change #006 — Contradiction detector + evidence-hardening of governance
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Governance (docs/process) — no runtime code
- Task / Reason: Close the "AI silently fixes architecture" gap: mandatory Contradiction Detector (STOP protocol), Proof of Reading (named K/ADR entries), Verified split by level (Code/Tests/Runtime/Docs), immutable Knowledge IDs (supersede like ADRs), Repository Health footer, evidence-based confidence, rollback plan per change, knowledge coverage check.
- Files: `docs/ENGINEERING_GOVERNANCE.md`, `docs/KNOWLEDGE_LOG.md`, `.cursor/rules/engineering-governance.mdc`, `docs/CHANGE_HISTORY.md` (template)
- Business rules changed: None (process only)
- APIs changed: None
- DB impact: None
- Tests: None (docs/process)
- Docs updated: governance, knowledge log header/template, change-history template
- Knowledge: No permanent business knowledge introduced (process rules only)
- Verification: Code N/A · Tests N/A · Runtime N/A · Docs YES (cross-references reviewed)
- Rollback: revert commit — no schema migration, no data loss, no business-rule changes
- Backward compatibility / risk: None.

## Change #005 — Knowledge Log + truthfulness/evidence governance
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Governance (docs/process) — no runtime code
- Task / Reason: Add operational memory (canonical facts) and enforce truthfulness/evidence, source-of-truth priority, full impact analysis, scope-creep detection, and confidence scoring so future sessions don't re-derive or contradict decisions.
- Files: `docs/KNOWLEDGE_LOG.md` (new, K-001..K-008), `docs/ENGINEERING_GOVERNANCE.md`, `.cursor/rules/engineering-governance.mdc`
- Business rules changed: None (facts recorded, not changed; verified against code-synced docs)
- APIs changed: None
- DB impact: None
- Tests: None (docs/process)
- Docs updated: KNOWLEDGE_LOG (created), ENGINEERING_GOVERNANCE (truthfulness/evidence + governance-layers), rule
- Verification: [x] doc links/consistency reviewed [x] facts traced to cited code symbols/docs [x] no runtime artifacts changed
- Backward compatibility / risk: None. K-entries are "Verified via code-synced doc" except K-007 (verified in code); re-verify against raw source when convenient.

## Change #004 — Subsystem governance + change-memory policy
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Governance (docs/process) — no runtime code
- Task / Reason: Establish persistent project memory and evidence rules so future sessions reconstruct reasoning from the repo, not chat.
- Files: `docs/CHANGE_HISTORY.md` (new), `docs/ENGINEERING_GOVERNANCE.md`, `.cursor/rules/frozen-subsystems.mdc`, `.cursor/rules/engineering-governance.mdc` (new)
- Business rules changed: None (process only)
- APIs changed: None
- DB impact: None
- Tests: None (docs/process)
- Docs updated: ENGINEERING_GOVERNANCE (new policy section), CHANGE_HISTORY (created)
- Verification: [x] doc links/consistency reviewed [x] no runtime artifacts changed
- Backward compatibility / risk: None.

## Change #003 — Client/edge bundling fix for native SQL driver
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Startup Validation (**Frozen**) — verified bug + regression fix
- Task / Reason: `msnodesqlv8` native module was pulled into browser/edge bundles (route 404s, webpack fallback 500s); `next build` also failed on a `node:child_process` URI in the edge compiler.
- Files: `next.config.js` (webpack alias for client + edge), `src/instrumentation.ts` (bare `child_process` specifier)
- Business rules changed: None
- APIs changed: None
- DB impact: None
- Tests: existing suite (109) re-run
- Docs updated: `CHANGELOG.md`, ADR-009
- Verification: [x] lint [x] build [x] tests [x] manual (login 200 / portal pages redirect; no native-module or fallback errors on startup or navigation)
- Backward compatibility / risk: None. Justification: verified bug (browser error) + build regression.

## Change #002 — Startup report hardening + FROZEN
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Startup Validation (now **Frozen**)
- Task / Reason: Make the startup report answer "can this app safely serve requests?" — explicit fallback wording, git commit/branch, phase timings, per-repository smoke reads, column-level schema verification, DI usability checks, pool state, checks/warnings/failures summary; then freeze.
- Files: `src/infrastructure/startup/**`, `src/instrumentation.ts`, `src/app/api/v1/system/database-health/route.ts`, `tests/unit/startup-env.test.ts`
- Business rules changed: None
- APIs changed: `/api/v1/system/database-health` now authenticated diagnostics (bare status when unauthenticated)
- DB impact: None (reads only)
- Tests: `startup-env.test.ts` expanded
- Docs updated: `CHANGELOG.md`, ADR-009 (Subsystem status: FROZEN)
- Verification: [x] lint [x] build [x] tests [x] manual (live startup report)
- Backward compatibility / risk: None.

## Change #001 — Startup fail-fast, schema versioning, task notifications
- Date: 2026-07-18
- Author: Cursor AI
- Subsystems: Startup Validation, Notification Engine (Active)
- Task / Reason: Root-caused false 401s (schema/code drift masked as auth failure); added required `REPOSITORY_DRIVER`, `dbo.SchemaVersion` + migration registry, startup validation via `instrumentation.ts`; reworked notifications into a task/to-do model.
- Files: `src/infrastructure/di.ts`, `src/infrastructure/startup/env.ts`, `src/infrastructure/migrations/registry.ts`, `docs/migrations/010-012*.sql`, notification services/repos/UI
- Business rules changed: Notifications resolve on workflow completion, not on read (see `docs/domain-model.md`)
- APIs changed: `/api/v1/notifications` (active/history, readAll, archive), `/api/v1/me` (500 vs 401 separation)
- DB impact: migrations 010, 011, 012
- Tests: notification + startup unit tests
- Docs updated: `CHANGELOG.md`, ADR-009, `domain-model.md`, `feature-e2e-proof.md`
- Verification: [x] lint [x] build [x] tests [x] manual
- Backward compatibility / risk: Existing notifications migrated with `ResolvedAt = NULL`.

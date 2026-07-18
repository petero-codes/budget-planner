/**
 * Local, reproducible end-to-end verification of the critical workflow spine
 * and the task-oriented notification model, executed against the local SQL
 * Server database by driving the real application service layer (no HTTP,
 * no mocks, no browser).
 *
 * Chain (stable seeded users):
 *   Budget Holder  Edwin Omondi     (cost centre KGN70020 / ccSysAdmin)
 *   Manager        Geofrey Kimutai
 *   General Mgr    Joyce Mwaniki
 *   Finance        Finance Administrator
 *
 * For every transition it verifies, at the DATABASE level:
 *   - BudgetPlans status / currentApprover
 *   - Notifications (created / resolved / read / targetUrl / active badge)
 *   - ApprovalHistory rows
 *   - AuditLogs rows
 *   - FinanceQueueClaims (active claim uniqueness across claim/release/finalize)
 * plus the negative (authorization / state-machine) paths.
 *
 * Teardown goes through TestDatabaseCleaner (scripts/lib/test-database-cleaner.ts)
 * — the only module allowed to disable immutability triggers.
 *
 * Usage:  npm run e2e:spine     (sets REPOSITORY_DRIVER=sql)
 */

import {
  deleteTestLineage,
  withImmutabilityTriggersDisabled,
} from "./lib/test-database-cleaner";

process.env.REPOSITORY_DRIVER = process.env.REPOSITORY_DRIVER ?? "sql";
process.env.NODE_ENV = process.env.NODE_ENV ?? "development";

type AnyRec = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Tiny assertion harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}${detail ? `  (${detail})` : ""}`);
  } else {
    failed++;
    failures.push(label + (detail ? ` (${detail})` : ""));
    console.log(`  FAIL  ${label}${detail ? `  (${detail})` : ""}`);
  }
}

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

async function expectThrow(
  label: string,
  fn: () => Promise<unknown>,
  expectSubstr?: string
): Promise<void> {
  try {
    await fn();
    check(label, false, "expected rejection but call succeeded");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    check(
      label,
      expectSubstr ? msg.toLowerCase().includes(expectSubstr.toLowerCase()) : true,
      msg
    );
  }
}

async function main(): Promise<void> {
  const di = await import("@/infrastructure/di");
  const poolMod = await import("@/infrastructure/repositories/sql/pool");
  const { repos, approvalService, budgetPlanService, financeService } = di;
  const { getPool, sql } = poolMod;

  console.log("Local E2E — notification task spine");
  console.log(`Driver: ${di.getRepositoryDriver()}`);

  const pool = await getPool();

  // -------- raw DB helpers (the "verify the underlying data" layer) --------
  async function rows(text: string, planId: string): Promise<AnyRec[]> {
    const r = pool.request();
    r.input("p", sql.UniqueIdentifier, planId);
    const res = await r.query(text);
    return res.recordset as AnyRec[];
  }
  const notifRows = (planId: string) =>
    rows(
      `SELECT UserId, Type, Title, TargetUrl, IsRead, ResolvedAt, ResolvedBy
       FROM dbo.Notifications WHERE RelatedBudgetPlanId = @p`,
      planId
    );
  const historyRows = (planId: string) =>
    rows(
      `SELECT Action, PreviousStatus, NewStatus, PerformedBy, [Timestamp]
       FROM dbo.ApprovalHistory WHERE BudgetPlanId = @p ORDER BY [Timestamp]`,
      planId
    );
  const auditRows = (planId: string) =>
    rows(
      `SELECT Action, PerformedBy FROM dbo.AuditLogs WHERE EntityId = @p ORDER BY [Timestamp]`,
      planId
    );
  const planRow = async (planId: string): Promise<AnyRec | null> =>
    (
      await rows(
        `SELECT Status, CurrentApproverId FROM dbo.BudgetPlans WHERE BudgetPlanId = @p`,
        planId
      )
    )[0] ?? null;
  const claimRows = (planId: string) =>
    rows(
      `SELECT ClaimId, ClaimedBy, IsActive, ReleasedAt, ClaimedAt
       FROM dbo.FinanceQueueClaims WHERE BudgetPlanId = @p ORDER BY ClaimedAt`,
      planId
    );
  const activeClaims = (cs: AnyRec[]) =>
    cs.filter((c) => c.IsActive === true || c.IsActive === 1);

  const activeFor = (ns: AnyRec[], userId: string) =>
    ns.filter((n) => String(n.UserId) === userId && n.ResolvedAt == null);
  const historyFor = (ns: AnyRec[], userId: string) =>
    ns.filter((n) => String(n.UserId) === userId && n.ResolvedAt != null);

  const teardownLineage = (lineageId: string) =>
    deleteTestLineage(pool, sql, lineageId);

  const immutabilityTriggers = [
    "TR_AuditLogs_NoUpdateDelete",
    "TR_ApprovalHistory_NoUpdateDelete",
    "TR_WorkflowHistory_NoUpdateDelete",
  ];
  async function disabledTriggerCount(): Promise<number> {
    const res = await pool.request().query(
      `SELECT COUNT(*) AS Disabled FROM sys.triggers
       WHERE is_disabled = 1 AND name IN (${immutabilityTriggers
         .map((n) => `'${n}'`)
         .join(", ")})`
    );
    return Number((res.recordset as AnyRec[])[0]?.Disabled ?? 0);
  }

  // -------- cleaner safety: triggers must be re-enabled even on failure ----
  section("PRECHECK  TestDatabaseCleaner never leaks disabled triggers");
  check("all immutability triggers enabled at start", (await disabledTriggerCount()) === 0);
  let threw = false;
  try {
    await withImmutabilityTriggersDisabled(pool, async () => {
      if ((await disabledTriggerCount()) === 0) {
        check("triggers actually disabled inside the block", false);
      } else {
        check("triggers actually disabled inside the block", true);
      }
      throw new Error("intentional failure inside disabled block");
    });
  } catch {
    threw = true;
  }
  check("work failure propagated (not swallowed)", threw);
  check("triggers re-enabled after failure (finally ran)", (await disabledTriggerCount()) === 0);

  // -------- resolve actors + reference data --------
  const allUsers = await repos.users.getAll();
  const byEmail = (email: string) => {
    const u = allUsers.find((x) => x.email.toLowerCase() === email.toLowerCase());
    if (!u) throw new Error(`Seed user not found: ${email}`);
    return u;
  };
  const edwin = byEmail("edwin.omondi@kengen.co.ke");
  const geofrey = byEmail("geofrey.kimutai@kengen.co.ke");
  const joyce = byEmail("joyce.mwaniki@kengen.co.ke");
  const finance = byEmail("finance.admin@kengen.co.ke");

  const financeUsers = allUsers.filter(
    (u) =>
      u.active &&
      (u.roleCodes.includes("FinanceAdministrator") ||
        u.permissionCodes.includes("finance.view"))
  );

  const fys = await repos.fiscalYears.getAll();
  const current = await repos.fiscalYears.getCurrent();
  const fy =
    current && current.status === "Open"
      ? current
      : fys.find((f) => f.status === "Open");
  if (!fy) throw new Error("No Open fiscal year available for the test");

  const gls = await repos.glAccounts.getAll();
  if (!gls.length) throw new Error("No GL accounts seeded");
  const gl = gls[0]!;

  console.log(
    `Actors: holder=${edwin.name}, manager=${geofrey.name}, gm=${joyce.name}, finance=${finance.name}`
  );
  console.log(`Fiscal year: ${fy.yearLabel} (${fy.status}); finance users seeded: ${financeUsers.length}`);

  const draftInput = {
    budgetType: "Primary",
    fiscalYearId: fy.id,
    fromPeriod: fy.startDate,
    toPeriod: fy.endDate,
    costCenterId: edwin.primaryCostCenterId,
    description: "E2E spine happy path",
    lines: [{ glAccountId: gl.id, amount: 250000 }],
  };

  // Pre-clean any leftovers from an interrupted run (Primary + Supplementary).
  for (const t of ["Primary", "Supplementary"]) {
    const existing = await repos.lineages.getByKey(
      edwin.primaryCostCenterId,
      fy.id,
      t
    );
    if (existing) {
      console.log(`Pre-clean: removing leftover ${t} lineage ${existing.id}`);
      await teardownLineage(existing.id);
    }
  }

  let lineageA = "";
  let lineageB = "";
  try {
    // =====================================================================
    // STEP 1 — Budget Holder: create draft -> submit
    // =====================================================================
    section("STEP 1  Budget Holder creates draft and submits");
    const draft = await budgetPlanService.createDraft(edwin, draftInput);
    lineageA = draft.lineageId ?? "";
    check("draft created (status Draft)", draft.status === "Draft", draft.status);
    check("lineage id present", !!lineageA, lineageA);

    const submitted = await approvalService.submit(draft.id, edwin);
    const planId = submitted.id;

    let p = await planRow(planId);
    check("plan status InApproval", p?.Status === "InApproval", String(p?.Status));
    check(
      "current approver is Manager (Geofrey)",
      String(p?.CurrentApproverId) === geofrey.id
    );

    let ns = await notifRows(planId);
    check("Manager has exactly 1 active notification", activeFor(ns, geofrey.id).length === 1);
    const mgrNotif = activeFor(ns, geofrey.id)[0];
    check("Manager notification type = Approval", String(mgrNotif?.Type) === "Approval");
    check(
      "Manager notification targetUrl = /budgets/{id}",
      String(mgrNotif?.TargetUrl) === `/budgets/${planId}`
    );
    check("GM has no active notification yet", activeFor(ns, joyce.id).length === 0);
    check("Finance has no active notification yet", activeFor(ns, finance.id).length === 0);

    let h = await historyRows(planId);
    check("ApprovalHistory has Submitted", h.some((x) => x.Action === "Submitted"));
    let a = await auditRows(planId);
    check("AuditLogs has Submitted", a.some((x) => x.Action === "Submitted"));

    // negative: budget holder cannot edit after submission
    await expectThrow(
      "NEG owner cannot edit after submit",
      () => budgetPlanService.updateDraft(planId, edwin, draftInput)
    );
    // negative: GM cannot approve before Manager
    await expectThrow(
      "NEG GM cannot approve before Manager",
      () => approvalService.approve(planId, joyce)
    );

    // =====================================================================
    // STEP 2 — Manager: click (read) -> approve
    // =====================================================================
    section("STEP 2  Manager reads then approves");
    // Simulate clicking the notification: marks read, does NOT resolve.
    const mgrActive = await repos.notifications.listByUser(geofrey.id);
    const mgrActiveForPlan = mgrActive.filter((n) => n.relatedPlanId === planId);
    check("Manager active (repo) badge = 1", mgrActiveForPlan.length === 1, `badge=${mgrActive.length}`);
    if (mgrActiveForPlan[0]) {
      await repos.notifications.markRead(mgrActiveForPlan[0].id, geofrey.id);
    }
    ns = await notifRows(planId);
    const mgrAfterRead = activeFor(ns, geofrey.id)[0];
    check("read != resolve: Manager notif IsRead=1", Boolean(mgrAfterRead?.IsRead));
    check("read != resolve: Manager notif still active", mgrAfterRead?.ResolvedAt == null);

    await approvalService.approve(planId, geofrey, "Looks good - manager");

    p = await planRow(planId);
    check("plan still InApproval", p?.Status === "InApproval", String(p?.Status));
    check("current approver now GM (Joyce)", String(p?.CurrentApproverId) === joyce.id);

    ns = await notifRows(planId);
    check("Manager notification resolved (moved to history)", activeFor(ns, geofrey.id).length === 0);
    check("Manager has 1 resolved notification in history", historyFor(ns, geofrey.id).length === 1);
    check("GM now has exactly 1 active notification", activeFor(ns, joyce.id).length === 1);
    const gmNotif = activeFor(ns, joyce.id)[0];
    check("GM notification type = Approval", String(gmNotif?.Type) === "Approval");
    check("GM targetUrl = /budgets/{id}", String(gmNotif?.TargetUrl) === `/budgets/${planId}`);
    check("no duplicate active Approval for GM", activeFor(ns, joyce.id).filter((n) => n.Type === "Approval").length === 1);

    h = await historyRows(planId);
    check("ApprovalHistory has Approved (manager step)", h.filter((x) => x.Action === "Approved").length >= 1);

    // negative: manager cannot approve twice
    await expectThrow(
      "NEG Manager cannot approve twice",
      () => approvalService.approve(planId, geofrey)
    );

    // =====================================================================
    // STEP 3 — General Manager: click (read) -> approve  => Finance queue
    // =====================================================================
    section("STEP 3  General Manager approves -> Finance queue");
    const gmActive = (await repos.notifications.listByUser(joyce.id)).filter(
      (n) => n.relatedPlanId === planId
    );
    if (gmActive[0]) await repos.notifications.markRead(gmActive[0].id, joyce.id);

    await approvalService.approve(planId, joyce, "Approved - GM");

    p = await planRow(planId);
    check("plan status PendingFinanceReview", p?.Status === "PendingFinanceReview", String(p?.Status));
    check("no current approver after GM", p?.CurrentApproverId == null);

    ns = await notifRows(planId);
    check("GM notification resolved", activeFor(ns, joyce.id).length === 0);

    // =====================================================================
    // STEP 4 — Finance queue notification appears
    // =====================================================================
    section("STEP 4  Finance queue notification present");
    check(
      "Finance has 1 active FinanceQueue notification",
      activeFor(ns, finance.id).filter((n) => n.Type === "FinanceQueue").length === 1
    );
    const queueNotif = activeFor(ns, finance.id).find((n) => n.Type === "FinanceQueue");
    check("FinanceQueue targetUrl = /finance?planId={id}", String(queueNotif?.TargetUrl) === `/finance?planId=${planId}`);

    // negative: finance cannot finalize before claiming
    await expectThrow(
      "NEG Finance cannot finalize without claiming",
      () => financeService.finalize(planId, finance),
      "claim"
    );

    let claims = await claimRows(planId);
    check("FinanceQueueClaims: no active claim before claim", activeClaims(claims).length === 0);

    // =====================================================================
    // STEP 5 — Finance: claim => queue resolves, personal task created
    // =====================================================================
    section("STEP 5  Finance claims");
    await financeService.claim(planId, finance);

    p = await planRow(planId);
    check("plan status Claimed", p?.Status === "Claimed", String(p?.Status));

    claims = await claimRows(planId);
    check("FinanceQueueClaims: exactly 1 active claim after claim", activeClaims(claims).length === 1);
    check(
      "FinanceQueueClaims: active claim owned by Finance actor",
      String(activeClaims(claims)[0]?.ClaimedBy) === finance.id
    );

    ns = await notifRows(planId);
    check(
      "FinanceQueue notification resolved on claim",
      activeFor(ns, finance.id).filter((n) => n.Type === "FinanceQueue").length === 0
    );
    check(
      "personal FinanceClaim notification created",
      activeFor(ns, finance.id).filter((n) => n.Type === "FinanceClaim").length === 1
    );
    const claimNotif = activeFor(ns, finance.id).find((n) => n.Type === "FinanceClaim");
    check("FinanceClaim targetUrl = /budgets/{id}", String(claimNotif?.TargetUrl) === `/budgets/${planId}`);

    // =====================================================================
    // STEP 6 — Finance: release => personal resolves, queue recreated
    // =====================================================================
    section("STEP 6  Finance releases");
    await financeService.release(planId, finance);

    p = await planRow(planId);
    check("plan status back to PendingFinanceReview", p?.Status === "PendingFinanceReview", String(p?.Status));

    claims = await claimRows(planId);
    check("FinanceQueueClaims: 0 active after release", activeClaims(claims).length === 0);
    check(
      "FinanceQueueClaims: released row retained (ReleasedAt set)",
      claims.some((c) => c.ReleasedAt != null && (c.IsActive === false || c.IsActive === 0))
    );

    ns = await notifRows(planId);
    check(
      "personal FinanceClaim resolved on release",
      activeFor(ns, finance.id).filter((n) => n.Type === "FinanceClaim").length === 0
    );
    check(
      "shared FinanceQueue recreated on release",
      activeFor(ns, finance.id).filter((n) => n.Type === "FinanceQueue").length === 1
    );

    // =====================================================================
    // STEP 7 — Finance: claim again -> finalize
    // =====================================================================
    section("STEP 7  Finance claims again and finalizes");
    await financeService.claim(planId, finance);
    p = await planRow(planId);
    check("re-claim -> Claimed", p?.Status === "Claimed", String(p?.Status));

    claims = await claimRows(planId);
    check("FinanceQueueClaims: exactly 1 active after re-claim", activeClaims(claims).length === 1);

    await financeService.finalize(planId, finance);
    p = await planRow(planId);
    check("plan status Finalized", p?.Status === "Finalized", String(p?.Status));

    claims = await claimRows(planId);
    check("FinanceQueueClaims: 0 active after finalize", activeClaims(claims).length === 0);

    ns = await notifRows(planId);
    check(
      "all Finance task notifications resolved after finalize",
      activeFor(ns, finance.id).filter((n) => n.Type === "FinanceClaim" || n.Type === "FinanceQueue").length === 0
    );

    h = await historyRows(planId);
    check("ApprovalHistory has FinanceFinalized", h.some((x) => x.Action === "FinanceFinalized"));
    a = await auditRows(planId);
    check("AuditLogs has FinanceFinalized", a.some((x) => x.Action === "FinanceFinalized"));

    // =====================================================================
    // STEP 8 — Budget Holder final outcome notification
    // =====================================================================
    section("STEP 8  Budget Holder receives finalized outcome");
    check(
      "Owner (Edwin) has active Outcome (Budget finalized)",
      activeFor(ns, edwin.id).some((n) => n.Type === "Outcome" && String(n.Title).includes("finalized"))
    );
    const outcome = activeFor(ns, edwin.id).find((n) => n.Type === "Outcome");
    check("Outcome routes to existing /budgets/{id}", String(outcome?.TargetUrl) === `/budgets/${planId}`);

    // =====================================================================
    // NEGATIVE — returned budget creates outcome + becomes editable again
    // (separate Supplementary lineage so it doesn't collide with A)
    // =====================================================================
    section("NEGATIVE  Return-for-revision re-opens the budget");
    const draftB = await budgetPlanService.createDraft(edwin, {
      ...draftInput,
      budgetType: "Supplementary",
      description: "E2E return path",
    });
    lineageB = draftB.lineageId ?? "";
    const submittedB = await approvalService.submit(draftB.id, edwin);
    await approvalService.returnForRevision(submittedB.id, geofrey, "Please revise line items");

    const pb = await planRow(submittedB.id);
    check("returned plan status ReturnedForRevision", pb?.Status === "ReturnedForRevision", String(pb?.Status));
    const nb = await notifRows(submittedB.id);
    check(
      "owner receives active Return outcome notification",
      activeFor(nb, edwin.id).some((n) => n.Type === "Outcome")
    );
    check(
      "Manager's approval notification resolved on return",
      activeFor(nb, geofrey.id).filter((n) => n.Type === "Approval").length === 0
    );
    // editable again
    const edited = await budgetPlanService.updateDraft(submittedB.id, edwin, {
      ...draftInput,
      budgetType: "Supplementary",
      description: "revised after return",
      lines: [{ glAccountId: gl.id, amount: 300000 }],
    });
    check("returned budget is editable again", edited.status === "ReturnedForRevision" || edited.status === "Draft", edited.status);

    // Documented limitation: only one FinanceAdministrator is seeded, so peer
    // Finance denial (B cannot release/finalize A's claim) cannot be exercised
    // without adding an out-of-scope seed user.
    section("SKIPPED (documented)");
    console.log(
      `  SKIP  NEG Finance B cannot release/finalize Finance A's claim ` +
        `(only ${financeUsers.length} FinanceAdministrator seeded; adding one is out of scope)`
    );
  } finally {
    section("Teardown via TestDatabaseCleaner");
    if (lineageA) {
      await teardownLineage(lineageA);
      console.log(`  cleaned lineage A ${lineageA}`);
    }
    if (lineageB) {
      await teardownLineage(lineageB);
      console.log(`  cleaned lineage B ${lineageB}`);
    }
    await pool.close();
  }

  // -------- summary --------
  section("SUMMARY");
  console.log(
    `  ${passed} automated service-level checks passed against the local SQL environment.`
  );
  console.log(`  Failures ............... ${failed}`);
  if (failed) {
    console.log("\nFailed checks:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("\nHARNESS ERROR:", e);
  process.exit(2);
});

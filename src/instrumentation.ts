import type { RegistrationCheck } from "@/infrastructure/startup/database-health";

/**
 * Next.js instrumentation — runs once when the Node server starts.
 * Validates environment + database before serving requests.
 * Skipped during production build prerender.
 *
 * Startup validation is frozen: change only for verified bugs, new
 * migrations, deployment requirements, or regressions.
 */
/**
 * Resolve git commit/branch. Env vars always win (deployed containers have
 * no .git directory). Git commands are only spawned outside production —
 * a deployed environment without GIT_COMMIT reports "unknown" rather than
 * paying for process spawns on every boot.
 */
async function resolveGitInfo(nodeEnv: string): Promise<{
  commit: string | null;
  branch: string | null;
}> {
  let commit = process.env.GIT_COMMIT?.trim() || null;
  let branch = process.env.GIT_BRANCH?.trim() || null;
  if ((commit && branch) || nodeEnv === "production") {
    return { commit, branch };
  }

  try {
    // Bare specifier (not "node:child_process") — the edge compiler cannot
    // parse node: URIs; next.config aliases "child_process" to an empty
    // module there, and register() never reaches this code on edge anyway.
    const { execSync } = await import("child_process");
    const run = (cmd: string) =>
      execSync(cmd, { stdio: ["ignore", "pipe", "ignore"], timeout: 3000 })
        .toString()
        .trim();
    if (!commit) commit = run("git rev-parse --short HEAD") || null;
    if (!branch) branch = run("git rev-parse --abbrev-ref HEAD") || null;
  } catch {
    // Not a git checkout — report "unknown".
  }
  return { commit, branch };
}

/** Constructed and exposing at least one callable method. */
function isUsable(instance: unknown): boolean {
  if (instance == null || typeof instance !== "object") return false;
  const proto = Object.getPrototypeOf(instance);
  const members = [
    ...Object.keys(instance),
    ...(proto && proto !== Object.prototype ? Object.getOwnPropertyNames(proto) : []),
  ];
  return members.some(
    (name) =>
      name !== "constructor" &&
      typeof (instance as Record<string, unknown>)[name] === "function"
  );
}

/** A syntactically valid id that matches nothing — the cheapest indexed read. */
const SMOKE_PROBE_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Verify the DI container: every repository and critical service must be
 * verified (constructed with callable methods), and each critical
 * repository must complete one cheapest-possible live read — construction
 * alone doesn't prove lazy initialization works. Optional services only
 * produce warnings.
 */
async function checkRegistration(): Promise<RegistrationCheck> {
  const di = await import("@/infrastructure/di");
  const failures: string[] = [];

  const count = (
    entries: [string, unknown][],
    prefix: string
  ): { verified: number; total: number } => {
    let verified = 0;
    for (const [name, instance] of entries) {
      if (isUsable(instance)) verified += 1;
      else failures.push(`${prefix}${name} is not usable (missing or has no methods)`);
    }
    return { verified, total: entries.length };
  };

  const repositories = count(
    Object.entries(di.repos as Record<string, unknown>),
    "repos."
  );

  const criticalServices = count(
    Object.entries({
      authorizationService: di.authorizationService,
      approvalService: di.approvalService,
      budgetPlanService: di.budgetPlanService,
      financeService: di.financeService,
      fiscalYearService: di.fiscalYearService,
      adminUserService: di.adminUserService,
      departmentService: di.departmentService,
      costCenterService: di.costCenterService,
      submissionStatusService: di.submissionStatusService,
      dashboardService: di.dashboardService,
    }),
    ""
  );

  const optionalServices = count(
    Object.entries({
      developmentToolkitService: di.developmentToolkitService,
      executiveService: di.executiveService,
      sapComplianceService: di.sapComplianceService,
    }),
    ""
  );

  const smokeProbes: [string, () => Promise<unknown>][] = [
    ["users.getById", () => di.repos.users.getById(SMOKE_PROBE_ID)],
    ["budgets.getById", () => di.repos.budgets.getById(SMOKE_PROBE_ID)],
    [
      "notifications.listByUser",
      () => di.repos.notifications.listByUser(SMOKE_PROBE_ID),
    ],
    [
      "audits.list",
      () => di.repos.audits.list({ entity: "Startup", entityId: SMOKE_PROBE_ID }),
    ],
    ["fiscalYears.getCurrent", () => di.repos.fiscalYears.getCurrent()],
  ];

  const smokeTests: RegistrationCheck["smokeTests"] = [];
  for (const [name, probe] of smokeProbes) {
    try {
      await probe();
      smokeTests.push({ name, ok: true });
    } catch (e) {
      smokeTests.push({ name, ok: false });
      failures.push(
        `Repository smoke test failed (${name}): ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  return { repositories, criticalServices, optionalServices, smokeTests, failures };
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const startedAt = Date.now();

  const { assertEnvironmentValid } = await import(
    "@/infrastructure/startup/env"
  );
  const {
    assertDatabaseReady,
    formatStartupReport,
    registrationOk,
  } = await import("@/infrastructure/startup/database-health");
  const { EXPECTED_SCHEMA_VERSION } = await import(
    "@/infrastructure/migrations/registry"
  );
  const packageJson = (await import("../package.json")).default as {
    version?: string;
  };

  const env = assertEnvironmentValid();
  const driver = env.driver!;
  const buildVersion =
    typeof packageJson.version === "string" ? packageJson.version : "unknown";
  const git = await resolveGitInfo(env.nodeEnv);

  const reportBase = {
    driver,
    nodeEnv: env.nodeEnv,
    envOk: env.ok,
    sessionSecretOk: env.sessionSecretOk,
    connectionStringConfigured: env.connectionStringConfigured,
    developmentToolkitEnabled: env.developmentToolkitEnabled,
    buildVersion,
    gitCommit: git.commit,
    gitBranch: git.branch,
  };

  let health = null;
  const dbStartedAt = Date.now();
  try {
    health = await assertDatabaseReady(driver);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(
      formatStartupReport({
        ...reportBase,
        registration: null,
        startupTimeMs: Date.now() - startedAt,
        health: {
          ok: false,
          repositoryDriver: driver,
          connection: "FAILED",
          databaseName: null,
          server: null,
          databaseUser: null,
          pool: null,
          schemaVersion: null,
          expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
          pendingMigrations: [],
          missingTables: [],
          missingColumns: [],
          seedDataPresent: null,
          emptyCoreTables: [],
          responseTimeMs: null,
          lastHealthCheck: new Date().toISOString(),
          errors: [message],
          warnings: env.warnings,
        },
      })
    );
    throw e;
  }

  const databaseValidationMs = Date.now() - dbStartedAt;

  const diStartedAt = Date.now();
  const registration = await checkRegistration();
  const diInitializationMs = Date.now() - diStartedAt;
  const totalMs = Date.now() - startedAt;

  console.log(
    formatStartupReport({
      ...reportBase,
      registration,
      startupTimeMs: totalMs,
      health,
    })
  );

  // Phase timings are logged (not printed in the report) so regressions in
  // a specific phase are identifiable without bloating the summary.
  console.log(
    `[startup] timings: database validation ${databaseValidationMs} ms, DI initialization + smoke tests ${diInitializationMs} ms, total ${totalMs} ms`
  );

  for (const warning of [...env.warnings, ...(health.warnings ?? [])]) {
    console.warn(`[startup] ${warning}`);
  }
  if (registration.optionalServices.verified < registration.optionalServices.total) {
    console.warn(
      "[startup] One or more optional services failed to initialize (see report) — startup continues."
    );
  }

  if (!registrationOk(registration)) {
    throw new Error(
      `DI validation failed:\n- ${registration.failures.join("\n- ")}`
    );
  }
}

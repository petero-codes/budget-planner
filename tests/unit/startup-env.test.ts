import { describe, expect, it } from "vitest";
import {
  EXPECTED_SCHEMA_VERSION,
  latestAppliedVersion,
  parseMigrationVersionFromPath,
  pendingMigrations,
} from "@/infrastructure/migrations/registry";
import {
  resolveRepositoryDriver,
  validateEnvironment,
} from "@/infrastructure/startup/env";
import {
  formatStartupReport,
  registrationOk,
} from "@/infrastructure/startup/database-health";

describe("migration registry", () => {
  it("parses version prefixes from migration paths", () => {
    expect(
      parseMigrationVersionFromPath("docs/migrations/010-notification-tasks.sql")
    ).toBe("010");
    expect(parseMigrationVersionFromPath("readme.md")).toBeNull();
  });

  it("reports pending migrations against applied versions", () => {
    const pending = pendingMigrations(["001", "002", "011"]);
    expect(pending[0]?.version).toBe("003");
    expect(pending.some((m) => m.version === "012")).toBe(true);
    const allApplied = [
      "001",
      "002",
      "003",
      "004",
      "005",
      "006",
      "007",
      "008",
      "009",
      "010",
      "011",
      "012",
    ];
    expect(pendingMigrations(allApplied).length).toBe(0);
  });

  it("tracks the expected schema version as the latest registry entry", () => {
    expect(EXPECTED_SCHEMA_VERSION).toBe("012");
    expect(latestAppliedVersion(["009", "011", "010"])).toBe("011");
  });
});

describe("environment fail-fast", () => {
  it("requires REPOSITORY_DRIVER when unset outside build/test", () => {
    expect(() =>
      resolveRepositoryDriver({
        NODE_ENV: "development",
      } as NodeJS.ProcessEnv)
    ).toThrow(/REPOSITORY_DRIVER is required/);
  });

  it("accepts explicit mock in development", () => {
    expect(
      resolveRepositoryDriver({
        NODE_ENV: "development",
        REPOSITORY_DRIVER: "mock",
      } as NodeJS.ProcessEnv)
    ).toBe("mock");
  });

  it("refuses mock in production runtime", () => {
    expect(() =>
      resolveRepositoryDriver({
        NODE_ENV: "production",
        REPOSITORY_DRIVER: "mock",
      } as NodeJS.ProcessEnv)
    ).toThrow(/sql is required in production/);
  });

  it("allows mock during production build prerender", () => {
    expect(
      resolveRepositoryDriver({
        NODE_ENV: "production",
        NEXT_PHASE: "phase-production-build",
        REPOSITORY_DRIVER: "mock",
      } as NodeJS.ProcessEnv)
    ).toBe("mock");
  });

  it("fails validation when toolkit is enabled in production", () => {
    const result = validateEnvironment({
      NODE_ENV: "production",
      REPOSITORY_DRIVER: "sql",
      SESSION_SECRET: "x".repeat(32),
      ENABLE_DEVELOPMENT_TOOLKIT: "true",
    } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("ENABLE_DEVELOPMENT_TOOLKIT"))).toBe(
      true
    );
  });
});

const healthyReport = {
  ok: true,
  repositoryDriver: "sql" as const,
  connection: "OK" as const,
  databaseName: "BudgetOperations",
  server: "localhost\\SQLEXPRESS",
  databaseUser: "app_budget_ops",
  pool: { min: 0, max: 20, connected: true },
  schemaVersion: "012",
  expectedSchemaVersion: "012",
  pendingMigrations: [],
  missingTables: [],
  missingColumns: [],
  seedDataPresent: true,
  emptyCoreTables: [],
  responseTimeMs: 12,
  lastHealthCheck: "2026-07-18T00:00:00.000Z",
  errors: [],
  warnings: [],
};

const fullRegistration = {
  repositories: { verified: 18, total: 18 },
  criticalServices: { verified: 11, total: 11 },
  optionalServices: { verified: 3, total: 3 },
  smokeTests: [
    { name: "users.getById", ok: true },
    { name: "budgets.getById", ok: true },
    { name: "notifications.listByUser", ok: true },
    { name: "audits.list", ok: true },
    { name: "fiscalYears.getCurrent", ok: true },
  ],
  failures: [],
};

describe("startup report", () => {
  it("prints the aligned validation summary with explicit fallback warnings", async () => {
    const report = formatStartupReport({
      driver: "sql",
      nodeEnv: "development",
      envOk: true,
      sessionSecretOk: false,
      connectionStringConfigured: false,
      developmentToolkitEnabled: true,
      buildVersion: "0.1.0",
      gitCommit: "7fd8150",
      gitBranch: "main",
      registration: fullRegistration,
      startupTimeMs: 648,
      health: healthyReport,
    });

    expect(report).toContain("Environment .............. Development");
    expect(report).toContain("Version .................. 0.1.0");
    expect(report).toContain("Commit ................... 7fd8150");
    expect(report).toContain("Branch ................... main");
    expect(report).toContain("Repository Driver ........ SQL");
    expect(report).toContain("Database Driver .......... mssql/msnodesqlv8");
    expect(report).toContain("Database ................. BudgetOperations");
    expect(report).toContain("Database User ............ app_budget_ops");
    expect(report).toContain("Connection ............... PASS");
    expect(report).toContain(
      "Connection Pool .......... Connected (min 0, max 20)"
    );
    expect(report).toContain("Schema ................... 012 / Expected 012");
    expect(report).toContain("Pending Migrations ....... None");
    expect(report).toContain("Required Tables .......... PASS");
    expect(report).toContain("Required Columns ......... PASS");
    expect(report).toContain(
      "Seed Data ................ Present (6/6 core tables)"
    );
    expect(report).toContain(
      "Session Secret ........... WARNING (Development Fallback in use)"
    );
    expect(report).toContain(
      "Connection String ........ WARNING (Built-in Default in use)"
    );
    expect(report).toContain("Development Toolkit ...... Enabled");
    expect(report).toContain(
      "Repositories ............. PASS (18/18 verified)"
    );
    expect(report).toContain(
      "Critical Services ........ PASS (11/11 verified)"
    );
    expect(report).toContain("Optional Services ........ PASS (3/3)");
    expect(report).toContain(
      "Repository Smoke Tests ... PASS (5/5 live reads)"
    );
    expect(report).toContain("Startup Validation ....... PASS");
    expect(report).toContain("Warnings ................. 2");
    expect(report).toContain("Failures ................. 0");
    expect(report).toContain("Startup Time ............. 648 ms");
  });

  it("fails startup validation when a critical service is unusable", async () => {
    const report = formatStartupReport({
      driver: "sql",
      nodeEnv: "development",
      envOk: true,
      sessionSecretOk: true,
      connectionStringConfigured: true,
      developmentToolkitEnabled: false,
      buildVersion: "0.1.0",
      gitCommit: null,
      gitBranch: null,
      registration: {
        ...fullRegistration,
        criticalServices: { verified: 10, total: 11 },
        failures: ["financeService is not usable (missing or has no methods)"],
      },
      startupTimeMs: 20,
      health: healthyReport,
    });

    expect(report).toContain(
      "Critical Services ........ FAIL (10/11 verified)"
    );
    expect(report).toContain("Startup Validation ....... FAIL");
    expect(report).toContain("Commit ................... unknown");
    expect(report).toContain("financeService is not usable");
  });

  it("warns without failing when only an optional service is unusable", async () => {
    const registration = {
      ...fullRegistration,
      optionalServices: { verified: 2, total: 3 },
    };
    const report = formatStartupReport({
      driver: "sql",
      nodeEnv: "development",
      envOk: true,
      sessionSecretOk: true,
      connectionStringConfigured: true,
      developmentToolkitEnabled: false,
      buildVersion: "0.1.0",
      gitCommit: "7fd8150",
      gitBranch: "main",
      registration,
      startupTimeMs: 30,
      health: healthyReport,
    });

    expect(registrationOk(registration)).toBe(true);
    expect(report).toContain(
      "Optional Services ........ WARNING (2/3 verified)"
    );
    expect(report).toContain("Startup Validation ....... PASS");
  });

  it("fails when a repository smoke test fails and names the probe", async () => {
    const registration = {
      ...fullRegistration,
      smokeTests: fullRegistration.smokeTests.map((t) =>
        t.name === "notifications.listByUser" ? { ...t, ok: false } : t
      ),
      failures: [
        "Repository smoke test failed (notifications.listByUser): Invalid column name 'Priority'.",
      ],
    };
    const report = formatStartupReport({
      driver: "sql",
      nodeEnv: "development",
      envOk: true,
      sessionSecretOk: true,
      connectionStringConfigured: true,
      developmentToolkitEnabled: false,
      buildVersion: "0.1.0",
      gitCommit: "7fd8150",
      gitBranch: "main",
      registration,
      startupTimeMs: 30,
      health: healthyReport,
    });

    expect(registrationOk(registration)).toBe(false);
    expect(report).toContain(
      "Repository Smoke Tests ... FAIL (4/5 — failed: notifications.listByUser)"
    );
    expect(report).toContain("Startup Validation ....... FAIL");
  });

  it("surfaces missing columns as a failure", async () => {
    const report = formatStartupReport({
      driver: "sql",
      nodeEnv: "development",
      envOk: true,
      sessionSecretOk: true,
      connectionStringConfigured: true,
      developmentToolkitEnabled: false,
      buildVersion: "0.1.0",
      gitCommit: "7fd8150",
      gitBranch: "main",
      registration: fullRegistration,
      startupTimeMs: 30,
      health: {
        ...healthyReport,
        ok: false,
        missingColumns: ["Notifications.Priority"],
        errors: [
          "Missing required columns: Notifications.Priority. Run: npm run db:migrate",
        ],
      },
    });

    expect(report).toContain(
      "Required Columns ......... FAIL (missing: Notifications.Priority)"
    );
    expect(report).toContain("Startup Validation ....... FAIL");
  });
});

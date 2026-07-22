/**
 * Database health + schema validation (server-side only).
 * No secrets in returned payloads.
 *
 * Startup validation is frozen: change only for verified bugs, new
 * migrations, deployment requirements, or regressions.
 */

import "server-only";

import {
  EXPECTED_SCHEMA_VERSION,
  latestAppliedVersion,
  pendingMigrations,
  type MigrationEntry,
} from "@/infrastructure/migrations/registry";
import {
  getConnectionPoolState,
  getPool,
  sql,
  type ConnectionPoolState,
} from "@/infrastructure/repositories/sql/pool";
import type { RepositoryDriver } from "@/infrastructure/startup/env";

export type DatabaseHealth = {
  ok: boolean;
  repositoryDriver: RepositoryDriver;
  connection: "OK" | "FAILED" | "SKIPPED";
  databaseName: string | null;
  /** Internal diagnostics only — never expose the hostname over HTTP. */
  server: string | null;
  /** SQL login the pool authenticated as (SUSER_SNAME()). */
  databaseUser: string | null;
  /** Live pool state — measurable, not just "OK". */
  pool: ConnectionPoolState | null;
  schemaVersion: string | null;
  expectedSchemaVersion: string;
  pendingMigrations: string[];
  missingTables: string[];
  /** "Table.Column" entries expected by the code but absent in the DB. */
  missingColumns: string[];
  /** All core reference tables have at least one row. */
  seedDataPresent: boolean | null;
  /** Core tables that exist but contain no rows. */
  emptyCoreTables: string[];
  responseTimeMs: number | null;
  lastHealthCheck: string;
  errors: string[];
  warnings: string[];
};

const REQUIRED_TABLES = [
  "Users",
  "Roles",
  "Permissions",
  "BudgetPlans",
  "BudgetItems",
  "Notifications",
  "FiscalYears",
  "CostCenters",
  "Departments",
  "AuditLogs",
  "SchemaVersion",
] as const;

/**
 * Columns the code depends on that were added by later migrations.
 * A table can exist while still missing a migration column — this catches
 * that drift explicitly instead of failing on the first query that uses it.
 */
const REQUIRED_COLUMNS: Record<string, readonly string[]> = {
  Notifications: [
    "EntityType",
    "EntityId",
    "TargetUrl",
    "ReadAt",
    "ResolvedAt",
    "Priority",
    "Category",
    "ActionLabel",
    "ResolvedBy",
    "ExpiresAt",
  ],
  Users: ["ManagerId", "IsDeleted"],
  FiscalYears: ["Status", "IsCurrent"],
  SchemaVersion: ["Version", "AppliedAt"],
};

/**
 * One populated Users table does not make the database usable — auth,
 * RBAC, and budget entry all need these reference tables seeded.
 */
const SEED_CORE_TABLES = [
  "Users",
  "Roles",
  "Permissions",
  "Departments",
  "CostCenters",
  "FiscalYears",
] as const;

function parseServerDatabase(connectionString: string | undefined): {
  server: string | null;
  database: string | null;
} {
  const raw =
    connectionString ??
    "Server=localhost\\SQLEXPRESS;Database=BudgetOperations;Trusted_Connection=True;";
  const server = /Server=([^;]+)/i.exec(raw)?.[1]?.trim() ?? null;
  const database = /Database=([^;]+)/i.exec(raw)?.[1]?.trim() ?? null;
  return { server, database };
}

async function listAppliedVersions(): Promise<string[]> {
  const pool = await getPool();
  const exists = await pool
    .request()
    .query("SELECT OBJECT_ID('dbo.SchemaVersion', 'U') AS Id");
  if (!exists.recordset[0]?.Id) {
    throw new Error(
      "dbo.SchemaVersion is missing. Apply docs/migrations/012-schema-version.sql (or npm run db:migrate)."
    );
  }
  const result = await pool
    .request()
    .query("SELECT Version FROM dbo.SchemaVersion ORDER BY Version");
  return (result.recordset as { Version: string }[]).map((r) => r.Version);
}

async function findMissingTables(): Promise<string[]> {
  const pool = await getPool();
  const missing: string[] = [];
  for (const table of REQUIRED_TABLES) {
    const r = await pool
      .request()
      .input("name", sql.NVarChar(128), table)
      .query("SELECT OBJECT_ID(CONCAT('dbo.', @name), 'U') AS Id");
    if (!r.recordset[0]?.Id) missing.push(table);
  }
  return missing;
}

async function findMissingColumns(
  existingTables: string[]
): Promise<string[]> {
  const pool = await getPool();
  const tables = Object.keys(REQUIRED_COLUMNS).filter((t) =>
    existingTables.includes(t)
  );
  if (tables.length === 0) return [];

  const result = await pool.request().query(
    `SELECT TABLE_NAME, COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = 'dbo'
       AND TABLE_NAME IN (${tables.map((t) => `'${t}'`).join(", ")})`
  );
  const present = new Set(
    (result.recordset as { TABLE_NAME: string; COLUMN_NAME: string }[]).map(
      (r) => `${r.TABLE_NAME}.${r.COLUMN_NAME}`
    )
  );

  const missing: string[] = [];
  for (const table of tables) {
    for (const column of REQUIRED_COLUMNS[table]) {
      if (!present.has(`${table}.${column}`)) {
        missing.push(`${table}.${column}`);
      }
    }
  }
  return missing;
}

async function findEmptyCoreTables(
  existingTables: string[]
): Promise<string[]> {
  const pool = await getPool();
  const empty: string[] = [];
  for (const table of SEED_CORE_TABLES) {
    if (!existingTables.includes(table)) continue;
    const r = await pool
      .request()
      .query(`SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.${table}) THEN 1 ELSE 0 END AS HasRows`);
    if (!r.recordset[0]?.HasRows) empty.push(table);
  }
  return empty;
}

export async function checkDatabaseHealth(
  driver: RepositoryDriver
): Promise<DatabaseHealth> {
  const lastHealthCheck = new Date().toISOString();
  const { server, database } = parseServerDatabase(
    process.env.SQLSERVER_CONNECTION_STRING
  );

  if (driver === "mock") {
    return {
      ok: true,
      repositoryDriver: "mock",
      connection: "SKIPPED",
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
      lastHealthCheck,
      errors: [],
      warnings: [
        "Repository driver is mock — SQL connectivity and schema checks were skipped.",
      ],
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const started = Date.now();
  let connection: DatabaseHealth["connection"] = "FAILED";
  let schemaVersion: string | null = null;
  let pending: MigrationEntry[] = [];
  let missingTables: string[] = [];
  let missingColumns: string[] = [];
  let responseTimeMs: number | null = null;
  let databaseUser: string | null = null;
  let seedDataPresent: boolean | null = null;
  let emptyCoreTables: string[] = [];
  let poolState: ConnectionPoolState | null = null;

  try {
    const pool = await getPool();
    await pool.request().query("SELECT 1 AS ok");
    connection = "OK";
    responseTimeMs = Date.now() - started;
    poolState = getConnectionPoolState(pool);

    try {
      const who = await pool
        .request()
        .query("SELECT SUSER_SNAME() AS LoginName");
      databaseUser =
        (who.recordset[0]?.LoginName as string | undefined) ?? null;
    } catch {
      databaseUser = null;
    }

    missingTables = await findMissingTables();
    if (missingTables.length > 0) {
      errors.push(`Missing required tables: ${missingTables.join(", ")}`);
    }
    const existingTables = REQUIRED_TABLES.filter(
      (t) => !missingTables.includes(t)
    );

    try {
      missingColumns = await findMissingColumns(existingTables);
      if (missingColumns.length > 0) {
        errors.push(
          `Missing required columns: ${missingColumns.join(", ")}. Run: npm run db:migrate`
        );
      }
    } catch {
      warnings.push("Column verification could not be completed.");
    }

    try {
      emptyCoreTables = await findEmptyCoreTables(existingTables);
      seedDataPresent = emptyCoreTables.length === 0;
      if (!seedDataPresent) {
        warnings.push(
          `Seed data not detected — empty core tables: ${emptyCoreTables.join(", ")}. Run: npm run db:seed (then npm run db:passwords).`
        );
      }
    } catch {
      seedDataPresent = null;
    }

    try {
      const applied = await listAppliedVersions();
      schemaVersion = latestAppliedVersion(applied);
      pending = pendingMigrations(applied);
      if (pending.length > 0) {
        errors.push(
          `Pending migrations: ${pending.map((m) => m.version).join(", ")}. Run: npm run db:migrate`
        );
      }
      if (
        schemaVersion &&
        schemaVersion < EXPECTED_SCHEMA_VERSION &&
        pending.length === 0
      ) {
        errors.push(
          `Schema version ${schemaVersion} is behind expected ${EXPECTED_SCHEMA_VERSION}.`
        );
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  } catch (e) {
    connection = "FAILED";
    responseTimeMs = Date.now() - started;
    errors.push(
      e instanceof Error
        ? `Database connection failed: ${e.message}`
        : "Database connection failed"
    );
  }

  return {
    ok: errors.length === 0 && connection === "OK",
    repositoryDriver: "sql",
    connection,
    databaseName: database,
    server,
    databaseUser,
    pool: poolState,
    schemaVersion,
    expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
    pendingMigrations: pending.map((m) => m.version),
    missingTables,
    missingColumns,
    seedDataPresent,
    emptyCoreTables,
    responseTimeMs,
    lastHealthCheck,
    errors,
    warnings,
  };
}

/** DI verification result — verified means constructed AND exposing methods. */
export type RegistrationCheck = {
  repositories: { verified: number; total: number };
  criticalServices: { verified: number; total: number };
  optionalServices: { verified: number; total: number };
  /** One cheapest-possible live read per critical repository. */
  smokeTests: { name: string; ok: boolean }[];
  failures: string[];
};

export function registrationOk(reg: RegistrationCheck): boolean {
  return (
    reg.repositories.verified === reg.repositories.total &&
    reg.criticalServices.verified === reg.criticalServices.total &&
    reg.smokeTests.every((t) => t.ok)
  );
}

const REPORT_LABEL_WIDTH = 25;

type RowStatus = "pass" | "fail" | "warn" | "info";

type ReportRow = {
  label: string;
  value: string;
  status: RowStatus;
};

/** "Environment ............. Development" style row. */
function renderRow(label: string, value: string): string {
  const dots = ".".repeat(Math.max(2, REPORT_LABEL_WIDTH - label.length));
  return `${label} ${dots} ${value}`;
}

export function formatStartupReport(input: {
  driver: RepositoryDriver;
  nodeEnv: string;
  envOk: boolean;
  sessionSecretOk: boolean;
  connectionStringConfigured: boolean;
  developmentToolkitEnabled: boolean;
  buildVersion: string;
  gitCommit?: string | null;
  gitBranch?: string | null;
  registration?: RegistrationCheck | null;
  startupTimeMs?: number | null;
  health: DatabaseHealth | null;
}): string {
  const health = input.health;
  const mock = input.driver === "mock";
  const reg = input.registration ?? null;
  const environmentLabel =
    input.nodeEnv === "production"
      ? "Production"
      : input.nodeEnv === "test"
        ? "Test"
        : "Development";

  const identityRows: ReportRow[] = [
    { label: "Environment", value: environmentLabel, status: "info" },
    { label: "Version", value: input.buildVersion, status: "info" },
    { label: "Commit", value: input.gitCommit ?? "unknown", status: "info" },
    { label: "Branch", value: input.gitBranch ?? "unknown", status: "info" },
  ];

  const databaseRows: ReportRow[] = [
    {
      label: "Repository Driver",
      value: input.driver.toUpperCase(),
      status: "info",
    },
    {
      label: "Database Driver",
      value: mock ? "n/a (mock)" : "mssql/msnodesqlv8",
      status: "info",
    },
    {
      label: "Database",
      value: health?.databaseName ?? (mock ? "n/a (mock)" : "unknown"),
      status: "info",
    },
    {
      label: "Database User",
      value: health?.databaseUser ?? (mock ? "n/a (mock)" : "unknown"),
      status: "info",
    },
    {
      label: "Connection",
      value:
        health?.connection === "OK"
          ? "PASS"
          : health?.connection === "SKIPPED" || mock
            ? "SKIPPED (mock)"
            : "FAIL",
      status: mock ? "info" : health?.connection === "OK" ? "pass" : "fail",
    },
    {
      label: "Connection Pool",
      value: mock
        ? "SKIPPED (mock)"
        : health?.pool
          ? `${health.pool.connected ? "Connected" : "NOT CONNECTED"} (min ${health.pool.min ?? "?"}, max ${health.pool.max ?? "?"})`
          : "FAIL",
      status: mock
        ? "info"
        : health?.pool?.connected
          ? "pass"
          : "fail",
    },
    {
      label: "Schema",
      value: mock
        ? "n/a (mock)"
        : `${health?.schemaVersion ?? "unknown"} / Expected ${EXPECTED_SCHEMA_VERSION}`,
      status: mock
        ? "info"
        : health?.schemaVersion === EXPECTED_SCHEMA_VERSION
          ? "pass"
          : "fail",
    },
    {
      label: "Pending Migrations",
      value: health?.pendingMigrations.length
        ? health.pendingMigrations.join(", ")
        : "None",
      status: mock ? "info" : health?.pendingMigrations.length ? "fail" : "pass",
    },
    {
      label: "Required Tables",
      value: mock
        ? "SKIPPED (mock)"
        : health?.missingTables.length
          ? `FAIL (missing: ${health.missingTables.join(", ")})`
          : health?.connection === "OK"
            ? "PASS"
            : "UNKNOWN",
      status: mock
        ? "info"
        : health?.connection === "OK" && !health.missingTables.length
          ? "pass"
          : "fail",
    },
    {
      label: "Required Columns",
      value: mock
        ? "SKIPPED (mock)"
        : health?.missingColumns.length
          ? `FAIL (missing: ${health.missingColumns.join(", ")})`
          : health?.connection === "OK"
            ? "PASS"
            : "UNKNOWN",
      status: mock
        ? "info"
        : health?.connection === "OK" && !health.missingColumns.length
          ? "pass"
          : "fail",
    },
    {
      label: "Seed Data",
      value: mock
        ? "n/a (mock — seeded in memory)"
        : health?.seedDataPresent === true
          ? `Present (${SEED_CORE_TABLES.length}/${SEED_CORE_TABLES.length} core tables)`
          : health?.seedDataPresent === false
            ? `WARNING (empty: ${health.emptyCoreTables.join(", ")})`
            : "UNKNOWN",
      status: mock
        ? "info"
        : health?.seedDataPresent === false
          ? "warn"
          : health?.seedDataPresent === true
            ? "pass"
            : "info",
    },
  ];

  const configRows: ReportRow[] = [
    {
      label: "Session Secret",
      value: input.sessionSecretOk
        ? "Configured"
        : "WARNING (Development Fallback in use)",
      status: input.sessionSecretOk ? "pass" : "warn",
    },
    {
      label: "Connection String",
      value: input.connectionStringConfigured
        ? "Configured"
        : "WARNING (Built-in Default in use)",
      status: input.connectionStringConfigured ? "pass" : "warn",
    },
    {
      label: "Development Toolkit",
      value: input.developmentToolkitEnabled ? "Enabled" : "Disabled",
      status: "info",
    },
    {
      label: "Repositories",
      value: reg
        ? `${reg.repositories.verified === reg.repositories.total ? "PASS" : "FAIL"} (${reg.repositories.verified}/${reg.repositories.total} verified)`
        : "UNKNOWN",
      status: reg
        ? reg.repositories.verified === reg.repositories.total
          ? "pass"
          : "fail"
        : "info",
    },
    {
      label: "Critical Services",
      value: reg
        ? `${reg.criticalServices.verified === reg.criticalServices.total ? "PASS" : "FAIL"} (${reg.criticalServices.verified}/${reg.criticalServices.total} verified)`
        : "UNKNOWN",
      status: reg
        ? reg.criticalServices.verified === reg.criticalServices.total
          ? "pass"
          : "fail"
        : "info",
    },
    {
      label: "Optional Services",
      value: reg
        ? reg.optionalServices.verified === reg.optionalServices.total
          ? `PASS (${reg.optionalServices.verified}/${reg.optionalServices.total})`
          : `WARNING (${reg.optionalServices.verified}/${reg.optionalServices.total} verified)`
        : "UNKNOWN",
      status: reg
        ? reg.optionalServices.verified === reg.optionalServices.total
          ? "pass"
          : "warn"
        : "info",
    },
    {
      label: "Repository Smoke Tests",
      value: reg
        ? reg.smokeTests.length === 0
          ? "SKIPPED"
          : reg.smokeTests.every((t) => t.ok)
            ? `PASS (${reg.smokeTests.length}/${reg.smokeTests.length} live reads)`
            : `FAIL (${reg.smokeTests.filter((t) => t.ok).length}/${reg.smokeTests.length} — failed: ${reg.smokeTests
                .filter((t) => !t.ok)
                .map((t) => t.name)
                .join(", ")})`
        : "UNKNOWN",
      status: reg
        ? reg.smokeTests.length === 0
          ? "info"
          : reg.smokeTests.every((t) => t.ok)
            ? "pass"
            : "fail"
        : "info",
    },
  ];

  const allRows = [...identityRows, ...databaseRows, ...configRows];
  const gradedRows = allRows.filter(
    (r) => r.status === "pass" || r.status === "fail"
  );
  const failures = allRows.filter((r) => r.status === "fail").length;
  const warningCount =
    allRows.filter((r) => r.status === "warn").length +
    (health?.warnings.length ?? 0);
  const validationPass = input.envOk && failures === 0;

  const summaryRows: ReportRow[] = [
    {
      label: "Startup Validation",
      value: validationPass ? "PASS" : "FAIL",
      status: "info",
    },
    {
      label: "Checks Passed",
      value: `${gradedRows.length - failures}/${gradedRows.length}`,
      status: "info",
    },
    { label: "Warnings", value: String(warningCount), status: "info" },
    { label: "Failures", value: String(failures), status: "info" },
    {
      label: "Startup Time",
      value: input.startupTimeMs != null ? `${input.startupTimeMs} ms` : "unknown",
      status: "info",
    },
  ];

  const lines = [
    "========== SYSTEM STARTUP ==========",
    "",
    ...identityRows.map((r) => renderRow(r.label, r.value)),
    "",
    ...databaseRows.map((r) => renderRow(r.label, r.value)),
    "",
    ...configRows.map((r) => renderRow(r.label, r.value)),
    "",
    ...summaryRows.map((r) => renderRow(r.label, r.value)),
    "",
    "====================================",
  ];
  const problems = [...(health?.errors ?? []), ...(reg?.failures ?? [])];
  if (problems.length) {
    lines.splice(
      lines.length - 1,
      0,
      "Errors:",
      ...problems.map((e) => `  - ${e}`),
      ""
    );
  }
  return lines.join("\n");
}

/**
 * Validate SQL readiness for serving traffic. Throws if the driver is sql
 * and the database/schema is not ready.
 */
export async function assertDatabaseReady(
  driver: RepositoryDriver
): Promise<DatabaseHealth> {
  const health = await checkDatabaseHealth(driver);
  if (driver === "sql" && !health.ok) {
    throw new Error(
      `Database validation failed:\n- ${health.errors.join("\n- ")}`
    );
  }
  return health;
}

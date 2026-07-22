import { NextResponse } from "next/server";
import { getCurrentUser, getRepositoryDriver } from "@/infrastructure/di";
import { checkDatabaseHealth } from "@/infrastructure/startup/database-health";
import { validateEnvironment } from "@/infrastructure/startup/env";
import { EXPECTED_SCHEMA_VERSION } from "@/infrastructure/migrations/registry";

/**
 * GET /api/v1/system/database-health
 *
 * Authenticated diagnostics endpoint. Unauthenticated callers (load
 * balancers, uptime probes) get a bare status only. Signed-in users get
 * operational detail — but never connection strings, server hostnames,
 * SQL versions, or filesystem paths.
 */
export async function GET() {
  const correlationId = crypto.randomUUID();
  const env = validateEnvironment();
  const driver = getRepositoryDriver();
  const health = await checkDatabaseHealth(driver);
  const status = health.ok && env.ok ? 200 : 503;

  let authenticated = false;
  try {
    await getCurrentUser();
    authenticated = true;
  } catch {
    authenticated = false;
  }

  if (!authenticated) {
    return NextResponse.json(
      {
        data: { status: status === 200 ? "ok" : "unavailable" },
        correlationId,
      },
      { status }
    );
  }

  return NextResponse.json(
    {
      data: {
        connection: health.connection,
        driver: health.repositoryDriver,
        schemaVersion: health.schemaVersion,
        expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
        migrationVersion: health.schemaVersion,
        pendingMigrations: health.pendingMigrations,
        databaseName: health.databaseName,
        databaseUser: health.databaseUser,
        seedDataPresent: health.seedDataPresent,
        emptyCoreTables: health.emptyCoreTables,
        responseTimeMs: health.responseTimeMs,
        repositoryDriver: health.repositoryDriver,
        lastHealthCheck: health.lastHealthCheck,
        missingTables: health.missingTables,
        missingColumns: health.missingColumns,
        environmentOk: env.ok,
        sessionSecret: env.sessionSecretOk ? "OK" : "MISSING",
        errors: [...env.errors, ...health.errors],
        warnings: [...env.warnings, ...health.warnings],
      },
      correlationId,
    },
    { status }
  );
}

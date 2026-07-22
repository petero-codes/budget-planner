/**
 * Apply every pending migration in registry order.
 * Usage: npx tsx scripts/migrate-all.ts
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import sql from "mssql/msnodesqlv8";
import {
  pendingMigrations,
} from "../src/infrastructure/migrations/registry";

async function listApplied(pool: sql.ConnectionPool): Promise<string[]> {
  const exists = await pool
    .request()
    .query("SELECT OBJECT_ID('dbo.SchemaVersion', 'U') AS Id");
  if (!exists.recordset[0]?.Id) return [];
  const result = await pool
    .request()
    .query("SELECT Version FROM dbo.SchemaVersion");
  return (result.recordset as { Version: string }[]).map((r) => r.Version);
}

async function main() {
  const server = process.env.SQLSERVER_ADMIN_SERVER ?? "localhost\\SQLEXPRESS";
  const database = process.env.SQLSERVER_ADMIN_DATABASE ?? "BudgetOperations";
  const connectionString = [
    "Driver={ODBC Driver 17 for SQL Server}",
    `Server=${server}`,
    `Database=${database}`,
    "Trusted_Connection=Yes",
    "TrustServerCertificate=Yes",
  ].join(";");

  const pool = await new sql.ConnectionPool({
    connectionString,
  } as unknown as sql.config).connect();

  try {
    const applied = await listApplied(pool);
    const pending = pendingMigrations(applied);
    if (pending.length === 0) {
      console.log("No pending migrations.");
      return;
    }

    console.log(`Pending: ${pending.map((m) => m.version).join(", ")}`);
    for (const migration of pending) {
      const file = path.join("docs", "migrations", migration.fileName);
      console.log(`\n→ ${migration.version} ${migration.title}`);
      const result = spawnSync(
        "npx",
        ["tsx", "scripts/apply-migration.ts", file],
        { stdio: "inherit", shell: true }
      );
      if (result.status !== 0) {
        process.exitCode = result.status ?? 1;
        return;
      }
    }
    console.log("\nAll pending migrations applied.");
  } finally {
    await pool.close();
  }
}

void main();

/**
 * Apply a .sql migration using a privileged Trusted_Connection (Windows auth).
 * Usage: npx tsx scripts/apply-migration.ts docs/migrations/005-app-budget-ops-role.sql
 */
import { readFileSync } from "node:fs";
import sql from "mssql/msnodesqlv8";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Provide a .sql file path.");
    process.exitCode = 1;
    return;
  }

  const server = process.env.SQLSERVER_ADMIN_SERVER ?? "localhost\\SQLEXPRESS";
  const database = process.env.SQLSERVER_ADMIN_DATABASE ?? "BudgetOperations";
  const connectionString = [
    "Driver={ODBC Driver 17 for SQL Server}",
    `Server=${server}`,
    `Database=${database}`,
    "Trusted_Connection=Yes",
    "TrustServerCertificate=Yes",
  ].join(";");

  const script = readFileSync(file, "utf8");
  // Split on batch separators (GO on its own line).
  const batches = script
    .split(/^\s*GO\s*$/gim)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  console.log(`Applying ${file} (${batches.length} batches) as Trusted_Connection...`);
  const pool = await new sql.ConnectionPool({ connectionString } as unknown as sql.config).connect();
  try {
    for (let i = 0; i < batches.length; i++) {
      await pool.request().batch(batches[i]!);
      console.log(`  batch ${i + 1}/${batches.length} ok`);
    }
    console.log("Migration applied successfully.");
  } catch (e) {
    console.error("FAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await pool.close();
  }
}

void main();

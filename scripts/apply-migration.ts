/**
 * Apply a .sql migration using a privileged Trusted_Connection (Windows auth).
 * Records the version into dbo.SchemaVersion when the filename starts with NNN-.
 * Usage: npx tsx scripts/apply-migration.ts docs/migrations/012-schema-version.sql
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import sql from "mssql/msnodesqlv8";
import {
  parseMigrationVersionFromPath,
} from "../src/infrastructure/migrations/registry";

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
  const batches = script
    .split(/^\s*GO\s*$/gim)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const version = parseMigrationVersionFromPath(file);
  const fileName = path.basename(file);

  console.log(
    `Applying ${file} (${batches.length} batches) as Trusted_Connection...`
  );
  const pool = await new sql.ConnectionPool({
    connectionString,
  } as unknown as sql.config).connect();
  try {
    for (let i = 0; i < batches.length; i++) {
      await pool.request().batch(batches[i]!);
      console.log(`  batch ${i + 1}/${batches.length} ok`);
    }

    if (version) {
      // SchemaVersion may not exist until 012 — create is idempotent via 012 itself.
      const table = await pool.request().query(
        "SELECT OBJECT_ID('dbo.SchemaVersion', 'U') AS Id"
      );
      if (table.recordset[0]?.Id) {
        await pool
          .request()
          .input("version", sql.NVarChar(20), version)
          .input("fileName", sql.NVarChar(260), fileName)
          .input("appliedBy", sql.NVarChar(200), process.env.USERNAME ?? "apply-migration")
          .query(`
            IF NOT EXISTS (SELECT 1 FROM dbo.SchemaVersion WHERE Version = @version)
              INSERT INTO dbo.SchemaVersion (Version, AppliedAt, AppliedBy, FileName)
              VALUES (@version, SYSUTCDATETIME(), @appliedBy, @fileName);
          `);
        console.log(`  recorded SchemaVersion ${version}`);
      } else if (version !== "012") {
        console.warn(
          "  SchemaVersion table missing — apply 012-schema-version.sql to enable tracking."
        );
      }
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

/**
 * Backfill ResponsiblePersonId on existing cost centers from the seed mapping,
 * without wiping users/passwords. Idempotent.
 * Usage: npx tsx scripts/backfill-master-data.ts
 */
import sql from "mssql/msnodesqlv8";
import { costCenters } from "../src/infrastructure/repositories/mock/seed";

const connectionString = [
  "Driver={ODBC Driver 17 for SQL Server}",
  "Server=localhost\\SQLEXPRESS",
  "Database=BudgetOperations",
  "Trusted_Connection=Yes",
  "TrustServerCertificate=Yes",
].join(";");

async function main() {
  const pool = await new sql.ConnectionPool({
    connectionString,
  } as unknown as sql.config).connect();
  try {
    let updated = 0;
    for (const cc of costCenters) {
      if (!cc.responsiblePersonId) continue;
      const r = pool.request();
      r.input("code", sql.NVarChar(50), cc.code);
      r.input("responsible", sql.UniqueIdentifier, cc.responsiblePersonId);
      const result = await r.query(`
        UPDATE dbo.CostCenters
        SET ResponsiblePersonId = @responsible
        WHERE Code = @code AND ResponsiblePersonId IS NULL
      `);
      updated += result.rowsAffected[0] ?? 0;
    }
    console.log(`Backfilled ResponsiblePersonId on ${updated} cost center(s).`);
  } finally {
    await pool.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Gives seeded users an initial password and marks their email verified,
 * so pre-existing accounts can sign in with the auth module.
 * Usage: npm run db:passwords  (default password: KenGen@2026)
 */
import sql from "mssql/msnodesqlv8";
import { hashPassword } from "../src/lib/security/passwords";

const connectionString = [
  "Driver={ODBC Driver 17 for SQL Server}",
  "Server=localhost\\SQLEXPRESS",
  "Database=BudgetOperations",
  "Trusted_Connection=Yes",
  "TrustServerCertificate=Yes",
].join(";");

const DEFAULT_PASSWORD = process.env.SEED_USER_PASSWORD ?? "KenGen@2026";

async function main() {
  const pool = await new sql.ConnectionPool({
    connectionString,
  } as unknown as sql.config).connect();

  // FORCE=1 resets every active user (useful when demo passwords get out of sync).
  const force = process.env.FORCE === "1" || process.argv.includes("--force");
  const users = await pool.request().query<{ UserId: string; Email: string }>(`
    SELECT UserId, Email FROM dbo.Users
    WHERE IsDeleted = 0
      AND (${force ? "1=1" : "PasswordHash IS NULL"})
  `);

  for (const u of users.recordset) {
    const r = pool.request();
    r.input("id", sql.UniqueIdentifier, u.UserId);
    r.input("hash", sql.NVarChar(500), hashPassword(DEFAULT_PASSWORD));
    await r.query(`
      UPDATE dbo.Users
      SET PasswordHash = @hash,
          EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSUTCDATETIME()),
          UpdatedAt = SYSUTCDATETIME()
      WHERE UserId = @id
    `);
    console.log(`Password set for ${u.Email}`);
  }

  console.log(
    `${users.recordset.length} account(s) updated. Default password: ${DEFAULT_PASSWORD}`
  );
  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

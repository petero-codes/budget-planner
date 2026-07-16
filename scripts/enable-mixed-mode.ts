/**
 * Enable SQL Server mixed-mode authentication (LoginMode = 2).
 * Requires a service restart afterwards to take effect.
 * Usage: npx tsx scripts/enable-mixed-mode.ts
 */
import sql from "mssql/msnodesqlv8";

async function main() {
  const server = process.env.SQLSERVER_ADMIN_SERVER ?? "localhost\\SQLEXPRESS";
  const connectionString = [
    "Driver={ODBC Driver 17 for SQL Server}",
    `Server=${server}`,
    "Database=master",
    "Trusted_Connection=Yes",
    "TrustServerCertificate=Yes",
  ].join(";");

  const pool = await new sql.ConnectionPool({ connectionString } as unknown as sql.config).connect();
  try {
    await pool.request().query(
      "EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', N'Software\\Microsoft\\MSSQLServer\\MSSQLServer', N'LoginMode', REG_DWORD, 2",
    );
    const check = await pool.request().query(
      "DECLARE @v INT; EXEC xp_instance_regread N'HKEY_LOCAL_MACHINE', N'Software\\Microsoft\\MSSQLServer\\MSSQLServer', N'LoginMode', @v OUTPUT; SELECT @v AS LoginMode",
    );
    console.log("LoginMode now:", check.recordset[0]?.LoginMode, "(2 = mixed mode) — restart required.");
  } finally {
    await pool.close();
  }
}

void main();

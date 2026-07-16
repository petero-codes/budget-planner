import sql from "mssql/msnodesqlv8";
import { AsyncLocalStorage } from "node:async_hooks";
import { withSqlRetry } from "./sql-retry";

let poolPromise: Promise<sql.ConnectionPool> | null = null;

function odbcConnectionString(): string {
  const raw =
    process.env.SQLSERVER_CONNECTION_STRING ??
    "Server=localhost\\SQLEXPRESS;Database=BudgetOperations;Trusted_Connection=True;TrustServerCertificate=True;";

  // msnodesqlv8 expects an ODBC connection string.
  if (/Driver=/i.test(raw)) return raw;

  const serverMatch = /Server=([^;]+)/i.exec(raw);
  const databaseMatch = /Database=([^;]+)/i.exec(raw);
  const uidMatch = /(?:User Id|UID)=([^;]+)/i.exec(raw);
  const pwdMatch = /(?:Password|PWD)=([^;]+)/i.exec(raw);
  const trusted = /Trusted_Connection\s*=\s*(Yes|True)/i.test(raw);

  const server = (serverMatch?.[1] ?? "localhost\\SQLEXPRESS").trim();
  const database = (databaseMatch?.[1] ?? "BudgetOperations").trim();

  const parts = [
    "Driver={ODBC Driver 17 for SQL Server}",
    `Server=${server}`,
    `Database=${database}`,
    "TrustServerCertificate=Yes",
  ];

  if (trusted || (!uidMatch && !pwdMatch)) {
    parts.push("Trusted_Connection=Yes");
  } else {
    parts.push(`UID=${uidMatch![1]!.trim()}`);
    parts.push(`PWD=${pwdMatch?.[1]?.trim() ?? ""}`);
  }

  return parts.join(";");
}

/**
 * Per-async-context transaction binding.
 * A module-global holder is unsafe: concurrent HTTP requests steal each
 * other's transaction connection and trigger:
 * "Can't acquire connection for the request. There is another request in progress."
 */
export type TxContext = {
  transaction: sql.Transaction;
  /** msnodesqlv8 allows only one active request per connection — serialize. */
  chain: Promise<unknown>;
};

export const txStorage = new AsyncLocalStorage<TxContext>();

/** Shared SQL Server connection pool (server-side only). */
export async function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool({
      connectionString: odbcConnectionString(),
      pool: {
        max: 20,
        min: 0,
        idleTimeoutMillis: 30_000,
      },
      options: {
        trustServerCertificate: true,
      },
    } as unknown as sql.config)
      .connect()
      .catch((err) => {
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

/** Wrap Request.query / Request.batch with transient retry. */
export function withRetryOnRequest(request: sql.Request): sql.Request {
  const origQuery = request.query.bind(request);
  const origBatch = request.batch.bind(request);

  request.query = ((command: Parameters<typeof request.query>[0]) =>
    withSqlRetry(() => origQuery(command))) as typeof request.query;

  request.batch = ((command: Parameters<typeof request.batch>[0]) =>
    withSqlRetry(() => origBatch(command))) as typeof request.batch;

  return request;
}

export { sql };
export { isTransientSqlError, withSqlRetry } from "./sql-retry";

export type SqlRequest = sql.Request;

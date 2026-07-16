/** SQL Server transient errors eligible for retry (strategies.md). */
const TRANSIENT_NUMBERS = new Set([
  -2, // Timeout
  1205, // Deadlock victim
  1222, // Lock request timeout
  40197, // Service error processing request (Azure)
  40501, // Service busy / throttling
  40613, // Database unavailable
  49918, // Cannot process request
  49919, // Cannot process create/update
  49920, // Too many operations
]);

const RETRY_DELAYS_MS = [100, 300, 900] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sqlErrorNumber(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const e = err as {
    number?: number;
    code?: string | number;
    originalError?: { info?: { number?: number }; number?: number };
  };
  if (typeof e.number === "number") return e.number;
  if (typeof e.code === "number") return e.code;
  const nested =
    e.originalError?.info?.number ?? e.originalError?.number ?? null;
  return typeof nested === "number" ? nested : null;
}

export function isTransientSqlError(err: unknown): boolean {
  const n = sqlErrorNumber(err);
  if (n !== null && TRANSIENT_NUMBERS.has(n)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  if (/timeout/i.test(msg) && /connection|request|login/i.test(msg)) {
    return true;
  }
  if (/ECONNRESET|ETIMEDOUT|ESOCKET/i.test(msg)) return true;
  return false;
}

/**
 * Retry only true SQL transient failures (deadlock, throttle, timeout).
 * Never retries constraint / validation / business errors.
 */
export async function withSqlRetry<T>(
  operation: () => Promise<T>,
  correlationId?: string | null
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (!isTransientSqlError(err) || attempt === RETRY_DELAYS_MS.length) {
        throw err;
      }
      const delay = RETRY_DELAYS_MS[attempt]!;
      console.warn(
        JSON.stringify({
          level: "WARN",
          event: "sql_transient_retry",
          attempt: attempt + 1,
          maxAttempts: RETRY_DELAYS_MS.length + 1,
          delayMs: delay,
          sqlNumber: sqlErrorNumber(err),
          message: err instanceof Error ? err.message : String(err),
          correlationId: correlationId ?? null,
        })
      );
      await sleep(delay);
    }
  }
  throw lastError;
}

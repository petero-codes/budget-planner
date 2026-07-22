/**
 * Map unexpected errors to client-safe messages.
 * In production, never return raw exception text (stack/SQL/path leakage).
 * Auth session messages stay explicit so the client can redirect to login.
 */

import "server-only";


const AUTH_MESSAGES = new Set([
  "Not signed in",
  "Current user not found — sign in again",
]);

export function isAuthSessionError(message: string): boolean {
  return (
    AUTH_MESSAGES.has(message) || message.startsWith("Current user not found")
  );
}

/** Client-facing message for unexpected failures. */
export function safeInternalMessage(
  error: unknown,
  options?: { forceProduction?: boolean }
): string {
  const raw = error instanceof Error ? error.message : "Unexpected error";
  if (isAuthSessionError(raw)) return raw;
  const isProduction =
    options?.forceProduction === true || process.env.NODE_ENV === "production";
  if (isProduction) {
    return "An unexpected error occurred. Please try again or contact support.";
  }
  return raw;
}

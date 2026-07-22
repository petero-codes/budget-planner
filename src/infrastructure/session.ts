import "server-only";

import { cookies } from "next/headers";
import { verifySessionClaims } from "@/lib/security/session-token";
import { isSessionRevoked } from "@/infrastructure/development/session-registry";

export const SESSION_COOKIE = "kengen_budget_uid";

/**
 * In-memory fallback for contexts without cookies (unit tests, mock driver).
 * Empty string = not signed in.
 */
let memoryUserId = "";

export function setMemoryUserId(userId: string): void {
  memoryUserId = userId;
}

/** Read current user id from the signed session cookie (App Router / Route Handlers). */
export async function readSessionUserId(): Promise<string> {
  try {
    const jar = cookies();
    const fromCookie = jar.get(SESSION_COOKIE)?.value;
    if (fromCookie) {
      const claims = await verifySessionClaims(fromCookie);
      if (claims && !isSessionRevoked(claims.userId, claims.iat)) {
        return claims.userId;
      }
    }
  } catch {
    /* cookies() throws outside of a request context */
  }
  return memoryUserId;
}

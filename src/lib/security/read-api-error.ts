import { NextResponse } from "next/server";
import { AuthorizationError } from "@/application/authorization-service";
import {
  isAuthSessionError,
  safeInternalMessage,
} from "@/lib/security/safe-error-message";

/**
 * Shared catch envelope for read-oriented API routes that do not use budgetApiError.
 * Maps session failures → 401 and AuthorizationError → 403 (never 500 for auth).
 */
export function readApiError(e: unknown, correlationId: string): NextResponse {
  if (e instanceof AuthorizationError) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: e.message, correlationId } },
      { status: 403 }
    );
  }
  const raw = e instanceof Error ? e.message : "Unexpected error";
  if (isAuthSessionError(raw)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: raw, correlationId } },
      { status: 401 }
    );
  }
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL",
        message: safeInternalMessage(e),
        correlationId,
      },
    },
    { status: 500 }
  );
}

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  DevelopmentToolkitNotFoundError,
  assertDevelopmentToolkitAccess,
} from "@/lib/development-toolkit-access";
import { DevelopmentToolkitError } from "@/application/development/development-toolkit-service";
import { FiscalYearServiceError } from "@/application/fiscal-year-service";
import { AuthorizationError } from "@/application/authorization-service";
import { ConcurrencyConflictError } from "@/application/concurrency-error";
import { getCurrentUser } from "@/infrastructure/di";
import { safeInternalMessage } from "@/lib/security/safe-error-message";
import type { User } from "@/domain/entities";

function jsonError(
  status: number,
  code: string,
  message: string,
  correlationId: string
) {
  return NextResponse.json(
    { error: { code, message, correlationId } },
    { status }
  );
}

/** Map unexpected SQL / driver errors to actionable client responses (never raw 500 when avoidable). */
function mapSqlFailure(
  raw: string,
  correlationId: string
): NextResponse | null {
  if (/Invalid column name/i.test(raw) && /IsDemo|IsCleared|CreatedByToolkit|DemoBatchId/i.test(raw)) {
    return jsonError(
      400,
      "MIGRATION_REQUIRED",
      "Database is missing Development Toolkit columns. Apply migration 008: npx tsx scripts/apply-migration.ts docs/migrations/008-development-toolkit.sql",
      correlationId
    );
  }
  if (/uniqueidentifier/i.test(raw) || /converting from a character string/i.test(raw)) {
    return jsonError(
      400,
      "DATA_INTEGRITY",
      "A database ID was not a valid GUID. Refresh and try again.",
      correlationId
    );
  }
  if (
    /FK_BudgetLineage_CurrentVersion/i.test(raw) ||
    /FOREIGN KEY constraint/i.test(raw)
  ) {
    return jsonError(
      400,
      "DATA_INTEGRITY",
      "Could not save related budget data (foreign key). Retry; if it persists, run System Integrity.",
      correlationId
    );
  }
  if (/UNIQUE|duplicate key|Violation of UNIQUE KEY/i.test(raw)) {
    if (/FiscalYear|YearLabel/i.test(raw)) {
      return jsonError(
        400,
        "DUPLICATE",
        "That fiscal year already exists. Pick another source year or remove the target year first.",
        correlationId
      );
    }
    if (/BudgetPlan|Lineage|ActiveUnique|LineageInPlay/i.test(raw)) {
      return jsonError(
        400,
        "DUPLICATE",
        "An active budget already exists for this cost centre / fiscal year / type. Reset or delete the demo first.",
        correlationId
      );
    }
    return jsonError(
      400,
      "DUPLICATE",
      "A unique constraint blocked this action. Check for an existing row and try again.",
      correlationId
    );
  }
  if (/String or binary data would be truncated/i.test(raw)) {
    return jsonError(
      400,
      "VALIDATION",
      "A value was too long for the database column. Shorten the reason and retry.",
      correlationId
    );
  }
  return null;
}

export async function withDevelopmentToolkit(
  handler: (actor: User, correlationId: string) => Promise<NextResponse>
): Promise<NextResponse> {
  const correlationId = crypto.randomUUID();
  try {
    const actor = await getCurrentUser();
    assertDevelopmentToolkitAccess(actor);
    return await handler(actor, correlationId);
  } catch (e) {
    if (e instanceof DevelopmentToolkitNotFoundError) {
      return jsonError(404, "NOT_FOUND", "Not Found", correlationId);
    }
    if (e instanceof DevelopmentToolkitError) {
      return jsonError(400, e.code, e.message, correlationId);
    }
    if (e instanceof FiscalYearServiceError) {
      return jsonError(400, e.code, e.message, correlationId);
    }
    if (e instanceof AuthorizationError) {
      return jsonError(403, "FORBIDDEN", e.message, correlationId);
    }
    if (e instanceof ConcurrencyConflictError) {
      return jsonError(409, "CONFLICT", e.message, correlationId);
    }
    if (e instanceof ZodError) {
      const first = e.issues[0];
      const path = first?.path?.length ? first.path.join(".") : "body";
      return jsonError(
        400,
        "VALIDATION",
        first ? `${path}: ${first.message}` : "Invalid request body",
        correlationId
      );
    }
    if (e instanceof Error && e.message === "Not signed in") {
      return jsonError(404, "NOT_FOUND", "Not Found", correlationId);
    }
    if (
      e instanceof Error &&
      e.message.startsWith("Current user not found")
    ) {
      return jsonError(401, "UNAUTHORIZED", e.message, correlationId);
    }

    const raw = e instanceof Error ? e.message : "";
    const mapped = mapSqlFailure(raw, correlationId);
    if (mapped) return mapped;

    return jsonError(500, "INTERNAL", safeInternalMessage(e), correlationId);
  }
}

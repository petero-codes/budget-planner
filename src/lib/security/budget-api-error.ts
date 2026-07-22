import "server-only";

import { NextResponse } from "next/server";
import { AuthorizationError } from "@/application/authorization-service";
import { ApprovalServiceError } from "@/application/approval-service";
import { ActiveBudgetConflictError } from "@/application/active-budget-conflict";
import { BudgetLockedApiError } from "@/application/budget-lock-error";
import { FinanceServiceError } from "@/application/finance-service";
import { ConcurrencyConflictError } from "@/application/concurrency-error";
import {
  isAuthSessionError,
  safeInternalMessage,
} from "@/lib/security/safe-error-message";

/** Shared API error envelope for budget mutating routes. */
export function budgetApiError(e: unknown, correlationId: string): NextResponse {
  if (e instanceof ConcurrencyConflictError) {
    return NextResponse.json(
      {
        error: {
          code: e.code,
          message: e.message,
          correlationId,
        },
      },
      { status: 409 }
    );
  }
  if (e instanceof ActiveBudgetConflictError) {
    return NextResponse.json(
      {
        error: {
          code: e.code,
          message: e.message,
          correlationId,
          existingBudget: e.existing,
        },
      },
      { status: 409 }
    );
  }
  if (e instanceof BudgetLockedApiError) {
    return NextResponse.json(
      { error: { code: e.code, message: e.message, correlationId } },
      { status: 403 }
    );
  }
  if (e instanceof FinanceServiceError) {
    return NextResponse.json(
      { error: { code: e.code, message: e.message, correlationId } },
      {
        status:
          e.code === "NOT_FOUND"
            ? 404
            : e.code === "ALREADY_CLAIMED"
              ? 409
              : 422,
      }
    );
  }
  if (e instanceof AuthorizationError) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: e.message, correlationId } },
      { status: 403 }
    );
  }
  if (e instanceof ApprovalServiceError) {
    return NextResponse.json(
      { error: { code: e.code, message: e.message, correlationId } },
      {
        status:
          e.code === "NOT_FOUND"
            ? 404
            : e.code === "DUPLICATE"
              ? 409
              : 422,
      }
    );
  }
  const raw = e instanceof Error ? e.message : "Unexpected error";
  const unauthorized = isAuthSessionError(raw);
  return NextResponse.json(
    {
      error: {
        code: unauthorized ? "UNAUTHORIZED" : "INTERNAL",
        message: unauthorized ? raw : safeInternalMessage(e),
        correlationId,
      },
    },
    { status: unauthorized ? 401 : 500 }
  );
}

import "server-only";

import { NextResponse } from "next/server";
import { AdminUserServiceError } from "@/application/admin-user-service";
import { MasterDataServiceError } from "@/application/master-data-service";
import { FiscalYearServiceError } from "@/application/fiscal-year-service";
import { AuthorizationError } from "@/application/authorization-service";
import {
  isAuthSessionError,
  safeInternalMessage,
} from "@/lib/security/safe-error-message";

export function adminApiError(error: unknown, correlationId: string) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: error.message,
          correlationId,
        },
      },
      { status: 403 }
    );
  }
  if (error instanceof AdminUserServiceError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "DUPLICATE_EMAIL"
          ? 409
          : 422;
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          correlationId,
        },
      },
      { status }
    );
  }
  if (error instanceof MasterDataServiceError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "DUPLICATE_CODE"
          ? 409
          : 422;
    return NextResponse.json(
      {
        error: { code: error.code, message: error.message, correlationId },
      },
      { status }
    );
  }
  if (error instanceof FiscalYearServiceError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "DUPLICATE"
          ? 409
          : 422;
    return NextResponse.json(
      {
        error: { code: error.code, message: error.message, correlationId },
      },
      { status }
    );
  }
  const raw = error instanceof Error ? error.message : "Unexpected error";
  const unauthorized = isAuthSessionError(raw);
  return NextResponse.json(
    {
      error: {
        code: unauthorized ? "UNAUTHORIZED" : "INTERNAL",
        message: unauthorized ? raw : safeInternalMessage(error),
        correlationId,
      },
    },
    { status: unauthorized ? 401 : 500 }
  );
}

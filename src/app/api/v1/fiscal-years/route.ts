import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError } from "@/application/authorization-service";
import {
  FiscalYearServiceError,
} from "@/application/fiscal-year-service";
import {
  fiscalYearService,
  getCurrentUser,
} from "@/infrastructure/di";
import { z } from "zod";
import { parseBody } from "@/lib/security/api-schemas";
import { safeInternalMessage } from "@/lib/security/safe-error-message";

export async function GET() {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const years = await fiscalYearService.listVisible(user);
    const active = await fiscalYearService.getActiveOpen();
    return NextResponse.json({
      data: { years, activeId: active?.id ?? null },
      correlationId,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: e instanceof Error ? e.message : "Not signed in",
          correlationId,
        },
      },
      { status: 401 }
    );
  }
}

const createFySchema = z.object({
  yearLabel: z.number().int().min(2000).max(2100),
  startDate: z.string().min(10).max(10),
  endDate: z.string().min(10).max(10),
});

export async function POST(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const parsed = await parseBody(req, createFySchema, correlationId);
    if (!parsed.ok) return parsed.response;
    const fy = await fiscalYearService.openNew(parsed.data, user, correlationId);
    return NextResponse.json({ data: fy, correlationId }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: e.message, correlationId } },
        { status: 403 }
      );
    }
    if (e instanceof FiscalYearServiceError) {
      return NextResponse.json(
        { error: { code: e.code, message: e.message, correlationId } },
        { status: 422 }
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
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCurrentUser,
  supportIssueService,
} from "@/infrastructure/di";
import { SUPPORT_ISSUE_STATUSES } from "@/domain/support-issue";
import { SupportIssueServiceError } from "@/application/support-issue-service";
import { readApiError } from "@/lib/security/read-api-error";

const updateSchema = z.object({
  status: z.enum(SUPPORT_ISSUE_STATUSES).optional(),
  assignedTo: z.string().nullable().optional(),
  adminNotes: z.string().max(4000).nullable().optional(),
});

function errorResponse(e: unknown, correlationId: string) {
  if (e instanceof SupportIssueServiceError) {
    const status =
      e.code === "FORBIDDEN" ? 403 : e.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json(
      { error: { code: e.code, message: e.message, correlationId } },
      { status }
    );
  }
  return readApiError(e, correlationId);
}

export async function GET(
  _req: NextRequest,
  ctx: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const data = await supportIssueService.get(user, ctx.params.id);
    return NextResponse.json({ data, correlationId });
  } catch (e) {
    return errorResponse(e, correlationId);
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const body = updateSchema.parse(await req.json());
    const data = await supportIssueService.update(
      user,
      ctx.params.id,
      body,
      correlationId
    );
    return NextResponse.json({ data, correlationId });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: e.errors[0]?.message ?? "Invalid input",
            correlationId,
          },
        },
        { status: 400 }
      );
    }
    return errorResponse(e, correlationId);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError } from "@/application/authorization-service";
import { ApprovalServiceError } from "@/application/approval-service";
import {
  budgetPlanService,
  getCurrentUser,
} from "@/infrastructure/di";

function errorResponse(e: unknown, correlationId: string) {
  if (e instanceof AuthorizationError) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: e.message, correlationId } },
      { status: 403 }
    );
  }
  if (e instanceof ApprovalServiceError) {
    return NextResponse.json(
      { error: { code: e.code, message: e.message, correlationId } },
      { status: e.code === "NOT_FOUND" ? 404 : 422 }
    );
  }
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL",
        message: e instanceof Error ? e.message : "Unexpected error",
        correlationId,
      },
    },
    { status: 500 }
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const plan = await budgetPlanService.getById(params.id, user);
    return NextResponse.json({ data: plan, correlationId });
  } catch (e) {
    return errorResponse(e, correlationId);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const plan = await budgetPlanService.updateDraft(params.id, user, body);
    return NextResponse.json({ data: plan, correlationId });
  } catch (e) {
    return errorResponse(e, correlationId);
  }
}

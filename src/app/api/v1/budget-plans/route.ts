import { NextRequest, NextResponse } from "next/server";
import {
  AuthorizationError,
  AuthorizationService,
} from "@/application/authorization-service";
import { ApprovalServiceError } from "@/application/approval-service";
import {
  budgetPlanService,
  getCurrentUser,
} from "@/infrastructure/di";

function errorResponse(e: unknown, correlationId: string) {
  if (e instanceof AuthorizationError) {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: e.message,
          correlationId,
        },
      },
      { status: 403 }
    );
  }
  if (e instanceof ApprovalServiceError) {
    const status =
      e.code === "NOT_FOUND"
        ? 404
        : e.code === "DUPLICATE" || e.code === "INVALID_STATE"
          ? 409
          : e.code === "VALIDATION"
            ? 422
            : 400;
    return NextResponse.json(
      {
        error: {
          code: e.code,
          message: e.message,
          correlationId,
        },
      },
      { status }
    );
  }
  const message = e instanceof Error ? e.message : "Unexpected error";
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL",
        message,
        correlationId,
      },
    },
    { status: 500 }
  );
}

export async function GET() {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const plans = await budgetPlanService.listVisible(user);
    return NextResponse.json({ data: plans, correlationId });
  } catch (e) {
    return errorResponse(e, correlationId);
  }
}

export async function POST(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const plan = await budgetPlanService.createDraft(user, body);
    return NextResponse.json({ data: plan, correlationId }, { status: 201 });
  } catch (e) {
    return errorResponse(e, correlationId);
  }
}

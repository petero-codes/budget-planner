import { NextResponse } from "next/server";
import { AuthorizationError } from "@/application/authorization-service";
import { budgetPlanService, getCurrentUser } from "@/infrastructure/di";

export async function GET() {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const plans = await budgetPlanService.listPendingApprovals(user);
    return NextResponse.json({ data: plans, correlationId });
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: e.message, correlationId } },
        { status: 403 }
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
}

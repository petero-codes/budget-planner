import { NextResponse } from "next/server";
import { budgetPlanService, getCurrentUser } from "@/infrastructure/di";
import { readApiError } from "@/lib/security/read-api-error";

export async function GET() {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const plans = await budgetPlanService.listPendingApprovals(user);
    return NextResponse.json({ data: plans, correlationId });
  } catch (e) {
    return readApiError(e, correlationId);
  }
}

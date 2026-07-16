import { NextResponse } from "next/server";
import { budgetPlanService, getCurrentUser } from "@/infrastructure/di";
import { budgetApiError } from "@/lib/security/budget-api-error";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const history = await budgetPlanService.getWorkflowHistory(params.id, user);
    return NextResponse.json({ data: history, correlationId });
  } catch (e) {
    return budgetApiError(e, correlationId);
  }
}

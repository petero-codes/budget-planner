import { NextResponse } from "next/server";
import { budgetPlanService, getCurrentUser } from "@/infrastructure/di";
import { budgetApiError } from "@/lib/security/budget-api-error";

/**
 * POST /api/v1/budget-plans/:id/submit — WF-002
 * Thin route: session user → BudgetPlanService.submit → ApprovalService.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const plan = await budgetPlanService.submit(params.id, user);
    return NextResponse.json({ data: plan, correlationId });
  } catch (e) {
    return budgetApiError(e, correlationId);
  }
}

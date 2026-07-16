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
    const compare = await budgetPlanService.compareDefault(params.id, user);
    return NextResponse.json({ data: compare, correlationId });
  } catch (e) {
    return budgetApiError(e, correlationId);
  }
}

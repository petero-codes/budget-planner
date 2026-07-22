import { NextRequest, NextResponse } from "next/server";
import { financeService, getCurrentUser } from "@/infrastructure/di";
import { budgetApiError } from "@/lib/security/budget-api-error";

/** POST /api/v1/budget-plans/:id/finance/finalize — WF-007 → FinanceService.finalize */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const plan = await financeService.finalize(
      params.id,
      user,
      correlationId
    );
    return NextResponse.json({ data: plan, correlationId });
  } catch (e) {
    return budgetApiError(e, correlationId);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { financeService, getCurrentUser } from "@/infrastructure/di";
import { parseBody, returnSchema } from "@/lib/security/api-schemas";
import { budgetApiError } from "@/lib/security/budget-api-error";

/** POST /api/v1/budget-plans/:id/finance/return — WF-008 → FinanceService.returnForRevision */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const parsed = await parseBody(req, returnSchema, correlationId);
    if (!parsed.ok) return parsed.response;
    const plan = await financeService.returnForRevision(
      params.id,
      user,
      parsed.data.reason ?? "",
      correlationId
    );
    return NextResponse.json({ data: plan, correlationId });
  } catch (e) {
    return budgetApiError(e, correlationId);
  }
}

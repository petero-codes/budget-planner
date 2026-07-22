import { NextRequest, NextResponse } from "next/server";
import { approvalService, getCurrentUser } from "@/infrastructure/di";
import { parseBody, returnSchema } from "@/lib/security/api-schemas";
import { budgetApiError } from "@/lib/security/budget-api-error";

/** POST /api/v1/budget-plans/:id/return — WF-004 → ApprovalService.returnForRevision */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const parsed = await parseBody(req, returnSchema, correlationId);
    if (!parsed.ok) return parsed.response;
    const plan = await approvalService.returnForRevision(
      params.id,
      user,
      parsed.data.reason ?? parsed.data.comment ?? "",
      correlationId
    );
    return NextResponse.json({ data: plan, correlationId });
  } catch (e) {
    return budgetApiError(e, correlationId);
  }
}

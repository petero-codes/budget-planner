import { NextRequest, NextResponse } from "next/server";
import { approvalService, getCurrentUser } from "@/infrastructure/di";
import { parseBody, rejectSchema } from "@/lib/security/api-schemas";
import { budgetApiError } from "@/lib/security/budget-api-error";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const parsed = await parseBody(req, rejectSchema, correlationId);
    if (!parsed.ok) return parsed.response;
    const plan = await approvalService.reject(
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

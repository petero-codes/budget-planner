import { NextRequest, NextResponse } from "next/server";
import {
  budgetPlanService,
  getCurrentUser,
} from "@/infrastructure/di";
import { createDraftSchema, parseBody } from "@/lib/security/api-schemas";
import { budgetApiError } from "@/lib/security/budget-api-error";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const plan = await budgetPlanService.getById(params.id, user);
    return NextResponse.json({ data: plan, correlationId });
  } catch (e) {
    return budgetApiError(e, correlationId);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const parsed = await parseBody(req, createDraftSchema, correlationId);
    if (!parsed.ok) return parsed.response;
    const plan = await budgetPlanService.updateDraft(
      params.id,
      user,
      parsed.data
    );
    return NextResponse.json({ data: plan, correlationId });
  } catch (e) {
    return budgetApiError(e, correlationId);
  }
}

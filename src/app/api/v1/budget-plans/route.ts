import { NextRequest, NextResponse } from "next/server";
import {
  budgetPlanService,
  getCurrentUser,
} from "@/infrastructure/di";
import { createDraftSchema, parseBody } from "@/lib/security/api-schemas";
import { budgetApiError } from "@/lib/security/budget-api-error";

export async function GET() {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const plans = await budgetPlanService.listVisible(user);
    return NextResponse.json({ data: plans, correlationId });
  } catch (e) {
    return budgetApiError(e, correlationId);
  }
}

export async function POST(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const parsed = await parseBody(req, createDraftSchema, correlationId);
    if (!parsed.ok) return parsed.response;
    const plan = await budgetPlanService.createDraft(user, parsed.data);
    return NextResponse.json({ data: plan, correlationId }, { status: 201 });
  } catch (e) {
    return budgetApiError(e, correlationId);
  }
}

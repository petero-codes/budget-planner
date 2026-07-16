import { NextRequest, NextResponse } from "next/server";
import {
  budgetPlanService,
  getCurrentUser,
} from "@/infrastructure/di";
import { readApiError } from "@/lib/security/read-api-error";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const data = await budgetPlanService.getWithHistory(params.id, user);
    return NextResponse.json({ data, correlationId });
  } catch (e) {
    return readApiError(e, correlationId);
  }
}

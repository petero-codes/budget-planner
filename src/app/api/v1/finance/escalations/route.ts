import { NextResponse } from "next/server";
import { financeService, getCurrentUser } from "@/infrastructure/di";
import { budgetApiError } from "@/lib/security/budget-api-error";

/** Mark overdue Finance queue items as Escalated and notify Finance admins. */
export async function POST() {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const escalated = await financeService.processEscalations(user);
    return NextResponse.json({ data: { escalated }, correlationId });
  } catch (e) {
    return budgetApiError(e, correlationId);
  }
}

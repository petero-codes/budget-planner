import { NextResponse } from "next/server";
import { financeService, getCurrentUser } from "@/infrastructure/di";
import { budgetApiError } from "@/lib/security/budget-api-error";

/** Structured waiting + claimed queues for integrations; UI uses `/finance/approved`. */
export async function GET() {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const [waiting, claimed] = await Promise.all([
      financeService.listQueue(user),
      financeService.listClaimed(user),
    ]);
    return NextResponse.json({ data: { waiting, claimed }, correlationId });
  } catch (e) {
    return budgetApiError(e, correlationId);
  }
}

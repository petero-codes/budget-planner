import { NextResponse } from "next/server";
import { dashboardService, getCurrentUser } from "@/infrastructure/di";
import { readApiError } from "@/lib/security/read-api-error";

export async function GET() {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const data = await dashboardService.getDashboard(user);
    return NextResponse.json({ data, correlationId });
  } catch (e) {
    return readApiError(e, correlationId);
  }
}

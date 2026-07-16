import { NextResponse } from "next/server";
import { executiveService, getCurrentUser } from "@/infrastructure/di";
import { readApiError } from "@/lib/security/read-api-error";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const data = await executiveService.getDepartmentCostCenters(
      user,
      params.id
    );
    return NextResponse.json({ data, correlationId });
  } catch (e) {
    return readApiError(e, correlationId);
  }
}

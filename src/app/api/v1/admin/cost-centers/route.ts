import { NextRequest, NextResponse } from "next/server";
import { costCenterService, getCurrentUser } from "@/infrastructure/di";
import { parseBody } from "@/lib/security/api-schemas";
import { costCenterSchema } from "@/lib/security/master-data-schemas";
import { adminApiError } from "@/lib/security/admin-api-error";

export async function GET() {
  const correlationId = crypto.randomUUID();
  try {
    const actor = await getCurrentUser();
    const data = await costCenterService.list(actor);
    return NextResponse.json({ data, correlationId });
  } catch (error) {
    return adminApiError(error, correlationId);
  }
}

export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const actor = await getCurrentUser();
    const parsed = await parseBody(request, costCenterSchema, correlationId);
    if (!parsed.ok) return parsed.response;
    const costCenter = await costCenterService.create(
      parsed.data,
      actor,
      correlationId
    );
    return NextResponse.json({ data: costCenter, correlationId }, { status: 201 });
  } catch (error) {
    return adminApiError(error, correlationId);
  }
}

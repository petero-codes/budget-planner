import { NextRequest, NextResponse } from "next/server";
import { costCenterService, getCurrentUser } from "@/infrastructure/di";
import { parseBody } from "@/lib/security/api-schemas";
import { costCenterSchema } from "@/lib/security/master-data-schemas";
import { adminApiError } from "@/lib/security/admin-api-error";

type Context = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: Context) {
  const correlationId = crypto.randomUUID();
  try {
    const actor = await getCurrentUser();
    const parsed = await parseBody(request, costCenterSchema, correlationId);
    if (!parsed.ok) return parsed.response;
    const costCenter = await costCenterService.update(
      params.id,
      parsed.data,
      actor,
      correlationId
    );
    return NextResponse.json({ data: costCenter, correlationId });
  } catch (error) {
    return adminApiError(error, correlationId);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { departmentService, getCurrentUser } from "@/infrastructure/di";
import { parseBody } from "@/lib/security/api-schemas";
import { departmentSchema } from "@/lib/security/master-data-schemas";
import { adminApiError } from "@/lib/security/admin-api-error";

type Context = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: Context) {
  const correlationId = crypto.randomUUID();
  try {
    const actor = await getCurrentUser();
    const parsed = await parseBody(request, departmentSchema, correlationId);
    if (!parsed.ok) return parsed.response;
    const department = await departmentService.update(
      params.id,
      parsed.data,
      actor,
      correlationId
    );
    return NextResponse.json({ data: department, correlationId });
  } catch (error) {
    return adminApiError(error, correlationId);
  }
}

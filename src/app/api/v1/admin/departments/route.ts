import { NextRequest, NextResponse } from "next/server";
import { departmentService, getCurrentUser } from "@/infrastructure/di";
import { parseBody } from "@/lib/security/api-schemas";
import { departmentSchema } from "@/lib/security/master-data-schemas";
import { adminApiError } from "@/lib/security/admin-api-error";

export async function GET() {
  const correlationId = crypto.randomUUID();
  try {
    const actor = await getCurrentUser();
    const data = await departmentService.list(actor);
    return NextResponse.json({ data, correlationId });
  } catch (error) {
    return adminApiError(error, correlationId);
  }
}

export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const actor = await getCurrentUser();
    const parsed = await parseBody(request, departmentSchema, correlationId);
    if (!parsed.ok) return parsed.response;
    const department = await departmentService.create(
      parsed.data,
      actor,
      correlationId
    );
    return NextResponse.json({ data: department, correlationId }, { status: 201 });
  } catch (error) {
    return adminApiError(error, correlationId);
  }
}

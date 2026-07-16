import { NextRequest, NextResponse } from "next/server";
import { adminUserService, getCurrentUser } from "@/infrastructure/di";
import { parseBody } from "@/lib/security/api-schemas";
import { adminUserSchema } from "@/lib/security/admin-user-schemas";
import { adminApiError } from "@/lib/security/admin-api-error";

type Context = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: Context) {
  const correlationId = crypto.randomUUID();
  try {
    const actor = await getCurrentUser();
    const detail = await adminUserService.getDetail(params.id, actor);
    return NextResponse.json({ data: detail, correlationId });
  } catch (error) {
    return adminApiError(error, correlationId);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const correlationId = crypto.randomUUID();
  try {
    const actor = await getCurrentUser();
    const parsed = await parseBody(request, adminUserSchema, correlationId);
    if (!parsed.ok) return parsed.response;
    const user = await adminUserService.update(
      params.id,
      parsed.data,
      actor,
      correlationId
    );
    return NextResponse.json({ data: user, correlationId });
  } catch (error) {
    return adminApiError(error, correlationId);
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const correlationId = crypto.randomUUID();
  try {
    const actor = await getCurrentUser();
    const user = await adminUserService.deactivate(
      params.id,
      actor,
      correlationId
    );
    return NextResponse.json({ data: user, correlationId });
  } catch (error) {
    return adminApiError(error, correlationId);
  }
}

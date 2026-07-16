import { NextRequest, NextResponse } from "next/server";
import { adminUserService, getCurrentUser } from "@/infrastructure/di";
import { adminApiError } from "@/lib/security/admin-api-error";

type Context = { params: { id: string } };

export async function POST(_request: NextRequest, { params }: Context) {
  const correlationId = crypto.randomUUID();
  try {
    const actor = await getCurrentUser();
    const user = await adminUserService.activate(
      params.id,
      actor,
      correlationId
    );
    return NextResponse.json({ data: user, correlationId });
  } catch (error) {
    return adminApiError(error, correlationId);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError } from "@/application/authorization-service";
import { ApprovalServiceError } from "@/application/approval-service";
import { approvalService, getCurrentUser } from "@/infrastructure/di";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const plan = await approvalService.reject(
      params.id,
      user,
      body.reason ?? body.comment ?? "",
      correlationId
    );
    return NextResponse.json({ data: plan, correlationId });
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: e.message, correlationId } },
        { status: 403 }
      );
    }
    if (e instanceof ApprovalServiceError) {
      return NextResponse.json(
        { error: { code: e.code, message: e.message, correlationId } },
        { status: 422 }
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: e instanceof Error ? e.message : "Unexpected error",
          correlationId,
        },
      },
      { status: 500 }
    );
  }
}

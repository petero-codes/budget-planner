import { NextRequest, NextResponse } from "next/server";
import { approvalService, getCurrentUser } from "@/infrastructure/di";
import { approveSchema, parseBody } from "@/lib/security/api-schemas";
import { budgetApiError } from "@/lib/security/budget-api-error";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    let comment: string | null = null;
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const parsed = await parseBody(req, approveSchema, correlationId);
      if (!parsed.ok) return parsed.response;
      comment = parsed.data.comment?.trim() || null;
    }
    const plan = await approvalService.approve(
      params.id,
      user,
      comment,
      correlationId
    );
    return NextResponse.json({ data: plan, correlationId });
  } catch (e) {
    return budgetApiError(e, correlationId);
  }
}

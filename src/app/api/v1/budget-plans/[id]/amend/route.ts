import { NextRequest, NextResponse } from "next/server";
import { budgetPlanService, getCurrentUser } from "@/infrastructure/di";
import { budgetApiError } from "@/lib/security/budget-api-error";
import { z } from "zod";

const amendSchema = z.object({
  reason: z.string().min(1, "Amendment reason is required"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const parsed = amendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: parsed.error.issues.map((i) => i.message).join("; "),
            correlationId,
          },
        },
        { status: 400 }
      );
    }
    const plan = await budgetPlanService.createAmendment(
      user,
      params.id,
      parsed.data.reason
    );
    return NextResponse.json({ data: plan, correlationId }, { status: 201 });
  } catch (e) {
    return budgetApiError(e, correlationId);
  }
}

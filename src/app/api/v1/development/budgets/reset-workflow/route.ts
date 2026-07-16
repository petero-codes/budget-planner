import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { developmentToolkitService } from "@/infrastructure/di";
import { withDevelopmentToolkit } from "@/app/api/v1/development/_helpers";

const schema = z.object({
  confirm: z.literal("RESET"),
  reason: z.string(),
  budgetPlanId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  return withDevelopmentToolkit(async (actor, correlationId) => {
    const body = schema.parse(await req.json());
    const data = await developmentToolkitService.resetWorkflow(
      actor,
      body.budgetPlanId,
      body.confirm,
      body.reason,
      correlationId
    );
    return NextResponse.json({ data, correlationId });
  });
}

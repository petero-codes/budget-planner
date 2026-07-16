import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { developmentToolkitService } from "@/infrastructure/di";
import { withDevelopmentToolkit } from "@/app/api/v1/development/_helpers";

const schema = z.object({
  confirm: z.literal("CLONE"),
  reason: z.string(),
  sourcePlanId: z.string().min(1),
  targetFiscalYearId: z.string().min(1),
  copyAttachments: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  return withDevelopmentToolkit(async (actor, correlationId) => {
    const body = schema.parse(await req.json());
    const data = await developmentToolkitService.cloneBudget(
      actor,
      body.sourcePlanId,
      body.targetFiscalYearId,
      body.confirm,
      body.reason,
      { copyAttachments: body.copyAttachments },
      correlationId
    );
    return NextResponse.json({ data, correlationId });
  });
}

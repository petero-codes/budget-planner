import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { developmentToolkitService } from "@/infrastructure/di";
import { withDevelopmentToolkit } from "@/app/api/v1/development/_helpers";

const schema = z.object({
  confirm: z.literal("CLONE"),
  reason: z.string(),
  sourceFiscalYearId: z.string().min(1),
  targetYearLabel: z.number().int().optional(),
  copyFinalizedAsDrafts: z.boolean().default(true),
  copyBudgetLines: z.boolean().default(true),
  copyAttachments: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  return withDevelopmentToolkit(async (actor, correlationId) => {
    const body = schema.parse(await req.json());
    const data = await developmentToolkitService.cloneFiscalYear(
      actor,
      {
        sourceFiscalYearId: body.sourceFiscalYearId,
        targetYearLabel: body.targetYearLabel,
        copyFinalizedAsDrafts: body.copyFinalizedAsDrafts,
        copyBudgetLines: body.copyBudgetLines,
        copyAttachments: body.copyAttachments,
      },
      body.confirm,
      body.reason,
      correlationId
    );
    return NextResponse.json({ data, correlationId });
  });
}

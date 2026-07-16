import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { developmentToolkitService } from "@/infrastructure/di";
import { withDevelopmentToolkit } from "@/app/api/v1/development/_helpers";

const previewSchema = z.object({
  sourceFiscalYearId: z.string().min(1),
  targetYearLabel: z.number().int().optional(),
  copyFinalizedAsDrafts: z.boolean().default(true),
  copyBudgetLines: z.boolean().default(true),
  copyAttachments: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  return withDevelopmentToolkit(async (actor, correlationId) => {
    const body = previewSchema.parse(await req.json());
    const data = await developmentToolkitService.previewCloneFiscalYear(actor, body);
    return NextResponse.json({ data, correlationId });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { developmentToolkitService } from "@/infrastructure/di";
import { withDevelopmentToolkit } from "@/app/api/v1/development/_helpers";

const schema = z.object({
  confirm: z.literal("DELETE_DEMO"),
  reason: z.string(),
  demoBatchId: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  return withDevelopmentToolkit(async (actor, correlationId) => {
    const body = schema.parse(await req.json());
    const data = await developmentToolkitService.deleteDemoBudgets(
      actor,
      body.confirm,
      body.reason,
      body.demoBatchId ?? null,
      correlationId
    );
    return NextResponse.json({ data, correlationId });
  });
}

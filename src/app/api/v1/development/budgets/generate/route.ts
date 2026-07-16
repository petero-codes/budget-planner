import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { developmentToolkitService } from "@/infrastructure/di";
import { withDevelopmentToolkit } from "@/app/api/v1/development/_helpers";

const schema = z.object({
  confirm: z.literal("GENERATE"),
  reason: z.string(),
  count: z.union([
    z.literal(5),
    z.literal(20),
    z.literal(100),
    z.literal(500),
  ]),
});

export async function POST(req: NextRequest) {
  return withDevelopmentToolkit(async (actor, correlationId) => {
    const body = schema.parse(await req.json());
    const data = await developmentToolkitService.generateDemoBudgets(
      actor,
      body.count,
      body.confirm,
      body.reason,
      correlationId
    );
    return NextResponse.json({ data, correlationId });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { developmentToolkitService } from "@/infrastructure/di";
import { withDevelopmentToolkit } from "@/app/api/v1/development/_helpers";

const schema = z.object({
  confirm: z.literal("CLEAR"),
  reason: z.string(),
  userId: z.string().min(1).nullable().optional(),
});

export async function POST(req: NextRequest) {
  return withDevelopmentToolkit(async (actor, correlationId) => {
    const body = schema.parse(await req.json());
    const data = await developmentToolkitService.clearNotifications(
      actor,
      body.confirm,
      body.reason,
      body.userId ?? null,
      correlationId
    );
    return NextResponse.json({ data, correlationId });
  });
}

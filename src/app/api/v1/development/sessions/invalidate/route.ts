import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { developmentToolkitService } from "@/infrastructure/di";
import { withDevelopmentToolkit } from "@/app/api/v1/development/_helpers";

const schema = z.object({
  confirm: z.string(),
  reason: z.string(),
  all: z.boolean().optional(),
  userId: z.string().uuid().optional(),
  sessionId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  return withDevelopmentToolkit(async (actor, correlationId) => {
    const body = schema.parse(await req.json());
    const data = await developmentToolkitService.invalidateSessions(
      actor,
      body.confirm,
      body.reason,
      { all: body.all, userId: body.userId, sessionId: body.sessionId },
      correlationId
    );
    return NextResponse.json({ data, correlationId });
  });
}
